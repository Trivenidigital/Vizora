import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ContentService } from './content.service';

/**
 * O10 — Content approval pipeline tests.
 *
 * Focused sibling spec for the new submitForApproval / approveContent /
 * rejectFromApproval methods. The big content.service.spec.ts has its own
 * setup; rather than threading new tests in there, this sibling targets
 * the new flow specifically with a minimal mock surface.
 */
describe('ContentService — Approval pipeline (O10)', () => {
  let service: ContentService;
  let db: any;
  let events: any;
  let notifications: any;

  const orgId = 'org-1';
  const contentId = 'content-1';
  const proposerId = 'user-proposer';
  const approverId = 'user-approver';

  beforeEach(() => {
    db = {
      content: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    events = { emit: jest.fn() };
    notifications = { create: jest.fn() };

    // ContentService(db, templateRendering, dataSourceRegistry,
    //                storageQuota, storage, eventEmitter, notifications)
    service = new ContentService(
      db,
      null as any,        // templateRendering
      null as any,        // dataSourceRegistry
      null as any,        // storageQuota
      null as any,        // storage
      events,             // eventEmitter
      notifications,      // notifications
    );
  });

  afterEach(() => jest.clearAllMocks());

  // ---------------------------------------------------------------------------
  // submitForApproval
  // ---------------------------------------------------------------------------
  describe('submitForApproval', () => {
    it('moves draft → pending_approval and stamps approval metadata', async () => {
      const draft = { id: contentId, organizationId: orgId, status: 'draft', metadata: null, name: 'Promo', type: 'image' };
      db.content.findFirst.mockResolvedValue(draft);
      db.content.updateMany.mockResolvedValue({ count: 1 });
      db.content.findUnique.mockResolvedValue({ ...draft, status: 'pending_approval' });

      await service.submitForApproval(orgId, contentId, proposerId, 'ready for review');

      const updateCall = db.content.updateMany.mock.calls[0][0];
      expect(updateCall.where.status).toBe('draft');           // optimistic predicate
      expect(updateCall.data.status).toBe('pending_approval');
      const meta = updateCall.data.metadata as Record<string, any>;
      expect(meta.approval.submittedBy).toBe(proposerId);
      expect(meta.approval.submissionNote).toBe('ready for review');

      expect(events.emit).toHaveBeenCalledWith('content.approval.submitted', {
        organizationId: orgId,
        contentId,
        submittedBy: proposerId,
      });
    });

    it('rejects submission if content is not in draft state', async () => {
      db.content.findFirst.mockResolvedValue({ id: contentId, organizationId: orgId, status: 'active' });
      await expect(
        service.submitForApproval(orgId, contentId, proposerId),
      ).rejects.toThrow(BadRequestException);
      expect(db.content.updateMany).not.toHaveBeenCalled();
    });

    it('throws NotFound on cross-org content (inherited findOne guard)', async () => {
      db.content.findFirst.mockResolvedValue(null);
      await expect(service.submitForApproval(orgId, 'foreign', proposerId)).rejects.toThrow(NotFoundException);
    });

    it('concurrent status change → updateMany count=0 → BadRequestException', async () => {
      const draft = { id: contentId, organizationId: orgId, status: 'draft', metadata: null };
      db.content.findFirst.mockResolvedValue(draft);
      db.content.updateMany.mockResolvedValue({ count: 0 });           // concurrent writer

      await expect(service.submitForApproval(orgId, contentId, proposerId)).rejects.toThrow(BadRequestException);
    });
  });

  // ---------------------------------------------------------------------------
  // approveContent
  // ---------------------------------------------------------------------------
  describe('approveContent', () => {
    const pending = {
      id: contentId,
      organizationId: orgId,
      status: 'pending_approval',
      metadata: { approval: { submittedBy: proposerId } },
    };

    it('moves pending_approval → active and stamps approver metadata', async () => {
      db.content.findFirst.mockResolvedValue(pending);
      db.content.updateMany.mockResolvedValue({ count: 1 });
      db.content.findUnique.mockResolvedValue({ ...pending, status: 'active' });

      await service.approveContent(orgId, contentId, approverId, 'looks good');

      const updateCall = db.content.updateMany.mock.calls[0][0];
      expect(updateCall.data.status).toBe('active');
      const meta = updateCall.data.metadata as Record<string, any>;
      expect(meta.approval.approvedBy).toBe(approverId);
      expect(meta.approval.decision).toBe('approved');
      expect(meta.approval.submittedBy).toBe(proposerId); // history preserved

      expect(events.emit).toHaveBeenCalledWith('content.approval.approved', expect.any(Object));
    });

    it('rejects self-approval (proposer == approver)', async () => {
      db.content.findFirst.mockResolvedValue(pending);
      await expect(
        service.approveContent(orgId, contentId, proposerId, 'I made this'),
      ).rejects.toThrow(BadRequestException);
      expect(db.content.updateMany).not.toHaveBeenCalled();
    });

    it('rejects approval if content is not pending_approval', async () => {
      db.content.findFirst.mockResolvedValue({ ...pending, status: 'active' });
      await expect(service.approveContent(orgId, contentId, approverId)).rejects.toThrow(BadRequestException);
    });

    it('concurrent status change → updateMany count=0 → BadRequestException', async () => {
      db.content.findFirst.mockResolvedValue(pending);
      db.content.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.approveContent(orgId, contentId, approverId)).rejects.toThrow(BadRequestException);
    });
  });

  // ---------------------------------------------------------------------------
  // rejectFromApproval
  // ---------------------------------------------------------------------------
  describe('rejectFromApproval', () => {
    const pending = {
      id: contentId,
      organizationId: orgId,
      status: 'pending_approval',
      metadata: { approval: { submittedBy: proposerId } },
    };

    it('moves pending_approval → rejected with reason', async () => {
      db.content.findFirst.mockResolvedValue(pending);
      db.content.updateMany.mockResolvedValue({ count: 1 });
      db.content.findUnique.mockResolvedValue({ ...pending, status: 'rejected' });

      await service.rejectFromApproval(orgId, contentId, approverId, 'logo missing');

      const updateCall = db.content.updateMany.mock.calls[0][0];
      expect(updateCall.data.status).toBe('rejected');
      const meta = updateCall.data.metadata as Record<string, any>;
      expect(meta.approval.rejectedBy).toBe(approverId);
      expect(meta.approval.rejectionReason).toBe('logo missing');
      expect(meta.approval.decision).toBe('rejected');

      expect(events.emit).toHaveBeenCalledWith('content.approval.rejected', expect.any(Object));
    });

    it('requires non-empty reason', async () => {
      await expect(service.rejectFromApproval(orgId, contentId, approverId, '')).rejects.toThrow(BadRequestException);
      await expect(service.rejectFromApproval(orgId, contentId, approverId, '   ')).rejects.toThrow(BadRequestException);
      expect(db.content.findFirst).not.toHaveBeenCalled();
    });

    it('rejects if content is not pending_approval', async () => {
      db.content.findFirst.mockResolvedValue({ ...pending, status: 'draft' });
      await expect(service.rejectFromApproval(orgId, contentId, approverId, 'no')).rejects.toThrow(BadRequestException);
    });

    it('ALLOWS proposer to reject their own submission (withdraw)', async () => {
      db.content.findFirst.mockResolvedValue(pending);
      db.content.updateMany.mockResolvedValue({ count: 1 });
      db.content.findUnique.mockResolvedValue({ ...pending, status: 'rejected' });

      // Note: the proposerId is the same as the user calling reject here —
      // unlike approve, self-rejection IS allowed (treat as "withdraw").
      await expect(
        service.rejectFromApproval(orgId, contentId, proposerId, 'withdrawing'),
      ).resolves.toBeDefined();
    });

    it('concurrent status change → updateMany count=0 → BadRequestException', async () => {
      db.content.findFirst.mockResolvedValue(pending);
      db.content.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.rejectFromApproval(orgId, contentId, approverId, 'reason')).rejects.toThrow(BadRequestException);
    });
  });
});

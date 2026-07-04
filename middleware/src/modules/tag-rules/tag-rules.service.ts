import {
  ForbiddenException,
  GatewayTimeoutException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DatabaseService } from '../database/database.service';
import { CreateTagRuleDto } from './dto/create-tag-rule.dto';
import { UpdateTagRuleDto } from './dto/update-tag-rule.dto';
import { ListTagRulesQueryDto } from './dto/list-tag-rules-query.dto';
import { PRIORITY_DEFAULT, REEVAL_TIMEOUT_MS } from './tag-rule.types';

/**
 * O4 — Tag-rule auto-assignment engine.
 *
 * Per-org rule: "every Display with tag X auto-assigns Playlist Y as its
 * currentPlaylistId" — first-write-wins (manual assignments never overwritten).
 *
 * Patterns mirror O7 (`alert-rules.service.ts`):
 *   - Cross-org guards: every read/write filters by organizationId
 *   - Cross-tenant validation at the service layer (DTO can't see caller's orgId)
 *   - Atomic CAS via `updateMany({ where: { ..., currentPlaylistId: null }, data: ... })`
 *   - Idempotency on (organizationId, name) UNIQUE index
 *
 * Sweep timing: `sweepDisplaysForTag` is wrapped in `REEVAL_TIMEOUT_MS`.
 * On exceed, throws `GatewayTimeoutException` carrying `{ scanned, assigned,
 * total }` partial counts so the controller can surface them to operators.
 */
@Injectable()
export class TagRulesService {
  private readonly logger = new Logger(TagRulesService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly events: EventEmitter2,
  ) {}

  // ---------------------------------------------------------------------------
  // CRUD
  // ---------------------------------------------------------------------------

  async create(organizationId: string, dto: CreateTagRuleDto) {
    await this.validateRuleRefs(organizationId, dto.tagId, dto.playlistId);

    const rule = await this.db.tagAssignmentRule.create({
      data: {
        organizationId,
        name: dto.name,
        tagId: dto.tagId,
        playlistId: dto.playlistId,
        isActive: dto.isActive ?? true,
        priority: dto.priority ?? PRIORITY_DEFAULT,
      },
    });

    // Sweep matched displays. Errors do NOT roll back the rule — the rule
    // exists and natural display.tags.changed events will converge over time.
    if (rule.isActive) {
      try {
        await this.sweepDisplaysForTag(organizationId, rule.tagId);
      } catch (err) {
        if (err instanceof GatewayTimeoutException) throw err;
        this.logger.warn(
          `Sweep after creating rule ${rule.id} failed: ${err instanceof Error ? err.message : 'unknown'}. Natural events will converge.`,
        );
      }
    }

    return rule;
  }

  async findAll(organizationId: string, query?: ListTagRulesQueryDto) {
    return this.db.tagAssignmentRule.findMany({
      where: {
        organizationId,
        ...(query?.isActive !== undefined ? { isActive: query.isActive } : {}),
        ...(query?.tagId ? { tagId: query.tagId } : {}),
        ...(query?.playlistId ? { playlistId: query.playlistId } : {}),
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async findOne(organizationId: string, id: string) {
    const rule = await this.db.tagAssignmentRule.findFirst({
      where: { id, organizationId },
    });
    if (!rule) {
      throw new NotFoundException(`Tag assignment rule ${id} not found`);
    }
    return rule;
  }

  async update(organizationId: string, id: string, dto: UpdateTagRuleDto) {
    const before = await this.findOne(organizationId, id);

    // Re-validate any tagId/playlistId pointing at potentially-different
    // resources — they must still belong to the same org.
    if (dto.tagId !== undefined || dto.playlistId !== undefined) {
      await this.validateRuleRefs(organizationId, dto.tagId, dto.playlistId);
    }

    // Org-scoped in the write itself (tenant-guard enforce prereq): updateMany
    // requires id AND organizationId, so a cross-tenant id affects zero rows.
    const scoped = await this.db.tagAssignmentRule.updateMany({
      where: { id, organizationId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.tagId !== undefined ? { tagId: dto.tagId } : {}),
        ...(dto.playlistId !== undefined ? { playlistId: dto.playlistId } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
      },
    });
    if (scoped.count === 0) {
      throw new NotFoundException(`Tag assignment rule ${id} not found`);
    }
    const after = await this.db.tagAssignmentRule.findFirst({
      where: { id, organizationId },
    });
    if (!after) {
      throw new NotFoundException(`Tag assignment rule ${id} not found`);
    }

    // Re-sweep when ANY of these change — including priority, since a
    // priority drop can promote this rule past an existing rule for a
    // display where both match.
    const sweepTriggers: Array<keyof UpdateTagRuleDto> = ['isActive', 'tagId', 'playlistId', 'priority'];
    const changed = sweepTriggers.some(
      (k) => dto[k] !== undefined && dto[k] !== (before as unknown as Record<string, unknown>)[k],
    );

    if (changed && after.isActive) {
      try {
        // If tagId changed and the rule was active, sweep the OLD tag too so
        // displays no longer covered are re-evaluated against remaining rules.
        // (We don't unassign — but a different rule may now win for them.)
        if (before.tagId !== after.tagId && before.isActive) {
          await this.sweepDisplaysForTag(organizationId, before.tagId);
        }
        await this.sweepDisplaysForTag(organizationId, after.tagId);
      } catch (err) {
        if (err instanceof GatewayTimeoutException) throw err;
        this.logger.warn(
          `Sweep after updating rule ${id} failed: ${err instanceof Error ? err.message : 'unknown'}. Natural events will converge.`,
        );
      }
    }

    return after;
  }

  async remove(organizationId: string, id: string): Promise<void> {
    // Org-scoped in the write (tenant-guard enforce prereq): deleteMany requires
    // id AND organizationId, so a cross-tenant id affects zero rows → NotFound.
    const result = await this.db.tagAssignmentRule.deleteMany({ where: { id, organizationId } });
    if (result.count === 0) {
      throw new NotFoundException('Tag assignment rule not found');
    }
    // Note: currently-assigned playlists STAY on displays. Intentional v1
    // behavior — assignments persist independently of the rule that set them.
  }

  /**
   * POST /:id/re-evaluate — force re-run of one rule against every matched
   * display. Idempotent (predicate-protected UPDATE).
   */
  async reEvaluateRule(organizationId: string, id: string) {
    const rule = await this.findOne(organizationId, id);
    if (!rule.isActive) return { scanned: 0, assigned: 0 };
    return this.sweepDisplaysForTag(organizationId, rule.tagId);
  }

  // ---------------------------------------------------------------------------
  // Evaluator entry point
  // ---------------------------------------------------------------------------

  /**
   * Called by TagRuleEvaluator. Returns true iff THIS call assigned a playlist.
   *
   * Algorithm: pick the highest-priority active rule whose tag matches one of
   * the display's tags AND whose playlistId is non-null. Atomic CAS via
   * `updateMany` with `currentPlaylistId: null` predicate ensures only one
   * writer wins under PM2 cluster mode.
   */
  async evaluateForDisplay(organizationId: string, displayId: string): Promise<boolean> {
    const display = await this.db.display.findFirst({
      where: { id: displayId, organizationId },
      include: { tags: { select: { tagId: true } } },
    });
    if (!display) return false;
    if (display.currentPlaylistId !== null) return false;                  // first-write-wins
    if (display.tags.length === 0) return false;

    const candidateRules = await this.db.tagAssignmentRule.findMany({
      where: {
        organizationId,
        isActive: true,
        tagId: { in: display.tags.map((t) => t.tagId) },
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    });

    for (const rule of candidateRules) {
      if (rule.playlistId === null) {
        this.logger.warn(
          `Rule ${rule.id} (org=${organizationId}) has playlistId=null — referenced Playlist was deleted (SetNull cascade). Skipping; admin must fix the rule.`,
        );
        continue;
      }

      // Atomic CAS: only assigns if currentPlaylistId is still null. Under
      // PM2 cluster mode this guarantees exactly one writer wins.
      //
      // CONTRACT FOR FUTURE O1 (unified push): O1 is the OPPOSITE side of
      // this contract — it overwrites currentPlaylistId unconditionally (push
      // always wins). O1 implementers MUST NOT adopt this `currentPlaylistId:
      // null` predicate; doing so would silently make manual pushes fail when
      // a tag-rule already won. The two writers are coordinated by:
      //   - O4 (here): only writes when null  → respects manual / O1 pushes
      //   - O1 (future): always writes        → overrides O4's assignment
      const updated = await this.db.display.updateMany({
        where: { id: displayId, organizationId, currentPlaylistId: null },
        data: { currentPlaylistId: rule.playlistId },
      });
      if (updated.count === 0) return false;                               // another writer won

      this.events.emit('display.playlist.assigned', {
        organizationId,
        displayId,
        playlistId: rule.playlistId,
        ruleId: rule.id,
        source: 'tag_rule',
      });
      return true;
    }

    return false;
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * Cross-org + cross-tenant validation. The DTO can't enforce this because
   * the DTO doesn't know the caller's organizationId.
   */
  private async validateRuleRefs(
    organizationId: string,
    tagId: string | undefined,
    playlistId: string | undefined,
  ): Promise<void> {
    if (tagId !== undefined) {
      const tag = await this.db.tag.findFirst({
        where: { id: tagId, organizationId },
      });
      if (!tag) {
        throw new ForbiddenException(`Tag ${tagId} does not belong to this organization`);
      }
    }
    if (playlistId !== undefined) {
      const playlist = await this.db.playlist.findFirst({
        where: { id: playlistId, organizationId },
      });
      if (!playlist) {
        throw new ForbiddenException(
          `Playlist ${playlistId} does not belong to this organization`,
        );
      }
    }
  }

  /**
   * Re-evaluate every display in the org currently carrying `tagId` whose
   * `currentPlaylistId` is null. Each call to `evaluateForDisplay` is
   * predicate-protected — duplicate sweeps are safe (idempotent).
   *
   * Wrapped in REEVAL_TIMEOUT_MS. On exceed, throws GatewayTimeoutException
   * whose response payload carries `{ scanned, assigned, total }` so the
   * caller sees how far the sweep got.
   */
  private async sweepDisplaysForTag(
    organizationId: string,
    tagId: string,
  ): Promise<{ scanned: number; assigned: number }> {
    const start = Date.now();

    const taggedDisplays = await this.db.displayTag.findMany({
      where: { tagId, display: { organizationId, currentPlaylistId: null } },
      select: { displayId: true },
    });

    let assigned = 0;
    for (let i = 0; i < taggedDisplays.length; i++) {
      if (Date.now() - start > REEVAL_TIMEOUT_MS) {
        throw new GatewayTimeoutException({
          message: `Tag-rule re-evaluation sweep exceeded ${REEVAL_TIMEOUT_MS}ms for tag ${tagId} in org ${organizationId}`,
          scanned: i,
          assigned,
          total: taggedDisplays.length,
          hint: 'Natural display.tags.changed events will converge over time. Optionally re-trigger via POST /tag-rules/:id/re-evaluate.',
        });
      }

      if (await this.evaluateForDisplay(organizationId, taggedDisplays[i].displayId)) {
        assigned++;
      }
    }

    return { scanned: taggedDisplays.length, assigned };
  }
}

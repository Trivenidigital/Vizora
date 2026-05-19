import { TagRuleEvaluator } from './tag-rule.evaluator';
import { TagRulesService } from './tag-rules.service';

describe('TagRuleEvaluator', () => {
  let evaluator: TagRuleEvaluator;
  let service: jest.Mocked<Pick<TagRulesService, 'evaluateForDisplay'>>;

  const orgId = 'org-123';
  const displayId = 'display-1';
  const payload = { organizationId: orgId, displayId };

  beforeEach(() => {
    service = { evaluateForDisplay: jest.fn() } as any;
    evaluator = new TagRuleEvaluator(service as unknown as TagRulesService);
  });

  afterEach(() => jest.clearAllMocks());

  it('display.tags.changed → evaluateForDisplay with correct payload', async () => {
    service.evaluateForDisplay.mockResolvedValue(true);
    await evaluator.onTagsChanged(payload);
    expect(service.evaluateForDisplay).toHaveBeenCalledWith(orgId, displayId);
  });

  it('display.paired → evaluateForDisplay with correct payload', async () => {
    service.evaluateForDisplay.mockResolvedValue(true);
    await evaluator.onDisplayPaired(payload);
    expect(service.evaluateForDisplay).toHaveBeenCalledWith(orgId, displayId);
  });

  it('top-level try/catch in onTagsChanged swallows service failures (no unhandled rejection)', async () => {
    service.evaluateForDisplay.mockRejectedValue(new Error('DB down'));
    await expect(evaluator.onTagsChanged(payload)).resolves.toBeUndefined();
  });

  it('top-level try/catch in onDisplayPaired swallows service failures', async () => {
    service.evaluateForDisplay.mockRejectedValue(new Error('DB down'));
    await expect(evaluator.onDisplayPaired(payload)).resolves.toBeUndefined();
  });

  it('the two handlers crash-independently (one throwing does not block the other)', async () => {
    service.evaluateForDisplay
      .mockRejectedValueOnce(new Error('first call boom'))
      .mockResolvedValueOnce(true);

    await evaluator.onTagsChanged(payload);
    await evaluator.onDisplayPaired(payload);

    expect(service.evaluateForDisplay).toHaveBeenCalledTimes(2);
  });

  it('does NOT consume display.playlist.assigned events (no infinite loop)', () => {
    // The evaluator must not have a handler for display.playlist.assigned —
    // otherwise the service's own emission would re-trigger evaluation forever.
    // Verify by inspecting the prototype's @OnEvent metadata via reflect-metadata.
    const proto = Object.getPrototypeOf(evaluator);
    const methodNames = Object.getOwnPropertyNames(proto).filter((n) => n !== 'constructor');

    for (const name of methodNames) {
      const meta = Reflect.getMetadata?.('OnEvent', proto, name) as { event?: string } | undefined;
      if (meta?.event) {
        expect(meta.event).not.toBe('display.playlist.assigned');
      }
    }

    // Belt-and-braces: structurally there should be exactly 2 @OnEvent methods.
    expect(methodNames.filter((n) => n.startsWith('on')).length).toBe(2);
  });
});

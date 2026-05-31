import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { ApiKeysService } from '../api-keys.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  constructor(private readonly apiKeysService: ApiKeysService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];

    if (!apiKey) return false;

    const keyRecord = await this.apiKeysService.validateKey(apiKey);
    if (!keyRecord) return false;

    // Attach org context to request for downstream use
    request.organizationId = keyRecord.organizationId;
    request.apiKeyScopes = keyRecord.scopes;
    request.apiKeyId = keyRecord.id;

    // Update last used timestamp — intentionally fire-and-forget so a
    // transient DB blip doesn't fail an otherwise-valid auth, but logged
    // at warn so the failure is visible. R10 api-keys scout: previous
    // empty .catch() hid DB degradation and left the audit trail with
    // silent gaps. The request still succeeds (key was valid); ops sees
    // the warn and knows the timestamp didn't update.
    this.apiKeysService.updateLastUsed(keyRecord.id).catch((err) => {
      this.logger.warn(
        `Failed to update lastUsedAt for api-key ${keyRecord.id}: ${err instanceof Error ? err.message : 'unknown error'}`,
      );
    });

    return true;
  }
}

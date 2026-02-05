import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { ApiKeysService } from '../api-keys.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
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

    // Update last used timestamp (fire and forget)
    this.apiKeysService.updateLastUsed(keyRecord.id).catch(() => {
      // Silently ignore errors updating lastUsedAt
    });

    return true;
  }
}

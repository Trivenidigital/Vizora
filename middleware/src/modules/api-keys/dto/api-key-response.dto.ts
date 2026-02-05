export class ApiKeyResponseDto {
  id!: string;
  name!: string;
  prefix!: string;
  scopes!: string[];
  lastUsedAt!: Date | null;
  expiresAt!: Date | null;
  createdAt!: Date;
}

export class CreateApiKeyResponseDto {
  key!: string; // Plain key, only returned on creation
  apiKey!: ApiKeyResponseDto;
}

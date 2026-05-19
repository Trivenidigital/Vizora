import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  Matches,
  MinLength,
} from 'class-validator';
import { WEBHOOK_EVENTS, WebhookEvent } from '../webhook.types';

export class CreateWebhookDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  /**
   * HTTPS URL only. SSRF guard at the service layer rejects private/
   * loopback/link-local hosts. We intentionally require https:// rather
   * than tolerating http:// — outbound webhooks SHOULD be encrypted.
   */
  @IsString()
  @Matches(/^https:\/\//, { message: 'webhook url must use HTTPS' })
  @MaxLength(2000)
  url!: string;

  /**
   * Customer-supplied HMAC secret. Must be at least 16 chars (so dictionary
   * attack on a stolen payload+signature pair is impractical). The DTO
   * caps at 256 — sufficient for any sane keying material.
   */
  @IsString()
  @MinLength(16, { message: 'secret must be at least 16 characters' })
  @MaxLength(256)
  secret!: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'at least one event must be subscribed' })
  @ArrayUnique()
  @IsIn(WEBHOOK_EVENTS, { each: true, message: `each event must be one of: ${WEBHOOK_EVENTS.join(', ')}` })
  events!: WebhookEvent[];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

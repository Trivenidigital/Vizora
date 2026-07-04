import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateProvisioningTemplateDto } from './dto/create-provisioning-template.dto';
import { UpdateProvisioningTemplateDto } from './dto/update-provisioning-template.dto';

/**
 * O6 — Provisioning template CRUD + apply-at-pairing helper.
 *
 * Pattern mirrors O7 alert-rules / O4 tag-rules:
 *   - Cross-org guards: every read/write filters by organizationId
 *   - Cross-tenant validation at the service layer (DTO doesn't know orgId)
 *   - Idempotent (organizationId, name) unique index for clean UI semantics
 */
@Injectable()
export class ProvisioningTemplatesService {
  private readonly logger = new Logger(ProvisioningTemplatesService.name);

  constructor(private readonly db: DatabaseService) {}

  async create(organizationId: string, dto: CreateProvisioningTemplateDto) {
    if (dto.defaultPlaylistId !== undefined) {
      await this.validatePlaylistInOrg(organizationId, dto.defaultPlaylistId);
    }

    return this.db.provisioningTemplate.create({
      data: {
        organizationId,
        name: dto.name,
        description: dto.description,
        defaultOrientation: dto.defaultOrientation ?? 'landscape',
        defaultTimezone: dto.defaultTimezone ?? 'UTC',
        defaultPlaylistId: dto.defaultPlaylistId,
        isDefault: dto.isDefault ?? false,
      },
    });
  }

  async findAll(organizationId: string) {
    return this.db.provisioningTemplate.findMany({
      where: { organizationId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(organizationId: string, id: string) {
    const tpl = await this.db.provisioningTemplate.findFirst({
      where: { id, organizationId },
    });
    if (!tpl) {
      throw new NotFoundException(`Provisioning template ${id} not found`);
    }
    return tpl;
  }

  async update(organizationId: string, id: string, dto: UpdateProvisioningTemplateDto) {
    await this.findOne(organizationId, id);

    if (dto.defaultPlaylistId !== undefined && dto.defaultPlaylistId !== null) {
      await this.validatePlaylistInOrg(organizationId, dto.defaultPlaylistId);
    }

    // Org-scoped in the write itself (tenant-guard enforce prereq): updateMany
    // requires id AND organizationId, so a cross-tenant id affects zero rows.
    const scoped = await this.db.provisioningTemplate.updateMany({
      where: { id, organizationId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.defaultOrientation !== undefined ? { defaultOrientation: dto.defaultOrientation } : {}),
        ...(dto.defaultTimezone !== undefined ? { defaultTimezone: dto.defaultTimezone } : {}),
        ...(dto.defaultPlaylistId !== undefined ? { defaultPlaylistId: dto.defaultPlaylistId } : {}),
        ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
      },
    });
    if (scoped.count === 0) {
      throw new NotFoundException(`Provisioning template ${id} not found`);
    }
    return this.db.provisioningTemplate.findFirst({
      where: { id, organizationId },
    });
  }

  async remove(organizationId: string, id: string): Promise<void> {
    // Org-scoped in the write (tenant-guard enforce prereq).
    const result = await this.db.provisioningTemplate.deleteMany({ where: { id, organizationId } });
    if (result.count === 0) {
      throw new NotFoundException('Provisioning template not found');
    }
  }

  /**
   * Resolve a template + apply its defaults at pairing time.
   *
   * Returns the override fields to merge into the Display.create / update
   * payload: `{ orientation, timezone, currentPlaylistId? }`. Cross-org
   * guard: the template must belong to the caller's org. If the template's
   * defaultPlaylistId was set non-null at create but the Playlist was
   * deleted (SetNull cascade), the orientation/timezone defaults still
   * apply and currentPlaylistId is omitted (Display.currentPlaylistId stays
   * at its prior value).
   */
  async resolveForPairing(
    organizationId: string,
    templateId: string,
  ): Promise<{
    orientation: string;
    timezone: string;
    currentPlaylistId?: string;
  }> {
    const tpl = await this.findOne(organizationId, templateId);
    return {
      orientation: tpl.defaultOrientation,
      timezone: tpl.defaultTimezone,
      ...(tpl.defaultPlaylistId
        ? { currentPlaylistId: tpl.defaultPlaylistId }
        : {}),
    };
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * Cross-tenant guard. Service layer (not DTO) because the DTO doesn't
   * know the caller's organizationId.
   */
  private async validatePlaylistInOrg(organizationId: string, playlistId: string): Promise<void> {
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

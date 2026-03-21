import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

/**
 * Known feature flags with their default-enabled state.
 * All features are enabled by default unless explicitly disabled per org.
 */
export const FEATURE_FLAGS = {
  weatherWidget: true,
  rssWidget: true,
  clockWidget: true,
  fleetControl: true,
  contentModeration: true,
  customBranding: true,
  advancedAnalytics: true,
  emergencyOverride: true,
} as const;

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;

@Injectable()
export class FeatureFlagService {
  private readonly logger = new Logger(FeatureFlagService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Check if a feature is enabled for an organization.
   * Default: enabled unless explicitly set to false.
   */
  async isEnabled(orgId: string, feature: string): Promise<boolean> {
    const org = await this.db.organization.findUnique({ where: { id: orgId } });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }
    const settings = (org.settings as Record<string, any>) || {};
    const flags = settings.featureFlags || {};
    return flags[feature] !== false;
  }

  /**
   * Get all feature flags for an organization.
   * Merges defaults with stored overrides.
   */
  async getFlags(orgId: string): Promise<Record<string, boolean>> {
    const org = await this.db.organization.findUnique({ where: { id: orgId } });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }
    const settings = (org.settings as Record<string, any>) || {};
    const stored = settings.featureFlags || {};

    // Merge defaults with stored overrides
    const merged: Record<string, boolean> = {};
    for (const [key, defaultValue] of Object.entries(FEATURE_FLAGS)) {
      merged[key] = stored[key] !== undefined ? stored[key] : defaultValue;
    }
    return merged;
  }

  /**
   * Update feature flags for an organization.
   * Only accepts known flag keys. Merges with existing flags.
   */
  async setFlags(orgId: string, flags: Record<string, boolean>): Promise<Record<string, boolean>> {
    const org = await this.db.organization.findUnique({ where: { id: orgId } });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    // Filter to only known flag keys
    const validFlags: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(flags)) {
      if (key in FEATURE_FLAGS && typeof value === 'boolean') {
        validFlags[key] = value;
      }
    }

    const settings = (org.settings as Record<string, any>) || {};
    const currentFlags = settings.featureFlags || {};
    const updatedFlags = { ...currentFlags, ...validFlags };

    await this.db.organization.update({
      where: { id: orgId },
      data: {
        settings: { ...settings, featureFlags: updatedFlags },
      },
    });

    this.logger.log(
      `Feature flags updated for org ${orgId}: ${JSON.stringify(validFlags)}`,
    );

    // Return the full merged flags
    return this.getFlags(orgId);
  }
}

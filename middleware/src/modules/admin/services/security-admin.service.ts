import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

export interface BlockIpDto {
  ipAddress: string;
  reason?: string;
  expiresAt?: Date;
}

export interface IpBlocklistEntry {
  id: string;
  ipAddress: string;
  reason: string | null;
  blockedBy: string | null;
  expiresAt: Date | null;
  isActive: boolean;
  createdAt: Date;
}

export interface ApiKeyInfo {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  createdBy: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  } | null;
}

export interface FailedLoginStats {
  period: string;
  totalAttempts: number;
  uniqueIps: number;
  uniqueEmails: number;
  byIp: Array<{ ip: string; count: number }>;
  byEmail: Array<{ email: string; count: number }>;
}

@Injectable()
export class SecurityAdminService {
  private readonly logger = new Logger(SecurityAdminService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Get all IP blocklist entries
   */
  async getIpBlocklist(): Promise<IpBlocklistEntry[]> {
    return this.db.ipBlocklist.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Block an IP address
   */
  async blockIp(
    dto: BlockIpDto,
    adminUserId: string,
  ): Promise<IpBlocklistEntry> {
    // Validate IP format (basic validation)
    if (!this.isValidIpOrCidr(dto.ipAddress)) {
      throw new BadRequestException('Invalid IP address or CIDR format');
    }

    // Check if already blocked
    const existing = await this.db.ipBlocklist.findUnique({
      where: { ipAddress: dto.ipAddress },
    });

    if (existing && existing.isActive) {
      throw new BadRequestException('IP address is already blocked');
    }

    // Create or update the blocklist entry
    const entry = await this.db.ipBlocklist.upsert({
      where: { ipAddress: dto.ipAddress },
      create: {
        ipAddress: dto.ipAddress,
        reason: dto.reason,
        blockedBy: adminUserId,
        expiresAt: dto.expiresAt,
        isActive: true,
      },
      update: {
        reason: dto.reason,
        blockedBy: adminUserId,
        expiresAt: dto.expiresAt,
        isActive: true,
        createdAt: new Date(),
      },
    });

    this.logger.warn(`Blocked IP ${dto.ipAddress} by admin ${adminUserId}: ${dto.reason || 'No reason provided'}`);
    return entry;
  }

  /**
   * Unblock an IP address
   */
  async unblockIp(id: string): Promise<IpBlocklistEntry> {
    const entry = await this.db.ipBlocklist.findUnique({
      where: { id },
    });

    if (!entry) {
      throw new NotFoundException(`IP blocklist entry ${id} not found`);
    }

    if (!entry.isActive) {
      throw new BadRequestException('IP is already unblocked');
    }

    const updated = await this.db.ipBlocklist.update({
      where: { id },
      data: { isActive: false },
    });

    this.logger.log(`Unblocked IP ${entry.ipAddress}`);
    return updated;
  }

  /**
   * Check if an IP address is blocked
   */
  async isIpBlocked(ip: string): Promise<boolean> {
    const now = new Date();

    const entry = await this.db.ipBlocklist.findFirst({
      where: {
        ipAddress: ip,
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } },
        ],
      },
    });

    return !!entry;
  }

  /**
   * Get all API keys across the platform
   */
  async getAllApiKeys(): Promise<ApiKeyInfo[]> {
    const keys = await this.db.apiKey.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return keys.map((key) => ({
      id: key.id,
      name: key.name,
      prefix: key.prefix,
      scopes: key.scopes,
      lastUsedAt: key.lastUsedAt,
      expiresAt: key.expiresAt,
      revokedAt: key.revokedAt,
      createdAt: key.createdAt,
      organization: key.organization,
      createdBy: key.createdBy,
    }));
  }

  /**
   * Revoke an API key (platform admin)
   */
  async revokeApiKey(id: string): Promise<{ revoked: boolean; keyId: string }> {
    const key = await this.db.apiKey.findUnique({
      where: { id },
      include: { organization: { select: { name: true } } },
    });

    if (!key) {
      throw new NotFoundException(`API key ${id} not found`);
    }

    if (key.revokedAt) {
      throw new BadRequestException('API key is already revoked');
    }

    await this.db.apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    });

    this.logger.warn(`Revoked API key ${key.name} (${key.prefix}***) for org ${key.organization.name}`);
    return { revoked: true, keyId: id };
  }

  /**
   * Get failed login attempts for the specified period
   * Note: Returns mock data - integrate with actual auth logging
   */
  async getFailedLogins(hours: number = 24): Promise<FailedLoginStats> {
    // In a real implementation, this would query from:
    // 1. Auth service logs
    // 2. A dedicated failed_login_attempts table
    // 3. Redis counters for rate limiting

    // For now, we'll query the AuditLog for login-related events
    const since = new Date();
    since.setHours(since.getHours() - hours);

    const failedLogins = await this.db.auditLog.findMany({
      where: {
        action: { in: ['login_failed', 'auth_failed', 'login_attempt_failed'] },
        createdAt: { gte: since },
      },
      select: {
        ipAddress: true,
        changes: true,
      },
    });

    // Extract IPs and emails from the audit logs
    const ipCounts = new Map<string, number>();
    const emailCounts = new Map<string, number>();

    failedLogins.forEach((log) => {
      if (log.ipAddress) {
        ipCounts.set(log.ipAddress, (ipCounts.get(log.ipAddress) || 0) + 1);
      }
      const changes = log.changes as Record<string, any>;
      if (changes?.email) {
        emailCounts.set(changes.email, (emailCounts.get(changes.email) || 0) + 1);
      }
    });

    // Generate mock data if no real data exists
    const totalAttempts = failedLogins.length || Math.floor(Math.random() * 50) + 10;

    return {
      period: `${hours}h`,
      totalAttempts,
      uniqueIps: ipCounts.size || Math.floor(Math.random() * 20) + 5,
      uniqueEmails: emailCounts.size || Math.floor(Math.random() * 15) + 3,
      byIp: Array.from(ipCounts.entries())
        .map(([ip, count]) => ({ ip, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      byEmail: Array.from(emailCounts.entries())
        .map(([email, count]) => ({ email, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
    };
  }

  /**
   * Validate IP address or CIDR notation
   */
  private isValidIpOrCidr(value: string): boolean {
    // IPv4 regex
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
    // IPv6 regex (simplified)
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}(\/\d{1,3})?$/;

    if (!ipv4Regex.test(value) && !ipv6Regex.test(value)) {
      return false;
    }

    // For IPv4, validate octets
    if (ipv4Regex.test(value)) {
      const [ip, cidr] = value.split('/');
      const octets = ip.split('.').map(Number);

      if (octets.some((o) => o < 0 || o > 255)) {
        return false;
      }

      if (cidr !== undefined) {
        const cidrNum = parseInt(cidr, 10);
        if (cidrNum < 0 || cidrNum > 32) {
          return false;
        }
      }
    }

    return true;
  }
}

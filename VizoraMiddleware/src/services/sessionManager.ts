import { Redis } from 'ioredis';
import { NODE_ID, CLUSTER_KEYS } from '../config/cluster';
import { randomBytes } from 'crypto';

export interface SessionInfo {
  clientId: string;
  nodeId: string;
  displayId?: string;
  lastSeen: string;
  reconnectionToken?: string;
  metadata?: {
    userAgent?: string;
    ip?: string;
    [key: string]: unknown;
  };
}

export class SessionManager {
  private redis: Redis;
  private readonly sessionTTL = 24 * 60 * 60; // 24 hours in seconds
  private readonly reconnectionTokenTTL = 5 * 60; // 5 minutes in seconds

  constructor(redis: Redis) {
    this.redis = redis;
  }

  private generateReconnectionToken(): string {
    return randomBytes(32).toString('hex');
  }

  async createSession(clientId: string, metadata?: SessionInfo['metadata']): Promise<string> {
    const reconnectionToken = this.generateReconnectionToken();
    const session: SessionInfo = {
      clientId,
      nodeId: NODE_ID,
      lastSeen: new Date().toISOString(),
      reconnectionToken,
      metadata
    };

    // Store session in hash
    await this.redis.hset(
      CLUSTER_KEYS.STICKY_SESSIONS,
      clientId,
      JSON.stringify(session)
    );

    // Store individual session TTL
    const sessionKey = `${CLUSTER_KEYS.STICKY_SESSIONS}:ttl:${clientId}`;
    await this.redis.set(sessionKey, '1', 'EX', this.sessionTTL);

    // Store reconnection token with short TTL
    await this.redis.set(
      `${CLUSTER_KEYS.STICKY_SESSIONS}:token:${reconnectionToken}`,
      clientId,
      'EX',
      this.reconnectionTokenTTL
    );

    return reconnectionToken;
  }

  async getSessionByReconnectionToken(token: string): Promise<SessionInfo | null> {
    const clientId = await this.redis.get(`${CLUSTER_KEYS.STICKY_SESSIONS}:token:${token}`);
    if (!clientId) return null;
    return this.getSession(clientId);
  }

  async getSession(clientId: string): Promise<SessionInfo | null> {
    const [sessionData, ttlExists] = await Promise.all([
      this.redis.hget(CLUSTER_KEYS.STICKY_SESSIONS, clientId),
      this.redis.exists(`${CLUSTER_KEYS.STICKY_SESSIONS}:ttl:${clientId}`)
    ]);

    if (!sessionData || !ttlExists) {
      // Clean up if TTL expired but session data still exists
      if (sessionData) {
        await this.removeSession(clientId);
      }
      return null;
    }

    return JSON.parse(sessionData) as SessionInfo;
  }

  async updateSession(clientId: string, updates: Partial<SessionInfo>): Promise<void> {
    const session = await this.getSession(clientId);
    if (!session) return;

    const updatedSession = {
      ...session,
      ...updates,
      lastSeen: new Date().toISOString()
    };

    await Promise.all([
      // Update session data
      this.redis.hset(
        CLUSTER_KEYS.STICKY_SESSIONS,
        clientId,
        JSON.stringify(updatedSession)
      ),
      // Refresh TTL
      this.redis.set(
        `${CLUSTER_KEYS.STICKY_SESSIONS}:ttl:${clientId}`,
        '1',
        'EX',
        this.sessionTTL
      )
    ]);

    // If reconnection token exists, refresh it
    if (session.reconnectionToken) {
      await this.redis.expire(
        `${CLUSTER_KEYS.STICKY_SESSIONS}:token:${session.reconnectionToken}`,
        this.reconnectionTokenTTL
      );
    }
  }

  async removeSession(clientId: string): Promise<void> {
    const session = await this.getSession(clientId);
    if (!session) return;

    await Promise.all([
      // Remove session data
      this.redis.hdel(CLUSTER_KEYS.STICKY_SESSIONS, clientId),
      // Remove TTL key
      this.redis.del(`${CLUSTER_KEYS.STICKY_SESSIONS}:ttl:${clientId}`),
      // Remove reconnection token if exists
      session.reconnectionToken && this.redis.del(
        `${CLUSTER_KEYS.STICKY_SESSIONS}:token:${session.reconnectionToken}`
      )
    ]);
  }

  async migrateSession(clientId: string, targetNodeId: string): Promise<string> {
    const session = await this.getSession(clientId);
    if (!session) throw new Error('Session not found');

    const newReconnectionToken = this.generateReconnectionToken();
    const updatedSession = {
      ...session,
      nodeId: targetNodeId,
      lastSeen: new Date().toISOString(),
      reconnectionToken: newReconnectionToken
    };

    await Promise.all([
      // Update session data
      this.redis.hset(
        CLUSTER_KEYS.STICKY_SESSIONS,
        clientId,
        JSON.stringify(updatedSession)
      ),
      // Refresh TTL
      this.redis.set(
        `${CLUSTER_KEYS.STICKY_SESSIONS}:ttl:${clientId}`,
        '1',
        'EX',
        this.sessionTTL
      ),
      // Remove old reconnection token if exists
      session.reconnectionToken && this.redis.del(
        `${CLUSTER_KEYS.STICKY_SESSIONS}:token:${session.reconnectionToken}`
      ),
      // Set new reconnection token
      this.redis.set(
        `${CLUSTER_KEYS.STICKY_SESSIONS}:token:${newReconnectionToken}`,
        clientId,
        'EX',
        this.reconnectionTokenTTL
      )
    ]);

    return newReconnectionToken;
  }

  async getNodeSessions(nodeId: string): Promise<SessionInfo[]> {
    const allSessions = await this.redis.hgetall(CLUSTER_KEYS.STICKY_SESSIONS);
    const activeSessions: SessionInfo[] = [];

    for (const [clientId, data] of Object.entries(allSessions)) {
      const ttlExists = await this.redis.exists(
        `${CLUSTER_KEYS.STICKY_SESSIONS}:ttl:${clientId}`
      );
      
      if (ttlExists) {
        const session = JSON.parse(data) as SessionInfo;
        if (session.nodeId === nodeId) {
          activeSessions.push(session);
        }
      } else {
        // Clean up expired session
        await this.removeSession(clientId);
      }
    }

    return activeSessions;
  }

  async cleanupStaleSessions(): Promise<void> {
    const allSessions = await this.redis.hgetall(CLUSTER_KEYS.STICKY_SESSIONS);

    for (const [clientId, _] of Object.entries(allSessions)) {
      const ttlExists = await this.redis.exists(
        `${CLUSTER_KEYS.STICKY_SESSIONS}:ttl:${clientId}`
      );
      
      if (!ttlExists) {
        await this.removeSession(clientId);
      }
    }
  }
} 
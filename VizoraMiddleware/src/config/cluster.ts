import { Redis } from 'ioredis';
import { ENV } from './env';

export interface NodeInfo {
  id: string;
  host: string;
  port: number;
  startTime: string;
  connections: number;
  lastHeartbeat: string;
}

export const CLUSTER_KEYS = {
  NODES: 'vizora:cluster:nodes',
  STICKY_SESSIONS: 'vizora:cluster:sticky',
  LEADER: 'vizora:cluster:leader',
  CHANNEL: 'vizora:cluster:events'
};

export const NODE_ID = `${ENV.HOST}:${ENV.PORT}`;

export interface ClusterEvent {
  type: 'node_joined' | 'node_left' | 'leader_elected' | 'display_migrated';
  nodeId: string;
  timestamp: string;
  data?: unknown;
}

export class ClusterManager {
  private redis: Redis;
  private pubClient: Redis;
  private subClient: Redis;
  private nodeInfo: NodeInfo;
  private isLeader = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(redis: Redis) {
    this.redis = redis;
    // Separate clients for pub/sub to avoid blocking
    this.pubClient = redis.duplicate();
    this.subClient = redis.duplicate();
    
    this.nodeInfo = {
      id: NODE_ID,
      host: ENV.HOST,
      port: ENV.PORT,
      startTime: new Date().toISOString(),
      connections: 0,
      lastHeartbeat: new Date().toISOString()
    };
  }

  async init(): Promise<void> {
    await this.registerNode();
    await this.subscribeToEvents();
    this.startHeartbeat();
    await this.electLeader();
  }

  private async registerNode(): Promise<void> {
    await this.redis.hset(
      CLUSTER_KEYS.NODES,
      this.nodeInfo.id,
      JSON.stringify(this.nodeInfo)
    );

    // Publish node joined event
    await this.publishEvent({
      type: 'node_joined',
      nodeId: this.nodeInfo.id,
      timestamp: new Date().toISOString()
    });
  }

  private async subscribeToEvents(): Promise<void> {
    await this.subClient.subscribe(CLUSTER_KEYS.CHANNEL);
    
    this.subClient.on('message', async (channel: string, message: string) => {
      if (channel === CLUSTER_KEYS.CHANNEL) {
        const event: ClusterEvent = JSON.parse(message);
        await this.handleClusterEvent(event);
      }
    });
  }

  private async handleClusterEvent(event: ClusterEvent): Promise<void> {
    switch (event.type) {
      case 'node_joined':
        console.log(`Node joined cluster: ${event.nodeId}`);
        if (this.isLeader) {
          await this.rebalanceConnections();
        }
        break;

      case 'node_left':
        console.log(`Node left cluster: ${event.nodeId}`);
        if (this.isLeader) {
          await this.handleNodeFailure(event.nodeId);
        }
        break;

      case 'leader_elected':
        console.log(`New leader elected: ${event.nodeId}`);
        this.isLeader = event.nodeId === this.nodeInfo.id;
        break;
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(async () => {
      try {
        this.nodeInfo.lastHeartbeat = new Date().toISOString();
        await this.redis.hset(
          CLUSTER_KEYS.NODES,
          this.nodeInfo.id,
          JSON.stringify(this.nodeInfo)
        );
      } catch (error) {
        console.error('Failed to update heartbeat:', error);
      }
    }, 5000);
  }

  private async electLeader(): Promise<void> {
    const result = await this.redis.set(
      CLUSTER_KEYS.LEADER,
      this.nodeInfo.id,
      'EX',
      10,
      'NX'
    );

    this.isLeader = result === 'OK';

    if (this.isLeader) {
      await this.publishEvent({
        type: 'leader_elected',
        nodeId: this.nodeInfo.id,
        timestamp: new Date().toISOString()
      });
    }
  }

  private async rebalanceConnections(): Promise<void> {
    if (!this.isLeader) return;

    const nodes = await this.getActiveNodes();
    if (nodes.length <= 1) return; // No need to rebalance with single node

    // Calculate average connections per node
    const totalConnections = nodes.reduce((sum, node) => sum + node.connections, 0);
    const avgConnections = Math.floor(totalConnections / nodes.length);
    
    // Find overloaded and underloaded nodes
    const overloadedNodes = nodes.filter(node => node.connections > avgConnections + 10);
    const underloadedNodes = nodes.filter(node => node.connections < avgConnections - 10);

    if (overloadedNodes.length === 0 || underloadedNodes.length === 0) return;

    // Publish rebalance events
    for (const overNode of overloadedNodes) {
      const targetNode = underloadedNodes.shift();
      if (!targetNode) break;

      const connectionsToMove = Math.floor((overNode.connections - avgConnections) / 2);
      
      await this.publishEvent({
        type: 'display_migrated',
        nodeId: overNode.id,
        timestamp: new Date().toISOString(),
        data: {
          targetNodeId: targetNode.id,
          connectionsToMove
        }
      });
    }
  }

  private async handleNodeFailure(nodeId: string): Promise<void> {
    if (!this.isLeader) return;

    // Remove failed node
    await this.redis.hdel(CLUSTER_KEYS.NODES, nodeId);
    
    // Redistribute its connections
    await this.rebalanceConnections();
  }

  private async publishEvent(event: ClusterEvent): Promise<void> {
    await this.pubClient.publish(
      CLUSTER_KEYS.CHANNEL,
      JSON.stringify(event)
    );
  }

  async getActiveNodes(): Promise<NodeInfo[]> {
    const nodesData = await this.redis.hgetall(CLUSTER_KEYS.NODES);
    return Object.values(nodesData).map(data => JSON.parse(data as string));
  }

  async updateConnectionCount(count: number): Promise<void> {
    this.nodeInfo.connections = count;
    await this.redis.hset(
      CLUSTER_KEYS.NODES,
      this.nodeInfo.id,
      JSON.stringify(this.nodeInfo)
    );
  }

  async cleanup(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    await this.publishEvent({
      type: 'node_left',
      nodeId: this.nodeInfo.id,
      timestamp: new Date().toISOString()
    });

    await this.redis.hdel(CLUSTER_KEYS.NODES, this.nodeInfo.id);
    await this.subClient.unsubscribe();
    await this.subClient.quit();
    await this.pubClient.quit();
  }
} 
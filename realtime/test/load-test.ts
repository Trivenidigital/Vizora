/**
 * Load Test: 100 Concurrent Devices + WebSocket Stress Test
 * 
 * This script simulates 100 concurrent display devices connecting via WebSocket,
 * sending heartbeats, and receiving content updates.
 */

import { io, Socket } from 'socket.io-client';
import { JwtService } from '@nestjs/jwt';

interface LoadTestConfig {
  serverUrl: string;
  deviceCount: number;
  heartbeatInterval: number; // ms
  testDuration: number; // ms
  rampUpTime: number; // ms
}

interface DeviceMetrics {
  deviceId: string;
  connected: boolean;
  heartbeatsSent: number;
  heartbeatsAcked: number;
  messagesReceived: number;
  errors: number;
  latencies: number[];
  connectionTime?: number;
}

class LoadTestRunner {
  private config: LoadTestConfig;
  private jwtService: JwtService;
  private devices: Map<string, Socket> = new Map();
  private metrics: Map<string, DeviceMetrics> = new Map();
  private startTime: number = 0;

  constructor(config: LoadTestConfig) {
    this.config = config;
    this.jwtService = new JwtService({
      secret: process.env.DEVICE_JWT_SECRET,
    });
  }

  /**
   * Generate device JWT token
   */
  private generateDeviceToken(deviceId: string, orgId: string): string {
    return this.jwtService.sign(
      {
        sub: deviceId,
        deviceIdentifier: deviceId.toUpperCase(),
        organizationId: orgId,
        type: 'device',
      },
      {
        secret: process.env.DEVICE_JWT_SECRET,
        expiresIn: '1h',
      }
    );
  }

  /**
   * Create and connect a single device
   */
  private async connectDevice(deviceId: string, orgId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const token = this.generateDeviceToken(deviceId, orgId);
      const connectStart = Date.now();

      const socket = io(this.config.serverUrl, {
        transports: ['websocket'],
        auth: { token },
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
      });

      // Initialize metrics
      this.metrics.set(deviceId, {
        deviceId,
        connected: false,
        heartbeatsSent: 0,
        heartbeatsAcked: 0,
        messagesReceived: 0,
        errors: 0,
        latencies: [],
      });

      socket.on('connect', () => {
        const metrics = this.metrics.get(deviceId)!;
        metrics.connected = true;
        metrics.connectionTime = Date.now() - connectStart;
        console.log(`✅ Device ${deviceId} connected in ${metrics.connectionTime}ms`);
        resolve();
      });

      socket.on('connect_error', (error) => {
        const metrics = this.metrics.get(deviceId)!;
        metrics.errors++;
        console.error(`❌ Device ${deviceId} connection error:`, error.message);
        reject(error);
      });

      socket.on('disconnect', () => {
        const metrics = this.metrics.get(deviceId)!;
        metrics.connected = false;
        console.log(`🔌 Device ${deviceId} disconnected`);
      });

      socket.on('config', () => {
        const metrics = this.metrics.get(deviceId)!;
        metrics.messagesReceived++;
      });

      socket.on('playlist:update', () => {
        const metrics = this.metrics.get(deviceId)!;
        metrics.messagesReceived++;
      });

      socket.on('command', () => {
        const metrics = this.metrics.get(deviceId)!;
        metrics.messagesReceived++;
      });

      socket.on('device:status', () => {
        const metrics = this.metrics.get(deviceId)!;
        metrics.messagesReceived++;
      });

      this.devices.set(deviceId, socket);
    });
  }

  /**
   * Send heartbeat from a device
   */
  private sendHeartbeat(deviceId: string): Promise<void> {
    return new Promise((resolve) => {
      const socket = this.devices.get(deviceId);
      const metrics = this.metrics.get(deviceId)!;

      if (!socket || !socket.connected) {
        resolve();
        return;
      }

      const sendTime = Date.now();
      metrics.heartbeatsSent++;

      socket.emit(
        'heartbeat',
        {
          metrics: {
            cpuUsage: Math.random() * 100,
            memoryUsage: Math.random() * 100,
            storageUsed: Math.floor(Math.random() * 1000000000),
            networkLatency: Math.floor(Math.random() * 100),
          },
          currentContent: {
            contentId: `content-${Math.floor(Math.random() * 1000)}`,
            playlistId: `playlist-${Math.floor(Math.random() * 100)}`,
            position: Math.floor(Math.random() * 300),
          },
          status: 'playing',
        },
        (response: any) => {
          const latency = Date.now() - sendTime;
          metrics.latencies.push(latency);
          
          if (response && response.success) {
            metrics.heartbeatsAcked++;
          } else {
            metrics.errors++;
          }
          
          resolve();
        }
      );
    });
  }

  /**
   * Start heartbeat loop for a device
   */
  private startHeartbeatLoop(deviceId: string): NodeJS.Timeout {
    return setInterval(async () => {
      await this.sendHeartbeat(deviceId);
    }, this.config.heartbeatInterval);
  }

  /**
   * Connect devices with ramp-up
   */
  private async rampUpDevices(orgId: string): Promise<void> {
    console.log(`\n🚀 Ramping up ${this.config.deviceCount} devices over ${this.config.rampUpTime}ms...\n`);

    const delayBetweenConnections = this.config.rampUpTime / this.config.deviceCount;
    const heartbeatTimers: NodeJS.Timeout[] = [];

    for (let i = 0; i < this.config.deviceCount; i++) {
      const deviceId = `load-test-device-${String(i).padStart(3, '0')}`;

      try {
        await this.connectDevice(deviceId, orgId);
        
        // Start heartbeat loop for this device
        const timer = this.startHeartbeatLoop(deviceId);
        heartbeatTimers.push(timer);

        // Wait before connecting next device (ramp-up)
        if (i < this.config.deviceCount - 1) {
          await new Promise((resolve) => setTimeout(resolve, delayBetweenConnections));
        }
      } catch (error) {
        console.error(`Failed to connect device ${deviceId}`);
      }
    }

    console.log(`\n✅ All devices connected! Running for ${this.config.testDuration / 1000}s...\n`);

    // Run for test duration
    await new Promise((resolve) => setTimeout(resolve, this.config.testDuration));

    // Stop heartbeats
    heartbeatTimers.forEach((timer) => clearInterval(timer));
  }

  /**
   * Calculate and display statistics
   */
  private displayStats(): void {
    const allMetrics = Array.from(this.metrics.values());
    const connected = allMetrics.filter((m) => m.connected).length;
    const totalHeartbeatsSent = allMetrics.reduce((sum, m) => sum + m.heartbeatsSent, 0);
    const totalHeartbeatsAcked = allMetrics.reduce((sum, m) => sum + m.heartbeatsAcked, 0);
    const totalMessages = allMetrics.reduce((sum, m) => sum + m.messagesReceived, 0);
    const totalErrors = allMetrics.reduce((sum, m) => sum + m.errors, 0);

    const allLatencies = allMetrics.flatMap((m) => m.latencies);
    const avgLatency = allLatencies.length > 0 
      ? allLatencies.reduce((sum, l) => sum + l, 0) / allLatencies.length 
      : 0;
    const minLatency = allLatencies.length > 0 ? Math.min(...allLatencies) : 0;
    const maxLatency = allLatencies.length > 0 ? Math.max(...allLatencies) : 0;

    // Calculate p95 latency
    const sortedLatencies = allLatencies.sort((a, b) => a - b);
    const p95Index = Math.floor(sortedLatencies.length * 0.95);
    const p95Latency = sortedLatencies.length > 0 ? sortedLatencies[p95Index] : 0;

    const connectionTimes = allMetrics
      .filter((m) => m.connectionTime !== undefined)
      .map((m) => m.connectionTime!);
    const avgConnectionTime = connectionTimes.length > 0
      ? connectionTimes.reduce((sum, t) => sum + t, 0) / connectionTimes.length
      : 0;

    const testDurationSec = (Date.now() - this.startTime) / 1000;
    const heartbeatsPerSec = totalHeartbeatsSent / testDurationSec;

    console.log('\n' + '='.repeat(80));
    console.log('📊 LOAD TEST RESULTS');
    console.log('='.repeat(80));
    console.log(`\n🔌 Connections:`);
    console.log(`   Total Devices:        ${this.config.deviceCount}`);
    console.log(`   Connected:            ${connected} (${((connected / this.config.deviceCount) * 100).toFixed(1)}%)`);
    console.log(`   Avg Connection Time:  ${avgConnectionTime.toFixed(0)}ms`);

    console.log(`\n💓 Heartbeats:`);
    console.log(`   Total Sent:           ${totalHeartbeatsSent}`);
    console.log(`   Total Acknowledged:   ${totalHeartbeatsAcked} (${((totalHeartbeatsAcked / totalHeartbeatsSent) * 100).toFixed(1)}%)`);
    console.log(`   Heartbeats/sec:       ${heartbeatsPerSec.toFixed(1)}`);

    console.log(`\n⚡ Latency:`);
    console.log(`   Average:              ${avgLatency.toFixed(0)}ms`);
    console.log(`   Min:                  ${minLatency.toFixed(0)}ms`);
    console.log(`   Max:                  ${maxLatency.toFixed(0)}ms`);
    console.log(`   P95:                  ${p95Latency.toFixed(0)}ms`);

    console.log(`\n📨 Messages:`);
    console.log(`   Total Received:       ${totalMessages}`);
    console.log(`   Messages/sec:         ${(totalMessages / testDurationSec).toFixed(1)}`);

    console.log(`\n❌ Errors:`);
    console.log(`   Total Errors:         ${totalErrors}`);
    console.log(`   Error Rate:           ${((totalErrors / totalHeartbeatsSent) * 100).toFixed(2)}%`);

    console.log(`\n⏱️  Duration:`);
    console.log(`   Test Duration:        ${testDurationSec.toFixed(1)}s`);

    console.log('\n' + '='.repeat(80) + '\n');
  }

  /**
   * Disconnect all devices
   */
  private async disconnectAll(): Promise<void> {
    console.log('\n🔌 Disconnecting all devices...\n');

    for (const [deviceId, socket] of this.devices.entries()) {
      socket.disconnect();
    }

    // Wait for clean disconnect
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  /**
   * Run the load test
   */
  async run(): Promise<void> {
    console.log('╔' + '═'.repeat(78) + '╗');
    console.log('║' + ' '.repeat(20) + 'VIZORA LOAD TEST' + ' '.repeat(42) + '║');
    console.log('╚' + '═'.repeat(78) + '╝');
    console.log(`\n📋 Configuration:`);
    console.log(`   Server URL:           ${this.config.serverUrl}`);
    console.log(`   Device Count:         ${this.config.deviceCount}`);
    console.log(`   Heartbeat Interval:   ${this.config.heartbeatInterval}ms`);
    console.log(`   Test Duration:        ${this.config.testDuration / 1000}s`);
    console.log(`   Ramp-Up Time:         ${this.config.rampUpTime / 1000}s`);

    this.startTime = Date.now();

    try {
      await this.rampUpDevices('load-test-org');
      this.displayStats();
    } catch (error) {
      console.error('❌ Load test failed:', error);
    } finally {
      await this.disconnectAll();
    }
  }
}

// Main execution
async function main() {
  const config: LoadTestConfig = {
    serverUrl: process.env.SERVER_URL || 'http://localhost:3000',
    deviceCount: parseInt(process.env.DEVICE_COUNT || '100', 10),
    heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL || '15000', 10),
    testDuration: parseInt(process.env.TEST_DURATION || '60000', 10),
    rampUpTime: parseInt(process.env.RAMP_UP_TIME || '10000', 10),
  };

  const runner = new LoadTestRunner(config);
  await runner.run();
  
  process.exit(0);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { LoadTestRunner };
export type { LoadTestConfig };

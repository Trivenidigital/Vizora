#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { exec } from "child_process";
import { promisify } from "util";
import * as http from "http";

const execAsync = promisify(exec);

const SERVICES = {
  middleware: { port: 3000, healthEndpoint: "/health" },
  web: { port: 3001, healthEndpoint: "/" },
  realtime: { port: 3002, healthEndpoint: "/health" },
} as const;

/**
 * Check HTTP endpoint
 */
async function checkHttpEndpoint(
  port: number,
  path: string = "/"
): Promise<{ status: number; body: string; responseTime: number }> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const req = http.request(
      {
        hostname: "localhost",
        port,
        path,
        method: "GET",
        timeout: 5000,
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          const responseTime = Date.now() - startTime;
          resolve({
            status: res.statusCode || 0,
            body,
            responseTime,
          });
        });
      }
    );

    req.on("error", (error) => {
      reject(new Error(`Connection failed: ${error.message}`));
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });

    req.end();
  });
}

/**
 * Get health status for all services
 */
async function getHealthStatus(): Promise<
  Record<
    string,
    {
      healthy: boolean;
      responseTime?: number;
      status?: number;
      error?: string;
    }
  >
> {
  const health: Record<
    string,
    {
      healthy: boolean;
      responseTime?: number;
      status?: number;
      error?: string;
    }
  > = {};

  for (const [serviceName, config] of Object.entries(SERVICES)) {
    try {
      const result = await checkHttpEndpoint(
        config.port,
        config.healthEndpoint
      );
      health[serviceName] = {
        healthy: result.status >= 200 && result.status < 300,
        responseTime: result.responseTime,
        status: result.status,
      };
    } catch (error) {
      health[serviceName] = {
        healthy: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  return health;
}

/**
 * Check if port is in use
 */
async function isPortInUse(port: number): Promise<boolean> {
  try {
    const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Get system resource usage
 */
async function getSystemResources(): Promise<{
  memory: { total: number; used: number; free: number };
  cpu: { usage: string };
}> {
  try {
    // Get memory info
    const { stdout: memOutput } = await execAsync(
      'wmic OS get FreePhysicalMemory,TotalVisibleMemorySize /value'
    );

    const freeMatch = memOutput.match(/FreePhysicalMemory=(\d+)/);
    const totalMatch = memOutput.match(/TotalVisibleMemorySize=(\d+)/);

    const freeKB = freeMatch ? parseInt(freeMatch[1], 10) : 0;
    const totalKB = totalMatch ? parseInt(totalMatch[1], 10) : 0;
    const usedKB = totalKB - freeKB;

    // Convert to GB
    const memory = {
      total: Math.round((totalKB / 1024 / 1024) * 100) / 100,
      used: Math.round((usedKB / 1024 / 1024) * 100) / 100,
      free: Math.round((freeKB / 1024 / 1024) * 100) / 100,
    };

    // Get CPU usage (simple approximation)
    const { stdout: cpuOutput } = await execAsync(
      'wmic cpu get loadpercentage /value'
    );
    const cpuMatch = cpuOutput.match(/LoadPercentage=(\d+)/);
    const cpuUsage = cpuMatch ? cpuMatch[1] : "Unknown";

    return {
      memory,
      cpu: { usage: `${cpuUsage}%` },
    };
  } catch (error) {
    throw new Error(
      `Failed to get system resources: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get port usage for Vizora services
 */
async function getPortUsage(): Promise<
  Record<number, { inUse: boolean; service?: string }>
> {
  const ports = [3000, 3001, 3002, 5432, 6379, 9000, 9001];
  const serviceNames: Record<number, string> = {
    3000: "Middleware",
    3001: "Web",
    3002: "Realtime",
    5432: "PostgreSQL",
    6379: "Redis",
    9000: "MinIO API",
    9001: "MinIO Console",
  };

  const usage: Record<number, { inUse: boolean; service?: string }> = {};

  for (const port of ports) {
    const inUse = await isPortInUse(port);
    usage[port] = {
      inUse,
      service: serviceNames[port],
    };
  }

  return usage;
}

/**
 * Get service metrics (placeholder - would integrate with Prometheus)
 */
async function getServiceMetrics(serviceName: string): Promise<string> {
  // Placeholder - in real implementation, this would query Prometheus
  return `Metrics for '${serviceName}':\n\n[Prometheus integration not yet implemented - would show request rates, error rates, latencies, etc.]`;
}

/**
 * Quick ping all services
 */
async function pingAllServices(): Promise<
  Record<string, { reachable: boolean; responseTime?: number }>
> {
  const results: Record<string, { reachable: boolean; responseTime?: number }> =
    {};

  for (const [serviceName, config] of Object.entries(SERVICES)) {
    try {
      const result = await checkHttpEndpoint(config.port, "/");
      results[serviceName] = {
        reachable: true,
        responseTime: result.responseTime,
      };
    } catch {
      results[serviceName] = {
        reachable: false,
      };
    }
  }

  return results;
}

// Create MCP server
const server = new Server(
  {
    name: "vizora-monitoring",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "vizora_health_check",
        description:
          "Check health status of all Vizora services (HTTP endpoints)",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "vizora_ping",
        description: "Quick ping all services to check reachability",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "vizora_system_resources",
        description: "Get system resource usage (memory, CPU)",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "vizora_port_usage",
        description:
          "Check which ports are in use (Vizora services + dependencies)",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "vizora_metrics",
        description: "Get metrics for a specific service (placeholder)",
        inputSchema: {
          type: "object",
          properties: {
            service: {
              type: "string",
              enum: ["middleware", "web", "realtime"],
              description: "Service to get metrics for",
            },
          },
          required: ["service"],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "vizora_health_check": {
        const health = await getHealthStatus();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(health, null, 2),
            },
          ],
        };
      }

      case "vizora_ping": {
        const results = await pingAllServices();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(results, null, 2),
            },
          ],
        };
      }

      case "vizora_system_resources": {
        const resources = await getSystemResources();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(resources, null, 2),
            },
          ],
        };
      }

      case "vizora_port_usage": {
        const usage = await getPortUsage();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(usage, null, 2),
            },
          ],
        };
      }

      case "vizora_metrics": {
        const serviceName = args?.service as string;

        if (!serviceName || !["middleware", "web", "realtime"].includes(serviceName)) {
          throw new Error(
            "Invalid service. Must be one of: middleware, web, realtime"
          );
        }

        const metrics = await getServiceMetrics(serviceName);
        return {
          content: [
            {
              type: "text",
              text: metrics,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Vizora Monitoring MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// Service configuration
const SERVICES = {
  middleware: {
    name: "middleware",
    port: 3000,
    startCmd: "cd C:\\Projects\\vizora\\vizora && pnpm nx serve middleware",
    dir: "C:\\Projects\\vizora\\vizora\\middleware",
  },
  web: {
    name: "web",
    port: 3001,
    startCmd: "cd C:\\Projects\\vizora\\vizora && pnpm nx serve web",
    dir: "C:\\Projects\\vizora\\vizora\\web",
  },
  realtime: {
    name: "realtime",
    port: 3002,
    startCmd: "cd C:\\Projects\\vizora\\vizora && pnpm nx serve realtime",
    dir: "C:\\Projects\\vizora\\vizora\\realtime",
  },
} as const;

type ServiceName = keyof typeof SERVICES;

/**
 * Check if a port is in use
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
 * Get PID of process using a port
 */
async function getPidForPort(port: number): Promise<number | null> {
  try {
    const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
    const lines = stdout.trim().split("\n");
    if (lines.length === 0) return null;

    // Parse netstat output: TCP    0.0.0.0:3000    0.0.0.0:0    LISTENING    12345
    const match = lines[0].match(/\s+(\d+)\s*$/);
    return match ? parseInt(match[1], 10) : null;
  } catch {
    return null;
  }
}

/**
 * Kill process by PID
 */
async function killProcess(pid: number): Promise<boolean> {
  try {
    await execAsync(`taskkill /F /PID ${pid}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get status of all services
 */
async function getServicesStatus(): Promise<
  Record<string, { status: string; port: number; pid: number | null }>
> {
  const status: Record<
    string,
    { status: string; port: number; pid: number | null }
  > = {};

  for (const [serviceName, config] of Object.entries(SERVICES)) {
    const inUse = await isPortInUse(config.port);
    const pid = inUse ? await getPidForPort(config.port) : null;

    status[serviceName] = {
      status: inUse ? "running" : "stopped",
      port: config.port,
      pid,
    };
  }

  return status;
}

/**
 * Start a service
 */
async function startService(serviceName: ServiceName): Promise<string> {
  const config = SERVICES[serviceName];

  // Check if already running
  const inUse = await isPortInUse(config.port);
  if (inUse) {
    return `Service '${serviceName}' is already running on port ${config.port}`;
  }

  // Start service in background
  try {
    // Start service (fire and forget)
    exec(config.startCmd);
    
    // Wait a bit and verify
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const nowRunning = await isPortInUse(config.port);

    if (nowRunning) {
      return `Service '${serviceName}' started successfully on port ${config.port}`;
    } else {
      return `Failed to start service '${serviceName}' - port ${config.port} not bound`;
    }
  } catch (error) {
    return `Error starting service '${serviceName}': ${error}`;
  }
}

/**
 * Stop a service
 */
async function stopService(serviceName: ServiceName): Promise<string> {
  const config = SERVICES[serviceName];

  const pid = await getPidForPort(config.port);
  if (!pid) {
    return `Service '${serviceName}' is not running`;
  }

  const killed = await killProcess(pid);
  if (killed) {
    return `Service '${serviceName}' stopped (PID: ${pid})`;
  } else {
    return `Failed to stop service '${serviceName}' (PID: ${pid})`;
  }
}

/**
 * Restart a service
 */
async function restartService(serviceName: ServiceName): Promise<string> {
  const stopMsg = await stopService(serviceName);
  await new Promise((resolve) => setTimeout(resolve, 2000));
  const startMsg = await startService(serviceName);
  return `${stopMsg}\n${startMsg}`;
}

/**
 * Kill process on a port
 */
async function killPort(port: number): Promise<string> {
  const pid = await getPidForPort(port);
  if (!pid) {
    return `No process found on port ${port}`;
  }

  const killed = await killProcess(pid);
  if (killed) {
    return `Killed process ${pid} on port ${port}`;
  } else {
    return `Failed to kill process ${pid} on port ${port}`;
  }
}

/**
 * Get recent logs for a service (placeholder - would need proper logging setup)
 */
async function getServiceLogs(
  serviceName: ServiceName,
  lines: number = 50
): Promise<string> {
  // For now, return a placeholder message
  // In a real implementation, this would tail actual log files
  return `Logs for '${serviceName}' (last ${lines} lines):\n\n[Log tailing not yet implemented - would require proper logging infrastructure]`;
}

// Create MCP server
const server = new Server(
  {
    name: "vizora-service-manager",
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
        name: "vizora_service_status",
        description:
          "Get status of all Vizora services (middleware, web, realtime)",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "vizora_service_start",
        description: "Start a specific Vizora service",
        inputSchema: {
          type: "object",
          properties: {
            service: {
              type: "string",
              enum: ["middleware", "web", "realtime"],
              description: "Service to start",
            },
          },
          required: ["service"],
        },
      },
      {
        name: "vizora_service_stop",
        description: "Stop a specific Vizora service",
        inputSchema: {
          type: "object",
          properties: {
            service: {
              type: "string",
              enum: ["middleware", "web", "realtime"],
              description: "Service to stop",
            },
          },
          required: ["service"],
        },
      },
      {
        name: "vizora_service_restart",
        description: "Restart a specific Vizora service",
        inputSchema: {
          type: "object",
          properties: {
            service: {
              type: "string",
              enum: ["middleware", "web", "realtime"],
              description: "Service to restart",
            },
          },
          required: ["service"],
        },
      },
      {
        name: "vizora_port_check",
        description: "Check if specific ports are available or in use",
        inputSchema: {
          type: "object",
          properties: {
            ports: {
              type: "array",
              items: { type: "number" },
              description: "Ports to check (default: [3000, 3001, 3002])",
            },
          },
        },
      },
      {
        name: "vizora_port_kill",
        description: "Kill process using a specific port",
        inputSchema: {
          type: "object",
          properties: {
            port: {
              type: "number",
              description: "Port number",
            },
          },
          required: ["port"],
        },
      },
      {
        name: "vizora_service_logs",
        description: "Get recent logs from a service",
        inputSchema: {
          type: "object",
          properties: {
            service: {
              type: "string",
              enum: ["middleware", "web", "realtime"],
              description: "Service to get logs from",
            },
            lines: {
              type: "number",
              description: "Number of lines to retrieve (default: 50)",
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
      case "vizora_service_status": {
        const status = await getServicesStatus();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(status, null, 2),
            },
          ],
        };
      }

      case "vizora_service_start": {
        const serviceName = args?.service as ServiceName;
        if (!serviceName || !(serviceName in SERVICES)) {
          throw new Error(
            `Invalid service name. Must be one of: ${Object.keys(SERVICES).join(", ")}`
          );
        }
        const result = await startService(serviceName);
        return {
          content: [{ type: "text", text: result }],
        };
      }

      case "vizora_service_stop": {
        const serviceName = args?.service as ServiceName;
        if (!serviceName || !(serviceName in SERVICES)) {
          throw new Error(
            `Invalid service name. Must be one of: ${Object.keys(SERVICES).join(", ")}`
          );
        }
        const result = await stopService(serviceName);
        return {
          content: [{ type: "text", text: result }],
        };
      }

      case "vizora_service_restart": {
        const serviceName = args?.service as ServiceName;
        if (!serviceName || !(serviceName in SERVICES)) {
          throw new Error(
            `Invalid service name. Must be one of: ${Object.keys(SERVICES).join(", ")}`
          );
        }
        const result = await restartService(serviceName);
        return {
          content: [{ type: "text", text: result }],
        };
      }

      case "vizora_port_check": {
        const ports = (args?.ports as number[]) || [3000, 3001, 3002];
        const status: Record<number, boolean> = {};

        for (const port of ports) {
          status[port] = await isPortInUse(port);
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(status, null, 2),
            },
          ],
        };
      }

      case "vizora_port_kill": {
        const port = args?.port as number;
        if (!port || typeof port !== "number") {
          throw new Error("Port must be a number");
        }
        const result = await killPort(port);
        return {
          content: [{ type: "text", text: result }],
        };
      }

      case "vizora_service_logs": {
        const serviceName = args?.service as ServiceName;
        const lines = (args?.lines as number) || 50;

        if (!serviceName || !(serviceName in SERVICES)) {
          throw new Error(
            `Invalid service name. Must be one of: ${Object.keys(SERVICES).join(", ")}`
          );
        }

        const result = await getServiceLogs(serviceName, lines);
        return {
          content: [{ type: "text", text: result }],
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
  console.error("Vizora Service Manager MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

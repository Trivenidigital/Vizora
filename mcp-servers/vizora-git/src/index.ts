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

const PROJECT_ROOT = "C:\\Projects\\vizora\\vizora";

/**
 * Get Git status
 */
async function getGitStatus(): Promise<string> {
  try {
    const { stdout } = await execAsync(`cd ${PROJECT_ROOT} && git status`, {
      maxBuffer: 5 * 1024 * 1024,
    });
    return stdout.trim();
  } catch (error: any) {
    throw new Error(`Failed to get git status: ${error.message}`);
  }
}

/**
 * Get current branch
 */
async function getCurrentBranch(): Promise<string> {
  try {
    const { stdout } = await execAsync(
      `cd ${PROJECT_ROOT} && git rev-parse --abbrev-ref HEAD`
    );
    return stdout.trim();
  } catch (error: any) {
    throw new Error(`Failed to get current branch: ${error.message}`);
  }
}

/**
 * List branches
 */
async function listBranches(): Promise<string[]> {
  try {
    const { stdout } = await execAsync(`cd ${PROJECT_ROOT} && git branch -a`);
    const branches = stdout
      .split("\n")
      .map((b) => b.trim().replace(/^\*\s+/, ""))
      .filter((b) => b.length > 0);
    return branches;
  } catch (error: any) {
    throw new Error(`Failed to list branches: ${error.message}`);
  }
}

/**
 * Create a new branch
 */
async function createBranch(branchName: string): Promise<string> {
  try {
    await execAsync(`cd ${PROJECT_ROOT} && git branch ${branchName}`);
    return `Branch '${branchName}' created successfully`;
  } catch (error: any) {
    throw new Error(`Failed to create branch: ${error.message}`);
  }
}

/**
 * Switch to a branch
 */
async function switchBranch(branchName: string): Promise<string> {
  try {
    const { stdout } = await execAsync(
      `cd ${PROJECT_ROOT} && git checkout ${branchName}`
    );
    return stdout.trim() || `Switched to branch '${branchName}'`;
  } catch (error: any) {
    throw new Error(`Failed to switch branch: ${error.message}`);
  }
}

/**
 * Get git diff
 */
async function getDiff(options: {
  staged?: boolean;
  file?: string;
}): Promise<string> {
  const { staged, file } = options;

  let command = `cd ${PROJECT_ROOT} && git diff`;

  if (staged) {
    command += " --staged";
  }

  if (file) {
    command += ` -- ${file}`;
  }

  try {
    const { stdout } = await execAsync(command, {
      maxBuffer: 10 * 1024 * 1024,
    });
    return stdout || "No changes";
  } catch (error: any) {
    throw new Error(`Failed to get diff: ${error.message}`);
  }
}

/**
 * Commit changes
 */
async function commit(message: string): Promise<string> {
  try {
    // Check if there are staged changes
    const { stdout: statusOut } = await execAsync(
      `cd ${PROJECT_ROOT} && git status --porcelain`
    );

    if (!statusOut.trim()) {
      return "No changes to commit";
    }

    const { stdout } = await execAsync(
      `cd ${PROJECT_ROOT} && git commit -m "${message}"`
    );
    return stdout.trim();
  } catch (error: any) {
    throw new Error(`Failed to commit: ${error.message}`);
  }
}

/**
 * Stage files
 */
async function stageFiles(files: string[] | "all"): Promise<string> {
  try {
    if (files === "all") {
      await execAsync(`cd ${PROJECT_ROOT} && git add -A`);
      return "All changes staged";
    }

    const fileList = files.join(" ");
    await execAsync(`cd ${PROJECT_ROOT} && git add ${fileList}`);
    return `Staged: ${files.join(", ")}`;
  } catch (error: any) {
    throw new Error(`Failed to stage files: ${error.message}`);
  }
}

/**
 * Get recent commits
 */
async function getRecentCommits(count: number = 10): Promise<string> {
  try {
    const { stdout } = await execAsync(
      `cd ${PROJECT_ROOT} && git log --oneline -n ${count}`
    );
    return stdout.trim();
  } catch (error: any) {
    throw new Error(`Failed to get recent commits: ${error.message}`);
  }
}

/**
 * Pull latest changes
 */
async function pull(): Promise<string> {
  try {
    const { stdout } = await execAsync(`cd ${PROJECT_ROOT} && git pull`);
    return stdout.trim();
  } catch (error: any) {
    throw new Error(`Failed to pull: ${error.message}`);
  }
}

/**
 * Push changes
 */
async function push(): Promise<string> {
  try {
    const { stdout } = await execAsync(`cd ${PROJECT_ROOT} && git push`);
    return stdout.trim() || "Changes pushed successfully";
  } catch (error: any) {
    throw new Error(`Failed to push: ${error.message}`);
  }
}

// Create MCP server
const server = new Server(
  {
    name: "vizora-git",
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
        name: "vizora_git_status",
        description: "Get Git status of the Vizora repository",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "vizora_git_branch",
        description: "Get current branch or list all branches",
        inputSchema: {
          type: "object",
          properties: {
            action: {
              type: "string",
              enum: ["current", "list", "create", "switch"],
              description: "Branch action",
            },
            name: {
              type: "string",
              description: "Branch name (for create/switch)",
            },
          },
          required: ["action"],
        },
      },
      {
        name: "vizora_git_diff",
        description: "Get diff of changes",
        inputSchema: {
          type: "object",
          properties: {
            staged: {
              type: "boolean",
              description: "Show staged changes (default: false)",
            },
            file: {
              type: "string",
              description: "Specific file to diff (optional)",
            },
          },
        },
      },
      {
        name: "vizora_git_stage",
        description: "Stage files for commit",
        inputSchema: {
          type: "object",
          properties: {
            files: {
              oneOf: [
                { type: "array", items: { type: "string" } },
                { type: "string", enum: ["all"] },
              ],
              description: "Files to stage (or 'all' for all changes)",
            },
          },
          required: ["files"],
        },
      },
      {
        name: "vizora_git_commit",
        description: "Commit staged changes",
        inputSchema: {
          type: "object",
          properties: {
            message: {
              type: "string",
              description: "Commit message",
            },
          },
          required: ["message"],
        },
      },
      {
        name: "vizora_git_log",
        description: "Get recent commit history",
        inputSchema: {
          type: "object",
          properties: {
            count: {
              type: "number",
              description: "Number of commits to show (default: 10)",
            },
          },
        },
      },
      {
        name: "vizora_git_pull",
        description: "Pull latest changes from remote",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "vizora_git_push",
        description: "Push local commits to remote (use with caution)",
        inputSchema: {
          type: "object",
          properties: {},
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
      case "vizora_git_status": {
        const status = await getGitStatus();
        return {
          content: [{ type: "text", text: status }],
        };
      }

      case "vizora_git_branch": {
        const action = args?.action as "current" | "list" | "create" | "switch";
        const branchName = args?.name as string | undefined;

        if (action === "current") {
          const branch = await getCurrentBranch();
          return {
            content: [{ type: "text", text: `Current branch: ${branch}` }],
          };
        }

        if (action === "list") {
          const branches = await listBranches();
          return {
            content: [
              { type: "text", text: `Branches:\n${branches.join("\n")}` },
            ],
          };
        }

        if (action === "create") {
          if (!branchName) {
            throw new Error("Branch name is required for 'create' action");
          }
          const result = await createBranch(branchName);
          return {
            content: [{ type: "text", text: result }],
          };
        }

        if (action === "switch") {
          if (!branchName) {
            throw new Error("Branch name is required for 'switch' action");
          }
          const result = await switchBranch(branchName);
          return {
            content: [{ type: "text", text: result }],
          };
        }

        throw new Error(`Invalid action: ${action}`);
      }

      case "vizora_git_diff": {
        const staged = args?.staged as boolean | undefined;
        const file = args?.file as string | undefined;

        const diff = await getDiff({ staged, file });
        return {
          content: [{ type: "text", text: diff }],
        };
      }

      case "vizora_git_stage": {
        const files = args?.files as string[] | "all";

        if (!files) {
          throw new Error("Files parameter is required");
        }

        const result = await stageFiles(files);
        return {
          content: [{ type: "text", text: result }],
        };
      }

      case "vizora_git_commit": {
        const message = args?.message as string;

        if (!message) {
          throw new Error("Commit message is required");
        }

        const result = await commit(message);
        return {
          content: [{ type: "text", text: result }],
        };
      }

      case "vizora_git_log": {
        const count = (args?.count as number) || 10;

        const log = await getRecentCommits(count);
        return {
          content: [{ type: "text", text: log }],
        };
      }

      case "vizora_git_pull": {
        const result = await pull();
        return {
          content: [{ type: "text", text: result }],
        };
      }

      case "vizora_git_push": {
        const result = await push();
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
  console.error("Vizora Git MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

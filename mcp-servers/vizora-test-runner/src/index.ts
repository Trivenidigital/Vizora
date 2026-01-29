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

// Available test projects
const TEST_PROJECTS = [
  "middleware",
  "middleware-e2e",
  "realtime",
  "realtime-e2e",
  "web",
  "display",
] as const;

type TestProject = (typeof TEST_PROJECTS)[number];

/**
 * Run tests for a specific project
 */
async function runTests(
  project: TestProject,
  options: { coverage?: boolean; watch?: boolean } = {}
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const { coverage, watch } = options;

  let command = `cd ${PROJECT_ROOT} && pnpm nx test ${project}`;

  if (coverage) {
    command += " --coverage";
  }

  if (watch) {
    command += " --watch";
  }

  try {
    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 10 * 1024 * 1024, // 10 MB buffer
    });

    return { stdout, stderr, exitCode: 0 };
  } catch (error: any) {
    return {
      stdout: error.stdout || "",
      stderr: error.stderr || error.message,
      exitCode: error.code || 1,
    };
  }
}

/**
 * Run all tests (full test suite)
 */
async function runAllTests(options: {
  coverage?: boolean;
} = {}): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const { coverage } = options;

  let command = `cd ${PROJECT_ROOT} && pnpm nx run-many --target=test --all`;

  if (coverage) {
    command += " --coverage";
  }

  try {
    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 20 * 1024 * 1024, // 20 MB buffer
    });

    return { stdout, stderr, exitCode: 0 };
  } catch (error: any) {
    return {
      stdout: error.stdout || "",
      stderr: error.stderr || error.message,
      exitCode: error.code || 1,
    };
  }
}

/**
 * Run E2E tests
 */
async function runE2ETests(
  project?: "middleware-e2e" | "realtime-e2e"
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const target = project || "middleware-e2e";

  const command = `cd ${PROJECT_ROOT} && pnpm nx e2e ${target}`;

  try {
    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 10 * 1024 * 1024,
    });

    return { stdout, stderr, exitCode: 0 };
  } catch (error: any) {
    return {
      stdout: error.stdout || "",
      stderr: error.stderr || error.message,
      exitCode: error.code || 1,
    };
  }
}

/**
 * Get coverage report
 */
async function getCoverageReport(
  project?: TestProject
): Promise<{ stdout: string; stderr: string }> {
  if (project) {
    const command = `cd ${PROJECT_ROOT} && pnpm nx test ${project} --coverage --coverageReporters=text-summary`;

    try {
      const { stdout, stderr } = await execAsync(command, {
        maxBuffer: 10 * 1024 * 1024,
      });
      return { stdout, stderr };
    } catch (error: any) {
      return {
        stdout: error.stdout || "",
        stderr: error.stderr || error.message,
      };
    }
  }

  // All projects
  const command = `cd ${PROJECT_ROOT} && pnpm nx run-many --target=test --all --coverage --coverageReporters=text-summary`;

  try {
    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 20 * 1024 * 1024,
    });
    return { stdout, stderr };
  } catch (error: any) {
    return {
      stdout: error.stdout || "",
      stderr: error.stderr || error.message,
    };
  }
}

/**
 * Parse test results from output
 */
function parseTestResults(output: string): {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  duration?: string;
} {
  const result = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    duration: undefined as string | undefined,
  };

  // Jest output patterns
  const passedMatch = output.match(/(\d+) passed/i);
  const failedMatch = output.match(/(\d+) failed/i);
  const skippedMatch = output.match(/(\d+) skipped/i);
  const totalMatch = output.match(/Tests:\s+(\d+)\s+total/i);
  const durationMatch = output.match(/Time:\s+([\d.]+\s*[sm]s?)/i);

  if (passedMatch) result.passed = parseInt(passedMatch[1], 10);
  if (failedMatch) result.failed = parseInt(failedMatch[1], 10);
  if (skippedMatch) result.skipped = parseInt(skippedMatch[1], 10);
  if (totalMatch) result.total = parseInt(totalMatch[1], 10);
  if (durationMatch) result.duration = durationMatch[1];

  // If no total found, calculate from passed + failed + skipped
  if (result.total === 0) {
    result.total = result.passed + result.failed + result.skipped;
  }

  return result;
}

/**
 * Format test results for readability
 */
function formatTestResults(
  results: ReturnType<typeof parseTestResults>
): string {
  const { total, passed, failed, skipped, duration } = results;

  let output = `Test Results:\n`;
  output += `  Total: ${total}\n`;
  output += `  ✅ Passed: ${passed}\n`;
  output += `  ❌ Failed: ${failed}\n`;
  output += `  ⏭️  Skipped: ${skipped}\n`;

  if (duration) {
    output += `  ⏱️  Duration: ${duration}\n`;
  }

  const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : "0.0";
  output += `  📊 Pass Rate: ${passRate}%`;

  return output;
}

// Create MCP server
const server = new Server(
  {
    name: "vizora-test-runner",
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
        name: "vizora_test_run",
        description: "Run tests for a specific project",
        inputSchema: {
          type: "object",
          properties: {
            project: {
              type: "string",
              enum: TEST_PROJECTS,
              description: "Project to test",
            },
            coverage: {
              type: "boolean",
              description: "Generate coverage report (default: false)",
            },
          },
          required: ["project"],
        },
      },
      {
        name: "vizora_test_all",
        description: "Run all test suites",
        inputSchema: {
          type: "object",
          properties: {
            coverage: {
              type: "boolean",
              description: "Generate coverage reports (default: false)",
            },
          },
        },
      },
      {
        name: "vizora_test_e2e",
        description: "Run end-to-end tests",
        inputSchema: {
          type: "object",
          properties: {
            project: {
              type: "string",
              enum: ["middleware-e2e", "realtime-e2e"],
              description: "E2E project to test (default: middleware-e2e)",
            },
          },
        },
      },
      {
        name: "vizora_test_coverage",
        description: "Get coverage report for a project or all projects",
        inputSchema: {
          type: "object",
          properties: {
            project: {
              type: "string",
              enum: [...TEST_PROJECTS, "all"],
              description: "Project to get coverage for (or 'all')",
            },
          },
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
      case "vizora_test_run": {
        const project = args?.project as TestProject;
        const coverage = args?.coverage as boolean | undefined;

        if (!project || !TEST_PROJECTS.includes(project)) {
          throw new Error(
            `Invalid project. Must be one of: ${TEST_PROJECTS.join(", ")}`
          );
        }

        const result = await runTests(project, { coverage });
        const parsed = parseTestResults(result.stdout + result.stderr);
        const formatted = formatTestResults(parsed);

        let output = `Running tests for: ${project}\n\n`;
        output += formatted;

        if (result.exitCode !== 0) {
          output += `\n\n⚠️ Tests failed with exit code: ${result.exitCode}`;
          if (result.stderr) {
            output += `\n\nErrors:\n${result.stderr.substring(0, 500)}`;
          }
        }

        return {
          content: [{ type: "text", text: output }],
        };
      }

      case "vizora_test_all": {
        const coverage = args?.coverage as boolean | undefined;

        const result = await runAllTests({ coverage });
        const parsed = parseTestResults(result.stdout + result.stderr);
        const formatted = formatTestResults(parsed);

        let output = `Running all test suites...\n\n`;
        output += formatted;

        if (result.exitCode !== 0) {
          output += `\n\n⚠️ Some tests failed (exit code: ${result.exitCode})`;
        }

        return {
          content: [{ type: "text", text: output }],
        };
      }

      case "vizora_test_e2e": {
        const project = (args?.project as "middleware-e2e" | "realtime-e2e") ||
          "middleware-e2e";

        const result = await runE2ETests(project);
        const parsed = parseTestResults(result.stdout + result.stderr);
        const formatted = formatTestResults(parsed);

        let output = `Running E2E tests: ${project}\n\n`;
        output += formatted;

        if (result.exitCode !== 0) {
          output += `\n\n⚠️ E2E tests failed with exit code: ${result.exitCode}`;
          if (result.stderr) {
            output += `\n\nErrors:\n${result.stderr.substring(0, 500)}`;
          }
        }

        return {
          content: [{ type: "text", text: output }],
        };
      }

      case "vizora_test_coverage": {
        const project = (args?.project as TestProject | "all") || "all";

        const projectArg =
          project === "all" ? undefined : (project as TestProject);
        const result = await getCoverageReport(projectArg);

        let output = project === "all"
          ? "Coverage Report (All Projects):\n\n"
          : `Coverage Report (${project}):\n\n`;

        output += result.stdout || result.stderr || "No coverage data available";

        return {
          content: [{ type: "text", text: output.substring(0, 10000) }],
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
  console.error("Vizora Test Runner MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

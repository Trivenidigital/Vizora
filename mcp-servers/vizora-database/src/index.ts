#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { PrismaClient } from "../node_modules/.prisma/client/index.js";

const prisma = new PrismaClient();

// Prisma models that are safe to query
const SAFE_MODELS = [
  "User",
  "Organization",
  "Display",
  "Content",
  "Playlist",
  "PlaylistItem",
  "Schedule",
] as const;

type SafeModel = (typeof SAFE_MODELS)[number];

/**
 * Query a Prisma model with filters
 */
async function queryModel(
  modelName: SafeModel,
  filters: any = {}
): Promise<any[]> {
  try {
    // @ts-ignore - Dynamic model access
    const model = prisma[modelName.toLowerCase()];
    if (!model) {
      throw new Error(`Model '${modelName}' not found`);
    }

    const results = await model.findMany({
      where: filters,
      take: 100, // Limit to 100 records for safety
    });

    return results;
  } catch (error) {
    throw new Error(
      `Failed to query ${modelName}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get a single record by ID
 */
async function getById(modelName: SafeModel, id: string): Promise<any | null> {
  try {
    // @ts-ignore
    const model = prisma[modelName.toLowerCase()];
    if (!model) {
      throw new Error(`Model '${modelName}' not found`);
    }

    const result = await model.findUnique({
      where: { id },
    });

    return result;
  } catch (error) {
    throw new Error(
      `Failed to get ${modelName} by ID: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get table schema information
 */
async function getSchema(modelName?: SafeModel): Promise<string> {
  if (modelName) {
    // Return specific model schema
    const schemas: Record<string, string> = {
      User: `
model User {
  id             String       @id @default(cuid())
  email          String       @unique
  passwordHash   String
  name           String?
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
  role           String       @default("user")
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
}`,
      Organization: `
model Organization {
  id        String    @id @default(cuid())
  name      String
  subdomain String    @unique
  users     User[]
  displays  Display[]
  contents  Content[]
  playlists Playlist[]
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}`,
      Display: `
model Display {
  id                String       @id @default(cuid())
  name              String
  location          String?
  pairingCode       String?      @unique
  paired            Boolean      @default(false)
  organizationId    String
  organization      Organization @relation(fields: [organizationId], references: [id])
  currentPlaylistId String?
  status            String       @default("offline")
  lastSeen          DateTime?
  createdAt         DateTime     @default(now())
  updatedAt         DateTime     @updatedAt
}`,
      Content: `
model Content {
  id             String         @id @default(cuid())
  name           String
  type           String
  url            String?
  filePath       String?
  duration       Int?
  organizationId String
  organization   Organization   @relation(fields: [organizationId], references: [id])
  playlistItems  PlaylistItem[]
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt
}`,
      Playlist: `
model Playlist {
  id             String         @id @default(cuid())
  name           String
  organizationId String
  organization   Organization   @relation(fields: [organizationId], references: [id])
  items          PlaylistItem[]
  schedules      Schedule[]
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt
}`,
      PlaylistItem: `
model PlaylistItem {
  id         String   @id @default(cuid())
  playlistId String
  playlist   Playlist @relation(fields: [playlistId], references: [id])
  contentId  String
  content    Content  @relation(fields: [contentId], references: [id])
  order      Int
  duration   Int?
  createdAt  DateTime @default(now())
}`,
      Schedule: `
model Schedule {
  id         String   @id @default(cuid())
  playlistId String
  playlist   Playlist @relation(fields: [playlistId], references: [id])
  startTime  DateTime
  endTime    DateTime
  days       String[]
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}`,
    };

    return schemas[modelName] || `Schema for ${modelName} not found`;
  }

  // Return all schemas
  return `
Available Models:
- User
- Organization
- Display
- Content
- Playlist
- PlaylistItem
- Schedule

Use vizora_db_inspect with a specific model name to see its schema.
  `.trim();
}

/**
 * Count records in a model
 */
async function countRecords(
  modelName: SafeModel,
  filters: any = {}
): Promise<number> {
  try {
    // @ts-ignore
    const model = prisma[modelName.toLowerCase()];
    if (!model) {
      throw new Error(`Model '${modelName}' not found`);
    }

    const count = await model.count({
      where: filters,
    });

    return count;
  } catch (error) {
    throw new Error(
      `Failed to count ${modelName}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get database statistics
 */
async function getDatabaseStats(): Promise<Record<string, number>> {
  const stats: Record<string, number> = {};

  for (const modelName of SAFE_MODELS) {
    try {
      stats[modelName] = await countRecords(modelName);
    } catch (error) {
      stats[modelName] = -1; // Error indicator
    }
  }

  return stats;
}

/**
 * Seed test data (safe, minimal)
 */
async function seedTestData(): Promise<string> {
  try {
    // Check if test organization already exists
    const existingOrg = await prisma.organization.findUnique({
      where: { subdomain: "test" },
    });

    if (existingOrg) {
      return "Test data already exists (organization 'test' found)";
    }

    // Create test organization
    const org = await prisma.organization.create({
      data: {
        name: "Test Organization",
        subdomain: "test",
      },
    });

    // Create test user
    await prisma.user.create({
      data: {
        email: "test@test.com",
        passwordHash:
          "$2b$10$rQ5Z5Z5Z5Z5Z5Z5Z5Z5Z5OqK5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5", // Dummy hash
        name: "Test User",
        organizationId: org.id,
        role: "admin",
      },
    });

    return `Test data seeded successfully:\n- Organization: ${org.name} (${org.id})\n- User: test@test.com`;
  } catch (error) {
    throw new Error(
      `Failed to seed test data: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Clean test data
 */
async function cleanTestData(): Promise<string> {
  try {
    const testOrg = await prisma.organization.findUnique({
      where: { subdomain: "test" },
    });

    if (!testOrg) {
      return "No test data found (organization 'test' does not exist)";
    }

    // Delete test users
    await prisma.user.deleteMany({
      where: { organizationId: testOrg.id },
    });

    // Delete test organization
    await prisma.organization.delete({
      where: { id: testOrg.id },
    });

    return "Test data cleaned successfully";
  } catch (error) {
    throw new Error(
      `Failed to clean test data: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Create MCP server
const server = new Server(
  {
    name: "vizora-database",
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
        name: "vizora_db_query",
        description:
          "Query a Prisma model with optional filters (read-only, max 100 records)",
        inputSchema: {
          type: "object",
          properties: {
            model: {
              type: "string",
              enum: SAFE_MODELS,
              description: "Model to query",
            },
            filters: {
              type: "object",
              description: "Prisma where filters (optional)",
            },
          },
          required: ["model"],
        },
      },
      {
        name: "vizora_db_get",
        description: "Get a single record by ID",
        inputSchema: {
          type: "object",
          properties: {
            model: {
              type: "string",
              enum: SAFE_MODELS,
              description: "Model to query",
            },
            id: {
              type: "string",
              description: "Record ID",
            },
          },
          required: ["model", "id"],
        },
      },
      {
        name: "vizora_db_count",
        description: "Count records in a model with optional filters",
        inputSchema: {
          type: "object",
          properties: {
            model: {
              type: "string",
              enum: SAFE_MODELS,
              description: "Model to count",
            },
            filters: {
              type: "object",
              description: "Prisma where filters (optional)",
            },
          },
          required: ["model"],
        },
      },
      {
        name: "vizora_db_inspect",
        description: "Get schema information for a model or all models",
        inputSchema: {
          type: "object",
          properties: {
            model: {
              type: "string",
              enum: [...SAFE_MODELS, "all"],
              description: "Model to inspect (or 'all' for list)",
            },
          },
        },
      },
      {
        name: "vizora_db_stats",
        description: "Get record counts for all models (database overview)",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "vizora_db_seed",
        description:
          "Seed minimal test data (test organization + test user)",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "vizora_db_clean",
        description: "Remove test data (deletes test organization)",
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
      case "vizora_db_query": {
        const modelName = args?.model as SafeModel;
        const filters = args?.filters || {};

        if (!SAFE_MODELS.includes(modelName)) {
          throw new Error(
            `Invalid model. Must be one of: ${SAFE_MODELS.join(", ")}`
          );
        }

        const results = await queryModel(modelName, filters);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(results, null, 2),
            },
          ],
        };
      }

      case "vizora_db_get": {
        const modelName = args?.model as SafeModel;
        const id = args?.id as string;

        if (!SAFE_MODELS.includes(modelName)) {
          throw new Error(
            `Invalid model. Must be one of: ${SAFE_MODELS.join(", ")}`
          );
        }

        if (!id) {
          throw new Error("ID is required");
        }

        const result = await getById(modelName, id);
        return {
          content: [
            {
              type: "text",
              text: result
                ? JSON.stringify(result, null, 2)
                : `No ${modelName} found with ID: ${id}`,
            },
          ],
        };
      }

      case "vizora_db_count": {
        const modelName = args?.model as SafeModel;
        const filters = args?.filters || {};

        if (!SAFE_MODELS.includes(modelName)) {
          throw new Error(
            `Invalid model. Must be one of: ${SAFE_MODELS.join(", ")}`
          );
        }

        const count = await countRecords(modelName, filters);
        return {
          content: [
            {
              type: "text",
              text: `${modelName} count: ${count}`,
            },
          ],
        };
      }

      case "vizora_db_inspect": {
        const modelName = args?.model as SafeModel | "all";
        const schema =
          modelName === "all" ? await getSchema() : await getSchema(modelName);

        return {
          content: [
            {
              type: "text",
              text: schema,
            },
          ],
        };
      }

      case "vizora_db_stats": {
        const stats = await getDatabaseStats();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(stats, null, 2),
            },
          ],
        };
      }

      case "vizora_db_seed": {
        const result = await seedTestData();
        return {
          content: [
            {
              type: "text",
              text: result,
            },
          ],
        };
      }

      case "vizora_db_clean": {
        const result = await cleanTestData();
        return {
          content: [
            {
              type: "text",
              text: result,
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
  console.error("Vizora Database MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

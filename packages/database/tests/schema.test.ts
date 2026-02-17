/**
 * Database package schema smoke tests.
 *
 * Validates that the Prisma-generated client is importable and that
 * key model types exist without requiring a live database connection.
 */

describe('@vizora/database schema', () => {
  it('can import PrismaClient from the generated output', () => {
    // The generated Prisma client should be importable
    const { PrismaClient } = require('../src/generated/prisma');
    expect(PrismaClient).toBeDefined();
    expect(typeof PrismaClient).toBe('function');
  });

  it('can instantiate PrismaClient without connecting', () => {
    const { PrismaClient } = require('../src/generated/prisma');
    // PrismaClient can be instantiated without a DATABASE_URL;
    // it only connects on the first query, not at construction time.
    const client = new PrismaClient({
      datasources: { db: { url: 'postgresql://fake:fake@localhost:5432/fake' } },
    });
    expect(client).toBeDefined();
    expect(typeof client.$connect).toBe('function');
    expect(typeof client.$disconnect).toBe('function');
  });

  it('exposes core model delegates on the client', () => {
    const { PrismaClient } = require('../src/generated/prisma');
    const client = new PrismaClient({
      datasources: { db: { url: 'postgresql://fake:fake@localhost:5432/fake' } },
    });

    // Verify all core model accessors exist
    expect(client.organization).toBeDefined();
    expect(client.user).toBeDefined();
    expect(client.display).toBeDefined();
    expect(client.content).toBeDefined();
    expect(client.playlist).toBeDefined();
    expect(client.playlistItem).toBeDefined();
    expect(client.schedule).toBeDefined();
    expect(client.tag).toBeDefined();
    expect(client.displayGroup).toBeDefined();
    expect(client.auditLog).toBeDefined();
    expect(client.apiKey).toBeDefined();
    expect(client.notification).toBeDefined();
    expect(client.contentFolder).toBeDefined();
    expect(client.billingTransaction).toBeDefined();
  });

  it('exports Prisma namespace with enums and helpers', () => {
    const generated = require('../src/generated/prisma');
    // Prisma namespace should contain utility types/helpers
    expect(generated.Prisma).toBeDefined();
    expect(generated.Prisma.ModelName).toBeDefined();
  });

  it('ModelName enum contains expected models', () => {
    const { Prisma } = require('../src/generated/prisma');
    const modelNames = Object.values(Prisma.ModelName) as string[];

    expect(modelNames).toContain('Organization');
    expect(modelNames).toContain('User');
    expect(modelNames).toContain('Display');
    expect(modelNames).toContain('Content');
    expect(modelNames).toContain('Playlist');
    expect(modelNames).toContain('Schedule');
    expect(modelNames).toContain('Tag');
    expect(modelNames).toContain('DisplayGroup');
    expect(modelNames).toContain('AuditLog');
    expect(modelNames).toContain('ApiKey');
    expect(modelNames).toContain('Notification');
    expect(modelNames).toContain('ContentFolder');
    expect(modelNames).toContain('BillingTransaction');
    expect(modelNames).toContain('Plan');
    expect(modelNames).toContain('Promotion');
    expect(modelNames).toContain('SystemConfig');
  });

  it('exposes the database module re-export', () => {
    // Verify the package entry point works
    const db = require('../src/lib/database');
    expect(db.PrismaClient).toBeDefined();
    expect(db.prisma).toBeDefined();
  });
});

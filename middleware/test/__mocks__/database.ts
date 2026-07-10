// Mock for @vizora/database
// Non-Prisma value exports that production code imports from this package must
// be mirrored here (jest maps the whole '@vizora/database' module to this file).
// Keep in sync with packages/database/src/lib/device-constants.ts.
export const DEVICE_OFFLINE_THRESHOLD_MS = 120_000;

export class PrismaClient {
  user = {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  
  organization = {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  
  auditLog = {
    create: jest.fn(),
    findMany: jest.fn(),
  };
  
  display = {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  
  content = {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  
  playlist = {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  
  schedule = {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  $connect = jest.fn();
  $disconnect = jest.fn();
}

export const prisma = new PrismaClient();

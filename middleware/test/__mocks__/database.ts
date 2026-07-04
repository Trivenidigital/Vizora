// Mock for @vizora/database
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

// The pure schedule-activity helpers carry no DB dependency — re-export the REAL
// implementations rather than mock them, so code that imports them from
// @vizora/database (SchedulesService, the effective-content resolver) behaves
// identically under jest. Only the Prisma client above is a mock.
export {
  isScheduleActiveAt,
  schedulesOverlapInTime,
  expandAdjacentDays,
  previousDay,
  nextDay,
  expandWeeklyIntervals,
  intervalsOverlap,
  MINUTES_PER_DAY,
  DAYS_PER_WEEK,
  MINUTES_PER_WEEK,
} from '../../../packages/database/src/lib/schedule-active';

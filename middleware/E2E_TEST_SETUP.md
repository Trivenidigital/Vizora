# E2E Test Setup Guide

## Overview
This guide explains how to set up and run E2E tests for the Vizora middleware.

## Prerequisites
- Docker and Docker Compose installed
- Node.js 18+ and pnpm
- PostgreSQL knowledge (optional, Docker handles setup)

## Quick Start

### Option 1: Full Automated Setup (RECOMMENDED)
```bash
cd middleware
pnpm test:e2e:full
```

This single command will:
1. Start PostgreSQL and Redis in Docker
2. Wait for database to be ready
3. Push Prisma schema to test database
4. Run all E2E tests with coverage
5. Stop Docker containers

### Option 2: Manual Setup
```bash
# Step 1: Start test database
cd middleware
pnpm db:test:start

# Step 2: Wait ~3 seconds for database to be ready
sleep 3

# Step 3: Initialize test database
pnpm db:test:push

# Step 4: Run E2E tests
pnpm test:e2e

# Step 5: Stop database when done
pnpm db:test:stop
```

### Option 3: Using Existing Local PostgreSQL
If you have PostgreSQL running locally on port 5432:

```bash
# Update .env.test with your local database
# DATABASE_URL=postgresql://username:password@localhost:5432/vizora_test

# Push schema
pnpm db:test:push

# Run tests
pnpm test:e2e
```

## Test Commands

### Run E2E Tests
```bash
pnpm test:e2e
```

### Run E2E Tests with Coverage
```bash
pnpm test:e2e:cov
```

### Run Only Specific Test File
```bash
NODE_ENV=test jest --config=jest.e2e.config.js test/auth.e2e-spec.ts
```

### Run Tests in Watch Mode
```bash
NODE_ENV=test jest --config=jest.e2e.config.js --watch
```

### Run Tests with Debugging
```bash
node --inspect-brk -r ts-node/register node_modules/.bin/jest --config=jest.e2e.config.js --runInBand
```

## Database Management

### Reset Test Database
```bash
# Clear all data and re-seed (if applicable)
pnpm db:test:reset
```

### Push Schema to Test Database
```bash
# Deploy Prisma schema changes to test DB
pnpm db:test:push
```

### Start Test Database Only
```bash
pnpm db:test:start
```

### Stop Test Database
```bash
pnpm db:test:stop
```

## Environment Variables

Test environment variables are loaded from `.env.test`:

- `NODE_ENV=test` - Sets Node environment to test
- `DATABASE_URL` - PostgreSQL connection string
- `DEVICE_JWT_SECRET` - JWT secret for testing
- `CORS_ORIGIN` - Allowed origins for CORS

## Troubleshooting

### Error: "Can't reach database server at localhost:5432"
**Solution:**
```bash
# Make sure database is running
pnpm db:test:start
# Wait a few seconds for it to be ready
sleep 3
```

### Error: "Database connection timeout"
**Solution:**
1. Check if Docker is running: `docker ps`
2. Check if PostgreSQL container is running: `docker logs vizora-postgres-test`
3. Restart: `pnpm db:test:stop && pnpm db:test:start`

### Error: "EADDRINUSE: address already in use :::5432"
**Solution:**
```bash
# Kill existing container
docker kill vizora-postgres-test
# Or change PORT in docker-compose.test.yml
```

### Tests pass but seem slow
**Solution:**
1. Increase Jest timeout in jest.e2e.config.js
2. Check database performance: `pnpm db:test:stop && pnpm db:test:start`
3. Run fewer tests: `NODE_ENV=test jest --config=jest.e2e.config.js test/auth.e2e-spec.ts`

## CI/CD Integration

### GitHub Actions Example
```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: vizora_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'pnpm'

      - run: pnpm install
      - run: pnpm --dir middleware db:test:push
      - run: pnpm --dir middleware test:e2e:cov
```

## Test Coverage Goals

- **Target:** 80%+ coverage
- **Critical services:** Auth, Database, Displays
- **Current status:** See `test:e2e:cov` report

## Performance Tips

1. **Parallel testing:** Jest can run tests in parallel by default
2. **Selective testing:** Run only affected tests during development
3. **Database reset:** Clear test data between test suites to ensure isolation
4. **Docker optimization:** Allocate sufficient resources to Docker

## Creating New E2E Tests

1. Create file: `test/module.e2e-spec.ts`
2. Use pattern from existing tests
3. Import `INestApplication` from `@nestjs/common`
4. Set up database and application before tests
5. Clean up after tests

Example:
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app/app.module';

describe('Module (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should work', async () => {
    return request(app.getHttpServer())
      .get('/api/endpoint')
      .expect(200);
  });
});
```

## Next Steps

1. Run `pnpm test:e2e:full` to verify setup
2. Check test results and coverage
3. Fix any failing tests
4. Integrate into CI/CD pipeline
5. Set coverage thresholds (e.g., minimum 80%)

## Support

For issues or questions:
1. Check this guide's troubleshooting section
2. Review test files for patterns
3. Check Docker container logs: `docker logs vizora-postgres-test`
4. Check Jest output: `pnpm test:e2e 2>&1 | tail -100`

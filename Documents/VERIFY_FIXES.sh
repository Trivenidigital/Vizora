#!/bin/bash

echo "╔════════════════════════════════════════════════════════════════════╗"
echo "║             VERIFYING E2E BLOCKER FIXES - CHECKLIST                ║"
echo "╚════════════════════════════════════════════════════════════════════╝"
echo ""

PASS=0
FAIL=0

# Check 1: ThrottlerModule fix
echo "✓ Checking Fix #1: ThrottlerModule Configuration"
if grep -q "ThrottlerModule.forRoot(\[" middleware/src/app/app.module.ts; then
    echo "  ✅ PASS - Array syntax correctly applied"
    ((PASS++))
else
    echo "  ❌ FAIL - Array syntax not found"
    ((FAIL++))
fi
echo ""

# Check 2: .env.test exists
echo "✓ Checking Fix #2: Environment Variables"
if [ -f middleware/.env.test ] && grep -q "DATABASE_URL" middleware/.env.test; then
    echo "  ✅ PASS - .env.test exists with DATABASE_URL"
    ((PASS++))
else
    echo "  ❌ FAIL - .env.test missing or incomplete"
    ((FAIL++))
fi
echo ""

# Check 3: jest.e2e.config.js updated
echo "✓ Checking Fix #3: Jest Configuration"
if grep -q "setupFiles" middleware/jest.e2e.config.js; then
    echo "  ✅ PASS - Jest setupFiles configured"
    ((PASS++))
else
    echo "  ❌ FAIL - Jest setupFiles not found"
    ((FAIL++))
fi
echo ""

# Check 4: test/setup.ts exists
echo "✓ Checking Fix #4: Test Initialization"
if [ -f middleware/test/setup.ts ] && grep -q "dotenv.config" middleware/test/setup.ts; then
    echo "  ✅ PASS - test/setup.ts exists and loads dotenv"
    ((PASS++))
else
    echo "  ❌ FAIL - test/setup.ts missing or incomplete"
    ((FAIL++))
fi
echo ""

# Check 5: package.json scripts updated
echo "✓ Checking Fix #5: NPM Scripts"
if grep -q "test:e2e:full" middleware/package.json && grep -q "db:test:start" middleware/package.json; then
    echo "  ✅ PASS - npm scripts added (test:e2e:full, db:test:start, etc)"
    ((PASS++))
else
    echo "  ❌ FAIL - npm scripts not found"
    ((FAIL++))
fi
echo ""

# Check 6: docker-compose.test.yml exists
echo "✓ Checking Fix #6: Docker Configuration"
if [ -f docker-compose.test.yml ] && grep -q "postgres" docker-compose.test.yml; then
    echo "  ✅ PASS - docker-compose.test.yml exists with postgres service"
    ((PASS++))
else
    echo "  ❌ FAIL - docker-compose.test.yml missing"
    ((FAIL++))
fi
echo ""

# Check 7: setup-test-db.ts exists
echo "✓ Checking Fix #7: Database Setup Script"
if [ -f middleware/scripts/setup-test-db.ts ]; then
    echo "  ✅ PASS - scripts/setup-test-db.ts exists"
    ((PASS++))
else
    echo "  ❌ FAIL - scripts/setup-test-db.ts missing"
    ((FAIL++))
fi
echo ""

# Check 8: E2E_TEST_SETUP.md exists
echo "✓ Checking Fix #8: Setup Documentation"
if [ -f middleware/E2E_TEST_SETUP.md ]; then
    echo "  ✅ PASS - E2E_TEST_SETUP.md exists"
    ((PASS++))
else
    echo "  ❌ FAIL - E2E_TEST_SETUP.md missing"
    ((FAIL++))
fi
echo ""

# Check 9: RUN_E2E_TESTS.md exists
echo "✓ Checking Fix #9: Quick Start Guide"
if [ -f middleware/RUN_E2E_TESTS.md ]; then
    echo "  ✅ PASS - RUN_E2E_TESTS.md exists"
    ((PASS++))
else
    echo "  ❌ FAIL - RUN_E2E_TESTS.md missing"
    ((FAIL++))
fi
echo ""

# Summary
echo "╔════════════════════════════════════════════════════════════════════╗"
echo "║                         VERIFICATION SUMMARY                       ║"
echo "╚════════════════════════════════════════════════════════════════════╝"
echo ""
echo "Total Checks:  9"
echo "Passed:       $PASS"
echo "Failed:       $FAIL"
echo ""

if [ $FAIL -eq 0 ]; then
    echo "✅ ALL FIXES VERIFIED - READY TO RUN TESTS!"
    echo ""
    echo "Next step:"
    echo "  cd middleware && pnpm test:e2e:full"
    exit 0
else
    echo "❌ SOME FIXES MISSING - Please check the failures above"
    exit 1
fi

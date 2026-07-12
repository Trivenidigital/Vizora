module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  testPathIgnorePatterns: [
    '/node_modules/',
    '/__tests__/', // Exclude E2E tests from unit test runs
  ],
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', {
      tsconfig: '<rootDir>/../tsconfig.spec.json',
    }],
  },
  collectCoverageFrom: [
    '**/*.(t|j)s',
    '!**/*.spec.ts',
    '!**/__tests__/**',
    '!**/*.module.ts',
    '!**/index.ts',
    '!**/main.ts',
    '!**/seed/**',
  ],
  coverageDirectory: '../coverage',
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  testEnvironment: 'node',
  detectOpenHandles: true,
  moduleNameMapper: {
    '^@vizora/database$': '<rootDir>/../test/__mocks__/database.ts',
    // otplib (MFA / auth #2) v13 + its transitive crypto/base32 deps (@scure,
    // @noble) ship pure ESM under pnpm's `.pnpm/` layout, which Jest's CJS
    // runtime can't load. Map to a faithful RFC-6238 TOTP test double
    // (generate/verify/generateSecret/generateURI). Production uses real otplib;
    // only Jest resolves this stub.
    '^otplib$': '<rootDir>/../test/__mocks__/otplib.ts',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@vizora|isomorphic-dompurify|@exodus|html-encoding-sniffer|jsdom|uuid)/)',
  ],
  setupFiles: ['reflect-metadata'],
  setupFilesAfterEnv: ['<rootDir>/../test/setup.ts'],
};

module.exports = {
  displayName: 'database',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  modulePathIgnorePatterns: ['<rootDir>/dist/'],
  // Source uses ESM `.js` extensions on relative imports (required for the package's
  // tsc/ESM build); ts-jest runs CommonJS, so strip the extension to resolve to the
  // `.ts` source. Only affects relative `*.js` imports — bare/dep imports unaffected.
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        module: 'commonjs',
        target: 'ES2021',
        esModuleInterop: true,
        skipLibCheck: true,
      },
    }],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
};

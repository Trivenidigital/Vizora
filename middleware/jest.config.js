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
  ],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@vizora/database$': '<rootDir>/../test/__mocks__/database.ts',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@vizora|isomorphic-dompurify|@exodus|html-encoding-sniffer|jsdom)/)',
  ],
  setupFiles: ['reflect-metadata'],
  setupFilesAfterEnv: ['<rootDir>/../test/setup.ts'],
};

module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'test',
  testRegex: '.*\\.e2e-spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', {
      tsconfig: '<rootDir>/../tsconfig.spec.json',
    }],
  },
  testEnvironment: 'node',
  setupFiles: ['reflect-metadata'],
  testTimeout: 30000,
  // Let pnpm workspace resolve @vizora/database naturally for E2E tests
  transformIgnorePatterns: [
    'node_modules/(?!(@vizora)/)',
  ],
  globals: {
    'ts-jest': {
      isolatedModules: true,
    },
  },
};

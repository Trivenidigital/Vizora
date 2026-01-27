module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', {
      tsconfig: '<rootDir>/../tsconfig.spec.json',
    }],
  },
  collectCoverageFrom: ['**/*.(t|j)s', '!**/*.spec.ts'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@vizora/database$': '<rootDir>/../test/__mocks__/database.ts',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@vizora)/)',
  ],
  setupFiles: ['reflect-metadata'],
  setupFilesAfterEnv: ['<rootDir>/../test/setup.ts'],
};

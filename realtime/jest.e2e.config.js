module.exports = {
  displayName: 'realtime-e2e',
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.e2e-spec.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  rootDir: '.',
  testTimeout: 30000,
  forceExit: true,
  detectOpenHandles: false,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/main.ts',
  ],
  coverageDirectory: 'coverage',
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'commonjs',
          target: 'ES2021',
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
          esModuleInterop: true,
          skipLibCheck: true,
        },
      },
    ],
  },
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
};

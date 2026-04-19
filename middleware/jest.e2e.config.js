module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'test',
  testRegex: '.*\\.e2e-spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', {
      tsconfig: '<rootDir>/../tsconfig.spec.json',
      isolatedModules: true,
    }],
  },
  testEnvironment: 'node',
  setupFiles: ['reflect-metadata', '<rootDir>/setup.ts'],
  setupFilesAfterEnv: ['<rootDir>/setup.ts'],
  testTimeout: 30000,
  // Transform ESM-only transitive deps of isomorphic-dompurify (jsdom →
  // html-encoding-sniffer → @exodus/bytes) so Jest can parse `export`.
  // Uses a non-anchored lookahead (".*") so it matches pnpm's
  // `.pnpm/@exodus+bytes@1.15.0/node_modules/@exodus/bytes/...` paths too —
  // the unit-test config's anchored pattern silently misses these because
  // unit tests mock @vizora/database and rarely load dompurify for real,
  // but e2e bootstraps the full NestJS app.
  transformIgnorePatterns: [
    'node_modules/(?!.*(@vizora|isomorphic-dompurify|@exodus|html-encoding-sniffer|jsdom|uuid))',
  ],
};

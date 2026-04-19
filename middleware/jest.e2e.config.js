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
  // Let pnpm workspace resolve @vizora/database naturally for E2E tests,
  // and transform ESM-only transitive deps of isomorphic-dompurify (jsdom →
  // html-encoding-sniffer → @exodus/bytes) so Jest can parse `export` syntax.
  // Mirrors jest.config.js so unit and e2e runs agree on what to transform.
  transformIgnorePatterns: [
    'node_modules/(?!(@vizora|isomorphic-dompurify|@exodus|html-encoding-sniffer|jsdom|uuid)/)',
  ],
};

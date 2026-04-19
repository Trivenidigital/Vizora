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
  // Allowlist includes the full jsdom@28 dep tree (from pnpm-lock.yaml)
  // because isomorphic-dompurify pulls jsdom, and several jsdom transitives
  // ship ESM-only. Better to transform too many than play whack-a-mole:
  // each time a new ESM transitive gets added, tests break mysteriously.
  transformIgnorePatterns: [
    'node_modules/(?!.*(' +
      [
        '@vizora',
        'isomorphic-dompurify',
        'uuid',
        // jsdom@28 and its direct + transitive deps
        'jsdom',
        '@acemir',
        '@asamuzakjp',
        '@bramus',
        '@csstools',
        '@exodus',
        'cssstyle',
        'css-tree',
        'data-urls',
        'decimal.js',
        'html-encoding-sniffer',
        'http-proxy-agent',
        'https-proxy-agent',
        'agent-base',
        'lru-cache',
        'parse5',
        'rrweb-cssom',
        'saxes',
        'symbol-tree',
        'tough-cookie',
        'undici',
        'w3c-xmlserializer',
        'webidl-conversions',
        'whatwg-encoding',
        'whatwg-mimetype',
        'whatwg-url',
        'xml-name-validator',
      ].join('|') +
    '))',
  ],
};

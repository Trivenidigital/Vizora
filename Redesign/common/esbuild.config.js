import * as esbuild from 'esbuild';

// Node.js built-in modules to externalize
const nodeBuiltins = [
  'fs', 'path', 'os', 'crypto', 'http', 'https', 'stream', 
  'zlib', 'net', 'tty', 'child_process', 'util', 'assert',
  'querystring', 'url', 'punycode', 'buffer', 'events', 'tls'
];

// Third-party modules to externalize
const thirdPartyExternals = [
  'xmlhttprequest-ssl',
  '@socket.io/component-emitter',
  'expect-type',
  'ws'
];

const allExternals = [...nodeBuiltins, ...thirdPartyExternals];

// Build configuration
await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'browser', // Use browser platform for better compatibility
  format: 'esm',
  outfile: 'dist/index.js',
  external: allExternals,
  define: {
    'process.env.NODE_ENV': '"production"',
    'global': 'globalThis',
    'process.browser': 'true',
  },
  banner: {
    js: `
      // NodeJS compatibility shims
      const process = {
        env: { NODE_ENV: 'production' },
        nextTick: (fn, ...args) => setTimeout(() => fn(...args), 0),
        browser: true,
        version: '',
        platform: typeof navigator !== 'undefined' ? navigator.platform : ''
      };
      globalThis.process = process;
      globalThis.Buffer = globalThis.Buffer || { isBuffer: () => false };
      
      // Empty shims for Node.js modules
      ${nodeBuiltins.map(mod => `import.meta.${mod} = {};`).join('\n')}
    `
  }
});

console.log('Build complete!'); 
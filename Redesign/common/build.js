import * as esbuild from 'esbuild';
import { readFileSync } from 'fs';
import { globSync } from 'glob';

// Load package.json to get dependencies
const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'));

// Get all external dependencies
const externalDependencies = [
  ...Object.keys(packageJson.dependencies || {}),
  ...Object.keys(packageJson.peerDependencies || {})
];

// Additional external dependencies from node_modules
const additionalExternals = [
  'expect-type', 
  'vitest', 
  '@vitest/coverage-v8',
  'xmlhttprequest-ssl',
  '@socket.io/component-emitter'
];

// Node.js built-in modules to externalize
const nodeBuiltins = [
  'fs', 'path', 'os', 'crypto', 'http', 'https', 'stream', 
  'zlib', 'net', 'tty', 'child_process', 'util', 'assert',
  'querystring', 'url', 'punycode', 'buffer', 'events', 'tls'
];

// Output banner that will be prepended to the bundle
const banner = `
/**
 * @vizora/common v${packageJson.version}
 * Auto-generated bundle file
 * Do not modify directly
 */
`;

async function build() {
  try {
    console.log('Building @vizora/common...');
    
    // Find all source files excluding tests
    const entryPoints = globSync('src/**/*.{ts,tsx}', {
      ignore: [
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        'src/**/__tests__/**',
        'src/**/test/**',
        'src/**/*.spec.ts',
        'src/**/*.spec.tsx'
      ]
    });
    
    // Build the main bundle
    await esbuild.build({
      entryPoints: ['./src/index.ts'],
      outfile: './dist/index.js',
      bundle: true,
      minify: false,
      platform: 'node',
      format: 'esm',
      target: ['es2020'],
      sourcemap: true,
      external: [...externalDependencies, ...additionalExternals, ...nodeBuiltins],
      banner: {
        js: banner
      },
      define: {
        'process.env.NODE_ENV': '"production"'
      },
      // Ensure proper tree-shaking
      treeShaking: true,
      // Keep only production code
      conditions: ['production', 'node']
    });
    
    console.log('Build completed successfully!');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build(); 
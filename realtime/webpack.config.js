const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { IgnorePlugin } = require('webpack');
const { join } = require('path');

module.exports = {
  output: {
    path: join(__dirname, 'dist'),
    clean: true,
    ...(process.env.NODE_ENV !== 'production' && {
      devtoolModuleFilenameTemplate: '[absolute-resource-path]',
    }),
  },
  // Only what is listed here is merged (mergeExternals below). This list used
  // to also name class-transformer/storage, @prisma/client-runtime-utils, the
  // Sentry profiler packages and a `.node` matcher — but without
  // mergeExternals Nx discarded ALL of it, so none of those was ever external.
  // They were dropped rather than activated: making @sentry/profiling-node
  // external would start loading its native addon at boot, a behaviour change
  // the build has never shipped. The IgnorePlugins below are what actually
  // keep the profiler bindings out of the bundle.
  externals: [
    // class-transformer and class-validator MUST be loaded from node_modules,
    // never bundled — same defect and same fix as middleware/webpack.config.js.
    // @nestjs/common is external, so the HTTP ValidationPipe require()s the CJS
    // class-transformer; a bundled copy keeps the DTO metadata where the pipe
    // never reads it. Here that meant @ValidateNested/@Type on the internal
    // command DTOs were inert, and with `whitelist: true` the nested `command`
    // object was stripped to `{}` — devices received a command with no `type`.
    // Guarded by scripts/ops/assert-bundle-externals.ts (CI build job).
    ({ request }, callback) => {
      if (request === 'class-transformer/storage') {
        return callback(undefined, 'commonjs class-transformer/cjs/storage.js');
      }
      if (/^class-(transformer|validator)(\/|$)/.test(request)) {
        return callback(undefined, `commonjs ${request}`);
      }
      callback();
    },
  ],
  plugins: [
    new NxAppWebpackPlugin({
      target: 'node',
      compiler: 'tsc',
      main: './src/main.ts',
      tsConfig: './tsconfig.app.json',
      assets: ['./src/assets'],
      optimization: false,
      outputHashing: 'none',
      generatePackageJson: true,
      // Without this Nx DISCARDS the top-level `externals` above (it rebuilds
      // the list from root node_modules only, where the realtime-only pnpm deps
      // class-transformer/class-validator are absent — so they were bundled).
      mergeExternals: true,
      sourceMap: true,
    }),
    // Ignore Sentry profiling native bindings
    new IgnorePlugin({
      resourceRegExp: /^@sentry-internal\/node-cpu-profiler$/,
    }),
    new IgnorePlugin({
      resourceRegExp: /\.node$/,
      contextRegExp: /@sentry-internal/,
    }),
  ],
};

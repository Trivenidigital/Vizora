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
  externals: [
    'class-transformer/storage',
    '@prisma/client-runtime-utils',
    '@sentry/profiling-node',
    '@sentry-internal/node-cpu-profiler',
    // Externalize all .node files (native bindings)
    function ({ request }, callback) {
      if (/\.node$/.test(request)) {
        return callback(null, 'commonjs ' + request);
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

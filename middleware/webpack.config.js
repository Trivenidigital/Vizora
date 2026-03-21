const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { join } = require('path');
const webpack = require('webpack');

module.exports = {
  output: {
    path: join(__dirname, 'dist'),
    clean: true,
  },
  externals: [
    { sharp: 'commonjs sharp' },
    function ({ request }, callback) {
      // Externalize Prisma-related modules to avoid bundling the query engine
      if (request && (request.includes('@vizora/database') || request.includes('.prisma') || request.includes('@prisma/client') || request.includes('generated/prisma'))) {
        return callback(null, 'commonjs ' + request);
      }
      callback();
    },
  ],
  ignoreWarnings: [/Failed to parse source map/],
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
      sourceMap: false,
    }),
    new webpack.NormalModuleReplacementPlugin(
      /^class-transformer\/storage$/,
      require.resolve('class-transformer/cjs/storage.js')
    ),
  ],
};

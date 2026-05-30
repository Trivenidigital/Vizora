const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { join } = require('path');
const webpack = require('webpack');

module.exports = {
  output: {
    path: join(__dirname, 'dist'),
    clean: true,
  },
  externals: {
    sharp: 'commonjs sharp',
  },
  ignoreWarnings: [/Failed to parse source map/],
  plugins: [
    new NxAppWebpackPlugin({
      target: 'node',
      compiler: 'tsc',
      main: './src/main.ts',
      tsConfig: './tsconfig.app.json',
      // Widget Handlebars templates are read at runtime via
      // fs.readFileSync(path.join(__dirname, 'widget-templates', ...)) in
      // content.service.ts. Once bundled, __dirname is dist/, so the .hbs
      // files must be copied next to main.js — otherwise loadWidgetTemplate
      // throws for EVERY widget type in production (weather, rss-*, social-*,
      // generic-api). They render in dev/test because __dirname there is the
      // source dir that already holds them.
      assets: [
        './src/assets',
        {
          glob: '**/*.hbs',
          input: './src/modules/content/widget-templates',
          output: './widget-templates',
        },
      ],
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

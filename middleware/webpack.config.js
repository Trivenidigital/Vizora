const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { join } = require('path');

module.exports = {
  output: {
    path: join(__dirname, 'dist'),
    clean: true,
  },
  externals: [
    { sharp: 'commonjs sharp' },
    // class-transformer and class-validator MUST be loaded from node_modules,
    // never bundled. @nestjs/common is external, so its ValidationPipe
    // require()s the CJS class-transformer at runtime; when webpack bundled the
    // esm5 copy, every DTO's @Type/@Transform registered into the BUNDLED copy's
    // metadata storage — which the pipe never reads. Result, in dev and prod
    // alike, since Jan 2026: every @Transform was inert (a lone `?tagIds=x`
    // 400'd), `?flag=false` implicit-converted to `true`, and @ValidateNested
    // received plain objects, so nested DTOs were never validated. ts-jest does
    // not bundle, so no unit test could see it. Guarded by
    // scripts/ops/assert-middleware-bundle-externals.ts (CI build job).
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
      // Without this Nx DISCARDS the top-level `externals` above (it rebuilds
      // the list from root node_modules only — middleware-only pnpm deps such
      // as class-transformer are absent there, so they were silently bundled).
      mergeExternals: true,
      sourceMap: false,
    }),
  ],
};

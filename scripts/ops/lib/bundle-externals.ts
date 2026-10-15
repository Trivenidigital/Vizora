/**
 * Packages that MUST be require()d from node_modules by the middleware and
 * realtime bundles, never inlined into them.
 *
 * class-transformer keeps its decorator metadata in a module-local store. The
 * Nest ValidationPipe lives in the EXTERNAL @nestjs/common and require()s the
 * node_modules copy, so a bundled copy splits the store in two: every DTO's
 * @Type/@Transform registers where the pipe never looks. That was live in dev
 * and prod from Jan to Oct 2026 — `?tagIds=<one id>` 400'd, `?flag=false`
 * implicit-converted to `true`, @ValidateNested validated nothing — and no
 * unit test could see it, because ts-jest does not bundle. class-validator is
 * listed too: it survives today only because its store happens to be global.
 */
export const REQUIRED_EXTERNALS = ['class-transformer', 'class-validator'] as const;

export interface BundleExternalsVerdict {
  ok: boolean;
  /** Packages whose source was inlined into the bundle. */
  bundled: string[];
  /** Packages the bundle never require()s — a bundle that uses neither is not evidence. */
  notRequired: string[];
}

export function checkBundleExternals(bundleSource: string): BundleExternalsVerdict {
  const bundled: string[] = [];
  const notRequired: string[] = [];
  for (const pkg of REQUIRED_EXTERNALS) {
    // pnpm store path as webpack writes it in module-boundary comments
    // (`node_modules/.pnpm/class-transformer@0.5.1/node_modules/class-transformer/esm5/...`).
    if (bundleSource.includes(`node_modules/${pkg}/`)) bundled.push(pkg);
    if (!bundleSource.includes(`require("${pkg}`)) notRequired.push(pkg);
  }
  return { ok: bundled.length === 0 && notRequired.length === 0, bundled, notRequired };
}

# Security Audit Exceptions

Last updated: 2026-03-07

## Summary

After updating all direct and overridable transitive dependencies, 6 vulnerabilities
remain. All are moderate or low severity and exist in transitive dependencies of
dev tooling or the Electron desktop client (not the production web/API services).

## Acknowledged Vulnerabilities

### 1. electron (<35.7.5) — Moderate: ASAR Integrity Bypass

- **Path:** `.>electron`
- **Why not fixed:** Electron 28 -> 35 is a major version jump requiring significant
  migration work in the display client. The ASAR integrity bypass requires local
  file system access to the packaged app, which is not a remote attack vector.
- **Mitigation:** Display client is deployed to controlled kiosk hardware. Will be
  addressed during the planned Electron major version upgrade.

### 2. lodash (<=4.17.22) — Moderate: Prototype Pollution in unset/omit

- **Path:** `display>electron-builder>app-builder-lib>@malept/flatpak-bundler>lodash`
- **Why not fixed:** Transitive dependency of electron-builder's flatpak bundler.
  Only used during build/packaging, never at runtime. No override possible without
  breaking electron-builder.
- **Mitigation:** Not reachable in production code paths. Build-time only.

### 3. ajv (<6.14.0) — Moderate: ReDoS with $data option

- **Path:** `.>@nx/webpack>fork-ts-checker-webpack-plugin>schema-utils>ajv`
- **Why not fixed:** Deep transitive dependency of Nx webpack plugin. Dev tooling
  only, not shipped to production.
- **Mitigation:** Only processes developer-controlled schema definitions during builds.

### 4. ajv (>=7.0.0-alpha.0 <8.18.0) — Moderate: ReDoS with $data option

- **Path:** `.>@nestjs/schematics>@angular-devkit/core>ajv`
- **Why not fixed:** Transitive dependency of @nestjs/schematics (code generation
  CLI tool). Not used at runtime; only invoked by developers running `nest generate`.
- **Mitigation:** Dev CLI tool only. No user-controlled input reaches this code path.

### 5. qs (>=6.7.0 <=6.14.1) — Low: arrayLimit bypass DoS

- **Path:** `.>@nx/web>http-server>union>qs`
- **Why not fixed:** Transitive dependency of Nx's built-in http-server (used for
  `nx serve` in development). Not part of production deployment.
- **Mitigation:** Dev server only. Production uses NestJS with its own query parsing.

### 6. @tootallnate/once (<3.0.1) — Low: Incorrect Control Flow Scoping

- **Path:** `display>electron-builder>builder-util>http-proxy-agent>@tootallnate/once`
- **Why not fixed:** Transitive dependency of electron-builder's HTTP proxy agent.
  Build-time only.
- **Mitigation:** Only used during Electron packaging. Not shipped in production builds.

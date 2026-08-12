# Finding — realtime reads `DEVICE_JWT_SECRET` before `ConfigModule` runs

**Status: open finding. Not fixed. Deliberately NOT part of B1.**

Surfaced while tracing config-loading paths for
[B1 drift detection](2026-08-12-config-drift-detection-design.md). It is a
config-**order** defect, not a config-**drift** defect, and folding a runtime
behaviour change into a read-only detector would have been the wrong move — so it
is opened here instead.

## What was observed

`realtime/src/app/app.module.ts`:

```ts
ConfigModule.forRoot({ isGlobal: true, ... }),   // line 24
JwtModule.register({
  secret: process.env.DEVICE_JWT_SECRET,          // line 28
}),
```

`JwtModule.register(...)` receives its argument at **module-definition** time —
evaluated when the decorator metadata is constructed, as the module file is
imported. `ConfigModule.forRoot()` populates configuration during Nest's
**module-initialisation** phase, which happens afterward.

So the value captured by `JwtModule` is whatever `process.env.DEVICE_JWT_SECRET`
held *at import time*, independent of anything `ConfigModule` later loads.

## Why it has not caused an incident

On prod today the variable reaches the process through PM2 injection, so it is
already present in `process.env` before any module is imported. The eager read
gets the correct value and everything works.

## The failure mode it leaves open

If `DEVICE_JWT_SECRET` ever arrives **only via dotenv** rather than the process
environment — which is exactly the shape B1 found for `DATABASE_URL`, absent from
`/proc` and supplied by dotenv — then:

- `JwtModule` captures `undefined`
- every other consumer reading through `ConfigService` sees the correct value

The result is a **split-brain config**: device JWT signing/verification uses one
secret (or fails outright) while the rest of the service behaves normally. Whether
this throws at boot or silently mis-signs depends on `@nestjs/jwt`'s handling of an
undefined secret, which has not been verified — see below.

This is a genuine silent-failure surface: it is invisible in the healthy case and
only appears when the delivery path for one variable changes.

## Why realtime is more exposed than middleware

Per B1 §1, realtime has **no fitness validator** — no equivalent of middleware's
Zod schema that enforces `≥32`-char secrets. So a missing or empty
`DEVICE_JWT_SECRET` has nothing standing between it and module construction.

## Not yet verified

- Whether `@nestjs/jwt` throws on `secret: undefined` at register time, at sign
  time, or accepts it and produces unverifiable tokens. **This determines whether
  the failure is loud or silent**, and therefore the severity.
- Whether any other `*.register({ ... process.env ... })` call in realtime or
  middleware has the same eager-read shape. Worth a sweep, not an assumption.

## Suggested fix shape (not implemented)

Use the async factory form so the value is resolved during initialisation, from
the same `ConfigService` everything else uses:

```ts
JwtModule.registerAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    secret: config.getOrThrow<string>('DEVICE_JWT_SECRET'),
  }),
}),
```

`getOrThrow` makes the missing case fail loudly at boot rather than degrading.
Pairing the fix with a realtime fitness validator would close the underlying gap
rather than this one instance of it.

## Scope note

Any fix here changes realtime's boot behaviour and must be reviewed and deployed
on its own merits, with its own tests. B1 remains read-only and does not touch it.

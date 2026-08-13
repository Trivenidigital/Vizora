/**
 * Vizora Autonomous Operations — web build-input manifest
 *
 * Pure helpers for checking `deploy/web-build-inputs.json` against what the web
 * app actually consumes and what CI actually supplies to the build.
 *
 * ─── The failure this guards ────────────────────────────────────────────────
 *
 * `NEXT_PUBLIC_*` is not "client = build-time, server = runtime". Verified
 * against the built artifact, the rule is:
 *
 *   set at build   -> constant-folded into a literal in BOTH bundles
 *   unset at build -> left as a `process.env.X` lookup in both
 *
 * On the server that lookup reads the live process env, so a runtime value
 * appears to work. In the browser the same lookup resolves against an empty
 * `process` shim and is `undefined` permanently. So setting one of these in
 * prod `.env` and reloading PM2 changes the server and CANNOT change the
 * browser — with no error on either side.
 *
 * `ecosystem.config.js` re-injects `NEXT_PUBLIC_GOOGLE_CLIENT_ID` into the web
 * process at PM2 start for exactly that reason. It cannot work for a client
 * component. It is harmless today only because the value is empty on prod.
 *
 * Hence the invariant enforced here: anything read in the client bundle must
 * either be a declared CI build input, or be declared intentionally unset with
 * a reason. "Set it in .env later" is never a valid answer for these.
 */

/** One row of deploy/web-build-inputs.json. */
export interface BuildInputEntry {
  name: string;
  consumedInClientBundle: boolean;
  consumedOnServer: boolean;
  /** `ci` — supplied to the web build; `intentionally-unset` — deliberately absent. */
  buildInput: 'ci' | 'intentionally-unset';
  productionValue: string | null;
  defaultIfAbsent: string;
  why: string;
}

export interface BuildInputManifest {
  variables: BuildInputEntry[];
}

export interface ManifestFinding {
  variable: string;
  problem: string;
}

/** Every `NEXT_PUBLIC_*` name appearing in a blob of source. */
export function extractPublicVars(source: string): string[] {
  const found = new Set<string>();
  for (const m of source.matchAll(/NEXT_PUBLIC_[A-Z0-9_]+/g)) found.add(m[0]);
  return [...found].sort();
}

/**
 * Names supplied to the CI web build step.
 *
 * Scoped to the `Build web` step's own `env:` block — the workflow-level `env:`
 * sets localhost values for the test jobs, and counting those would report a
 * production build input that does not exist.
 */
export function extractBuildStepVars(workflowYaml: string): string[] {
  const marker = workflowYaml.indexOf('name: Build web');
  if (marker === -1) return [];
  // The step ends at its `run:` line.
  const runAt = workflowYaml.indexOf('\n        run:', marker);
  const step = workflowYaml.slice(marker, runAt === -1 ? undefined : runAt);
  return extractPublicVars(step);
}

/**
 * Names RECORDED as `KEY=value` by the build-metadata step.
 *
 * Line-anchored on purpose: the step also emits a comma-separated list of the
 * variables that are intentionally unset, and a loose scan would count those
 * as recorded values — making the provenance check pass for a variable the
 * artifact explicitly says it does not carry.
 */
export function extractMetadataVars(workflowYaml: string): string[] {
  const marker = workflowYaml.indexOf('name: Write web build metadata');
  if (marker === -1) return [];
  const end = workflowYaml.indexOf('\n      - name:', marker + 1);
  const step = workflowYaml.slice(marker, end === -1 ? undefined : end);
  const found = new Set<string>();
  for (const m of step.matchAll(/^\s*(NEXT_PUBLIC_[A-Z0-9_]+)=/gm)) found.add(m[1]!);
  return [...found].sort();
}

/**
 * Cross-check the manifest against consumption and against CI.
 *
 * `consumed` is every NEXT_PUBLIC_* found in the web sources; `buildStep` is
 * every one supplied to the CI web build; `recordedInMetadata` is every one the
 * build-metadata step writes as a `KEY=value` line.
 */
export function checkManifest(
  manifest: BuildInputManifest,
  consumed: string[],
  buildStep: string[],
  recordedInMetadata: string[],
): ManifestFinding[] {
  const findings: ManifestFinding[] = [];
  const declared = new Map(manifest.variables.map(v => [v.name, v]));
  const supplied = new Set(buildStep);
  const recorded = new Set(recordedInMetadata);

  for (const name of consumed) {
    if (!declared.has(name)) {
      findings.push({
        variable: name,
        problem:
          'consumed by the web app but absent from deploy/web-build-inputs.json — ' +
          'add it, stating whether it is a CI build input or intentionally unset',
      });
    }
  }

  // The reverse direction. Without it, adding a variable to the CI build env
  // while forgetting the manifest produced ZERO findings — the manifest would
  // quietly stop being the complete record it claims to be.
  for (const name of buildStep) {
    if (!declared.has(name)) {
      findings.push({
        variable: name,
        problem:
          'supplied to the CI web build but absent from ' +
          'deploy/web-build-inputs.json — the manifest is not the full record',
      });
    }
  }

  for (const entry of manifest.variables) {
    if (!consumed.includes(entry.name)) {
      findings.push({
        variable: entry.name,
        problem: 'declared in the manifest but no longer consumed anywhere — remove the entry',
      });
      continue;
    }

    if (!entry.why?.trim()) {
      findings.push({ variable: entry.name, problem: 'missing `why`' });
    }

    if (entry.buildInput === 'ci') {
      if (!supplied.has(entry.name)) {
        findings.push({
          variable: entry.name,
          problem:
            'declared as a CI build input but the "Build web" step does not supply it — ' +
            'a client bundle would bake in the default instead',
        });
      }
      if (!recorded.has(entry.name)) {
        findings.push({
          variable: entry.name,
          problem:
            'declared as a CI build input but not recorded in build-metadata.env — ' +
            'the artifact would carry no provenance for it',
        });
      }
    } else {
      if (supplied.has(entry.name)) {
        findings.push({
          variable: entry.name,
          problem:
            'declared intentionally unset but the "Build web" step supplies it — ' +
            'the manifest and the build disagree',
        });
      }
      if (entry.productionValue !== null) {
        findings.push({
          variable: entry.name,
          problem: 'declared intentionally unset but carries a productionValue',
        });
      }
    }

    // The whole point: a value the browser reads cannot be introduced later via
    // prod .env, so it must be resolved at build time one way or the other.
    if (entry.consumedInClientBundle && entry.buildInput !== 'ci' && entry.productionValue) {
      findings.push({
        variable: entry.name,
        problem:
          'has a production value and is read in the browser, but is not a CI build ' +
          'input — that value can never reach the client bundle',
      });
    }
  }

  return findings;
}

/**
 * Every `experimental` key in next.config.js must exist in the INSTALLED Next.
 *
 * An unrecognised key is silently inert: Next's schema is a zod `strictObject`,
 * so it logs "Unrecognized key(s)" once at startup and drops the value. The
 * config keeps asserting a behaviour that nothing implements. That is how
 * `experimental.turbopackUseSystemTlsCerts` survived — added in a large
 * unrelated commit (713784f0) with no stated rationale, and never present in
 * any Next this repo has installed.
 *
 * ─── Two things this file gets right on purpose ─────────────────────────────
 *
 * 1. The authority is Next's EXPORTED `experimentalSchema`, not a grep of the
 *    schema source. Grepping matched any key defined anywhere in that file,
 *    including ~30 keys that are valid only at TOP level — so putting
 *    `turbopack: {}` (a real key, but not an experimental one) under
 *    `experimental` would have passed while Next ignored it. "Key graduated
 *    out of experimental" is the single most likely future instance of this
 *    exact bug.
 *
 * 2. The parser FAILS CLOSED. next.config.js composes Nx plugins at module
 *    scope, so it is read as text rather than required; a text parser that
 *    quietly mis-parses would make the check vacuous instead of loud. Anything
 *    it cannot represent exactly — a spread, a computed key, a quoted key, a
 *    shorthand key — throws rather than being omitted from the key set.
 */

const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const { experimentalSchema } = require('next/dist/server/config-schema');

/** Locate the single `experimental: {` block, ignoring depth-0 noise. */
function experimentalBody(source) {
  const anchors = [...source.matchAll(/^[ \t]*experimental:[ \t]*\{/gm)];
  if (anchors.length !== 1) {
    throw new Error(`expected exactly one experimental block, found ${anchors.length}`);
  }
  const open = source.indexOf('{', anchors[0].index);

  let depth = 0;
  for (let i = open; i < source.length; i++) {
    const ch = source[i];
    const pair = source.slice(i, i + 2);
    if (pair === '//') {
      i = source.indexOf('\n', i);
      if (i === -1) break;
      continue;
    }
    if (pair === '/*') {
      const end = source.indexOf('*/', i + 2);
      if (end === -1) break;
      i = end + 1;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      for (i++; i < source.length; i++) {
        if (source[i] === '\\') i++;
        else if (source[i] === ch) break;
      }
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  throw new Error('unterminated experimental block');
}

/** Top-level keys of the experimental object. Throws on anything ambiguous. */
function experimentalKeys(source) {
  const body = experimentalBody(source);
  const keys = [];
  let depth = 0;
  let expectKey = true;

  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    const pair = body.slice(i, i + 2);

    if (pair === '//') {
      i = body.indexOf('\n', i);
      if (i === -1) break;
      continue;
    }
    if (pair === '/*') {
      const end = body.indexOf('*/', i + 2);
      if (end === -1) break;
      i = end + 1;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      if (depth === 0 && expectKey) {
        throw new Error(`quoted key at top level of experimental: ${body.slice(i, i + 40)}`);
      }
      for (i++; i < body.length; i++) {
        if (body[i] === '\\') i++;
        else if (body[i] === ch) break;
      }
      continue;
    }
    if (ch === '{' || ch === '[' || ch === '(') {
      if (depth === 0 && expectKey && ch === '[') {
        throw new Error(`computed key at top level of experimental: ${body.slice(i, i + 40)}`);
      }
      depth++;
      continue;
    }
    if (ch === '}' || ch === ']' || ch === ')') {
      depth--;
      continue;
    }
    if (depth === 0 && ch === ',') {
      expectKey = true;
      continue;
    }
    if (/\s/.test(ch)) continue;
    if (depth !== 0) continue;

    if (expectKey) {
      if (body.startsWith('...', i)) {
        throw new Error(`spread at top level of experimental: ${body.slice(i, i + 40)}`);
      }
      const m = /^([A-Za-z_$][\w$]*)\s*:/.exec(body.slice(i));
      if (!m) {
        throw new Error(`unparsable entry in experimental: ${body.slice(i, i + 40)}`);
      }
      keys.push(m[1]);
      i += m[0].length - 1;
      expectKey = false;
    }
  }
  return keys;
}

describe('next.config experimental keys', () => {
  const configSource = readFileSync(join(__dirname, 'next.config.js'), 'utf8');
  const known = new Set(Object.keys(experimentalSchema.shape ?? experimentalSchema));

  it('reads the real experimental keys, not the outer config object', () => {
    // Guards the parser itself. An earlier version anchored on a bare
    // indexOf('experimental:'), which could latch onto a comment and then walk
    // the OUTER config object — returning `typescript`, `images`, `webpack`…
    // all of which are real Next keys, so the check passed while inspecting
    // entirely the wrong object.
    const keys = experimentalKeys(configSource);
    assertDeep(keys, ['serverActions']);
  });

  it.each([
    ['spread', '    ...(cond ? { turbopackUseSystemTlsCerts: true } : {}),\n'],
    ['quoted key', "    'turbopackUseSystemTlsCerts': true,\n"],
    ['computed key', '    [dyn]: true,\n'],
    ['shorthand key', '    someValue,\n'],
  ])('fails closed on a %s rather than silently ignoring it', (_label, injected) => {
    // Each of these previously produced a key set that simply omitted the
    // entry — a silent PASS while an unrecognised key sat in the config.
    const mutated = configSource.replace('    serverActions: {', injected + '    serverActions: {');
    expect(() => experimentalKeys(mutated)).toThrow();
  });

  it('every experimental key is recognised by the installed Next', () => {
    const keys = experimentalKeys(configSource);
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.filter(k => !known.has(k))).toEqual([]);
  });

  it('rejects a real Next key that is NOT an experimental one', () => {
    // `turbopack` is a genuine top-level Next option. Under `experimental` it
    // is ignored. The previous grep-the-schema-source check passed this.
    expect(known.has('turbopack')).toBe(false);
    expect(known.has('turbopackMinify')).toBe(true);
  });

  it('turbopackUseSystemTlsCerts is gone and does not come back', () => {
    // Never existed in Next. The supported way to trust extra CAs is Node's
    // NODE_EXTRA_CA_CERTS env var — deliberately NOT set here, because nothing
    // demonstrated a TLS problem this was solving.
    expect(configSource).not.toMatch(/turbopackUseSystemTlsCerts/);
    expect(known.has('turbopackUseSystemTlsCerts')).toBe(false);
  });
});

function assertDeep(actual, expected) {
  expect(actual).toEqual(expected);
}

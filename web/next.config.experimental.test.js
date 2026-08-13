/**
 * Every `experimental` key in next.config.js must exist in the INSTALLED Next.
 *
 * An unrecognised key is silently inert: Next warns once at startup and ignores
 * it, so the config keeps asserting a behaviour that nothing implements. That is
 * how `experimental.turbopackUseSystemTlsCerts` survived — it was added in a
 * large unrelated commit (713784f0) with no stated rationale and never existed
 * in any Next this repo has installed.
 *
 * The check is against the installed package rather than a hardcoded list, so a
 * Next upgrade that renames or drops a key fails here instead of going quiet.
 *
 * next.config.js composes Nx plugins at module scope, so it is read as text
 * rather than required — the test must not depend on a full Next/Nx load.
 */

const { readFileSync } = require('node:fs');
const { join } = require('node:path');

/**
 * Top-level keys of the `experimental` object literal, ignoring nested ones.
 *
 * Single pass that tracks string and comment state, so a `//` inside a URL or a
 * `{` inside a comment cannot shift the brace depth. An earlier version keyed
 * off the preceding character and silently returned ZERO keys once a comment
 * was added above the first key — a parser that finds nothing would make the
 * check below vacuously pass, which is why the parser has its own test.
 */
function experimentalKeys(source) {
  const start = source.indexOf('experimental:');
  if (start === -1) return [];
  const open = source.indexOf('{', start);
  if (open === -1) return [];

  const keys = [];
  let depth = 0;
  let expectKey = false; // true at a position where a key may begin

  for (let i = open; i < source.length; i++) {
    const ch = source[i];
    const next2 = source.slice(i, i + 2);

    if (next2 === '//') {
      i = source.indexOf('\n', i);
      if (i === -1) break;
      continue;
    }
    if (next2 === '/*') {
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

    if (ch === '{') {
      depth++;
      expectKey = depth === 1;
      continue;
    }
    if (ch === '}') {
      depth--;
      if (depth === 0) break;
      continue;
    }
    if (ch === ',') {
      expectKey = depth === 1;
      continue;
    }
    if (/\s/.test(ch)) continue;

    if (depth === 1 && expectKey) {
      const m = /^([A-Za-z_$][\w$]*)\s*:/.exec(source.slice(i));
      if (m) {
        keys.push(m[1]);
        i += m[0].length - 1;
      }
      expectKey = false;
      continue;
    }
    expectKey = false;
  }
  return keys;
}

describe('next.config experimental keys', () => {
  const configSource = readFileSync(join(__dirname, 'next.config.js'), 'utf8');
  const schemaSource = readFileSync(
    require.resolve('next/dist/server/config-schema.js'),
    'utf8',
  );

  it('parses only top-level experimental keys, not nested ones', () => {
    // Guards the parser itself: serverActions.allowedOrigins must not be
    // mistaken for an experimental key, or the check below means nothing.
    const keys = experimentalKeys(configSource);
    expect(keys).toContain('serverActions');
    expect(keys).not.toContain('allowedOrigins');
  });

  it('every experimental key is recognised by the installed Next', () => {
    const keys = experimentalKeys(configSource);
    expect(keys.length).toBeGreaterThan(0);

    const unknown = keys.filter(
      k => !new RegExp(`["']${k}["']|[^A-Za-z0-9_$]${k}\\s*:`).test(schemaSource),
    );
    expect(unknown).toEqual([]);
  });

  it('turbopackUseSystemTlsCerts is gone and does not come back', () => {
    // Never existed in Next. The supported way to trust extra CAs is Node's
    // NODE_EXTRA_CA_CERTS env var — deliberately NOT set here, because nothing
    // demonstrated a TLS problem this was solving.
    expect(configSource).not.toMatch(/turbopackUseSystemTlsCerts/);
    expect(schemaSource).not.toMatch(/turbopackUseSystemTlsCerts/);
  });
});

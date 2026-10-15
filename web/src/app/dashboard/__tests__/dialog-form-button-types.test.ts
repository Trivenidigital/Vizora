import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Inside a <form>, a <button> with no `type` IS a submit button. Dashboard
 * dialogs are forms (so Enter submits them), and Enter in a text field clicks
 * the form's FIRST submit button in document order — so one untyped Cancel,
 * day chip or time-picker toggle ahead of the primary action silently turns
 * Enter into "cancel" or "toggle Monday". Nothing visual changes, so review
 * does not catch it.
 *
 * Scope is deliberately narrower than "every button in a dialog file": a
 * button outside any form has no submit semantics, and forcing a type onto the
 * hundreds of page-level buttons would be churn with no behavioural content.
 * Instead this checks:
 *   1. every <button> lexically inside a <form>…</form> in app/dashboard and
 *      components, and
 *   2. every <button> in the child components that are RENDERED inside a
 *      dialog form but defined elsewhere, where (1) cannot see them.
 */

const WEB_ROOT = process.cwd();
const SCAN_ROOTS = ['src/app/dashboard', 'src/components'];

/**
 * Rendered inside a dialog form, defined outside it. `from` narrows a file to
 * the part that is rendered inside the form.
 */
const RENDERED_INSIDE_DIALOG_FORMS: { file: string; from?: string }[] = [
  { file: 'src/components/DaySelector.tsx' }, // schedules create/edit
  { file: 'src/components/TimePicker.tsx' }, // schedules create/edit
  { file: 'src/components/content/ContentLifecyclePanel.tsx' }, // content edit
  { file: 'src/components/Modal.tsx' }, // dialog shell
  { file: 'src/components/ConfirmDialog.tsx' }, // dialog shell
  // The recipient editors are rendered inside the alert-rule form.
  { file: 'src/app/dashboard/settings/alerts/page.tsx', from: 'function DraftRecipientsEditor(' },
];

/** Blank out comments, keeping offsets, so `<form>` in prose is not a form. */
function maskComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/^([ \t]*)\/\/.*$/gm, (m, ws: string) => ws + ' '.repeat(m.length - ws.length));
}

/** Offset of the `>` closing the opening tag that starts at `start`. */
function openingTagEnd(src: string, start: number): number {
  let depth = 0;
  let quote: string | null = null;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') quote = c;
    else if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '>' && depth === 0) return i;
  }
  return src.length;
}

/** True when the tag has a top-level `type=` attribute (not one inside `{}`). */
function hasTypeAttribute(src: string, start: number, end: number): boolean {
  let depth = 0;
  let quote: string | null = null;
  for (let i = start; i < end; i++) {
    const c = src[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') quote = c;
    else if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (depth === 0 && /\s/.test(src[i - 1]) && src.startsWith('type=', i)) return true;
  }
  return false;
}

function formSpans(masked: string): [number, number][] {
  const spans: [number, number][] = [];
  const re = /<form[\s>]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(masked))) {
    const close = masked.indexOf('</form>', m.index);
    const end = close === -1 ? masked.length : close;
    spans.push([m.index, end]);
    re.lastIndex = end;
  }
  return spans;
}

/** Line numbers of untyped <button> tags whose start falls inside `spans`. */
function untypedButtons(src: string, spans: [number, number][]): number[] {
  const masked = maskComments(src);
  const lines: number[] = [];
  const re = /<button(?=[\s>])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(masked))) {
    const at = m.index;
    if (!spans.some(([a, b]) => at >= a && at < b)) continue;
    const end = openingTagEnd(masked, at + '<button'.length);
    if (!hasTypeAttribute(masked, at + '<button'.length, end)) {
      lines.push(masked.slice(0, at).split('\n').length);
    }
  }
  return lines;
}

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : tsxFiles(path);
    return /\.tsx$/.test(name) && !/\.test\.tsx$/.test(name) ? [path] : [];
  });
}

describe('dialog form button types', () => {
  describe('the scanner (controls)', () => {
    it('flags an untyped button inside a form, single- or multi-line', () => {
      const src = [
        '<form onSubmit={save}>',
        '  <button onClick={cancel}>Cancel</button>',
        '  <button',
        '    onClick={() => pick({ type: "x" })}',
        '  >Pick</button>',
        '  <button type="submit">Save</button>',
        '</form>',
      ].join('\n');
      expect(untypedButtons(src, formSpans(maskComments(src)))).toEqual([2, 3]);
    });

    it('ignores buttons outside forms and forms that only appear in comments', () => {
      const src = [
        '{/* not a real <form> */}',
        '<button onClick={open}>Open</button>',
        '<form>',
        '  <button type="button" onClick={cancel}>Cancel</button>',
        '</form>',
        '<button onClick={other}>Other</button>',
      ].join('\n');
      expect(untypedButtons(src, formSpans(maskComments(src)))).toEqual([]);
    });
  });

  it('gives every button inside a dashboard/component <form> an explicit type', () => {
    const offenders: string[] = [];
    let formCount = 0;
    for (const root of SCAN_ROOTS) {
      for (const file of tsxFiles(join(WEB_ROOT, root))) {
        const src = readFileSync(file, 'utf8');
        const spans = formSpans(maskComments(src));
        formCount += spans.length;
        for (const line of untypedButtons(src, spans)) {
          offenders.push(`${relative(WEB_ROOT, file)}:${line}`);
        }
      }
    }
    // Reach check: a scan that finds no forms passes vacuously.
    expect(formCount).toBeGreaterThanOrEqual(25);
    expect(offenders).toEqual([]);
  });

  it.each(RENDERED_INSIDE_DIALOG_FORMS)('gives every button in $file an explicit type', ({ file, from }) => {
    const src = readFileSync(join(WEB_ROOT, file), 'utf8');
    const start = from ? src.indexOf(from) : 0;
    expect(start).toBeGreaterThanOrEqual(0);
    const lines = untypedButtons(src, [[start, src.length]]);
    expect(lines.map((line) => `${file}:${line}`)).toEqual([]);
    // Reach check: the region must actually contain buttons to be evidence.
    expect(maskComments(src.slice(start)).match(/<button(?=[\s>])/g)?.length ?? 0).toBeGreaterThan(0);
  });
});

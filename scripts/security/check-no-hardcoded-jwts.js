#!/usr/bin/env node

const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { extname } = require('node:path');

const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g;
const SKIPPED_EXTENSIONS = new Set([
  '.avif',
  '.gif',
  '.ico',
  '.jpeg',
  '.jpg',
  '.mov',
  '.mp4',
  '.pdf',
  '.png',
  '.webp',
  '.zip',
]);

const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'buffer' })
  .toString('utf8')
  .split('\0')
  .filter(Boolean);

const findings = [];

for (const file of files) {
  if (SKIPPED_EXTENSIONS.has(extname(file).toLowerCase())) {
    continue;
  }

  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue;
  }

  if (text.includes('\0')) {
    continue;
  }

  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    const matches = line.match(JWT_PATTERN);
    if (!matches) return;

    findings.push({
      file,
      line: index + 1,
      count: matches.length,
    });
  });
}

if (findings.length > 0) {
  console.error('Hardcoded JWT-looking tokens found. Use env vars or generated test fixtures instead.');
  for (const finding of findings) {
    console.error(`${finding.file}:${finding.line} (${finding.count})`);
  }
  process.exit(1);
}

console.log('No hardcoded JWT-looking tokens found.');

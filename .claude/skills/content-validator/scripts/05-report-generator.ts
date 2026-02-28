#!/usr/bin/env npx tsx
/**
 * 05 — Report Generator
 *
 * Aggregates validation results from all categories and produces a
 * human-readable markdown deployment readiness report.
 *
 * Usage:
 *   npx tsx 05-report-generator.ts --input content.json --input display.json --input schedule.json
 *   cat results.json | npx tsx 05-report-generator.ts
 *
 * Exit: 0 = READY, 1 = NOT READY, 2 = error
 */

import { readFileSync } from 'node:fs';
import { parseArgs, outputJson, fail, type ValidationResult, type ValidationIssue, type Severity } from './lib.js';

interface AggregatedReport {
  readiness: 'READY' | 'DEGRADED' | 'NOT READY';
  timestamp: string;
  summary: {
    totalIssues: number;
    critical: number;
    warning: number;
    info: number;
    categoriesChecked: string[];
    totalDurationMs: number;
  };
  categories: ValidationResult[];
  markdown: string;
}

async function main() {
  const args = parseArgs();
  const results: ValidationResult[] = [];

  // Read from input files
  if (args.inputFiles.length > 0) {
    for (const file of args.inputFiles) {
      try {
        const data = JSON.parse(readFileSync(file, 'utf-8'));
        if (Array.isArray(data)) {
          results.push(...data);
        } else {
          results.push(data);
        }
      } catch (err) {
        fail(`Failed to read input file "${file}": ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  // Read from stdin if no files provided
  if (results.length === 0) {
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of process.stdin) {
        chunks.push(chunk as Buffer);
      }
      const stdinData = Buffer.concat(chunks).toString('utf-8').trim();
      if (stdinData) {
        const data = JSON.parse(stdinData);
        if (Array.isArray(data)) {
          results.push(...data);
        } else {
          results.push(data);
        }
      }
    } catch {
      // No stdin data
    }
  }

  if (results.length === 0) {
    fail('No validation results provided. Use --input <file> or pipe JSON to stdin.');
  }

  // Aggregate
  const allIssues = results.flatMap((r) => r.issues);
  const critical = allIssues.filter((i) => i.severity === 'critical').length;
  const warning = allIssues.filter((i) => i.severity === 'warning').length;
  const info = allIssues.filter((i) => i.severity === 'info').length;

  let readiness: AggregatedReport['readiness'];
  if (critical > 0) {
    readiness = 'NOT READY';
  } else if (warning > 0) {
    readiness = 'DEGRADED';
  } else {
    readiness = 'READY';
  }

  const markdown = generateMarkdown(readiness, results, allIssues, { critical, warning, info });

  const report: AggregatedReport = {
    readiness,
    timestamp: new Date().toISOString(),
    summary: {
      totalIssues: allIssues.length,
      critical,
      warning,
      info,
      categoriesChecked: results.map((r) => r.category),
      totalDurationMs: results.reduce((sum, r) => sum + r.durationMs, 0),
    },
    categories: results,
    markdown,
  };

  outputJson(report);
  process.exit(readiness === 'NOT READY' ? 1 : 0);
}

function generateMarkdown(
  readiness: string,
  results: ValidationResult[],
  allIssues: ValidationIssue[],
  counts: { critical: number; warning: number; info: number },
): string {
  const lines: string[] = [];
  const icon = readiness === 'READY' ? '[PASS]' : readiness === 'DEGRADED' ? '[WARN]' : '[FAIL]';

  lines.push(`# Vizora Deployment Readiness Report`);
  lines.push('');
  lines.push(`**Status: ${icon} ${readiness}**`);
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');

  // Summary table
  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Count |');
  lines.push('|--------|-------|');
  lines.push(`| Critical issues | ${counts.critical} |`);
  lines.push(`| Warnings | ${counts.warning} |`);
  lines.push(`| Info | ${counts.info} |`);
  lines.push(`| Categories checked | ${results.length} |`);
  lines.push(`| Total scan time | ${results.reduce((s, r) => s + r.durationMs, 0)}ms |`);
  lines.push('');

  // Per-category breakdown
  for (const result of results) {
    const catIssues = result.issues;
    if (catIssues.length === 0) {
      lines.push(`## ${capitalize(result.category)} — No issues found`);
      lines.push('');
      continue;
    }

    lines.push(`## ${capitalize(result.category)} (${catIssues.length} issues)`);
    lines.push('');

    // Group by severity
    for (const severity of ['critical', 'warning', 'info'] as Severity[]) {
      const sevIssues = catIssues.filter((i) => i.severity === severity);
      if (sevIssues.length === 0) continue;

      const sevIcon = severity === 'critical' ? '[!]' : severity === 'warning' ? '[~]' : '[i]';
      lines.push(`### ${sevIcon} ${capitalize(severity)} (${sevIssues.length})`);
      lines.push('');

      for (const issue of sevIssues) {
        lines.push(`- **${issue.rule}**: ${issue.message}`);
        lines.push(`  - Entity: ${issue.entityName} (\`${issue.entityId}\`)`);
        lines.push(`  - Fix: ${issue.recommendation}`);
      }
      lines.push('');
    }

    // Stats
    if (Object.keys(result.stats).length > 0) {
      lines.push('**Stats:**');
      for (const [k, v] of Object.entries(result.stats)) {
        lines.push(`- ${k}: ${v}`);
      }
      lines.push('');
    }
  }

  // Readiness decision
  lines.push('## Readiness Decision');
  lines.push('');
  if (readiness === 'READY') {
    lines.push('All checks passed. Content is ready for deployment to customer displays.');
  } else if (readiness === 'DEGRADED') {
    lines.push('No critical issues found, but warnings should be reviewed before deployment.');
    lines.push('Content will work but may have suboptimal behavior on some displays.');
  } else {
    lines.push('**Critical issues must be resolved before deployment.**');
    lines.push('');
    lines.push('Critical issues to fix:');
    const criticals = allIssues.filter((i) => i.severity === 'critical');
    for (const issue of criticals) {
      lines.push(`1. **${issue.rule}**: ${issue.message} — ${issue.recommendation}`);
    }
  }
  lines.push('');

  return lines.join('\n');
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

main().catch((err) => fail(err.message));

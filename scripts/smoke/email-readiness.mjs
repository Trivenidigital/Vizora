#!/usr/bin/env node
import 'dotenv/config';
import { pathToFileURL } from 'node:url';

function parseArgs(args) {
  const parsed = {
    production: false,
    verifySmtp: false,
    send: false,
    to: null,
    json: false,
    help: false,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--production') {
      parsed.production = true;
    } else if (arg === '--verify-smtp') {
      parsed.verifySmtp = true;
    } else if (arg === '--send') {
      parsed.send = true;
    } else if (arg === '--json') {
      parsed.json = true;
    } else if (arg === '--help' || arg === '-h') {
      parsed.help = true;
    } else if (arg === '--') {
      continue;
    } else if (arg === '--to') {
      parsed.to = args[i + 1] ?? null;
      i += 1;
    } else if (arg.startsWith('--to=')) {
      parsed.to = arg.slice('--to='.length);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return parsed;
}

function isLocalUrl(value) {
  try {
    const url = new URL(value);
    return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname);
  } catch {
    return false;
  }
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function hasValue(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function usesVerifiedSenderDomain(value) {
  return /@mail\.vizora\.cloud(?:[>\s]|$)/i.test(value);
}

export function buildEmailReadinessPlan({ env, args }) {
  let parsed;
  const errors = [];
  const warnings = [];

  try {
    parsed = parseArgs(args);
  } catch (error) {
    return {
      ok: false,
      mode: 'check',
      errors: [error instanceof Error ? error.message : String(error)],
      warnings,
      shouldSend: false,
      shouldVerifySmtp: false,
      to: null,
      config: {},
    };
  }

  const production = parsed.production || env.NODE_ENV === 'production';
  const smtpPass = env.SMTP_PASS || env.SMTP_PASSWORD;
  const appUrl = env.APP_URL || env.WEB_URL;
  const to = parsed.to || env.SMTP_TO || null;
  const mode = parsed.send ? 'send' : parsed.verifySmtp ? 'verify-smtp' : 'check';

  const required = [
    ['SMTP_HOST', env.SMTP_HOST],
    ['SMTP_PORT', env.SMTP_PORT],
    ['SMTP_USER', env.SMTP_USER],
    ['SMTP_PASS', smtpPass],
    ['EMAIL_FROM', env.EMAIL_FROM],
    ['APP_URL or WEB_URL', appUrl],
  ];

  for (const [name, value] of required) {
    if (!hasValue(value)) {
      errors.push(`${name} is required`);
    }
  }

  const port = Number(env.SMTP_PORT);
  if (hasValue(env.SMTP_PORT) && (!Number.isInteger(port) || port < 1 || port > 65535)) {
    errors.push('SMTP_PORT must be an integer between 1 and 65535');
  }

  if (hasValue(appUrl)) {
    try {
      const parsedUrl = new URL(appUrl);
      if (production && parsedUrl.protocol !== 'https:') {
        errors.push('APP_URL or WEB_URL must use https in production');
      }
    } catch {
      errors.push('APP_URL or WEB_URL must be a valid URL');
    }

    if (production && isLocalUrl(appUrl)) {
      errors.push('APP_URL or WEB_URL must not point at localhost in production');
    }
  }

  if (hasValue(env.EMAIL_FROM) && !usesVerifiedSenderDomain(env.EMAIL_FROM)) {
    warnings.push('EMAIL_FROM should use the verified mail.vizora.cloud domain');
  }

  if (parsed.verifySmtp && env.EMAIL_READINESS_ALLOW_NETWORK !== 'true') {
    errors.push('Set EMAIL_READINESS_ALLOW_NETWORK=true to run SMTP network verify');
  }

  if (parsed.send) {
    if (env.EMAIL_READINESS_ALLOW_SEND !== 'true') {
      errors.push('Set EMAIL_READINESS_ALLOW_SEND=true to send a readiness test email');
    }
    if (!hasValue(to)) {
      errors.push('A test recipient is required via --to or SMTP_TO');
    } else if (!isValidEmail(to)) {
      errors.push('Test recipient must be a valid email address');
    }
  }

  const ok = errors.length === 0;

  return {
    ok,
    mode,
    errors,
    warnings,
    shouldSend: ok && mode === 'send',
    shouldVerifySmtp: ok && mode === 'verify-smtp',
    to,
    json: parsed.json,
    config: {
      production,
      smtpHost: env.SMTP_HOST ?? null,
      smtpPort: hasValue(env.SMTP_PORT) ? port : null,
      smtpUser: env.SMTP_USER ?? null,
      emailFrom: env.EMAIL_FROM ?? null,
      appUrl: appUrl ?? null,
      usesLegacySmtpPassword: !env.SMTP_PASS && hasValue(env.SMTP_PASSWORD),
    },
  };
}

function makeTransportConfig(env) {
  const port = Number(env.SMTP_PORT);
  return {
    host: env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS || env.SMTP_PASSWORD,
    },
  };
}

async function verifySmtp(env) {
  const nodemailer = await import('nodemailer');
  const transporter = nodemailer.default.createTransport(makeTransportConfig(env));
  await transporter.verify();
}

async function sendReadinessEmail(env, plan) {
  const nodemailer = await import('nodemailer');
  const transporter = nodemailer.default.createTransport(makeTransportConfig(env));
  const appUrl = plan.config.appUrl;
  await transporter.sendMail({
    from: env.EMAIL_FROM,
    to: plan.to,
    subject: 'Vizora email readiness test',
    text: [
      'Vizora email readiness test.',
      '',
      `Public app URL: ${appUrl}`,
      'If you received this message, SMTP authentication and delivery are working for this recipient.',
    ].join('\n'),
    html: [
      '<p>Vizora email readiness test.</p>',
      `<p><strong>Public app URL:</strong> ${appUrl}</p>`,
      '<p>If you received this message, SMTP authentication and delivery are working for this recipient.</p>',
    ].join(''),
  });
}

function printHelp() {
  console.log(`Usage: node scripts/smoke/email-readiness.mjs [options]

Options:
  --production       Enforce production URL checks even when NODE_ENV is not production
  --verify-smtp      Verify SMTP credentials with nodemailer.verify()
                     Requires EMAIL_READINESS_ALLOW_NETWORK=true
  --send             Send one neutral readiness email
                     Requires EMAIL_READINESS_ALLOW_SEND=true and --to or SMTP_TO
  --to <email>       Recipient for --send
  --json             Print JSON result

Default mode performs offline env validation only. It does not contact SMTP and does not send email.`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    return;
  }

  const plan = buildEmailReadinessPlan({ env: process.env, args });

  if (plan.config.usesLegacySmtpPassword) {
    plan.warnings.push('Using legacy SMTP_PASSWORD alias; prefer SMTP_PASS');
  }

  if (plan.json) {
    console.log(JSON.stringify(plan, null, 2));
  } else {
    console.log(`[email-readiness] mode=${plan.mode}`);
    for (const warning of plan.warnings) {
      console.warn(`[email-readiness] warning: ${warning}`);
    }
    for (const error of plan.errors) {
      console.error(`[email-readiness] error: ${error}`);
    }
  }

  if (!plan.ok) {
    process.exitCode = 1;
    return;
  }

  if (plan.shouldVerifySmtp) {
    await verifySmtp(process.env);
    console.log('[email-readiness] SMTP verify succeeded');
  } else if (plan.shouldSend) {
    await sendReadinessEmail(process.env, plan);
    console.log(`[email-readiness] test email sent to ${plan.to}`);
  } else {
    console.log('[email-readiness] offline config check passed; no SMTP connection and no email sent');
  }
}

const directRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (directRun) {
  main().catch((error) => {
    console.error(`[email-readiness] fatal: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}

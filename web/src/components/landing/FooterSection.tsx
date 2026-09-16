'use client';

import Link from 'next/link';
import { anchorProps } from './shared';

const PRODUCT_LINKS = [
  { id: 'places', label: 'Places' },
  { id: 'how-it-works', label: 'How it works' },
  { id: 'product', label: 'The workspace' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'faq', label: 'FAQ' },
];

const ACCOUNT_LINKS = [
  { href: '/login', label: 'Sign in' },
  { href: '/register', label: 'Create a workspace' },
  { href: '/dashboard', label: 'Dashboard' },
];

const LEGAL_LINKS = [
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/terms', label: 'Terms of Service' },
  { href: '/refund', label: 'Refund Policy' },
  { href: '/sla', label: 'SLA' },
];

const CSS = `
.lw-foot{border-top:1px solid var(--lw-hair);background:var(--lw-paper-2);padding:52px 0 34px}
.lwt-grid{display:grid;grid-template-columns:1.6fr 1fr 1fr 1fr;gap:34px;margin-bottom:40px}
.lwt-word{font-family:var(--lw-serif);font-size:1.4rem;font-weight:500;color:var(--lw-forest);
  text-transform:lowercase;letter-spacing:-.01em}
.lwt-tag{color:var(--lw-ink-2);font-size:.9rem;line-height:1.6;margin:10px 0 14px;max-width:22rem}
.lwt-h{font-family:var(--font-mono),monospace;font-size:.62rem;letter-spacing:.16em;
  text-transform:uppercase;color:var(--lw-muted);margin-bottom:14px}
.lwt-col ul{display:flex;flex-direction:column;gap:9px}
.lwt-col a{font-size:.88rem}
.lwt-base{border-top:1px solid var(--lw-hair-2);padding-top:22px;display:flex;flex-wrap:wrap;
  gap:10px;justify-content:space-between;color:var(--lw-muted);font-size:.76rem}
@media (max-width:820px){.lwt-grid{grid-template-columns:1fr 1fr}}
@media (max-width:480px){.lwt-grid{grid-template-columns:1fr}}
`;

export default function FooterSection() {
  return (
    <footer className="lw-foot">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="lw-wrap">
        <div className="lwt-grid">
          <div>
            <Link href="/" className="lwt-word">
              vizora
            </Link>
            <p className="lwt-tag">
              Digital signage for the places you run. Create the content, schedule the day, and
              every screen stays in sync.
            </p>
            <a href="mailto:support@vizora.cloud" className="lw-link text-sm">
              support@vizora.cloud
            </a>
          </div>

          <div className="lwt-col">
            <h4 className="lwt-h">Product</h4>
            <ul>
              {PRODUCT_LINKS.map((item) => (
                <li key={item.id}>
                  <a {...anchorProps(item.id)} className="lw-link">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="lwt-col">
            <h4 className="lwt-h">Account</h4>
            <ul>
              {ACCOUNT_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="lw-link">
                    {l.label}
                  </Link>
                </li>
              ))}
              <li>
                <a href="mailto:sales@vizora.cloud" className="lw-link">
                  Contact sales
                </a>
              </li>
            </ul>
          </div>

          <div className="lwt-col">
            <h4 className="lwt-h">Legal</h4>
            <ul>
              {LEGAL_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="lw-link">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="lwt-base">
          <span>© {new Date().getFullYear()} Vizora. All rights reserved.</span>
          <span>Different places. One rhythm.</span>
        </div>
      </div>
    </footer>
  );
}

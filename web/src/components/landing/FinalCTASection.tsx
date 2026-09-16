'use client';

import Link from 'next/link';

const CSS = `
.lw-final{padding:clamp(48px,6vw,90px) 0 clamp(56px,7vw,104px)}
.lwf-panel{background:linear-gradient(160deg,var(--lw-forest) 0%,var(--lw-forest-deep) 100%);
  border-radius:26px;padding:clamp(40px,6vw,84px) clamp(24px,5vw,72px);text-align:center;
  color:var(--lw-on-forest);position:relative;overflow:hidden;
  box-shadow:0 34px 70px rgba(20,44,32,.32)}
.lwf-panel::after{content:'';position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(60% 90% at 50% 0%,rgba(242,239,228,.1),transparent 60%)}
.lwf-panel h2{font-family:var(--lw-serif);font-weight:480;letter-spacing:-.015em;
  font-size:clamp(2rem,4vw,3.2rem);color:var(--lw-on-forest);margin-bottom:14px;position:relative}
.lwf-panel p{max-width:34rem;margin:0 auto 28px;line-height:1.65;color:rgba(242,239,228,.82);position:relative}
.lwf-cta{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;position:relative}
.lwf-btn-ivory{background:var(--lw-paper);color:var(--lw-forest);box-shadow:0 12px 30px rgba(0,0,0,.25)}
.lwf-btn-ivory:hover{background:#fffdf4}
.lwf-btn-line{border:1px solid rgba(242,239,228,.4);color:var(--lw-on-forest)}
.lwf-btn-line:hover{border-color:rgba(242,239,228,.75);background:rgba(242,239,228,.08)}
.lwf-trust{margin-top:18px;font-size:.8rem;color:rgba(242,239,228,.62);position:relative}
`;

export default function FinalCTASection() {
  return (
    <section id="start" className="lw-final scroll-mt-20" aria-labelledby="finalCtaTitle">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="lw-wrap">
        <div className="lwf-panel">
          <h2 id="finalCtaTitle">Start with your screens.</h2>
          <p>
            Create a workspace, pair your first screen with the code it shows, and put something
            real on it — the whole first run takes about five minutes.
          </p>
          <div className="lwf-cta">
            <Link href="/register" className="lw-btn lwf-btn-ivory">
              Start free
              <span aria-hidden="true" style={{ opacity: 0.6 }}>
                →
              </span>
            </Link>
            <a href="mailto:sales@vizora.cloud" className="lw-btn lwf-btn-line">
              Talk to us
            </a>
          </div>
          <p className="lwf-trust">30-day free trial · up to 5 screens · no credit card required</p>
        </div>
      </div>
    </section>
  );
}

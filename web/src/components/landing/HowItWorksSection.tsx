'use client';

import { Reveal } from './shared';

const LAYERS = [
  {
    n: 1,
    color: 'var(--mkt-cyan)',
    label: 'Layer 01',
    name: 'Base playlist',
    desc: 'The default rotation a screen falls back to, always.',
  },
  {
    n: 2,
    color: 'var(--mkt-violet)',
    label: 'Layer 02',
    name: 'Daypart schedule',
    desc: 'Breakfast boards at seven, happy hour at five — per location.',
  },
  {
    n: 3,
    color: 'var(--mkt-mint)',
    label: 'Layer 03',
    name: 'Live data widget',
    desc: 'Prices, wait times, weather — pulled at render, never stale.',
  },
  {
    n: 4,
    color: 'var(--mkt-ink)',
    label: 'Output',
    name: 'On screen now',
    desc: 'Change any layer and every screen in the group re-renders. No republish, no truck roll.',
  },
];

const BOARD_ITEMS = [
  { name: 'Charred corn elote', price: '$9' },
  { name: 'Smoked brisket bowl', price: '$16' },
  { name: 'Cold-brew tonic', price: '$6' },
];

/* Keyframes, the 980px breakpoint and the :has() isolation can't be expressed
   inline. Class names are `hiw-` prefixed because this block is global. */
const HOW_CSS = `
#how{--hiw-ease:cubic-bezier(.22,.61,.36,1)}
.hiw-grid{display:grid;grid-template-columns:1fr 1fr;gap:clamp(30px,5vw,80px);align-items:center}

/* The 3D projection overshoots the element box by ~130px upward. Below 980px the
   columns stack, so reserve room for the projection — sizing by the box lets the
   object collide with the copy above it. */
.hiw-holder{position:relative;display:grid;place-items:center;min-height:430px;perspective:1500px}
@media (max-width:980px){
  .hiw-grid{grid-template-columns:1fr;gap:0}
  .hiw-holder{min-height:0;padding-top:144px;padding-bottom:8px}
}

/* Width is capped three ways because the projection runs ~1.37x wider than the
   element box: 58vw stops it overflowing a 375px viewport, 380px is the mockup's
   ceiling, and 72% keeps the projection inside its own grid column — without that
   term it is clipped at the right viewport edge between 981px and ~1080px, where
   the max-w-5xl wrapper sits closest to the viewport edge. */
.hiw-stack{position:relative;width:min(58vw,380px,72%);aspect-ratio:1/.95;transform-style:preserve-3d;
  transform:rotateX(52deg) rotateZ(-38deg);animation:hiwDrift 14s ease-in-out infinite}
@keyframes hiwDrift{0%,100%{transform:rotateX(52deg) rotateZ(-38deg) translateZ(0)}
                    50%{transform:rotateX(49.5deg) rotateZ(-35.5deg) translateZ(12px)}}

.hiw-lyr{position:absolute;inset:0;border-radius:15px;transform-style:preserve-3d;
  border:1px solid rgba(255,255,255,.85);background:rgba(255,255,255,.36);
  box-shadow:0 20px 42px rgba(10,34,46,.14);
  transition:transform .8s var(--hiw-ease),opacity .35s,box-shadow .35s}
.hiw-lyr-1{transform:translateZ(0);background:linear-gradient(135deg,rgba(0,180,216,.18),rgba(255,255,255,.42))}
.hiw-lyr-1::after{content:'';position:absolute;inset:14px;border-radius:8px;
  background:repeating-linear-gradient(90deg,rgba(10,34,46,.16) 0 26px,transparent 26px 38px);opacity:.5}
.hiw-lyr-2{transform:translateZ(54px);background:linear-gradient(135deg,rgba(139,92,246,.17),rgba(255,255,255,.4))}
.hiw-lyr-2::after{content:'';position:absolute;left:14px;right:14px;top:22px;height:14px;border-radius:4px;
  background:linear-gradient(90deg,rgba(139,92,246,.52) 0 24%,transparent 24% 42%,rgba(139,92,246,.34) 42% 76%,transparent 76%)}
.hiw-lyr-3{transform:translateZ(108px);background:linear-gradient(135deg,rgba(0,229,160,.2),rgba(255,255,255,.4))}
.hiw-lyr-3::after{content:'';position:absolute;right:18px;bottom:18px;width:44%;height:30%;border-radius:8px;
  background:rgba(255,255,255,.74);border:1px solid rgba(0,178,124,.36)}
.hiw-lyr-4{transform:translateZ(168px);background:#0A222E;border:1px solid rgba(255,255,255,.5);overflow:hidden;
  box-shadow:0 38px 76px rgba(10,34,46,.32),0 0 60px rgba(0,229,160,.11)}
.hiw-stack:hover .hiw-lyr-2{transform:translateZ(78px)}
.hiw-stack:hover .hiw-lyr-3{transform:translateZ(156px)}
.hiw-stack:hover .hiw-lyr-4{transform:translateZ(240px)}

.hiw-board{position:absolute;inset:0;padding:8% 9%;display:flex;flex-direction:column;color:#EAF3F1}
.hiw-board-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:6%}
.hiw-board-top .mkt-mono{color:var(--mkt-mint-hot);font-size:.5rem}
.hiw-board-live{display:flex;align-items:center;gap:5px;font-family:var(--font-mono),ui-monospace,monospace;
  font-size:.46rem;letter-spacing:.13em;text-transform:uppercase;color:#8FB3B0}
.hiw-board-live i{width:5px;height:5px;border-radius:50%;background:var(--mkt-mint-hot);
  font-style:normal;animation:hiwBlip 2s infinite}
@keyframes hiwBlip{0%,100%{opacity:1}50%{opacity:.25}}
.hiw-board-title{font-size:clamp(.74rem,1.1vw,1.02rem);font-weight:600;letter-spacing:-.045em;margin-bottom:7%}
.hiw-board-menu{display:flex;flex-direction:column;gap:6%;flex:1}
.hiw-board-item{display:flex;align-items:baseline;gap:7px}
.hiw-board-item .nm{font-size:.56rem;font-weight:500;white-space:nowrap}
.hiw-board-item .ln{flex:1;border-bottom:1px dotted rgba(255,255,255,.24);transform:translateY(-3px)}
.hiw-board-item .pr{font-family:var(--font-mono),ui-monospace,monospace;font-size:.56rem;color:var(--mkt-mint-hot)}
.hiw-board-foot{display:flex;justify-content:space-between;border-top:1px solid rgba(255,255,255,.1);padding-top:5%}
.hiw-board-foot .mkt-mono{color:#6D8E93;font-size:.44rem}

.hiw-legend{list-style:none;display:flex;flex-direction:column;gap:2px;margin-top:26px}
.hiw-legend li{display:flex;align-items:flex-start;gap:13px;padding:12px 14px;border-radius:11px;
  transition:background .3s var(--hiw-ease)}
.hiw-legend li:hover{background:rgba(255,255,255,.62)}
.hiw-legend i{width:9px;height:9px;border-radius:2px;flex:none;margin-top:6px;
  transition:transform .3s var(--hiw-ease)}
.hiw-legend li:hover i{transform:scale(1.4)}
.hiw-legend .k{display:block;color:var(--mkt-muted);margin-bottom:3px}
.hiw-legend .v{display:block;font-family:var(--font-sora),sans-serif;font-size:.98rem;font-weight:600;
  letter-spacing:-.025em}
.hiw-legend .d{display:block;font-size:.86rem;color:var(--mkt-ink-2);line-height:1.55;margin-top:4px}

/* Progressive enhancement — the legend isolates its own pane. The section reads
   the same where :has() is unsupported. */
.hiw-grid:has(.hiw-legend li[data-l="1"]:hover) .hiw-lyr:not(.hiw-lyr-1),
.hiw-grid:has(.hiw-legend li[data-l="2"]:hover) .hiw-lyr:not(.hiw-lyr-2),
.hiw-grid:has(.hiw-legend li[data-l="3"]:hover) .hiw-lyr:not(.hiw-lyr-3),
.hiw-grid:has(.hiw-legend li[data-l="4"]:hover) .hiw-lyr:not(.hiw-lyr-4){opacity:.26}
.hiw-grid:has(.hiw-legend li[data-l="1"]:hover) .hiw-lyr-1,
.hiw-grid:has(.hiw-legend li[data-l="2"]:hover) .hiw-lyr-2,
.hiw-grid:has(.hiw-legend li[data-l="3"]:hover) .hiw-lyr-3{
  box-shadow:0 0 0 2px rgba(0,178,124,.7),0 20px 42px rgba(10,34,46,.14)}
.hiw-grid:has(.hiw-legend li[data-l="4"]:hover) .hiw-lyr-4{
  box-shadow:0 0 0 2px rgba(0,229,160,.8),0 38px 76px rgba(10,34,46,.32)}

@media (prefers-reduced-motion:reduce){
  .hiw-stack{animation:none}
  .hiw-board-live i{animation:none}
}
`;

export default function HowItWorksSection() {
  return (
    <section id="how" className="py-16 sm:py-20 px-6" aria-labelledby="howTitle">
      <style dangerouslySetInnerHTML={{ __html: HOW_CSS }} />

      <div className="hiw-grid max-w-5xl mx-auto">
        <Reveal>
          <div style={{ maxWidth: '44ch' }}>
            <span className="mkt-mono mkt-kicker" style={{ marginBottom: '14px' }}>
              How it resolves
            </span>
            <h2
              id="howTitle"
              className="eh-heading"
              style={{ fontSize: 'clamp(1.85rem,3.3vw,2.75rem)', fontWeight: 600, marginBottom: '14px' }}
            >
              Four layers.<br />One screen.
            </h2>
            <p style={{ color: 'var(--mkt-ink-2)', fontSize: '1.02rem', lineHeight: 1.65 }}>
              A playlist, a daypart, a live price feed, an override from head office. Vizora resolves all
              of it into the one thing that matters — what your customer is looking at right now.
            </p>
          </div>

          <ul className="hiw-legend">
            {LAYERS.map((layer) => (
              <li key={layer.n} data-l={layer.n}>
                <i style={{ background: layer.color }} />
                <div>
                  <span className="k mkt-mono">{layer.label}</span>
                  <span className="v">{layer.name}</span>
                  <span className="d">{layer.desc}</span>
                </div>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={150}>
          <div className="hiw-holder" aria-hidden="true">
            <div className="hiw-stack">
              <div className="hiw-lyr hiw-lyr-1" />
              <div className="hiw-lyr hiw-lyr-2" />
              <div className="hiw-lyr hiw-lyr-3" />
              <div className="hiw-lyr hiw-lyr-4">
                <div className="hiw-board">
                  <div className="hiw-board-top">
                    <span className="mkt-mono">Urban Eats · Downtown</span>
                    <span className="hiw-board-live"><i /> On air</span>
                  </div>
                  <h3 className="hiw-board-title eh-heading">Today&apos;s Specials</h3>
                  <div className="hiw-board-menu">
                    {BOARD_ITEMS.map((item) => (
                      <div key={item.name} className="hiw-board-item">
                        <span className="nm">{item.name}</span>
                        <span className="ln" />
                        <span className="pr">{item.price}</span>
                      </div>
                    ))}
                  </div>
                  <div className="hiw-board-foot">
                    <span className="mkt-mono">Updated 4 min ago</span>
                    <span className="mkt-mono">RETAIL-DT-04</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

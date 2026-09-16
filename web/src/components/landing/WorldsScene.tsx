'use client';

/**
 * Little Worlds diorama — a code-native CSS-3D miniature of the three places
 * the homepage narrates: a café, a hotel lobby and a retail shop, each with
 * digital signage visibly serving the space, joined by a forest "sync" thread.
 *
 * Deliberately NOT a canvas and NOT an image: every plane is a real element in
 * a `preserve-3d` world (the same technique the old layer-stack section used),
 * so it costs no runtime dependency, ships no binary asset, stays crisp at any
 * DPI and recolours with the token scope.
 *
 * The whole scene is decorative (`aria-hidden` at the mount site). Semantics —
 * the place selector buttons and captions — live in the parent section.
 *
 * Geometry convention: the `.lws-world` element is the GROUND PLANE (x right,
 * y toward the viewer), tilted into view by rotateX/rotateZ on `.lws-tilt`.
 * A wall "stands up" by hinging on its bottom edge: `transform-origin: bottom;
 * rotateX(-90deg)` — after which its children lay out flat ON the wall, which
 * is how the signage screens are mounted.
 */

import type { CSSProperties, ReactNode } from 'react';

export type WorldPlace = 'cafe' | 'hotel' | 'retail';

interface WorldsSceneProps {
  /** Highlighted vignette; the other two recede. `null` shows all equally. */
  active?: WorldPlace | null;
}

/* ---------- tiny geometry helpers ---------- */

/** A plane lying flat on the ground. */
function flat(x: number, y: number, w: number, h: number, z = 0): CSSProperties {
  return {
    position: 'absolute',
    left: x,
    top: y,
    width: w,
    height: h,
    transform: `translateZ(${z}px)`,
  };
}

/** A wall standing on the line y = yBottom, facing the viewer (+y). */
function wallY(x: number, yBottom: number, w: number, h: number, z = 0): CSSProperties {
  return {
    position: 'absolute',
    left: x,
    top: yBottom - h,
    width: w,
    height: h,
    transformOrigin: 'bottom',
    transform: `translateZ(${z}px) rotateX(-90deg)`,
  };
}

/** A wall standing along x = xLine (depth d along y), facing +x. */
function wallX(xLine: number, yTop: number, d: number, h: number): CSSProperties {
  return {
    position: 'absolute',
    left: xLine,
    top: yTop,
    width: d,
    height: h,
    transformOrigin: 'top left',
    transform: `rotateX(-90deg) rotateY(-90deg)`,
  };
}

/** A 3-face box standing on the ground: top, front (+y) and right (+x). */
function Box({
  x,
  y,
  w,
  d,
  h,
  top,
  front,
  side,
  radius = 3,
  children,
}: {
  x: number;
  y: number;
  w: number;
  d: number;
  h: number;
  top: string;
  front: string;
  side: string;
  radius?: number;
  children?: ReactNode;
}) {
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, transformStyle: 'preserve-3d' }}>
      <div style={{ ...flat(x, y, w, d, h), background: top, borderRadius: radius }} />
      <div
        style={{
          ...wallY(x, y + d, w, h),
          background: front,
          borderRadius: `0 0 ${radius}px ${radius}px`,
        }}
      >
        {children}
      </div>
      <div style={{ ...wallX(x + w, y, d, h), background: side, borderRadius: radius }} />
    </div>
  );
}

/** Soft elliptical contact shadow on the ground. */
function Shadow({ x, y, w, h, o = 0.22 }: { x: number; y: number; w: number; h: number; o?: number }) {
  return (
    <div
      style={{
        ...flat(x, y, w, h, 0.5),
        borderRadius: '50%',
        background: `radial-gradient(50% 50% at 50% 50%, rgba(35,38,31,${o}) 0%, transparent 70%)`,
      }}
    />
  );
}

/** Limestone plinth: shadow + darker base ellipse + lit top ellipse. */
function Plinth({ x, y, w, d }: { x: number; y: number; w: number; d: number }) {
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, transformStyle: 'preserve-3d' }}>
      <Shadow x={x - 18} y={y - 12} w={w + 36} h={d + 26} o={0.2} />
      <div
        style={{
          ...flat(x, y, w, d, 2),
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #d9cfb8, #c9bda1)',
        }}
      />
      <div
        style={{
          ...flat(x + 2, y + 2, w - 4, d - 4, 14),
          borderRadius: '50%',
          background: 'radial-gradient(80% 70% at 42% 34%, #f7f2e6 0%, #e9e1cd 62%, #ddd2b8 100%)',
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.55)',
        }}
      />
    </div>
  );
}

/** Potted plant: pot box + two leaf blobs standing as crossed planes. */
function Plant({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  const leaf = (rot: number): CSSProperties => ({
    position: 'absolute',
    left: x - 1,
    top: y + 7 * s,
    width: 26 * s,
    height: 34 * s,
    transformOrigin: 'bottom',
    transform: `translateZ(${10 * s}px) rotateZ(${rot}deg) rotateX(-90deg)`,
    borderRadius: '50% 50% 42% 42%',
    background: 'radial-gradient(60% 60% at 46% 34%, #57795d 0%, #33543c 68%, #274531 100%)',
  });
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, transformStyle: 'preserve-3d' }}>
      <Shadow x={x - 6} y={y - 2} w={38 * s} h={22 * s} o={0.16} />
      <Box
        x={x}
        y={y}
        w={22 * s}
        d={14 * s}
        h={11 * s}
        radius={4}
        top="#cbb58c"
        front="linear-gradient(180deg,#c0a97e,#a8905f)"
        side="#96794d"
      />
      <div style={leaf(0)} />
      <div style={leaf(65)} />
      <div style={leaf(-58)} />
    </div>
  );
}

/* ---------- signage screen faces (mounted inside walls) ---------- */

const screenShell: CSSProperties = {
  position: 'absolute',
  borderRadius: 4,
  background: 'var(--lw-screen, #fffdf4)',
  border: '2px solid #2c2f28',
  boxShadow: '0 0 0 1px rgba(255,255,255,.4), 0 0 18px rgba(176,138,62,.35)',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  padding: '7%',
  color: '#1f4230',
  lineHeight: 1.25,
};

function MenuScreen({ style }: { style: CSSProperties }) {
  return (
    <div style={{ ...screenShell, ...style }}>
      <span className="lws-scr-k">Coffee</span>
      <span className="lws-scr-t lws-scr-serif" style={{ fontSize: 8 }}>
        Brighter days
      </span>
      <span className="lws-scr-row">
        <i>Flat white</i>
        <b>4.0</b>
      </span>
      <span className="lws-scr-row">
        <i>Morning bun</i>
        <b>3.5</b>
      </span>
    </div>
  );
}

function WelcomeScreen({ style }: { style: CSSProperties }) {
  return (
    <div style={{ ...screenShell, ...style }}>
      <span className="lws-scr-k">Horizon Hotel</span>
      <span className="lws-scr-t lws-scr-serif">Welcome</span>
      <span className="lws-scr-band" />
      <span className="lws-scr-k" style={{ marginTop: 'auto' }}>
        Breakfast · 6–10
      </span>
    </div>
  );
}

function PromoScreen({ style }: { style: CSSProperties }) {
  return (
    <div style={{ ...screenShell, ...style }}>
      <span className="lws-scr-k">Noble &amp; Co.</span>
      <span className="lws-scr-t lws-scr-serif">
        Style
        <br />
        Moves
        <br />
        People
      </span>
      <span className="lws-scr-band lws-scr-band-coral" />
    </div>
  );
}

/* ---------- the three vignettes ---------- */

function Cafe() {
  return (
    <div className="lws-v" data-v="cafe" style={{ position: 'absolute', left: 16, top: 212, transformStyle: 'preserve-3d' }}>
      <Plinth x={0} y={0} w={236} d={150} />
      {/* back wall with vertical timber slats + two menu screens */}
      <div
        className="lws-wallface"
        style={{
          ...wallY(20, 46, 198, 112),
          background:
            'repeating-linear-gradient(90deg, #efe7d2 0 10px, #e2d7ba 10px 12px)',
          borderRadius: '6px 6px 0 0',
          boxShadow: 'inset 0 -14px 22px rgba(35,38,31,.10)',
        }}
      >
        <MenuScreen style={{ left: 18, top: 26, width: 50, height: 66 }} />
        <MenuScreen style={{ left: 78, top: 26, width: 50, height: 66 }} />
      </div>
      {/* striped awning: hinged at the wall top, sloping gently forward */}
      <div
        style={{
          position: 'absolute',
          left: 12,
          top: 46,
          width: 214,
          height: 30,
          transformOrigin: 'top',
          transform: 'translateZ(112px) rotateX(-24deg)',
          background:
            'repeating-linear-gradient(90deg, #1f4230 0 17px, #f3eee0 17px 34px)',
          borderRadius: '0 0 9px 9px',
          boxShadow: '0 12px 18px rgba(35,38,31,.2)',
        }}
      />
      {/* counter */}
      <Box
        x={62}
        y={72}
        w={116}
        d={32}
        h={32}
        radius={5}
        top="linear-gradient(135deg,#e8d9b8,#d8c493)"
        front="repeating-linear-gradient(90deg,#c9a86b 0 9px,#b8945a 9px 18px)"
        side="#a37f47"
      />
      {/* espresso machine hint on the counter */}
      <Box x={132} y={74} w={26} d={16} h={14} radius={3} top="#f1ece0" front="#d8d2c2" side="#b9b2a0" />
      {/* café table + stool */}
      <div style={{ ...flat(34, 112, 34, 24, 22), borderRadius: '50%', background: 'radial-gradient(60% 60% at 42% 36%, #f6f0e2, #d9cdb2)' }} />
      <div style={{ ...wallY(49, 134, 4, 22), background: '#8f7a55' }} />
      <Shadow x={30} y={108} w={44} h={30} o={0.14} />
      {/* A-board on the ground */}
      <div
        style={{
          ...wallY(184, 124, 26, 34),
          transform: 'translateZ(0) rotateX(-78deg)',
          background: '#2c2f28',
          borderRadius: 3,
          boxShadow: 'inset 0 0 0 2px #d8cfb8',
        }}
      />
      <Plant x={202} y={62} s={1.05} />
    </div>
  );
}

function Hotel() {
  return (
    <div className="lws-v" data-v="hotel" style={{ position: 'absolute', left: 246, top: 56, transformStyle: 'preserve-3d' }}>
      <Plinth x={0} y={0} w={252} d={158} />
      {/* niche: back wall + two angled wings for the curved-alcove read */}
      <div
        className="lws-wallface"
        style={{
          ...wallY(46, 36, 160, 126),
          background: 'linear-gradient(180deg, #f4eddc 0%, #e7ddc4 100%)',
          borderRadius: '10px 10px 0 0',
          boxShadow: 'inset 0 -18px 26px rgba(35,38,31,.10)',
        }}
      >
        <WelcomeScreen style={{ left: 30, top: 16, width: 100, height: 58 }} />
      </div>
      <div
        style={{
          ...wallY(10, 52, 44, 112),
          transform: 'translateZ(0) rotateX(-90deg) rotateY(34deg)',
          transformOrigin: 'bottom right',
          background: 'linear-gradient(180deg,#efe6d0,#ddd1b2)',
          borderRadius: '8px 0 0 0',
        }}
      />
      <div
        style={{
          ...wallY(198, 52, 44, 112),
          transform: 'translateZ(0) rotateX(-90deg) rotateY(-34deg)',
          transformOrigin: 'bottom left',
          background: 'linear-gradient(180deg,#e9dfc7,#d5c8a6)',
          borderRadius: '0 8px 0 0',
        }}
      />
      {/* brass reception desk */}
      <Box
        x={78}
        y={78}
        w={98}
        d={30}
        h={30}
        radius={7}
        top="linear-gradient(135deg,#e9cf92,#d3af5e)"
        front="repeating-linear-gradient(90deg,#c79a3f 0 6px,#b8892f 6px 12px)"
        side="#9a7124"
      />
      {/* warm pool of lamplight on the desk top */}
      <div
        style={{
          ...flat(86, 80, 82, 26, 31),
          borderRadius: '50%',
          background: 'radial-gradient(50% 50% at 50% 50%, rgba(255,226,150,.55) 0%, transparent 70%)',
        }}
      />
      {/* rug */}
      <div style={{ ...flat(86, 116, 84, 30, 1), borderRadius: '50%', background: 'radial-gradient(60% 60% at 50% 45%, #d6c5a0, #c4b088)', opacity: 0.8 }} />
      {/* armchair */}
      <Box x={186} y={100} w={30} d={24} h={18} radius={8} top="#405a6b" front="linear-gradient(180deg,#37505f,#2b4150)" side="#243745" />
      {/* luggage */}
      <Box x={52} y={112} w={16} d={10} h={20} radius={3} top="#8a6a3c" front="#7a5c31" side="#63481f" />
      <Plant x={206} y={56} s={1.05} />
    </div>
  );
}

function Retail() {
  return (
    <div className="lws-v" data-v="retail" style={{ position: 'absolute', left: 476, top: 220, transformStyle: 'preserve-3d' }}>
      <Plinth x={0} y={0} w={224} d={146} />
      {/* back wall with tall arch + portrait screen */}
      <div
        className="lws-wallface"
        style={{
          ...wallY(30, 34, 168, 122),
          background: 'linear-gradient(180deg,#f2ebd8,#e4d9bd)',
          borderRadius: '8px 8px 0 0',
          boxShadow: 'inset 0 -16px 24px rgba(35,38,31,.10)',
        }}
      >
        {/* arch niche */}
        <span
          style={{
            position: 'absolute',
            left: 12,
            top: 12,
            width: 62,
            height: 102,
            borderRadius: '31px 31px 0 0',
            background: 'linear-gradient(180deg,#e0d4b4,#d2c49e)',
            boxShadow: 'inset 0 6px 12px rgba(35,38,31,.16)',
          }}
        />
        <PromoScreen style={{ left: 104, top: 14, width: 50, height: 96 }} />
      </div>
      {/* clothes rail standing in the arch line */}
      <div style={{ ...wallY(48, 96, 3, 54), background: '#8a6a3c' }} />
      <div style={{ ...wallY(96, 96, 3, 54), background: '#8a6a3c' }} />
      <div style={{ ...wallY(44, 96, 62, 5), transform: 'translateZ(48px) rotateX(-90deg)', background: '#6d5426', borderRadius: 3 }} />
      {['#d96a4c', '#f0e9d6', '#1f4230', '#c9b389'].map((c, i) => (
        <div
          key={c}
          style={{
            ...wallY(50 + i * 12, 96, 10, 34),
            transform: 'translateZ(14px) rotateX(-90deg)',
            background: c,
            borderRadius: '2px 2px 4px 4px',
            opacity: 0.94,
          }}
        />
      ))}
      <Shadow x={40} y={86} w={70} h={20} o={0.14} />
      {/* display table with folded stacks */}
      <Box
        x={112}
        y={82}
        w={78}
        d={34}
        h={22}
        radius={5}
        top="linear-gradient(135deg,#efe6cf,#ddcfa9)"
        front="#cbb98d"
        side="#b3a077"
      />
      <Box x={122} y={88} w={20} d={12} h={8} radius={2} top="#d96a4c" front="#c4573a" side="#a63d20" />
      <Box x={150} y={88} w={20} d={12} h={8} radius={2} top="#f3eee0" front="#e0d8c2" side="#c9bfa4" />
      <Plant x={12} y={64} s={0.9} />
    </div>
  );
}

/* ---------- scene ---------- */

const SCENE_CSS = `
.lws-fit{container-type:inline-size;width:100%;aspect-ratio:740/392;position:relative}
.lws-scale{position:absolute;inset:0;width:740px;height:392px;transform-origin:top left;
  /* atan2(length,length) -> angle whose tan is their unitless ratio */
  transform:scale(tan(atan2(100cqw,740px)))}
.lws-stage{position:absolute;inset:0;perspective:1750px;perspective-origin:50% 30%}
.lws-world{position:absolute;left:10px;top:-20px;width:720px;height:430px;transform-style:preserve-3d;
  transform:rotateX(55deg) rotateZ(-20deg)}
.lws-v{transition:opacity .45s ease,transform .45s ease}
.lws-world[data-active] .lws-v{opacity:.42}
.lws-world[data-active="cafe"] .lws-v[data-v="cafe"],
.lws-world[data-active="hotel"] .lws-v[data-v="hotel"],
.lws-world[data-active="retail"] .lws-v[data-v="retail"]{opacity:1;transform:translateZ(14px)}

/* sync thread lying on the ground, joining the three plinths */
.lws-thread{position:absolute;left:0;top:0;width:720px;height:430px;transform:translateZ(1px)}
.lws-thread path{fill:none;stroke:#1f4230;stroke-width:2;stroke-dasharray:1 7;stroke-linecap:round;opacity:.75}
.lws-thread circle{fill:#d96a4c;stroke:#f5f1e8;stroke-width:2}

/* screen micro-typography (decorative; aria-hidden at the mount) */
.lws-scr-k{font-family:var(--font-mono),monospace;font-size:4.4px;letter-spacing:.14em;
  text-transform:uppercase;color:#77591f;margin-bottom:2px}
.lws-scr-t{font-weight:700;font-size:7.2px;letter-spacing:-.02em;margin-bottom:3px}
.lws-scr-serif{font-family:var(--lw-serif);font-weight:500;font-size:10px;line-height:1.05}
.lws-scr-row{display:flex;justify-content:space-between;align-items:baseline;font-size:5px;
  border-top:1px dotted rgba(31,66,48,.35);padding-top:2px;margin-top:2px}
.lws-scr-row i{font-style:normal}
.lws-scr-row b{font-family:var(--font-mono),monospace}
.lws-scr-band{height:8px;border-radius:2px;margin-top:2px;
  background:linear-gradient(90deg,#1f4230 0 35%,#b08a3e 35% 55%,#e4d9bd 55%)}
.lws-scr-band-coral{background:linear-gradient(90deg,#d96a4c 0 45%,#e4d9bd 45%)}

/* gentle screen glow breathing — the only idle motion, and it stops on request */
@keyframes lws-glow{0%,100%{box-shadow:0 0 0 1px rgba(255,255,255,.4),0 0 14px rgba(176,138,62,.28)}
  50%{box-shadow:0 0 0 1px rgba(255,255,255,.4),0 0 26px rgba(176,138,62,.5)}}
.lws-wallface>div{animation:lws-glow 5.5s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){
  .lws-wallface>div{animation:none}
  .lws-v{transition:none}
}
`;

export default function WorldsScene({ active = null }: WorldsSceneProps) {
  return (
    <div className="lws-fit">
      <style dangerouslySetInnerHTML={{ __html: SCENE_CSS }} />
      <div className="lws-scale">
        <div className="lws-stage">
          <div className="lws-world" data-active={active ?? undefined}>
            {/* warm ground wash unifying the three plinths */}
            <div
              style={{
                position: 'absolute',
                inset: -30,
                borderRadius: '50%',
                background:
                  'radial-gradient(46% 40% at 24% 66%, rgba(176,138,62,.10) 0%, transparent 70%),' +
                  'radial-gradient(42% 38% at 52% 34%, rgba(31,66,48,.07) 0%, transparent 70%),' +
                  'radial-gradient(44% 40% at 80% 64%, rgba(217,106,76,.08) 0%, transparent 70%)',
              }}
            />
            {/* thread first so it sits under the plinths' shadows */}
            <svg className="lws-thread" viewBox="0 0 720 430" aria-hidden="true">
              <path d="M134 288 C 240 262, 290 176, 372 138 C 460 176, 520 262, 594 296" />
              <circle cx="134" cy="288" r="4" />
              <circle cx="372" cy="138" r="4" />
              <circle cx="594" cy="296" r="4" />
            </svg>
            <Cafe />
            <Hotel />
            <Retail />
          </div>
        </div>
      </div>
    </div>
  );
}

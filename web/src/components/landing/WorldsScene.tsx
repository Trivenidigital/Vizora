'use client';

/**
 * Little Worlds diorama — a code-native CSS-3D miniature of the three places
 * the homepage narrates: a café, a hotel lobby and a retail shop, each with
 * digital signage visibly serving the space, joined by a forest "sync" thread.
 *
 * Deliberately NOT a canvas and NOT an image: every plane is a real element in
 * a `preserve-3d` world, so it costs no runtime dependency, ships no binary
 * asset, stays crisp at any DPI and recolours with the token scope.
 *
 * The whole scene is decorative (`aria-hidden` at the mount site). Semantics —
 * the place selector buttons and captions — live in the parent section.
 *
 * ── Geometry convention ────────────────────────────────────────────────────
 * `.lws-world` is the GROUND PLANE (x right, y toward the viewer), tilted into
 * view by rotateX/rotateZ. A wall "stands up" by hinging on its bottom edge
 * (`transform-origin: bottom; rotateX(-90deg)`) — after which its children lay
 * out flat ON the wall, which is how the signage screens are mounted.
 *
 * Every vignette stands on a limestone plinth, so `flat`/`wallY`/`wallX` bake
 * the plinth deck height (`DECK`) into their translateZ. Interior coordinates
 * are therefore plinth-relative and the plinth itself uses raw `disc()` z.
 *
 * ── Lighting model ─────────────────────────────────────────────────────────
 * ONE warm key from the upper-left-front. Every solid gets three tones —
 * top lightest, front (+y) mid, right side (+x) darkest — each a gradient, via
 * `mat()`. Every object drops a `Cast` (tight contact core up-left, soft pool
 * offset down-right, one element, two gradients).
 *
 * ── The flattening trap ────────────────────────────────────────────────────
 * `opacity < 1`, `filter`, `overflow`, `mask` and `clip-path` on an element
 * force `transform-style: flat` and collapse its 3D children onto its plane.
 * So the active/inactive treatment uses NO opacity on any preserve-3d group:
 * the active vignette lifts (`translateZ`), its screens glow harder and a
 * highlight ring fades in. Those opacity/clip-path rules only ever land on
 * LEAF elements, which have no 3D children to lose.
 */

import type { CSSProperties, ReactNode } from 'react';

export type WorldPlace = 'cafe' | 'hotel' | 'retail';

interface WorldsSceneProps {
  /** Highlighted vignette; the others keep their own light. `null` = all equal. */
  active?: WorldPlace | null;
}

/* ---------- geometry helpers ---------- */

/** Plinth deck height — drum + upper tier. Every interior prop stands on it. */
const DECK = 31;

/** A preserve-3d group that yaws about the world's z axis (z is untouched). */
function Yaw({ x, y, deg, children }: { x: number; y: number; deg: number; children: ReactNode }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        transformStyle: 'preserve-3d',
        transform: `translate(${x}px, ${y}px) rotate(${deg}deg)`,
      }}
    >
      {children}
    </div>
  );
}

/** A plane lying flat on the deck. */
function flat(x: number, y: number, w: number, h: number, z = 0): CSSProperties {
  return {
    position: 'absolute',
    left: x,
    top: y,
    width: w,
    height: h,
    transform: `translateZ(${z + DECK}px)`,
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
    transform: `translateZ(${z + DECK}px) rotateX(-90deg)`,
  };
}

/** A wall standing along x = xLine (depth d along y), facing +x. */
function wallX(xLine: number, yTop: number, d: number, h: number, z = 0): CSSProperties {
  return {
    position: 'absolute',
    left: xLine,
    top: yTop,
    width: d,
    height: h,
    transformOrigin: 'top left',
    transform: `translateZ(${z + DECK}px) rotateX(-90deg) rotateY(-90deg)`,
  };
}

/* ---------- materials: one key light, three tones per solid ---------- */

interface Mat {
  top: string;
  front: string;
  side: string;
}

function mat(light: string, mid: string, dark: string, deep: string): Mat {
  return {
    top: `linear-gradient(146deg, ${light} 0%, ${mid} 100%)`,
    front: `linear-gradient(176deg, ${mid} 0%, ${dark} 100%)`,
    side: `linear-gradient(200deg, ${dark} 0%, ${deep} 100%)`,
  };
}

const M = {
  stone: mat('#f8f3e6', '#e9e0c9', '#d2c5a4', '#bbac86'),
  ivory: mat('#f6efdd', '#ebe1c6', '#d6c9a8', '#c0b189'),
  oak: mat('#e7d0a5', '#d2b381', '#b08f5e', '#937449'),
  walnut: mat('#c49b64', '#a87f4c', '#8a6437', '#6d4d27'),
  brass: mat('#f2dca6', '#dcbb6c', '#b89241', '#8e6c26'),
  forest: mat('#3d6e52', '#2b5339', '#1c3b28', '#12281b'),
  coral: mat('#f0947a', '#df7050', '#bc5334', '#973d23'),
  charcoal: mat('#4d5146', '#34382e', '#23261f', '#15170f'),
  slate: mat('#6a8494', '#4e6879', '#3a505e', '#2a3c47'),
  cream: mat('#fdf8ea', '#f0e7d1', '#dbceb0', '#c4b693'),
  steel: mat('#e9e6dd', '#d5d1c4', '#b6b2a3', '#97937f'),
};

/* ---------- shadows ---------- */

const CAST_BG =
  'radial-gradient(34% 36% at 40% 40%, rgba(46,40,26,.52) 0%, rgba(46,40,26,.22) 62%, rgba(46,40,26,0) 80%),' +
  'radial-gradient(50% 50% at 58% 62%, rgba(46,40,26,.28) 0%, rgba(46,40,26,0) 74%)';

/**
 * One element, two reads: a tight dark contact core directly beneath the
 * object and a soft pool thrown toward the lower-right, away from the key.
 */
function Cast({ x, y, w, h, o = 1 }: { x: number; y: number; w: number; h: number; o?: number }) {
  return (
    <div
      style={{
        ...flat(x, y, w, h, 0.4),
        borderRadius: '50%',
        background: CAST_BG,
        /* Leaf element — no 3D children to flatten, so opacity is safe here. */
        opacity: o,
      }}
    />
  );
}

/** Same, but on the true ground plane (used under the plinths themselves). */
function GroundCast({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        transform: 'translateZ(0.4px)',
        borderRadius: '50%',
        background:
          'radial-gradient(38% 40% at 42% 42%, rgba(46,40,26,.42) 0%, rgba(46,40,26,.17) 62%, rgba(46,40,26,0) 80%),' +
          'radial-gradient(50% 50% at 58% 62%, rgba(46,40,26,.24) 0%, rgba(46,40,26,0) 76%)',
      }}
    />
  );
}

/* ---------- solids ---------- */

/** A 3-face box standing on the deck: top, front (+y) and right (+x). */
function Box({
  x,
  y,
  w,
  d,
  h,
  m,
  front,
  top,
  radius = 3,
  z0 = 0,
  children,
}: {
  x: number;
  y: number;
  w: number;
  d: number;
  h: number;
  m: Mat;
  front?: string;
  top?: string;
  radius?: number;
  /** Height of the surface it stands on — a counter top, a table top. */
  z0?: number;
  children?: ReactNode;
}) {
  return (
    <>
      <div style={{ ...flat(x, y, w, d, z0 + h), background: top ?? m.top, borderRadius: radius }} />
      <div
        style={{
          ...wallY(x, y + d, w, h, z0),
          background: front ?? m.front,
          borderRadius: `0 0 ${radius}px ${radius}px`,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,.3)',
        }}
      >
        {children}
      </div>
      <div style={{ ...wallX(x + w, y, d, h, z0), background: m.side }} />
    </>
  );
}

/**
 * A wall with real thickness: front face (children mount here), top cap and
 * the lit right-hand side face, plus the ambient-occlusion band it lays on the
 * deck in front of itself.
 */
function WallSlab({
  x,
  yFront,
  w,
  h,
  t = 9,
  m,
  face,
  radius = 8,
  children,
}: {
  x: number;
  yFront: number;
  w: number;
  h: number;
  t?: number;
  m: Mat;
  face?: string;
  radius?: number;
  children?: ReactNode;
}) {
  return (
    <>
      <div
        style={{
          ...flat(x + 4, yFront, w, 30, 0.5),
          background:
            'linear-gradient(180deg, rgba(38,34,24,.26) 0%, rgba(38,34,24,.09) 46%, rgba(38,34,24,0) 100%)',
          borderRadius: '2px 2px 40% 40%',
        }}
      />
      <div style={{ ...flat(x, yFront - t, w, t, h), background: m.top, borderRadius: radius }} />
      <div style={{ ...wallX(x + w, yFront - t, t, h), background: m.side }} />
      <div
        className="lws-wallface"
        style={{
          ...wallY(x, yFront, w, h),
          background: face ?? m.front,
          borderRadius: `${radius}px ${radius}px 0 0`,
          boxShadow: 'inset 0 -22px 30px rgba(38,34,24,.13), inset 1px 0 0 rgba(255,255,255,.35)',
          transformStyle: 'preserve-3d',
        }}
      >
        {children}
      </div>
    </>
  );
}

/* ---------- limestone plinth: a two-tier drum with a real rim ---------- */

const DRUM_N = 7;
const DRUM_STEP = 2.9;
const TIER_N = 4;
const TIER_STEP = 2.6;

function shade(a: [number, number, number], b: [number, number, number], t: number) {
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
}

const DRUM_LO: [number, number, number] = [162, 146, 116];
const DRUM_HI: [number, number, number] = [223, 213, 186];

const LIMESTONE =
  'radial-gradient(118% 96% at 33% 24%, rgba(255,255,255,.78) 0%, rgba(255,255,255,0) 62%),' +
  'radial-gradient(34% 28% at 70% 64%, rgba(178,163,126,.24) 0%, rgba(178,163,126,0) 72%),' +
  'radial-gradient(24% 20% at 24% 72%, rgba(178,163,126,.2) 0%, rgba(178,163,126,0) 74%),' +
  'radial-gradient(18% 16% at 58% 30%, rgba(178,163,126,.16) 0%, rgba(178,163,126,0) 78%),' +
  'repeating-linear-gradient(48deg, rgba(186,172,138,.09) 0 2px, rgba(255,255,255,0) 2px 6px),' +
  'linear-gradient(152deg, #f9f4e8 0%, #ece3cd 52%, #ddd2b5 100%)';

function disc(x: number, y: number, w: number, h: number, z: number): CSSProperties {
  return {
    position: 'absolute',
    left: x,
    top: y,
    width: w,
    height: h,
    transform: `translateZ(${z}px)`,
    borderRadius: '50%',
  };
}

/** Plinth footprint is w × d; the raised upper tier is inset by (tx, ty). */
function Plinth({ w, d, tx = 26, ty = 18 }: { w: number; d: number; tx?: number; ty?: number }) {
  const tw = w - tx * 2;
  const td = d - ty * 2;
  const drum = [];
  for (let i = 0; i < DRUM_N; i += 1) {
    const inset = i >= DRUM_N - 2 ? (i - (DRUM_N - 3)) * 1.4 : 0;
    drum.push(
      <div
        key={`d${i}`}
        style={{
          ...disc(inset, inset, w - inset * 2, d - inset * 2, 1.5 + i * DRUM_STEP),
          background: shade(DRUM_LO, DRUM_HI, i / (DRUM_N - 1)),
        }}
      />,
    );
  }
  const drumTop = 1.5 + (DRUM_N - 1) * DRUM_STEP;
  const tier = [];
  for (let i = 0; i < TIER_N; i += 1) {
    const inset = i >= TIER_N - 2 ? (i - (TIER_N - 3)) * 1.2 : 0;
    tier.push(
      <div
        key={`t${i}`}
        style={{
          ...disc(tx + inset, ty + inset, tw - inset * 2, td - inset * 2, drumTop + 1 + i * TIER_STEP),
          background: shade(DRUM_LO, DRUM_HI, 0.35 + (0.65 * i) / (TIER_N - 1)),
        }}
      />,
    );
  }
  return (
    <>
      <GroundCast x={-34} y={-14} w={w + 74} h={d + 52} />
      {drum}
      <div
        style={{
          ...disc(1, 1, w - 2, d - 2, drumTop + 0.6),
          background: LIMESTONE,
          boxShadow: 'inset 2px 3px 0 rgba(255,255,255,.7), inset -2px -3px 0 rgba(158,144,112,.32)',
        }}
      />
      {tier}
      <div
        style={{
          ...disc(tx + 1, ty + 1, tw - 2, td - 2, DECK - 0.4),
          background: LIMESTONE,
          boxShadow: 'inset 2px 3px 0 rgba(255,255,255,.72), inset -2px -3px 0 rgba(158,144,112,.3)',
        }}
      />
      <div
        className="lws-ring"
        style={{
          /* Sits ON the tier face, not straddling the drum, so it reads as a
             rim light rather than a floating halo. */
          ...disc(tx + 3, ty + 3, tw - 6, td - 6, DECK + 0.2),
          border: '2.5px solid rgba(183,142,59,.9)',
          boxShadow: '0 0 20px rgba(196,155,70,.7), inset 0 0 18px rgba(196,155,70,.38)',
        }}
      />
    </>
  );
}

/* ---------- foliage ---------- */

const LEAVES: Array<[number, number, number, string, string]> = [
  /* rotateZ, scale, lift, lit tone, shaded tone */
  [-68, 0.8, 0, '#6b9470', '#33543c'],
  [-30, 1.02, 3, '#7ba57f', '#3b6144'],
  [6, 1.16, 6, '#8cb68c', '#456e4d'],
  [36, 0.96, 3, '#6f9a74', '#345940'],
  [70, 0.74, 0, '#5c8664', '#2b4a34'],
  [-8, 0.58, 16, '#9cc599', '#4d7855'],
];

/** Potted plant read as foliage: six leaf planes at varied angle, size and tone. */
function Plant({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <>
      <Cast x={x - 12} y={y - 4} w={46 * s} h={28 * s} o={0.7} />
      <Box
        x={x}
        y={y}
        w={24 * s}
        d={16 * s}
        h={13 * s}
        radius={5}
        m={M.oak}
        top="radial-gradient(70% 70% at 40% 34%, #4a4034 0%, #2e281f 100%)"
      />
      {LEAVES.map(([rot, sc, lift, lit, shade2], i) => (
        <div
          key={`${rot}-${i}`}
          style={{
            position: 'absolute',
            left: x + 11 * s - 13 * s * sc,
            top: y + 8 * s,
            width: 26 * s * sc,
            height: 38 * s * sc,
            transformOrigin: 'bottom',
            transform: `translateZ(${(11 + lift) * s + DECK}px) rotateZ(${rot}deg) rotateX(-90deg)`,
            borderRadius: '54% 54% 34% 34%',
            background: `linear-gradient(168deg, ${lit} 0%, ${shade2} 72%, rgba(24,48,30,.95) 100%)`,
            boxShadow: 'inset 0 -5px 7px rgba(16,34,20,.3), 0 1px 2px rgba(16,34,20,.25)',
          }}
        />
      ))}
    </>
  );
}

/* ---------- signage screens ---------- */

const screenShell: CSSProperties = {
  borderRadius: 3,
  /* Lit like a display, not like the wall it hangs on. */
  background: 'linear-gradient(168deg, #ffffff 0%, #fdf8ea 54%, #f2e8d2 100%)',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  /* Fixed, not a percentage: CSS resolves percentage padding against the
     containing block's WIDTH on every side, so a landscape screen got ~17
     units of vertical padding and squeezed its sub-line out of the box. */
  padding: '4px',
  color: '#1f4230',
  lineHeight: 1.2,
};

/**
 * A screen mounted on a wall face: light pool thrown onto the wall around it,
 * a dark bezel slab standing proud of the wall, and the lit face on top.
 * Coordinates are wall-local (0,0 = top-left of the wall face).
 */
function Screen({
  x,
  y,
  w,
  h,
  children,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  children: ReactNode;
}) {
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: x - w * 0.46,
          top: y - h * 0.3,
          width: w * 1.92,
          height: h * 1.6,
          transform: 'translateZ(0.4px)',
          borderRadius: '50%',
          background:
            'radial-gradient(50% 50% at 50% 50%, rgba(255,230,168,.6) 0%, rgba(255,230,168,.18) 46%, rgba(255,230,168,0) 74%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: x,
          top: y,
          width: w,
          height: h,
          transform: 'translateZ(3px)',
          background: 'linear-gradient(158deg,#474b40 0%,#24271f 60%,#15170f 100%)',
          borderRadius: 5,
          boxShadow: '3px 4px 9px rgba(35,38,31,.45)',
        }}
      />
      <div
        className="lws-scr"
        style={{
          ...screenShell,
          position: 'absolute',
          left: x + 2.5,
          top: y + 2.5,
          width: w - 5,
          height: h - 5,
          transform: 'translateZ(4.4px)',
        }}
      >
        {children}
      </div>
    </>
  );
}

/* ---------- the three vignettes ---------- */

const CAFE_W = 272;
const CAFE_D = 180;

function Cafe() {
  return (
    <div className="lws-v" data-v="cafe">
      <Plinth w={CAFE_W} d={CAFE_D} />

      {/* timber-slat back wall with two portrait menu boards */}
      <WallSlab
        x={44}
        yFront={48}
        w={186}
        h={142}
        t={9}
        m={M.oak}
        radius={7}
        face={
          'repeating-linear-gradient(90deg, rgba(0,0,0,.09) 0 1.5px, rgba(255,255,255,0) 1.5px 13px),' +
          'linear-gradient(176deg, #e6d3ae 0%, #cbb287 62%, #b2996e 100%)'
        }
      >
        {/* shadow band the awning drops across the wall beneath it */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '100%',
            height: 30,
            transform: 'translateZ(0.5px)',
            background: 'linear-gradient(180deg, rgba(38,34,24,.42) 0%, rgba(38,34,24,0) 100%)',
          }}
        />
        <Screen x={16} y={34} w={70} h={94}>
          <span className="lws-latte" />
          <span className="lws-scr-h lws-scr-h-m">Coffee</span>
          <span className="lws-scr-k lws-scr-sm">Specialty</span>
        </Screen>
        <Screen x={100} y={34} w={70} h={94}>
          <span className="lws-scr-k lws-scr-sm">Today</span>
          <span className="lws-scr-h lws-scr-h-m">Menu</span>
          <span className="lws-scr-row lws-scr-sm">
            <i>Flat white</i>
            <b>4.0</b>
          </span>
          <span className="lws-scr-row lws-scr-sm">
            <i>Cortado</i>
            <b>3.6</b>
          </span>
          <span className="lws-scr-row lws-scr-sm">
            <i>Morning bun</i>
            <b>3.5</b>
          </span>
        </Screen>
      </WallSlab>

      {/* striped awning hinged at the wall top, sloping forward, scalloped */}
      <div
        className="lws-awning"
        style={{
          position: 'absolute',
          left: 34,
          top: 48,
          width: 206,
          height: 34,
          transformOrigin: 'top',
          transform: `translateZ(${142 + DECK}px) rotateX(19deg)`,
          background:
            'repeating-linear-gradient(90deg, #1f4230 0 18px, #f4efe1 18px 36px)',
          boxShadow: '0 14px 20px rgba(38,34,24,.24), inset 0 3px 0 rgba(255,255,255,.3)',
        }}
      >
        <span className="lws-scallop" />
      </div>
      {/* awning side return — one triangular panel closing the lit side */}
      <div
        style={{
          ...wallX(240, 48, 34, 12, 131),
          background: 'linear-gradient(180deg,#24462f,#14301f)',
          clipPath: 'polygon(0 0, 100% 100%, 0 100%)',
        }}
      />

      {/* counter lamps. They stay UNDER the menu boards by construction: on this
          camera an object at depth y clears a board mounted at the wall line
          only while 0.809*zTop <= 0.54*(y-48) + 11 — a pendant tall enough to
          hang would cross the boards instead of lighting the counter. */}
      {[122, 176].map((px) => (
        <div key={px} style={{ position: 'absolute', left: 0, top: 0, transformStyle: 'preserve-3d' }}>
          <div style={{ ...wallY(px + 8, 112, 2.4, 12, 36), background: 'linear-gradient(180deg,#e0bd6f,#9b7729)' }} />
          <div
            style={{
              ...wallY(px, 112, 19, 12, 46),
              background: 'linear-gradient(180deg,#fff6dd,#e0bd6f)',
              clipPath: 'polygon(21% 0, 79% 0, 100% 100%, 0 100%)',
              boxShadow: '0 0 10px rgba(255,214,128,.55)',
            }}
          />
          <div
            className="lws-lamp"
            style={{
              ...flat(px - 12, 100, 44, 28, 36.6),
              borderRadius: '50%',
              background:
                'radial-gradient(50% 50% at 50% 50%, rgba(255,210,122,.78) 0%, rgba(255,210,122,0) 72%)',
            }}
          />
        </div>
      ))}

      {/* counter */}
      <Cast x={58} y={98} w={156} h={54} />
      <Box
        x={70}
        y={84}
        w={126}
        d={32}
        h={36}
        radius={4}
        m={M.walnut}
        top="linear-gradient(146deg,#f0e4c6,#d9c69c)"
        front={
          'repeating-linear-gradient(90deg, rgba(0,0,0,.12) 0 1.4px, rgba(255,255,255,0) 1.4px 11px),' +
          'linear-gradient(176deg,#b9975f 0%,#96733f 100%)'
        }
      />
      {/* warm pool the menu boards throw onto the counter top */}
      <div
        style={{
          ...flat(74, 86, 118, 28, 36.4),
          borderRadius: '50%',
          background:
            'radial-gradient(50% 50% at 46% 44%, rgba(255,226,152,.42) 0%, rgba(255,226,152,0) 72%)',
        }}
      />

      {/* pastry case: translucent glass box — rgba backgrounds, never `opacity`,
          which would flatten the case's own 3D faces */}
      {[
        [82, 93, '#e6ad63'],
        [95, 94, '#dd8a4a'],
        [108, 93, '#f3dcaa'],
      ].map(([px, py, c]) => (
        <div
          key={`p${px}`}
          style={{
            ...flat(px as number, py as number, 11, 7, 41),
            borderRadius: '50%',
            background: `radial-gradient(64% 62% at 38% 30%, ${c}, rgba(128,84,40,.95))`,
            boxShadow: '0 1px 2px rgba(60,40,18,.4)',
          }}
        />
      ))}
      <Box
        x={78}
        y={88}
        w={46}
        d={24}
        h={22}
        z0={36}
        radius={2}
        m={M.steel}
        top="linear-gradient(146deg, rgba(255,255,255,.7), rgba(222,236,236,.3))"
        front="linear-gradient(176deg, rgba(252,255,254,.36) 0%, rgba(186,204,202,.46) 100%)"
      />
      <div
        style={{
          ...wallY(78, 112, 46, 22, 36),
          border: '1px solid rgba(255,255,255,.8)',
          borderBottom: '2px solid rgba(146,124,84,.55)',
          borderRadius: 2,
        }}
      />

      {/* espresso machine, standing on the counter top */}
      <Box x={140} y={88} w={34} d={22} h={22} z0={36} radius={2} m={M.charcoal} />
      <div style={{ ...flat(143, 90, 28, 6, 59), background: 'linear-gradient(90deg,#e4dfd1,#a8a394)', borderRadius: 2 }} />
      <div style={{ ...wallY(146, 110, 10, 7, 38), background: '#0f110b', borderRadius: 1 }} />
      <div style={{ ...wallY(159, 110, 10, 11, 42), background: 'linear-gradient(180deg,#dcbb6c,#8e6c26)', borderRadius: 1 }} />

      {/* stools, forward of the counter front so the seats read */}
      {[
        [82, 124],
        [116, 130],
        [150, 124],
      ].map(([px, py]) => (
        <div key={`s${px}`} style={{ position: 'absolute', left: 0, top: 0, transformStyle: 'preserve-3d' }}>
          <Cast x={px - 6} y={py + 6} w={34} h={22} o={0.8} />
          <div style={{ ...wallY(px + 9, py + 14, 3.5, 24), background: 'linear-gradient(180deg,#6b6355,#3c372c)' }} />
          <div
            style={{
              ...flat(px, py, 22, 15, 24),
              borderRadius: '50%',
              background: 'radial-gradient(64% 62% at 38% 30%, #d0a86f 0%, #8d6a3c 100%)',
              boxShadow: '0 2px 4px rgba(46,40,26,.34)',
            }}
          />
        </div>
      ))}

      {/* round table + two chairs */}
      <Cast x={22} y={116} w={72} h={48} />
      <div style={{ ...wallY(49, 150, 3.5, 24), background: 'linear-gradient(180deg,#8f7a55,#5c4d33)' }} />
      <div
        style={{
          ...flat(32, 122, 38, 26, 24),
          borderRadius: '50%',
          background: 'radial-gradient(62% 60% at 38% 30%, #efe0bc 0%, #d4bd8d 68%, #b99e6b 100%)',
          boxShadow: '0 3px 6px rgba(46,40,26,.34), inset 0 0 0 1.5px rgba(255,253,244,.5)',
        }}
      />
      {[
        [10, 118],
        [64, 140],
      ].map(([px, py]) => (
        <div key={`c${px}`} style={{ position: 'absolute', left: 0, top: 0, transformStyle: 'preserve-3d' }}>
          <Box x={px} y={py} w={18} d={14} h={13} radius={2} m={M.forest} />
          <div
            style={{
              ...wallY(px, py + 2, 18, 17, 13),
              background: 'linear-gradient(176deg,#2b5339,#1c3b28)',
              borderRadius: '3px 3px 0 0',
            }}
          />
        </div>
      ))}

      {/* A-board on the deck */}
      <Cast x={196} y={134} w={62} h={38} o={0.9} />
      <Yaw x={218} y={146} deg={-14}>
        <div
          style={{
            ...wallY(-17, 0, 34, 44),
            transform: `translateZ(${DECK}px) rotateX(-74deg)`,
            transformOrigin: 'bottom',
            background:
              'linear-gradient(90deg,rgba(0,0,0,0) 16%,rgba(236,226,200,.9) 16% 84%,rgba(0,0,0,0) 84%) 0 22%/100% 6px no-repeat,' +
              'linear-gradient(90deg,rgba(0,0,0,0) 24%,rgba(236,226,200,.62) 24% 76%,rgba(0,0,0,0) 76%) 0 46%/100% 3.5px no-repeat,' +
              'linear-gradient(90deg,rgba(0,0,0,0) 24%,rgba(236,226,200,.62) 24% 76%,rgba(0,0,0,0) 76%) 0 62%/100% 3.5px no-repeat,' +
              'linear-gradient(176deg,#3a3e34,#1c1f19)',
            borderRadius: 2,
            boxShadow: 'inset 0 0 0 2.5px rgba(222,212,186,.75)',
          }}
        />
        <div
          style={{
            ...wallY(-17, 0, 34, 42),
            transform: `translateZ(${DECK}px) rotateX(-106deg)`,
            transformOrigin: 'bottom',
            background: 'linear-gradient(176deg,#282b22,#14160f)',
            borderRadius: 2,
          }}
        />
      </Yaw>

      <Plant x={208} y={106} s={1.2} />
    </div>
  );
}

const HOTEL_W = 280;
const HOTEL_D = 186;

function Hotel() {
  return (
    <div className="lws-v" data-v="hotel">
      <Plinth w={HOTEL_W} d={HOTEL_D} />

      {/* curved alcove: arched back wall panel + two angled wings with thickness */}
      <WallSlab x={56} yFront={56} w={170} h={144} t={10} m={M.ivory} radius={14}>
        <div
          style={{
            position: 'absolute',
            left: 16,
            top: 10,
            width: 138,
            height: 134,
            transform: 'translateZ(0.5px)',
            borderRadius: '69px 69px 0 0',
            background: 'linear-gradient(176deg,#ddd0ae 0%,#c8b990 100%)',
            boxShadow:
              'inset 0 10px 20px rgba(38,34,24,.34), inset 6px 0 14px rgba(38,34,24,.16),' +
              'inset 0 0 0 1px rgba(255,255,255,.45)',
          }}
        />
        <Screen x={22} y={28} w={128} h={78}>
          <span className="lws-land" />
          <span className="lws-scr-h lws-scr-h-l lws-scr-over">Welcome</span>
          <span className="lws-scr-k lws-scr-over2 lws-scr-sm">Breakfast 6–10 · Spa until 9</span>
        </Screen>
      </WallSlab>
      <Yaw x={58} y={58} deg={-38}>
        <div style={{ ...flat(-40, -9, 40, 9, 112), background: M.ivory.top, borderRadius: 6 }} />
        <div
          style={{
            ...wallY(-40, 0, 40, 112),
            background: 'linear-gradient(176deg,#f4ecd7 0%,#e0d4b6 100%)',
            borderRadius: '10px 0 0 0',
            boxShadow: 'inset -10px -18px 26px rgba(38,34,24,.14), inset 1px 0 0 rgba(255,255,255,.5)',
          }}
        />
      </Yaw>
      <Yaw x={224} y={58} deg={38}>
        <div style={{ ...flat(0, -9, 38, 9, 112), background: M.ivory.side, borderRadius: 6 }} />
        <div
          style={{
            ...wallY(0, 0, 38, 112),
            background: 'linear-gradient(176deg,#d6c8a3 0%,#bdad85 100%)',
            borderRadius: '0 10px 0 0',
            boxShadow: 'inset 10px -18px 26px rgba(38,34,24,.2)',
          }}
        />
      </Yaw>

      {/* fluted brass reception desk */}
      <Cast x={78} y={108} w={140} h={54} />
      <Box
        x={92}
        y={94}
        w={108}
        d={34}
        h={34}
        radius={6}
        m={M.brass}
        top="linear-gradient(146deg,#f4e0ab,#d8b667)"
        front={
          'repeating-linear-gradient(90deg, rgba(255,255,255,.28) 0 1.4px, rgba(0,0,0,.14) 1.4px 3px, rgba(255,255,255,0) 3px 7px),' +
          'linear-gradient(176deg,#d3ac5b 0%,#a8801f 100%)'
        }
      />
      <div
        style={{
          ...flat(98, 96, 96, 30, 34.4),
          borderRadius: '50%',
          background:
            'radial-gradient(50% 50% at 46% 42%, rgba(255,228,158,.6) 0%, rgba(255,228,158,0) 72%)',
        }}
      />
      {/* two table lamps */}
      {[100, 178].map((px) => (
        <div key={`l${px}`} style={{ position: 'absolute', left: 0, top: 0, transformStyle: 'preserve-3d' }}>
          <div style={{ ...wallY(px + 8, 110, 3.5, 11, 34), background: '#9b7729' }} />
          <div
            style={{
              ...wallY(px, 110, 20, 15, 45),
              background: 'linear-gradient(180deg,#fff6dd,#e7cb8c)',
              clipPath: 'polygon(20% 0, 80% 0, 100% 100%, 0 100%)',
              boxShadow: '0 0 12px rgba(255,214,128,.6)',
            }}
          />
          <div
            className="lws-lamp"
            style={{
              ...flat(px - 14, 100, 48, 32, 35),
              borderRadius: '50%',
              background:
                'radial-gradient(50% 50% at 50% 50%, rgba(255,214,128,.8) 0%, rgba(255,214,128,0) 72%)',
            }}
          />
        </div>
      ))}

      {/* rug, armchair, luggage */}
      <div
        style={{
          ...flat(86, 138, 104, 36, 0.9),
          borderRadius: '50%',
          background:
            'radial-gradient(60% 58% at 46% 40%, #cdb98f 0%, #b9a171 66%, #a68d5c 100%)',
          boxShadow: 'inset 0 0 0 2.5px rgba(255,253,244,.65), 0 1px 2px rgba(46,40,26,.18)',
        }}
      />
      <Cast x={196} y={126} w={54} h={34} o={0.8} />
      <Box x={204} y={122} w={34} d={26} h={15} radius={5} m={M.slate} />
      <div
        style={{
          ...wallY(204, 126, 34, 22, 15),
          background: 'linear-gradient(176deg,#587284,#3a505e)',
          borderRadius: '7px 7px 0 0',
        }}
      />
      <div style={{ ...wallX(238, 122, 26, 12, 15), background: '#2a3c47', borderRadius: 3 }} />
      <Cast x={50} y={132} w={58} h={30} o={0.8} />
      <Box x={58} y={130} w={18} d={12} h={24} radius={3} m={M.oak} />
      <Box x={78} y={138} w={15} d={10} h={19} radius={3} m={M.walnut} />

      <Plant x={28} y={112} s={1.3} />
      <Plant x={238} y={104} s={0.85} />
    </div>
  );
}

const RETAIL_W = 262;
const RETAIL_D = 176;

const GARMENTS = ['#d96a4c', '#f2ebd8', '#25513a', '#c9ab72', '#7d8f83'];

function Retail() {
  return (
    <div className="lws-v" data-v="retail">
      <Plinth w={RETAIL_W} d={RETAIL_D} />

      <WallSlab
        x={38}
        yFront={46}
        w={186}
        h={136}
        t={9}
        m={M.ivory}
        radius={8}
        face="linear-gradient(176deg,#f4edd9 0%,#e2d6b8 64%,#cfc09c 100%)"
      >
        <div
          style={{
            position: 'absolute',
            left: 16,
            top: 14,
            width: 74,
            height: 122,
            transform: 'translateZ(0.5px)',
            borderRadius: '37px 37px 0 0',
            background: 'linear-gradient(176deg,#d8cba8 0%,#c2b28c 100%)',
            boxShadow: 'inset 0 9px 18px rgba(38,34,24,.3), inset 5px 0 12px rgba(38,34,24,.14)',
          }}
        />
      </WallSlab>

      {/* slim dark metal shopfront frame — posts land on the tier, top bar
          meets the wall height so it reads as a frame, not scaffolding */}
      <div style={{ ...wallY(36, 152, 3.5, 128), background: 'linear-gradient(176deg,#4d5146,#1e211a)', borderRadius: 1 }} />
      <div style={{ ...wallY(138, 152, 3.5, 128), background: 'linear-gradient(176deg,#3e4239,#15170f)', borderRadius: 1 }} />
      <div
        style={{
          ...wallY(36, 152, 105, 3.5, 124.5),
          background: 'linear-gradient(176deg,#4d5146,#2c3028)',
          borderRadius: 1,
        }}
      />
      <div style={{ ...wallY(36, 152, 105, 2, 84), background: 'rgba(58,62,52,.7)' }} />
      <div style={{ ...flat(34, 148, 110, 7, 0.7), background: 'rgba(38,34,24,.24)', borderRadius: 3 }} />

      {/* clothes rail with six hanging garments */}
      <Cast x={44} y={86} w={98} h={34} o={0.8} />
      <div style={{ ...wallY(52, 96, 3, 78), background: 'linear-gradient(180deg,#746a5a,#413a2e)' }} />
      <div style={{ ...wallY(124, 96, 3, 78), background: 'linear-gradient(180deg,#63594a,#383226)' }} />
      <div
        style={{
          ...wallY(50, 97, 78, 3.5, 74.5),
          background: 'linear-gradient(180deg,#e0c68f,#96793f)',
          borderRadius: 2,
        }}
      />
      {GARMENTS.map((c, i) => (
        <div
          key={c}
          style={{
            ...wallY(54 + i * 15, 98, 20, 54, 22),
            /* Shade as an OVERLAY over an opaque base. A gradient that ends in
               an rgba() stop interpolates the ALPHA too, which made the lower
               half of every garment see-through. */
            background: `linear-gradient(176deg, rgba(255,255,255,.2) 0%, rgba(24,18,8,.44) 100%), ${c}`,
            clipPath:
              'polygon(50% 0, 74% 4%, 100% 18%, 86% 26%, 89% 100%, 11% 100%, 14% 26%, 0 18%, 26% 4%)',
          }}
        />
      ))}

      {/* display table with folded stacks */}
      <Cast x={36} y={132} w={94} h={44} />
      <Box x={46} y={120} w={76} d={30} h={24} radius={4} m={M.oak} />
      <Box
        x={54}
        y={126}
        w={24}
        d={14}
        h={13}
        z0={24}
        radius={1}
        m={M.cream}
        front="linear-gradient(180deg,#f2e9d4 0 46%,#df7050 46% 100%)"
      />
      <Box x={84} y={128} w={22} d={12} h={9} z0={24} radius={1} m={M.forest} />
      <div
        style={{
          ...flat(94, 132, 14, 9, 25),
          borderRadius: '50%',
          background: 'radial-gradient(60% 58% at 38% 32%, #f2dca6, #a8801f)',
          boxShadow: '0 1px 2px rgba(46,40,26,.35)',
        }}
      />

      {/* freestanding portrait totem — the shop's window screen */}
      <div
        style={{
          ...flat(140, 138, 94, 34, 0.8),
          borderRadius: '50%',
          background:
            'radial-gradient(50% 50% at 50% 42%, rgba(255,232,178,.5) 0%, rgba(255,232,178,0) 72%)',
        }}
      />
      <Cast x={146} y={126} w={78} h={40} />
      <Box x={154} y={128} w={64} d={16} h={7} radius={3} m={M.charcoal} />
      <div style={{ ...flat(156, 122, 60, 14, 7), background: '#2b2e26', borderRadius: 2 }} />
      <div
        className="lws-wallface"
        style={{
          ...wallY(154, 134, 64, 132, 7),
          background: 'linear-gradient(176deg,#3a3e34,#1b1e17)',
          borderRadius: '5px 5px 0 0',
          transformStyle: 'preserve-3d',
          boxShadow: '4px 5px 12px rgba(38,34,24,.4)',
        }}
      >
        <Screen x={3} y={4} w={58} h={120}>
          <span className="lws-scr-k lws-scr-sm">Noble &amp; Co.</span>
          <span className="lws-scr-h lws-scr-h-s">
            Style
            <br />
            Moves
            <br />
            People
          </span>
          <span className="lws-coat" />
          <span className="lws-scr-band lws-scr-band-coral" />
        </Screen>
      </div>

      <Plant x={216} y={96} s={1.05} />
    </div>
  );
}

/* ---------- scene ---------- */

const SCENE_CSS = `
.lws-fit{container-type:inline-size;width:100%;aspect-ratio:800/548;position:relative;overflow:hidden}
/* Coarse viewport-stepped fallback for engines without CSS trig (pre-2023):
   never lets the logical canvas blow out the layout, merely crops less
   gracefully. Overridden below wherever tan/atan2 are supported. */
.lws-scale{position:absolute;inset:0;width:800px;height:548px;transform-origin:top left;
  transform:scale(.42)}
@media (min-width:480px){.lws-scale{transform:scale(.56)}}
@media (min-width:680px){.lws-scale{transform:scale(.8)}}
@media (min-width:1200px){.lws-scale{transform:scale(.92)}}
@supports (transform:scale(tan(atan2(1px,1px)))){
  /* atan2(length,length) -> angle whose tan is their unitless ratio */
  .lws-scale{transform:scale(tan(atan2(100cqw,800px)))}
}
.lws-stage{position:absolute;inset:0}
/* Each vignette gets its OWN perspective layer with an IDENTICAL camera (same
   box, same perspective + origin), so the projection matches exactly while the
   three composite in plain DOM order. Without this they share one 3D context
   and the browser sorts whole planes by a single depth each — which put the
   hotel's ground shadow straight through the café's menu board. The plinths
   never interpenetrate, so back-to-front paint order is the correct answer. */
.lws-cell{position:absolute;inset:0;perspective:2100px;perspective-origin:50% 34%}
.lws-world{position:absolute;left:70px;top:30px;width:660px;height:520px;transform-style:preserve-3d;
  transform:rotateX(54deg) rotateZ(-20deg) scale3d(1.06,1.06,1.06);
  --cafe-x:16px;--cafe-y:276px;--hotel-x:206px;--hotel-y:22px;--retail-x:366px;--retail-y:288px}
.lws-v{position:absolute;transform-style:preserve-3d;transition:transform .5s cubic-bezier(.22,.7,.3,1)}
.lws-v[data-v="cafe"]{left:var(--cafe-x);top:var(--cafe-y)}
.lws-v[data-v="hotel"]{left:var(--hotel-x);top:var(--hotel-y)}
.lws-v[data-v="retail"]{left:var(--retail-x);top:var(--retail-y)}

/* Active place: lift + ring + brighter screens. NEVER opacity on these groups —
   opacity<1 forces transform-style:flat and would collapse the whole vignette
   onto the ground plane. The ring is a leaf, so its opacity is safe. */
.lws-stage[data-active="cafe"] .lws-v[data-v="cafe"],
.lws-stage[data-active="hotel"] .lws-v[data-v="hotel"],
.lws-stage[data-active="retail"] .lws-v[data-v="retail"]{transform:translateZ(30px)}
.lws-ring{opacity:0;transform-origin:50% 50%;transition:opacity .4s ease}
.lws-stage[data-active="cafe"] .lws-v[data-v="cafe"] .lws-ring,
.lws-stage[data-active="hotel"] .lws-v[data-v="hotel"] .lws-ring,
.lws-stage[data-active="retail"] .lws-v[data-v="retail"] .lws-ring{opacity:1}
.lws-stage[data-active="cafe"] .lws-v[data-v="cafe"] .lws-scr,
.lws-stage[data-active="hotel"] .lws-v[data-v="hotel"] .lws-scr,
.lws-stage[data-active="retail"] .lws-v[data-v="retail"] .lws-scr{
  animation:none;box-shadow:0 0 0 1px rgba(255,255,255,.55),0 0 30px rgba(226,178,82,.75)}

/* warm ground wash unifying the three plinths */
.lws-wash{position:absolute;left:-60px;top:-60px;width:780px;height:640px;transform:translateZ(0.2px);
  border-radius:50%;
  background:radial-gradient(38% 30% at 26% 74%,rgba(176,138,62,.13) 0%,transparent 70%),
    radial-gradient(34% 28% at 54% 26%,rgba(31,66,48,.09) 0%,transparent 70%),
    radial-gradient(36% 30% at 82% 68%,rgba(217,106,76,.1) 0%,transparent 70%)}

/* sync thread lying on the ground, joining the three plinths — the one
   element that says "one system, many places", so it must actually read */
.lws-thread{position:absolute;left:0;top:0;width:100%;height:100%;transform:translateZ(1px);
  overflow:visible;filter:drop-shadow(0 1px 0 rgba(255,255,255,.85))}
.lws-thread-m{display:none}
.lws-thread path{fill:none;stroke:#1f4230;stroke-width:3.4;stroke-dasharray:8 8;
  stroke-linecap:round;animation:lws-thread-flow 2.6s linear infinite}
.lws-thread circle{fill:#d96a4c;stroke:#f7f3ea;stroke-width:2.6}

/* awning scallop — semicircular teeth hanging off the front edge */
.lws-scallop{position:absolute;left:0;bottom:-8px;width:100%;height:10px;
  background:radial-gradient(circle at 9px 1px,#1f4230 8px,rgba(0,0,0,0) 8.5px) 0 0/18px 12px repeat-x}

/* screen micro-typography (decorative; aria-hidden at the mount) */
.lws-scr-k{font-family:var(--font-mono),monospace;font-size:5.2px;letter-spacing:.14em;
  text-transform:uppercase;color:#8a6a25;margin-bottom:2px;white-space:nowrap;overflow:hidden}
.lws-scr-h{font-family:var(--lw-serif);font-weight:600;line-height:1.02;letter-spacing:-.018em;
  color:#1c3b28;margin-bottom:3px}
.lws-scr-h-s{font-size:13px}
.lws-scr-h-m{font-size:14px}
.lws-scr-h-l{font-size:17px}
/* align-items:center, NOT baseline: a flex item with overflow:hidden takes its
   margin-box bottom as its baseline, which floated every price one row up. */
.lws-scr-row{display:flex;justify-content:space-between;align-items:center;gap:3px;font-size:5.6px;
  border-top:1px dotted rgba(31,66,48,.34);padding-top:2px;margin-top:2px;color:#2f4536}
.lws-scr-row i{font-style:normal;white-space:nowrap;overflow:hidden;min-width:0}
.lws-scr-row b{white-space:nowrap}
.lws-scr-row b{font-family:var(--font-mono),monospace;color:#8a6a25}
.lws-scr-band{height:7px;border-radius:2px;margin-top:auto;
  background:linear-gradient(90deg,#1f4230 0 34%,#b08a3e 34% 56%,#e4d9bd 56%)}
.lws-scr-band-coral{background:linear-gradient(90deg,#d96a4c 0 46%,#1f4230 46% 62%,#e4d9bd 62%)}

/* CSS-drawn screen imagery */
.lws-latte{flex:none;width:34px;height:34px;border-radius:50%;margin:1px auto 4px;
  background:
    radial-gradient(circle at 50% 46%,#f3e2c4 0 23%,rgba(0,0,0,0) 23.5%),
    radial-gradient(circle at 39% 33%,rgba(255,255,255,.6) 0 14%,rgba(0,0,0,0) 34%),
    radial-gradient(circle at 50% 50%,#b3834c 0 38%,rgba(0,0,0,0) 38.5%),
    radial-gradient(circle at 50% 50%,#fffdf6 0 49%,rgba(0,0,0,0) 49.5%);
  box-shadow:0 1px 3px rgba(38,34,24,.28)}
.lws-land{flex:none;display:block;width:100%;height:26px;border-radius:2px;margin-bottom:3px;
  background:
    radial-gradient(circle at 76% 24%,#ffe9ae 0 8%,rgba(255,233,174,.4) 8% 15%,rgba(0,0,0,0) 16%),
    radial-gradient(150% 108% at 16% 126%,#2c5540 0 42%,rgba(0,0,0,0) 43%),
    radial-gradient(128% 96% at 74% 132%,#43765a 0 44%,rgba(0,0,0,0) 45%),
    linear-gradient(180deg,#c3dbe3 0%,#e9ddc5 58%,#d6c5a1 100%)}
.lws-coat{flex:none;display:block;width:28px;height:36px;margin:4px auto 3px;
  background:linear-gradient(176deg,#33372e,#1c1f19);
  clip-path:polygon(50% 0,72% 6%,100% 24%,88% 33%,90% 100%,10% 100%,12% 33%,0 24%,28% 6%)}
.lws-scr-over{margin-top:-1px}
.lws-scr-over2{margin-top:auto;margin-bottom:0}

/* Idle motion — three animated properties total, all off on request. */
@keyframes lws-thread-flow{to{stroke-dashoffset:-14}}
@keyframes lws-glow{0%,100%{box-shadow:0 0 0 1px rgba(255,255,255,.45),0 0 12px rgba(214,168,76,.3)}
  50%{box-shadow:0 0 0 1px rgba(255,255,255,.45),0 0 24px rgba(214,168,76,.55)}}
@keyframes lws-lamp{0%,100%{opacity:.82}50%{opacity:1}}
.lws-scr{animation:lws-glow 6s ease-in-out infinite}
.lws-lamp{animation:lws-lamp 5.2s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){
  .lws-scr,.lws-lamp,.lws-thread path{animation:none}
  .lws-v,.lws-ring{transition:none}
}

/* ── Dedicated mobile arrangement ──────────────────────────────────────────
   Not a shrunken desktop: its own logical canvas, its own tighter/taller
   triangle (hotel top-centre, café lower-left, retail lower-right) and its
   own thread path, so each plinth stays over half the viewport wide. */
@media (max-width:640px){
  .lws-fit{aspect-ratio:480/460}
  .lws-scale{width:480px;height:460px;transform:scale(.58)}
  .lws-world{left:40px;top:35px;width:400px;height:390px;
    transform:rotateX(53deg) rotateZ(-20deg);
    --cafe-x:-56px;--cafe-y:282px;--hotel-x:90px;--hotel-y:48px;--retail-x:92px;--retail-y:194px}
  .lws-wash{left:-70px;top:-40px;width:540px;height:510px}
  .lws-thread-d{display:none}
  .lws-thread-m{display:block}
  /* micro-copy is noise at this size — headline + imagery only */
  .lws-scr-sm,.lws-scr-row,.lws-scr-band{display:none}
  .lws-scr-h{margin-bottom:0}
  .lws-scr-h-s{font-size:14px}
  .lws-scr-h-m{font-size:16px}
  .lws-scr-h-l{font-size:19px}
  .lws-latte{width:40px;height:40px}
  .lws-land{height:34px}
  .lws-coat{width:36px;height:48px}
}
@media (max-width:640px) and (min-width:400px){.lws-scale{transform:scale(.75)}}
@media (max-width:640px) and (min-width:520px){.lws-scale{transform:scale(.98)}}
@media (max-width:640px){
  @supports (transform:scale(tan(atan2(1px,1px)))){
    .lws-scale{transform:scale(tan(atan2(100cqw,480px)))}
  }
}
`;

/** One perspective layer holding one vignette's ground plane. */
function Layer({ children }: { children: ReactNode }) {
  return (
    <div className="lws-cell">
      <div className="lws-world">{children}</div>
    </div>
  );
}

export default function WorldsScene({ active = null }: WorldsSceneProps) {
  return (
    <div className="lws-fit">
      <style dangerouslySetInnerHTML={{ __html: SCENE_CSS }} />
      <div className="lws-scale">
        <div className="lws-stage" data-active={active ?? undefined}>
          {/* ground layer: wash + sync thread, under every plinth shadow */}
          <Layer>
            <div className="lws-wash" />
            <svg className="lws-thread lws-thread-d" viewBox="0 0 660 520" aria-hidden="true">
              <path d="M152 458 C 232 428, 252 284, 346 222 C 424 276, 444 406, 498 464" />
              <circle cx="152" cy="458" r="4.6" />
              <circle cx="346" cy="222" r="4.6" />
              <circle cx="498" cy="464" r="4.6" />
            </svg>
            <svg className="lws-thread lws-thread-m" viewBox="0 0 400 390" aria-hidden="true">
              <path d="M80 464 C 168 476, 240 430, 268 380 C 296 330, 292 274, 262 240" />
              <circle cx="80" cy="464" r="4.6" />
              <circle cx="268" cy="380" r="4.6" />
              <circle cx="262" cy="240" r="4.6" />
            </svg>
          </Layer>
          {/* one perspective layer each, composited back to front */}
          <Layer>
            <Hotel />
          </Layer>
          <Layer>
            <Retail />
          </Layer>
          <Layer>
            <Cafe />
          </Layer>
        </div>
      </div>
    </div>
  );
}

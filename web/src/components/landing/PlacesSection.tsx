'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { WorldPlace } from './WorldsScene';

/**
 * The board's proposed interaction, made real in live HTML:
 *   01 explore a location → 02 reveal its screens → 03 preview its content.
 *
 * Everything here is an ILLUSTRATIVE workspace with synthetic example data —
 * the caption says so on the surface itself — because the page must never
 * present fictional telemetry as real customer state.
 */

interface Screen {
  id: string;
  name: string;
  nowPlaying: string;
  schedule: Array<{ t: string; what: string }>;
  board: ReactNode;
}

interface Place {
  id: WorldPlace;
  name: string;
  kind: string;
  story: string;
  screens: Screen[];
}

/* ---- preview boards (larger, legible cousins of the diorama screens) ---- */

function Board({ children, portrait = false }: { children: ReactNode; portrait?: boolean }) {
  return (
    <div className={`lwp-board ${portrait ? 'lwp-board-portrait' : ''}`}>{children}</div>
  );
}

const MENU_BOARD = (
  <Board>
    <span className="lwp-b-kicker">Riverside Café · Downtown</span>
    <span className="lwp-b-title">Morning Menu</span>
    {[
      ['Flat white', '4.00'],
      ['Cardamom bun', '3.50'],
      ['Shakshuka', '9.50'],
    ].map(([n, p]) => (
      <span key={n} className="lwp-b-row">
        <i>{n}</i>
        <b>{p}</b>
      </span>
    ))}
    <span className="lwp-b-foot">Served until 11:30</span>
  </Board>
);

const COUNTER_BOARD = (
  <Board>
    <span className="lwp-b-kicker">Riverside Café · Counter</span>
    <span className="lwp-b-title lwp-b-serif">Beans, freshly roasted</span>
    <span className="lwp-b-band" />
    <span className="lwp-b-foot">250g bags at the till</span>
  </Board>
);

const WINDOW_BOARD = (
  <Board>
    <span className="lwp-b-kicker">Riverside Café · Window</span>
    <span className="lwp-b-title lwp-b-serif">Good food, brighter days</span>
    <span className="lwp-b-foot">Open 7–17 · Weekends 8–15</span>
  </Board>
);

const WELCOME_BOARD = (
  <Board>
    <span className="lwp-b-kicker">Horizon Hotel · Lobby</span>
    <span className="lwp-b-title lwp-b-serif">Welcome</span>
    <span className="lwp-b-band" />
    <span className="lwp-b-foot">Check-in from 15:00 · Front desk 24h</span>
  </Board>
);

const EVENTS_BOARD = (
  <Board>
    <span className="lwp-b-kicker">Horizon Hotel · Events</span>
    <span className="lwp-b-title">Today</span>
    {[
      ['09:00', 'Morning yoga · Terrace'],
      ['18:30', 'Wine tasting · Cellar'],
    ].map(([t, w]) => (
      <span key={t} className="lwp-b-row">
        <b>{t}</b>
        <i>{w}</i>
      </span>
    ))}
    <span className="lwp-b-foot">Ask the front desk to join</span>
  </Board>
);

const BREAKFAST_BOARD = (
  <Board>
    <span className="lwp-b-kicker">Horizon Hotel · Breakfast room</span>
    <span className="lwp-b-title">Breakfast 6:00–10:00</span>
    <span className="lwp-b-row">
      <i>Eggs any style</i>
      <b>·</b>
    </span>
    <span className="lwp-b-row">
      <i>Fresh pastries &amp; fruit</i>
      <b>·</b>
    </span>
    <span className="lwp-b-foot">Late risers: espresso bar until 12</span>
  </Board>
);

const PORTRAIT_BOARD = (
  <Board portrait>
    <span className="lwp-b-kicker">Noble &amp; Co. · Window</span>
    <span className="lwp-b-title lwp-b-serif">
      Style
      <br />
      moves
      <br />
      people
    </span>
    <span className="lwp-b-band lwp-b-band-coral" />
    <span className="lwp-b-foot">New season, in store now</span>
  </Board>
);

const FITTING_BOARD = (
  <Board>
    <span className="lwp-b-kicker">Noble &amp; Co. · Fitting rooms</span>
    <span className="lwp-b-title">Need another size?</span>
    <span className="lwp-b-foot">Ask any colleague — we&apos;ll bring it over</span>
  </Board>
);

const TILL_BOARD = (
  <Board>
    <span className="lwp-b-kicker">Noble &amp; Co. · Till</span>
    <span className="lwp-b-title lwp-b-serif">Seasonal promotion</span>
    <span className="lwp-b-row">
      <i>Wool coats</i>
      <b>−20%</b>
    </span>
    <span className="lwp-b-foot">Ends Sunday</span>
  </Board>
);

/* ---- illustrative data ---- */

const PLACES: Place[] = [
  {
    id: 'cafe',
    name: 'Riverside Café',
    kind: 'Café · Downtown',
    story:
      'New special, new price? Change the menu board once — every location updates while the espresso is still warm.',
    screens: [
      {
        id: 'menu',
        name: 'Menu board',
        nowPlaying: 'Morning Menu',
        schedule: [
          { t: '06:00', what: 'Morning Menu' },
          { t: '11:30', what: 'Lunch Specials' },
          { t: '15:00', what: 'Good Food Mood' },
        ],
        board: MENU_BOARD,
      },
      {
        id: 'counter',
        name: 'Counter screen',
        nowPlaying: 'Beans promo',
        schedule: [
          { t: '07:00', what: 'Beans promo' },
          { t: '12:00', what: 'Lunch pairing' },
        ],
        board: COUNTER_BOARD,
      },
      {
        id: 'window',
        name: 'Window board',
        nowPlaying: 'Opening hours',
        schedule: [
          { t: 'All day', what: 'Opening hours' },
        ],
        board: WINDOW_BOARD,
      },
    ],
  },
  {
    id: 'hotel',
    name: 'Horizon Hotel',
    kind: 'Hotel · City centre',
    story:
      'Greet tonight’s arrivals, list tomorrow’s events, and switch the lobby to the breakfast screen at six — without anyone at the desk.',
    screens: [
      {
        id: 'lobby',
        name: 'Lobby welcome',
        nowPlaying: 'Welcome loop',
        schedule: [
          { t: '06:00', what: 'Breakfast hours' },
          { t: '10:00', what: 'Welcome loop' },
          { t: '17:00', what: 'Tonight at Horizon' },
        ],
        board: WELCOME_BOARD,
      },
      {
        id: 'events',
        name: 'Events board',
        nowPlaying: 'Today’s events',
        schedule: [
          { t: '08:00', what: 'Today’s events' },
          { t: '20:00', what: 'Tomorrow preview' },
        ],
        board: EVENTS_BOARD,
      },
      {
        id: 'breakfast',
        name: 'Breakfast room',
        nowPlaying: 'Breakfast menu',
        schedule: [
          { t: '06:00', what: 'Breakfast menu' },
          { t: '10:00', what: 'Lunch & bar hours' },
        ],
        board: BREAKFAST_BOARD,
      },
    ],
  },
  {
    id: 'retail',
    name: 'Noble & Co.',
    kind: 'Retail · West End',
    story:
      'Launch the seasonal window promo across every store at nine sharp — and pull it the moment it ends.',
    screens: [
      {
        id: 'window',
        name: 'Window portrait',
        nowPlaying: 'New season',
        schedule: [
          { t: '09:00', what: 'New season' },
          { t: '18:00', what: 'Evening loop' },
        ],
        board: PORTRAIT_BOARD,
      },
      {
        id: 'fitting',
        name: 'Fitting rooms',
        nowPlaying: 'Size & service',
        schedule: [{ t: 'All day', what: 'Size & service' }],
        board: FITTING_BOARD,
      },
      {
        id: 'till',
        name: 'Till screen',
        nowPlaying: 'Seasonal promotion',
        schedule: [
          { t: '09:00', what: 'Seasonal promotion' },
          { t: 'Sun 18:00', what: 'Ends automatically' },
        ],
        board: TILL_BOARD,
      },
    ],
  },
];

const CSS = `
.lw-places{padding:var(--lw-sec-y) 0}
.lwp-head{max-width:46rem;margin-bottom:34px}
.lwp-head h2{font-size:clamp(1.9rem,3.4vw,2.9rem);margin:14px 0 12px}
.lwp-head p{color:var(--lw-ink-2);line-height:1.65;max-width:36rem}

.lwp-panel{display:grid;grid-template-columns:250fr 250fr 300fr;overflow:hidden}
.lwp-col{padding:22px;min-width:0}
.lwp-col+.lwp-col{border-left:1px solid var(--lw-hair-2)}
.lwp-step{margin-bottom:14px}

.lwp-loc{display:flex;flex-direction:column;gap:8px}
.lwp-loc button{display:flex;align-items:center;gap:12px;text-align:left;border-radius:14px;
  padding:12px 14px;border:1px solid transparent;transition:background .2s,border-color .2s}
.lwp-loc button:hover{background:var(--lw-paper-2)}
.lwp-loc button[aria-pressed="true"]{background:var(--lw-paper-2);border-color:var(--lw-hair)}
.lwp-loc-swatch{width:40px;height:40px;border-radius:12px;flex:none;display:grid;place-items:center;
  border:1px solid var(--lw-hair-2)}
.lwp-loc-swatch i{width:14px;height:14px;border-radius:4px}
.lwp-loc-name{display:block;font-weight:650;font-size:.94rem}
.lwp-loc-kind{display:block;color:var(--lw-muted);font-size:.74rem;margin-top:1px}
.lwp-loc-go{margin-left:auto;color:var(--lw-muted);opacity:0;transition:opacity .2s}
.lwp-loc button:hover .lwp-loc-go,.lwp-loc button[aria-pressed="true"] .lwp-loc-go{opacity:.8}

.lwp-scr{display:flex;flex-direction:column;gap:6px}
.lwp-scr button{display:flex;align-items:center;gap:10px;text-align:left;border-radius:12px;
  padding:10px 12px;border:1px solid transparent;transition:background .2s,border-color .2s}
.lwp-scr button:hover{background:var(--lw-paper-2)}
.lwp-scr button[aria-pressed="true"]{background:var(--lw-paper-2);border-color:var(--lw-hair)}
.lwp-scr-dot{width:8px;height:8px;border-radius:50%;background:var(--lw-forest);flex:none}
.lwp-scr-name{font-weight:600;font-size:.86rem}
.lwp-scr-now{display:block;color:var(--lw-muted);font-size:.72rem}

.lwp-preview{display:flex;flex-direction:column;gap:14px}
.lwp-board{background:var(--lw-screen);border:3px solid #2c2f28;border-radius:10px;
  box-shadow:0 0 0 1px rgba(255,255,255,.5),0 16px 34px rgba(35,38,31,.14),0 0 26px rgba(176,138,62,.18);
  padding:16px 18px;display:flex;flex-direction:column;gap:6px;color:var(--lw-forest);
  aspect-ratio:16/10;justify-content:space-between}
.lwp-board-portrait{aspect-ratio:10/13;max-width:210px}
.lwp-b-kicker{font-family:var(--font-mono),monospace;font-size:.56rem;letter-spacing:.15em;
  text-transform:uppercase;color:var(--lw-brass-ink)}
.lwp-b-title{font-weight:700;font-size:1.05rem;letter-spacing:-.02em;color:var(--lw-ink)}
.lwp-b-serif{font-family:var(--lw-serif);font-weight:500;font-size:1.5rem;line-height:1.08;color:var(--lw-forest)}
.lwp-b-row{display:flex;justify-content:space-between;gap:10px;align-items:baseline;font-size:.82rem;
  color:var(--lw-ink-2);border-top:1px dotted rgba(31,66,48,.3);padding-top:5px}
.lwp-b-row i{font-style:normal}
.lwp-b-row b{font-family:var(--font-mono),monospace;font-weight:600;color:var(--lw-forest)}
.lwp-b-band{height:12px;border-radius:3px;margin:4px 0;
  background:linear-gradient(90deg,var(--lw-forest) 0 36%,var(--lw-brass) 36% 56%,var(--lw-stone) 56%)}
.lwp-b-band-coral{background:linear-gradient(90deg,var(--lw-coral) 0 46%,var(--lw-stone) 46%)}
.lwp-b-foot{color:var(--lw-muted);font-size:.7rem}

.lwp-sched{border-top:1px solid var(--lw-hair-2);padding-top:10px}
.lwp-sched-row{display:flex;gap:12px;align-items:baseline;font-size:.82rem;color:var(--lw-ink-2);padding:3px 0}
.lwp-sched-row b{font-family:var(--font-mono),monospace;font-weight:600;font-size:.74rem;
  color:var(--lw-brass-ink);min-width:58px}
.lwp-sched-row[data-now="true"] i{color:var(--lw-ink);font-weight:600}
.lwp-sched-row i{font-style:normal}
.lwp-now-chip{display:inline-flex;align-items:center;gap:6px;font-size:.7rem;color:var(--lw-forest);
  font-weight:650}
.lwp-now-chip i{width:7px;height:7px;border-radius:50%;background:var(--lw-forest)}

.lwp-story{margin-top:18px;color:var(--lw-ink-2);font-size:.95rem;line-height:1.6;max-width:44rem}
.lwp-caption{margin-top:10px;color:var(--lw-muted);font-size:.72rem}

@media (max-width:900px){
  .lwp-panel{grid-template-columns:1fr}
  .lwp-col+.lwp-col{border-left:0;border-top:1px solid var(--lw-hair-2)}
  .lwp-board-portrait{max-width:none;aspect-ratio:16/10}
}
`;

export default function PlacesSection({
  place,
  onPlaceChange,
}: {
  place: WorldPlace;
  onPlaceChange: (p: WorldPlace) => void;
}) {
  const current = PLACES.find((p) => p.id === place) ?? PLACES[0];
  const [screenId, setScreenId] = useState(current.screens[0].id);
  // The place can change from OUTSIDE this section (the hero's explore
  // buttons call onExplore → setPlace). Track the transition during render so
  // the screen selection resets exactly as an in-panel pick would — two
  // locations share a screen id ("window"), so a stale id would otherwise
  // carry a selection across places.
  const [seenPlace, setSeenPlace] = useState(place);
  if (seenPlace !== place) {
    setSeenPlace(place);
    setScreenId(current.screens[0].id);
  }
  const screen = current.screens.find((s) => s.id === screenId) ?? current.screens[0];

  const pick = (p: Place) => {
    onPlaceChange(p.id);
    setScreenId(p.screens[0].id);
  };

  return (
    <section id="places" className="lw-places scroll-mt-20" aria-labelledby="placesTitle">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="lw-wrap">
        <div className="lwp-head">
          <span className="lw-mono lw-kicker">From place to screens to content</span>
          <h2 id="placesTitle" className="lw-h2">
            Pick a place. See what its screens are doing.
          </h2>
          <p>
            Open a location and its screens are right there — what each one is playing now, and
            what is scheduled next. No guesswork, no remote desktop.
          </p>
        </div>

        <div className="lw-card-surface lwp-panel">
          <div className="lwp-col">
            <span className="lw-mono lwp-step" id="lwp-step-loc" aria-hidden="true">
              01 · Explore a location
            </span>
            <div className="lwp-loc" role="group" aria-label="Explore a location">
              {PLACES.map((p) => (
                <button key={p.id} type="button" aria-pressed={p.id === current.id} onClick={() => pick(p)}>
                  <span className="lwp-loc-swatch" style={{ background: 'var(--lw-paper-2)' }}>
                    <i
                      style={{
                        background:
                          p.id === 'cafe'
                            ? 'var(--lw-brass)'
                            : p.id === 'hotel'
                              ? 'var(--lw-forest)'
                              : 'var(--lw-coral)',
                      }}
                    />
                  </span>
                  <span>
                    <span className="lwp-loc-name">{p.name}</span>
                    <span className="lwp-loc-kind">{p.kind}</span>
                  </span>
                  <span className="lwp-loc-go" aria-hidden="true">
                    →
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="lwp-col">
            <span className="lw-mono lwp-step" aria-hidden="true">
              02 · Reveal its screens
            </span>
            <div className="lwp-scr" role="group" aria-label={`Screens at ${current.name}`}>
              {current.screens.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={s.id === screen.id}
                  onClick={() => setScreenId(s.id)}
                >
                  <span className="lwp-scr-dot" aria-hidden="true" />
                  <span>
                    <span className="lwp-scr-name">{s.name}</span>
                    <span className="lwp-scr-now">Now playing · {s.nowPlaying}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="lwp-col">
            <span className="lw-mono lwp-step">03 · Preview its content</span>
            <div className="lwp-preview">
              {screen.board}
              <div className="lwp-sched">
                <span className="lwp-now-chip">
                  <i aria-hidden="true" />
                  Now playing · {screen.nowPlaying}
                </span>
                {screen.schedule.map((row) => (
                  <div key={row.t + row.what} className="lwp-sched-row" data-now={row.what === screen.nowPlaying}>
                    <b>{row.t}</b>
                    <i>{row.what}</i>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <p className="lwp-story">{current.story}</p>
        <p className="lwp-caption">Illustrative workspace — synthetic example data, not customer telemetry.</p>
      </div>
    </section>
  );
}

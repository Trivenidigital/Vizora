'use client';

/**
 * "Your locations" — the board's soft panel directly under the hero.
 *
 * It owns step 01 of the narrative (explore a location); the Places section
 * below keeps 02 and 03 (reveal its screens → preview its content), so the two
 * hand over rather than repeat. The screen counts therefore match the Places
 * section exactly — three screens per location, all playing — because a card
 * claiming an offline screen would contradict the "Now playing" line Places
 * shows for every one of them.
 */

import Image from 'next/image';

import { MiniWorld, type WorldPlace } from './WorldsScene';
import { WORLD_ASSETS } from './worldAssets';

interface LocationsSectionProps {
  /** Select this place and jump to the Places section. */
  onView: (place: WorldPlace) => void;
}

const LOCATIONS: Array<{
  id: WorldPlace;
  name: string;
  kind: string;
  online: number;
  offline: number;
}> = [
  { id: 'cafe', name: 'Riverside Café', kind: 'Café · Downtown', online: 3, offline: 0 },
  { id: 'hotel', name: 'Horizon Hotel', kind: 'Hotel · City centre', online: 3, offline: 0 },
  { id: 'retail', name: 'Noble & Co.', kind: 'Retail · West End', online: 3, offline: 0 },
];

const LOC_CSS = `
.lw-locations{padding:0 0 var(--lw-sec-y)}
.lwl-panel{background:var(--lw-card);border:1px solid var(--lw-hair-2);border-radius:26px;
  padding:clamp(22px,2.6vw,36px);
  box-shadow:0 1px 0 rgba(255,255,255,.8) inset,0 26px 60px rgba(35,38,31,.08)}
.lwl-head h2{font-size:clamp(1.35rem,2vw,1.7rem);margin-bottom:4px}
.lwl-head p{color:var(--lw-ink-2);font-size:.92rem}
.lwl-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:clamp(14px,1.6vw,22px);
  list-style:none;margin:22px 0 0;padding:0}
.lwl-card{display:flex;gap:14px;align-items:flex-start;background:var(--lw-paper);
  border:1px solid var(--lw-hair-2);border-radius:16px;padding:12px;min-width:0}
.lwl-thumb{flex:none;width:118px;aspect-ratio:4/3;border-radius:11px;overflow:hidden;
  background:var(--lw-paper-2);border:1px solid var(--lw-hair-2)}
.lwl-thumb img{width:100%;height:100%;object-fit:contain}
.lwl-body{min-width:0}
.lwl-card h3{font-family:var(--lw-serif);font-weight:540;font-size:1.02rem;letter-spacing:-.01em;
  line-height:1.2}
.lwl-meta{color:var(--lw-muted);font-size:.76rem;margin-top:2px}
.lwl-counts{display:flex;flex-direction:column;gap:3px;margin:9px 0 10px;font-size:.76rem;
  color:var(--lw-ink-2)}
.lwl-counts span{display:flex;align-items:center;gap:7px}
.lwl-counts i{width:6px;height:6px;border-radius:50%;flex:none;background:var(--lw-muted);opacity:.45}
.lwl-counts i[data-tone="on"]{background:#2f8f5b;opacity:1}
.lwl-counts i[data-tone="off"]{background:var(--lw-coral);opacity:1}
.lwl-view{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--lw-hair);
  border-radius:999px;padding:7px 14px;background:var(--lw-card);font-size:.79rem;font-weight:600;
  color:var(--lw-ink);transition:border-color .2s,box-shadow .2s,background .2s}
.lwl-view:hover{border-color:rgba(35,38,31,.28);box-shadow:0 8px 20px rgba(35,38,31,.09)}
.lwl-view:focus-visible{outline:2px solid var(--lw-forest);outline-offset:2px}
.lwl-note{margin-top:16px;color:var(--lw-muted);font-size:.72rem}

@media (max-width:900px){.lwl-grid{grid-template-columns:1fr}}
@media (max-width:420px){
  .lwl-card{flex-direction:column}
  .lwl-thumb{width:100%}
}
`;

export default function LocationsSection({ onView }: LocationsSectionProps) {
  return (
    <section id="locations" className="lw-locations" aria-labelledby="locationsTitle">
      <style dangerouslySetInnerHTML={{ __html: LOC_CSS }} />
      <div className="lw-wrap">
        <div className="lwl-panel">
          <div className="lwl-head">
            <h2 id="locationsTitle" className="lw-h2">
              Your locations
            </h2>
            <p>Manage your screens and keep every space in sync.</p>
          </div>
          <ul className="lwl-grid">
            {LOCATIONS.map((l) => (
              <li key={l.id} className="lwl-card">
                <div className="lwl-thumb" aria-hidden="true">
                  {WORLD_ASSETS[l.id] ? (
                    <Image
                      src={WORLD_ASSETS[l.id]!.src}
                      alt=""
                      width={WORLD_ASSETS[l.id]!.width}
                      height={WORLD_ASSETS[l.id]!.height}
                      loading="lazy"
                      /* px only, deliberately: any vw clause makes next/image drop every
                         srcset candidate below (smallest vw% x 640), so an "88vw" here
                         forced a 118px thumbnail to download w=640+ — and Chrome then
                         reused that larger cached file for the hero as well. */
                      sizes="(max-width:360px) 220px, (max-width:420px) 300px, 120px"
                    />
                  ) : (
                    <MiniWorld place={l.id} />
                  )}
                </div>
                <div className="lwl-body">
                  <h3>{l.name}</h3>
                  <p className="lwl-meta">{l.kind}</p>
                  <p className="lwl-counts">
                    <span>
                      <i aria-hidden="true" data-tone="on" />
                      {l.online} screens online
                    </span>
                    <span>
                      <i aria-hidden="true" data-tone={l.offline > 0 ? 'off' : undefined} />
                      {l.offline} offline
                    </span>
                  </p>
                  <button type="button" className="lwl-view" onClick={() => onView(l.id)}>
                    View screens
                    <span aria-hidden="true">→</span>
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <p className="lwl-note">
            Illustrative workspace — the screens and figures shown are example content.
          </p>
        </div>
      </div>
    </section>
  );
}

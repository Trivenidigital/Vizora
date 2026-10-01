import type { WorldPlace } from './WorldsScene';

/**
 * Replaceable image slots for the three hero vignettes.
 *
 * A `null` entry renders the CSS-3D vignette as a fallback. When a
 * photoreal render is delivered it drops in here — file under
 * `web/public/landing/worlds/` (see that folder's README for the provenance
 * table) — and the hero and the locations thumbnails switch that ONE place to
 * `next/image` without any other change. Mixed mode is supported and expected
 * during a rollout: each place is decided independently.
 *
 * The slots are aspect-reserved (4:3) and the image is `object-fit: contain`,
 * so an asset is never stretched or cropped and swapping modes causes no
 * layout shift. Images are decorative — `alt` is empty because the pin label
 * buttons beside them carry the semantics.
 *
 * `matte: 'ivory'` is the opt-in escape hatch for an asset delivered on a flat
 * #f5f1e8 background instead of alpha: without it the three overlapping slots
 * would show their rectangles against each other. It feathers the image with a
 * soft elliptical mask. Leave it off for anything with real transparency.
 */
export interface WorldAsset {
  src: string;
  width: number;
  height: number;
  alt?: string;
  matte?: 'ivory';
}

export const WORLD_ASSETS: Record<WorldPlace, WorldAsset | null> = {
  cafe: {
    src: '/landing/worlds/cafe.png',
    width: 1600,
    height: 1200,
  },
  hotel: {
    src: '/landing/worlds/hotel.png',
    width: 1600,
    height: 1200,
  },
  retail: {
    src: '/landing/worlds/retail.png',
    width: 1600,
    height: 1200,
  },
};

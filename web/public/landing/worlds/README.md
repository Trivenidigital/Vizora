# Hero world renders

**No asset is committed here yet.** The homepage hero and the "Your locations"
thumbnails currently render the CSS-3D vignettes in
`web/src/components/landing/WorldsScene.tsx`, which remain the live fallback and
the mixed-mode partner for any place that has no image.

This folder is the drop point for the three photoreal renders — café, hotel and
retail — that the design director is producing. Nothing switches over
automatically: a file here does nothing until its entry is filled in
`web/src/components/landing/worldAssets.ts`.

## Adding one

1. Drop the file in as `cafe`, `hotel` or `retail` (`.png` or `.webp`).
2. Fill that place's entry in `worldAssets.ts` with `src`, `width`, `height`.
3. Add a row to the provenance table below. **A render without a row here is
   not cleared to ship** — we cannot answer a licence question after the fact.
4. Leave `alt` empty. The images are decorative; the pin label buttons next to
   them carry the semantics.

## Requirements

| Property | Value |
|---|---|
| Aspect | 4:3 — the slot reserves this, so anything else letterboxes rather than crops |
| Long edge | ≥ 1600px (the hero slot renders up to ~350px CSS at 2x DPR) |
| Background | **Transparent alpha.** The three slots overlap; an opaque rectangle will show against its neighbours |
| Subject | One vignette on its limestone plinth, centred horizontally, with room around it |
| **Framing** | **The plinth's front rim must sit at 75% of the image height.** The hero derives each slot's position from that line (`slot.top = pin - 42.5`), which is what keeps an image and a CSS vignette on the same ground line in a mixed row |
| Camera | Looking down ~54°, yawed ~8° to the left, key light from the upper-left-front — the same camera the CSS scene uses |
| Palette | Ivory / limestone / deep forest / brass / coral, per `.lw` in `web/src/app/globals.css` |

If a render can only be delivered on a flat `#f5f1e8` background rather than
alpha, set `matte: 'ivory'` on that entry. It feathers the image with a soft
elliptical mask so the rectangle does not show where slots overlap. It is a
mitigation, not the target — ask for alpha first.

## Provenance

Every asset needs a row before it ships. Tool/model and prompt matter because
we have to be able to say where an image came from; licence matters because the
homepage is public.

| File | Tool / model | Date | Prompt or source | Licence | Added by |
|---|---|---|---|---|---|
| _(none committed yet)_ | | | | | |

# Hero world renders

The homepage hero and the "Your locations" thumbnails use the three coordinated
renders in this folder. The CSS-3D vignettes in
`web/src/components/landing/WorldsScene.tsx` remain the live fallback and the
mixed-mode partner for any place whose manifest entry is `null`.

This folder is the drop point for the three photoreal renders — café, hotel and
retail — that the design director is producing to
`tasks/redesign-reference/WORLD-ASSETS-SPEC.md`. Nothing switches over
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
| **Framing** | **The plinth's front rim must sit at 75% of the image height**, the plinth filling ~80% of the frame width. This is an INTEGRATION requirement on top of the spec: the hero derives each slot from that line (`slot.top = pin - 42.5`) so an image and a CSS vignette share one ground line in a mixed row. If a delivered set frames differently, `slot.top` in `HeroSection.tsx` is the single number to re-derive — measure the rim's fraction `f` of image height and use `pin - f * 56.7` |
| Camera, lighting, materials, per-scene content | **`tasks/redesign-reference/WORLD-ASSETS-SPEC.md` is the authority** — it carries the verbatim shared prompt block, the three scene paragraphs and the acceptance checklist. Do not restate the camera here; one number drifting between two documents is how a set ends up mismatched |

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
| `cafe.png` | Codex built-in image generator | 2026-09-17 | Shared block and café scene prompt from `tasks/redesign-reference/WORLD-ASSETS-SPEC.md`; attached concept board used only as a style/composition reference | Generated for this project for public website use under the applicable OpenAI service terms | Codex |
| `hotel.png` | Codex built-in image generator | 2026-09-17 | Shared block and hotel scene prompt from `tasks/redesign-reference/WORLD-ASSETS-SPEC.md`; approved café render used as the set anchor | Generated for this project for public website use under the applicable OpenAI service terms | Codex |
| `retail.png` | Codex built-in image generator | 2026-09-17 | Shared block and retail scene prompt from `tasks/redesign-reference/WORLD-ASSETS-SPEC.md`; approved café and hotel renders used as set anchors | Generated for this project for public website use under the applicable OpenAI service terms | Codex |

The generator returned matching 1448×1086 transparent PNGs. They were resized
once to 1600×1200 with high-quality bicubic interpolation to meet the repository
minimum while preserving alpha and the original 4:3 composition.

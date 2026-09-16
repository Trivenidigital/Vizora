# Little Worlds + Studio Redesign — Implementation Notes

**Status**: Implementation in progress (2026-09-16)  
**Branch**: `feat/homepage-light-redesign` (8 commits from a640b889)  
**Model**: claude-fable-5-1 (substitution from requested claude-fable-5)

## Implementation Plan

### Phase 1: New Components (This week)

- `LittleWorldsHero.tsx` — 3D diorama hero, copy, CTA
- `LocationShowcase.tsx` — Three venue cards
- `ContentToPlayback.tsx` — Create/Organize/Schedule/Display flow
- `CapabilitiesShowcase.tsx` — Verified strengths
- `OnboardingFlow.tsx` — Signup/screen/content/publish
- New `.mkt`-scoped color tokens (ivory, forest green, brass/coral)

### Phase 2: 3D Assets (2-3 weeks, parallel)

- Blender scenes: Café, Hotel, Retail
- Render: 2880×1800px PNG
- Export to `web/public/3d-renders/`

### Phase 3: CSS + Responsive (1 week)

- Hero layout with prerendered image
- Location cards responsive
- Typography (editorial + body)
- Reduced-motion support

### Phase 4: Testing (3-5 days)

- Build, type checks, tests
- Browser: 1440/834/390/320px
- Interaction: nav, pricing, FAQ, CTAs
- a11y: WCAG AA, keyboard, screen reader

### Phase 5: REDESIGN-REVIEW.md (1-2 days)

- Model used, branch/commits
- New section outline + decisions
- Preview URL, startup command
- Screenshots, verification commands
- 3D approach details
- Unverified claims (none)

## Key Decisions

✅ Prerendered 3D + CSS (best fidelity-to-effort)  
✅ Little Worlds palette (ivory, forest green, brass/coral)  
✅ Product narrative (create/organize/schedule/display)  
✅ Preserve semantic HTML, real routes, geo-pricing  
✅ Marketing UI only (.mkt scope)

## Next: Begin Phase 1

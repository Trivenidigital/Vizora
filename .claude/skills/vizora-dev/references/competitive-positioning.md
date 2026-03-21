# Competitive Positioning

## Target Bar: OptiSigns

Vizora's template quality target is OptiSigns-competitive. OptiSigns is the benchmark for:
- Professional template design quality
- Template library breadth and variety (500+ templates, 30+ categories)
- Ease of use and editor experience
- Plug-and-play signage management

## Template Library Status

### Current State (87 templates, 8 categories)

| Category | Count | Quality Level |
|----------|-------|---------------|
| Retail | 15 | Good -- Handlebars HTML/CSS, dark-themed |
| Restaurant | 12 | Good -- menu layouts, food service |
| Corporate | 12 | Good -- meeting rooms, directories |
| Education | 8 | Adequate -- class schedules, announcements |
| Healthcare | 8 | Adequate -- patient info, directories |
| Events | 8 | Adequate -- event listings, countdowns |
| General | 12 | Good -- welcome screens, info displays |
| Indian Cuisine | 12 | Good -- South/North Indian menus, sweets |

### Indian Cuisine Vertical (12 templates)
Expansion completed. Located in `templates/seed/indian/`:

**South Indian (8):**
1. South Indian Tiffin -- breakfast menu, brass/banana-leaf
2. Dosa Varieties -- crispy dosa, tawa-inspired
3. South Indian Meals -- banana leaf thali
4. Filter Coffee & Snacks -- coffee house
5. Weekly Lunch Specials -- rotating specials
6. Chettinad & Kerala -- spicy non-veg
7. South Indian Sweets -- rangoli-inspired
8. South Indian Combos -- canteen style

**North Indian (4):**
9. Tandoor & Kebab -- Mughal arch design (featured)
10. Dum Biryani -- Hyderabadi saffron aesthetic
11. Chaat & Street Food -- vibrant market energy
12. Sweets & Mithai -- festive gold aesthetic

### Template Overhaul Initiative
A detailed plan exists at `docs/plans/2026-02-26-template-overhaul-plan.md` to:
- Replace full template library with OptiSigns-competitive designs
- Improve visual quality and professional polish
- Add more categories and templates
- Standardize the dual seed system

**Status**: Plan written, not yet executed.

## Demo Video

### Current State
- `DemoVideoSection.tsx` exists in landing page components
- Remotion-related screenshots found in repo root (`remotion-studio-verify.png`, `scene3-placeholder-verify.png`)
- Demo video initiative was in progress but appears paused
- No Remotion project directory found in the main repo
- Purpose: showcase Vizora capabilities for competitive positioning

### Demo Assets Found
- `homepage-hero.png` -- landing page screenshot
- `homepage-video-section.png` -- video section screenshot
- `homepage-video-visible.png` -- video section visible state
- `remotion-studio-verify.png` -- Remotion studio screenshot
- `scene3-placeholder-verify.png` -- scene placeholder
- `vizora-dashboard-overview.png` -- dashboard screenshot
- Various other screenshots (devices, playlists, templates pages)

## Known Product Gaps vs OptiSigns

### Template System
| Feature | Vizora | OptiSigns |
|---------|--------|-----------|
| Template count | 87 | 500+ |
| Categories | 8 | 30+ |
| Template editor | Basic WYSIWYG (iframe + postMessage) | Full drag-and-drop designer |
| Drag-and-drop | No | Yes |
| Layer management | No | Yes |
| Responsive preview | No | Yes |
| Template marketplace | No | Yes (community templates) |
| AI template generation | Placeholder only | Unknown |
| Animation support | No | Yes |

### Content Management
| Feature | Vizora | OptiSigns |
|---------|--------|-----------|
| Content types | image, video, URL, HTML, template | image, video, URL, HTML, social media, weather, news, etc. |
| Social media widgets | No | Yes (Instagram, Twitter, Facebook, Google Reviews) |
| Weather widget | No | Yes |
| News ticker | No | Yes |
| Google Slides | No | Yes |
| Canva integration | No | Yes |

### Device Management
| Feature | Vizora | OptiSigns |
|---------|--------|-----------|
| Platform support | Electron (desktop), Android TV, Mobile companion | Android, iOS, Windows, ChromeOS, Fire TV, Raspberry Pi |
| Remote control | Basic (content push) | Full (remote screenshot, restart, etc.) |
| Touch interactivity | No | Yes |
| Kiosk mode | No | Yes |

### Scheduling
| Feature | Vizora | OptiSigns |
|---------|--------|-----------|
| Calendar scheduling | Yes | Yes |
| Day-parting | Yes | Yes |
| Recurring schedules | Partial | Yes |
| Emergency overrides | No | Yes |
| Multi-timezone | No | Yes |

### Analytics
| Feature | Vizora | OptiSigns |
|---------|--------|-----------|
| Content impressions | Yes | Yes |
| Proof of play | Partial | Yes |
| Audience analytics | No | Yes |
| A/B testing | No | Yes |

### Enterprise
| Feature | Vizora | OptiSigns |
|---------|--------|-----------|
| SSO/SAML | No | Yes |
| Multi-tenant | Yes (organizations) | Yes |
| API access | Yes (API keys) | Yes |
| White-label | No | Yes |
| Role-based access | Yes (admin/manager/viewer) | Yes (granular) |

## Competitive Strengths

1. **Self-hosted option**: Can deploy on own infrastructure (Docker Compose)
2. **Indian market support**: Razorpay integration, GST support, Indian cuisine templates
3. **Real-time architecture**: WebSocket-based live updates, not polling
4. **Autonomous operations**: 6 automated agents for monitoring and remediation
5. **Template rendering**: Handlebars-based, data-driven templates (not static images)
6. **Open architecture**: Nx monorepo, clear module boundaries, extensible

## Priority Gaps to Close

1. **Template editor**: Biggest gap. Need drag-and-drop, layers, responsive preview
2. **Template quantity**: 87 vs 500+. Need more categories and templates
3. **Content widgets**: Social media, weather, news -- high-demand features
4. **Platform support**: Need Raspberry Pi, ChromeOS support
5. **CI/CD**: No automated pipeline -- critical for team velocity

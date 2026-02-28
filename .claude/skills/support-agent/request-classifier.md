# Request Classifier

## Categories

| Type | Description | Keywords |
|------|-------------|----------|
| `bug-fix` | Something broken or not working correctly | broken, error, fail, crash, not working, slow, timeout, 500, blank, missing |
| `feature-request` | New capability or functionality | add, new, want, need, support, enable, integrate |
| `config-change` | Environment, settings, or infrastructure | env, config, port, url, docker, redis, database, deploy |
| `ui-tweak` | Visual or UX adjustment | align, color, font, spacing, layout, responsive, mobile, style, CSS |
| `content-update` | Content management changes | template, playlist, schedule, content type, media, upload |
| `unknown` | Cannot confidently classify | (fallback — ask for clarification) |

## Domain Mapping

Map request keywords to Vizora components:

| Domain Keywords | Component |
|----------------|-----------|
| display, screen, device, preview, TV, kiosk | `displays` |
| playlist, queue, rotation, order | `playlists` |
| template, editor, design, layout, artboard | `templates` |
| schedule, timing, when, duration, expiration | `schedules` |
| content, upload, image, video, media, file | `content` |
| login, auth, password, token, session, JWT | `auth` |
| dashboard, overview, stats, home | `dashboard` |
| websocket, realtime, live, status, online | `realtime` |
| organization, org, team, user, role | `organizations` |
| support, help, chat, ticket | `support` |

## Urgency Signals

| Urgency | Signals |
|---------|---------|
| `high` | "production", "all users", "crash", "data loss", "security", "down" |
| `medium` | "some users", "intermittent", "slow", "annoying", "regression" |
| `low` | "nice to have", "when possible", "minor", "cosmetic", "suggestion" |

## Output Format

```json
{
  "type": "bug-fix",
  "component": "displays",
  "urgency": "medium",
  "description": "Display preview modal loads slowly on the dashboard devices page"
}
```

## Classification Rules

1. If multiple categories fit, prefer `bug-fix` over `ui-tweak` over `feature-request`
2. If component is ambiguous, list the most likely one (code-scout will verify)
3. If urgency is unclear, default to `medium`
4. If confidence is below 60%, classify as `unknown` and request clarification
5. Extract the core issue into a one-line `description` — strip conversational fluff

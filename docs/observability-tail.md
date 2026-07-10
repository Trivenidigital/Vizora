# Observability tail (dimension 6) — recommendations

Non-blocking. Two items from the session scope, assessed and recorded (not implemented — each is a
feature/cross-cutting build warranting its own reviewed slice, not a quick safe diff).

## Finding-3 — "online" status disagrees across surfaces → single-source-of-truth fix

**Root cause (traced):** there are (at least) three independent sources of device-online truth with
different freshness, and different surfaces read different ones:
1. **DB `display.status`** (`displays.service.ts:280`) — set `'online'` on each heartbeat (~15s), reset
   to offline only by the `detectOfflineDevices` cron when `lastHeartbeat` is **>2 minutes** old
   (`:302-310`). Laggy by up to 2 min. The Devices list reads this.
2. **Gateway `deviceStatusCache`** (`device.gateway.ts:177`) — the live socket-connection state,
   real-time. The gateway broadcasts online/offline to the org room (`broadcastDeviceOnline`).
3. **The TV's own socket** — the device's "Connected" badge is its client-side `socket.connected`.

During any transition (connect/disconnect/flap) these disagree — e.g. the Push dialog (live) says
offline while the Devices list (DB, up to 2 min stale) still says online, and the TV shows "Connected".

**Recommendation:** pick ONE source of truth and have every surface read it. The live gateway state is
the real truth; DB `status` is a laggy cache. Either (a) have all dashboard surfaces consume the
gateway's real-time device-status broadcast (they already exist for the org room) instead of the DB
column, or (b) if the DB must back the list, tighten the offline detection (the 2-min cron is the main
lag source) and have the Push dialog read the same column rather than a live probe. (a) is the durable
fix; push status is inherently real-time and shouldn't be served from a 2-min-lagged column.
Cross-cutting (realtime + web); own slice.

## Fleet-view dark-screen column — feature build

**What exists already:** the device now reports `screenState` + `playbackSource` on every heartbeat
(Slice 0 B2 — the DTO was widened and the gateway ingests it). So the *data* to show "which screens are
dark / on the never-black holding placeholder vs actually playing content" is already flowing; nothing
surfaces it.

**Recommendation:** add a dashboard fleet-view column/badge driven by `screenState` — distinguish
`playing` from `holding`/`dark` so an operator can see at a glance which paired-and-online devices are
NOT showing content (the exact silent-failure class C-7 and Finding-2 produce: device online, screen on
the holding placeholder). This is the operator-facing complement to the backend integrity work — it
turns "screen dark with valid content" from invisible into visible. Web feature (needs the heartbeat
`screenState` exposed on the device-status API + a column); own slice. Pairs naturally with the Finding-3
single-source-of-truth fix (both are the device-status surface).

**Note:** this column would ALSO surface C-7 (schedule-only devices stuck on holding) and Finding-2
strands in the field — making it a high-value observability addition once those durable fixes land.

# Backlog - Deferred Items

This file tracks features or bug fixes that have been identified but deferred for later implementation or investigation.

## Deferred Tasks

- **VizoraTV - Auto-Start Pairing:**
  - **Issue:** The pairing process (QR code display) does not automatically start when the `PairingScreen` loads, requiring a manual click of the "Start Pairing" button.
  - **Context:** Debugging attempts suggest a possible conflict with React Strict Mode's double-rendering in development or a subtle timing issue with state updates and `useEffect` dependencies in `DisplayContext.tsx` / `PairingScreen.tsx`.
  - **Status:** Deferred on YYYY-MM-DD (replace date) to prioritize other development. Current workaround is the manual button.
  - **Next Steps:** Revisit `useEffect` logic in `PairingScreen`, investigate `PairingStateManager` initialization lifecycle, potentially re-enable and debug with Strict Mode. 
# AGENTS

This file documents repository-specific execution rules for future AI agents.

## Scope
- Repository root: current git root (.)
- Frontend app: apps/vite-project
- Runtime container: rubiks-ui-server (image: denoland/deno)
- Dev URL: http://localhost:5173/

## Mandatory Execution Policy
- Do not run Deno tasks directly on host.
- Always run build and validation commands inside Podman.
- Prefer the existing running container rubiks-ui-server.

## Podman Commands
- Build:
  podman exec rubiks-ui-server sh -lc 'cd /w/apps/vite-project && deno task build'

- Dev server check (if needed):
  podman ps --format '{{.Names}} {{.Image}} {{.Status}}'

- Start local pod (if not running and user requests):
  Use the manifest at podman/main.yaml.

## Browser Verification Workflow
- Open URL:
  http://localhost:5173/

- Verify page is loaded:
  Confirm title is Rubik's Cube and HUD text is visible.

- Verify keyboard interactions:
  Send u and Shift+u key events to confirm clockwise and counter-clockwise top turns.

- Functional end-to-end check:
  1) Trigger scramble.
  2) Trigger restore.
  3) Confirm cube returns to solved state.

## Rubik-specific Validation Hints
- The app exposes a debug API on globalThis.__rubiksDebug.
- Useful checks:
  - isSolved()
  - enqueueAlgorithm(...)
  - invertAlgorithm(...)
  - waitForIdle()

## Change Validation Checklist
After any code change in apps/vite-project:
1. Run Podman build command.
2. Reload http://localhost:5173/.
3. Perform at least one interaction test in browser.
4. Report the exact verification outcome.

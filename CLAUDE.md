# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.


**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

## Project Overview

StreamFlow is a torrent streaming and media management application built with Electron (desktop app) + Express (backend) + React/Vite (frontend). It allows users to stream torrents directly in a web player, manage local media libraries, and integrate with Jackett for torrent searches.

## Architecture

```
StreamFlow/
├── main.js                 # Electron entry point (tray-only, no window)
├── backend/
│   └── server.js           # Express server (port 7676)
├── frontend/               # React/Vite app
│   ├── src/
│   │   ├── api/           # API clients (TMDB, backend)
│   │   ├── components/    # React components (features, layout, common)
│   │   ├── layout/        # Layout components (MainLayout, Sidebar)
│   │   ├── pages/         # Page components (Home, Discover, etc.)
│   │   ├── store/         # Zustand state management
│   │   ├── types/         # TypeScript type definitions
│   │   └── main.tsx       # React entry point
│   └── vite.config.ts
└── e2e/                   # Playwright tests
```

## Key Technologies

- **Backend**: Express.js with JWT auth, bcryptjs, torrent-stream for torrent streaming, got for HTTP requests
- **Frontend**: React 19, TypeScript, Vite, Zustand (state), Framer Motion, Plyr player
- **Desktop**: Electron 41 (tray-only mode)
- **CSS**: Tailwind CSS 4
- **Search Integration**: TMDB API for metadata, Jackett for torrent searches

## Common Commands

```bash
# Start development (requires separate terminals)
npm run server              # Start Express backend on port 7676
npm run frontend:dev        # Start Vite dev server

# Build and run
npm start                   # Run Electron app
npm run build               # Build Windows installer
npm run build:linux         # Build Linux installer
npm run frontend:build      # Build frontend only

# Testing and security
npm test                    # Run E2E tests (Playwright)
npm run security            # Run security scanners (osv, trivy)
```

## Important Patterns

1. **State Management**: Zustand store in `frontend/src/store/useStore.ts` with localStorage persistence and backend sync
2. **Auth**: JWT-based with user data stored in localStorage, supports "Quick Connect" for device authorization
3. **Backend Config**: Saved to `config.json` (TMDB/Jackett settings, paths, appearance)
4. **User Data**: Synced between localStorage and backend via `/api/user/data`
5. **Streaming**: Uses `torrent-stream` to stream torrent content via Express `/api/stream` endpoint
6. **Local Media**: Scans local paths (`movies_path`, `tv_shows_path`) and enriches with TMDB metadata

## Configuration

- Backend config: `config.json` (auto-created)
- Users: `users.json` (auto-created)
- Default backend URL: `http://localhost:7676`

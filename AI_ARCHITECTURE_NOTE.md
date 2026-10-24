# Day Zero — Architectural Blueprint & Engineering Manual

> **Note for Future AI & Engineers**: This document contains the complete specification, domain logic, architectural decisions, and operational guidelines for **Day Zero**. Read this document carefully before making changes to ensure that existing guarantees (especially around Day 0 calendar math, client-first persistence, backup compatibility, and PWA behavior) are preserved.

---

## 1. Executive Summary & Core Identity

- **Application Name**: Day Zero (Precise Days & Life Counter)
- **Domain & Aesthetic**: Minimalist, brutalist, and horology-inspired life tracker. It combines high-precision elapsed time calculation with habit tracking, target countdowns, milestone projections, and offline-first cross-platform synchronization.
- **The Golden Rule of Origin (Day 0)**:
  - Default Origin Date: **October 13, 2026**
  - Default Origin Time: **1:47 PM (13:47:00 local time)**
  - **Day 0 Definition**: The calendar day of the origin date (October 13, 2026) is **Day 0**.
  - **Day 1 Definition**: The next calendar day (October 14, 2026) is **Day 1**.
  - **Day Numbering Rule**: Day numbers advance at midnight local time (`getCalendarDaysElapsed`), matching human calendar perception. Meanwhile, the live clock ticker (`getLiveTimeElapsed`) calculates continuous elapsed time down to the exact second (`X days, Y hours, Z minutes, W seconds`).

---

## 2. System Architecture & Directory Structure

```
├── public/
│   ├── icon.svg                     # Vector brand logo (Silver outer ring, Amber oval, Green inner circle)
│   ├── logo.jpg                     # Provided brand image
│   ├── pwa-192x192.png              # Standard PWA launcher icon
│   ├── pwa-512x512.png              # High-res PWA launcher icon
│   ├── pwa-maskable-512x512.png     # Android adaptive maskable icon (15% safe padding)
│   ├── apple-touch-icon.png         # iOS Safari home screen icon (180x180)
│   └── sw.js                        # Service worker for milestone notifications and icon caching
├── src/
│   ├── assets/images/               # Source artwork files
│   ├── components/
│   │   ├── Header.tsx               # Top 3-zone header with navigation, PWA install action, and tools
│   │   ├── Logo.tsx                 # Brand insignia with provided image asset and vector fallback
│   │   ├── PrimaryHeroCounter.tsx   # Hero Day counter, live ticking seconds, and milestone progress
│   │   ├── HabitTracker.tsx         # Daily habits matrix, category badges, streaks, and check-ins
│   │   ├── TargetEvents.tsx         # Target deadline countdown cards with real-time ticking
│   │   ├── CalendarMatrix.tsx       # Monthly grid displaying days elapsed and journal links
│   │   ├── MilestonesSection.tsx    # Standard + custom milestone alerts with push notification setup
│   │   ├── DateCalculator.tsx       # Two-way date-to-day and day-to-date calculation engine
│   │   ├── DailyJournal.tsx         # Milestone reflections and logs indexed by Day Number
│   │   ├── CounterModal.tsx         # Creation and editing modal for multiple counters
│   │   ├── ShareCardModal.tsx       # Shareable graphic card generator
│   │   ├── BackupModal.tsx          # Multi-format backup exporter and deep clean restorer
│   │   ├── CloudSyncModal.tsx       # Real-time sync modal with manual sync trigger and key manager
│   │   ├── MilestoneCelebrationModal.tsx # In-app celebration dialog for reached milestones
│   │   └── PWAInstallButton.tsx     # In-app install trigger with standalone auto-suppression
│   ├── hooks/
│   │   └── usePWAInstall.ts         # Hook managing beforeinstallprompt, standalone detection, and iOS guide
│   ├── server/
│   │   └── syncMiddleware.ts        # Vite connect middleware handling /api/sync/* in dev
│   ├── utils/
│   │   ├── dateUtils.ts             # Time math, calendar day logic, and Web Audio haptic engine
│   │   ├── syncService.ts           # Cloud sync client, SSE real-time stream, and local mutation dispatcher
│   │   ├── notificationUtils.ts     # Uncelebrated milestone tracking and browser notification triggers
│   │   └── notificationService.ts   # Service worker registration and permission helpers
│   ├── types.ts                     # TypeScript interfaces for Counter, Habit, CheckIn, Note, Event, Milestone
│   ├── App.tsx                      # Root application controller and client-first persistence engine
│   └── index.css                    # Tailwind CSS imports and custom aesthetic styling
├── server.ts                        # Full-stack Express server with SSE broadcasting for production
├── vite.config.ts                   # Vite configuration with VitePWA and syncApiPlugin
└── tsconfig.json                    # TypeScript compiler configuration with vite-plugin-pwa/client types
```

---

## 3. Core Subsystems & Technical Rationale

### A. Calendar Day Math vs. Live Seconds Ticker (`dateUtils.ts`)
- **Why Separate Math Models?**
  - If day numbers were calculated by dividing raw milliseconds elapsed by $86,400,000$ ms, an origin set at 1:47 PM would cause "Day 1" to only begin at 1:47 PM the next day. This confuses users who expect October 14 to be "Day 1" from the moment they wake up.
  - **Resolution**:
    - `getCalendarDaysElapsed(startDateStr, targetDate)` sets both dates to local midnight (`00:00:00`) before taking the difference. Thus, October 13 is Day 0, October 14 is Day 1, October 15 is Day 2.
    - `getLiveTimeElapsed(startDateStr, startTimeStr)` calculates the continuous timestamp delta `(now - originTimestamp)` to render precision countdowns in `days, hours, minutes, seconds`.

### B. Client-First Persistence & Cloud Healing (`App.tsx` & `syncService.ts`)
- **The Problem**: In Cloud Run and serverless containers, container instances scale down or restart. A cold server instance starts with an unpopulated cache or empty file. If client apps blindly trust the cloud on boot, an empty cloud response will overwrite and wipe existing local habit check-ins.
- **The Architecture (Client-First Persistence)**:
  1. **Local Authority on Boot**: The app initializes state from `localStorage`.
  2. **Safe Cloud Reconciliation**: When `pullDataFromCloud` or SSE receives a payload from the server, `applyCloudData` inspects whether the incoming payload is empty. If the incoming cloud payload is empty while local storage has counters/habits, the app **refuses to overwrite** local data.
  3. **Cloud Healing**: Instead of failing, the client immediately calls `pushFullPayloadToCloud()`, re-uploading its local state to heal the server cache.
  4. **Multi-Counter Scan**: `pushFullPayloadToCloud` scans all counters in `localStorage` (`habits_*`, `habit_checkins_*`, `notes_*`, `milestones_*`, `target_events_*`), ensuring that switches between active counters never drop records belonging to other counters.
  5. **Local Mutation Event**: Any edit in child views (adding a habit, writing a note, creating a milestone) calls `notifyLocalStateChanged()`, which dispatches a `dayzero_local_mutated` event to trigger an immediate cloud push.

### C. Universal Multi-Version Backup & Deep Clean Restore (`BackupModal.tsx`)
- **The Problem**: Users maintain backups created across various application revisions:
  - *Format 1 (Earliest)*: Flat dictionary of stringified JSON keys.
  - *Format 2 (v2)*: Nested `{ storage: { ... } }` structure.
  - *Format 3 (Cloud Dump)*: Structured `{ counters: [...], habits: { ... }, notes: { ... } }`.
  - *Format 4 (Bare Array)*: A raw JSON array of counter objects `[{ id, title, startDate, ... }]`.
- **The Implementation**:
  - `BackupModal.tsx` contains an adaptive adapter that unpacks all four formats cleanly. It serializes objects into valid JSON strings without ever producing corrupt `"[object Object]"` strings.
  - **Deep Clean Restore**: To prevent ghost records or stale counter ID collisions, `BackupModal` cleans prior `dayzero_*`, `habits_*`, and `notes_*` keys from `localStorage` before writing the restored payload.
  - **Atomic State Injection**: In `App.tsx`, `handleDataRestored` receives the restored data object directly. It updates React state synchronously and pushes the *newly restored dataset* to the cloud, eliminating the async React `setState` batching race condition that previously caused stale in-memory state to overwrite restored backups.

### D. Progressive Web App (PWA) & Standalone Suppression (`usePWAInstall.ts`, `PWAInstallButton.tsx`)
- **Installation Standard**: Built using `vite-plugin-pwa` with `registerType: 'autoUpdate'` and Workbox precaching for minimal offline resilience.
- **Placement & User Preference**: Mounted exclusively in the top navigation header (`Header.tsx`) next to Cloud Sync and Tools.
- **Automatic Standalone Suppression**: When the app is launched as an installed PWA (verified via `window.matchMedia('(display-mode: standalone)').matches` or `navigator.standalone === true`), `PWAInstallButton` returns `null` so the header remains completely uncluttered.
- **Cross-Platform Handling**:
  - Desktop (Chrome/Edge/Brave) & Android: Intercepts `beforeinstallprompt` and triggers native install dialog.
  - iOS Safari: Opens a sleek 2-step guide modal (*Share $\rightarrow$ Add to Home Screen*), since WebKit does not support `beforeinstallprompt`.

### E. Web Audio Synthesized Haptics (`dateUtils.ts`)
- Rather than loading heavy external MP3/WAV files that can fail offline or introduce latency, Day Zero uses the browser's built-in `AudioContext` to generate synthetic auditory feedback:
  - `'click'`: A clean 800Hz $\rightarrow$ 400Hz frequency drop (40ms).
  - `'celebrate'`: A vibrant ascending triad chord ($523.25\text{Hz} \rightarrow 659.25\text{Hz} \rightarrow 783.99\text{Hz}$) for milestone achievements.
  - `'reset'`: A gentle low-frequency confirmation pulse.
- Can be toggled on/off via the volume control in the header, persisted in `localStorage.getItem('sound_enabled')`.

### F. Brand Visual Identity & Logo Geometry
- **Provided Design**: A striking 3-ring geometric composition on obsidian stone (`#1c1917`):
  1. Outer Circle: Silver / Gray (`#b0adaa`).
  2. Middle Oval: Golden / Amber vertical ellipse (`#f5b72f`).
  3. Lower Inner Circle: Vibrant Green circle (`#68ce3b`).
- **Implementation**: The image asset at `src/assets/images/dayzero_minimal_logo_1792162564407.jpg` is imported in `Logo.tsx` and duplicated in `public/logo.jpg`, while `public/icon.svg` provides the exact vector equivalent for browser tabs and Android manifest icons.

---

## 4. Maintenance Guidelines for Future Changes

1. **Never Revert Day 0 Math**:
   - `startDate: '2026-10-13'` at `'13:47:00'` is Day 0.
   - October 14, 2026 is Day 1.
   - Do NOT replace `getCalendarDaysElapsed` with raw hour/millisecond division.
2. **Never Overwrite Local Storage with Empty Cloud Payloads**:
   - Always verify that incoming cloud payloads contain valid, populated counter lists before overwriting client storage in `applyCloudData`.
3. **Preserve PWA Standalone Suppression**:
   - The install button MUST remain hidden when running inside `standalone` mode.
4. **Preserve Multi-Version Backup Support**:
   - Any modifications to `BackupModal.tsx` must maintain backwards compatibility with flat JSON key-value backups.
5. **Keep Native Config Loader Extension in `vite.config.ts`**:
   - Imports of server middleware in `vite.config.ts` must include the explicit file extension (`./src/server/syncMiddleware.ts`) to avoid Vite build warnings.
6. **No Mock Data / No AI Chatbots**:
   - Day Zero is an uncompromised, clean productivity utility. Do not add conversational AI bots, floating assistant widgets, or mock fallback datasets.

---

*Authored for the Day Zero project codebase.*

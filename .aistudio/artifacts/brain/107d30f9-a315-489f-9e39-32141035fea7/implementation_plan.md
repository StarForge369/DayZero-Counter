# Day Zero — Backup, Sync Persistence & System Stability Plan

Comprehensive resolution plan to fix data loss on device close, guarantee clean deep backup restoration, eliminate service worker registration conflicts, and resolve all console/build log warnings.

## User Review & Critical Decisions

> [!IMPORTANT]
> The implementation plan incorporates your confirmed preferences:
> - **Sync System Persistence**: Client-first persistence where local data is permanently preserved in local storage and is **never wiped or overridden by empty/stale cloud responses** when devices are closed and reopened. Instead, populated local data heals the cloud store.
> - **Backup Restore Strategy**: **Deep restore** that completely and cleanly replaces counters, habits, habit check-ins, notes, milestones, and target countdowns from the backup file, updating React state and syncing to the cloud simultaneously without state race conditions.

---

## 1. Overview & Core Concept

- **Problem Addressed**:
  1. *Sync Data Loss on Device Close*: When devices were closed or cloud instances restarted, the cloud endpoint returned empty states that inadvertently wiped or reset populated local habit check-ins and counter progress upon reopening.
  2. *Backup System Failures*: Stale in-memory React state and asynchronous state setters caused `pushFullPayloadToCloud` to execute with old counter IDs during backup restore, bouncing stale data back over the restored records.
  3. *Console & Build Log Warnings*: Vite config native loader extension warning (`./src/server/syncMiddleware` missing extension) and competing service workers (`public/sw.js` attempting to cache non-existent `/logo.jpg` while `VitePWA` generated another worker).
- **Core Value**: Bulletproof offline-first local persistence, predictable and reliable deep backup restoration, and zero console/build warnings.

---

## 2. User Experience & Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Device Storage                       │
│                                                             │
│  ┌───────────────────────┐       ┌───────────────────────┐  │
│  │ Local Device Authority│       │   Backup File .json   │  │
│  │ (Indexed/LocalStore)  │       │                       │  │
│  │ - Persistent Counters │       │ - Full Snapshot v2    │  │
│  │ - Habit Check-Ins     │       │ - Deep Clean Restore  │  │
│  │ - Notes & Milestones  │       │ - Atomic Injection    │  │
│  └───────────┬───────────┘       └───────────┬───────────┘  │
│              │                               │              │
│              ▼                               ▼              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │         Client-First Reconciliation Engine            │  │
│  │                                                       │  │
│  │  1. Check incoming cloud payload vs local store       │  │
│  │  2. If cloud is empty or older, PRESERVE local data   │  │
│  │  3. HEAL cloud by pushing local state to backend      │  │
│  └───────────────────────────┬───────────────────────────┘  │
└──────────────────────────────┼──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                  Cloud Server (/api/sync)                   │
│                                                             │
│  - Persistent store with graceful fallback                  │
│  - Real-time SSE broadcast to active listening devices      │
└─────────────────────────────────────────────────────────────┘
```

### Key User Flows

1. **Reopening Closed Devices**:
   - When you close your phone or laptop and reopen it hours or days later, the app boots directly from local storage.
   - If the backend was sleeping or scaled down, your local habit check-ins and counter progress remain 100% intact.
   - The app verifies that local data is not empty, and automatically sends a healing sync to the backend to ensure the cloud store is refreshed.
2. **Deep Backup & Restore**:
   - **Download Backup**: Generates an unambiguous snapshot containing all counters, habit records, check-in history, journal notes, target events, and theme preferences.
   - **Restore Backup**: Clears stale keys, deeply writes all backup records, synchronously refreshes React state in `App.tsx` (`counters`, `activeCounterId`, `habits`, `checkIns`), dispatches a sync event for child components, and pushes the exact restored payload to the cloud.

---

## 3. Key Technical Decisions & Trade-Offs

- **Decision 1: Client-First Authority & Cloud Healing**
  - *Chosen Approach*: If the server returns empty data (`{}` or empty lists) while the device has local records, local records win and immediately upload to heal the server.
  - *Why*: Eliminates accidental data wipes caused by container restarts, network partitions, or server cold starts.
- **Decision 2: Atomic Synchronous State Hydration on Restore**
  - *Chosen Approach*: Pass the exact restored data dictionary directly to `pushFullPayloadToCloud` and child event dispatchers, rather than relying on React's asynchronous `setState` updates in the same tick.
  - *Why*: Solves the race condition where `pushFullPayloadToCloud` was pushing stale in-memory data that overwrote the restored backup.
- **Decision 3: Consolidated Service Worker & Vite Config Clean-Up**
  - *Chosen Approach*:
    1. Update `vite.config.ts` import to `./src/server/syncMiddleware.ts` to satisfy Vite's native config loader.
    2. Update `public/sw.js` to reference valid icon assets (`/pwa-192x192.png`, `/icon.svg`) and remove redundant static precaching that conflicted with `VitePWA`.
  - *Why*: Eliminates all build warnings and browser console 404/service worker errors.

---

## 4. Implementation Steps Upon Approval

1. **Vite Config & Server Middleware**:
   - Fix import in `vite.config.ts` to include `.ts` extension (`./src/server/syncMiddleware.ts`).
   - Enhance `syncMiddleware.ts` to persist all multi-counter data structures reliably.
2. **Sync Persistence & Cloud Healing (`src/App.tsx` & `src/utils/syncService.ts`)**:
   - Update `applyCloudData` in `App.tsx` to guard against empty cloud payloads wiping non-empty local storage.
   - Implement cloud healing: when cloud is empty and local storage has records, push local records to `/api/sync/save`.
   - Update `pushFullPayloadToCloud` to gather habits, check-ins, notes, and milestones for **all counters** across the application.
3. **Backup System Deep Restore (`src/components/BackupModal.tsx` & `src/App.tsx`)**:
   - Export full multi-counter dataset with clean formatting.
   - Implement deep clean restore: wipe old keys, inject restored data, immediately update React state and child components, and push the restored state without race conditions.
4. **Service Worker Clean-Up (`public/sw.js` & `src/utils/notificationService.ts`)**:
   - Remove conflicting precache routes in `public/sw.js` and update notification icon references to `/pwa-192x192.png`.
   - Ensure `VitePWA` and notification service workers coordinate smoothly without console errors.
5. **Full System Verification**:
   - Run `npm run lint` and `npm run build` to verify 0 warnings and 0 errors.
   - Test device closing/reopening simulation and backup export/import cycle.

---
description: "Use when building, refactoring, or extending the pickleball-app. Covers MVP scope, architecture constraints, engine refactor goals, UI preservation rules, tournament type hierarchy (single-stage and multi-stage), and feature specifications for all 6 MVP areas. Applies to tournament setup, Rally to the Top game mode, match management, public display, admin UI, and supporting utilities."
name: "Pickleball App MVP Context"
applyTo: "pickleball-app/**"
---

# Pickleball App — MVP Context & Engineering Guide

Reference design inspiration: https://www.score7.io/

---

## Project Overview

A full-stack pickleball tournament management app built with **Next.js 16 + React 19 + Tailwind CSS 4 + PostgreSQL**.

The app supports multiple tournament formats organized into **single-stage** and **multi-stage** types:

| Category         | Tournament Type    | Description                                                                                 |
| ---------------- | ------------------ | ------------------------------------------------------------------------------------------- |
| **Game Mode**    | Rally to the Top   | King-of-court with rotating partners (standalone game mode, not bracket-based)              |
| **Single-Stage** | Round Robin        | All teams play each other once (or N legs)                                                  |
| **Single-Stage** | Single Elimination | Knockout bracket, one loss = out                                                            |
| **Single-Stage** | Double Elimination | Two-bracket system (winners + losers)                                                       |
| **Multi-Stage**  | Groups → Knockout  | Round-robin groups → top N advance to elimination bracket (this is the current "DUPR" mode) |

The MVP refactors the engine layer for better software engineering, organizes tournament types into a reusable hierarchy, retains drag-and-drop for setup (player slots + court cards via `@dnd-kit/sortable`), and replaces active-round DnD with button-based interactions.

---

## Hard Constraints (Do Not Violate)

- **KEEP** the existing UI design for: Admin Dashboard (`/tournament/admin`), History (`/tournament/admin/history`), Display Window (`/tournament/display`)
- **KEEP** `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities` for **setup only**: `SetupPlayerSlot` (player drag within each court) and `SortableCourt` (court card drag to reorder). Both have ↑↓ button fallbacks.
- **REMOVE** drag-and-drop from **active round** player swaps and DUPR match assignment — replace those with button-based interactions (swap buttons, up/down arrows, `UnassignedMatchCard` dropdown)
- **REFACTOR** the engine layer only — no UI design changes to existing pages
- Do **not** install new UI frameworks (no shadcn, no Radix standalone, no MUI). Use existing Tailwind + Heroicons
- Preserve NextAuth authentication (credentials-based, bcrypt)
- Preserve PostgreSQL persistence via server actions in `app/lib/actions.ts`
- Preserve database tournament, tournament_history, and user table in supabase since they are in production

---

## Current Architecture (Before Refactor)

```
pickleball-app/
  app/
    lib/
      definitions.ts          # Core types: Player, Match, Round
      tournament-engine.ts    # Rally pairing algorithm (~300 lines)
      useTournament.ts         # Monolithic state hook (1000+ lines) ← REFACTOR TARGET
      actions.ts               # Server actions + DB (keep stable)
      game_modes/
        rally/                 # controller, model, view, index (thin wrappers)
        dupr/                  # controller, model, view, index (thin wrappers)
      tournament_mode/
        gameMode.ts            # enum: RALLYTOTHETOP, KINGOFTHECOURT, ROUNDROBIN, DUPR
        duprTournament.ts      # DUPR business logic (~500 lines)
        tournamentStatus.ts    # enum: SETUP, IN_PROGRESS, COMPLETED
        tournamentType.ts      # interface (currently unused)
      engines/                 # EMPTY — target for new engine modules
    tournament/
      admin/page.tsx           # Main organizer UI (1000+ lines) ← keep UI, refactor engine calls
      display/page.tsx         # Public display (polling 1s, ~300 lines)
      admin/history/           # History pages
```

### Current Types (definitions.ts)

```typescript
Player {
  id: string;
  name: string;
  rating: number;
  benchCount: number;           // total rounds on bench (default 0)
  lastBenchedRound: number | null; // round index when last benched (null = never)
}
Match  { teamA: string[]; teamB: string[]; winner: 'A' | 'B' | null }
Round  {
  id: number;
  matches: Record<string, Match>;
  waiting: string[];
  players?: Player[]; // pre-round snapshot — used by undo to revert bench counts
}
```

### Database Schema

```sql
tournament (id='1', slug, state JSONB, created_at)
tournament_history (id SERIAL, session_slug, archive_reason, state JSONB, archived_at)
```

### State Sync Pattern

- Client hook (`useTournament`) owns all runtime state (~25 state variables)
- 500ms debounce → `saveTournamentState()` → PostgreSQL (UPSERT entire JSONB)
- Display page polls `getTournamentState()` every 1 second

### DnD Usage (setup: kept — active: replaced with buttons)

**Kept** — setup section uses `@dnd-kit/core` + `@dnd-kit/sortable`:

1. **Setup court reorder** — `SortableCourt` with `useSortable({ id: 'court-{id}' })`, drag handle (⠿) in court header. Outer `DndContext` + `SortableContext` with `verticalListSortingStrategy` wraps the courts list. On drag end: `actions.reorderCourtById(sourceId, targetId)`.
2. **Setup player reorder** — `SetupPlayerSlot` with `useSortable({ id: 'player-slot-{index}' })`, drag handle (⠿) per slot. Inner `DndContext` per court + `SortableContext` with `rectSortingStrategy` (4-slot 2×2 grid). On drag end: `syncPlayersAndBulk(arrayMove(config.players, from, to))`.

**Removed** — replaced with buttons in active mode:

3. **Active match player swap** → `PlayerSlot` (plain span with click-to-select, swap on second click)
4. **DUPR match-to-court assignment** → `UnassignedMatchCard` dropdown select

---

## Tournament Type Hierarchy

Reorganize tournament types into a reusable structure where **single-stage formats** are composable building blocks and **multi-stage formats** chain them together.

### Design Principle

Each tournament type implements a common interface. Multi-stage types compose single-stage types as phases. This allows the Groups → Knockout format (currently called "DUPR") to reuse Round Robin and Single Elimination engines directly.

### Target Folder Structure

```
app/lib/
  engines/
    types/                          # Shared interfaces & base types
      tournament-type.ts            # ITournamentStage interface
      stage-config.ts               # StageConfig, ProgressionRule types
      index.ts

    # ── Game Modes (standalone, not bracket-based) ──
    rally/
      pairing.ts                    # generateRoundPairings() — pure function
      leaderboard.ts                # calculateLeaderboard() — pure function
      partner-score.ts              # partnership repetition scoring
      index.ts

    # ── Single-Stage Types (reusable building blocks) ──
    round-robin/
      generator.ts                  # generateRoundRobinSchedule(teams, legs)
      standings.ts                  # calculateStandings() with tiebreakers
      index.ts

    single-elimination/
      bracket.ts                    # generateBracket(seeds) — seeded knockout tree
      progression.ts                # advanceWinner(), match result handling
      index.ts

    double-elimination/
      bracket.ts                    # winners bracket + losers bracket generation
      progression.ts                # advanceWinner/Loser(), grand finals logic
      index.ts

    # ── Multi-Stage Types (compose single-stage types) ──
    multi-stage/
      groups-knockout.ts            # Groups → Knockout orchestrator (replaces duprTournament.ts)
      stage-runner.ts               # Generic stage sequencing: run stage N → promote → stage N+1
      promotion.ts                  # promoteTopN(), tiebreaker resolution at stage boundary
      index.ts

  store/
    tournament-store.ts             # Thin React state shell (replaces useTournament monolith)
    rally-store.ts                  # Rally-specific state slice
    bracket-store.ts                # Bracket tournament state slice (shared by elimination types)
    multi-stage-store.ts            # Multi-stage state slice (groups + knockout phases)
```

### Core Interface

```typescript
// engines/types/tournament-type.ts

interface ITournamentStage<TConfig, TState, TStandings> {
  /** Initialize stage state from config and participants */
  initialize(config: TConfig, participants: Team[]): TState;

  /** Apply a match result and return updated state */
  applyResult(state: TState, matchId: string, result: MatchResult): TState;

  /** Calculate current standings/bracket from state */
  getStandings(state: TState): TStandings;

  /** Check if the stage is complete */
  isComplete(state: TState): boolean;

  /** Get participants who advance (for multi-stage promotion) */
  getAdvancingParticipants(state: TState, promoteCount: number): Team[];
}

interface StageConfig {
  type: "round-robin" | "single-elimination" | "double-elimination";
  legs?: number; // round-robin: how many times each pair meets
  groups?: number; // round-robin: parallel groups
  promoteCount?: number; // how many advance to next stage
}

interface MultiStageConfig {
  stages: StageConfig[]; // e.g., [{ type: 'round-robin', groups: 2 }, { type: 'single-elimination' }]
  name: string;
  metadata: TournamentMetadata;
}
```

### Migration: "DUPR" → "Groups → Knockout"

The current `duprTournament.ts` (500+ lines) implements a fixed 2-phase format: round-robin → knockout. Refactor it as a `MultiStage` composed of:

1. **Stage 1:** `RoundRobin` engine (reuse `round-robin/generator.ts` + `standings.ts`)
2. **Stage 2:** `SingleElimination` engine (reuse `single-elimination/bracket.ts` + `progression.ts`)
3. **Promotion:** `promoteTopN()` with existing tiebreaker logic (head-to-head → point diff → overall diff)

The "DUPR" name in the UI can remain as a preset that auto-configures `MultiStageConfig` with these two stages. Internally, it is no longer special-cased.

---

## Engine Refactor Goals

The `useTournament.ts` hook is a ~1000-line monolith. Refactor following these principles without changing UI:

### 1. Separate Concerns

Extract all business logic into pure engine functions under `app/lib/engines/`. The React hook becomes a thin state shell that dispatches to engines.

### 2. Pure Functions for All Algorithms

All pairing, scoring, leaderboard, bracket, and progression algorithms must be **pure functions** (no side effects, no React state access). This enables unit testing.

```typescript
// ✅ Good — pure function
export function generateRoundPairings(input: PairingInput): PairingOutput { ... }

// ❌ Bad — touches React state
function nextRound() { setState(prev => { ... generatePairings() ... }) }
```

### 3. Type Safety

- Define explicit input/output types for every engine function
- No `any` types in engine code
- Use discriminated unions for tournament phase states

```typescript
type TournamentPhase =
  | { kind: "setup" }
  | { kind: "active"; round: number; mode: GameMode }
  | { kind: "finished"; podium: Player[] };

type StagePhase =
  | { kind: "round-robin"; roundIndex: number }
  | { kind: "knockout"; bracketRound: "QF" | "SF" | "F" }
  | { kind: "completed" };
```

### 4. Remove Dead Code

- `app/lib/tournament_mode/tournamentType.ts` — replace with `engines/types/tournament-type.ts`
- `app/lib/engines/` folder — currently empty, populate with engine modules
- `rallyToTheTop.ts` — missing file referenced by code, resolve this
- `KINGOFTHECOURT` and `ROUNDROBIN` enum values — either wire gameplay or hide from UI

### 5. No Drag-and-Drop in Engine

Remove all `@dnd-kit` dependencies from engine/store logic. Keep no DnD references in new engine files.

---

## MVP Feature Specifications

### 1. Tournament Configuration & Setup

#### Creation Wizard

- Multi-step form: **Type → Scoring → Metadata**
- Step 1 — Type: Rally to the Top, Round Robin, Single Elimination, Double Elimination, Groups → Knockout (multi-stage)
- Step 2 — Scoring/Rules: points per set, sets per match, win-by-2, groups, legs, promotion count
- Step 3 — Metadata: name, date, venue
- State stored in setup steps; no persistence until "Confirm"

#### Participant Manager

- **Keep existing UI layout** (player list design, bulk input textarea, CSV upload)
- **Drag-to-reorder**: courts and player slots use `@dnd-kit/sortable` drag handles (⠿); Up/Down arrow buttons remain as keyboard-accessible fallback
- Add buttons: "Randomize Order", "Seed by Rating", "Randomize Partners"
- Pre-set player support: load from saved player roster
- Courts: select subset from available courts (1–7); use Up/Down buttons to reorder priority
- Import flows: bulk text (`Name:Rating` format) and CSV (`First Name`, `DUPR Rating` columns) — keep existing

#### Rule Engine

- Configuration panel (inputs/selects) for:
  - Points per set (default: 11)
  - Sets per match (default: 1)
  - Total participants promoted to next stage (multi-stage only)
  - Number of groups (multi-stage only)
  - Number of legs (round-robin stages)
  - Win by 2 toggle

---

### 2. Rally to the Top (Existing Game Mode — Refine)

King-of-court: winning team moves up one court; losing team moves down. Partners rotate every round. This is a **standalone game mode**, not a bracket tournament.

#### Partner Assignment Rules (enforce strictly in engine)

- A player's partner from round N must **not** be their partner in round N+1
- **Maximize new partner meetings** across the tournament
- When no new pairing is possible, repeat only the least-recently-used partnership
- Score formula: `score = (recently paired together? high penalty : 0) + (lifetime pair count × weight)`
- Pick combination with **lowest score** per group of 4

#### Scoring

- Points count from **Round 2 onward** (Round 1 is warmup)
- Leaderboard tracks wins on the **King Court** (highest-ranked court, index 0)

#### Bench / Waiting-List Rotation ✅ Built

When the player count does not divide evenly into courts, some players sit on the bench each round. Auto-rotation fires at the start of each round (round 2+), triggered by the bottom court result.

**Auto-rotation rules** (implemented in `app/lib/bench-rotation.ts`):

| Players on bench | Who goes to bench after the round |
|---|---|
| +1 | Bottom court **losing team** → 1 player with lowest `benchCount` (tiebreaker: longest since last bench) |
| +2 | Bottom court **losing team** → both players |
| +3 | Bottom court **losing team** (2) + bottom court **winning team** → 1 player with lowest `benchCount` |
| 4+ | Not handled — admin should activate more courts |

**Tiebreaker:** Among equal `benchCount`, bench the player with smallest `lastBenchedRound` (`null` = never benched = bench first).

**Player leaving mid-tournament:** Out of scope for MVP — `// TODO` note left in code.

**Bench count tracking per player:**
- `benchCount: number` — total rounds spent on bench (persisted)
- `lastBenchedRound: number | null` — round when last benched (persisted)
- Defaults on hydration from DB: `benchCount → 0`, `lastBenchedRound → null`

**Admin manual swap (SWAP mode):**
- Bench players are click-selectable in SWAP mode (orange-100 background to match court slots)
- A bench player can swap with any slot in the **bottom or second-bottom court**
- Court players swap within the same court (round 2+) or any court (round 1)
- Auto-rotation logic is unchanged regardless of manual swaps

**Bench UI (admin aside):**
- Bench count badge per card: green (0×), yellow (1–2×), orange (3+×)
- 5-second auto-dismiss banner after auto-rotation fires showing which players were benched
- Bench section also shown on the public display page (`/tournament/display`) below the leaderboard

#### Swap Mode (click-to-swap — DnD removed)

- SWAP mode toggled by the "SWAP" / "FINISH SWAP" button in the header
- In SWAP mode, clicking a player selects them (orange highlight); clicking a second player completes the swap
- Re-clicking a selected player deselects them (no self-swap)
- Round 1: cross-court swaps allowed
- Round 2+: same-court swaps only (bench ↔ bottom/second-bottom court is always allowed in SWAP mode)
- Clicking the already-selected winner in normal mode deselects it (sets winner to null)
- No drag-and-drop in the active round — all interactions are click-based

---

### 3. Match Management

#### Score Entry Interface

- Modal or inline form per court
- Fields: set-by-set scores (e.g., "11-9, 11-7")
- "Finalized" toggle to lock a result
- Score validation: must be numeric, must satisfy win conditions

#### Manual Progression Logic

- After score submission: auto-advance winner/loser to correct next position
- Rally: winner stays/moves up; loser moves down
- Bracket tournaments: `ITournamentStage.applyResult()` → engine handles advancement
- Multi-stage: engine auto-detects stage completion → triggers promotion → initializes next stage
- Undo: revert last match result only (not full round undo for multi-stage)

---

### 4. Public & Social Components

#### Public Landing Page (`/tournament/display`)

- Read-only, no auth required
- Sections:
  - Tournament header: name, type, current round/stage name
  - Current matches per court (Team A vs Team B, scores if entered)
  - Live leaderboard / bracket view (depends on tournament type)
  - **Bench section** (below leaderboard): list of benched players with their bench count — shown only when `waitingPlayers.length > 0` ✅ Built
  - Player list
- Keep existing 1-second polling; note that SSE upgrade is planned

#### Real-Time Update Listener (Phase 2 — plan now, implement later)

- Architecture: Next.js Route Handler streaming or Server-Sent Events (SSE)
- Fallback: existing 1-second polling remains until SSE is implemented
- Design the display page component to accept either polling OR push updates (abstract `useDisplayData` hook)

---

### 5. Navigation & Admin UI

#### Admin Dashboard

- **Keep existing layout and design**
- Add: tournament count badge, account/settings link placeholder
- Sidebar nav items:
  - Dashboard (overview)
  - Active Tournament
  - History
  - Players (pre-set roster management — new)
  - Settings (placeholder)

#### Context-Aware Navigation

- Organizer mode: full sidebar with Edit actions visible
- Public/display mode: minimal header, no edit controls

#### Action Toolbars

- Fixed bottom bar during active tournament with: "Add Round", "Randomize Seeds", "Reset Tournament"
- Each action requires a confirmation dialog before executing destructive operations

---

### 6. Supporting Utilities

#### Notification System

- Toast component (build with Tailwind; no new library)
- Triggers: save success, validation error, player count mismatch, round completion
- Position: top-right, auto-dismiss 4 seconds
- Error toasts: persist until dismissed

```typescript
// Usage pattern
toast.success("Round saved");
toast.error("Uneven player count — cannot start round");
```

#### Breadcrumb Navigation

- Component: `<Breadcrumbs items={[{label, href}]} />`
- Used in: Admin history detail, tournament setup steps, multi-stage phase transitions
- Keep consistent with existing Tailwind styling

---

## Removing Drag-and-Drop: Migration Guide

### What Had DnD (to replace with buttons)

| Feature                      | Old (DnD)                                         | New (Button)                                                              | Status |
| ---------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------- | ------ |
| Reorder players in setup     | `SetupDraggablePlayerSlot` drag                   | **KEPT** — `SetupPlayerSlot` with `useSortable` drag handle + ↑↓ fallback | Planned |
| Reorder courts in setup      | Drag court card                                   | **KEPT** — `SortableCourt` with `useSortable` drag handle + ↑↓ fallback   | Planned |
| Swap players in active round | `DraggablePlayerSlot` drag to slot                | Plain `<span>` click-to-swap; re-click deselects; SWAP mode toggle        | ✅ Done |
| Bench ↔ court swap           | `DraggableBenchCard` / `DroppablePlayerSlot`      | Click-to-swap; bench ↔ bottom or second-bottom court in SWAP mode         | ✅ Done |
| Assign match to court        | `DraggableUnassignedMatch` → `CourtDropContainer` | `UnassignedMatchCard` dropdown select                                     | Planned |

### Package Status After Migration

**Kept** (required for setup drag):

```
@dnd-kit/core
@dnd-kit/sortable
@dnd-kit/utilities
```

**Removed** (experimental package — was not needed):

```
@dnd-kit/react
```

---

## Coding Conventions

- **TypeScript strict mode** — no implicit `any`
- **Server actions** in `app/lib/actions.ts` — all DB calls go here, not in components
- **Pure functions** for all business logic (pairing, standings, scoring, bracket generation)
- **No `console.log`** in production code — use structured logging or remove
- **File naming**: kebab-case for engine modules (`partner-score.ts`), camelCase for legacy files
- **"use client"** directive required on any component using React hooks or browser APIs
- Component files: one component per file
- New engine code goes in `app/lib/engines/`
- New store code goes in `app/lib/store/`

---

## Known Issues to Fix During Refactor

1. `rallyToTheTop.ts` is referenced but file is missing — create or remove reference
2. `tournamentType.ts` interface is defined but unused — replace with `engines/types/tournament-type.ts`
3. `KINGOFTHECOURT` and `ROUNDROBIN` enum values exist but gameplay is not wired — hide from UI until implemented
4. `app/lib/engines/` folder is empty — populate with engine modules per target structure
5. `useTournament.ts` has inline DUPR logic (~40% of hook) that should move to engine + store
6. `game_modes/` folder has thin wrapper files — consolidate into `engines/` or remove if redundant
7. `duprTournament.ts` hardcodes 2-phase logic — generalize into multi-stage runner

---

## Testing Strategy (New Engine Code)

All new engine functions must have unit tests:

```
app/lib/engines/
  rally/
    __tests__/pairing.test.ts
    __tests__/leaderboard.test.ts
  round-robin/
    __tests__/generator.test.ts
    __tests__/standings.test.ts
  single-elimination/
    __tests__/bracket.test.ts
    __tests__/progression.test.ts
  multi-stage/
    __tests__/groups-knockout.test.ts
    __tests__/promotion.test.ts
```

Use **Jest** (already available via Next.js). Test edge cases:

- Odd number of players → validate waiting list
- All players have played together → confirm lowest-repetition partner selected
- Round-robin tiebreaker scenarios (head-to-head, point diff, overall diff)
- Knockout bracket seeding for 4, 8, 16 teams
- Multi-stage promotion: correct N teams advance from groups
- Stage boundary: round-robin complete → auto-seed knockout
- Empty court list → graceful error

---

## Phase Plan

| Phase                               | Scope                                                                                                       | Goal                                                                    | Status |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------ |
| **0 — Bench Rotation**              | `definitions.ts`, `bench-rotation.ts`, `admin/page.tsx`, `display/page.tsx`                                | Auto bench rotation, manual click-to-swap (bench ↔ bottom 2 courts), bench count badges, undo support, display bench section | ✅ Done |
| **1 — Engine Refactor**             | Extract pure functions from `useTournament.ts`, `tournament-engine.ts`, `duprTournament.ts` into `engines/` | Pure functions, typed, tested. `ITournamentStage` interface established | Planned |
| **2 — Tournament Type Hierarchy**   | Build `round-robin/`, `single-elimination/`, `multi-stage/` engines                                         | Composable single-stage + multi-stage architecture                      | Planned |
| **3 — Remove DnD (active round)**   | `admin/page.tsx`                                                                                            | Replace all active-round DnD with click-to-swap; `@dnd-kit` usage limited to setup only | ✅ Done |
| **4 — Rule Engine UI**              | New setup config panel                                                                                      | Creation wizard, win conditions, groups, legs                           | Planned |
| **5 — Public Display**              | `display/page.tsx`                                                                                          | Richer UI, bracket view, SSE-ready hook                                 | Planned |
| **6 — Participant Manager**         | Setup player/court UI                                                                                       | Pre-set roster, seeding buttons, button-based reorder                   | Planned |
| **7 — Notifications & Breadcrumbs** | Shared UI utilities                                                                                         | Toast system, breadcrumb nav                                            | Planned |
| **8 — WebSocket/SSE**               | Real-time updates                                                                                           | Replace polling for display page                                        | Planned |

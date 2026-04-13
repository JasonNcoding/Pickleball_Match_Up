'use client';

import { MouseEvent, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { gameMode } from '@/app/lib/tournament_mode/gameMode';
import { useTournamentController } from '@/app/lib/store';
import { formatDuprPhaseLabel } from '@/app/lib/game_modes/dupr/view';
import { formatRallyRoundLabel } from '@/app/lib/game_modes/rally/view';
import { migrateGameModeLabels } from '@/app/lib/actions';

function MigrationToolSection() {
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<string>('');

  const handleMigrate = async () => {
    setStatus('running');
    try {
      const res = await migrateGameModeLabels();
      if (res.success) {
        setResult(
          `Done — ${res.updatedTournament} tournament row(s), ${res.updatedHistory} history row(s) updated.`,
        );
        setStatus('done');
      } else {
        setResult(res.error ?? 'Unknown error');
        setStatus('error');
      }
    } catch (e) {
      setResult(e instanceof Error ? e.message : String(e));
      setStatus('error');
    }
  };

  if (status === 'done') return null;

  return (
    <section className="bg-amber-50 border border-amber-200 p-4 rounded-[20px] space-y-2">
      <h3 className="text-xs font-black text-amber-700 uppercase tracking-widest">
        One-Time DB Migration
      </h3>
      <p className="text-[11px] text-amber-600">
        Run once to rename any saved &ldquo;DUPR Tournament&rdquo; records to &ldquo;Group Knockout&rdquo; in the database.
        Safe to run multiple times.
      </p>
      <button
        type="button"
        onClick={handleMigrate}
        disabled={status === 'running'}
        className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white text-xs font-black uppercase tracking-widest rounded-xl transition"
      >
        {status === 'running' ? 'Running…' : 'Run Migration'}
      </button>
      {status === 'error' && (
        <p className="text-[11px] text-red-600 font-bold">{result}</p>
      )}
    </section>
  );
}

type SwapSlot = {
  courtId: string;
  team: 'A' | 'B';
  index: number;
};

function PlayerSlot({
  text,
  isEditMode,
  isActive,
  isDisabled,
  onClick,
}: {
  text: string;
  isEditMode: boolean;
  isActive: boolean;
  isDisabled: boolean;
  onClick: (e: MouseEvent<HTMLSpanElement>) => void;
}) {
  return (
    <span
      onClick={onClick}
      className={`w-full text-center text-[20px] py-4 rounded-xl font-bold truncate transition-colors ${
        isEditMode && !isDisabled ? 'cursor-pointer' : ''
      } ${
        isActive
          ? 'bg-orange-600 text-white shadow-md ring-2 ring-orange-400'
          : isEditMode && !isDisabled
          ? 'bg-orange-100 text-orange-800 hover:bg-orange-200'
          : ''
      } ${isDisabled ? 'opacity-20 grayscale' : ''}`}
    >
      {text}
    </span>
  );
}

function SetupPlayerSlot({
  id,
  slotNumber,
  playerName,
  playerRating,
  onNameChange,
  onRatingChange,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  isActivelyDragging = false,
}: {
  id: string;
  slotNumber: number;
  playerName: string;
  playerRating: string | number;
  onNameChange: (value: string) => void;
  onRatingChange: (value: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  isActivelyDragging?: boolean;
}) {
  // Draggable — provides drag handle attributes/listeners
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({ id });
  // Droppable — independently tracks when something hovers over this slot
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id });

  // Merge both refs onto the same element
  const setRef = (el: HTMLElement | null) => {
    setDragRef(el);
    setDropRef(el);
  };

  return (
    <div
      ref={setRef}
      className={`p-2 rounded-lg border space-y-2 transition-colors ${
        isDragging
          ? 'opacity-30 border-slate-100 bg-slate-50'
          : isOver
          ? 'bg-indigo-50 border-indigo-400 ring-2 ring-indigo-300'
          : 'bg-slate-50 border-slate-100'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          {/* Drag handle */}
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 rounded text-slate-300 hover:text-slate-500 hover:bg-slate-200 touch-none"
            title="Drag to swap"
            tabIndex={-1}
          >
            <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor">
              <circle cx="3" cy="3" r="1.5"/><circle cx="9" cy="3" r="1.5"/>
              <circle cx="3" cy="8" r="1.5"/><circle cx="9" cy="8" r="1.5"/>
              <circle cx="3" cy="13" r="1.5"/><circle cx="9" cy="13" r="1.5"/>
            </svg>
          </button>
          <p className="text-[10px] font-black uppercase text-slate-400">Player {slotNumber}</p>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={!canMoveUp}
            className="p-1 rounded-md bg-white border border-slate-200 text-[11px] font-black text-slate-500 disabled:opacity-30"
            title="Move up"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={!canMoveDown}
            className="p-1 rounded-md bg-white border border-slate-200 text-[11px] font-black text-slate-500 disabled:opacity-30"
            title="Move down"
          >
            ↓
          </button>
        </div>
      </div>
      <input
        value={playerName}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder={`Player ${slotNumber}`}
        className="w-full border border-slate-200 rounded-lg px-2 py-2 text-xs font-bold"
      />
      <input
        type="number"
        step="0.01"
        value={playerRating}
        onChange={(e) => onRatingChange(e.target.value)}
        placeholder="Rating"
        disabled={!playerName}
        className="w-full border border-slate-200 rounded-lg px-2 py-2 text-xs font-bold disabled:bg-slate-100 disabled:text-slate-400"
      />
    </div>
  );
}

// Rendered inside DragOverlay — a static clone that follows the cursor.
function SetupPlayerSlotOverlay({
  playerName,
  playerRating,
}: {
  playerName: string;
  playerRating: string | number;
}) {
  return (
    <div className="p-2 rounded-lg bg-white border-2 border-indigo-400 shadow-xl space-y-2 opacity-95 w-full">
      <div className="flex items-center gap-1">
        <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor" className="text-slate-400">
          <circle cx="3" cy="3" r="1.5"/><circle cx="9" cy="3" r="1.5"/>
          <circle cx="3" cy="8" r="1.5"/><circle cx="9" cy="8" r="1.5"/>
          <circle cx="3" cy="13" r="1.5"/><circle cx="9" cy="13" r="1.5"/>
        </svg>
        <p className="text-[10px] font-black uppercase text-slate-400">Moving…</p>
      </div>
      <div className="w-full border border-indigo-200 rounded-lg px-2 py-2 text-xs font-bold bg-indigo-50 text-indigo-900">{playerName || '(empty)'}</div>
      {playerRating !== '' && (
        <div className="w-full border border-indigo-200 rounded-lg px-2 py-2 text-xs font-bold bg-indigo-50 text-indigo-700">{playerRating}</div>
      )}
    </div>
  );
}

function SortableCourt({
  id,
  courtId,
  isCrown,
  courtPos,
  orderedCourtsLength,
  onMoveUp,
  onMoveDown,
  children,
}: {
  id: string;
  courtId: string;
  isCrown: boolean;
  courtPos: number;
  orderedCourtsLength: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  children: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id });

  // Only apply transform when THIS court is the one being dragged.
  // Suppressing it on non-dragging courts prevents the sort-animation from
  // zooming/moving court cards while a player slot is being dragged.
  const dragStyle: React.CSSProperties = {
    transform: isDragging ? CSS.Transform.toString(transform) : undefined,
    transition: isDragging ? transition : undefined,
    opacity: isDragging ? 0.4 : 1,
    position: isDragging ? 'relative' : undefined,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={dragStyle}
      className={`p-4 bg-white rounded-xl border space-y-4 transition-colors ${
        isDragging
          ? 'border-slate-200'
          : isOver
          ? 'border-indigo-400 ring-2 ring-indigo-300 bg-indigo-50/30'
          : 'border-slate-200'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1.5 rounded text-slate-300 hover:text-slate-500 hover:bg-slate-100 touch-none"
            title="Drag to reorder court"
            tabIndex={-1}
          >
            <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor">
              <circle cx="3" cy="3" r="1.5"/><circle cx="9" cy="3" r="1.5"/>
              <circle cx="3" cy="8" r="1.5"/><circle cx="9" cy="8" r="1.5"/>
              <circle cx="3" cy="13" r="1.5"/><circle cx="9" cy="13" r="1.5"/>
            </svg>
          </button>
          <span className="font-black text-sm uppercase">Court {courtId} {isCrown ? '\uD83D\uDC51' : ''}</span>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            disabled={courtPos === 0}
            onClick={onMoveUp}
            className="p-1 rounded-md bg-white border border-slate-200 text-[11px] font-black text-slate-500 disabled:opacity-30"
            title="Move court up"
          >↑</button>
          <button
            type="button"
            disabled={courtPos === orderedCourtsLength - 1}
            onClick={onMoveDown}
            className="p-1 rounded-md bg-white border border-slate-200 text-[11px] font-black text-slate-500 disabled:opacity-30"
            title="Move court down"
          >↓</button>
        </div>
      </div>
      {children}
    </div>
  );
}

function UnassignedMatchCard({
  label,
  availableCourts,
  onAssign,
}: {
  label: string;
  availableCourts: string[];
  onAssign: (courtId: string) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-3 bg-slate-50 space-y-2">
      <p className="text-xs font-black text-slate-700">{label}</p>
      <select
        defaultValue=""
        onChange={(e) => {
          if (e.target.value) onAssign(e.target.value);
          e.target.value = '';
        }}
        className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold bg-white"
      >
        <option value="" disabled>Assign to court…</option>
        {availableCourts.map((c) => (
          <option key={c} value={c}>Court {c}</option>
        ))}
      </select>
    </div>
  );
}

export default function Tournament() {
  const { state, config, session, computed, actions } = useTournamentController();

  // ── Scoring Rules — local state only (Phase 5 will wire to engine) ──
  const [scoringRules, setScoringRules] = useState({
    pointsPerSet: 11,
    setsPerMatch: 1,
    winBy2: true,
  });

  // Shared DnD sensors (must be at top level — not inside conditionals)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  // Track which player slot is being dragged to show DragOverlay
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const duprRequiredPlayers = config.duprKnockoutStage === 'QUARTERFINAL' ? 16 : 8;
  const duprCanStartWithStage = config.players.length % 2 === 0 && config.players.length >= duprRequiredPlayers;
  const canUndoDuprMatch = Boolean(
    session.duprState &&
      session.duprState.rounds.some((round) => Object.values(round.matches).some((match) => match.winner)),
  );

  const duprRoundLabel = formatDuprPhaseLabel(session.duprState ?? null);

  if (state.tournamentFinished) {
    // For DUPR/GK mode the engine already places the final-match winner at index 0.
    // Use leaderboard order directly so the champion is whoever won the final, not whoever
    // accumulated the most wins across all rounds.
    let podium: { names: string[]; score: number }[];
    if (state.isDuprMode) {
      podium = session.duprFinalLeaderboard.slice(0, 3).map((entry) => ({
        names: [entry.teamName],
        score: entry.wins,
      }));
      while (podium.length < 3) podium.push({ names: [], score: 0 });
    } else {
      const stats = computed.getLeaderboard();
      const grouped = stats.reduce((acc, curr) => {
        if (!acc[curr.winCount]) acc[curr.winCount] = [];
        acc[curr.winCount].push(curr.name);
        return acc;
      }, {} as Record<number, string[]>);
      const sortedScores = Object.keys(grouped).map(Number).sort((a, b) => b - a);
      podium = [
        { names: grouped[sortedScores[0]] || [], score: sortedScores[0] || 0 },
        { names: grouped[sortedScores[1]] || [], score: sortedScores[1] || 0 },
        { names: grouped[sortedScores[2]] || [], score: sortedScores[2] || 0 },
      ];
    }

    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-start text-white p-6 pt-20 font-sans overflow-y-auto">
        <h1 className="text-5xl font-black italic mb-20 text-amber-400 uppercase tracking-tighter text-center">Final Standings</h1>
        <div className="flex flex-col md:flex-row mb-4 items-end justify-center gap-6 w-full max-w-5xl pb-10">
          {podium[0].names.length > 0 && (
            <div className="flex flex-col items-center w-full md:w-1/3 order-1 md:order-2">
              <div className="text-center mb-1 min-h-[100px] flex flex-col justify-end">
                {podium[0].names.map(n => 
                <div key={n} 
                className="kahoot-wiggle font-black text-[100px] uppercase text-amber-400 leading-tight" 
                style={{ 
                    animationDelay: `${2}s` 
                  }}
                > {computed.capitalize(n)}</div>)}
                <div className="text-[30px] font-black text-amber-600 mt-4">
                  {state.isDuprMode ? 'KNOCKOUT CHAMPION' : `${podium[0].score} WINS`}
                </div>
              </div>
              <div className="bg-amber-600 w-full max-w-[180px] h-50 rounded-t-3xl border-t-8 border-amber-300 shadow-[0_0_60px_rgba(245,158,11,0.4)] flex items-center justify-center text-[100px] font-black text-amber-200">1</div>
            </div>
          )}
        </div>
          <div className="flex flex-col sm:flex-row gap-4">
          <button 
            onClick={() => actions.setTournamentFinished(false)} 
            className="px-10 py-5 border-2 border-white/20 text-white font-black rounded-full hover:bg-white/10 transition-all uppercase tracking-widest text-lg"
          >
            Back to Tournament
          </button>
          
          <button 
            onClick={actions.newSession} 
            className="px-12 py-5 bg-white text-black font-black rounded-full shadow-2xl hover:scale-105 transition-transform uppercase tracking-widest text-lg"
          >
            New Session
          </button>
        </div>
      </div>
      
    );
  }

  if (!state.setupComplete) {
    const syncPlayersAndBulk = (nextPlayers: { id: string; name: string; rating: number }[]) => {
      actions.setPlayers(nextPlayers);
      actions.setBulkInput(nextPlayers.map((p) => `${p.name}:${p.rating}`).join('\n'));
    };

    const updatePlayerNameAtIndex = (index: number, value: string) => {
      const trimmed = value.trim();
      const next = [...config.players];
      if (!trimmed) {
        if (index < next.length) {
          next.splice(index, 1);
          syncPlayersAndBulk(next);
        }
        return;
      }
      const existing = next[index];
      if (existing) {
        next[index] = { ...existing, id: trimmed, name: trimmed };
      } else {
        next.splice(Math.min(index, next.length), 0, { id: trimmed, name: trimmed, rating: 3.5 });
      }
      syncPlayersAndBulk(next);
    };

    const updatePlayerRatingAtIndex = (index: number, value: string) => {
      const parsed = parseFloat(value);
      if (!Number.isFinite(parsed)) return;
      const next = [...config.players];
      const existing = next[index];
      if (!existing) return;
      next[index] = { ...existing, rating: parsed };
      syncPlayersAndBulk(next);
    };

    const swapSetupPlayersAtIndexes = (sourceIndex: number, targetIndex: number) => {
      if (sourceIndex === targetIndex) return;
      const next = [...config.players];
      const source = next[sourceIndex];
      const target = next[targetIndex];
      if (!source && !target) return;
      if (source && target) {
        [next[sourceIndex], next[targetIndex]] = [next[targetIndex], next[sourceIndex]];
        syncPlayersAndBulk(next);
        return;
      }
      if (source && !target) {
        const [moved] = next.splice(sourceIndex, 1);
        const insertIndex = Math.min(targetIndex, next.length);
        next.splice(insertIndex, 0, moved);
        syncPlayersAndBulk(next);
        return;
      }
      if (!source && target) {
        const [moved] = next.splice(targetIndex, 1);
        const insertIndex = Math.min(sourceIndex, next.length);
        next.splice(insertIndex, 0, moved);
        syncPlayersAndBulk(next);
      }
    };

    // Unified drag end — discriminates by ID prefix so courts and player slots
    // share one DndContext, enabling cross-court player dragging.
    const handleSetupDragEnd = (event: DragEndEvent) => {
      setActiveDragId(null);
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const activeId = active.id as string;
      const overId = over.id as string;
      if (activeId.startsWith('court-') && overId.startsWith('court-')) {
        actions.reorderCourtById(activeId.replace('court-', ''), overId.replace('court-', ''));
      } else if (activeId.startsWith('player-slot-') && overId.startsWith('player-slot-')) {
        const from = parseInt(activeId.replace('player-slot-', ''));
        const to = parseInt(overId.replace('player-slot-', ''));
        // Swap the two slots directly — no shifting of other players.
        const next = [...config.players];
        [next[from], next[to]] = [next[to], next[from]];
        syncPlayersAndBulk(next);
      }
    };

    return (
      <div className="max-w-6xl mx-auto p-6 py-12 space-y-8 bg-white">
        <header className="text-center space-y-2">
          <h1 className="text-5xl font-black italic tracking-tighter text-slate-900 uppercase">Tournament Setup</h1>
        </header>
        <section className="bg-slate-50 p-6 rounded-[32px] border border-slate-100 space-y-4">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">0. Tournament Type</h3>

          {/* Playable types */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {([gameMode.RALLYTOTHETOP, gameMode.GROUP_KNOCKOUT] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => actions.setMode(m)}
                className={`py-3 px-4 rounded-xl border text-sm font-black uppercase tracking-widest text-left transition ${
                  state.mode === m
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'
                }`}
              >
                {m}
                <span className={`block text-[10px] font-bold mt-0.5 uppercase tracking-widest ${state.mode === m ? 'text-indigo-200' : 'text-emerald-600'}`}>
                  ✓ Playable
                </span>
              </button>
            ))}
          </div>

          {/* Coming-soon types */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {([gameMode.ROUNDROBIN, gameMode.SINGLE_ELIMINATION, gameMode.DOUBLE_ELIMINATION] as const).map((m) => (
              <button
                key={m}
                type="button"
                disabled
                className="py-3 px-4 rounded-xl border border-slate-200 bg-slate-100 text-left cursor-not-allowed opacity-60"
              >
                <span className="text-sm font-black text-slate-500 uppercase tracking-widest">{m}</span>
                <span className="block text-[10px] font-bold mt-0.5 text-slate-400 uppercase tracking-widest">Coming Soon</span>
              </button>
            ))}
          </div>

          {state.mode === gameMode.GROUP_KNOCKOUT && (
            <div className="mt-1 space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">
                Group Knockout mode is fully playable.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => actions.setDuprKnockoutStage('SEMIFINAL')}
                  className={`py-2 rounded-xl border text-xs font-black uppercase tracking-widest ${
                    config.duprKnockoutStage === 'SEMIFINAL'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-slate-600 border-slate-200'
                  }`}
                >
                  Start Knockout At Semifinal
                </button>
                <button
                  type="button"
                  onClick={() => actions.setDuprKnockoutStage('QUARTERFINAL')}
                  className={`py-2 rounded-xl border text-xs font-black uppercase tracking-widest ${
                    config.duprKnockoutStage === 'QUARTERFINAL'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-slate-600 border-slate-200'
                  }`}
                >
                  Start Knockout At Quarterfinal
                </button>
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                Quarterfinal needs at least 8 teams (16 players). Semifinal needs 4 teams (8 players).
              </p>
            </div>
          )}
        </section>

        {/* ── Section 0.5 — Scoring Rules (local state, wired to engine in Phase 5) ── */}
        <section className="bg-slate-50 p-6 rounded-[32px] border border-slate-100 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">0.5 Scoring Rules</h3>
            <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-600 uppercase tracking-widest">Preview — engine not yet wired</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Points per Set</label>
              <input
                type="number"
                min={1}
                max={25}
                value={scoringRules.pointsPerSet}
                onChange={(e) => setScoringRules((r) => ({ ...r, pointsPerSet: Math.max(1, parseInt(e.target.value) || 11) }))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold bg-white"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Sets per Match</label>
              <input
                type="number"
                min={1}
                max={5}
                value={scoringRules.setsPerMatch}
                onChange={(e) => setScoringRules((r) => ({ ...r, setsPerMatch: Math.max(1, parseInt(e.target.value) || 1) }))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold bg-white"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Win By 2</label>
              <button
                type="button"
                onClick={() => setScoringRules((r) => ({ ...r, winBy2: !r.winBy2 }))}
                className={`w-full py-2 rounded-xl border text-xs font-black uppercase tracking-widest transition ${
                  scoringRules.winBy2
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                {scoringRules.winBy2 ? 'On' : 'Off'}
              </button>
            </div>
          </div>
        </section>

        <section className="bg-slate-50 p-6 rounded-[32px] border border-slate-100 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">
              1. Courts + Roster (Enable + Order + Team Draft)
            </h3>
            <span className={`text-[10px] font-black px-2 py-1 rounded-md ${
              state.isDuprMode
                ? (duprCanStartWithStage ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700')
                : (config.players.length >= config.selectedCourts.length * 4 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700')
            }`}>
              {state.isDuprMode
                ? `${config.players.length} PLAYERS (EVEN, MIN ${duprRequiredPlayers})`
                : `${config.players.length} / ${config.selectedCourts.length * 4} PLAYERS`}
            </span>
          </div>

          <div className="space-y-2">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const text = await file.text();
                const result = actions.importPlayersFromCsv(text);
                if (!result.ok) alert('Could not parse CSV. Expected columns: First Name, DUPR');
                e.currentTarget.value = '';
              }}
              className="w-full text-xs font-black uppercase tracking-widest text-slate-500 file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-slate-900 file:text-white"
            />
            <textarea
              rows={3}
              value={config.bulkInput}
              placeholder="Paste names (e.g. Arthur, Evie, John) or Name:Rating"
              onChange={e => {
                actions.setBulkInput(e.target.value);
                const lines = e.target.value.split(/[\n]+/).filter(s => s.trim());
                const newPlayers = lines.map(line => {
                  const parts = line.split(':');
                  const name = parts[0].trim();
                  const rating = parseFloat(parts[1]) || 3.5;
                  return { id: name, name, rating };
                });
                actions.setPlayers(newPlayers);
              }}
              className="w-full p-4 bg-white rounded-2xl border-none font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-600"
            />
            <p className="text-[9px] text-slate-400 font-bold px-2 uppercase tracking-tight">
              CSV import uses "First Name" and "DUPR" columns.
            </p>
            <button
              type="button"
              onClick={actions.randomizePlayers}
              disabled={config.players.length < 2}
              className="w-full py-2 rounded-xl bg-emerald-600 text-white font-black uppercase text-xs tracking-widest disabled:bg-slate-200 disabled:text-slate-400"
            >
              Randomise Team Pairings
            </button>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {config.availableCourts.map((c) => (
              <button
                key={c}
                onClick={() => actions.toggleCourtSelection(c)}
                className={`py-3 rounded-xl font-black transition ${
                  config.selectedCourts.includes(c)
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-slate-300 border border-slate-200'
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            Drag ⠿ to reorder courts and player slots — or use ↑↓ for fine control.
          </p>

          {(() => {
            const orderedCourts = config.courtOrder.filter((c) => config.selectedCourts.includes(c));
            // All court + player-slot IDs in one SortableContext so players can be
            // dragged across court boundaries.
            const allSortableIds = [
              ...orderedCourts.map((c) => `court-${c}`),
              ...config.players.map((_, i) => `player-slot-${i}`),
            ];
            return (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={(event: DragStartEvent) => {
                  if ((event.active.id as string).startsWith('player-slot-')) {
                    setActiveDragId(event.active.id as string);
                  }
                }}
                onDragEnd={handleSetupDragEnd}
                onDragCancel={() => setActiveDragId(null)}
              >
                <SortableContext items={allSortableIds} strategy={verticalListSortingStrategy}>
                  <div className="space-y-3">
                    {orderedCourts.map((c, i) => {
                      const courtBaseIndex = i * 4;
                      return (
                        <SortableCourt
                          key={c}
                          id={`court-${c}`}
                          courtId={c}
                          isCrown={i === 0}
                          courtPos={i}
                          orderedCourtsLength={orderedCourts.length}
                          onMoveUp={() => {
                            const prev = orderedCourts[i - 1];
                            if (prev) actions.reorderCourtById(c, prev);
                          }}
                          onMoveDown={() => {
                            const next = orderedCourts[i + 1];
                            if (next) actions.reorderCourtById(c, next);
                          }}
                        >
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {(['A', 'B'] as const).map((teamKey) => {
                              const offsets = teamKey === 'A' ? [0, 1] : [2, 3];
                              return (
                                <div key={`${c}-team-${teamKey}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-600">Team {teamKey}</p>
                                  {offsets.map((offset, playerOffset) => {
                                    const playerIndex = courtBaseIndex + offset;
                                    const player = config.players[playerIndex];
                                    return (
                                      <SetupPlayerSlot
                                        key={`${c}-slot-${offset}`}
                                        id={`player-slot-${playerIndex}`}
                                        slotNumber={playerOffset + 1}
                                        playerName={player?.name ?? ''}
                                        playerRating={player?.rating ?? ''}
                                        canMoveUp={playerIndex > 0}
                                        canMoveDown={playerIndex < config.players.length - 1}
                                        isActivelyDragging={activeDragId !== null}
                                        onMoveUp={() => swapSetupPlayersAtIndexes(playerIndex, playerIndex - 1)}
                                        onMoveDown={() => swapSetupPlayersAtIndexes(playerIndex, playerIndex + 1)}
                                        onNameChange={(value) => updatePlayerNameAtIndex(playerIndex, value)}
                                        onRatingChange={(value) => updatePlayerRatingAtIndex(playerIndex, value)}
                                      />
                                    );
                                  })}
                                </div>
                              );
                            })}
                          </div>
                        </SortableCourt>
                      );
                    })}
                  </div>
                </SortableContext>
                <DragOverlay dropAnimation={null}>
                  {activeDragId ? (() => {
                    const idx = parseInt(activeDragId.replace('player-slot-', ''));
                    const p = config.players[idx];
                    return (
                      <SetupPlayerSlotOverlay
                        playerName={p?.name ?? ''}
                        playerRating={p?.rating ?? ''}
                      />
                    );
                  })() : null}
                </DragOverlay>
              </DndContext>
            );
          })()}
        </section>

        <MigrationToolSection />

        {/* ── Section 3 — Tournament Metadata ── */}
        <section className="bg-slate-50 p-6 rounded-[32px] border border-slate-100 space-y-4">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">3. Tournament Info</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-3 space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Tournament Name</label>
              <input
                type="text"
                value={config.tournamentName}
                onChange={(e) => actions.setMetadata({ tournamentName: e.target.value })}
                placeholder="e.g. Spring Smash 2026"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold bg-white"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Date</label>
              <input
                type="date"
                value={config.tournamentDate}
                onChange={(e) => actions.setMetadata({ tournamentDate: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold bg-white"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Available Courts at Venue</label>
              <input
                type="number"
                min={1}
                max={7}
                value={config.courtCount}
                onChange={(e) => actions.setMetadata({ courtCount: Math.min(7, Math.max(1, parseInt(e.target.value) || 7)) })}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold bg-white"
              />
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Max 7 courts</p>
            </div>
          </div>
        </section>

        <button
          disabled={state.isDuprMode ? !duprCanStartWithStage : config.players.length < config.selectedCourts.length * 4}
          onClick={actions.startTournament}
          className="w-full py-6 bg-indigo-600 text-white font-black text-xl rounded-2xl shadow-xl transition-all hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-300 uppercase tracking-widest"
        >
          Start Tournament
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto p-4 lg:p-10">
      <header className="flex flex-wrap justify-between items-center gap-4 mb-10">
        <div>
          <h1 className="text-4xl font-black italic uppercase tracking-tighter">
            {state.isDuprMode
              ? duprRoundLabel
              : formatRallyRoundLabel(session.history.length + 1)}
          </h1>
          {config.tournamentName && (
            <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">{config.tournamentName}</p>
          )}
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
            {state.isDuprMode ? `Mode: ${state.mode}` : `King: Court ${session.kingCourt} • Bottom: Court ${session.bottomCourt}`}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => actions.setShowHistoryModal(true)} className="px-6 py-2 bg-slate-100 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition">LOG</button>
          <button onClick={() => { actions.setIsEditMode(!session.isEditMode); actions.setSwapSelection(null); }}
            className={`px-6 py-2 rounded-xl font-bold transition ${session.isEditMode ? 'bg-orange-400 hover:bg-orange-500 text-white shadow-lg transition' : 'hover:bg-slate-200 bg-slate-100 text-slate-600 transition'}`}>{session.isEditMode ? 'FINISH SWAP' : 'SWAP'}</button>
          <button onClick={actions.finishTournament} className="px-6 py-2 bg-slate-100 rounded-xl font-bold text-slate-600 hover:bg-emerald-500 hover:text-white transition ">FINISH</button>
          <button
            onClick={actions.resetTournament}
            className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition rounded-xl font-black text-xs border border-red-100"
          >
            RESET
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
          <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
            {(state.isDuprMode ? config.selectedCourts : session.activeCourtOrder).map((cId) => {
              const m = session.currentMatches[cId];
              if (!m && state.isDuprMode) {
                return (
                  <div key={cId} className="bg-white h-fit rounded-[32px] border-2 border-dashed border-emerald-300 transition overflow-hidden">
                    <div className="py-2 px-4 text-[15px] text-center font-black uppercase tracking-widest bg-emerald-600 text-white">
                      Court {cId}
                    </div>
                    <div className="p-6 text-center">
                      <p className="text-sm font-black uppercase tracking-widest text-emerald-600">Waiting For Next Match</p>
                    </div>
                  </div>
                );
              }
              if (!m) return null;
              return (
                <div key={cId} className={`bg-white h-fit rounded-[32px] border-2 transition overflow-hidden ${state.isDuprMode ? 'border-emerald-200' : cId === session.kingCourt ? 'border-amber-400 ring-4 ring-amber-50' : 'border-slate-100'}`}>
                {/* Court Header */}
                <div className={`py-2 px-4 text-[15px] text-center font-black uppercase tracking-widest ${state.isDuprMode ? 'bg-emerald-600 text-white' : cId === session.kingCourt ? 'bg-amber-400' : cId === session.bottomCourt ? 'bg-slate-200' : 'bg-slate-800 text-white'}`}>
                  Court {cId} {!state.isDuprMode ? (cId === session.kingCourt ? '👑' : cId === session.bottomCourt ? '⬇️' : '') : ''}
                </div>

                {/* Match Grid Area */}
                <div className="p-4 relative">
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                    <div className="bg-white px-3 py-1 rounded-full border-2 border-slate-100 text-[11px] font-black text-slate-400 italic shadow-sm">
                      VS
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-10">
                  {['A', 'B'].map((teamKey) => {
                    const team = teamKey === 'A' ? m.teamA : m.teamB;
                    return (
                      <div key={teamKey} className="relative">
                        <div onClick={() => !session.isEditMode && !state.isDuprMode && actions.setCurrentMatches({...session.currentMatches, [cId]: {...m, winner: teamKey as 'A'|'B'}})}
                          className={`flex flex-col gap-2 p-4 rounded-2xl border-2 transition cursor-pointer ${m.winner === teamKey ? 'bg-indigo-50 border-indigo-500 shadow-inner' : 'bg-slate-50 border-transparent hover:border-slate-200'}`}>
                          {team.map((pId, idx) => {
                            const active = session.swapSelection?.courtId === cId && session.swapSelection.team === teamKey && session.swapSelection.index === idx;
                            const disabled = !session.isRoundOne && session.swapSelection && session.swapSelection.courtId !== cId;
                            return (
                              <PlayerSlot
                                key={idx}
                                text={computed.capitalize(pId)}
                                isEditMode={session.isEditMode}
                                isActive={active}
                                isDisabled={Boolean(disabled)}
                                onClick={(e) => {
                                  if (session.isEditMode && !disabled) {
                                    e.stopPropagation();
                                    if (!session.swapSelection) actions.setSwapSelection({courtId: cId, team: teamKey as 'A'|'B', index: idx});
                                    else actions.handleSwap({courtId: cId, team: teamKey as 'A'|'B', index: idx});
                                  }
                                }}
                              />
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  </div>
                </div>
                {state.isDuprMode && (
                  <div className="px-4 pb-4 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Team A Score</p>
                        <input
                          type="number"
                          min={0}
                          value={session.duprScoreDrafts[m.id]?.teamA ?? ''}
                          onChange={(e) => actions.setDuprScoreDraft(m.id, 'A', e.target.value)}
                          placeholder="11"
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold"
                        />
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Team B Score</p>
                        <input
                          type="number"
                          min={0}
                          value={session.duprScoreDrafts[m.id]?.teamB ?? ''}
                          onChange={(e) => actions.setDuprScoreDraft(m.id, 'B', e.target.value)}
                          placeholder="7"
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => actions.completeDuprCourtMatch(cId)}
                        className="flex-1 py-2 rounded-xl bg-emerald-600 text-white font-black text-xs uppercase tracking-widest"
                      >
                        Finish Match
                      </button>
                      <button
                        onClick={() => actions.unassignDuprCourt(cId)}
                        className="flex-1 py-2 rounded-xl bg-slate-200 text-slate-700 font-black text-xs uppercase tracking-widest"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )}
              </div>
              );
            })}
          </div>

        
          <aside className="space-y-6">
            {state.isDuprMode && (
              <div className="bg-white p-5 rounded-[24px] border border-slate-200">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">Unassigned Matches</h3>
                {session.duprUnassignedMatches.length === 0 ? (
                  <p className="text-xs font-black uppercase text-slate-400">No pending matches</p>
                ) : (
                  <div className="space-y-3 max-h-72 overflow-y-auto">
                    {session.duprUnassignedMatches.map((entry) => {
                      const round = session.duprState?.rounds[entry.roundIndex];
                      const match = round?.matches[entry.matchId];
                    if (!match) return null;
                    const emptyCourts = config.selectedCourts.filter((c) => !session.currentMatches[c]);
                    return (
                      <div key={`${entry.roundIndex}-${entry.matchId}`} className="space-y-2">
                        <UnassignedMatchCard
                          label={`${match.teamA.join(' / ')} vs ${match.teamB.join(' / ')}`}
                          availableCourts={emptyCourts}
                          onAssign={(courtId) => actions.assignDuprMatchToCourt(entry.matchId, courtId, entry.roundIndex)}
                        />
                      </div>
                    );
                  })}
                  </div>
                )}
              </div>
            )}
            <div className="md:col-span-2 flex gap-4 mt-6">
              <button disabled={!session.canProceedNextRound || session.isEditMode}
                onClick={actions.nextRound}
                className="flex-[2] py-6 bg-indigo-600 text-white font-black text-xl rounded-3xl shadow-xl disabled:bg-slate-200 uppercase transition">Next Round →</button>
            </div>
            <div className="md:col-span-2 flex gap-4 mt-6">
              <button
                onClick={state.isDuprMode ? actions.undoDuprLastMatch : actions.undoRound}
                disabled={state.isDuprMode ? !canUndoDuprMatch : session.history.length === 0}
                className="flex-1 py-6 bg-slate-400 text-white font-black text-xl rounded-3xl disabled:opacity-10 transition duration-300 opacity-50 hover:opacity-100"
              >
                {state.isDuprMode ? 'UNDO MATCH' : 'UNDO'}
              </button>
              </div>
            <div className="bg-slate-900 text-white p-8 rounded-[40px] shadow-2xl">
              <h2 className="text-2xl font-black italic mb-2 tracking-tighter uppercase text-center">Leaderboard</h2>
              <div className="space-y-4">
                {state.isDuprMode
                  ? session.duprStandings.map((entry, i) => (
                      <div key={entry.teamId} className="flex justify-between border-b border-slate-800 pb-2">
                        <span className="font-bold text-slate-400">{i + 1}. {entry.teamName}</span>
                        <span className="text-amber-400 font-bold">{entry.wins}-{entry.losses}</span>
                      </div>
                    ))
                  : computed.getLeaderboard().slice(0, 8).map((e, i) => (
                      <div key={e.name} className="flex justify-between border-b border-slate-800 pb-2">
                        <span className="font-bold text-slate-400">{i+1}. {computed.capitalize(e.name)}</span>
                        <span className="text-amber-400 font-bold">{e.winCount}</span>
                      </div>
                    ))}
              </div>
            </div>
          </aside>
      </div>

      {/* --- HISTORY LOG MODAL --- */}
      {session.showHistoryModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[100] p-4 lg:p-10" onClick={() => actions.setShowHistoryModal(false)}>
          <div className="bg-white rounded-[40px] w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            <header className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h2 className="text-4xl font-black italic uppercase tracking-tighter text-slate-900">Match Log</h2>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  {state.isDuprMode
                    ? `${session.duprMatchLog.length} Matches Recorded`
                    : `${session.history.length} Rounds Completed`}
                </p>
              </div>
              <button onClick={() => actions.setShowHistoryModal(false)} className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm hover:scale-110 transition active:scale-95 font-bold text-xl border border-slate-200">×</button>
            </header>
            
            <div className="flex-1 overflow-y-auto p-8 space-y-12">
              {state.isDuprMode ? (
                session.duprMatchLog.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-300">
                    <div className="text-6xl mb-4">📓</div>
                    <p className="font-black uppercase tracking-widest">No matches recorded yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {[...session.duprMatchLog].reverse().map((entry) => (
                      <div key={entry.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-black uppercase tracking-wider text-slate-500">
                          {entry.phase === 'KNOCKOUT' ? 'Knockout' : 'Round Robin'} • Match {entry.matchId} • Score: {entry.score} • Winner: Team {entry.winner}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-700">
                          Team A: {entry.teamA.join(' and ')} vs Team B: {entry.teamB.join(' and ')}
                        </p>
                      </div>
                    ))}
                  </div>
                )
              ) : session.history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-300">
                  <div className="text-6xl mb-4">📓</div>
                  <p className="font-black uppercase tracking-widest">No rounds recorded yet</p>
                </div>
              ) : (
                [...session.history].reverse().map((round, rIdx) => {
                  const currentRoundNum = session.history.length - rIdx;
                  return (
                    <div key={rIdx} className="space-y-6">
                      <div className="flex items-center gap-4">
                        <div className="h-px flex-1 bg-slate-100"></div>
                        <div className="flex flex-col items-center">
                          <h3 className="font-black text-indigo-600 uppercase tracking-tighter text-xl italic">Round {currentRoundNum}</h3>
                        </div>
                        <div className="h-px flex-1 bg-slate-100"></div>
                      </div>
                      <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {Object.keys(round.matches).map((cId) => {
                          const m = round.matches[cId];
                          if (!m) return null;
                          const isKing = cId === session.kingCourt;
                          const isBottom = cId === session.bottomCourt;
                          const currentRoundNumForPoints = session.history.length + 1;
                          const countsForPoints = isKing && currentRoundNumForPoints > 1;

                          return (
                            <div
                              key={cId}
                              className={`rounded-[32px] border-2 transition-all overflow-hidden shadow-sm ${
                                countsForPoints ? 'bg-amber-50 border-amber-400 ring-4 ring-amber-100' : 'bg-white border-slate-100'
                              }`}
                            >
                              <div className={`py-2 px-4 text-[13px] font-black uppercase tracking-widest flex justify-between items-center ${
                                isKing ? 'bg-amber-400 text-slate-900' : isBottom ? 'bg-slate-200 text-slate-600' : 'bg-slate-800 text-white'
                              }`}>
                                <span>Court {cId}</span>
                                {isKing && <span>{countsForPoints ? '👑 King Court (Points Active)' : '👑 King Court'}</span>}
                                {isBottom && <span>⬇️ Bottom Court</span>}
                              </div>
                              <div className="p-2 relative">
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                                  <div className="bg-white px-3 py-1 rounded-full border-2 border-slate-100 text-[11px] font-black text-slate-400 italic shadow-sm">
                                    VS
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  {['A', 'B'].map((teamKey) => {
                                    const team = teamKey === 'A' ? m.teamA : m.teamB;
                                    const isWinner = m.winner === teamKey;
                                    return (
                                      <div
                                        key={teamKey}
                                        className={`flex flex-col gap-0 rounded-2xl border-2 transition-all ${
                                          isWinner ? (countsForPoints ? 'bg-amber-500 border-transparent shadow-lg scale-[1.02]' : 'bg-indigo-600 border-transparent shadow-lg scale-[1.02]') : 'bg-slate-50 border-transparent'
                                        }`}
                                      >
                                        {team.map((pId, idx) => (
                                          <span
                                            key={idx}
                                            className={`w-full text-center text-[18px] py-3 rounded-xl font-bold transition-all break-words leading-tight ${
                                              isWinner ? 'text-white' : 'text-slate-800'
                                            }`}
                                          >
                                            {computed.capitalize(pId)}
                                          </span>
                                        ))}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            
            <footer className="p-6 bg-slate-50 border-t border-slate-100 text-center">
              <button onClick={() => actions.setShowHistoryModal(false)} className="px-10 py-3 bg-slate-900 text-white rounded-full font-black uppercase tracking-widest text-sm">Close Log</button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

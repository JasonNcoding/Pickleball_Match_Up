'use client';

import { MouseEvent, ReactNode, useState } from 'react';
import { DndContext, DragEndEvent, useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { gameMode } from '@/app/lib/tournament_mode/gameMode';
import { useTournamentController } from '@/app/lib/useTournament';
import { formatDuprPhaseLabel } from '@/app/lib/game_modes/dupr/view';
import { formatRallyRoundLabel } from '@/app/lib/game_modes/rally/view';

type SwapSlot = {
  courtId: string;
  team: 'A' | 'B';
  index: number;
};

const slotId = (slot: SwapSlot) => `slot:${slot.courtId}:${slot.team}:${slot.index}`;
const parseSlotId = (id: string): SwapSlot | null => {
  const parts = id.split(':');
  if (parts.length !== 4 || parts[0] !== 'slot') return null;
  const index = Number(parts[3]);
  if (!Number.isInteger(index)) return null;
  const team = parts[2];
  if (team !== 'A' && team !== 'B') return null;
  return { courtId: parts[1], team, index };
};

const setupSlotId = (index: number) => `setup-slot:${index}`;
const parseSetupSlotId = (id: string): number | null => {
  const parts = id.split(':');
  if (parts.length !== 2 || parts[0] !== 'setup-slot') return null;
  const index = Number(parts[1]);
  return Number.isInteger(index) ? index : null;
};

const unassignedMatchId = (roundIndex: number, matchId: string) => `unassigned:${roundIndex}:${matchId}`;
const parseUnassignedMatchId = (id: string): { roundIndex: number; matchId: string } | null => {
  const parts = id.split(':');
  if (parts.length < 3 || parts[0] !== 'unassigned') return null;
  const roundIndex = Number(parts[1]);
  if (!Number.isInteger(roundIndex)) return null;
  return { roundIndex, matchId: parts.slice(2).join(':') };
};

const courtDropId = (courtId: string) => `court-drop:${courtId}`;
const parseCourtDropId = (id: string): string | null => (id.startsWith('court-drop:') ? id.replace('court-drop:', '') : null);

function DraggablePlayerSlot({
  id,
  text,
  isEditMode,
  isActive,
  isDisabled,
  onClick,
}: {
  id: string;
  text: string;
  isEditMode: boolean;
  isActive: boolean;
  isDisabled: boolean;
  onClick: (e: MouseEvent<HTMLSpanElement>) => void;
}) {
  const draggable = useDraggable({
    id,
    disabled: !isEditMode || isDisabled,
  });
  const droppable = useDroppable({
    id,
    disabled: !isEditMode || isDisabled,
  });
  const setNodeRef = (node: HTMLElement | null) => {
    draggable.setNodeRef(node);
    droppable.setNodeRef(node);
  };

  return (
    <span
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(draggable.transform),
        zIndex: draggable.isDragging ? 999 : undefined,
        touchAction: 'none',
      }}
      onClick={onClick}
      {...(isEditMode && !isDisabled ? draggable.listeners : {})}
      {...(isEditMode && !isDisabled ? draggable.attributes : {})}
      className={`w-full text-center text-[20px] py-4 rounded-xl font-bold truncate transition-colors ${
        isEditMode ? 'bg-orange-100 text-orange-800 cursor-grab active:cursor-grabbing' : ''
      } ${isActive ? 'bg-orange-600 text-white shadow-md' : ''} ${isDisabled ? 'opacity-20 grayscale' : ''} ${
        draggable.isDragging ? 'ring-2 ring-indigo-400 scale-[1.02] shadow-lg relative' : ''
      }`}
    >
      {text}
    </span>
  );
}

function SetupDraggablePlayerSlot({
  id,
  slotNumber,
  playerName,
  playerRating,
  onNameChange,
  onRatingChange,
}: {
  id: string;
  slotNumber: number;
  playerName: string;
  playerRating: string | number;
  onNameChange: (value: string) => void;
  onRatingChange: (value: string) => void;
}) {
  const draggable = useDraggable({ id });
  const droppable = useDroppable({ id });
  const setNodeRef = (node: HTMLElement | null) => {
    draggable.setNodeRef(node);
    droppable.setNodeRef(node);
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(draggable.transform),
        zIndex: draggable.isDragging ? 999 : undefined,
        touchAction: 'none',
      }}
      className={`p-2 rounded-lg bg-slate-50 border border-slate-100 space-y-2 ${
        droppable.isOver ? 'ring-2 ring-indigo-300 border-indigo-300' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black uppercase text-slate-400">Player {slotNumber}</p>
        <button
          type="button"
          {...draggable.listeners}
          {...draggable.attributes}
          className="px-2 py-1 rounded-md bg-white border border-slate-200 text-[9px] font-black uppercase text-slate-500 cursor-grab active:cursor-grabbing"
          title="Drag to swap player slot"
        >
          Drag
        </button>
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

function DraggableUnassignedMatch({
  id,
  label,
}: {
  id: string;
  label: string;
}) {
  const draggable = useDraggable({ id });
  return (
    <div
      ref={draggable.setNodeRef}
      style={{
        transform: CSS.Translate.toString(draggable.transform),
        zIndex: draggable.isDragging ? 999 : undefined,
        touchAction: 'none',
      }}
      {...draggable.listeners}
      {...draggable.attributes}
      className={`rounded-xl border border-slate-200 p-3 bg-slate-50 cursor-grab active:cursor-grabbing ${
        draggable.isDragging ? 'shadow-xl ring-2 ring-emerald-300' : ''
      }`}
    >
      <p className="text-xs font-black text-slate-700">{label}</p>
    </div>
  );
}

function CourtDropContainer({
  id,
  enabled,
  children,
}: {
  id: string;
  enabled: boolean;
  children: ReactNode;
}) {
  const droppable = useDroppable({ id, disabled: !enabled });
  return (
    <div
      ref={droppable.setNodeRef}
      className={`${droppable.isOver ? 'ring-4 ring-emerald-200 rounded-[32px]' : ''}`}
    >
      {children}
    </div>
  );
}

export default function Tournament() {
  const { state, config, session, computed, actions } = useTournamentController();
  const [draggingCourtId, setDraggingCourtId] = useState<string | null>(null);
  const duprRequiredPlayers = config.duprKnockoutStage === 'QUARTERFINAL' ? 16 : 8;
  const duprCanStartWithStage = config.players.length % 2 === 0 && config.players.length >= duprRequiredPlayers;
  const canUndoDuprMatch = Boolean(
    session.duprState &&
      session.duprState.rounds.some((round) => Object.values(round.matches).some((match) => match.winner)),
  );

  const duprRoundLabel = formatDuprPhaseLabel(session.duprState ?? null);

  if (state.tournamentFinished) {
    const stats = state.isDuprMode
      ? session.duprFinalLeaderboard.map((entry) => ({ name: entry.teamName, winCount: entry.wins }))
      : computed.getLeaderboard();
    const grouped = stats.reduce((acc, curr) => {
      if (!acc[curr.winCount]) acc[curr.winCount] = [];
      acc[curr.winCount].push(curr.name);
      return acc;
    }, {} as Record<number, string[]>);
    const sortedScores = Object.keys(grouped).map(Number).sort((a, b) => b - a);
    const podium = [
      { names: grouped[sortedScores[0]] || [], score: sortedScores[0] || 0 },
      { names: grouped[sortedScores[1]] || [], score: sortedScores[1] || 0 },
      { names: grouped[sortedScores[2]] || [], score: sortedScores[2] || 0 },
    ];

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

    return (
      <div className="max-w-6xl mx-auto p-6 py-12 space-y-8 bg-white">
        <header className="text-center space-y-2">
          <h1 className="text-5xl font-black italic tracking-tighter text-slate-900 uppercase">Tournament Setup</h1>
        </header>
        <section className="bg-slate-50 p-6 rounded-[32px] border border-slate-100">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">0. Game Mode</h3>
          <select
            value={state.mode}
            onChange={(e) => actions.setMode(e.target.value as gameMode)}
            className="w-full p-3 bg-white rounded-xl border border-slate-200 font-black text-sm text-slate-700"
          >
            {Object.values(gameMode).map((candidateMode) => (
              <option key={candidateMode} value={candidateMode}>
                {candidateMode}
              </option>
            ))}
          </select>
          {state.mode === gameMode.DUPR && (
            <div className="mt-3 space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">
                DUPR mode is fully playable.
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
          {state.mode !== gameMode.RALLYTOTHETOP && state.mode !== gameMode.DUPR && (
            <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-amber-600">
              This mode is selectable but not wired in gameplay yet.
            </p>
          )}
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
            Drag active courts to reorder priority. Use slot drag handles to swap players.
          </p>

          <DndContext
            onDragEnd={(event: DragEndEvent) => {
              const sourceId = String(event.active.id);
              const targetId = event.over ? String(event.over.id) : '';
              if (!targetId) return;
              const sourceIndex = parseSetupSlotId(sourceId);
              const targetIndex = parseSetupSlotId(targetId);
              if (sourceIndex === null || targetIndex === null) return;
              swapSetupPlayersAtIndexes(sourceIndex, targetIndex);
            }}
          >
          <div className="space-y-3">
            {config.courtOrder
              .filter((c) => config.selectedCourts.includes(c))
              .map((c, i) => {
                const draft = config.courtTeamDrafts[c];
                const courtBaseIndex = i * 4;
                return (
                  <div
                    key={c}
                    draggable
                    onDragStart={() => setDraggingCourtId(c)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (draggingCourtId) actions.reorderCourtById(draggingCourtId, c);
                      setDraggingCourtId(null);
                    }}
                    className="p-4 bg-white rounded-xl border border-slate-200 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-sm uppercase">Court {c} {i === 0 ? '👑' : ''}</span>
                      <span className="text-[10px] font-black uppercase text-slate-400">Drag</span>
                    </div>

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
                                <SetupDraggablePlayerSlot
                                  key={`${c}-slot-${offset}`}
                                  id={setupSlotId(playerIndex)}
                                  slotNumber={playerOffset + 1}
                                  playerName={player?.name ?? ''}
                                  playerRating={player?.rating ?? ''}
                                  onNameChange={(value) => updatePlayerNameAtIndex(playerIndex, value)}
                                  onRatingChange={(value) => updatePlayerRatingAtIndex(playerIndex, value)}
                                />
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>

                    
                  </div>
                );
              })}
          </div>
          </DndContext>
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
        <DndContext
          onDragEnd={(event: DragEndEvent) => {
            const activeId = String(event.active.id);
            const overId = event.over ? String(event.over.id) : '';
            if (!overId) return;

            const unassigned = parseUnassignedMatchId(activeId);
            const droppedCourt = parseCourtDropId(overId);
            if (unassigned && droppedCourt) {
              actions.assignDuprMatchToCourt(unassigned.matchId, droppedCourt, unassigned.roundIndex);
              return;
            }

            if (!session.isEditMode) return;
            const source = parseSlotId(activeId);
            const target = parseSlotId(overId);
            if (!source || !target) return;
            actions.swapPlayersByPosition(source, target);
          }}
        >
          <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
            {(state.isDuprMode ? config.selectedCourts : session.activeCourtOrder).map((cId) => {
              const m = session.currentMatches[cId];
              if (!m && state.isDuprMode) {
                return (
                  <CourtDropContainer key={cId} id={courtDropId(cId)} enabled={true}>
                    <div className="bg-white h-fit rounded-[32px] border-2 border-dashed border-emerald-300 transition overflow-hidden">
                      <div className="py-2 px-4 text-[15px] text-center font-black uppercase tracking-widest bg-emerald-600 text-white">
                        Court {cId}
                      </div>
                      <div className="p-6 text-center">
                        <p className="text-sm font-black uppercase tracking-widest text-emerald-600">Waiting For Next Match</p>
                      </div>
                    </div>
                  </CourtDropContainer>
                );
              }
              if (!m) return null;
              return (
                <CourtDropContainer key={cId} id={courtDropId(cId)} enabled={state.isDuprMode && !session.currentMatches[cId]}>
                <div className={`bg-white h-fit rounded-[32px] border-2 transition overflow-hidden ${state.isDuprMode ? 'border-emerald-200' : cId === session.kingCourt ? 'border-amber-400 ring-4 ring-amber-50' : 'border-slate-100'}`}>
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
                              <DraggablePlayerSlot
                                key={idx}
                                id={slotId({ courtId: cId, team: teamKey as 'A' | 'B', index: idx })}
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
                </CourtDropContainer>
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
                    return (
                      <div key={`${entry.roundIndex}-${entry.matchId}`} className="space-y-2">
                        <DraggableUnassignedMatch
                          id={unassignedMatchId(entry.roundIndex, entry.matchId)}
                          label={`${match.teamA.join(' / ')} vs ${match.teamB.join(' / ')}`}
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
        </DndContext>
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

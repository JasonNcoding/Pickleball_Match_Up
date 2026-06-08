'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  Player, Match, Round, GameMode, ModeConfig,
  PreAssignment, RatingOrder, ScheduledMatch,
} from '@/app/lib/definitions';
import { saveTournamentState, getTournamentState, clearTournament } from '@/app/lib/actions';
import { firePodiumConfetti } from '@/app/ui/confetti';
import { generateRallyPairings } from '@/app/lib/engines/rally/pairing';
import { calculateRallyLeaderboard } from '@/app/lib/engines/rally/leaderboard';
import { hasPlayedTogetherRecently } from '@/app/lib/engines/rally/partner-score';
import {
  generateRoundRobinPairings,
  isTournamentComplete,
  calculateRoundRobinStandings,
  generateFullSchedule,
} from '@/app/lib/engines/round-robin';
import {
  generateBracket,
  advanceWinners,
  isKnockoutComplete,
  getKnockoutLeaderboard,
} from '@/app/lib/engines/single-elimination';
import { generateSwissPairings, generateSwissPairingsList, calculateSwissStandings } from '@/app/lib/engines/swiss';
import type { KnockoutState } from '@/app/lib/engines/single-elimination';
import type { KOLeaderboardEntry } from '@/app/lib/engines/single-elimination/standings';
import { autoFillByRating, shuffleTeams as shuffleTeamsFn, shufflePlayers as shufflePlayersFn } from '@/app/lib/engines/setup/auto-fill';

export interface TournamentStore {
  // State
  isHydrated: boolean;
  setupComplete: boolean;
  tournamentFinished: boolean;
  isEditMode: boolean;
  showHistoryModal: boolean;
  swapSelection: SwapSelection | null;
  availableCourts: string[];
  selectedCourts: string[];
  courtOrder: string[];
  players: Player[];
  waitingPlayers: string[];
  currentMatches: Record<string, Match>;
  history: Round[];
  bulkInput: string;
  benchMessage: string | null;
  bottomBonusMessage: string | null;
  modeConfig: ModeConfig;
  knockoutState: KnockoutState;
  activeCourts: string[]; // knockout: subset of courts in use this round
  champions: Player[];    // knockout: winners when tournament finishes
  matchQueue: ScheduledMatch[];       // async RR: pre-generated matches not yet assigned
  queueSelectCourtId: string | null;  // async RR: court waiting for manual match selection

  // Derived
  kingCourt: string;
  bottomCourt: string;
  secondBottomCourt: string | null;
  isRoundOne: boolean;

  // Setup assignment state
  preAssignment: PreAssignment | null;
  setupSwapSelection: SwapSelection | null;
  ratingOrder: RatingOrder;

  // Actions
  setSelectedCourts: (fn: (prev: string[]) => string[]) => void;
  setCourtOrder: (fn: (prev: string[]) => string[]) => void;
  moveCourt: (index: number, direction: 'up' | 'down') => void;
  setPlayers: (p: Player[]) => void;
  setBulkInput: (v: string) => void;
  setModeConfig: (c: ModeConfig) => void;
  setIsEditMode: (v: boolean) => void;
  setSwapSelection: (s: SwapSelection | null) => void;
  setSetupSwapSelection: (s: SwapSelection | null) => void;
  setCurrentMatches: (m: Record<string, Match>) => void;
  setShowHistoryModal: (v: boolean) => void;
  autoFill: () => void;
  shuffleTeams: () => void;
  shufflePlayers: () => void;
  toggleRatingOrder: () => void;
  handleSetupSwap: (target: SwapSelection) => void;
  setTournamentFinished: (v: boolean) => void;
  startTournament: () => void;
  nextRound: () => void;
  /** Async RR: confirm a single court's result and load the next queued match. */
  confirmCourtResult: (courtId: string) => void;
  /** Async RR: manually assign a queued match to a court that just finished. */
  selectQueueMatch: (courtId: string, matchId: string) => void;
  setQueueSelectCourtId: (id: string | null) => void;
  /** Swiss / Swiss-KO: 0-indexed current swiss round number. */
  swissCurrentRound: number;
  /** Swiss / Swiss-KO: commit the current round to history and generate the next round's pairings. */
  nextSwissRound: () => void;
  /** Swiss-KO: which phase is active — 'swiss' or 'knockout'. */
  swissKoPhase: 'swiss' | 'knockout';
  /** Swiss-KO KO phase: court selected for match-swap (courtId or null). */
  koCourtSwapSelection: string | null;
  /** Swiss-KO KO phase: click a court to select/swap matches between courts. */
  selectKoCourtForSwap: (courtId: string) => void;
  /** Swiss async: confirmed matches accumulated within the current Swiss round (not yet committed to history). */
  swissRoundBuffer: Match[];
  /** Swiss-KO: true when Swiss phase is complete and waiting for user to confirm KO start. */
  swissKoTransitionPending: boolean;
  /** Swiss-KO: confirm start of KO phase from the transition confirmation screen. */
  startKnockout: () => void;
  /** Group stage: player IDs per group (snake-draft by rating). */
  groupAssignments: string[][];
  /** Group stage: 0-indexed index of the group currently being played. */
  currentGroupIndex: number;
  /** Group stage: advancing player IDs collected from each completed group. */
  groupAdvancingPlayers: string[][];
  /** Group stage: true when all groups are done and waiting for KO to start. */
  groupStageComplete: boolean;
  /** Group stage: save current group standings and advance to the next group (or set groupStageComplete). */
  endGroup: () => void;
  /** Group stage: start the shared KO bracket using all advancing players. */
  startGroupKO: () => void;
  undoRound: () => void;
  finishTournament: () => void;
  resetTournament: () => Promise<void>;
  handleSwap: (target: SwapSelection) => void;
  getLeaderboard: () => import('@/app/lib/definitions').LeaderboardEntry[];
  getKOLeaderboard: () => KOLeaderboardEntry[];
  hasPlayedTogether: (p1: string, p2: string) => boolean;
  capitalize: (s: string) => string;
  isTournamentDone: () => boolean;
  totalScheduledMatches: number;
  completedMatchCount: number;
}

export interface SwapSelection {
  courtId?: string;
  team?: 'A' | 'B';
  index?: number;
  isWaitlist?: boolean;
  pId?: string;
}

const DEFAULT_MODE_CONFIG: ModeConfig = { mode: 'rally' };
const DEFAULT_KNOCKOUT: KnockoutState = { eliminatedPlayerIds: [], knockoutRound: 0 };

export function useTournament(): TournamentStore {
  const [isHydrated, setIsHydrated] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);
  const [tournamentFinished, setTournamentFinished] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [swapSelection, setSwapSelection] = useState<SwapSelection | null>(null);

  const availableCourts = ['1', '2', '3', '4', '5', '6', '7'];
  const [selectedCourts, setSelectedCourts] = useState<string[]>(['4', '5', '6', '7']);
  const [courtOrder, setCourtOrder] = useState<string[]>(['1', '2', '3']);

  const [players, setPlayers] = useState<Player[]>([]);
  const [waitingPlayers, setWaitingPlayers] = useState<string[]>([]);
  const [currentMatches, setCurrentMatches] = useState<Record<string, Match>>({});
  const [history, setHistory] = useState<Round[]>([]);
  const [bulkInput, setBulkInput] = useState('');
  const [benchMessage, setBenchMessage] = useState<string | null>(null);
  const [bottomBonusMessage, setBottomBonusMessage] = useState<string | null>(null);
  const [modeConfig, setModeConfig] = useState<ModeConfig>(DEFAULT_MODE_CONFIG);
  const [knockoutState, setKnockoutState] = useState<KnockoutState>(DEFAULT_KNOCKOUT);
  const [activeCourts, setActiveCourts] = useState<string[]>([]);
  const [champions, setChampions] = useState<Player[]>([]);

  // Async RR state
  const [matchQueue, setMatchQueue] = useState<ScheduledMatch[]>([]);
  const [queueSelectCourtId, setQueueSelectCourtId] = useState<string | null>(null);
  // Total matches generated at start (for progress display).
  const [totalScheduledMatches, setTotalScheduledMatches] = useState(0);

  // Swiss state
  const [swissCurrentRound, setSwissCurrentRound] = useState(0);

  // Swiss-KO state
  const [swissKoPhase, setSwissKoPhase] = useState<'swiss' | 'knockout'>('swiss');
  const [koCourtSwapSelection, setKoCourtSwapSelection] = useState<string | null>(null);
  const [swissRoundBuffer, setSwissRoundBuffer] = useState<Match[]>([]);
  const [swissKoTransitionPending, setSwissKoTransitionPending] = useState(false);

  // Group stage state
  const [groupAssignments, setGroupAssignments] = useState<string[][]>([]);
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  const [groupAdvancingPlayers, setGroupAdvancingPlayers] = useState<string[][]>([]);
  const [groupStageComplete, setGroupStageComplete] = useState(false);

  // Setup assignment state (not persisted)
  const [preAssignment, setPreAssignment] = useState<PreAssignment | null>(null);
  const [setupSwapSelection, setSetupSwapSelection] = useState<SwapSelection | null>(null);
  const [ratingOrder, setRatingOrder] = useState<RatingOrder>('highToTop');

  const newRoundPairingsRef = useRef(false);

  // Derived
  const kingCourt = courtOrder[0];
  const bottomCourt = courtOrder[courtOrder.length - 1];
  const secondBottomCourt = courtOrder.length >= 2 ? courtOrder[courtOrder.length - 2] : null;
  const isRoundOne = history.length === 0;

  const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();

  // ── Sync / Hydrate ─────────────────────────────────────────────────────────

  const syncData = useCallback(async (overrideState?: Record<string, unknown>) => {
    const stateToSave = overrideState || {
      setupComplete, tournamentFinished, selectedCourts, courtOrder,
      players, waitingPlayers, currentMatches, history, bulkInput,
      modeConfig, knockoutState, activeCourts, champions,
      matchQueue, totalScheduledMatches, swissCurrentRound, swissKoPhase,
      swissRoundBuffer, swissKoTransitionPending,
      groupAssignments, currentGroupIndex, groupAdvancingPlayers, groupStageComplete,
    };
    if (isHydrated && (stateToSave.setupComplete || overrideState)) {
      const result = await saveTournamentState(stateToSave);
      if (!result.success) console.error('Cloud sync failed');
      return result;
    }
  }, [isHydrated, setupComplete, tournamentFinished, selectedCourts, courtOrder,
      players, waitingPlayers, currentMatches, history, bulkInput,
      modeConfig, knockoutState, activeCourts, champions, matchQueue, totalScheduledMatches,
      swissCurrentRound, swissKoPhase, swissRoundBuffer, swissKoTransitionPending,
      groupAssignments, currentGroupIndex, groupAdvancingPlayers, groupStageComplete]);

  useEffect(() => {
    const loadInitialData = async () => {
      const data = await getTournamentState();
      if (data) {
        try {
          setSetupComplete(data.setupComplete);
          setTournamentFinished(data.tournamentFinished);
          setSelectedCourts(data.selectedCourts);
          setCourtOrder(data.courtOrder || data.selectedCourts);
          setPlayers((data.players as Player[]).map(p => ({
            ...p,
            benchCount: p.benchCount ?? 0,
            lastBenchedRound: p.lastBenchedRound ?? null,
          })));
          setWaitingPlayers(data.waitingPlayers);
          setCurrentMatches(data.currentMatches);
          setHistory(data.history);
          setBulkInput(data.bulkInput);
          if (data.modeConfig) setModeConfig(data.modeConfig as ModeConfig);
          if (data.knockoutState) setKnockoutState(data.knockoutState as KnockoutState);
          if (data.activeCourts) setActiveCourts(data.activeCourts as string[]);
          if (data.champions) setChampions(data.champions as Player[]);
          if (data.matchQueue) setMatchQueue(data.matchQueue as ScheduledMatch[]);
          if (data.totalScheduledMatches) setTotalScheduledMatches(data.totalScheduledMatches as number);
          if (data.swissCurrentRound !== undefined) setSwissCurrentRound(data.swissCurrentRound as number);
          if (data.swissKoPhase) setSwissKoPhase(data.swissKoPhase as 'swiss' | 'knockout');
          if (data.swissRoundBuffer) setSwissRoundBuffer(data.swissRoundBuffer as Match[]);
          if (data.swissKoTransitionPending) setSwissKoTransitionPending(data.swissKoTransitionPending as boolean);
          if (data.groupAssignments) setGroupAssignments(data.groupAssignments as string[][]);
          if (data.currentGroupIndex !== undefined) setCurrentGroupIndex(data.currentGroupIndex as number);
          if (data.groupAdvancingPlayers) setGroupAdvancingPlayers(data.groupAdvancingPlayers as string[][]);
          if (data.groupStageComplete) setGroupStageComplete(data.groupStageComplete as boolean);
        } catch (e) {
          console.error('Error parsing database state:', e);
        }
      }
      setIsHydrated(true);
    };
    loadInitialData();
  }, []);

  useEffect(() => {
    const id = setTimeout(() => syncData(), 500);
    return () => clearTimeout(id);
  }, [syncData]);

  useEffect(() => {
    setCourtOrder(prev => {
      const newBase = selectedCourts.filter(c => prev.includes(c));
      const added = selectedCourts.filter(c => !prev.includes(c));
      return [...newBase, ...added];
    });
  }, [selectedCourts]);

  // ── Auto-fill pre-assignment when roster composition or courts change ──────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const playerIdsSignature = players.map(p => p.id).join(',');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const courtsSignature = [...selectedCourts].sort().join(',');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const modeSignature = `${modeConfig.mode}:${modeConfig.teamSize ?? 2}`;

  useEffect(() => {
    if (setupComplete) return;
    const teamSize = modeConfig.teamSize ?? 2;
    const ppc = teamSize * 2;

    if (modeConfig.mode === 'knockout') {
      const bracketCourts = Math.floor(players.length / ppc);
      const teams = players.length / ppc;
      const isPow2 = teams > 0 && Number.isInteger(teams) && (teams & (teams - 1)) === 0;
      if (!isPow2 || bracketCourts === 0 || bracketCourts > selectedCourts.length) {
        setPreAssignment(null);
      } else {
        const orderedCourts = courtOrder.filter(c => selectedCourts.includes(c)).slice(0, bracketCourts);
        setPreAssignment(autoFillByRating(players, orderedCourts, ratingOrder, teamSize));
      }
    } else {
      const needed = selectedCourts.length * ppc;
      if (players.length >= needed && selectedCourts.length > 0) {
        setPreAssignment(autoFillByRating(players, selectedCourts, ratingOrder, teamSize));
      } else {
        setPreAssignment(null);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerIdsSignature, courtsSignature, setupComplete, modeSignature]);

  // ── Bottom bonus banner (rally only) ──────────────────────────────────────

  useEffect(() => {
    if (!newRoundPairingsRef.current) return;
    newRoundPairingsRef.current = false;
    if (modeConfig.mode !== 'rally') return;
    if (bottomCourt === kingCourt) return;
    const km = currentMatches[kingCourt];
    if (!km) return;

    const onBottom = new Set<string>();
    const alreadyBonused = new Set<string>();
    history.forEach((round, index) => {
      const bm = round.matches[bottomCourt];
      if (bm) [...bm.teamA, ...bm.teamB].forEach(id => onBottom.add(id));
      if (index >= 1) {
        const hkm = round.matches[kingCourt];
        if (hkm) [...hkm.teamA, ...hkm.teamB].forEach(pId => {
          if (onBottom.has(pId)) alreadyBonused.add(pId);
        });
      }
    });

    const earners = [...km.teamA, ...km.teamB]
      .filter(pId => onBottom.has(pId) && !alreadyBonused.has(pId))
      .map(pId => capitalize(players.find(p => p.id === pId)?.name || pId));

    if (earners.length > 0) {
      setBottomBonusMessage(`🏅 Bottom court bonus: ${earners.join(' & ')} +1 pt!`);
      setTimeout(() => setBottomBonusMessage(null), 3000);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMatches]);

  // ── Swiss auto-advance: when all courts done + queue empty, commit round ────
  useEffect(() => {
    const isSwissPhase = setupComplete && !tournamentFinished && !swissKoTransitionPending &&
      (modeConfig.mode === 'swiss' || (modeConfig.mode === 'swiss-ko' && swissKoPhase === 'swiss'));
    if (!isSwissPhase) return;
    const queueEmpty = matchQueue.length === 0;
    const allDone = selectedCourts.every(cId => {
      const m = currentMatches[cId];
      return !m || m.teamA.length === 0 || m.winner !== null;
    });
    if (queueEmpty && allDone && swissRoundBuffer.length > 0) {
      nextSwissRound();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMatches, matchQueue, swissRoundBuffer]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const hasPlayedTogether = (p1: string, p2: string) =>
    hasPlayedTogetherRecently(p1, p2, history);

  function moveCourt(index: number, direction: 'up' | 'down') {
    setCourtOrder(prev => {
      const next = [...prev];
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  // ── Leaderboard ────────────────────────────────────────────────────────────

  function getLeaderboard() {
    if (modeConfig.mode === 'rally') {
      return calculateRallyLeaderboard({ players, history, currentMatches, kingCourt, bottomCourt });
    }
    if (modeConfig.mode === 'swiss' || (modeConfig.mode === 'swiss-ko' && swissKoPhase === 'swiss')) {
      return calculateSwissStandings(players, history, modeConfig.recordMode === 'score');
    }
    return calculateRoundRobinStandings(players, history, modeConfig.recordMode === 'score');
  }

  function getKOLeaderboard(): KOLeaderboardEntry[] {
    return getKnockoutLeaderboard(
      players,
      history,
      knockoutState.eliminatedPlayerIds,
      modeConfig.fixedPartners,
    );
  }

  // ── Tournament complete check ──────────────────────────────────────────────

  function isTournamentDone(): boolean {
    if (modeConfig.mode === 'round-robin') {
      // Async RR: done when queue is empty and all courts have results.
      return matchQueue.length === 0 &&
        Object.values(currentMatches).every(m => m.teamA.length === 0 || m.winner !== null);
    }
    if (modeConfig.mode === 'knockout') {
      const courts = activeCourts.length > 0 ? activeCourts : courtOrder;
      return isKnockoutComplete(currentMatches, courts, players, knockoutState, modeConfig.teamSize ?? 2);
    }
    if (modeConfig.mode === 'swiss') {
      return tournamentFinished;
    }
    if (modeConfig.mode === 'swiss-ko') {
      if (swissKoPhase === 'swiss') return false; // Swiss phase: Next Swiss Round button handles this
      const courts = activeCourts.length > 0 ? activeCourts : selectedCourts;
      return isKnockoutComplete(currentMatches, courts, players, knockoutState, modeConfig.teamSize ?? 2);
    }
    return false;
  }

  // ── Setup Assignment Actions ───────────────────────────────────────────────

  function autoFill() {
    const teamSize = modeConfig.teamSize ?? 2;
    const ppc = teamSize * 2;
    const courts = modeConfig.mode === 'knockout'
      ? courtOrder.filter(c => selectedCourts.includes(c)).slice(0, Math.floor(players.length / ppc))
      : selectedCourts;
    setPreAssignment(autoFillByRating(players, courts, ratingOrder, teamSize));
  }

  function shuffleTeams() {
    if (!preAssignment) return;
    setPreAssignment(shuffleTeamsFn(preAssignment));
  }

  function shufflePlayers() {
    const teamSize = modeConfig.teamSize ?? 2;
    const ppc = teamSize * 2;
    const courts = modeConfig.mode === 'knockout'
      ? courtOrder.filter(c => selectedCourts.includes(c)).slice(0, Math.floor(players.length / ppc))
      : selectedCourts;
    setPreAssignment(shufflePlayersFn(players, courts, teamSize));
  }

  function toggleRatingOrder() {
    const teamSize = modeConfig.teamSize ?? 2;
    const newOrder: RatingOrder = ratingOrder === 'highToTop' ? 'lowToTop' : 'highToTop';
    setRatingOrder(newOrder);
    setPreAssignment(autoFillByRating(players, selectedCourts, newOrder, teamSize));
  }

  function handleSetupSwap(target: SwapSelection) {
    if (!setupSwapSelection || !preAssignment) return;
    const newCourts = JSON.parse(JSON.stringify(preAssignment.courts)) as Record<string, Match>;
    const newBench = [...preAssignment.bench];

    const p1 = setupSwapSelection.isWaitlist
      ? setupSwapSelection.pId!
      : newCourts[setupSwapSelection.courtId!][setupSwapSelection.team === 'A' ? 'teamA' : 'teamB'][setupSwapSelection.index!];

    const p2 = target.isWaitlist
      ? target.pId!
      : newCourts[target.courtId!][target.team === 'A' ? 'teamA' : 'teamB'][target.index!];

    if (setupSwapSelection.isWaitlist) newBench[newBench.indexOf(p1)] = p2;
    else newCourts[setupSwapSelection.courtId!][setupSwapSelection.team === 'A' ? 'teamA' : 'teamB'][setupSwapSelection.index!] = p2;

    if (target.isWaitlist) newBench[newBench.indexOf(p2)] = p1;
    else newCourts[target.courtId!][target.team === 'A' ? 'teamA' : 'teamB'][target.index!] = p1;

    setPreAssignment({ courts: newCourts, bench: newBench });
    setSetupSwapSelection(null);
  }

  // ── Start Tournament ───────────────────────────────────────────────────────

  function buildFixedPartners(p: PreAssignment): Record<string, string> {
    const fp: Record<string, string> = {};
    Object.values(p.courts).forEach(m => {
      if (m.teamA.length > 1) { fp[m.teamA[0]] = m.teamA[1]; fp[m.teamA[1]] = m.teamA[0]; }
      if (m.teamB.length > 1) { fp[m.teamB[0]] = m.teamB[1]; fp[m.teamB[1]] = m.teamB[0]; }
    });
    return fp;
  }

  function startTournament() {
    const teamSize = modeConfig.teamSize ?? 2;
    const groupCount = modeConfig.groupCount ?? 1;
    const isGroupMode = groupCount >= 2;

    let activePlayers = players;
    let groupPre = preAssignment;

    if (isGroupMode) {
      // Snake-draft by rating into groups
      const sorted = [...players].sort((a, b) => b.rating - a.rating);
      const assignments: string[][] = Array.from({ length: groupCount }, () => []);
      sorted.forEach((p, i) => {
        const row = Math.floor(i / groupCount);
        const col = i % groupCount;
        const groupIdx = row % 2 === 0 ? col : groupCount - 1 - col;
        assignments[groupIdx].push(p.id);
      });
      setGroupAssignments(assignments);
      setCurrentGroupIndex(0);
      setGroupAdvancingPlayers([]);
      setGroupStageComplete(false);
      activePlayers = players.filter(p => assignments[0].includes(p.id));
      groupPre = autoFillByRating(activePlayers, selectedCourts, ratingOrder, teamSize);
    }

    const pre = isGroupMode ? groupPre : preAssignment;

    if (modeConfig.mode === 'knockout') {
      if (pre) {
        setCurrentMatches(pre.courts);
        setActiveCourts(Object.keys(pre.courts));
        setKnockoutState(DEFAULT_KNOCKOUT);
        if (teamSize === 2) {
          setModeConfig({ ...modeConfig, fixedPartners: buildFixedPartners(pre) });
        }
      } else {
        const { newMatches, activeCourts: ac } = generateBracket(activePlayers, courtOrder, undefined, teamSize);
        setCurrentMatches(newMatches);
        setActiveCourts(ac);
        setKnockoutState(DEFAULT_KNOCKOUT);
      }
    } else if (modeConfig.mode === 'round-robin') {
      // ── Async RR: pre-generate full schedule ──────────────────────────────
      const legs = modeConfig.legs ?? 1;
      let fixedPartners: Record<string, string> | undefined;
      let teams: string[][];

      if (pre && teamSize === 2) {
        fixedPartners = buildFixedPartners(pre);
        // Build canonical team list from fixed partners.
        const seen = new Set<string>();
        teams = [];
        for (const [a, b] of Object.entries(fixedPartners)) {
          const key = [a, b].sort().join('|');
          if (!seen.has(key)) { seen.add(key); teams.push([a, b]); }
        }
      } else {
        // Singles: each player is their own team.
        teams = activePlayers.map(p => [p.id]);
      }

      let allMatches = generateFullSchedule(teams, legs);
      // Apply per-team match cap if set
      const maxMatchesPerTeam = modeConfig.maxMatchesPerTeam;
      if (maxMatchesPerTeam) {
        const counts = new Map<string, number>();
        const getKey = (team: string[]) => team.slice().sort().join('|');
        allMatches = allMatches.filter(m => {
          const kA = getKey(m.teamA), kB = getKey(m.teamB);
          if ((counts.get(kA) ?? 0) >= maxMatchesPerTeam) return false;
          if ((counts.get(kB) ?? 0) >= maxMatchesPerTeam) return false;
          counts.set(kA, (counts.get(kA) ?? 0) + 1);
          counts.set(kB, (counts.get(kB) ?? 0) + 1);
          return true;
        });
      }
      const courts = selectedCourts;
      const initialMatches: Record<string, Match> = {};

      // Assign first N matches to courts.
      courts.forEach((cId, i) => {
        const sm = allMatches[i];
        if (sm) initialMatches[cId] = { teamA: sm.teamA, teamB: sm.teamB, winner: null };
        else initialMatches[cId] = { teamA: [], teamB: [], winner: null }; // idle placeholder
      });

      const remaining = allMatches.slice(courts.length);
      const updatedConfig = fixedPartners
        ? { ...modeConfig, fixedPartners }
        : modeConfig;

      setCurrentMatches(initialMatches);
      setMatchQueue(remaining);
      setTotalScheduledMatches(allMatches.length);
      setWaitingPlayers([]);
      setModeConfig(updatedConfig);
    } else if (modeConfig.mode === 'swiss') {
      // ── Swiss: derive teams and generate Round 1 pairings ────────────────
      let swissTeams: string[][];
      let swissFixedPartners: Record<string, string> | undefined;

      if (pre && teamSize === 2) {
        swissFixedPartners = buildFixedPartners(pre);
        const seen = new Set<string>();
        swissTeams = [];
        for (const [a, b] of Object.entries(swissFixedPartners)) {
          const key = [a, b].sort().join('|');
          if (!seen.has(key)) { seen.add(key); swissTeams.push([a, b]); }
        }
      } else {
        swissTeams = activePlayers.map(p => [p.id]);
      }

      const pairings0 = generateSwissPairingsList({ teams: swissTeams, history: [], swissRound: 0, players: activePlayers });
      const courts0 = selectedCourts;
      const initMatches: Record<string, Match> = {};
      courts0.forEach((cId, i) => {
        const p = pairings0[i];
        initMatches[cId] = p ? { teamA: p.teamA, teamB: p.teamB, winner: null } : { teamA: [], teamB: [], winner: null };
      });
      const initQueue = pairings0.slice(courts0.length).map((p, i) => ({ id: `m-s0-${i}`, teamA: p.teamA, teamB: p.teamB }));
      setCurrentMatches(initMatches);
      setMatchQueue(initQueue);
      setSwissRoundBuffer([]);
      setSwissCurrentRound(0);
      setWaitingPlayers([]);
      if (swissFixedPartners) setModeConfig({ ...modeConfig, fixedPartners: swissFixedPartners });
    } else if (modeConfig.mode === 'swiss-ko') {
      // ── Swiss-KO: start with Swiss Round 1 (same as Swiss mode) ─────────
      let swissTeams: string[][];
      let swissFixedPartners: Record<string, string> | undefined;

      if (pre && teamSize === 2) {
        swissFixedPartners = buildFixedPartners(pre);
        const seen = new Set<string>();
        swissTeams = [];
        for (const [a, b] of Object.entries(swissFixedPartners)) {
          const key = [a, b].sort().join('|');
          if (!seen.has(key)) { seen.add(key); swissTeams.push([a, b]); }
        }
      } else {
        swissTeams = activePlayers.map(p => [p.id]);
      }

      const sko0 = generateSwissPairingsList({ teams: swissTeams, history: [], swissRound: 0, players: activePlayers });
      const skoCourts0 = selectedCourts;
      const skoInit: Record<string, Match> = {};
      skoCourts0.forEach((cId, i) => {
        const p = sko0[i];
        skoInit[cId] = p ? { teamA: p.teamA, teamB: p.teamB, winner: null } : { teamA: [], teamB: [], winner: null };
      });
      const skoQueue = sko0.slice(skoCourts0.length).map((p, i) => ({ id: `m-sko0-${i}`, teamA: p.teamA, teamB: p.teamB }));
      setCurrentMatches(skoInit);
      setMatchQueue(skoQueue);
      setSwissRoundBuffer([]);
      setSwissCurrentRound(0);
      setSwissKoPhase('swiss');
      setSwissKoTransitionPending(false);
      setWaitingPlayers([]);
      if (swissFixedPartners) setModeConfig({ ...modeConfig, fixedPartners: swissFixedPartners });
    } else {
      // Rally mode
      if (pre) {
        setCurrentMatches(pre.courts);
        setWaitingPlayers(pre.bench);
      } else {
        const result = generateRallyPairings({
          isFirst: true, roster: activePlayers, courts: selectedCourts,
          history: [], currentMatches: {}, waitingPlayers: [], teamSize,
        });
        setCurrentMatches(result.newMatches);
        setWaitingPlayers(result.newWaiting);
      }
    }
    setSetupComplete(true);
  }

  // ── Swiss: advance to the next round ──────────────────────────────────────

  function nextSwissRound() {
    const teamSize = modeConfig.teamSize ?? 2;

    // Derive teams from fixedPartners (doubles) or players (singles)
    let swissTeams: string[][];
    if (modeConfig.fixedPartners && teamSize === 2) {
      const seen = new Set<string>();
      swissTeams = [];
      for (const [a, b] of Object.entries(modeConfig.fixedPartners)) {
        const key = [a, b].sort().join('|');
        if (!seen.has(key)) { seen.add(key); swissTeams.push([a, b]); }
      }
    } else {
      swissTeams = players.map(p => [p.id]);
    }

    const nextRoundNum = swissCurrentRound + 1;
    const totalRounds = modeConfig.swissRounds ?? 4;
    const isSwissKo = modeConfig.mode === 'swiss-ko';

    // Build this round's match record from buffer (mid-round confirms) + last active matches
    const roundMatches: Record<string, Match> = {};
    swissRoundBuffer.forEach((m, i) => { roundMatches[`q${i}`] = m; });
    Object.entries(currentMatches).forEach(([courtId, m]) => {
      if (m.teamA.length > 0 && m.winner !== null) roundMatches[courtId] = m;
    });

    const round: Round = {
      id: history.length,
      matches: roundMatches,
      waiting: [],
      swissRound: swissCurrentRound,
      isSwissKoTransition: isSwissKo && nextRoundNum >= totalRounds,
    };
    const newHistory = [...history, round];
    setHistory(newHistory);
    setSwissRoundBuffer([]);
    setMatchQueue([]);

    if (nextRoundNum >= totalRounds) {
      if (isSwissKo) {
        setSwissKoTransitionPending(true);
      } else {
        setTournamentFinished(true);
        firePodiumConfetti();
      }
    } else {
      const nextPairings = generateSwissPairingsList({
        teams: swissTeams, history: newHistory, swissRound: nextRoundNum, players,
      });
      const courts = selectedCourts;
      const nextInit: Record<string, Match> = {};
      courts.forEach((cId, i) => {
        const p = nextPairings[i];
        nextInit[cId] = p ? { teamA: p.teamA, teamB: p.teamB, winner: null } : { teamA: [], teamB: [], winner: null };
      });
      const nextQueue = nextPairings.slice(courts.length).map((p, i) => ({
        id: `m-s${nextRoundNum}-${i}`, teamA: p.teamA, teamB: p.teamB,
      }));
      setCurrentMatches(nextInit);
      setMatchQueue(nextQueue);
      setSwissCurrentRound(nextRoundNum);
    }
  }

  // ── Swiss-KO: start the knockout phase from the confirmation screen ────────

  function startKnockout() {
    if (!swissKoTransitionPending) return;
    const teamSize = modeConfig.teamSize ?? 2;
    const advancing = modeConfig.swissKoAdvancing ?? 4;
    const swissStandings = calculateSwissStandings(players, history, modeConfig.recordMode === 'score');

    let advancingPlayers: Player[];
    if (modeConfig.fixedPartners && teamSize === 2) {
      const seen = new Set<string>();
      const advancingTeams: Player[][] = [];
      for (const entry of swissStandings) {
        if (advancingTeams.length >= advancing) break;
        const partnerId = modeConfig.fixedPartners[entry.id];
        if (!partnerId) continue;
        const key = [entry.id, partnerId].sort().join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        const p1 = players.find(p => p.id === entry.id);
        const p2 = players.find(p => p.id === partnerId);
        if (p1 && p2) advancingTeams.push([p1, p2]);
      }
      advancingPlayers = advancingTeams.flat();
    } else {
      advancingPlayers = swissStandings.slice(0, advancing)
        .map(e => players.find(p => p.id === e.id))
        .filter(Boolean) as Player[];
    }

    const nonAdvancingIds = players
      .filter(p => !advancingPlayers.some(ap => ap.id === p.id))
      .map(p => p.id);

    const { newMatches: koMatches, activeCourts: koCourts } = generateBracket(
      advancingPlayers, selectedCourts, modeConfig.fixedPartners, teamSize, true,
    );
    setCurrentMatches(koMatches);
    setActiveCourts(koCourts);
    setKnockoutState({ eliminatedPlayerIds: nonAdvancingIds, knockoutRound: 0 });
    setSwissKoPhase('knockout');
    setKoCourtSwapSelection(null);
    setSwissKoTransitionPending(false);
  }

  // ── Swiss-KO: swap matches between two courts (KO phase only) ─────────────

  function selectKoCourtForSwap(courtId: string) {
    if (!koCourtSwapSelection) {
      setKoCourtSwapSelection(courtId);
      return;
    }
    if (koCourtSwapSelection === courtId) {
      setKoCourtSwapSelection(null);
      return;
    }
    // Only swap if both courts have no winner yet
    const a = currentMatches[koCourtSwapSelection];
    const b = currentMatches[courtId];
    if (a && b && a.winner === null && b.winner === null) {
      setCurrentMatches({ ...currentMatches, [koCourtSwapSelection]: b, [courtId]: a });
    }
    setKoCourtSwapSelection(null);
  }

  // ── Async RR: confirm a court result and load the next queued match ────────

  function confirmCourtResult(courtId: string) {
    const m = currentMatches[courtId];
    if (!m || !m.winner) return;

    // ── Swiss async: add confirmed match to buffer, load next queued match ──
    if (modeConfig.mode === 'swiss' || (modeConfig.mode === 'swiss-ko' && swissKoPhase === 'swiss')) {
      setSwissRoundBuffer(prev => [...prev, { ...m }]);
      const livePlaying = new Set<string>();
      Object.entries(currentMatches).forEach(([cId, cm]) => {
        if (cId === courtId || !cm || cm.teamA.length === 0 || cm.winner !== null) return;
        cm.teamA.forEach(id => livePlaying.add(id));
        cm.teamB.forEach(id => livePlaying.add(id));
      });
      const queue = [...matchQueue];
      const idx = queue.findIndex(sm =>
        !sm.teamA.some(id => livePlaying.has(id)) &&
        !sm.teamB.some(id => livePlaying.has(id)),
      );
      const nextMatch: Match = idx >= 0
        ? (() => { const sm = queue.splice(idx, 1)[0]; return { teamA: sm.teamA, teamB: sm.teamB, winner: null }; })()
        : { teamA: [], teamB: [], winner: null };
      setCurrentMatches({ ...currentMatches, [courtId]: nextMatch });
      setMatchQueue([...queue]);
      return;
    }

    // Save this match to history as a single-match round.
    const snapshot: Round = {
      id: history.length,
      matches: { [courtId]: { ...m } },
      waiting: [],
    };

    // Build live-teams set from all courts except the one being confirmed.
    const liveTeams = new Set<string>();
    Object.entries(currentMatches).forEach(([cId, cm]) => {
      if (cId === courtId || !cm || cm.teamA.length === 0 || cm.winner !== null) return;
      cm.teamA.forEach(id => liveTeams.add(id));
      cm.teamB.forEach(id => liveTeams.add(id));
    });

    const newMatches = { ...currentMatches };
    const queue = [...matchQueue];

    function popNextMatch(): Match {
      const idx = queue.findIndex(sm =>
        !sm.teamA.some(id => liveTeams.has(id)) &&
        !sm.teamB.some(id => liveTeams.has(id)),
      );
      if (idx < 0) return { teamA: [], teamB: [], winner: null };
      const sm = queue.splice(idx, 1)[0];
      sm.teamA.forEach(id => liveTeams.add(id));
      sm.teamB.forEach(id => liveTeams.add(id));
      return { teamA: sm.teamA, teamB: sm.teamB, winner: null };
    }

    // Assign next match to the confirming court first.
    newMatches[courtId] = popNextMatch();

    // Then fill any other idle courts (teamA.length === 0).
    Object.keys(newMatches).forEach(cId => {
      if (cId === courtId) return;
      const cm = newMatches[cId];
      if (!cm || cm.teamA.length > 0) return;
      newMatches[cId] = popNextMatch();
    });

    setHistory(prev => [...prev, snapshot]);
    setCurrentMatches(newMatches);
    setMatchQueue([...queue]);
    setQueueSelectCourtId(null);

    // Check completion.
    const allDone = queue.length === 0 &&
      Object.values(newMatches).every(cm => cm.teamA.length === 0 || cm.winner !== null);
    if (allDone) {
      setTournamentFinished(true);
      firePodiumConfetti();
    }
  }

  // ── Async RR: manually assign a specific queued match to an idle court ─────

  function selectQueueMatch(courtId: string, matchId: string) {
    const idx = matchQueue.findIndex(m => m.id === matchId);
    if (idx < 0) return;
    const sm = matchQueue[idx];
    const newQueue = [...matchQueue];
    newQueue.splice(idx, 1);

    const existing = currentMatches[courtId];
    const isSwissPhase = modeConfig.mode === 'swiss' || (modeConfig.mode === 'swiss-ko' && swissKoPhase === 'swiss');

    if (isSwissPhase && existing && existing.teamA.length > 0 && !existing.winner) {
      // Swiss: push the current unfinished match to back of queue so it plays later
      newQueue.push({ id: `m-pushed-${Date.now()}`, teamA: existing.teamA, teamB: existing.teamB });
    } else if (!isSwissPhase && existing && existing.teamA.length > 0 && !existing.winner) {
      // RR: can't override a live unconfirmed match
      return;
    }

    setCurrentMatches({ ...currentMatches, [courtId]: { teamA: sm.teamA, teamB: sm.teamB, winner: null } });
    setMatchQueue(newQueue);
    setQueueSelectCourtId(null);
  }

  // ── Next Round (Rally + Knockout only) ────────────────────────────────────

  function nextRound() {
    const snapshot: Round = {
      id: history.length,
      matches: { ...currentMatches },
      waiting: [...waitingPlayers],
      players: [...players],
      eliminatedPlayerIds: [...knockoutState.eliminatedPlayerIds],
      activeCourts: [...activeCourts],
    };

    if (modeConfig.mode === 'rally') {
      setHistory(prev => [...prev, snapshot]);
      const result = generateRallyPairings({
        isFirst: false, roster: players, courts: courtOrder,
        history: [...history, snapshot], currentMatches, waitingPlayers,
        teamSize: modeConfig.teamSize ?? 2,
      });
      setCurrentMatches(result.newMatches);
      setWaitingPlayers(result.newWaiting);
      setPlayers(result.updatedPlayers);
      if (result.benchMessage) {
        setBenchMessage(result.benchMessage);
        setTimeout(() => setBenchMessage(null), 5000);
      }
      newRoundPairingsRef.current = true;
    } else if (modeConfig.mode === 'knockout' || (modeConfig.mode === 'swiss-ko' && swissKoPhase === 'knockout')) {
      const courts = activeCourts.length > 0 ? activeCourts : courtOrder;
      const result = advanceWinners(
        currentMatches, courts, players, knockoutState, courtOrder,
        modeConfig.fixedPartners,
        modeConfig.teamSize ?? 2,
      );
      setHistory(prev => [...prev, snapshot]);
      setKnockoutState(result.nextState);
      setKoCourtSwapSelection(null);
      if (result.isFinished) {
        setChampions(result.champions);
        setTournamentFinished(true);
        firePodiumConfetti();
      } else {
        setCurrentMatches(result.newMatches);
        setActiveCourts(result.activeCourts);
      }
      return;
    }

    if (isTournamentDone()) {
      setTournamentFinished(true);
      firePodiumConfetti();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ── Undo ───────────────────────────────────────────────────────────────────

  function undoRound() {
    if (history.length === 0) return;
    const prev = [...history];
    const last = prev.pop()!;

    if (modeConfig.mode === 'round-robin') {
      // Async RR undo: restore that court's match and return it to front of queue.
      const courtId = Object.keys(last.matches)[0];
      const restoredMatch = last.matches[courtId];
      if (restoredMatch) {
        // Put the currently-assigned match on that court back in the queue.
        const existing = currentMatches[courtId];
        const newQueue = [...matchQueue];
        if (existing && existing.teamA.length > 0) {
          newQueue.unshift({ id: `m-undo-${Date.now()}`, teamA: existing.teamA, teamB: existing.teamB });
        }
        setCurrentMatches({ ...currentMatches, [courtId]: { ...restoredMatch, winner: null, scoreA: undefined, scoreB: undefined } });
        setMatchQueue(newQueue);
      }
    } else if (
      modeConfig.mode === 'swiss' ||
      (modeConfig.mode === 'swiss-ko' && (swissKoPhase === 'swiss' || last.isSwissKoTransition))
    ) {
      // Regenerate the initial state for that Swiss round (deterministic from history snapshot)
      const teamSize = modeConfig.teamSize ?? 2;
      let undoTeams: string[][];
      if (modeConfig.fixedPartners && teamSize === 2) {
        const seen = new Set<string>();
        undoTeams = [];
        for (const [a, b] of Object.entries(modeConfig.fixedPartners)) {
          const key = [a, b].sort().join('|');
          if (!seen.has(key)) { seen.add(key); undoTeams.push([a, b]); }
        }
      } else {
        undoTeams = players.map(p => [p.id]);
      }
      const restoredRound = last.swissRound ?? swissCurrentRound;
      const undoPairings = generateSwissPairingsList({
        teams: undoTeams, history: prev, swissRound: restoredRound, players,
      });
      const courts = selectedCourts;
      const undoInit: Record<string, Match> = {};
      courts.forEach((cId, i) => {
        const p = undoPairings[i];
        undoInit[cId] = p ? { teamA: p.teamA, teamB: p.teamB, winner: null } : { teamA: [], teamB: [], winner: null };
      });
      const undoQueue = undoPairings.slice(courts.length).map((p, i) => ({
        id: `m-undo-${i}`, teamA: p.teamA, teamB: p.teamB,
      }));
      setCurrentMatches(undoInit);
      setMatchQueue(undoQueue);
      setSwissRoundBuffer([]);
      setSwissCurrentRound(restoredRound);
      setWaitingPlayers([]);
      if (last.isSwissKoTransition) {
        setSwissKoPhase('swiss');
        setKoCourtSwapSelection(null);
      }
      setSwissKoTransitionPending(false);
    } else {
      setCurrentMatches(last.matches);
      setWaitingPlayers(last.waiting);
      if (last.players) setPlayers(last.players);
      if (last.eliminatedPlayerIds !== undefined) {
        setKnockoutState(s => ({ ...s, eliminatedPlayerIds: last.eliminatedPlayerIds! }));
      }
      if (last.activeCourts) setActiveCourts(last.activeCourts);
    }

    setHistory(prev);
    setBenchMessage(null);
    setBottomBonusMessage(null);
  }

  // ── Group Stage: end current group, advance to next or set up KO ──────────

  function endGroup() {
    const groupCount = modeConfig.groupCount ?? 1;
    const advancing = modeConfig.advancingPerGroup ?? 1;
    const groupPlayerIds = groupAssignments[currentGroupIndex] ?? [];
    const standings = getLeaderboard().filter(e => groupPlayerIds.includes(e.id));
    const advancingIds = standings.slice(0, advancing).map(e => e.id);
    const newGroupAdvancing = [...groupAdvancingPlayers, advancingIds];
    setGroupAdvancingPlayers(newGroupAdvancing);

    const nextGroupIdx = currentGroupIndex + 1;
    if (nextGroupIdx >= groupCount) {
      setGroupStageComplete(true);
      setTournamentFinished(false);
    } else {
      const teamSize = modeConfig.teamSize ?? 2;
      const nextGroupPlayerIds = groupAssignments[nextGroupIdx];
      const nextGroupPlayers = players.filter(p => nextGroupPlayerIds.includes(p.id));
      const nextPre = autoFillByRating(nextGroupPlayers, selectedCourts, ratingOrder, teamSize);

      setCurrentGroupIndex(nextGroupIdx);
      setTournamentFinished(false);
      setSwissCurrentRound(0);
      setSwissRoundBuffer([]);
      setMatchQueue([]);
      setWaitingPlayers([]);

      if (modeConfig.mode === 'round-robin') {
        const legs = modeConfig.legs ?? 1;
        let teams: string[][];
        let fixedPartners: Record<string, string> | undefined;
        if (nextPre && teamSize === 2) {
          fixedPartners = buildFixedPartners(nextPre);
          const seen = new Set<string>();
          teams = [];
          for (const [a, b] of Object.entries(fixedPartners)) {
            const key = [a, b].sort().join('|');
            if (!seen.has(key)) { seen.add(key); teams.push([a, b]); }
          }
        } else {
          teams = nextGroupPlayers.map(p => [p.id]);
        }
        const allMatches = generateFullSchedule(teams, legs);
        const initialMatches: Record<string, Match> = {};
        selectedCourts.forEach((cId, i) => {
          const sm = allMatches[i];
          initialMatches[cId] = sm ? { teamA: sm.teamA, teamB: sm.teamB, winner: null } : { teamA: [], teamB: [], winner: null };
        });
        setCurrentMatches(initialMatches);
        setMatchQueue(allMatches.slice(selectedCourts.length));
        setTotalScheduledMatches(allMatches.length);
        if (fixedPartners) setModeConfig({ ...modeConfig, fixedPartners });
      } else if (modeConfig.mode === 'swiss') {
        let swissTeams: string[][];
        let fp: Record<string, string> | undefined;
        if (nextPre && teamSize === 2) {
          fp = buildFixedPartners(nextPre);
          const seen = new Set<string>();
          swissTeams = [];
          for (const [a, b] of Object.entries(fp)) {
            const key = [a, b].sort().join('|');
            if (!seen.has(key)) { seen.add(key); swissTeams.push([a, b]); }
          }
        } else {
          swissTeams = nextGroupPlayers.map(p => [p.id]);
        }
        const nextPairings = generateSwissPairingsList({ teams: swissTeams, history: [], swissRound: 0, players: nextGroupPlayers });
        const nextMatches: Record<string, Match> = {};
        selectedCourts.forEach((cId, i) => {
          const p = nextPairings[i];
          nextMatches[cId] = p ? { teamA: p.teamA, teamB: p.teamB, winner: null } : { teamA: [], teamB: [], winner: null };
        });
        setCurrentMatches(nextMatches);
        setMatchQueue(nextPairings.slice(selectedCourts.length).map((p, i) => ({ id: `m-g${nextGroupIdx}-${i}`, teamA: p.teamA, teamB: p.teamB })));
        if (fp) setModeConfig({ ...modeConfig, fixedPartners: fp });
      } else {
        // Rally fallback
        if (nextPre) {
          setCurrentMatches(nextPre.courts);
          setWaitingPlayers(nextPre.bench);
        }
      }
    }
  }

  function startGroupKO() {
    if (!groupStageComplete) return;
    const allAdvancingIds = groupAdvancingPlayers.flat();
    const advancingPerGroup = modeConfig.advancingPerGroup ?? 1;
    const teamSize = modeConfig.teamSize ?? 2;

    // Seed: rank0 from each group, then rank1, etc.
    const seeded: Player[] = [];
    for (let rank = 0; rank < advancingPerGroup; rank++) {
      groupAdvancingPlayers.forEach(groupIds => {
        const pid = groupIds[rank];
        const p = players.find(pl => pl.id === pid);
        if (p) seeded.push(p);
      });
    }

    const ppc = teamSize * 2;
    const bracketCourts = Math.floor(seeded.length / ppc);
    const orderedCourts = selectedCourts.slice(0, bracketCourts);
    const pre = autoFillByRating(seeded, orderedCourts, 'highToTop', teamSize);
    if (!pre) return;
    const fixedPartners = buildFixedPartners(pre);
    const { newMatches, activeCourts: newActiveCourts } = generateBracket(
      seeded, orderedCourts, fixedPartners, teamSize, true,
    );
    const nonAdvancingIds = players.filter(p => !allAdvancingIds.includes(p.id)).map(p => p.id);
    setKnockoutState({ eliminatedPlayerIds: nonAdvancingIds, knockoutRound: 0 });
    setCurrentMatches(newMatches);
    setActiveCourts(newActiveCourts);
    setModeConfig({ ...modeConfig, mode: 'knockout', fixedPartners });
    setGroupStageComplete(false);
    setMatchQueue([]);
    setWaitingPlayers([]);
  }

  // ── Finish / Reset ─────────────────────────────────────────────────────────

  function finishTournament() {
    const isGroupMode = (modeConfig.groupCount ?? 1) >= 2;
    if (isGroupMode && !groupStageComplete) {
      endGroup();
      return;
    }
    setTournamentFinished(true);
    firePodiumConfetti();
  }

  async function resetTournament() {
    await clearTournament();
    localStorage.removeItem('kotc_session');
    location.reload();
  }

  // ── Swap ───────────────────────────────────────────────────────────────────

  function handleSwap(target: SwapSelection) {
    if (!isEditMode || !swapSelection) return;
    const isBenchBottomSwap =
      (swapSelection.isWaitlist && (target.courtId === bottomCourt || target.courtId === secondBottomCourt)) ||
      ((swapSelection.courtId === bottomCourt || swapSelection.courtId === secondBottomCourt) && target.isWaitlist);
    if (!isRoundOne && !isBenchBottomSwap && (swapSelection.courtId !== target.courtId || swapSelection.isWaitlist || target.isWaitlist)) {
      alert('From Round 2, players can only be swapped within the same court.');
      setSwapSelection(null);
      return;
    }
    const newMatchesState = JSON.parse(JSON.stringify(currentMatches)) as Record<string, Match>;
    const newWaiting = [...waitingPlayers];
    const p1 = swapSelection.isWaitlist
      ? swapSelection.pId!
      : newMatchesState[swapSelection.courtId!][swapSelection.team === 'A' ? 'teamA' : 'teamB'][swapSelection.index!];
    const p2 = target.isWaitlist
      ? target.pId!
      : newMatchesState[target.courtId!][target.team === 'A' ? 'teamA' : 'teamB'][target.index!];
    if (swapSelection.isWaitlist) newWaiting[newWaiting.indexOf(p1)] = p2;
    else newMatchesState[swapSelection.courtId!][swapSelection.team === 'A' ? 'teamA' : 'teamB'][swapSelection.index!] = p2;
    if (target.isWaitlist) newWaiting[newWaiting.indexOf(p2)] = p1;
    else newMatchesState[target.courtId!][target.team === 'A' ? 'teamA' : 'teamB'][target.index!] = p1;
    setCurrentMatches(newMatchesState);
    setWaitingPlayers(newWaiting);
    setSwapSelection(null);
  }

  // Completed match count = all confirmed matches in history (for async RR).
  const completedMatchCount = modeConfig.mode === 'round-robin'
    ? history.length
    : 0;

  return {
    isHydrated, setupComplete, tournamentFinished, isEditMode, showHistoryModal,
    swapSelection, availableCourts, selectedCourts, courtOrder, players,
    waitingPlayers, currentMatches, history, bulkInput, benchMessage,
    bottomBonusMessage, modeConfig, knockoutState, activeCourts, champions,
    matchQueue, queueSelectCourtId, totalScheduledMatches, completedMatchCount,
    swissCurrentRound, swissKoPhase, koCourtSwapSelection,
    swissRoundBuffer, swissKoTransitionPending,
    groupAssignments, currentGroupIndex, groupAdvancingPlayers, groupStageComplete,
    kingCourt, bottomCourt, secondBottomCourt, isRoundOne,
    preAssignment, setupSwapSelection, ratingOrder,
    setSelectedCourts: fn => setSelectedCourts(fn),
    setCourtOrder: fn => setCourtOrder(fn),
    moveCourt,
    setPlayers,
    setBulkInput,
    setModeConfig,
    setIsEditMode,
    setSwapSelection,
    setSetupSwapSelection,
    setCurrentMatches,
    setShowHistoryModal,
    autoFill,
    shuffleTeams,
    shufflePlayers,
    toggleRatingOrder,
    handleSetupSwap,
    setTournamentFinished,
    startTournament,
    nextRound,
    nextSwissRound,
    startKnockout,
    endGroup,
    startGroupKO,
    selectKoCourtForSwap,
    confirmCourtResult,
    selectQueueMatch,
    setQueueSelectCourtId,
    undoRound,
    finishTournament,
    resetTournament,
    handleSwap,
    getLeaderboard,
    getKOLeaderboard,
    hasPlayedTogether,
    capitalize,
    isTournamentDone,
  };
}

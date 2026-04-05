import React, { useEffect, useState } from 'react';
import { Match, Player, Round } from '@/app/lib/definitions';
import { archiveAndClearTournament, getTournamentState, saveTournamentState } from '@/app/lib/actions';
import { firePodiumConfetti } from '@/app/ui/confetti';
import { gameMode } from '@/app/lib/tournament_mode/gameMode';
import {
  buildDuprFinalLeaderboard,
  buildDuprLeaderboard,
  duprDomain,
  type DuprTournamentState,
} from '@/app/lib/game_modes/dupr/controller';
import { findMatchRoundIndex, type DuprMatchLogEntry } from '@/app/lib/game_modes/dupr/model';
import { rallyDomain } from '@/app/lib/game_modes/rally/controller';

type SwapSelection = {
  courtId?: string;
  team?: 'A' | 'B';
  index?: number;
  isWaitlist?: boolean;
  pId?: string;
} | null;

type CourtTeamDraft = {
  teamAName: string;
  teamBName: string;
  teamAPlayers: [string, string];
  teamBPlayers: [string, string];
};

type DuprUnassignedMatch = {
  roundIndex: number;
  matchId: string;
};

type DuprScoreDraft = {
  teamA: string;
  teamB: string;
};

type DuprKnockoutStage = 'SEMIFINAL' | 'QUARTERFINAL';
export function useTournamentController() {
  const [isHydrated, setIsHydrated] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);
  const [tournamentFinished, setTournamentFinished] = useState(false);
  const [mode, setMode] = useState<gameMode>(gameMode.RALLYTOTHETOP);
  const [duprTeamMode, setDuprTeamMode] = useState<'manual' | 'random'>('manual');
  const [duprKnockoutStage, setDuprKnockoutStage] = useState<DuprKnockoutStage>('SEMIFINAL');
  const [isEditMode, setIsEditMode] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [swapSelection, setSwapSelection] = useState<SwapSelection>(null);

  const availableCourts = ['1', '2', '3', '4', '5', '6', '7'];
  const [selectedCourts, setSelectedCourts] = useState<string[]>(['3', '4', '5', '6', '7']);
  const [courtOrder, setCourtOrder] = useState<string[]>(['1', '2', '3']);

  const [players, setPlayers] = useState<Player[]>([]);
  const [waitingPlayers, setWaitingPlayers] = useState<string[]>([]);
  const [currentMatches, setCurrentMatches] = useState<Record<string, Match>>({});
  const [history, setHistory] = useState<Round[]>([]);
  const [duprState, setDuprState] = useState<DuprTournamentState | null>(null);
  const [duprInitialState, setDuprInitialState] = useState<DuprTournamentState | null>(null);
  const [duprDraftPlayers, setDuprDraftPlayers] = useState<Player[] | null>(null);
  const [duprDraftSelection, setDuprDraftSelection] = useState<number | null>(null);
  const [duprTeamsConfirmed, setDuprTeamsConfirmed] = useState(false);
  const [duprUnassignedMatches, setDuprUnassignedMatches] = useState<DuprUnassignedMatch[]>([]);
  const [duprScoreDrafts, setDuprScoreDrafts] = useState<Record<string, DuprScoreDraft>>({});
  const [duprMatchLog, setDuprMatchLog] = useState<DuprMatchLogEntry[]>([]);
  const [courtTeamDrafts, setCourtTeamDrafts] = useState<Record<string, CourtTeamDraft>>({});
  const [bulkInput, setBulkInput] = useState('');

  const isDuprMode = mode === gameMode.DUPR;
  const duprCanStart = players.length >= 8 && players.length % 2 === 0;
  const activeCourtOrder = isDuprMode ? Object.keys(currentMatches) : courtOrder;
  const kingCourt = activeCourtOrder[0];
  const bottomCourt = activeCourtOrder[activeCourtOrder.length - 1];
  const isRoundOne = history.length === 0;

  const syncData = React.useCallback(async (overrideState?: unknown) => {
    const stateToSave = overrideState || {
      setupComplete,
      tournamentFinished,
      mode,
      tournamentType: mode,
      duprTeamMode,
      duprKnockoutStage,
      duprState,
      duprInitialState,
      duprDraftPlayers,
      duprDraftSelection,
      duprTeamsConfirmed,
      duprUnassignedMatches,
      duprScoreDrafts,
      duprMatchLog,
      courtTeamDrafts,
      selectedCourts,
      courtOrder,
      players,
      waitingPlayers,
      currentMatches,
      history,
      bulkInput,
    };

    if (isHydrated && ((stateToSave as { setupComplete?: boolean }).setupComplete || overrideState)) {
      const result = await saveTournamentState(stateToSave);
      if (!result.success) console.error('Cloud sync failed');
      return result;
    }
  }, [
    isHydrated,
    setupComplete,
    tournamentFinished,
    mode,
    duprTeamMode,
    duprKnockoutStage,
    duprState,
    duprInitialState,
    duprDraftPlayers,
    duprDraftSelection,
    duprTeamsConfirmed,
    duprUnassignedMatches,
    duprScoreDrafts,
    duprMatchLog,
    courtTeamDrafts,
    selectedCourts,
    courtOrder,
    players,
    waitingPlayers,
    currentMatches,
    history,
    bulkInput,
  ]);

  useEffect(() => {
    const loadInitialData = async () => {
      const data = await getTournamentState();

      if (data) {
        try {
          setSetupComplete(data.setupComplete ?? false);
          setTournamentFinished(data.tournamentFinished ?? false);
          setMode((data.mode ?? data.tournamentType ?? gameMode.RALLYTOTHETOP) as gameMode);
          setDuprTeamMode((data.duprTeamMode ?? 'manual') as 'manual' | 'random');
          setDuprKnockoutStage((data.duprKnockoutStage ?? 'SEMIFINAL') as DuprKnockoutStage);
          setSelectedCourts(data.selectedCourts ?? []);
          setCourtOrder(data.courtOrder ?? data.selectedCourts ?? []);
          setPlayers(data.players ?? []);
          setWaitingPlayers(data.waitingPlayers ?? []);
          setCurrentMatches(data.currentMatches ?? {});
          setHistory(data.history ?? []);
          const loadedDupr = (data.duprState as DuprTournamentState) ?? null;
          setDuprState(loadedDupr);
          setDuprInitialState((data.duprInitialState as DuprTournamentState) ?? loadedDupr);
          setDuprDraftPlayers((data.duprDraftPlayers as Player[]) ?? null);
          setDuprDraftSelection((data.duprDraftSelection as number | null) ?? null);
          setDuprTeamsConfirmed(data.duprTeamsConfirmed ?? false);
          setDuprUnassignedMatches(
            (data.duprUnassignedMatches as DuprUnassignedMatch[]) ??
            ((data.duprUnassignedMatchIds as string[] | undefined)?.map((matchId) => ({ roundIndex: 0, matchId })) ?? []),
          );
          const savedDuprScoreDrafts = (data.duprScoreDrafts as Record<string, string | DuprScoreDraft>) ?? {};
          const normalizedDuprScoreDrafts = Object.fromEntries(
            Object.entries(savedDuprScoreDrafts).map(([matchId, value]) => {
              if (typeof value === 'string') {
                const parsed = value.match(/^\s*(\d+)\s*-\s*(\d+)\s*$/);
                return [
                  matchId,
                  {
                    teamA: parsed ? parsed[1] : '',
                    teamB: parsed ? parsed[2] : '',
                  },
                ];
              }
              return [
                matchId,
                {
                  teamA: value?.teamA ?? '',
                  teamB: value?.teamB ?? '',
                },
              ];
            }),
          ) as Record<string, DuprScoreDraft>;
          setDuprScoreDrafts(normalizedDuprScoreDrafts);
          setDuprMatchLog((data.duprMatchLog as DuprMatchLogEntry[]) ?? []);
          setCourtTeamDrafts((data.courtTeamDrafts as Record<string, CourtTeamDraft>) ?? {});
          setBulkInput(data.bulkInput ?? '');
        } catch (e) {
          console.error('Error parsing database state:', e);
        }
      }

      setIsHydrated(true);
    };

    loadInitialData();
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      syncData();
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [syncData]);

  useEffect(() => {
    setCourtOrder((prev) => rallyDomain.reconcileCourtOrder(prev, selectedCourts));
  }, [selectedCourts]);

  useEffect(() => {
    setCourtTeamDrafts((prev) => {
      const next = { ...prev };
      selectedCourts.forEach((courtId) => {
        if (!next[courtId]) {
          next[courtId] = {
            teamAName: `Court ${courtId} Team A`,
            teamBName: `Court ${courtId} Team B`,
            teamAPlayers: ['', ''],
            teamBPlayers: ['', ''],
          };
        }
      });
      return next;
    });
  }, [selectedCourts]);

  const moveCourt = (index: number, direction: 'up' | 'down') => {
    const newOrder = [...courtOrder];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newOrder.length) return;
    [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
    setCourtOrder(newOrder);
  };

  const toggleCourtSelection = (courtId: string) => {
    setSelectedCourts((prev) => (prev.includes(courtId) ? prev.filter((id) => id !== courtId) : [...prev, courtId]));
  };

  const reorderCourtById = (sourceCourtId: string, targetCourtId: string) => {
    if (sourceCourtId === targetCourtId) return;
    setCourtOrder((prev) => {
      const src = prev.indexOf(sourceCourtId);
      const dst = prev.indexOf(targetCourtId);
      if (src === -1 || dst === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(src, 1);
      next.splice(dst, 0, moved);
      return next;
    });
  };

  const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();

  const hasPlayedTogetherRecently = (p1: string, p2: string) =>
    rallyDomain.hasPlayedTogetherInHistory(history, p1, p2);

  const generatePairings = (isFirst: boolean, roster: Player[], courts: string[]) => {
    const result = rallyDomain.generatePairings({
      isFirst,
      roster,
      courts,
      currentMatches,
      waitingPlayers,
      courtOrder,
      history,
    });
    setCurrentMatches(result.matches);
    setWaitingPlayers(result.waitingIds);
  };

  const handleSwap = (target: Exclude<SwapSelection, null>) => {
    if (!isEditMode || !swapSelection) return;
    if (!isRoundOne && (swapSelection.courtId !== target.courtId || swapSelection.isWaitlist || target.isWaitlist)) {
      alert('From Round 2, players can only be swapped within the same court.');
      setSwapSelection(null);
      return;
    }
    const newMatches = JSON.parse(JSON.stringify(currentMatches));
    const newWaiting = [...waitingPlayers];
    const p1 = swapSelection.isWaitlist
      ? swapSelection.pId!
      : newMatches[swapSelection.courtId!][swapSelection.team === 'A' ? 'teamA' : 'teamB'][swapSelection.index!];
    const p2 = target.isWaitlist
      ? target.pId!
      : newMatches[target.courtId!][target.team === 'A' ? 'teamA' : 'teamB'][target.index!];
    if (swapSelection.isWaitlist) newWaiting[newWaiting.indexOf(p1)] = p2;
    else newMatches[swapSelection.courtId!][swapSelection.team === 'A' ? 'teamA' : 'teamB'][swapSelection.index!] = p2;
    if (target.isWaitlist) newWaiting[newWaiting.indexOf(p2)] = p1;
    else newMatches[target.courtId!][target.team === 'A' ? 'teamA' : 'teamB'][target.index!] = p1;
    setCurrentMatches(newMatches);
    setWaitingPlayers(newWaiting);
    setSwapSelection(null);
  };

  const swapPlayersByPosition = (
    source: { courtId: string; team: 'A' | 'B'; index: number },
    target: { courtId: string; team: 'A' | 'B'; index: number },
  ) => {
    if (!isRoundOne && source.courtId !== target.courtId) {
      alert('From Round 2, players can only be swapped within the same court.');
      return;
    }

    const sourceMatch = currentMatches[source.courtId];
    const targetMatch = currentMatches[target.courtId];
    if (!sourceMatch || !targetMatch) return;

    const sourceTeamKey = source.team === 'A' ? 'teamA' : 'teamB';
    const targetTeamKey = target.team === 'A' ? 'teamA' : 'teamB';
    const sourcePlayer = sourceMatch[sourceTeamKey][source.index];
    const targetPlayer = targetMatch[targetTeamKey][target.index];
    if (!sourcePlayer || !targetPlayer) return;

    const nextMatches = JSON.parse(JSON.stringify(currentMatches)) as Record<string, Match>;
    nextMatches[source.courtId][sourceTeamKey][source.index] = targetPlayer;
    nextMatches[target.courtId][targetTeamKey][target.index] = sourcePlayer;
    setCurrentMatches(nextMatches);
    setSwapSelection(null);
  };

  const getLeaderboard = () => rallyDomain.calculateLeaderboard({ players, history, kingCourt });
  const getRallyFinalLeaderboard = () => getLeaderboard();
  const getDuprLeaderboard = () => duprStandings;
  const getDuprFinalLeaderboardComputed = () => duprFinalLeaderboard;

  const shufflePlayers = (input: Player[]): Player[] => {
    const next = [...input];
    for (let i = next.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [next[i], next[j]] = [next[j], next[i]];
    }
    return next;
  };

  const duprDraftTeams = duprDraftPlayers ? duprDomain.createTeams(duprDraftPlayers) : [];

  const getDuprActiveRoundIndex = () => duprState?.currentRoundNumber ?? history.length;

  const getRoundIndexByMatchId = (state: DuprTournamentState, matchId: string): number =>
    findMatchRoundIndex(state, matchId);

  const upsertHistoryRound = (roundToSave: Round) => {
    setHistory((prev) => {
      const idx = prev.findIndex((round) => round.id === roundToSave.id);
      if (idx === -1) return [...prev, { ...roundToSave }];
      const next = [...prev];
      next[idx] = { ...roundToSave };
      return next;
    });
  };

  const seedDuprRoundQueue = (state: DuprTournamentState) => {
    const assignedMatchIds = new Set(Object.values(currentMatches).map((match) => match.id));
    const queue: DuprUnassignedMatch[] = [];

    if (state.phase === 'ROUND_ROBIN') {
      state.rounds.slice(0, state.roundRobinRounds).forEach((round, roundIndex) => {
        Object.keys(round.matches).forEach((matchId) => {
          const match = round.matches[matchId];
          if (match.winner || assignedMatchIds.has(match.id)) return;
          queue.push({ roundIndex, matchId });
        });
      });
    } else if (state.phase === 'KNOCKOUT') {
      const round = state.rounds[state.currentRoundNumber];
      if (round) {
        Object.keys(round.matches).forEach((matchId) => {
          const match = round.matches[matchId];
          if (match.winner || assignedMatchIds.has(match.id)) return;
          queue.push({ roundIndex: state.currentRoundNumber, matchId });
        });
      }
    }

    setDuprUnassignedMatches(queue);
    setDuprScoreDrafts({});
  };

  const replayDuprFromHistory = (seedState: DuprTournamentState, roundsToReplay: Round[]) => {
    let rebuilt: DuprTournamentState = {
      ...seedState,
      rounds: seedState.rounds.map((round) => ({
        ...round,
        matches: Object.fromEntries(Object.entries(round.matches).map(([k, m]) => [k, { ...m, winner: null }])),
      })),
      phase: 'ROUND_ROBIN',
      currentRoundNumber: 0,
    };

    roundsToReplay.forEach((round, index) => {
      Object.entries(round.matches).forEach(([courtId, match]) => {
        if (match.winner) {
          rebuilt = duprDomain.applyWinner(rebuilt, index, courtId, match.winner);
        }
      });
      rebuilt = duprDomain.advancePhase(rebuilt);
    });
    return rebuilt;
  };

  const duprStandings = duprState ? buildDuprLeaderboard(duprState) : [];
  const duprFinalLeaderboard = duprState ? buildDuprFinalLeaderboard(duprState) : [];

  const rebuildDuprFromWinners = (
    sourceState: DuprTournamentState,
    skipMatch?: { roundIndex: number; matchId: string },
  ): DuprTournamentState => {
    let rebuilt: DuprTournamentState = {
      ...sourceState,
      rounds: sourceState.rounds.map((round) => ({
        ...round,
        matches: Object.fromEntries(
          Object.entries(round.matches).map(([key, match]) => [key, { ...match, winner: null, score: null }]),
        ),
      })),
      phase: 'ROUND_ROBIN',
      currentRoundNumber: 0,
    };

    sourceState.rounds.forEach((round, roundIndex) => {
      Object.entries(round.matches).forEach(([matchId, match]) => {
        if (!match.winner) return;
        if (skipMatch && skipMatch.roundIndex === roundIndex && skipMatch.matchId === matchId) return;
        rebuilt = duprDomain.applyWinner(rebuilt, roundIndex, matchId, match.winner, match.score ?? null);
      });
      rebuilt = duprDomain.advancePhase(rebuilt);
    });

    return rebuilt;
  };

  const updateCourtTeamDraft = (
    courtId: string,
    field: 'teamAName' | 'teamBName' | 'teamAPlayers' | 'teamBPlayers',
    value: string | [string, string],
  ) => {
    setCourtTeamDrafts((prev) => {
      const current = prev[courtId] ?? {
        teamAName: `Court ${courtId} Team A`,
        teamBName: `Court ${courtId} Team B`,
        teamAPlayers: ['', ''],
        teamBPlayers: ['', ''],
      };
      return {
        ...prev,
        [courtId]: {
          ...current,
          [field]: value,
        },
      };
    });
  };

  const swapCourtTeams = (courtId: string) => {
    const draft = courtTeamDrafts[courtId];
    if (!draft) return;
    updateCourtTeamDraft(courtId, 'teamAName', draft.teamBName);
    updateCourtTeamDraft(courtId, 'teamBName', draft.teamAName);
    updateCourtTeamDraft(courtId, 'teamAPlayers', draft.teamBPlayers);
    updateCourtTeamDraft(courtId, 'teamBPlayers', draft.teamAPlayers);
  };

  const swapPlayersWithinTeam = (courtId: string, team: 'A' | 'B') => {
    const draft = courtTeamDrafts[courtId];
    if (!draft) return;
    if (team === 'A') {
      updateCourtTeamDraft(courtId, 'teamAPlayers', [draft.teamAPlayers[1], draft.teamAPlayers[0]]);
      return;
    }
    updateCourtTeamDraft(courtId, 'teamBPlayers', [draft.teamBPlayers[1], draft.teamBPlayers[0]]);
  };

  const importPlayersFromCsv = (csvText: string) => {
    const parseCsvLine = (line: string) => {
      const cells: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i += 1) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i += 1;
          } else {
            inQuotes = !inQuotes;
          }
          continue;
        }
        if (char === ',' && !inQuotes) {
          cells.push(current.trim());
          current = '';
          continue;
        }
        current += char;
      }
      cells.push(current.trim());
      return cells;
    };

    const lines = csvText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length === 0) return { ok: false, count: 0 };

    const normalized = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
    const headerCells = parseCsvLine(lines[0]).map(normalized);
    const firstNameIndex = headerCells.findIndex((cell) => cell === 'firstname');
    const duprIndex = headerCells.findIndex((cell) => cell === 'dupr' || cell === 'duprrating');

    if (firstNameIndex < 0 || duprIndex < 0) {
      return { ok: false, count: 0 };
    }

    const parsed: Player[] = lines
      .slice(1)
      .map(parseCsvLine)
      .map((parts) => {
        const name = (parts[firstNameIndex] ?? '').trim();
        const ratingRaw = (parts[duprIndex] ?? '').trim();
        const parsedRating = parseFloat(ratingRaw);
        return {
          id: name,
          name,
          rating: Number.isFinite(parsedRating) ? parsedRating : 3.5,
        };
      })
      .filter((player) => player.name.length > 0);

    if (parsed.length === 0) return { ok: false, count: 0 };
    setPlayers(parsed);
    setBulkInput(parsed.map((p) => `${p.name}:${p.rating}`).join('\n'));
    return { ok: true, count: parsed.length };
  };

  const generateDuprTeams = () => {
    const shuffled = shufflePlayers(players);
    setPlayers(shuffled);
    setBulkInput(shuffled.map((p) => `${p.name}:${p.rating}`).join('\n'));
  };

  const swapDuprDraftPlayers = (index: number) => {
    if (!duprDraftPlayers) return;
    if (duprDraftSelection === null) {
      setDuprDraftSelection(index);
      return;
    }
    if (duprDraftSelection === index) {
      setDuprDraftSelection(null);
      return;
    }
    const next = [...duprDraftPlayers];
    [next[duprDraftSelection], next[index]] = [next[index], next[duprDraftSelection]];
    setDuprDraftPlayers(next);
    setDuprDraftSelection(null);
    setDuprTeamsConfirmed(false);
  };

  const confirmDuprTeams = () => {
    if (!duprDraftPlayers) {
      alert('Generate teams first.');
      return;
    }
    setDuprTeamsConfirmed(true);
  };

  const startTournament = () => {
    if (mode === gameMode.DUPR) {
      try {
        const sourcePlayers = [...players];
        const teamCount = players.length / 2;
        if (duprKnockoutStage === 'QUARTERFINAL' && teamCount < 8) {
          alert('Quarterfinal requires at least 8 teams (16 players).');
          return;
        }
        const knockoutSize: 4 | 8 = duprKnockoutStage === 'QUARTERFINAL' ? 8 : 4;
        const initialized = duprDomain.initialize(sourcePlayers, { roundRobinRounds: 4, knockoutSize });
        setPlayers(sourcePlayers);
        setDuprInitialState(initialized);
        setDuprState(initialized);
        setHistory([]);
        setWaitingPlayers([]);
        setCurrentMatches({});
        setDuprMatchLog([]);
        setCourtOrder(selectedCourts);
        seedDuprRoundQueue(initialized);
        setSetupComplete(true);
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Failed to start DUPR tournament.');
      }
      return;
    }

    if (mode !== gameMode.RALLYTOTHETOP) {
      alert(`${mode} setup is saved, but gameplay is not yet wired in this screen.`);
      return;
    }

    generatePairings(true, players, selectedCourts);
    setSetupComplete(true);
  };

  const assignDuprMatchToCourt = (matchId: string, courtId: string, roundIndex?: number) => {
    if (!isDuprMode || !duprState) return;
    if (currentMatches[courtId]) {
      alert(`Court ${courtId} is occupied by ${currentMatches[courtId].teamA.join('/')} vs ${currentMatches[courtId].teamB.join('/')}`);
      return;
    }
    const resolvedRoundIndex = typeof roundIndex === 'number' ? roundIndex : getRoundIndexByMatchId(duprState, matchId);
    if (resolvedRoundIndex < 0) return;
    const round = duprState.rounds[resolvedRoundIndex];
    const match = round?.matches[matchId];
    if (!match) return;

    setCurrentMatches((prev) => ({ ...prev, [courtId]: { ...match } }));
    setDuprUnassignedMatches((prev) =>
      prev.filter((entry) => !(entry.matchId === matchId && entry.roundIndex === resolvedRoundIndex)),
    );
  };

  const unassignDuprCourt = (courtId: string) => {
    const match = currentMatches[courtId];
    if (!match) return;
    setCurrentMatches((prev) => {
      const next = { ...prev };
      delete next[courtId];
      return next;
    });
    if (duprState) {
      const roundIndex = getRoundIndexByMatchId(duprState, match.id);
      if (roundIndex >= 0) {
        setDuprUnassignedMatches((prev) => {
          if (prev.some((entry) => entry.matchId === match.id && entry.roundIndex === roundIndex)) return prev;
          return [...prev, { roundIndex, matchId: match.id }];
        });
      }
    }
  };

  const setDuprWinnerOnCourt = (courtId: string, winner: 'A' | 'B') => {
    setCurrentMatches((prev) => {
      const m = prev[courtId];
      if (!m) return prev;
      return { ...prev, [courtId]: { ...m, winner } };
    });
  };

  const setDuprScoreDraft = (matchId: string, team: 'A' | 'B', score: string) => {
    const key = team === 'A' ? 'teamA' : 'teamB';
    setDuprScoreDrafts((prev) => ({
      ...prev,
      [matchId]: {
        teamA: prev[matchId]?.teamA ?? '',
        teamB: prev[matchId]?.teamB ?? '',
        [key]: score,
      },
    }));
  };

  const completeDuprCourtMatch = (courtId: string) => {
    if (!duprState || !isDuprMode) return;
    const match = currentMatches[courtId];
    if (!match) return;
    const draft = duprScoreDrafts[match.id] ?? { teamA: '', teamB: '' };
    const teamAScore = Number(draft.teamA.trim());
    const teamBScore = Number(draft.teamB.trim());
    if (!Number.isInteger(teamAScore) || !Number.isInteger(teamBScore) || teamAScore < 0 || teamBScore < 0) {
      alert('Please enter a valid non-negative score for both teams.');
      return;
    }
    if (teamAScore === teamBScore) {
      alert('Score cannot be tied.');
      return;
    }
    const winner: 'A' | 'B' = teamAScore > teamBScore ? 'A' : 'B';

    const roundIndex = getRoundIndexByMatchId(duprState, match.id);
    if (roundIndex < 0) return;
    const phaseAtRecord = duprState.phase === 'KNOCKOUT' ? 'KNOCKOUT' : 'ROUND_ROBIN';
    const scoreText = `${teamAScore}-${teamBScore}`;
    let updated = duprDomain.applyWinner(duprState, roundIndex, match.id, winner, `${teamAScore}-${teamBScore}`);
    setDuprState(updated);
    setDuprMatchLog((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${match.id}`,
        phase: phaseAtRecord,
        roundIndex,
        matchId: match.id,
        teamA: [...match.teamA],
        teamB: [...match.teamB],
        score: scoreText,
        winner,
      },
    ]);

    setCurrentMatches((prev) => {
      const next = { ...prev };
      delete next[courtId];
      return next;
    });

    const currentRound = updated.rounds[roundIndex];
    if (currentRound) {
      upsertHistoryRound(currentRound);
    }

    updated = duprDomain.advancePhase(updated);
    setDuprState(updated);

    if (updated.phase === 'COMPLETED') {
      setTournamentFinished(true);
      firePodiumConfetti();
      return;
    }

    seedDuprRoundQueue(updated);
  };

  const canProceedNextRound =
    !isDuprMode
      ? Object.values(currentMatches).every((m) => m.winner)
      : Boolean(
          duprState &&
          duprState.phase === 'KNOCKOUT' &&
          duprState.rounds[duprState.currentRoundNumber] &&
          Object.values(duprState.rounds[duprState.currentRoundNumber].matches).every((m) => m.winner),
        );

  const nextRound = () => {
    if (isDuprMode && duprState) {
      if (duprState.phase !== 'KNOCKOUT') return;
      const activeRoundIndex = duprState.currentRoundNumber;
      const round = duprState.rounds[activeRoundIndex];
      if (!round || !Object.values(round.matches).every((m) => m.winner)) {
        alert('Complete all knockout matches before proceeding.');
        return;
      }
      upsertHistoryRound(round);
      let updated = duprState;
      if (activeRoundIndex < updated.rounds.length - 1) {
        updated = { ...updated, currentRoundNumber: activeRoundIndex + 1 };
      }
      updated = duprDomain.advancePhase(updated);
      setDuprState(updated);

      if (updated.phase === 'COMPLETED') {
        setTournamentFinished(true);
        firePodiumConfetti();
        return;
      }

      seedDuprRoundQueue(updated);
      setWaitingPlayers([]);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const nextHistory = [...history, { id: history.length, matches: { ...currentMatches }, waiting: [...waitingPlayers] }];
    setHistory(nextHistory);
    generatePairings(false, players, selectedCourts);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const undoRound = () => {
    if (history.length === 0) return;
    const ph = [...history];
    ph.pop();

    if (isDuprMode && duprState && duprInitialState) {
      const rebuilt = replayDuprFromHistory(duprInitialState, ph);
      setDuprState(rebuilt);
      seedDuprRoundQueue(rebuilt);
      setWaitingPlayers([]);
      setHistory(ph);
      setTournamentFinished(false);
      return;
    }

    const last = ph[ph.length - 1];
    if (last) {
      setCurrentMatches(last.matches);
      setWaitingPlayers(last.waiting);
    }
    setHistory(ph);
  };

  const undoDuprLastMatch = () => {
    if (!duprState) return;

    let target: { roundIndex: number; matchId: string } | null = null;
    for (let roundIndex = duprState.rounds.length - 1; roundIndex >= 0; roundIndex -= 1) {
      const round = duprState.rounds[roundIndex];
      const matchIds = Object.keys(round.matches);
      for (let matchIndex = matchIds.length - 1; matchIndex >= 0; matchIndex -= 1) {
        const matchId = matchIds[matchIndex];
        const match = round.matches[matchId];
        if (match?.winner) {
          target = { roundIndex, matchId };
          break;
        }
      }
      if (target) break;
    }

    if (!target) {
      alert('No completed DUPR match to undo.');
      return;
    }

    const rebuilt = rebuildDuprFromWinners(duprState, target);
    setDuprState(rebuilt);
    setTournamentFinished(false);

    setCurrentMatches((prev) => {
      const matchLookup = new Map<string, Match>();
      rebuilt.rounds.forEach((round) => {
        Object.values(round.matches).forEach((match) => {
          if (!match.winner) matchLookup.set(match.id, match);
        });
      });
      const next: Record<string, Match> = {};
      Object.entries(prev).forEach(([courtId, match]) => {
        const rebuiltMatch = matchLookup.get(match.id);
        if (rebuiltMatch) next[courtId] = { ...rebuiltMatch };
      });
      return next;
    });

    setHistory((prev) =>
      prev
        .map((round) => {
          if (round.id !== target.roundIndex) return round;
          const nextMatches = { ...round.matches };
          const targetMatch = nextMatches[target!.matchId];
          if (!targetMatch) return round;
          nextMatches[target!.matchId] = { ...targetMatch, winner: null, score: null };
          return { ...round, matches: nextMatches };
        })
        .filter((round) => Object.values(round.matches).some((match) => match.winner)),
    );
    setDuprMatchLog((prev) => {
      for (let i = prev.length - 1; i >= 0; i -= 1) {
        const entry = prev[i];
        if (entry.roundIndex === target.roundIndex && entry.matchId === target.matchId) {
          return [...prev.slice(0, i), ...prev.slice(i + 1)];
        }
      }
      return prev;
    });

    seedDuprRoundQueue(rebuilt);
  };

  const resetTournament = async () => {
    if (confirm('R U Sure, Reset?')) {
      await archiveAndClearTournament('reset-button');
      localStorage.removeItem('kotc_session');
      location.reload();
    }
  };

  const newSession = async () => {
    if (confirm('Start a brand new session? This clears all data.')) {
      await archiveAndClearTournament('new-session');
      localStorage.removeItem('kotc_session');
      location.reload();
    }
  };

  const finishTournament = () => {
    setTournamentFinished(true);
    firePodiumConfetti();
  };

  return {
    state: {
      setupComplete,
      tournamentFinished,
      mode,
      isDuprMode,
    },
    config: {
      duprTeamMode,
      duprKnockoutStage,
      availableCourts,
      selectedCourts,
      courtOrder,
      players,
      bulkInput,
      duprCanStart,
      duprDraftPlayers,
      courtTeamDrafts,
      duprDraftTeams,
      duprDraftSelection,
      duprTeamsConfirmed,
    },
    session: {
      isEditMode,
      showHistoryModal,
      swapSelection,
      waitingPlayers,
      currentMatches,
      history,
      duprState,
      activeCourtOrder,
      kingCourt,
      bottomCourt,
      isRoundOne,
      duprStandings,
      duprFinalLeaderboard,
      duprMatchLog,
      duprUnassignedMatches,
      duprScoreDrafts,
      canProceedNextRound,
    },
    computed: {
      capitalize,
      hasPlayedTogetherRecently,
      getLeaderboard,
      getRallyFinalLeaderboard,
      getDuprLeaderboard,
      getDuprFinalLeaderboard: getDuprFinalLeaderboardComputed,
    },
    actions: {
      setSetupComplete,
      setTournamentFinished,
      setMode,
      setDuprTeamMode,
      setDuprKnockoutStage,
      setIsEditMode,
      setShowHistoryModal,
      setSwapSelection,
      setSelectedCourts,
      setPlayers,
      setWaitingPlayers,
      setCurrentMatches,
      setHistory,
      setBulkInput,
      moveCourt,
      toggleCourtSelection,
      reorderCourtById,
      handleSwap,
      swapPlayersByPosition,
      updateCourtTeamDraft,
      swapCourtTeams,
      swapPlayersWithinTeam,
      importPlayersFromCsv,
      randomizePlayers: generateDuprTeams,
      startTournament,
      generateDuprTeams,
      swapDuprDraftPlayers,
      confirmDuprTeams,
      assignDuprMatchToCourt,
      unassignDuprCourt,
      setDuprWinnerOnCourt,
      setDuprScoreDraft,
      completeDuprCourtMatch,
      undoDuprLastMatch,
      nextRound,
      undoRound,
      resetTournament,
      newSession,
      finishTournament,
    },
  };
}

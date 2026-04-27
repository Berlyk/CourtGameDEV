import {
  roleOrderByCount,
} from "../lib/roleOrderConfig.js";
import { normalizeCasePackKey as normalizeStoredCasePackKey } from "../lib/casePacksStore.js";
import type { SubscriptionTier } from "../lib/subscriptions.js";

function shuffle<T>(array: T[]): T[] {
  return [...array].sort(() => Math.random() - 0.5);
}

function pickRandom<T>(array: T[], count = 1): T[] {
  return shuffle(array).slice(0, count);
}

function buildStagesByPlayerCount(playerCount: number): string[] {
  switch (playerCount) {
    case 4:
      return [
        "Подготовка",
        "Выступление истца",
        "Выступление ответчика",
        "Выступление адвоката ответчика",
        "Перекрестный допрос",
        "Финальная речь истца",
        "Финальная речь ответчика",
        "Финальная речь адвоката ответчика",
        "Решение судьи",
      ];
    case 5:
      return [
        "Подготовка",
        "Выступление прокурора",
        "Выступление истца",
        "Выступление ответчика",
        "Выступление адвоката ответчика",
        "Перекрестный допрос",
        "Финальная речь прокурора",
        "Финальная речь истца",
        "Финальная речь ответчика",
        "Финальная речь адвоката ответчика",
        "Решение судьи",
      ];
    case 6:
      return [
        "Подготовка",
        "Выступление прокурора",
        "Выступление истца",
        "Выступление адвоката истца",
        "Выступление ответчика",
        "Выступление адвоката ответчика",
        "Перекрестный допрос",
        "Финальная речь прокурора",
        "Финальная речь истца",
        "Финальная речь адвоката истца",
        "Финальная речь ответчика",
        "Финальная речь адвоката ответчика",
        "Решение судьи",
      ];
    case 3:
    default:
      return [
        "Подготовка",
        "Выступление истца",
        "Выступление ответчика",
        "Перекрестный допрос",
        "Финальная речь истца",
        "Финальная речь ответчика",
        "Решение судьи",
      ];
  }
}

export interface PlayerCard {
  id: string;
  name: string;
  description: string;
  used: boolean;
}

export interface PlayerFact {
  id: string;
  text: string;
  revealed: boolean;
}

export interface Player {
  id: string;
  userId?: string;
  subscriptionTier?: SubscriptionTier;
  name: string;
  isBot?: boolean;
  selectedBadgeKey?: string;
  preferredRole?: AssignableRole | null;
  lobbyAssignedRole?: AssignableRole | null;
  roleAssignmentSource?: "auto_preference" | "manual" | "random" | null;
  rolePreferenceStatus?: "idle" | "assigned" | "conflict" | "unavailable";
  socketId: string;
  sessionToken?: string;
  disconnectedUntil?: number;
  warningCount?: number;
  avatar?: string;
  banner?: string;
  roleKey?: string;
  roleTitle?: string;
  goal?: string;
  facts?: PlayerFact[];
  cards?: PlayerCard[];
}

export interface RevealedFact {
  id: string;
  ownerId: string;
  text: string;
  owner: string;
  ownerRole: string;
  stageIndex: number;
}

export interface UsedCard {
  id: string;
  ownerId: string;
  owner: string;
  ownerRole: string;
  name: string;
  description: string;
}

export interface ActiveProtest {
  id: string;
  actorId: string;
  actorName: string;
  actorRoleTitle: string;
  createdAt: number;
}

export interface GameState {
  caseData: any;
  players: Player[];
  stages: string[];
  stageIndex: number;
  revealedFacts: RevealedFact[];
  usedCards: UsedCard[];
  activeProtest: ActiveProtest | null;
  finished: boolean;
  verdict: string;
  verdictEvaluation: string;
  verdictCloseAt?: number | null;
  matchStartedAt?: number;
  matchExpiresAt?: number;
  openingSpeechTimerSec?: number | null;
  closingSpeechTimerSec?: number | null;
  protestLimitEnabled?: boolean;
  maxProtestsPerPlayer?: number | null;
  protestUsageByPlayer?: Record<string, number>;
}

export interface Room {
  code: string;
  roomName?: string;
  modeKey: RoomModeKey;
  casePackKey?: string;
  maxPlayers: number;
  hostId: string;
  players: Player[];
  game: GameState | null;
  started: boolean;
  isHostJudge: boolean;
  usePreferredRoles: boolean;
  visibility: "public" | "private";
  password?: string;
  venueLabel?: string;
  venueUrl?: string;
  allowWitnesses: boolean;
  maxObservers: number;
  openingSpeechTimerSec: number | null;
  closingSpeechTimerSec: number | null;
  protestLimitEnabled: boolean;
  maxProtestsPerPlayer: number | null;
  createdAt: number;
  hostSubscriptionTier: SubscriptionTier;
  isPromoted: boolean;
  lobbyChat: LobbyChatMessage[];
}

export interface LobbyChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  text: string;
  createdAt: number;
}

export interface PublicMatchInfo {
  code: string;
  roomName?: string;
  modeKey: RoomModeKey;
  casePackKey?: string;
  visibility: "public" | "private";
  hostName: string;
  playerCount: number;
  maxPlayers: number;
  started: boolean;
  currentStage?: string;
  createdAt: number;
  venueLabel?: string;
  venueUrl?: string;
  requiresPassword: boolean;
  hostSubscriptionTier: SubscriptionTier;
  isPromoted: boolean;
}

export interface CreateRoomOptions {
  modeKey?: RoomModeKey;
  casePackKey?: string;
  visibility?: "public" | "private";
  password?: string;
  roomName?: string;
  venueLabel?: string;
  venueUrl?: string;
  usePreferredRoles?: boolean;
  allowWitnesses?: boolean;
  maxObservers?: number;
  openingSpeechTimerSec?: number | null;
  closingSpeechTimerSec?: number | null;
  protestLimitEnabled?: boolean;
  maxProtestsPerPlayer?: number | null;
  hostSubscriptionTier?: SubscriptionTier;
  isPromoted?: boolean;
}

export type AssignableRole =
  | "judge"
  | "plaintiff"
  | "defendant"
  | "defenseLawyer"
  | "prosecutor"
  | "plaintiffLawyer";

export type RoomModeKey =
  | "quick_flex"
  | "civil_3"
  | "criminal_4"
  | "criminal_5"
  | "company_6";

const ROOM_MODE_MAX_PLAYERS: Record<RoomModeKey, number> = {
  quick_flex: 6,
  civil_3: 3,
  criminal_4: 4,
  criminal_5: 5,
  company_6: 6,
};

const rooms = new Map<string, Room>();
const ROOM_HARD_TTL_MS = 24 * 60 * 60 * 1000;
const MATCH_TTL_MS = 2.5 * 60 * 60 * 1000;
const MAX_WITNESS_PLAYERS = 2;
const MAX_OBSERVERS_LIMIT = 6;

function getWitnessRoleTitle(room: Room): string {
  const witnesses = room.players.filter((player) => player.roleKey === "witness");
  const plaintiffWitnesses = witnesses.filter((player) =>
    (player.roleTitle ?? "").toLowerCase().includes("истца"),
  ).length;
  const defendantWitnesses = witnesses.filter((player) =>
    (player.roleTitle ?? "").toLowerCase().includes("ответчика"),
  ).length;
  return plaintiffWitnesses <= defendantWitnesses
    ? "Свидетель истца"
    : "Свидетель ответчика";
}

function getSupportRoleForJoin(room: Room): "witness" | "observer" {
  if (room.modeKey === "quick_flex") {
    const witnesses = room.players.filter((player) => player.roleKey === "witness").length;
    if (witnesses < MAX_WITNESS_PLAYERS) return "witness";
  }
  if (!room.allowWitnesses) return "observer";
  const witnesses = room.players.filter((player) => player.roleKey === "witness").length;
  return witnesses < MAX_WITNESS_PLAYERS ? "witness" : "observer";
}

function canAddSupportRole(room: Room, supportRole: "witness" | "observer"): boolean {
  if (supportRole === "observer") {
    const observers = room.players.filter((player) => player.roleKey === "observer").length;
    return observers < room.maxObservers;
  }
  if (!room.allowWitnesses && room.modeKey !== "quick_flex") return false;
  const witnesses = room.players.filter((player) => player.roleKey === "witness").length;
  return witnesses < MAX_WITNESS_PLAYERS;
}

function getAssignableRolesForCount(playerCount: number): AssignableRole[] {
  return roleOrderByCount[playerCount] as AssignableRole[];
}

function getActiveLobbyPlayers(room: Room): Player[] {
  return room.players.filter(
    (player) => player.roleKey !== "witness" && player.roleKey !== "observer",
  );
}

function promoteSupportPlayersIfSlotsAvailable(room: Room) {
  if (room.started) return;
  const activePlayers = getActiveLobbyPlayers(room);
  const freeSlots = Math.max(0, room.maxPlayers - activePlayers.length);
  if (freeSlots <= 0) return;

  const supportPlayers = room.players
    .filter(
      (player) =>
        player.connected !== false &&
        (player.roleKey === "witness" || player.roleKey === "observer"),
    )
    .sort((a, b) => {
      if (a.id === room.hostId) return -1;
      if (b.id === room.hostId) return 1;
      return 0;
    });
  if (!supportPlayers.length) return;

  for (const player of supportPlayers.slice(0, freeSlots)) {
    player.roleKey = undefined;
    player.roleTitle = undefined;
    player.goal = undefined;
    player.facts = [];
    player.cards = [];
    clearLobbyRoleState(player);
  }
}

function getRequiredRolesForRoom(room: Room): AssignableRole[] {
  const activePlayers = getActiveLobbyPlayers(room);
  const count =
    room.modeKey === "quick_flex"
      ? Math.max(3, Math.min(room.maxPlayers, activePlayers.length))
      : room.maxPlayers;
  return getAssignableRolesForCount(count);
}

function clearLobbyRoleState(player: Player) {
  player.lobbyAssignedRole = null;
  player.roleAssignmentSource = null;
  player.rolePreferenceStatus = "idle";
}

function assignLobbyRole(
  player: Player,
  role: AssignableRole,
  source: "auto_preference" | "manual" | "random",
) {
  player.lobbyAssignedRole = role;
  player.roleAssignmentSource = source;
  player.rolePreferenceStatus = "assigned";
}

function rebalanceLobbyRoleAssignments(room: Room) {
  promoteSupportPlayersIfSlotsAvailable(room);
  if (!room.started && room.modeKey === "quick_flex") {
    const activePlayers = getActiveLobbyPlayers(room);
    if (activePlayers.length > room.maxPlayers) {
      const overflowCount = activePlayers.length - room.maxPlayers;
      const nonHostOverflow = [...activePlayers]
        .reverse()
        .filter((player) => player.id !== room.hostId);
      const hostOverflow = [...activePlayers]
        .reverse()
        .filter((player) => player.id === room.hostId);
      const overflowPlayers = [...nonHostOverflow, ...hostOverflow].slice(0, overflowCount);

      for (const player of overflowPlayers) {
        let supportRole: "witness" | "observer" = getSupportRoleForJoin(room);
        if (!canAddSupportRole(room, supportRole)) {
          const fallbackRole: "witness" | "observer" =
            supportRole === "witness" ? "observer" : "witness";
          if (!canAddSupportRole(room, fallbackRole)) {
            break;
          }
          supportRole = fallbackRole;
        }
        player.roleKey = supportRole;
        player.roleTitle = supportRole === "witness" ? getWitnessRoleTitle(room) : "Наблюдатель";
        player.goal =
          supportRole === "witness"
            ? "Наблюдать за процессом суда и, по требованию судьи, давать показания."
            : "Наблюдать за процессом суда без участия в механиках и действиях сторон.";
        player.facts = [];
        player.cards = [];
        clearLobbyRoleState(player);
      }
    }
  }

  const requiredRoles = new Set<AssignableRole>(getRequiredRolesForRoom(room));
  const activePlayers = getActiveLobbyPlayers(room);
  const occupiedRoles = new Set<AssignableRole>();
  const manualAssigned = new Set<string>();

  if (!room.usePreferredRoles) {
    activePlayers.forEach((player) => {
      const currentRole = player.lobbyAssignedRole;
      const isManual = player.roleAssignmentSource === "manual";
      if (currentRole && isManual && requiredRoles.has(currentRole) && !occupiedRoles.has(currentRole)) {
        assignLobbyRole(player, currentRole, "manual");
        occupiedRoles.add(currentRole);
        manualAssigned.add(player.id);
        return;
      }
      clearLobbyRoleState(player);
      player.roleAssignmentSource = "random";
    });

    if (room.isHostJudge) {
      const host = activePlayers.find((player) => player.id === room.hostId);
      if (host && requiredRoles.has("judge") && !occupiedRoles.has("judge")) {
        assignLobbyRole(host, "judge", "manual");
        occupiedRoles.add("judge");
      }
    }

    activePlayers.forEach((player) => {
      if (player.lobbyAssignedRole) return;
      player.rolePreferenceStatus = "idle";
      player.roleAssignmentSource = "random";
    });
    return;
  }

  activePlayers.forEach((player) => {
    const currentRole = player.lobbyAssignedRole;
    if (currentRole && requiredRoles.has(currentRole) && !occupiedRoles.has(currentRole)) {
      assignLobbyRole(
        player,
        currentRole,
        player.roleAssignmentSource === "manual" ? "manual" : "auto_preference",
      );
      occupiedRoles.add(currentRole);
      if (player.roleAssignmentSource === "manual") {
        manualAssigned.add(player.id);
      }
      return;
    }
    clearLobbyRoleState(player);
  });

  if (room.isHostJudge) {
    const host = activePlayers.find((player) => player.id === room.hostId);
    if (host && requiredRoles.has("judge")) {
      if (host.lobbyAssignedRole && host.lobbyAssignedRole !== "judge") {
        clearLobbyRoleState(host);
      }
      if (!occupiedRoles.has("judge")) {
        assignLobbyRole(host, "judge", "manual");
        occupiedRoles.add("judge");
        manualAssigned.add(host.id);
      }
    }
  }

  const byRole = new Map<AssignableRole, Player[]>();
  activePlayers.forEach((player) => {
    if (manualAssigned.has(player.id)) return;
    if (player.lobbyAssignedRole) return;
    const pref = player.preferredRole;
    if (!pref) {
      player.rolePreferenceStatus = "idle";
      return;
    }
    if (!requiredRoles.has(pref)) {
      player.rolePreferenceStatus = "unavailable";
      return;
    }
    const list = byRole.get(pref) ?? [];
    list.push(player);
    byRole.set(pref, list);
  });

  for (const role of requiredRoles) {
    if (occupiedRoles.has(role)) continue;
    const candidates = byRole.get(role) ?? [];
    if (!candidates.length) continue;
    if (candidates.length === 1) {
      assignLobbyRole(candidates[0], role, "auto_preference");
      occupiedRoles.add(role);
      continue;
    }
    const pickedIndex = Math.floor(Math.random() * candidates.length);
    const winner = candidates[pickedIndex];
    assignLobbyRole(winner, role, "auto_preference");
    occupiedRoles.add(role);
    candidates.forEach((player, index) => {
      if (index !== pickedIndex && !player.lobbyAssignedRole) {
        player.rolePreferenceStatus = "conflict";
      }
    });
  }

  activePlayers.forEach((player) => {
    if (player.lobbyAssignedRole) return;
    if (player.rolePreferenceStatus === "conflict" || player.rolePreferenceStatus === "unavailable") {
      player.roleAssignmentSource = "random";
      return;
    }
    player.rolePreferenceStatus = "idle";
    player.roleAssignmentSource = "random";
  });
}

function normalizeLoadedPlayer(player: any): Player | null {
  if (!player || typeof player.id !== "string" || typeof player.name !== "string") {
    return null;
  }
  return {
    id: player.id,
    userId: typeof player.userId === "string" ? player.userId : undefined,
    subscriptionTier:
      player.subscriptionTier === "trainee" ||
      player.subscriptionTier === "practitioner" ||
      player.subscriptionTier === "arbiter"
        ? player.subscriptionTier
        : undefined,
    name: player.name,
    isBot: !!player.isBot,
    preferredRole:
      typeof player.preferredRole === "string" ? (player.preferredRole as AssignableRole) : null,
    lobbyAssignedRole:
      typeof player.lobbyAssignedRole === "string"
        ? (player.lobbyAssignedRole as AssignableRole)
        : null,
    roleAssignmentSource:
      player.roleAssignmentSource === "auto_preference" ||
      player.roleAssignmentSource === "manual" ||
      player.roleAssignmentSource === "random"
        ? player.roleAssignmentSource
        : null,
    rolePreferenceStatus:
      player.rolePreferenceStatus === "idle" ||
      player.rolePreferenceStatus === "assigned" ||
      player.rolePreferenceStatus === "conflict" ||
      player.rolePreferenceStatus === "unavailable"
        ? player.rolePreferenceStatus
        : "idle",
    socketId: typeof player.socketId === "string" ? player.socketId : "",
    sessionToken:
      typeof player.sessionToken === "string" ? player.sessionToken : undefined,
    disconnectedUntil:
      typeof player.disconnectedUntil === "number" ? player.disconnectedUntil : undefined,
    avatar: typeof player.avatar === "string" ? player.avatar : undefined,
    banner: typeof player.banner === "string" ? player.banner : undefined,
    roleKey: typeof player.roleKey === "string" ? player.roleKey : undefined,
    roleTitle: typeof player.roleTitle === "string" ? player.roleTitle : undefined,
    goal: typeof player.goal === "string" ? player.goal : undefined,
    facts: Array.isArray(player.facts) ? player.facts : undefined,
    cards: Array.isArray(player.cards) ? player.cards : undefined,
    warningCount:
      typeof player.warningCount === "number" ? Math.max(0, Math.min(3, player.warningCount)) : undefined,
  };
}

export function restoreRoomsFromSnapshots(snapshots: unknown[]): number {
  let restored = 0;
  for (const raw of snapshots) {
    const snapshot = raw as any;
    if (!snapshot || typeof snapshot.code !== "string") continue;
    if (rooms.has(snapshot.code)) continue;

    const players = Array.isArray(snapshot.players)
      ? snapshot.players
          .map(normalizeLoadedPlayer)
          .filter((player): player is Player => !!player)
      : [];
    if (players.length === 0) continue;

    const loadedRoom: Room = {
      code: snapshot.code,
      roomName: typeof snapshot.roomName === "string" ? snapshot.roomName : undefined,
      modeKey: normalizeModeKey(snapshot.modeKey),
      casePackKey:
        typeof snapshot.casePackKey === "string"
          ? normalizeCasePackKey(snapshot.casePackKey)
          : "classic",
      maxPlayers:
        typeof snapshot.maxPlayers === "number"
          ? Math.max(3, Math.min(6, snapshot.maxPlayers))
          : ROOM_MODE_MAX_PLAYERS[normalizeModeKey(snapshot.modeKey)],
      hostId:
        typeof snapshot.hostId === "string" && snapshot.hostId
          ? snapshot.hostId
          : players[0].id,
      players,
      game: null,
      started: !!snapshot.started,
      isHostJudge: !!snapshot.isHostJudge,
      usePreferredRoles: !!snapshot.usePreferredRoles,
      visibility: normalizeVisibility(snapshot.visibility),
      password:
        typeof snapshot.password === "string" && snapshot.password.trim()
          ? snapshot.password.trim()
          : undefined,
      venueLabel:
        typeof snapshot.venueLabel === "string" ? snapshot.venueLabel : undefined,
      venueUrl: typeof snapshot.venueUrl === "string" ? snapshot.venueUrl : undefined,
      allowWitnesses: snapshot.allowWitnesses !== false,
      maxObservers: normalizeObserverLimit(snapshot.maxObservers),
      openingSpeechTimerSec: normalizeSpeechTimerSeconds(snapshot.openingSpeechTimerSec),
      closingSpeechTimerSec: normalizeSpeechTimerSeconds(snapshot.closingSpeechTimerSec),
      protestLimitEnabled: !!snapshot.protestLimitEnabled,
      maxProtestsPerPlayer: normalizeProtestLimit(snapshot.maxProtestsPerPlayer),
      createdAt:
        typeof snapshot.createdAt === "number" ? snapshot.createdAt : Date.now(),
      hostSubscriptionTier:
        snapshot.hostSubscriptionTier === "trainee" ||
        snapshot.hostSubscriptionTier === "practitioner" ||
        snapshot.hostSubscriptionTier === "arbiter"
          ? snapshot.hostSubscriptionTier
          : "free",
      isPromoted: !!snapshot.isPromoted,
      lobbyChat: Array.isArray(snapshot.lobbyChat) ? snapshot.lobbyChat : [],
    };

    if (snapshot.game && typeof snapshot.game === "object") {
      const gamePlayers = Array.isArray(snapshot.game.players)
        ? snapshot.game.players
            .map(normalizeLoadedPlayer)
            .filter((player): player is Player => !!player)
        : [];
      loadedRoom.game = {
        caseData: snapshot.game.caseData,
        players: gamePlayers.length > 0 ? gamePlayers : players,
        stages: Array.isArray(snapshot.game.stages) ? snapshot.game.stages : [],
        stageIndex:
          typeof snapshot.game.stageIndex === "number"
            ? snapshot.game.stageIndex
            : 0,
        revealedFacts: Array.isArray(snapshot.game.revealedFacts)
          ? snapshot.game.revealedFacts
          : [],
        usedCards: Array.isArray(snapshot.game.usedCards) ? snapshot.game.usedCards : [],
        activeProtest: snapshot.game.activeProtest ?? null,
        finished: !!snapshot.game.finished,
        verdict: typeof snapshot.game.verdict === "string" ? snapshot.game.verdict : "",
        verdictEvaluation:
          typeof snapshot.game.verdictEvaluation === "string"
            ? snapshot.game.verdictEvaluation
            : "",
        verdictCloseAt:
          typeof snapshot.game.verdictCloseAt === "number"
            ? snapshot.game.verdictCloseAt
            : null,
        matchStartedAt:
          typeof snapshot.game.matchStartedAt === "number"
            ? snapshot.game.matchStartedAt
            : typeof snapshot.createdAt === "number"
              ? snapshot.createdAt
              : Date.now(),
        matchExpiresAt:
          typeof snapshot.game.matchExpiresAt === "number"
            ? snapshot.game.matchExpiresAt
            : typeof snapshot.game.matchStartedAt === "number"
              ? snapshot.game.matchStartedAt + MATCH_TTL_MS
              : typeof snapshot.createdAt === "number"
                ? snapshot.createdAt + MATCH_TTL_MS
                : Date.now() + MATCH_TTL_MS,
        openingSpeechTimerSec: normalizeSpeechTimerSeconds(snapshot.game.openingSpeechTimerSec),
        closingSpeechTimerSec: normalizeSpeechTimerSeconds(snapshot.game.closingSpeechTimerSec),
        protestLimitEnabled: !!snapshot.game.protestLimitEnabled,
        maxProtestsPerPlayer: normalizeProtestLimit(snapshot.game.maxProtestsPerPlayer),
        protestUsageByPlayer:
          snapshot.game.protestUsageByPlayer && typeof snapshot.game.protestUsageByPlayer === "object"
            ? (snapshot.game.protestUsageByPlayer as Record<string, number>)
            : {},
      };
      loadedRoom.started = true;
    }

    if (!loadedRoom.started) {
      rebalanceLobbyRoleAssignments(loadedRoom);
    }

    rooms.set(loadedRoom.code, loadedRoom);
    restored += 1;
  }
  return restored;
}

function normalizeVisibility(value: string | undefined): "public" | "private" {
  if (value === "public") return "public";
  return "private";
}

function normalizeRoomPassword(password: string | undefined): string | undefined {
  if (!password) return undefined;
  const trimmed = password.trim();
  return trimmed ? trimmed.slice(0, 64) : undefined;
}

function normalizeRoomName(name: string | undefined): string | undefined {
  if (!name) return undefined;
  const trimmed = name.trim();
  return trimmed ? trimmed.slice(0, 80) : undefined;
}

function normalizeModeKey(modeKey: RoomModeKey | undefined): RoomModeKey {
  if (!modeKey) return "quick_flex";
  if (modeKey in ROOM_MODE_MAX_PLAYERS) return modeKey;
  return "quick_flex";
}

function normalizeCasePackKey(casePackKey: string | undefined): string {
  return normalizeStoredCasePackKey(casePackKey);
}

function normalizeVenueLabel(label: string | undefined): string | undefined {
  if (!label) return undefined;
  const trimmed = label.trim();
  return trimmed ? trimmed.slice(0, 120) : undefined;
}

function normalizeVenueUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  return trimmed ? trimmed.slice(0, 300) : undefined;
}

export function createRoom(code: string, player: Player, options?: CreateRoomOptions): Room {
  const modeKey = normalizeModeKey(options?.modeKey);
  const casePackKey = normalizeCasePackKey(options?.casePackKey);
  const maxPlayers = ROOM_MODE_MAX_PLAYERS[modeKey];
  const visibility =
    options?.visibility !== undefined
      ? normalizeVisibility(options.visibility)
      : modeKey === "quick_flex"
        ? "public"
        : "private";
  const password = normalizeRoomPassword(options?.password);
  const roomName = normalizeRoomName(options?.roomName);
  const venueLabel = normalizeVenueLabel(options?.venueLabel);
  const venueUrl = normalizeVenueUrl(options?.venueUrl);
  const allowWitnesses = options?.allowWitnesses !== false;
  const maxObservers = normalizeObserverLimit(options?.maxObservers);
  const openingSpeechTimerSec = normalizeSpeechTimerSeconds(options?.openingSpeechTimerSec);
  const closingSpeechTimerSec = normalizeSpeechTimerSeconds(options?.closingSpeechTimerSec);
  const protestLimitEnabled = !!options?.protestLimitEnabled;
  const maxProtestsPerPlayer = normalizeProtestLimit(options?.maxProtestsPerPlayer);
  const room: Room = {
    code,
    roomName,
    modeKey,
    casePackKey,
    maxPlayers,
    hostId: player.id,
    players: [player],
    game: null,
    started: false,
    isHostJudge: false,
    usePreferredRoles: !!options?.usePreferredRoles,
    visibility,
    password,
    venueLabel,
    venueUrl,
    allowWitnesses,
    maxObservers,
    openingSpeechTimerSec,
    closingSpeechTimerSec,
    protestLimitEnabled,
    maxProtestsPerPlayer,
    createdAt: Date.now(),
    hostSubscriptionTier: options?.hostSubscriptionTier ?? "free",
    isPromoted: !!options?.isPromoted,
    lobbyChat: [],
  };
  rebalanceLobbyRoleAssignments(room);
  rooms.set(code, room);
  return room;
}

function normalizeObserverLimit(raw: unknown): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return MAX_OBSERVERS_LIMIT;
  return Math.max(0, Math.min(MAX_OBSERVERS_LIMIT, Math.floor(parsed)));
}

function normalizeSpeechTimerSeconds(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return null;
  const clamped = Math.max(15, Math.min(180, Math.floor(parsed)));
  return clamped;
}

function normalizeProtestLimit(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(1, Math.min(10, Math.floor(parsed)));
}

export function setHostJudge(code: string, isHostJudge: boolean): Room | null {
  const room = rooms.get(code);
  if (!room) return null;
  room.isHostJudge = isHostJudge;
  if (!isHostJudge) {
    const host = room.players.find((player) => player.id === room.hostId);
    if (host && host.lobbyAssignedRole === "judge") {
      clearLobbyRoleState(host);
      host.roleAssignmentSource = "random";
    }
  }
  rebalanceLobbyRoleAssignments(room);
  return room;
}

export function setUsePreferredRoles(code: string, usePreferredRoles: boolean): Room | null {
  const room = rooms.get(code);
  if (!room || room.started) return null;
  room.usePreferredRoles = !!usePreferredRoles;
  rebalanceLobbyRoleAssignments(room);
  return room;
}

export function transferRoomHost(
  code: string,
  targetPlayerId: string,
): { room: Room; ok: true } | { room: Room; ok: false; reason: string } | null {
  const room = rooms.get(code);
  if (!room || room.started) return null;
  const target = room.players.find((player) => player.id === targetPlayerId);
  if (!target) {
    return { room, ok: false, reason: "Игрок не найден в лобби." };
  }
  room.hostId = target.id;
  rebalanceLobbyRoleAssignments(room);
  return { room, ok: true };
}

export function updateRoomManagement(
  code: string,
  patch: {
    modeKey?: RoomModeKey;
    casePackKey?: string;
    visibility?: "public" | "private";
    password?: string | null;
    allowWitnesses?: boolean;
    maxObservers?: number;
    openingSpeechTimerSec?: number | null;
    closingSpeechTimerSec?: number | null;
    protestLimitEnabled?: boolean;
    maxProtestsPerPlayer?: number | null;
  },
): { room: Room; ok: true } | { room: Room; ok: false; reason: string } | null {
  const room = rooms.get(code);
  if (!room || room.started) return null;

  if (patch.modeKey !== undefined) {
    const nextMode = normalizeModeKey(patch.modeKey);
    const nextMaxPlayers = ROOM_MODE_MAX_PLAYERS[nextMode];
    const activeMainPlayers = getActiveLobbyPlayers(room);
    if (activeMainPlayers.length > nextMaxPlayers) {
      const overflowCount = activeMainPlayers.length - nextMaxPlayers;
      const nonHostPool = activeMainPlayers.filter((player) => player.id !== room.hostId);
      const hostPool = activeMainPlayers.filter((player) => player.id === room.hostId);
      const overflowPlayers = [...shuffle(nonHostPool), ...hostPool].slice(0, overflowCount);
      const overflowIds = new Set(overflowPlayers.map((player) => player.id));
      room.allowWitnesses = true;

      for (const player of overflowPlayers) {
        let supportRole: "witness" | "observer" = getSupportRoleForJoin(room);
        if (!canAddSupportRole(room, supportRole)) {
          const fallbackRole: "witness" | "observer" =
            supportRole === "witness" ? "observer" : "witness";
          if (!canAddSupportRole(room, fallbackRole)) {
            return {
              room,
              ok: false,
              reason:
                "Нельзя сменить режим: превышен лимит свидетелей/наблюдателей для лишних игроков.",
            };
          }
          supportRole = fallbackRole;
        }
        player.roleKey = supportRole;
        player.roleTitle = supportRole === "witness" ? getWitnessRoleTitle(room) : "Наблюдатель";
        player.goal =
          supportRole === "witness"
            ? "Наблюдать за процессом суда и, по требованию судьи, давать показания."
            : "Наблюдать за процессом суда без участия в механиках и действиях сторон.";
        player.facts = [];
        player.cards = [];
        clearLobbyRoleState(player);
      }

      room.players = [
        ...room.players.filter((player) => !overflowIds.has(player.id)),
        ...room.players.filter((player) => overflowIds.has(player.id)),
      ];
    }
    room.modeKey = nextMode;
    room.maxPlayers = nextMaxPlayers;
  }

  if (patch.casePackKey !== undefined) {
    room.casePackKey = normalizeCasePackKey(patch.casePackKey);
  }

  if (patch.visibility !== undefined) {
    room.visibility = normalizeVisibility(patch.visibility);
    if (room.visibility === "public") {
      room.password = undefined;
    }
  }

  if (patch.password !== undefined) {
    room.password = normalizeRoomPassword(patch.password ?? undefined);
  }

  if (patch.allowWitnesses !== undefined) {
    room.allowWitnesses = !!patch.allowWitnesses;
  }

  if (patch.maxObservers !== undefined) {
    room.maxObservers = normalizeObserverLimit(patch.maxObservers);
  }

  if (patch.openingSpeechTimerSec !== undefined) {
    room.openingSpeechTimerSec = normalizeSpeechTimerSeconds(patch.openingSpeechTimerSec);
  }

  if (patch.closingSpeechTimerSec !== undefined) {
    room.closingSpeechTimerSec = normalizeSpeechTimerSeconds(patch.closingSpeechTimerSec);
  }

  if (patch.protestLimitEnabled !== undefined) {
    room.protestLimitEnabled = !!patch.protestLimitEnabled;
  }

  if (patch.maxProtestsPerPlayer !== undefined) {
    room.maxProtestsPerPlayer = normalizeProtestLimit(patch.maxProtestsPerPlayer);
  }

  rebalanceLobbyRoleAssignments(room);
  return { room, ok: true };
}

export function chooseLobbyRole(
  code: string,
  actorId: string,
  targetPlayerId: string,
  role: AssignableRole | null,
  options?: {
    allowNonHostChoiceInForeignLobby?: boolean;
  },
): { room: Room; ok: true } | { room: Room; ok: false; reason: string } | null {
  const room = rooms.get(code);
  if (!room || room.started) return null;
  const actor = room.players.find((entry) => entry.id === actorId);
  if (!actor) return null;
  const player = room.players.find((entry) => entry.id === targetPlayerId);
  if (!player) return null;

  const isHostActor = actor.id === room.hostId;
  if (!isHostActor) {
    if (actor.id !== player.id) {
      return { room, ok: false, reason: "Можно менять только свою роль." };
    }
    if (!room.usePreferredRoles && !options?.allowNonHostChoiceInForeignLobby) {
      return { room, ok: false, reason: "Ведущий не разрешил выбор ролей для игроков." };
    }
    if (!room.usePreferredRoles && player.roleAssignmentSource === "manual") {
      return { room, ok: false, reason: "Ведущий зафиксировал вашу роль." };
    }
  } else if (room.usePreferredRoles && actor.id !== player.id) {
    return { room, ok: false, reason: "При включенном выборе ролей игроки выбирают роль сами." };
  }

  if (player.roleKey === "witness" || player.roleKey === "observer") {
    return { room, ok: false, reason: "Свидетели и наблюдатели не выбирают роль." };
  }

  const requiredRoles = getRequiredRolesForRoom(room);
  const requiredSet = new Set(requiredRoles);
  if (role && !requiredSet.has(role)) {
    return { room, ok: false, reason: "Эта роль недоступна для текущего режима." };
  }

  const occupied = new Set<AssignableRole>();
  getActiveLobbyPlayers(room).forEach((entry) => {
    if (entry.id === player.id) return;
    if (entry.lobbyAssignedRole && requiredSet.has(entry.lobbyAssignedRole)) {
      occupied.add(entry.lobbyAssignedRole);
    }
  });

  if (role && occupied.has(role)) {
    rebalanceLobbyRoleAssignments(room);
    return { room, ok: false, reason: "Роль уже занята другим игроком." };
  }

  if (role) {
    assignLobbyRole(player, role, "manual");
  } else {
    clearLobbyRoleState(player);
    player.roleAssignmentSource = "random";
  }

  rebalanceLobbyRoleAssignments(room);
  return { room, ok: true };
}

export function addAdminBotsToRoom(
  code: string,
  count: number,
): Room | null {
  const room = rooms.get(code);
  if (!room) return null;
  const safeCount = Math.max(1, Math.min(6, Math.floor(count)));
  for (let i = 0; i < safeCount; i += 1) {
    const botId = crypto.randomUUID();
    const existingNumbers = new Set(
      room.players
        .map((player) => {
          const match = /^Бот-(\d+)$/i.exec((player.name ?? "").trim());
          return match ? Number(match[1]) : null;
        })
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value)),
    );
    let num = 1;
    while (existingNumbers.has(num)) num += 1;
    const baseBot: Player = {
      id: botId,
      name: `Бот-${num}`,
      isBot: true,
      socketId: `bot:${botId}`,
      sessionToken: crypto.randomUUID(),
      preferredRole: null,
      lobbyAssignedRole: null,
      roleAssignmentSource: "random",
      rolePreferenceStatus: "idle",
    };

    if (!room.started || !room.game) {
      const activePlayers = getActiveLobbyPlayers(room);
      if (activePlayers.length >= room.maxPlayers) {
        let supportRole: "witness" | "observer" = getSupportRoleForJoin(room);
        if (!canAddSupportRole(room, supportRole)) {
          const fallbackRole: "witness" | "observer" =
            supportRole === "witness" ? "observer" : "witness";
          if (!canAddSupportRole(room, fallbackRole)) {
            continue;
          }
          supportRole = fallbackRole;
        }

        room.players.push({
          ...baseBot,
          roleKey: supportRole,
          roleTitle: supportRole === "witness" ? getWitnessRoleTitle(room) : "Наблюдатель",
          goal:
            supportRole === "witness"
              ? "Наблюдать за процессом суда и, по требованию судьи, давать показания."
              : "Наблюдать за процессом суда без участия в механиках и действиях сторон.",
          facts: [],
          cards: [],
        });
      } else {
        room.players.push(baseBot);
      }
      continue;
    }

    const supportRole = getSupportRoleForJoin(room);
    if (!canAddSupportRole(room, supportRole)) {
      continue;
    }

    const botInMatch: Player = {
      ...baseBot,
      roleKey: supportRole,
      roleTitle: supportRole === "witness" ? getWitnessRoleTitle(room) : "Наблюдатель",
      goal:
        supportRole === "witness"
          ? "Наблюдать за процессом суда и, по требованию судьи, давать показания."
          : "Наблюдать за процессом суда без участия в механиках и действиях сторон.",
      facts: [],
      cards: [],
    };

    room.players.push(botInMatch);
    room.game.players.push({
      ...botInMatch,
      facts: [],
      cards: [],
    });
  }
  if (!room.started) {
    rebalanceLobbyRoleAssignments(room);
  }
  return room;
}

export function getRoom(code: string): Room | undefined {
  return rooms.get(code);
}

export function listRooms(): Room[] {
  return [...rooms.values()];
}

export function deleteRoom(code: string): boolean {
  return rooms.delete(code);
}

export function updatePlayerAvatar(
  code: string,
  playerId: string,
  avatar?: string
): Room | null {
  const room = rooms.get(code);
  if (!room) return null;

  const normalizedAvatar = avatar || undefined;

  const lobbyPlayer = room.players.find((p) => p.id === playerId);
  if (lobbyPlayer) {
    lobbyPlayer.avatar = normalizedAvatar;
  }

  if (room.game) {
    const gamePlayer = room.game.players.find((p) => p.id === playerId);
    if (gamePlayer) {
      gamePlayer.avatar = normalizedAvatar;
    }
  }

  return room;
}

export function isNameTaken(code: string, name: string): boolean {
  const room = rooms.get(code);
  if (!room) return false;
  const lower = name.trim().toLowerCase();
  if (room.players.some(p => p.name.trim().toLowerCase() === lower)) return true;
  if (room.game?.players.some((p: any) => p.name.trim().toLowerCase() === lower)) return true;
  return false;
}

export function isNameTakenByOther(code: string, playerId: string, name: string): boolean {
  const room = rooms.get(code);
  if (!room) return false;
  const lower = name.trim().toLowerCase();
  if (room.players.some((p) => p.id !== playerId && p.name.trim().toLowerCase() === lower)) {
    return true;
  }
  if (room.game?.players.some((p: any) => p.id !== playerId && p.name.trim().toLowerCase() === lower)) {
    return true;
  }
  return false;
}

export function isJoinPasswordValid(code: string, password?: string): boolean {
  const room = rooms.get(code);
  if (!room) return false;
  if (!room.password) return true;
  const normalized = (password ?? "").trim();
  return room.password === normalized;
}

export function joinRoom(code: string, player: Player, password?: string): Room | null {
  const room = rooms.get(code);
  if (!room) return null;
  if (room.started) return null;
  if (room.players.length >= room.maxPlayers) return null;
  if (!isJoinPasswordValid(code, password)) return null;
  room.players.push(player);
  rebalanceLobbyRoleAssignments(room);
  return room;
}

export function joinRoomAsLobbyWitness(
  code: string,
  player: Player,
  password?: string,
): Room | null {
  const room = rooms.get(code);
  if (!room) return null;
  if (room.started) return null;
  if (room.players.length < room.maxPlayers) return null;
  if (!isJoinPasswordValid(code, password)) return null;

  const supportRole = getSupportRoleForJoin(room);
  if (!canAddSupportRole(room, supportRole)) return null;
  const witnessPlayer: Player = {
    ...player,
    roleKey: supportRole,
    roleTitle:
      supportRole === "witness" ? getWitnessRoleTitle(room) : "Наблюдатель",
    goal:
      supportRole === "witness"
        ? "Наблюдать за процессом суда и, по требованию судьи, давать показания."
        : "Наблюдать за процессом суда без участия в механиках и действиях сторон.",
    facts: [],
    cards: [],
  };

  room.players.push(witnessPlayer);
  rebalanceLobbyRoleAssignments(room);
  return room;
}

export function joinRunningGameAsWitness(code: string, player: Player): Room | null {
  const room = rooms.get(code);
  if (!room?.game) return null;

  const supportRole = getSupportRoleForJoin(room);
  if (!canAddSupportRole(room, supportRole)) return null;
  const witnessPlayer: Player = {
    ...player,
    roleKey: supportRole,
    roleTitle:
      supportRole === "witness" ? getWitnessRoleTitle(room) : "Наблюдатель",
    goal:
      supportRole === "witness"
        ? "Наблюдать за процессом суда и, по требованию судьи, давать показания."
        : "Наблюдать за процессом суда без участия в механиках и действиях сторон.",
    facts: [],
    cards: []
  };

  room.players.push({
    ...witnessPlayer,
    facts: [],
    cards: []
  });
  room.game.players.push({
    ...witnessPlayer,
    facts: [],
    cards: []
  });

  return room;
}

export function rejoinRoom(
  code: string,
  sessionToken: string,
  newSocketId: string,
  avatar?: string | null,
  banner?: string | null,
): { room: Room; playerId: string; playerName: string } | null {
  const room = rooms.get(code);
  if (!room) return null;
  const normalizedToken = sessionToken.trim();
  if (!normalizedToken) return null;
  const normalizedAvatar = avatar || undefined;
  const normalizedBanner = banner || undefined;

  if (room.game) {
    const player = room.game.players.find(
      (p: any) => p.sessionToken === normalizedToken,
    );
    if (player) {
      player.socketId = newSocketId;
      player.disconnectedUntil = undefined;
      if (avatar !== undefined) {
        player.avatar = normalizedAvatar;
      }
      if (banner !== undefined) {
        player.banner = normalizedBanner;
      }
      const lobbyPlayer = room.players.find(p => p.id === player.id);
      if (lobbyPlayer) {
        lobbyPlayer.socketId = newSocketId;
        lobbyPlayer.disconnectedUntil = undefined;
        if (avatar !== undefined) {
          lobbyPlayer.avatar = normalizedAvatar;
        }
        if (banner !== undefined) {
          lobbyPlayer.banner = normalizedBanner;
        }
      }
      return { room, playerId: player.id, playerName: player.name };
    }
  }

  const player = room.players.find((p) => p.sessionToken === normalizedToken);
  if (player) {
    player.socketId = newSocketId;
    player.disconnectedUntil = undefined;
    if (avatar !== undefined) {
      player.avatar = normalizedAvatar;
    }
    if (banner !== undefined) {
      player.banner = normalizedBanner;
    }
    return { room, playerId: player.id, playerName: player.name };
  }

  return null;
}

export function reclaimDisconnectedPlayerByName(
  code: string,
  playerName: string,
  newSocketId: string,
  avatar?: string | null,
  banner?: string | null,
): { room: Room; playerId: string; playerName: string; sessionToken: string } | null {
  const room = rooms.get(code);
  if (!room) return null;

  const normalizedName = playerName.trim().toLowerCase();
  if (!normalizedName) return null;
  const normalizedAvatar = avatar || undefined;
  const normalizedBanner = banner || undefined;

  const findDisconnected = (list: Player[]) =>
    list.find(
      (p) =>
        p.name.trim().toLowerCase() === normalizedName &&
        (!p.socketId || p.socketId.trim().length === 0),
    );

  const lobbyPlayer = findDisconnected(room.players);
  const gamePlayer = room.game ? findDisconnected(room.game.players) : undefined;
  const targetPlayer = gamePlayer ?? lobbyPlayer;
  if (!targetPlayer) return null;

  targetPlayer.socketId = newSocketId;
  targetPlayer.disconnectedUntil = undefined;
  if (avatar !== undefined) {
    targetPlayer.avatar = normalizedAvatar;
  }
  if (banner !== undefined) {
    targetPlayer.banner = normalizedBanner;
  }
  if (!targetPlayer.sessionToken || !targetPlayer.sessionToken.trim()) {
    targetPlayer.sessionToken = crypto.randomUUID();
  }

  const mirrorLobbyPlayer = room.players.find((p) => p.id === targetPlayer.id);
  if (mirrorLobbyPlayer) {
    mirrorLobbyPlayer.socketId = newSocketId;
    mirrorLobbyPlayer.disconnectedUntil = undefined;
    mirrorLobbyPlayer.sessionToken = targetPlayer.sessionToken;
    if (avatar !== undefined) {
      mirrorLobbyPlayer.avatar = normalizedAvatar;
    }
    if (banner !== undefined) {
      mirrorLobbyPlayer.banner = normalizedBanner;
    }
  }

  const mirrorGamePlayer = room.game?.players.find((p) => p.id === targetPlayer.id);
  if (mirrorGamePlayer) {
    mirrorGamePlayer.socketId = newSocketId;
    mirrorGamePlayer.disconnectedUntil = undefined;
    mirrorGamePlayer.sessionToken = targetPlayer.sessionToken;
    if (avatar !== undefined) {
      mirrorGamePlayer.avatar = normalizedAvatar;
    }
    if (banner !== undefined) {
      mirrorGamePlayer.banner = normalizedBanner;
    }
  }

  return {
    room,
    playerId: targetPlayer.id,
    playerName: targetPlayer.name,
    sessionToken: targetPlayer.sessionToken!,
  };
}

export function reclaimDisconnectedPlayerByUserId(
  code: string,
  userId: string,
  newSocketId: string,
  avatar?: string | null,
  banner?: string | null,
): { room: Room; playerId: string; playerName: string; sessionToken: string } | null {
  const room = rooms.get(code);
  if (!room) return null;
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) return null;
  const normalizedAvatar = avatar || undefined;
  const normalizedBanner = banner || undefined;

  const findDisconnected = (list: Player[]) =>
    list.find(
      (p) =>
        p.userId === normalizedUserId &&
        (!p.socketId || p.socketId.trim().length === 0),
    );

  const lobbyPlayer = findDisconnected(room.players);
  const gamePlayer = room.game ? findDisconnected(room.game.players) : undefined;
  const targetPlayer = gamePlayer ?? lobbyPlayer;
  if (!targetPlayer) return null;

  targetPlayer.socketId = newSocketId;
  targetPlayer.disconnectedUntil = undefined;
  if (avatar !== undefined) {
    targetPlayer.avatar = normalizedAvatar;
  }
  if (banner !== undefined) {
    targetPlayer.banner = normalizedBanner;
  }
  if (!targetPlayer.sessionToken || !targetPlayer.sessionToken.trim()) {
    targetPlayer.sessionToken = crypto.randomUUID();
  }

  const mirrorLobbyPlayer = room.players.find((p) => p.id === targetPlayer.id);
  if (mirrorLobbyPlayer) {
    mirrorLobbyPlayer.socketId = newSocketId;
    mirrorLobbyPlayer.disconnectedUntil = undefined;
    mirrorLobbyPlayer.sessionToken = targetPlayer.sessionToken;
    if (avatar !== undefined) {
      mirrorLobbyPlayer.avatar = normalizedAvatar;
    }
    if (banner !== undefined) {
      mirrorLobbyPlayer.banner = normalizedBanner;
    }
  }

  const mirrorGamePlayer = room.game?.players.find((p) => p.id === targetPlayer.id);
  if (mirrorGamePlayer) {
    mirrorGamePlayer.socketId = newSocketId;
    mirrorGamePlayer.disconnectedUntil = undefined;
    mirrorGamePlayer.sessionToken = targetPlayer.sessionToken;
    if (avatar !== undefined) {
      mirrorGamePlayer.avatar = normalizedAvatar;
    }
    if (banner !== undefined) {
      mirrorGamePlayer.banner = normalizedBanner;
    }
  }

  return {
    room,
    playerId: targetPlayer.id,
    playerName: targetPlayer.name,
    sessionToken: targetPlayer.sessionToken!,
  };
}

export function removePlayer(code: string, playerId: string): Room | null {
  const room = rooms.get(code);
  if (!room) return null;

  room.players = room.players.filter((p) => p.id !== playerId);
  if (room.game) {
    room.game.players = room.game.players.filter((p) => p.id !== playerId);
  }

  const hasLobbyPlayers = room.players.length > 0;
  const hasGamePlayers = !!room.game && room.game.players.length > 0;
  if (!hasLobbyPlayers && !hasGamePlayers) {
    rooms.delete(code);
    return null;
  }

  const allPlayersAfterRemoval = room.game ? room.game.players : room.players;
  const hasAnyHumanPlayer = allPlayersAfterRemoval.some((player) => {
    const byName = /^бот-\d+$/i.test((player.name ?? "").trim());
    const bySocket = (player.socketId ?? "").trim().startsWith("bot:");
    return !player.isBot && !byName && !bySocket;
  });
  if (!hasAnyHumanPlayer) {
    rooms.delete(code);
    return null;
  }

  if (room.hostId === playerId) {
    const nextHostId = room.players[0]?.id ?? room.game?.players[0]?.id;
    if (nextHostId) {
      room.hostId = nextHostId;
    }
  }

  rebalanceLobbyRoleAssignments(room);

  return room;
}

export function removeDisconnectedLobbyPlayersBeforeStart(code: string): Room | null {
  const room = rooms.get(code);
  if (!room || room.started || room.game) return room ?? null;
  const beforeCount = room.players.length;
  room.players = room.players.filter((player) => {
    const socketId = player.socketId?.trim() ?? "";
    const isBotByName = /^бот-\d+$/i.test((player.name ?? "").trim());
    if (player.isBot || socketId.startsWith("bot:") || isBotByName) return true;
    return socketId.length > 0;
  });
  if (room.players.length !== beforeCount) {
    if (!room.players.find((player) => player.id === room.hostId)) {
      const nextHost = room.players[0];
      if (nextHost) {
        room.hostId = nextHost.id;
      }
    }
    rebalanceLobbyRoleAssignments(room);
  }
  return room;
}

export function markPlayerDisconnected(
  code: string,
  playerId: string,
  disconnectedUntil?: number,
): Room | null {
  const room = rooms.get(code);
  if (!room) return null;

  const applyDisconnected = (player?: Player) => {
    if (!player) return;
    player.socketId = "";
    if (typeof disconnectedUntil === "number") {
      player.disconnectedUntil = disconnectedUntil;
    } else {
      player.disconnectedUntil = undefined;
    }
  };

  applyDisconnected(room.players.find((p) => p.id === playerId));
  if (room.game) {
    applyDisconnected(room.game.players.find((p) => p.id === playerId));
  }

  return room;
}

export function listPublicMatches(): PublicMatchInfo[] {
  return [...rooms.values()]
    .map((room) => {
      const now = Date.now();
      const hostPlayer =
        room.players.find((p) => p.id === room.hostId) ??
        room.game?.players.find((p: any) => p.id === room.hostId);
      const playerSource = room.game ? room.game.players : room.players;
      const visiblePlayersCount = playerSource.filter((p: any) => {
        const socketId = typeof p?.socketId === "string" ? p.socketId.trim() : "";
        const isConnected = socketId.length > 0;
        const isReconnectable =
          typeof p?.disconnectedUntil === "number" && p.disconnectedUntil > now;
        return (
          (isConnected || isReconnectable) &&
          !p.isBot &&
          !/^бот-\d+$/i.test((p?.name ?? "").trim()) &&
          !socketId.startsWith("bot:")
        );
      }
      ).length;

      return {
        code: room.code,
        roomName: room.roomName,
        modeKey: room.modeKey,
        casePackKey: room.casePackKey,
        visibility: room.visibility,
        hostName: hostPlayer?.name ?? "Host",
        playerCount: visiblePlayersCount,
        maxPlayers: room.maxPlayers,
        started: room.started,
        currentStage: room.game
          ? room.game.stages[room.game.stageIndex] ?? undefined
          : undefined,
        createdAt: room.createdAt,
        venueLabel: room.venueLabel,
        venueUrl: room.venueUrl,
        requiresPassword: !!room.password,
        hostSubscriptionTier: room.hostSubscriptionTier ?? "free",
        isPromoted: !!room.isPromoted,
        __visiblePlayersCount: visiblePlayersCount,
      };
    })
    .filter((match: any) => match.__visiblePlayersCount > 0)
    .map(({ __visiblePlayersCount, ...match }: any) => match)
    .sort((a, b) => {
      if (a.isPromoted !== b.isPromoted) {
        return a.isPromoted ? -1 : 1;
      }
      return b.createdAt - a.createdAt;
    });
}

function isPlayerConnected(player: Player): boolean {
  return typeof player?.socketId === "string" && player.socketId.trim().length > 0;
}

function canStillReconnect(player: Player, nowMs: number): boolean {
  if (isPlayerConnected(player)) return false;
  if (typeof player?.userId === "string" && player.userId.trim().length > 0) {
    return true;
  }
  return (
    typeof player?.disconnectedUntil === "number" &&
    player.disconnectedUntil > nowMs
  );
}

function normalizePlayersForRoom(room: Room, nowMs: number) {
  const shouldKeep = (player: Player) => isPlayerConnected(player) || canStillReconnect(player, nowMs);

  if (!room.game) {
    room.players = room.players.filter(shouldKeep);
  } else {
    const nextLobbyPlayers = room.players.filter(shouldKeep);
    const nextGamePlayers = room.game.players.filter(shouldKeep);
    const keepIds = new Set<string>([
      ...nextLobbyPlayers.map((p) => p.id),
      ...nextGamePlayers.map((p) => p.id),
    ]);
    room.players = room.players.filter((p) => keepIds.has(p.id));
    room.game.players = room.game.players.filter((p) => keepIds.has(p.id));
  }

  const hostStillExists =
    room.players.some((p) => p.id === room.hostId) ||
    !!room.game?.players.some((p) => p.id === room.hostId);
  if (!hostStillExists) {
    const nextHostId = room.players[0]?.id ?? room.game?.players[0]?.id;
    if (nextHostId) {
      room.hostId = nextHostId;
    }
  }
}

export function cleanupStaleRooms(nowMs = Date.now()): number {
  let removedCount = 0;

  for (const [code, room] of rooms.entries()) {
    normalizePlayersForRoom(room, nowMs);

    const roomAgeMs = nowMs - room.createdAt;
    const hardExpired = roomAgeMs > ROOM_HARD_TTL_MS;
    const sourcePlayers = room.game ? room.game.players : room.players;
    const hasConnectedPlayers = sourcePlayers.some((player) => isPlayerConnected(player));
    const hasReconnectWindow = sourcePlayers.some((player) =>
      canStillReconnect(player, nowMs),
    );
    const finishedWithoutPeople = !!room.game?.finished && !hasConnectedPlayers && !hasReconnectWindow;
    const emptyRoom = sourcePlayers.length === 0;
    const disconnectedAndExpired = !hasConnectedPlayers && !hasReconnectWindow;
    const activeMatchWithoutConnectedPlayers =
      !!room.game && !room.game.finished && !hasConnectedPlayers && !hasReconnectWindow;
    const matchExpiresAt =
      room.game && typeof room.game.matchExpiresAt === "number"
        ? room.game.matchExpiresAt
        : room.game
          ? room.createdAt + MATCH_TTL_MS
          : null;
    const matchExpired = matchExpiresAt !== null && nowMs >= matchExpiresAt;

    if (
      hardExpired ||
      finishedWithoutPeople ||
      emptyRoom ||
      disconnectedAndExpired ||
      activeMatchWithoutConnectedPlayers ||
      matchExpired
    ) {
      rooms.delete(code);
      removedCount += 1;
    }
  }

  return removedCount;
}

export function markMissingSocketPlayersDisconnected(
  isSocketAlive: (socketId: string) => boolean,
  nowMs = Date.now(),
  reconnectGraceMs = 30_000,
): number {
  let updatedPlayers = 0;

  const normalizePlayer = (player: Player) => {
    if (player.isBot) return;
    const socketId = player.socketId?.trim() ?? "";
    if (!socketId) return;
    if (isSocketAlive(socketId)) return;

    player.socketId = "";
    if (typeof player.userId === "string" && player.userId.trim().length > 0) {
      player.disconnectedUntil = undefined;
    } else if (
      typeof player.disconnectedUntil !== "number" ||
      player.disconnectedUntil < nowMs
    ) {
      player.disconnectedUntil = nowMs + reconnectGraceMs;
    }
    updatedPlayers += 1;
  };

  for (const room of rooms.values()) {
    room.players.forEach(normalizePlayer);
    room.game?.players.forEach(normalizePlayer);
  }

  return updatedPlayers;
}

export function addLobbyChatMessage(
  code: string,
  senderId: string,
  text: string,
): Room | null {
  const room = rooms.get(code);
  if (!room) return null;
  const sender =
    room.players.find((p) => p.id === senderId) ??
    room.game?.players.find((p: any) => p.id === senderId);
  if (!sender) return null;

  const normalizedText = text.trim().slice(0, 500);
  if (!normalizedText) return room;

  room.lobbyChat.push({
    id: crypto.randomUUID(),
    senderId,
    senderName: sender.name,
    senderAvatar: sender.avatar,
    text: normalizedText,
    createdAt: Date.now(),
  });

  if (room.lobbyChat.length > 120) {
    room.lobbyChat = room.lobbyChat.slice(-120);
  }

  return room;
}

export function updatePlayerProfile(
  code: string,
  playerId: string,
  profile: {
    name?: string;
    avatar?: string | null;
    banner?: string | null;
    selectedBadgeKey?: string | null;
    preferredRole?: AssignableRole | null;
  },
): Room | null {
  const room = rooms.get(code);
  if (!room) return null;

  const normalizedName = profile.name?.trim();
  const normalizedAvatar = profile.avatar || undefined;
  const normalizedBanner = profile.banner || undefined;
  const normalizedBadgeKey = profile.selectedBadgeKey || undefined;
  const normalizedPreferredRole = profile.preferredRole ?? null;
  const hasName = !!normalizedName;
  const hasAvatar = profile.avatar !== undefined;
  const hasBanner = profile.banner !== undefined;
  const hasBadge = profile.selectedBadgeKey !== undefined;
  const hasPreferredRole = profile.preferredRole !== undefined;

  if (!hasName && !hasAvatar && !hasBanner && !hasBadge && !hasPreferredRole) return room;

  const applyProfile = (player: Player) => {
    if (hasName && normalizedName) {
      player.name = normalizedName;
    }
    if (hasAvatar) {
      player.avatar = normalizedAvatar;
    }
    if (hasBanner) {
      player.banner = normalizedBanner;
    }
    if (hasBadge) {
      player.selectedBadgeKey = normalizedBadgeKey;
    }
    if (hasPreferredRole) {
      player.preferredRole = normalizedPreferredRole;
    }
  };

  const lobbyPlayer = room.players.find((p) => p.id === playerId);
  if (lobbyPlayer) {
    applyProfile(lobbyPlayer);
  }

  if (room.game) {
    const gamePlayer = room.game.players.find((p) => p.id === playerId);
    if (gamePlayer) {
      applyProfile(gamePlayer);
    }

    room.game.revealedFacts = room.game.revealedFacts.map((fact) =>
      fact.ownerId === playerId && normalizedName
        ? { ...fact, owner: normalizedName }
        : fact,
    );
    room.game.usedCards = room.game.usedCards.map((card) =>
      card.ownerId === playerId && normalizedName
        ? { ...card, owner: normalizedName }
        : card,
    );
  }

  room.lobbyChat = room.lobbyChat.map((entry) =>
    entry.senderId === playerId
      ? {
          ...entry,
          senderName: normalizedName ?? entry.senderName,
          senderAvatar: hasAvatar ? normalizedAvatar : entry.senderAvatar,
        }
      : entry,
  );

  rebalanceLobbyRoleAssignments(room);

  return room;
}

export function validateLobbyRolesBeforeStart(
  room: Room,
): { ok: true } | { ok: false; reason: string } {
  if (!room.usePreferredRoles) return { ok: true };
  const activePlayers = getActiveLobbyPlayers(room);
  const requiredRoles = getRequiredRolesForRoom(room);
  const assigned = new Map<AssignableRole, string>();
  for (const player of activePlayers) {
    const role = player.lobbyAssignedRole;
    if (!role) continue;
    if (!requiredRoles.includes(role)) {
      return { ok: false, reason: "Назначена роль, недоступная для выбранного режима." };
    }
    if (assigned.has(role)) {
      return { ok: false, reason: "Одна и та же роль назначена нескольким игрокам." };
    }
    assigned.set(role, player.id);
  }
  return { ok: true };
}

export function startGame(
  code: string,
  selectedCase: any,
  mechanicCards: Array<{ name: string; description: string }>,
): Room | null {
  const room = rooms.get(code);
  if (!room) return null;
  if (!selectedCase || typeof selectedCase !== "object") return null;
  if (!Array.isArray(mechanicCards) || mechanicCards.length === 0) return null;
  const mainPlayers = room.players.filter(
    (player) => player.roleKey !== "witness" && player.roleKey !== "observer",
  );
  const lobbyWitnesses = room.players.filter((player) => player.roleKey === "witness");
  const lobbyObservers = room.players.filter((player) => player.roleKey === "observer");

  if (room.modeKey === "quick_flex") {
    if (mainPlayers.length < 3 || mainPlayers.length > room.maxPlayers) {
      return null;
    }
  } else if (mainPlayers.length !== room.maxPlayers) {
    return null;
  }

  const count = mainPlayers.length;
  const baseRoleKeys = roleOrderByCount[count] as AssignableRole[];
  const stages = buildStagesByPlayerCount(count);

  const roleByPlayerId = new Map<string, AssignableRole>();
  const remainingRoles = [...baseRoleKeys];

  mainPlayers.forEach((player) => {
    const role = player.lobbyAssignedRole;
    if (!role) return;
    const idx = remainingRoles.indexOf(role);
    if (idx < 0) return;
    roleByPlayerId.set(player.id, role);
    remainingRoles.splice(idx, 1);
  });

  if (room.isHostJudge) {
    const host = mainPlayers.find((player) => player.id === room.hostId);
    if (host) {
      for (const [playerId, assignedRole] of [...roleByPlayerId.entries()]) {
        if (assignedRole === "judge" && playerId !== host.id) {
          roleByPlayerId.delete(playerId);
        }
      }
      const currentHostRole = roleByPlayerId.get(host.id);
      if (currentHostRole && currentHostRole !== "judge") {
        if (!remainingRoles.includes(currentHostRole)) {
          remainingRoles.push(currentHostRole);
        }
      }
      for (let i = remainingRoles.length - 1; i >= 0; i -= 1) {
        if (remainingRoles[i] === "judge") {
          remainingRoles.splice(i, 1);
        }
      }
      roleByPlayerId.set(host.id, "judge");
    }
  }

  const unassigned = shuffle(mainPlayers.filter((player) => !roleByPlayerId.has(player.id)));
  unassigned.forEach((player, index) => {
    const role = remainingRoles[index];
    if (role) roleByPlayerId.set(player.id, role);
  });

  const assignedPlayers: Player[] = mainPlayers.map((player) => {
    const roleKey = roleByPlayerId.get(player.id) ?? "plaintiff";
    const roleData = selectedCase.roles?.[roleKey];
    const safeFacts = Array.isArray(roleData?.facts)
      ? roleData.facts.filter((item: unknown): item is string => typeof item === "string")
      : [];
    return {
      ...player,
      roleKey,
      roleTitle:
        typeof roleData?.title === "string" && roleData.title.trim()
          ? roleData.title
          : roleKey,
      goal: typeof roleData?.goal === "string" ? roleData.goal : "",
      facts: roleKey === "judge" ? [] : safeFacts.map((text: string, i: number) => ({
        id: `${player.id}-fact-${i}`,
        text,
        revealed: false
      })),
      cards: roleKey === "judge" ? [] : pickRandom(mechanicCards, 3).map((card: any, i: number) => ({
        ...card,
        id: `${player.id}-card-${i}`,
        used: false
      }))
    };
  });
  const witnessPlayers: Player[] = lobbyWitnesses.map((player) => ({
    ...player,
    roleKey: "witness",
    roleTitle: player.roleTitle || "Свидетель",
    goal: "Наблюдать за процессом суда и, по требованию судьи, давать показания.",
    facts: [],
    cards: [],
  }));
  const observerPlayers: Player[] = lobbyObservers.map((player) => ({
    ...player,
    roleKey: "observer",
    roleTitle: "Наблюдатель",
    goal: "Наблюдать за процессом суда без участия в механиках и действиях сторон.",
    facts: [],
    cards: [],
  }));

  room.game = {
    caseData: selectedCase,
    players: [...assignedPlayers, ...witnessPlayers, ...observerPlayers],
    stages,
    stageIndex: 0,
    revealedFacts: [],
    usedCards: [],
    activeProtest: null,
    finished: false,
    verdict: "",
    verdictEvaluation: "",
    verdictCloseAt: null,
    matchStartedAt: Date.now(),
    matchExpiresAt: Date.now() + MATCH_TTL_MS,
    openingSpeechTimerSec: room.openingSpeechTimerSec,
    closingSpeechTimerSec: room.closingSpeechTimerSec,
    protestLimitEnabled: room.protestLimitEnabled,
    maxProtestsPerPlayer: room.maxProtestsPerPlayer,
    protestUsageByPlayer: {},
  };
  room.started = true;
  return room;
}

export function revealFact(code: string, playerId: string, factId: string): Room | null {
  const room = rooms.get(code);
  if (!room?.game) return null;

  const game = room.game;
  const player = game.players.find(p => p.id === playerId);
  if (!player?.facts) return null;

  const fact = player.facts.find(f => f.id === factId);
  if (!fact || fact.revealed) return null;

  fact.revealed = true;

  const alreadyExists = game.revealedFacts.some(f => f.id === factId);
  if (!alreadyExists) {
    game.revealedFacts.push({
      id: factId,
      ownerId: player.id,
      text: fact.text,
      owner: player.name,
      ownerRole: player.roleTitle || "",
      stageIndex: game.stageIndex
    });
  }

  return room;
}

export function useCard(code: string, playerId: string, cardId: string): Room | null {
  const room = rooms.get(code);
  if (!room?.game) return null;

  const game = room.game;
  const player = game.players.find(p => p.id === playerId);
  if (!player?.cards) return null;

  const card = player.cards.find(c => c.id === cardId);
  if (!card || card.used) return null;

  card.used = true;
  game.usedCards.push({
    id: `${cardId}-used-${Date.now()}`,
    ownerId: player.id,
    owner: player.name,
    ownerRole: player.roleTitle || "",
    name: card.name,
    description: card.description
  });

  return room;
}

export function nextStage(code: string): Room | null {
  const room = rooms.get(code);
  if (!room?.game) return null;

  room.game.stageIndex = Math.min(
    room.game.stageIndex + 1,
    room.game.stages.length - 1,
  );
  return room;
}

export function prevStage(code: string): Room | null {
  const room = rooms.get(code);
  if (!room?.game) return null;

  room.game.stageIndex = Math.max(room.game.stageIndex - 1, 0);
  return room;
}

function resolveExpectedVerdictLabel(caseData: any): string {
  const normalize = (value: string | undefined | null): string | null => {
    if (typeof value !== "string") return null;
    const raw = value.trim().toLowerCase().replace(/ё/g, "е");
    if (!raw) return null;

    if (
      raw.includes("not_guilty") ||
      raw.includes("not guilty") ||
      raw.includes("не винов")
    ) {
      return "Не виновен";
    }
    if (
      raw.includes("partial_guilty") ||
      raw.includes("partially guilty") ||
      raw.includes("частично винов")
    ) {
      return "Частично виновен";
    }
    if (raw.includes("guilty") || raw.includes("винов")) {
      return "Виновен";
    }
    return null;
  };

  const explicit = normalize(caseData?.expectedVerdict);
  if (explicit) return explicit;

  const byTruth = normalize(caseData?.truth);
  if (byTruth) return byTruth;

  return "Частично виновен";
}

export function setVerdict(code: string, verdict: string): Room | null {
  const room = rooms.get(code);
  if (!room?.game) return null;

  const expectedVerdict = resolveExpectedVerdictLabel(room.game.caseData);

  const verdictEvaluation =
    verdict === expectedVerdict
      ? `Судья вынес правильный вердикт: ${verdict}.`
      : `Судья ошибся. Правильнее было бы выбрать: ${expectedVerdict}.`;

  room.game.verdict = verdict;
  room.game.verdictEvaluation = verdictEvaluation;
  room.game.finished = true;

  return room;
}




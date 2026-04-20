import { Server as SocketIOServer } from "socket.io";
import type { Server as HttpServer } from "http";
import {
  addLobbyChatMessage,
  createRoom,
  joinRoom,
  joinRoomAsLobbyWitness,
  joinRunningGameAsWitness,
  isJoinPasswordValid,
  rejoinRoom,
  reclaimDisconnectedPlayerByUserId,
  reclaimDisconnectedPlayerByName,
  isNameTaken,
  isNameTakenByOther,
  listPublicMatches,
  markPlayerDisconnected,
  removePlayer,
  startGame,
  revealFact,
  useCard,
  nextStage,
  prevStage,
  setVerdict,
  getRoom,
  deleteRoom,
  setHostJudge,
  setUsePreferredRoles,
  updateRoomManagement,
  transferRoomHost,
  chooseLobbyRole,
  addAdminBotsToRoom,
  listRooms,
  validateLobbyRolesBeforeStart,
  removeDisconnectedLobbyPlayersBeforeStart,
  updatePlayerAvatar,
  updatePlayerProfile,
  cleanupStaleRooms,
  restoreRoomsFromSnapshots,
  markMissingSocketPlayersDisconnected,
  type AssignableRole,
  type CreateRoomOptions,
} from "./roomManager.js";
import {
  getBanMessageForClient,
  getEffectiveBanByUserAndIp,
  getPublicUserProfileById,
  getSubscriptionByUserId,
  getUserByToken,
  recordMatchOutcome,
} from "../lib/authStore.js";
import {
  ensureCasePacksStorage,
  listCasePacks,
  pickCaseForRoom,
} from "../lib/casePacksStore.js";
import {
  ensureMechanicCardsStorage,
  ensureDefaultMechanicCardsSeeded,
  pickMechanicCardsForRoom,
} from "../lib/mechanicCardsStore.js";
import {
  cleanupOldSnapshots,
  deleteRoomSnapshot,
  findBindingByUser,
  loadRoomSnapshots,
  persistRoomSnapshot,
} from "../lib/matchStore.js";
import {
  canAccessCasePack,
  hasCapability,
  getRequiredTierForCasePack,
  normalizeSubscriptionTier,
  SUBSCRIPTION_TIER_ORDER,
  type SubscriptionTier,
} from "../lib/subscriptions.js";

function randomCode(): string {
  return Math.random().toString(36).slice(2, 7).toUpperCase();
}

const usedGuestNumbers = new Set<number>();

function getHigherSubscriptionTier(
  left: SubscriptionTier,
  right: SubscriptionTier,
): SubscriptionTier {
  return SUBSCRIPTION_TIER_ORDER.indexOf(left) >= SUBSCRIPTION_TIER_ORDER.indexOf(right)
    ? left
    : right;
}
const MECHANIC_CARDS_FALLBACK: Array<{ name: string; description: string }> = [
  { name: "Протест", description: "Остановите ход выступления и зафиксируйте спорный момент." },
  { name: "Тишина", description: "На короткое время запретите перебивать и спорить." },
  { name: "Уточнение", description: "Запросите короткий конкретный ответ по сути аргумента." },
];

function pickGuestNumber(existingNames: string[] = []): number {
  const occupied = new Set<number>();
  for (const name of existingNames) {
    const match = /^Гость\s*-\s*(\d+)$/i.exec((name ?? "").trim());
    if (match) {
      occupied.add(Number(match[1]));
    }
  }

  for (let i = 0; i < 20000; i += 1) {
    const next = Math.floor(10000 + Math.random() * 90000);
    if (!usedGuestNumbers.has(next) && !occupied.has(next)) {
      usedGuestNumbers.add(next);
      return next;
    }
  }
  const fallback = Date.now() % 100000;
  usedGuestNumbers.add(fallback);
  return fallback;
}

function createGuestName(existingNames: string[] = []): string {
  return `Гость-${pickGuestNumber(existingNames)}`;
}

const PREPARATION_STAGE_MARKER = "подготов";
const CROSS_EXAMINATION_STAGE_MARKERS = ["перекрест", "допрос"];
const OPENING_STAGE_MARKERS = ["выступлен", "вступительн"];
const CLOSING_STAGE_MARKERS = ["финальн", "заключительн"];
const RECONNECT_GRACE_MS = 30_000;
const VERDICT_ROOM_CLOSE_MS = 30_000;
const PROTEST_COOLDOWN_MS = 30_000;
const JUDGE_SILENCE_COOLDOWN_MS = 15_000;
const INFLUENCE_ANNOUNCEMENT_DURATION_MS = 3_000;
const SINGLETON_MATCH_CLOSE_MS = 5 * 60 * 1000;
type SpeechOwnerRole =
  | "plaintiff"
  | "defendant"
  | "plaintiffLawyer"
  | "defenseLawyer"
  | "prosecutor";

type CanonicalRole =
  | "plaintiff"
  | "defendant"
  | "plaintiffLawyer"
  | "defenseLawyer"
  | "prosecutor"
  | "judge"
  | "witness"
  | "observer";

function resolveExpectedVerdictFromTruth(truthRaw: string | undefined): string {
  const truth = (truthRaw ?? "").toLowerCase().replace(/ё/g, "е");
  if (truth.includes("не винов") || truth.includes("не виноват")) {
    return "Не виновен";
  }
  if (truth.includes("частично винов")) {
    return "Частично виновен";
  }
  return "Виновен";
}

function normalizeRoleKey(roleKey: string | undefined): CanonicalRole | null {
  if (!roleKey) return null;
  const normalized = roleKey.trim();
  const compact = normalized.replace(/[^a-zA-Zа-яА-ЯёЁ]/g, "").toLowerCase();
  const alias: Record<string, CanonicalRole> = {
    plaintiff: "plaintiff",
    defendant: "defendant",
    plaintiffLawyer: "plaintiffLawyer",
    defenseLawyer: "defenseLawyer",
    defendantLawyer: "defenseLawyer",
    prosecutor: "prosecutor",
    judge: "judge",
    witness: "witness",
    observer: "observer",
    plaintifflawyer: "plaintiffLawyer",
    defenselawyer: "defenseLawyer",
    defendantlawyer: "defenseLawyer",
    istets: "plaintiff",
    otvetchik: "defendant",
    prokuror: "prosecutor",
    sudya: "judge",
    svidetel: "witness",
    nablyudatel: "observer",
    истец: "plaintiff",
    ответчик: "defendant",
    прокурор: "prosecutor",
    судья: "judge",
    свидетель: "witness",
    наблюдатель: "observer",
    адвокатистца: "plaintiffLawyer",
    адвокатответчика: "defenseLawyer",
  };
  return alias[normalized] ?? alias[compact] ?? null;
}

function resolveLawyerPartnerRole(role: CanonicalRole | null): CanonicalRole | null {
  if (!role) return null;
  if (role === "plaintiff") return "plaintiffLawyer";
  if (role === "plaintiffLawyer") return "plaintiff";
  if (role === "defendant") return "defenseLawyer";
  if (role === "defenseLawyer") return "defendant";
  return null;
}

function normalizeStageName(stageName: string): string {
  return stageName.toLowerCase().replace(/ё/g, "е").trim();
}

function stageIncludesAll(normalizedStageName: string, markers: string[]): boolean {
  return markers.every((marker) => normalizedStageName.includes(marker));
}

function isPreparationStage(stageName: string): boolean {
  const normalizedStageName = normalizeStageName(stageName);
  return normalizedStageName.includes(PREPARATION_STAGE_MARKER);
}

function getCurrentStageName(stages: string[] | undefined, stageIndex: number): string {
  if (!stages || stages.length === 0) return "";
  return stages[stageIndex] ?? "";
}

function isCrossExaminationStage(stageName: string): boolean {
  const normalizedStageName = normalizeStageName(stageName);
  return stageIncludesAll(normalizedStageName, CROSS_EXAMINATION_STAGE_MARKERS);
}

function isOpeningSpeechStage(stageName: string): boolean {
  const normalizedStageName = normalizeStageName(stageName);
  return OPENING_STAGE_MARKERS.some((marker) =>
    normalizedStageName.includes(marker),
  );
}

function isClosingSpeechStage(stageName: string): boolean {
  const normalizedStageName = normalizeStageName(stageName);
  return CLOSING_STAGE_MARKERS.some((marker) =>
    normalizedStageName.includes(marker),
  );
}

function resolveSpeechOwnerRole(stageName: string): SpeechOwnerRole | null {
  const normalizedStageName = normalizeStageName(stageName);
  if (!normalizedStageName) return null;
  const hasLawyer = normalizedStageName.includes("адвокат");
  const hasPlaintiff = normalizedStageName.includes("истц");
  const hasDefendant = normalizedStageName.includes("ответч");
  const hasProsecutor = normalizedStageName.includes("прокурор");

  if (hasLawyer && hasPlaintiff) return "plaintiffLawyer";
  if (hasLawyer && hasDefendant) return "defenseLawyer";
  if (hasProsecutor) return "prosecutor";
  if (hasPlaintiff) return "plaintiff";
  if (hasDefendant) return "defendant";

  return null;
}

function isRoleSpeechStage(roleKey: string | undefined, stageName: string): boolean {
  if (!roleKey || !stageName) return false;

  const canonicalRole = normalizeRoleKey(roleKey);
  if (!canonicalRole) return false;
  const speechOwnerRole = resolveSpeechOwnerRole(stageName);
  if (!speechOwnerRole || speechOwnerRole !== canonicalRole) return false;

  const isOpeningStage = isOpeningSpeechStage(stageName);
  const isClosingStage = isClosingSpeechStage(stageName);
  return isOpeningStage || isClosingStage;
}

function isRoleOpeningSpeechStage(roleKey: string | undefined, stageName: string): boolean {
  if (!roleKey || !stageName) return false;
  const canonicalRole = normalizeRoleKey(roleKey);
  if (!canonicalRole) return false;
  const speechOwnerRole = resolveSpeechOwnerRole(stageName);
  return !!speechOwnerRole && speechOwnerRole === canonicalRole && isOpeningSpeechStage(stageName);
}

function canRoleRevealFactsAtStage(roleKey: string | undefined, stageName: string): boolean {
  if (isCrossExaminationStage(stageName)) return true;
  return isRoleSpeechStage(roleKey, stageName);
}

function canPlayerRevealFactNow(room: any, playerId: string): boolean {
  if (!room?.game) return false;

  const currentStageName = getCurrentStageName(
    room.game.stages,
    room.game.stageIndex,
  );
  if (isPreparationStage(currentStageName)) return false;

  const currentPlayer = room.game.players.find((p: any) => p.id === playerId);
  if (!currentPlayer) return false;

  if (!canRoleRevealFactsAtStage(currentPlayer.roleKey, currentStageName)) {
    return false;
  }

  const isCurrentPlayerOpeningSpeech = isRoleOpeningSpeechStage(
    currentPlayer.roleKey,
    currentStageName,
  );
  if (!isCurrentPlayerOpeningSpeech) return true;

  const revealedFactsOnThisOpeningStage = room.game.revealedFacts.filter(
    (fact: any) =>
      fact.ownerId === playerId && fact.stageIndex === room.game.stageIndex,
  ).length;
  return revealedFactsOnThisOpeningStage < 2;
}

function emitFactRevealPermissions(io: SocketIOServer, room: any) {
  if (!room?.game) return;

  room.game.players.forEach((player: any) => {
    if (!player.socketId) return;
    io.to(player.socketId).emit("fact_reveal_permission", {
      canRevealFactsNow: canPlayerRevealFactNow(room, player.id),
    });
  });
}
function mapGamePlayers(players: any[]) {
  const now = Date.now();
  return players
    .filter((p: any) => {
      const connected =
        typeof p?.socketId === "string" && p.socketId.trim().length > 0;
      if (connected) return true;
      return (
        typeof p?.disconnectedUntil === "number" && p.disconnectedUntil > now
      );
    })
    .map((p: any) => ({
    id: p.id,
    userId: p.userId ?? undefined,
    subscriptionTier:
      p?.subscriptionTier === "trainee" ||
      p?.subscriptionTier === "practitioner" ||
      p?.subscriptionTier === "arbiter"
        ? p.subscriptionTier
        : undefined,
    name: p.name,
    isBot: !!p.isBot,
    avatar: p.avatar,
    banner: p.banner,
    selectedBadgeKey: p.selectedBadgeKey ?? undefined,
    preferredRole:
      typeof p?.preferredRole === "string" ? p.preferredRole : null,
    lobbyAssignedRole:
      typeof p?.lobbyAssignedRole === "string" ? p.lobbyAssignedRole : null,
    roleAssignmentSource:
      p?.roleAssignmentSource === "auto_preference" ||
      p?.roleAssignmentSource === "manual" ||
      p?.roleAssignmentSource === "random"
        ? p.roleAssignmentSource
        : null,
    rolePreferenceStatus:
      p?.rolePreferenceStatus === "idle" ||
      p?.rolePreferenceStatus === "assigned" ||
      p?.rolePreferenceStatus === "conflict" ||
      p?.rolePreferenceStatus === "unavailable"
        ? p.rolePreferenceStatus
        : "idle",
    roleKey: p.roleKey,
    roleTitle: p.roleTitle,
    warningCount: typeof p?.warningCount === "number" ? p.warningCount : 0,
    disconnectedUntil:
      typeof p?.disconnectedUntil === "number" ? p.disconnectedUntil : undefined,
    }));
}

function mapLobbyPlayers(players: any[]) {
  return players
    .map((p: any) => ({
    id: p.id,
    userId: p.userId ?? undefined,
    subscriptionTier:
      p?.subscriptionTier === "trainee" ||
      p?.subscriptionTier === "practitioner" ||
      p?.subscriptionTier === "arbiter"
        ? p.subscriptionTier
        : undefined,
    name: p.name,
    isBot: !!p.isBot,
    avatar: p.avatar,
    banner: p.banner,
    selectedBadgeKey: p.selectedBadgeKey ?? undefined,
    preferredRole:
      typeof p?.preferredRole === "string" ? p.preferredRole : null,
    lobbyAssignedRole:
      typeof p?.lobbyAssignedRole === "string" ? p.lobbyAssignedRole : null,
    roleAssignmentSource:
      p?.roleAssignmentSource === "auto_preference" ||
      p?.roleAssignmentSource === "manual" ||
      p?.roleAssignmentSource === "random"
        ? p.roleAssignmentSource
        : null,
    rolePreferenceStatus:
      p?.rolePreferenceStatus === "idle" ||
      p?.rolePreferenceStatus === "assigned" ||
      p?.rolePreferenceStatus === "conflict" ||
      p?.rolePreferenceStatus === "unavailable"
        ? p.rolePreferenceStatus
        : "idle",
    roleKey: p.roleKey ?? undefined,
    roleTitle: p.roleTitle ?? undefined,
    warningCount: typeof p?.warningCount === "number" ? p.warningCount : 0,
    disconnectedUntil:
      typeof p?.disconnectedUntil === "number" ? p.disconnectedUntil : undefined,
    }));
}

function getSubscriptionTierLabel(tier: SubscriptionTier): string {
  if (tier === "trainee") return "Стажер";
  if (tier === "practitioner") return "Практик";
  if (tier === "arbiter") return "Арбитр";
  return "Бесплатно";
}

function isAnimatedProfileMedia(value: string | null | undefined): boolean {
  if (!value || typeof value !== "string") return false;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return false;
  if (trimmed.startsWith("cgif1:")) return true;
  if (trimmed.startsWith("data:image/gif")) return true;
  if (trimmed.includes(".gif")) return true;
  return false;
}

function sanitizeProfileMediaByTier(
  tier: SubscriptionTier,
  profile: { avatar?: string | null; banner?: string | null },
): { avatar?: string; banner?: string } {
  const canBanner = hasCapability(tier, "canUseProfileBanner");
  const canAnimated = hasCapability(tier, "canUseAnimatedProfileMedia");
  const safeAvatar =
    typeof profile.avatar === "string" && profile.avatar.trim()
      ? profile.avatar
      : undefined;
  let safeBanner =
    typeof profile.banner === "string" && profile.banner.trim()
      ? profile.banner
      : undefined;

  if (!canBanner) {
    safeBanner = undefined;
  }
  if (!canAnimated) {
    if (isAnimatedProfileMedia(safeAvatar)) {
      return { avatar: undefined, banner: safeBanner && !isAnimatedProfileMedia(safeBanner) ? safeBanner : undefined };
    }
    if (safeBanner && isAnimatedProfileMedia(safeBanner)) {
      safeBanner = undefined;
    }
  }
  return {
    avatar: safeAvatar,
    banner: safeBanner,
  };
}

function getPackAccessFailureMessage(pack: { key?: string; title?: string; isAdult?: boolean }, tier: SubscriptionTier): string | null {
  if (canAccessCasePack(tier, pack)) return null;
  const requiredTier = getRequiredTierForCasePack(pack);
  return `Этот пак доступен с подписки «${getSubscriptionTierLabel(requiredTier)}».`;
}

interface LawyerChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: number;
}

function getRoomState(room: any, playerId: string) {
  if (!room.game) {
    return {
      type: "room",
      code: room.code,
      roomName: room.roomName,
      modeKey: room.modeKey,
      casePackKey: room.casePackKey,
      maxPlayers: room.maxPlayers,
      hostId: room.hostId,
      players: mapLobbyPlayers(room.players),
      started: room.started,
      isHostJudge: room.isHostJudge,
      usePreferredRoles: !!room.usePreferredRoles,
      allowWitnesses: room.allowWitnesses !== false,
      maxObservers: typeof room.maxObservers === "number" ? room.maxObservers : 6,
      openingSpeechTimerSec:
        typeof room.openingSpeechTimerSec === "number" ? room.openingSpeechTimerSec : null,
      closingSpeechTimerSec:
        typeof room.closingSpeechTimerSec === "number" ? room.closingSpeechTimerSec : null,
      protestLimitEnabled: !!room.protestLimitEnabled,
      maxProtestsPerPlayer:
        typeof room.maxProtestsPerPlayer === "number" ? room.maxProtestsPerPlayer : null,
      visibility: room.visibility,
      hostSubscriptionTier: room.hostSubscriptionTier ?? "free",
      isPromoted: !!room.isPromoted,
      venueLabel: room.venueLabel,
      venueUrl: room.venueUrl,
      requiresPassword: !!room.password,
      lobbyChat: room.lobbyChat,
    };
  }

  const myPlayer = room.game.players.find((p: any) => p.id === playerId);

  return {
    type: "game",
    code: room.code,
    roomName: room.roomName,
    casePackKey: room.casePackKey,
    venueUrl: room.venueUrl,
    hostId: room.hostId,
    caseData: room.game.caseData,
    stages: room.game.stages,
    stageIndex: room.game.stageIndex,
    revealedFacts: room.game.revealedFacts,
    usedCards: room.game.usedCards,
    activeProtest: room.game.activeProtest ?? null,
    finished: room.game.finished,
    verdict: room.game.verdict,
    verdictEvaluation: room.game.verdictEvaluation,
    verdictCloseAt:
      typeof room.game.verdictCloseAt === "number"
        ? room.game.verdictCloseAt
        : null,
    matchExpiresAt:
      typeof room.game.matchExpiresAt === "number"
        ? room.game.matchExpiresAt
        : null,
    openingSpeechTimerSec:
      typeof room.game.openingSpeechTimerSec === "number" ? room.game.openingSpeechTimerSec : null,
    closingSpeechTimerSec:
      typeof room.game.closingSpeechTimerSec === "number" ? room.game.closingSpeechTimerSec : null,
    protestLimitEnabled: !!room.game.protestLimitEnabled,
    maxProtestsPerPlayer:
      typeof room.game.maxProtestsPerPlayer === "number" ? room.game.maxProtestsPerPlayer : null,
    hostSubscriptionTier: room.hostSubscriptionTier ?? "free",
    isPromoted: !!room.isPromoted,
    players: mapGamePlayers(room.game.players),
    me: myPlayer ? {
      id: myPlayer.id,
      userId: myPlayer.userId ?? undefined,
      name: myPlayer.name,
      avatar: myPlayer.avatar,
      banner: myPlayer.banner,
      roleKey: myPlayer.roleKey,
      roleTitle: myPlayer.roleTitle,
      goal: myPlayer.goal,
      facts: myPlayer.facts,
      cards: myPlayer.cards,
      canRevealFactsNow: canPlayerRevealFactNow(room, playerId),
    } : null
  };
}

function emitPublicMatches(io: SocketIOServer) {
  io.emit("public_matches_updated", {
    matches: listPublicMatches(),
  });
}

let liveIoServer: SocketIOServer | null = null;

export function syncUserProfileInActiveRooms(input: {
  userId: string;
  nickname: string;
  avatar?: string | null;
  banner?: string | null;
}): number {
  const io = liveIoServer;
  const normalizedUserId = String(input.userId ?? "").trim();
  if (!io || !normalizedUserId) return 0;

  let touchedRooms = 0;
  for (const room of listRooms()) {
    const playerIds = new Set<string>();
    room.players.forEach((player: any) => {
      if (typeof player?.userId === "string" && player.userId.trim() === normalizedUserId) {
        playerIds.add(player.id);
      }
    });
    room.game?.players?.forEach((player: any) => {
      if (typeof player?.userId === "string" && player.userId.trim() === normalizedUserId) {
        playerIds.add(player.id);
      }
    });
    if (playerIds.size === 0) continue;

    let updatedRoom: any = null;
    playerIds.forEach((playerId) => {
      const next = updatePlayerProfile(room.code, playerId, {
        name: input.nickname,
        avatar: input.avatar ?? null,
        banner: input.banner ?? null,
      });
      if (next) updatedRoom = next;
    });
    if (!updatedRoom) continue;
    touchedRooms += 1;

    if (updatedRoom.game) {
      updatedRoom.game.players.forEach((player: any) => {
        if (!player.socketId) return;
        io.to(player.socketId).emit("game_profile_updated", {
          players: mapGamePlayers(updatedRoom.game.players),
          revealedFacts: updatedRoom.game.revealedFacts,
          usedCards: updatedRoom.game.usedCards,
        });
      });
    }

    io.to(room.code).emit("room_updated", buildRoomUpdatePayload(updatedRoom));
    io.to(room.code).emit("lobby_chat_updated", {
      messages: updatedRoom.lobbyChat,
    });
  }

  if (touchedRooms > 0) {
    emitPublicMatches(io);
  }

  return touchedRooms;
}

function buildRoomUpdatePayload(room: any) {
  return {
    players: mapLobbyPlayers(room.players),
    hostId: room.hostId,
    roomName: room.roomName,
    modeKey: room.modeKey,
    casePackKey: room.casePackKey,
    maxPlayers: room.maxPlayers,
    isHostJudge: room.isHostJudge,
    usePreferredRoles: !!room.usePreferredRoles,
    allowWitnesses: room.allowWitnesses !== false,
    maxObservers: typeof room.maxObservers === "number" ? room.maxObservers : 6,
    openingSpeechTimerSec:
      typeof room.openingSpeechTimerSec === "number" ? room.openingSpeechTimerSec : null,
    closingSpeechTimerSec:
      typeof room.closingSpeechTimerSec === "number" ? room.closingSpeechTimerSec : null,
    protestLimitEnabled: !!room.protestLimitEnabled,
    maxProtestsPerPlayer:
      typeof room.maxProtestsPerPlayer === "number" ? room.maxProtestsPerPlayer : null,
    visibility: room.visibility,
    hostSubscriptionTier: room.hostSubscriptionTier ?? "free",
    isPromoted: !!room.isPromoted,
    venueLabel: room.venueLabel,
    venueUrl: room.venueUrl,
    requiresPassword: !!room.password,
    lobbyChat: room.lobbyChat,
  };
}

export function setupSocket(httpServer: HttpServer) {
  const io = new SocketIOServer(httpServer, {
    cors: { origin: "*" },
    path: "/api/socket.io",
    maxHttpBufferSize: 20 * 1024 * 1024,
  });
  liveIoServer = io;

  const socketToRoom = new Map<
    string,
    { roomCode: string; playerId: string; sessionToken: string }
  >();
  const socketIpById = new Map<string, string>();
  const forcedNoRejoinDisconnect = new Set<string>();
  const createRoomInFlight = new Set<string>();
  const reconnectCleanupTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const verdictRoomCloseTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const singletonMatchSinceByRoom = new Map<string, number>();
  const actionCooldowns = new Map<string, number>();
  const lawyerChats = new Map<string, LawyerChatMessage[]>();
  const normalizeRoomCode = (code: string): string => code.trim().toUpperCase();
  const getReconnectKey = (roomCode: string, playerId: string) =>
    `${roomCode}:${playerId}`;
  const getActionCooldownKey = (
    roomCode: string,
    playerId: string,
    action: "protest" | "silence" | "warning",
  ) => `${roomCode}:${playerId}:${action}`;
  const getLawyerChatKey = (roomCode: string, firstId: string, secondId: string) => {
    const sorted = [firstId, secondId].sort();
    return `${roomCode}:${sorted[0]}:${sorted[1]}`;
  };

  const cleanupRoomCaches = (roomCode: string) => {
    singletonMatchSinceByRoom.delete(roomCode);
    [...actionCooldowns.keys()]
      .filter((key) => key.startsWith(`${roomCode}:`))
      .forEach((key) => actionCooldowns.delete(key));
    [...lawyerChats.keys()]
      .filter((key) => key.startsWith(`${roomCode}:`))
      .forEach((key) => lawyerChats.delete(key));
    [...reconnectCleanupTimers.keys()]
      .filter((key) => key.startsWith(`${roomCode}:`))
      .forEach((key) => {
        const timeout = reconnectCleanupTimers.get(key);
        if (timeout) {
          clearTimeout(timeout);
        }
        reconnectCleanupTimers.delete(key);
      });
    const verdictTimer = verdictRoomCloseTimers.get(roomCode);
    if (verdictTimer) {
      clearTimeout(verdictTimer);
      verdictRoomCloseTimers.delete(roomCode);
    }
    [...socketToRoom.entries()]
      .filter(([, info]) => info.roomCode === roomCode)
      .forEach(([socketId]) => socketToRoom.delete(socketId));
    deleteRoomSnapshot(roomCode).catch(() => undefined);
  };

  const persistRoom = (roomCode: string) => {
    const room = getRoom(roomCode);
    if (!room) {
      deleteRoomSnapshot(roomCode).catch(() => undefined);
      return;
    }
    persistRoomSnapshot(room).catch(() => undefined);
  };

  void (async () => {
    try {
      await ensureCasePacksStorage();
      await ensureMechanicCardsStorage();
      await ensureDefaultMechanicCardsSeeded();
    } catch (error) {
      console.error("content bootstrap failed", error);
    }
  })();

  void (async () => {
    try {
      const snapshots = await loadRoomSnapshots(500);
      const restored = restoreRoomsFromSnapshots(snapshots);
      if (restored > 0) {
        emitPublicMatches(io);
      }
    } catch {
      // noop: app continues with in-memory only rooms
    }
  })();

  const emitProtestState = (roomCode: string, room?: any) => {
    const targetRoom = room ?? getRoom(roomCode);
    io.to(roomCode).emit("protest_state_updated", {
      activeProtest: targetRoom?.game?.activeProtest ?? null,
    });
  };

  const resolveLawyerPair = (room: any, playerId: string) => {
    if (!room?.game) return null;
    const self = room.game.players.find((p: any) => p.id === playerId);
    if (!self) return null;
    const partnerRole = resolveLawyerPartnerRole(normalizeRoleKey(self.roleKey));
    if (!partnerRole) return null;

    const partner = room.game.players.find(
      (p: any) => p.id !== playerId && normalizeRoleKey(p.roleKey) === partnerRole,
    );
    if (!partner) return null;

    return {
      self,
      partner,
      chatKey: getLawyerChatKey(room.code, self.id, partner.id),
    };
  };

  const emitLawyerChatStateToSocket = (socketId: string, roomCode: string, playerId: string) => {
    const room = getRoom(roomCode);
    if (!room?.game) {
      io.to(socketId).emit("lawyer_chat_state", {
        enabled: false,
        partner: null,
        messages: [],
      });
      return;
    }
    const pair = resolveLawyerPair(room, playerId);
    if (!pair) {
      io.to(socketId).emit("lawyer_chat_state", {
        enabled: false,
        partner: null,
        messages: [],
      });
      return;
    }

    io.to(socketId).emit("lawyer_chat_state", {
      enabled: true,
      partner: {
        id: pair.partner.id,
        name: pair.partner.name,
        roleTitle: pair.partner.roleTitle,
      },
      messages: lawyerChats.get(pair.chatKey) ?? [],
    });
  };

  const applyWarningToPlayer = (roomCode: string, targetPlayerId: string) => {
    const room = getRoom(roomCode);
    if (!room?.game) return null;

    const gameTarget = room.game.players.find((p: any) => p.id === targetPlayerId);
    if (!gameTarget) return null;
    const currentWarnings =
      typeof gameTarget.warningCount === "number" ? gameTarget.warningCount : 0;
    if (currentWarnings >= 3) {
      return { room, warningCount: currentWarnings, changed: false };
    }

    gameTarget.warningCount = currentWarnings + 1;
    const lobbyTarget = room.players.find((p: any) => p.id === targetPlayerId);
    if (lobbyTarget) {
      lobbyTarget.warningCount = gameTarget.warningCount;
    }

    return { room, warningCount: gameTarget.warningCount, changed: true };
  };

  const removeWarningFromPlayer = (roomCode: string, targetPlayerId: string) => {
    const room = getRoom(roomCode);
    if (!room?.game) return null;

    const gameTarget = room.game.players.find((p: any) => p.id === targetPlayerId);
    if (!gameTarget) return null;
    const currentWarnings =
      typeof gameTarget.warningCount === "number" ? gameTarget.warningCount : 0;
    if (currentWarnings <= 0) {
      return { room, warningCount: currentWarnings, changed: false };
    }

    gameTarget.warningCount = currentWarnings - 1;
    const lobbyTarget = room.players.find((p: any) => p.id === targetPlayerId);
    if (lobbyTarget) {
      lobbyTarget.warningCount = gameTarget.warningCount;
    }

    return { room, warningCount: gameTarget.warningCount, changed: true };
  };

  const clearReconnectCleanup = (roomCode: string, playerId: string) => {
    const key = getReconnectKey(roomCode, playerId);
    const timeout = reconnectCleanupTimers.get(key);
    if (timeout) {
      clearTimeout(timeout);
      reconnectCleanupTimers.delete(key);
    }
  };

  const cleanupDanglingRoomCaches = () => {
    const roomCodes = new Set<string>();
    [...actionCooldowns.keys()].forEach((key) => roomCodes.add(key.split(":")[0]));
    [...lawyerChats.keys()].forEach((key) => roomCodes.add(key.split(":")[0]));
    [...reconnectCleanupTimers.keys()].forEach((key) =>
      roomCodes.add(key.split(":")[0]),
    );
    [...verdictRoomCloseTimers.keys()].forEach((code) => roomCodes.add(code));
    [...socketToRoom.values()].forEach((entry) => roomCodes.add(entry.roomCode));

    roomCodes.forEach((roomCode) => {
      if (!getRoom(roomCode)) {
        cleanupRoomCaches(roomCode);
      }
    });
  };

  const clearVerdictRoomClose = (roomCode: string) => {
    const timeout = verdictRoomCloseTimers.get(roomCode);
    if (timeout) {
      clearTimeout(timeout);
      verdictRoomCloseTimers.delete(roomCode);
    }
  };

  const closeRoomAndNotify = (roomCode: string, message: string) => {
    const room = getRoom(roomCode);
    if (!room) {
      cleanupRoomCaches(roomCode);
      emitPublicMatches(io);
      return;
    }

    io.to(roomCode).emit("room_closed", {
      code: roomCode,
      message,
    });

    const players = room.game?.players ?? room.players;
    players.forEach((player: any) => clearReconnectCleanup(roomCode, player.id));

    io.in(roomCode).socketsLeave(roomCode);
    deleteRoom(roomCode);
    cleanupRoomCaches(roomCode);
    emitPublicMatches(io);
    deleteRoomSnapshot(roomCode).catch(() => undefined);
  };

  const scheduleVerdictRoomClose = (roomCode: string) => {
    clearVerdictRoomClose(roomCode);
    const timeout = setTimeout(() => {
      verdictRoomCloseTimers.delete(roomCode);
      const room = getRoom(roomCode);
      if (!room?.game?.finished) return;
      closeRoomAndNotify(
        roomCode,
        "Матч завершён. Комната автоматически закрыта через 30 секунд.",
      );
    }, VERDICT_ROOM_CLOSE_MS);
    verdictRoomCloseTimers.set(roomCode, timeout);
  };

  const emitRoomSnapshot = (roomCode: string) => {
    const room = getRoom(roomCode);
    if (!room) {
      cleanupRoomCaches(roomCode);
      emitPublicMatches(io);
      return;
    }

    if (room.game) {
      io.to(roomCode).emit("game_players_updated", {
        players: mapGamePlayers(room.game.players),
      });
    } else {
      io.to(roomCode).emit("room_updated", buildRoomUpdatePayload(room));
    }
    emitPublicMatches(io);
    persistRoom(roomCode);
  };

  const scheduleReconnectCleanup = (roomCode: string, playerId: string) => {
    clearReconnectCleanup(roomCode, playerId);
    const key = getReconnectKey(roomCode, playerId);
    const timeout = setTimeout(() => {
      reconnectCleanupTimers.delete(key);
      const room = getRoom(roomCode);
      if (!room) return;

      const now = Date.now();
      const player =
        room.players.find((p: any) => p.id === playerId) ??
        room.game?.players.find((p: any) => p.id === playerId);
      if (!player) return;
      if (typeof player.userId === "string" && player.userId.trim().length > 0) {
        return;
      }
      if (player.socketId && player.socketId.trim().length > 0) return;
      if (
        typeof player.disconnectedUntil === "number" &&
        player.disconnectedUntil > now
      ) {
        scheduleReconnectCleanup(roomCode, playerId);
        return;
      }

      removePlayer(roomCode, playerId);
      emitRoomSnapshot(roomCode);
    }, RECONNECT_GRACE_MS + 150);
    reconnectCleanupTimers.set(key, timeout);
  };

  const findPlayerBySessionToken = (room: any, sessionToken: string) => {
    const token = sessionToken.trim();
    if (!token) return null;
    return (
      room?.game?.players?.find((p: any) => p.sessionToken === token) ??
      room?.players?.find((p: any) => p.sessionToken === token) ??
      null
    );
  };

  const resolveActorId = ({
    socketId,
    roomCode,
    room,
    sessionToken,
  }: {
    socketId: string;
    roomCode: string;
    room: any;
    sessionToken?: string;
  }): string | null => {
    const socketInfo = socketToRoom.get(socketId);
    if (!socketInfo || socketInfo.roomCode !== roomCode) {
      return null;
    }

    if (sessionToken) {
      const tokenPlayer = findPlayerBySessionToken(room, sessionToken);
      if (!tokenPlayer) return null;
      return tokenPlayer.id;
    }

    return socketInfo.playerId;
  };

  const resolveSocketIp = (headers: Record<string, unknown>, fallback?: string | null): string => {
    const forwarded = headers["x-forwarded-for"];
    if (typeof forwarded === "string" && forwarded.trim()) {
      return forwarded.split(",")[0]?.trim() ?? "";
    }
    if (Array.isArray(forwarded) && forwarded.length > 0) {
      return String(forwarded[0] ?? "").trim();
    }
    return String(fallback ?? "").trim();
  };

  const resolveRealtimeBan = async (input: {
    userId?: string | null;
    socketIp?: string | null;
  }) => {
    return getEffectiveBanByUserAndIp({
      userId: input.userId ?? null,
      ip: input.socketIp ?? null,
    });
  };

  const isCreatorAdmin = async (
    authToken?: string,
    adminKey?: string,
    socketIp?: string,
  ): Promise<boolean> => {
    const requiredAdminKey = String(
      process.env.ADMIN_PANEL_KEY ?? process.env.admin_panel_key ?? "",
    ).trim();
    const providedAdminKey = typeof adminKey === "string" ? adminKey.trim() : "";
    if (requiredAdminKey && providedAdminKey && providedAdminKey === requiredAdminKey) {
      return true;
    }

    const token = typeof authToken === "string" ? authToken.trim() : "";
    if (!token) return false;
    const user = await getUserByToken(token, socketIp ?? null);
    if (!user) return false;
    if (user.ban?.isBanned) return false;
    const adminLogin = String(process.env.ADMIN_PANEL_LOGIN ?? "berly").trim().toLowerCase();
    if (user.login.trim().toLowerCase() !== adminLogin) return false;
    const requiredAdminUserId = String(process.env.ADMIN_USER_ID ?? "").trim();
    if (requiredAdminUserId && user.id !== requiredAdminUserId) return false;
    return true;
  };

  const closeSingletonRunningMatches = () => {
    const nowMs = Date.now();
    const rooms = listRooms();
    for (const room of rooms) {
      if (!room.game || room.game.finished) {
        singletonMatchSinceByRoom.delete(room.code);
        continue;
      }
      const connectedMainPlayers = room.game.players.filter((player: any) => {
        if (player?.roleKey === "observer") return false;
        return typeof player?.socketId === "string" && player.socketId.trim().length > 0;
      }).length;
      if (connectedMainPlayers !== 1) {
        singletonMatchSinceByRoom.delete(room.code);
        continue;
      }
      const since = singletonMatchSinceByRoom.get(room.code) ?? nowMs;
      if (!singletonMatchSinceByRoom.has(room.code)) {
        singletonMatchSinceByRoom.set(room.code, since);
      }
      if (nowMs - since >= SINGLETON_MATCH_CLOSE_MS) {
        singletonMatchSinceByRoom.delete(room.code);
        closeRoomAndNotify(
          room.code,
          "Матч закрыт автоматически: в игре остался только один игрок более 5 минут.",
        );
      }
    }
  };

  setInterval(() => {
    markMissingSocketPlayersDisconnected((socketId) => io.sockets.sockets.has(socketId));
    const removed = cleanupStaleRooms();
    cleanupOldSnapshots(72).catch(() => undefined);
    cleanupDanglingRoomCaches();
    closeSingletonRunningMatches();
    if (removed > 0) {
      emitPublicMatches(io);
    }
  }, 10_000);

  const disconnectBannedSockets = async () => {
    for (const [socketId, info] of socketToRoom.entries()) {
      const socketRef = io.sockets.sockets.get(socketId);
      if (!socketRef) {
        socketIpById.delete(socketId);
        continue;
      }
      const room = getRoom(info.roomCode);
      if (!room) continue;
      const lobbyPlayer = room.players.find((player: any) => player.id === info.playerId);
      const gamePlayer = room.game?.players.find((player: any) => player.id === info.playerId);
      const currentPlayer = lobbyPlayer ?? gamePlayer;
      if (!currentPlayer) continue;

      const socketIp = socketIpById.get(socketId) ?? "";
      const effectiveBan = await resolveRealtimeBan({
        userId: currentPlayer.userId ?? null,
        socketIp,
      });
      if (!effectiveBan.isBanned) continue;

      forcedNoRejoinDisconnect.add(socketId);
      socketRef.emit("kicked", {
        message: getBanMessageForClient(effectiveBan),
      });
      socketRef.disconnect(true);
    }
  };

  setInterval(() => {
    void disconnectBannedSockets().catch((error) => {
      console.error("disconnectBannedSockets failed", error);
    });
  }, 5_000);

  io.on("connection", (socket) => {
    const socketIp = resolveSocketIp(
      socket.handshake.headers as Record<string, unknown>,
      socket.handshake.address,
    );
    socketIpById.set(socket.id, socketIp);
    const emitCasePacksToSocket = async () => {
      try {
        const packs = await listCasePacks();
        socket.emit("case_packs_updated", { packs });
      } catch {
        socket.emit("case_packs_updated", { packs: [] });
      }
    };

    void emitCasePacksToSocket();

    socket.on("list_case_packs", () => {
      void emitCasePacksToSocket();
    });

    socket.on("list_public_matches", () => {
      markMissingSocketPlayersDisconnected((socketId) => io.sockets.sockets.has(socketId));
      cleanupStaleRooms();
      cleanupDanglingRoomCaches();
      socket.emit("public_matches_updated", {
        matches: listPublicMatches(),
      });
    });

    socket.on(
      "create_room",
      async ({
        playerName,
        avatar,
        banner,
        authToken,
        options,
      }: {
        playerName: string;
        avatar?: string | null;
        banner?: string | null;
        authToken?: string;
        options?: CreateRoomOptions;
      }) => {
        if (createRoomInFlight.has(socket.id)) {
          return;
        }
        const existingMapping = socketToRoom.get(socket.id);
        if (existingMapping) {
          const existingRoom = getRoom(existingMapping.roomCode);
          if (existingRoom) {
            socket.emit("room_joined", {
              playerId: existingMapping.playerId,
              sessionToken: existingMapping.sessionToken,
              state: getRoomState(existingRoom, existingMapping.playerId),
            });
            return;
          }
          socketToRoom.delete(socket.id);
        }
        createRoomInFlight.add(socket.id);
        try {
          const code = randomCode();
          const playerId = crypto.randomUUID();
          const sessionToken = crypto.randomUUID();
          const authUser =
            typeof authToken === "string" && authToken.trim()
              ? await getUserByToken(authToken.trim(), socketIp)
              : null;
          if (typeof authToken === "string" && authToken.trim() && !authUser) {
            socket.emit("error", {
              message: "Сессия недействительна или аккаунт заблокирован. Войдите снова.",
            });
            return;
          }
          const ban = await resolveRealtimeBan({
            userId: authUser?.id ?? null,
            socketIp,
          });
          if (ban.isBanned) {
            socket.emit("error", { message: getBanMessageForClient(ban) });
            return;
          }
          const authPublicProfile = authUser?.id
            ? await getPublicUserProfileById(authUser.id).catch(() => null)
            : null;
          const authSelectedBadgeKey =
            authPublicProfile?.selectedBadgeKey ?? authUser?.selectedBadgeKey ?? undefined;
          const subscriptionTier = authUser?.id
            ? authPublicProfile?.subscription?.tier
              ? normalizeSubscriptionTier(authPublicProfile.subscription.tier)
              : (await getSubscriptionByUserId(authUser.id)).tier
            : "free";
          const nextOptions: CreateRoomOptions = { ...(options ?? {}) };
          if (
            nextOptions.visibility === "private" &&
            !hasCapability(subscriptionTier, "canCreatePrivateRooms")
          ) {
            nextOptions.visibility = "public";
            nextOptions.password = undefined;
            socket.emit("error", {
              message: "Приватные комнаты доступны только в подписке «Арбитр».",
            });
          }
          if (
            nextOptions.usePreferredRoles &&
            !hasCapability(subscriptionTier, "canLetPlayersChooseRoles")
          ) {
            nextOptions.usePreferredRoles = false;
            socket.emit("error", {
              message: "Разрешать выбор ролей игрокам можно с подпиской «Практик».",
            });
          }
          if (
            typeof nextOptions.casePackKey === "string" &&
            nextOptions.casePackKey.trim()
          ) {
            const packAccessMessage = getPackAccessFailureMessage(
              { key: nextOptions.casePackKey },
              subscriptionTier,
            );
            if (packAccessMessage) {
              nextOptions.casePackKey = "classic";
              socket.emit("error", { message: packAccessMessage });
            }
          }
          nextOptions.hostSubscriptionTier = subscriptionTier;
          nextOptions.isPromoted = hasCapability(subscriptionTier, "canHighlightHostedMatch");
          const normalizedPlayerName = authUser
            ? (playerName || authUser.nickname || "Игрок 1").trim() || authUser.nickname
            : createGuestName();
          const sanitizedMedia = sanitizeProfileMediaByTier(subscriptionTier, {
            avatar: avatar || authUser?.avatar || undefined,
            banner: banner || authUser?.banner || undefined,
          });
          const player = {
            id: playerId,
            userId: authUser?.id,
            subscriptionTier,
            name: normalizedPlayerName,
            isBot: false,
            socketId: socket.id,
            sessionToken,
            avatar: sanitizedMedia.avatar,
            banner: sanitizedMedia.banner,
            selectedBadgeKey: authSelectedBadgeKey,
            preferredRole: (authUser?.preferredRole as AssignableRole | undefined) ?? null,
            lobbyAssignedRole: null,
            roleAssignmentSource: "random" as const,
            rolePreferenceStatus: "idle" as const,
          };
          const room = createRoom(code, player, nextOptions);

          socketToRoom.set(socket.id, { roomCode: code, playerId, sessionToken });
          socket.join(code);
          socket.emit("room_joined", {
            playerId,
            sessionToken,
            state: getRoomState(room, playerId)
          });
          emitPublicMatches(io);
          persistRoom(code);
        } catch (error) {
          console.error("create_room failed", error);
          socket.emit("error", { message: "Не удалось создать комнату. Попробуйте еще раз." });
        } finally {
          createRoomInFlight.delete(socket.id);
        }
      });

    socket.on("join_room", async ({ code, playerName, avatar, banner, password, authToken }: { code: string; playerName: string; avatar?: string | null; banner?: string | null; password?: string; authToken?: string }) => {
      try {
        const roomCode = normalizeRoomCode(code);
        const existingMapping = socketToRoom.get(socket.id);
        if (existingMapping) {
          if (existingMapping.roomCode === roomCode) {
            const existingRoom = getRoom(existingMapping.roomCode);
            if (existingRoom) {
              socket.emit("room_joined", {
                playerId: existingMapping.playerId,
                sessionToken: existingMapping.sessionToken,
                state: getRoomState(existingRoom, existingMapping.playerId),
              });
              return;
            }
          } else {
            socket.leave(existingMapping.roomCode);
          }
          socketToRoom.delete(socket.id);
        }
        const room = getRoom(roomCode);
        const trimmedName = (playerName || "").trim();
        const authUser =
          typeof authToken === "string" && authToken.trim()
            ? await getUserByToken(authToken.trim(), socketIp)
            : null;
        if (typeof authToken === "string" && authToken.trim() && !authUser) {
          socket.emit("error", {
            message: "Сессия недействительна или аккаунт заблокирован. Войдите снова.",
          });
          return;
        }
        const ban = await resolveRealtimeBan({
          userId: authUser?.id ?? null,
          socketIp,
        });
        if (ban.isBanned) {
          socket.emit("error", { message: getBanMessageForClient(ban) });
          return;
        }
        const authPublicProfile = authUser?.id
          ? await getPublicUserProfileById(authUser.id).catch(() => null)
          : null;
        const authSelectedBadgeKey =
          authPublicProfile?.selectedBadgeKey ?? authUser?.selectedBadgeKey ?? undefined;
        const subscriptionTier = authUser?.id
          ? authPublicProfile?.subscription?.tier
            ? normalizeSubscriptionTier(authPublicProfile.subscription.tier)
            : (await getSubscriptionByUserId(authUser.id)).tier
          : "free";
        const syncRecoveredPlayerTier = (roomState: any, playerId: string) => {
          const lobbyPlayer = roomState?.players?.find((entry: any) => entry.id === playerId);
          if (lobbyPlayer) {
            lobbyPlayer.subscriptionTier = subscriptionTier;
          }
          const gamePlayer = roomState?.game?.players?.find((entry: any) => entry.id === playerId);
          if (gamePlayer) {
            gamePlayer.subscriptionTier = subscriptionTier;
          }
        };
        const sanitizedMedia = sanitizeProfileMediaByTier(subscriptionTier, {
          avatar: avatar || authUser?.avatar || undefined,
          banner: banner || authUser?.banner || undefined,
        });
        const existingNames = room
          ? [
              ...room.players.map((player: any) => player.name),
              ...(room.game?.players ?? []).map((player: any) => player.name),
            ]
          : [];
        const effectiveName = authUser
          ? (trimmedName || authUser.nickname || "Игрок").trim()
          : createGuestName(existingNames);

        if (!room) {
          socket.emit("error", { message: "\u041a\u043e\u043c\u043d\u0430\u0442\u0430 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u0430. \u041f\u0440\u043e\u0432\u0435\u0440\u044c\u0442\u0435 \u043a\u043e\u0434." });
          return;
        }
        if (!authUser && !effectiveName) {
          socket.emit("error", { message: "\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043d\u0438\u043a\u043d\u0435\u0439\u043c \u043f\u0435\u0440\u0435\u0434 \u0432\u0445\u043e\u0434\u043e\u043c." });
          return;
        }
        if (!isJoinPasswordValid(roomCode, password)) {
          socket.emit("error", { message: "\u041d\u0435\u0432\u0435\u0440\u043d\u044b\u0439 \u043f\u0430\u0440\u043e\u043b\u044c \u043a\u043e\u043c\u043d\u0430\u0442\u044b." });
          return;
        }

        if (authUser) {
          const profileBanner = sanitizedMedia.banner;
          const reclaimedByUser = reclaimDisconnectedPlayerByUserId(
            roomCode,
            authUser.id,
            socket.id,
            sanitizedMedia.avatar,
            profileBanner,
          );
          if (reclaimedByUser) {
            syncRecoveredPlayerTier(reclaimedByUser.room, reclaimedByUser.playerId);
            clearReconnectCleanup(roomCode, reclaimedByUser.playerId);
            socketToRoom.set(socket.id, {
              roomCode,
              playerId: reclaimedByUser.playerId,
              sessionToken: reclaimedByUser.sessionToken,
            });
            socket.join(roomCode);
            socket.emit("room_joined", {
              playerId: reclaimedByUser.playerId,
              sessionToken: reclaimedByUser.sessionToken,
              state: getRoomState(reclaimedByUser.room, reclaimedByUser.playerId),
            });
            if (reclaimedByUser.room.game) {
              emitLawyerChatStateToSocket(socket.id, roomCode, reclaimedByUser.playerId);
              socket.to(roomCode).emit("player_rejoined", {
                playerId: reclaimedByUser.playerId,
                playerName: reclaimedByUser.playerName.trim(),
              });
              io.to(roomCode).emit("game_players_updated", {
                players: mapGamePlayers(reclaimedByUser.room.game.players),
              });
            } else {
              io.to(roomCode).emit("room_updated", buildRoomUpdatePayload(reclaimedByUser.room));
            }
            emitPublicMatches(io);
            persistRoom(roomCode);
            return;
          }

          const binding = await findBindingByUser(roomCode, authUser.id).catch((error) => {
            console.error("findBindingByUser failed", error);
            return null;
          });
          if (binding?.sessionToken) {
            const restoreResult = rejoinRoom(
              roomCode,
              binding.sessionToken,
              socket.id,
              sanitizedMedia.avatar,
              profileBanner,
            );
            if (restoreResult) {
              syncRecoveredPlayerTier(restoreResult.room, restoreResult.playerId);
              clearReconnectCleanup(roomCode, restoreResult.playerId);
              socketToRoom.set(socket.id, {
                roomCode,
                playerId: restoreResult.playerId,
                sessionToken: binding.sessionToken,
              });
              socket.join(roomCode);
              socket.emit("room_joined", {
                playerId: restoreResult.playerId,
                sessionToken: binding.sessionToken,
                state: getRoomState(restoreResult.room, restoreResult.playerId),
              });
              if (restoreResult.room.game) {
                emitLawyerChatStateToSocket(socket.id, roomCode, restoreResult.playerId);
                io.to(roomCode).emit("game_players_updated", {
                  players: mapGamePlayers(restoreResult.room.game.players),
                });
              } else {
                io.to(roomCode).emit("room_updated", buildRoomUpdatePayload(restoreResult.room));
              }
              emitPublicMatches(io);
              persistRoom(roomCode);
              return;
            }
          }
        }

        // If a player with this nickname disconnected earlier, reclaim their slot/role.
        const reclaimed = reclaimDisconnectedPlayerByName(
          roomCode,
          effectiveName,
          socket.id,
          sanitizedMedia.avatar,
          sanitizedMedia.banner,
        );
        if (reclaimed) {
          syncRecoveredPlayerTier(reclaimed.room, reclaimed.playerId);
          clearReconnectCleanup(roomCode, reclaimed.playerId);
          socketToRoom.set(socket.id, {
            roomCode,
            playerId: reclaimed.playerId,
            sessionToken: reclaimed.sessionToken,
          });
          socket.join(roomCode);
          socket.emit("room_joined", {
            playerId: reclaimed.playerId,
            sessionToken: reclaimed.sessionToken,
            state: getRoomState(reclaimed.room, reclaimed.playerId),
          });
          if (reclaimed.room.game) {
            emitLawyerChatStateToSocket(socket.id, roomCode, reclaimed.playerId);
            socket.to(roomCode).emit("player_rejoined", {
              playerId: reclaimed.playerId,
              playerName: reclaimed.playerName.trim(),
            });
            io.to(roomCode).emit("game_players_updated", {
              players: mapGamePlayers(reclaimed.room.game.players),
            });
          } else {
            io.to(roomCode).emit("room_updated", buildRoomUpdatePayload(reclaimed.room));
          }
          emitPublicMatches(io);
          return;
        }

        if (isNameTaken(roomCode, effectiveName)) {
          socket.emit("error", { message: `\u041d\u0438\u043a\u043d\u0435\u0439\u043c \u00ab${effectiveName}\u00bb \u0443\u0436\u0435 \u0437\u0430\u043d\u044f\u0442 \u0432 \u044d\u0442\u043e\u0439 \u043a\u043e\u043c\u043d\u0430\u0442\u0435.` });
          return;
        }

        const playerId = crypto.randomUUID();
        const sessionToken = crypto.randomUUID();
        const player = {
          id: playerId,
          userId: authUser?.id,
          subscriptionTier,
          name: effectiveName,
          isBot: false,
          socketId: socket.id,
          sessionToken,
          avatar: sanitizedMedia.avatar,
          banner: sanitizedMedia.banner,
          selectedBadgeKey: authSelectedBadgeKey,
          preferredRole: (authUser?.preferredRole as AssignableRole | undefined) ?? null,
          lobbyAssignedRole: null,
          roleAssignmentSource: "random" as const,
          rolePreferenceStatus: "idle" as const,
        };

        if (room.started) {
          const updatedRoom = joinRunningGameAsWitness(roomCode, player);
          if (!updatedRoom?.game) {
            socket.emit("error", { message: "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0432\u043e\u0439\u0442\u0438 \u0432 \u0443\u0436\u0435 \u0438\u0434\u0443\u0449\u0438\u0439 \u043c\u0430\u0442\u0447." });
            return;
          }

          socketToRoom.set(socket.id, { roomCode, playerId, sessionToken });
          socket.join(roomCode);
          socket.emit("room_joined", {
            playerId,
            sessionToken,
            state: getRoomState(updatedRoom, playerId)
          });
          emitLawyerChatStateToSocket(socket.id, roomCode, playerId);
          io.to(roomCode).emit("game_players_updated", {
            players: mapGamePlayers(updatedRoom.game.players)
          });
          emitPublicMatches(io);
          persistRoom(roomCode);
          return;
        }

        if (room.players.length >= room.maxPlayers) {
          const witnessRoom = joinRoomAsLobbyWitness(roomCode, player, password);
          if (!witnessRoom) {
            socket.emit("error", { message: `Комната заполнена (максимум ${room.maxPlayers} игроков).` });
            return;
          }

          socketToRoom.set(socket.id, { roomCode, playerId, sessionToken });
          socket.join(roomCode);
          socket.emit("room_joined", {
            playerId,
            sessionToken,
            state: getRoomState(witnessRoom, playerId),
          });

          socket.to(roomCode).emit("room_updated", buildRoomUpdatePayload(witnessRoom));
          emitPublicMatches(io);
          persistRoom(roomCode);
          return;
        }

        const updatedRoom = joinRoom(roomCode, player, password);
        if (!updatedRoom) {
          socket.emit("error", { message: "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0432\u043e\u0439\u0442\u0438 \u0432 \u043a\u043e\u043c\u043d\u0430\u0442\u0443." });
          return;
        }

        socketToRoom.set(socket.id, { roomCode, playerId, sessionToken });
        socket.join(roomCode);
        socket.emit("room_joined", {
          playerId,
          sessionToken,
          state: getRoomState(updatedRoom, playerId)
        });
        try {
          socket.to(roomCode).emit("room_updated", buildRoomUpdatePayload(updatedRoom));
        } catch (broadcastError) {
          console.error("join_room room_updated failed", broadcastError);
        }
        try {
          emitPublicMatches(io);
          persistRoom(roomCode);
        } catch (persistError) {
          console.error("join_room post-join sync failed", persistError);
        }
      } catch (error) {
        console.error("join_room failed", error);
        socket.emit("error", { message: "Не удалось войти в комнату. Попробуйте еще раз." });
      }
    });

    socket.on("rejoin_room", async ({ code, sessionToken, avatar, banner }: { code: string; sessionToken: string; avatar?: string | null; banner?: string | null }) => {
      try {
        const roomCode = normalizeRoomCode(code);
        if (!sessionToken?.trim()) {
          socket.emit("rejoin_failed", { message: "Недействительная сессия." });
          return;
        }
        const result = rejoinRoom(roomCode, sessionToken, socket.id, avatar, banner);

        if (!result) {
          socket.emit("rejoin_failed", { message: "Комната не найдена или вас нет в ней." });
          return;
        }

        const { room, playerId } = result;
        const currentPlayer =
          room.players.find((player: any) => player.id === playerId) ??
          room.game?.players.find((player: any) => player.id === playerId);
        const ban = await resolveRealtimeBan({
          userId: currentPlayer?.userId ?? null,
          socketIp,
        });
        if (ban.isBanned) {
          socket.emit("rejoin_failed", { message: getBanMessageForClient(ban) });
          return;
        }
        clearReconnectCleanup(roomCode, playerId);
        socketToRoom.set(socket.id, { roomCode, playerId, sessionToken });
        socket.join(roomCode);

        socket.emit("room_joined", {
          playerId,
          sessionToken,
          state: getRoomState(room, playerId)
        });
        if (room.game) {
          emitLawyerChatStateToSocket(socket.id, roomCode, playerId);
        }

        if (room.game) {
          socket.to(roomCode).emit("player_rejoined", {
            playerId,
            playerName: result.playerName.trim()
          });
          io.to(roomCode).emit("game_players_updated", {
            players: mapGamePlayers(room.game.players),
          });
        } else {
          io.to(roomCode).emit("room_updated", buildRoomUpdatePayload(room));
        }
        emitPublicMatches(io);
      } catch (error) {
        console.error("rejoin_room failed", error);
        socket.emit("rejoin_failed", { message: "Не удалось восстановить подключение." });
      }
    });

    socket.on("start_game", async ({ code, sessionToken }: { code: string; sessionToken?: string }) => {
      try {
      const roomCode = normalizeRoomCode(code);
      const room = getRoom(roomCode);
      if (!room) {
        socket.emit("error", { message: "Комната не найдена." });
        return;
      }
      const actorId = resolveActorId({
        socketId: socket.id,
        roomCode,
        room,
        sessionToken
      });
      if (!actorId || room.hostId !== actorId) {
        socket.emit("error", { message: "Только ведущий может начать игру." });
        return;
      }
      const actor = room.players.find((player: any) => player.id === actorId);
      const actorBan = await resolveRealtimeBan({
        userId: actor?.userId ?? null,
        socketIp,
      });
      if (actorBan.isBanned) {
        forcedNoRejoinDisconnect.add(socket.id);
        socket.emit("kicked", { message: getBanMessageForClient(actorBan) });
        socket.disconnect(true);
        return;
      }
      const actorTier = actor?.userId
        ? (await getSubscriptionByUserId(actor.userId)).tier
        : "free";
      const effectiveRoomTier = getHigherSubscriptionTier(
        actorTier,
        normalizeSubscriptionTier(room.hostSubscriptionTier ?? "free"),
      );
      const packAccessMessage = getPackAccessFailureMessage(
        { key: room.casePackKey },
        effectiveRoomTier,
      );
      if (packAccessMessage) {
        socket.emit("error", { message: packAccessMessage });
        return;
      }
      markMissingSocketPlayersDisconnected((socketId) => io.sockets.sockets.has(socketId));
      const preparedRoom = removeDisconnectedLobbyPlayersBeforeStart(roomCode) ?? room;
      io.to(roomCode).emit("room_updated", buildRoomUpdatePayload(preparedRoom));
      const activePlayers = preparedRoom.players.filter(
        (player: any) => player.roleKey !== "witness" && player.roleKey !== "observer",
      );
      if (preparedRoom.modeKey === "quick_flex") {
        if (activePlayers.length < 3 || activePlayers.length > preparedRoom.maxPlayers) {
          socket.emit("error", {
            message: `Для старта быстрой комнаты нужно от 3 до ${preparedRoom.maxPlayers} игроков.`,
          });
          return;
        }
      } else if (activePlayers.length !== preparedRoom.maxPlayers) {
        socket.emit("error", {
          message: `Для старта нужно ровно ${preparedRoom.maxPlayers} игроков.`,
        });
        return;
      }

      const roleValidation = validateLobbyRolesBeforeStart(preparedRoom);
      if (!roleValidation.ok) {
        socket.emit("error", { message: roleValidation.reason });
        return;
      }

      const selectedCase = await pickCaseForRoom(preparedRoom.casePackKey, activePlayers.length);
      if (!selectedCase) {
        socket.emit("error", { message: "Для выбранного пака не найдено подходящих дел." });
        return;
      }

      const mechanicPoolSize = Math.max(12, activePlayers.length * 4);
      let mechanicCards = await pickMechanicCardsForRoom(mechanicPoolSize);
      if (!mechanicCards.length) {
        mechanicCards = MECHANIC_CARDS_FALLBACK;
      }

      const updatedRoom = startGame(roomCode, selectedCase, mechanicCards);
      if (!updatedRoom) {
        socket.emit("error", { message: "Не удалось начать игру." });
        return;
      }

      updatedRoom.players.forEach((p: any) => {
        const pSocketId = p.socketId;
        if (pSocketId) {
          io.to(pSocketId).emit("game_started", {
            state: getRoomState(updatedRoom, p.id)
          });
          emitLawyerChatStateToSocket(pSocketId, roomCode, p.id);
        }
      });
      emitPublicMatches(io);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Не удалось начать игру.";
        socket.emit("error", { message: message || "Не удалось начать игру." });
      }
    });

    socket.on("set_host_judge", ({ code, isHostJudge, sessionToken }: { code: string; isHostJudge: boolean; sessionToken?: string }) => {
      const roomCode = normalizeRoomCode(code);
      const room = getRoom(roomCode);
      if (!room) return;
      const actorId = resolveActorId({
        socketId: socket.id,
        roomCode,
        room,
        sessionToken
      });
      if (!actorId || room.hostId !== actorId) return;
      setHostJudge(roomCode, isHostJudge);
      io.to(roomCode).emit("room_updated", buildRoomUpdatePayload(room));
    });

    socket.on(
      "set_use_preferred_roles",
      async ({
        code,
        usePreferredRoles,
        sessionToken,
      }: {
        code: string;
        usePreferredRoles: boolean;
        sessionToken?: string;
      }) => {
        const roomCode = normalizeRoomCode(code);
        const room = getRoom(roomCode);
        if (!room) return;
        const actorId = resolveActorId({
          socketId: socket.id,
          roomCode,
          room,
          sessionToken,
        });
        if (!actorId || room.hostId !== actorId) {
          socket.emit("error", { message: "Только ведущий может менять эту настройку." });
          return;
        }
        const actor = room.players.find((player: any) => player.id === actorId);
        const actorTier = actor?.userId
          ? (await getSubscriptionByUserId(actor.userId)).tier
          : "free";
        if (usePreferredRoles && !hasCapability(actorTier, "canLetPlayersChooseRoles")) {
          socket.emit("error", {
            message: "Разрешать игрокам выбирать роли можно с подпиской «Практик».",
          });
          return;
        }
        const updated = setUsePreferredRoles(roomCode, !!usePreferredRoles);
        if (!updated) return;
        updated.hostSubscriptionTier = getHigherSubscriptionTier(
          normalizeSubscriptionTier(updated.hostSubscriptionTier ?? "free"),
          actorTier,
        );
        updated.isPromoted = !!updated.isPromoted || hasCapability(actorTier, "canHighlightHostedMatch");
        io.to(roomCode).emit("room_updated", buildRoomUpdatePayload(updated));
        persistRoom(roomCode);
      },
    );

    socket.on(
      "update_room_management",
      async ({
        code,
        sessionToken,
        patch,
      }: {
        code: string;
        sessionToken?: string;
        patch: {
          modeKey?: "quick_flex" | "civil_3" | "criminal_4" | "criminal_5" | "company_6";
          casePackKey?: string;
          visibility?: "public" | "private";
          password?: string | null;
          allowWitnesses?: boolean;
          maxObservers?: number;
          openingSpeechTimerSec?: number | null;
          closingSpeechTimerSec?: number | null;
          protestLimitEnabled?: boolean;
          maxProtestsPerPlayer?: number | null;
        };
      }) => {
        const roomCode = normalizeRoomCode(code);
        const room = getRoom(roomCode);
        if (!room || room.started) return;
        const actorId = resolveActorId({
          socketId: socket.id,
          roomCode,
          room,
          sessionToken,
        });
        if (!actorId || room.hostId !== actorId) {
          socket.emit("error", { message: "Только ведущий может менять настройки комнаты." });
          return;
        }
        const actor = room.players.find((player: any) => player.id === actorId);
        const actorTier = actor?.userId
          ? (await getSubscriptionByUserId(actor.userId)).tier
          : "free";
        if (patch?.visibility === "private" && !hasCapability(actorTier, "canCreatePrivateRooms")) {
          socket.emit("error", {
            message: "Приватные комнаты доступны только в подписке «Арбитр».",
          });
          return;
        }
        if (typeof patch?.casePackKey === "string" && patch.casePackKey.trim()) {
          const packAccessMessage = getPackAccessFailureMessage(
            { key: patch.casePackKey },
            actorTier,
          );
          if (packAccessMessage) {
            socket.emit("error", { message: packAccessMessage });
            return;
          }
        }
        const result = updateRoomManagement(roomCode, patch ?? {});
        if (!result) return;
        if (!result.ok) {
          socket.emit("error", { message: result.reason });
          return;
        }
        result.room.hostSubscriptionTier = getHigherSubscriptionTier(
          normalizeSubscriptionTier(result.room.hostSubscriptionTier ?? "free"),
          actorTier,
        );
        result.room.isPromoted =
          !!result.room.isPromoted || hasCapability(actorTier, "canHighlightHostedMatch");
        io.to(roomCode).emit("room_updated", buildRoomUpdatePayload(result.room));
        emitPublicMatches(io);
        persistRoom(roomCode);
      },
    );

    socket.on(
      "transfer_room_host",
      async ({
        code,
        targetPlayerId,
        sessionToken,
      }: {
        code: string;
        targetPlayerId: string;
        sessionToken?: string;
      }) => {
        const roomCode = normalizeRoomCode(code);
        const room = getRoom(roomCode);
        if (!room || room.started) return;
        const actorId = resolveActorId({
          socketId: socket.id,
          roomCode,
          room,
          sessionToken,
        });
        if (!actorId || room.hostId !== actorId) {
          socket.emit("error", { message: "Только текущий ведущий может передать комнату." });
          return;
        }
        const result = transferRoomHost(roomCode, targetPlayerId);
        if (!result) return;
        if (!result.ok) {
          socket.emit("error", { message: result.reason });
          return;
        }
        io.to(roomCode).emit("room_updated", buildRoomUpdatePayload(result.room));
        emitPublicMatches(io);
        persistRoom(roomCode);
      },
    );

    socket.on(
      "choose_lobby_role",
      async ({
        code,
        roleKey,
        targetPlayerId,
        sessionToken,
      }: {
        code: string;
        roleKey?: AssignableRole | null;
        targetPlayerId?: string;
        sessionToken?: string;
      }) => {
        const roomCode = normalizeRoomCode(code);
        const room = getRoom(roomCode);
        if (!room || room.started) return;
        const actorId = resolveActorId({
          socketId: socket.id,
          roomCode,
          room,
          sessionToken,
        });
        if (!actorId) return;
        const actor = room.players.find((player: any) => player.id === actorId);
        if (!actor) return;
        const resolvedTargetId = targetPlayerId ?? actorId;
        const target = room.players.find((player: any) => player.id === resolvedTargetId);
        if (!target) return;
        const actorTier = actor.userId
          ? (await getSubscriptionByUserId(actor.userId)).tier
          : "free";
        const isHostActor = room.hostId === actorId;
        const isSelfChange = resolvedTargetId === actorId;
        if (isHostActor && isSelfChange && !hasCapability(actorTier, "canChooseRoleInOwnLobby")) {
          socket.emit("error", {
            message: "Выбор своей роли доступен с подписки «Стажер».",
          });
          return;
        }
        if (isHostActor && !isSelfChange && !hasCapability(actorTier, "canLetPlayersChooseRoles")) {
          socket.emit("error", {
            message: "Управление выбором ролей для игроков доступно с подписки «Практик».",
          });
          return;
        }
        if (!isHostActor) {
          if (!isSelfChange) {
            socket.emit("error", { message: "Можно менять только свою роль." });
            return;
          }
          if (
            !room.usePreferredRoles &&
            !hasCapability(actorTier, "canChooseRoleInOtherLobbies")
          ) {
            socket.emit("error", {
              message: "Выбор роли в чужом лобби доступен только в подписке «Арбитр».",
            });
            return;
          }
        }
        const result = chooseLobbyRole(
          roomCode,
          actorId,
          resolvedTargetId,
          roleKey ?? null,
          {
            allowNonHostChoiceInForeignLobby:
              !isHostActor && hasCapability(actorTier, "canChooseRoleInOtherLobbies"),
          },
        );
        if (!result) return;
        if (!result.ok) {
          socket.emit("error", { message: result.reason });
        }
        io.to(roomCode).emit("room_updated", buildRoomUpdatePayload(result.room));
        persistRoom(roomCode);
      },
    );

    socket.on(
      "admin_add_bots",
      async ({
        code,
        count,
        authToken,
        adminKey,
      }: {
        code: string;
        count?: number;
        authToken?: string;
        adminKey?: string;
      }) => {
        const roomCode = normalizeRoomCode(code);
        const room = getRoom(roomCode);
        if (!room) return;
        const actorInfo = socketToRoom.get(socket.id);
        if (!actorInfo || actorInfo.roomCode !== roomCode) {
          socket.emit("error", { message: "Недоступно вне текущей комнаты." });
          return;
        }
        const socketIp = resolveSocketIp(
          socket.handshake.headers as Record<string, unknown>,
          socket.handshake.address,
        );
        if (!(await isCreatorAdmin(authToken, adminKey, socketIp))) {
          socket.emit("error", { message: "Нет доступа к админ-инструментам." });
          return;
        }
        const updated = addAdminBotsToRoom(roomCode, Number.isFinite(count) ? Number(count) : 1);
        if (!updated) return;
        io.to(roomCode).emit("room_updated", buildRoomUpdatePayload(updated));
        if (updated.game) {
          io.to(roomCode).emit("game_players_updated", {
            players: mapGamePlayers(updated.game.players),
          });
        }
        emitPublicMatches(io);
        persistRoom(roomCode);
      },
    );

    socket.on(
      "admin_control_player",
      async ({
        code,
        targetPlayerId,
        authToken,
        adminKey,
      }: {
        code: string;
        targetPlayerId?: string;
        authToken?: string;
        adminKey?: string;
      }) => {
        const roomCode = normalizeRoomCode(code);
        const room = getRoom(roomCode);
        if (!room || !targetPlayerId) return;

        const actorInfo = socketToRoom.get(socket.id);
        if (!actorInfo || actorInfo.roomCode !== roomCode) {
          socket.emit("error", { message: "Недоступно вне текущей комнаты." });
          return;
        }
        const socketIp = resolveSocketIp(
          socket.handshake.headers as Record<string, unknown>,
          socket.handshake.address,
        );
        if (!(await isCreatorAdmin(authToken, adminKey, socketIp))) {
          socket.emit("error", { message: "Нет доступа к админ-инструментам." });
          return;
        }

        const lobbyTarget = room.players.find((player: any) => player.id === targetPlayerId);
        const gameTarget = room.game?.players.find((player: any) => player.id === targetPlayerId);
        const target = gameTarget ?? lobbyTarget;
        if (!target) {
          socket.emit("error", { message: "Игрок не найден." });
          return;
        }

        if (!target.sessionToken || !target.sessionToken.trim()) {
          target.sessionToken = crypto.randomUUID();
        }
        if (lobbyTarget) {
          lobbyTarget.sessionToken = target.sessionToken;
        }
        if (gameTarget) {
          gameTarget.sessionToken = target.sessionToken;
        }

        socket.emit("room_joined", {
          playerId: target.id,
          sessionToken: target.sessionToken,
          state: getRoomState(room, target.id),
        });
        if (room.game) {
          emitLawyerChatStateToSocket(socket.id, roomCode, target.id);
        }
        persistRoom(roomCode);
      },
    );

    socket.on(
      "update_avatar",
      ({ code, avatar, sessionToken }: { code: string; avatar?: string | null; sessionToken?: string }) => {
        if (!avatar) return;
        const roomCode = normalizeRoomCode(code);
        const room = getRoom(roomCode);
        if (!room) return;
        const actorId = resolveActorId({
          socketId: socket.id,
          roomCode,
          room,
          sessionToken
        });
        if (!actorId) return;
        updatePlayerAvatar(roomCode, actorId, avatar);
        if (!room) return;

        if (room.game) {
          io.to(roomCode).emit("game_players_updated", {
            players: mapGamePlayers(room.game.players)
          });
          return;
        }

        io.to(roomCode).emit("room_updated", buildRoomUpdatePayload(room));
      }
    );

    socket.on(
      "update_profile",
      async ({
        code,
        name,
        avatar,
        banner,
        selectedBadgeKey,
        preferredRole,
        sessionToken,
      }: {
        code: string;
        name?: string;
        avatar?: string | null;
        banner?: string | null;
        selectedBadgeKey?: string | null;
        preferredRole?: AssignableRole | null;
        sessionToken?: string;
      }) => {
        const roomCode = normalizeRoomCode(code);
        const room = getRoom(roomCode);
        if (!room) return;

        const actorId = resolveActorId({
          socketId: socket.id,
          roomCode,
          room,
          sessionToken,
        });
        if (!actorId) return;
        const actor = room.players.find((player: any) => player.id === actorId);
        const actorTier = actor?.userId
          ? (await getSubscriptionByUserId(actor.userId)).tier
          : "free";
        const canUseBanner = hasCapability(actorTier, "canUseProfileBanner");
        const canUseAnimated = hasCapability(actorTier, "canUseAnimatedProfileMedia");
        let nextAvatar = avatar;
        let nextBanner = banner;
        if (banner !== undefined && !canUseBanner) {
          if (typeof banner === "string" && banner.trim()) {
            nextBanner = undefined;
            socket.emit("error", {
              message: "Баннер профиля доступен с подписки «Практик».",
            });
          }
        }
        if (!canUseAnimated) {
          if (
            typeof nextAvatar === "string" &&
            nextAvatar.trim() &&
            isAnimatedProfileMedia(nextAvatar)
          ) {
            nextAvatar = undefined;
            socket.emit("error", {
              message: "GIF-аватар доступен только в подписке «Арбитр».",
            });
          }
          if (
            typeof nextBanner === "string" &&
            nextBanner.trim() &&
            isAnimatedProfileMedia(nextBanner)
          ) {
            nextBanner = undefined;
            socket.emit("error", {
              message: "GIF-баннер доступен только в подписке «Арбитр».",
            });
          }
        }

        const nextName = name?.trim();
        if (nextName && isNameTakenByOther(roomCode, actorId, nextName)) {
          socket.emit("error", {
            message: `\u041d\u0438\u043a\u043d\u0435\u0439\u043c \u00ab${nextName}\u00bb \u0443\u0436\u0435 \u0437\u0430\u043d\u044f\u0442 \u0432 \u044d\u0442\u043e\u0439 \u043a\u043e\u043c\u043d\u0430\u0442\u0435.`,
          });
          return;
        }

        const updatedRoom = updatePlayerProfile(roomCode, actorId, {
          name: nextName,
          avatar: nextAvatar,
          banner: nextBanner,
          selectedBadgeKey,
          preferredRole: preferredRole ?? undefined,
        });
        if (!updatedRoom) return;

        if (updatedRoom.game) {
          updatedRoom.game.players.forEach((p: any) => {
            if (!p.socketId) return;
            io.to(p.socketId).emit("game_profile_updated", {
              players: mapGamePlayers(updatedRoom.game!.players),
              revealedFacts: updatedRoom.game!.revealedFacts,
              usedCards: updatedRoom.game!.usedCards,
            });
          });
        } else {
          io.to(roomCode).emit("room_updated", buildRoomUpdatePayload(updatedRoom));
        }

        io.to(roomCode).emit("lobby_chat_updated", {
          messages: updatedRoom.lobbyChat,
        });
        emitPublicMatches(io);
      },
    );

    socket.on(
      "send_lobby_chat",
      ({
        code,
        text,
        sessionToken,
      }: {
        code: string;
        text: string;
        sessionToken?: string;
      }) => {
        const roomCode = normalizeRoomCode(code);
        const room = getRoom(roomCode);
        if (!room || room.started) return;
        const actorId = resolveActorId({
          socketId: socket.id,
          roomCode,
          room,
          sessionToken,
        });
        if (!actorId) return;

        const updatedRoom = addLobbyChatMessage(roomCode, actorId, text);
        if (!updatedRoom) return;

        io.to(roomCode).emit("lobby_chat_updated", {
          messages: updatedRoom.lobbyChat,
        });
      },
    );

    socket.on(
      "get_lawyer_chat_state",
      ({ code, sessionToken }: { code: string; sessionToken?: string }) => {
        const roomCode = normalizeRoomCode(code);
        const room = getRoom(roomCode);
        if (!room?.game) {
          socket.emit("lawyer_chat_state", {
            enabled: false,
            partner: null,
            messages: [],
          });
          return;
        }

        const actorId = resolveActorId({
          socketId: socket.id,
          roomCode,
          room,
          sessionToken,
        });
        if (!actorId) {
          socket.emit("lawyer_chat_state", {
            enabled: false,
            partner: null,
            messages: [],
          });
          return;
        }

        emitLawyerChatStateToSocket(socket.id, roomCode, actorId);
      },
    );

    socket.on(
      "send_lawyer_chat",
      ({
        code,
        text,
        sessionToken,
      }: {
        code: string;
        text: string;
        sessionToken?: string;
      }) => {
        const roomCode = normalizeRoomCode(code);
        const room = getRoom(roomCode);
        if (!room?.game) return;

        const actorId = resolveActorId({
          socketId: socket.id,
          roomCode,
          room,
          sessionToken,
        });
        if (!actorId) return;

        const pair = resolveLawyerPair(room, actorId);
        if (!pair) return;

        const normalizedText = (text ?? "").trim().slice(0, 500);
        if (!normalizedText) return;

        const messages = lawyerChats.get(pair.chatKey) ?? [];
        messages.push({
          id: crypto.randomUUID(),
          senderId: actorId,
          senderName: pair.self.name,
          text: normalizedText,
          createdAt: Date.now(),
        });
        if (messages.length > 150) {
          lawyerChats.set(pair.chatKey, messages.slice(-150));
        } else {
          lawyerChats.set(pair.chatKey, messages);
        }
        const nextMessages = lawyerChats.get(pair.chatKey) ?? [];

        const targets = [pair.self, pair.partner]
          .map((player: any) => player.socketId)
          .filter((socketId: any) => typeof socketId === "string" && socketId.trim().length > 0);

        targets.forEach((targetSocketId: string) => {
          io.to(targetSocketId).emit("lawyer_chat_updated", {
            messages: nextMessages,
            partner: {
              id:
                targetSocketId === pair.self.socketId
                  ? pair.partner.id
                  : pair.self.id,
              name:
                targetSocketId === pair.self.socketId
                  ? pair.partner.name
                  : pair.self.name,
              roleTitle:
                targetSocketId === pair.self.socketId
                  ? pair.partner.roleTitle
                  : pair.self.roleTitle,
            },
          });
        });
      },
    );

    socket.on(
      "trigger_protest",
      ({ code, sessionToken }: { code: string; sessionToken?: string }) => {
        const roomCode = normalizeRoomCode(code);
        const room = getRoom(roomCode);
        if (!room?.game || room.game.finished) return;

        const actorId = resolveActorId({
          socketId: socket.id,
          roomCode,
          room,
          sessionToken,
        });
        if (!actorId) return;

        const actor = room.game.players.find((p: any) => p.id === actorId);
        if (!actor) return;

        const actorRole = normalizeRoleKey(actor.roleKey);
        if (actorRole === "judge") {
          socket.emit("error", {
            message: "Судья не использует кнопку «Протестую».",
          });
          return;
        }
        if (actorRole === "witness" || actorRole === "observer") {
          socket.emit("error", {
            message: "Свидетели и наблюдатели не могут заявлять протест.",
          });
          return;
        }
        if (room.game.activeProtest) {
          socket.emit("error", {
            message:
              "В матче уже есть активный протест. Дождитесь решения судьи.",
          });
          return;
        }

        if (room.game.protestLimitEnabled) {
          const limit =
            typeof room.game.maxProtestsPerPlayer === "number"
              ? Math.max(1, room.game.maxProtestsPerPlayer)
              : 1;
          const usageMap = room.game.protestUsageByPlayer ?? {};
          const used = Math.max(0, Number(usageMap[actor.id] ?? 0));
          if (used >= limit) {
            socket.emit("error", {
              message: `Лимит протестов исчерпан (${used}/${limit}).`,
            });
            return;
          }
        }

        const stageName = getCurrentStageName(room.game.stages, room.game.stageIndex);
        if (!isCrossExaminationStage(stageName)) {
          socket.emit("error", {
            message:
              "Протест доступен только на этапе «Перекрестный допрос».",
          });
          return;
        }

        const key = getActionCooldownKey(roomCode, actorId, "protest");
        const now = Date.now();
        const cooldownEndsAt = actionCooldowns.get(key) ?? 0;
        if (cooldownEndsAt > now) {
          socket.emit("influence_cooldown", {
            action: "protest",
            cooldownEndsAt,
          });
          return;
        }

        const nextCooldownEndsAt = now + PROTEST_COOLDOWN_MS;
        actionCooldowns.set(key, nextCooldownEndsAt);
        socket.emit("influence_cooldown", {
          action: "protest",
          cooldownEndsAt: nextCooldownEndsAt,
        });

        room.game.activeProtest = {
          id: crypto.randomUUID(),
          actorId: actor.id,
          actorName: actor.name,
          actorRoleTitle: actor.roleTitle || actor.name,
          createdAt: now,
        };
        if (room.game.protestLimitEnabled) {
          const usageMap = room.game.protestUsageByPlayer ?? {};
          usageMap[actor.id] = Math.max(0, Number(usageMap[actor.id] ?? 0)) + 1;
          room.game.protestUsageByPlayer = usageMap;
        }
        emitProtestState(roomCode, room);
      },
    );

    socket.on(
      "resolve_protest",
      ({
        code,
        resolution,
        sessionToken,
      }: {
        code: string;
        resolution: "accepted" | "rejected";
        sessionToken?: string;
      }) => {
        const roomCode = normalizeRoomCode(code);
        const room = getRoom(roomCode);
        if (!room?.game || room.game.finished) return;

        const actorId = resolveActorId({
          socketId: socket.id,
          roomCode,
          room,
          sessionToken,
        });
        if (!actorId) return;

        const actor = room.game.players.find((p: any) => p.id === actorId);
        if (!actor || normalizeRoleKey(actor.roleKey) !== "judge") {
          socket.emit("error", {
            message: "Принимать или отклонять протест может только судья.",
          });
          return;
        }

        const active = room.game.activeProtest;
        if (!active) {
          socket.emit("error", {
            message: "В матче нет активного протеста.",
          });
          return;
        }

        room.game.activeProtest = null;
        emitProtestState(roomCode, room);

        io.to(roomCode).emit("influence_announcement", {
          id: crypto.randomUUID(),
          kind: "protest",
          title:
            resolution === "accepted"
              ? "ПРОТЕСТ ПРИНЯТ"
              : "ПРОТЕСТ ОТКЛОНЕН",
          durationMs: INFLUENCE_ANNOUNCEMENT_DURATION_MS,
        });
      },
    );
    socket.on(
      "trigger_judge_silence",
      ({ code, sessionToken }: { code: string; sessionToken?: string }) => {
        const roomCode = normalizeRoomCode(code);
        const room = getRoom(roomCode);
        if (!room?.game || room.game.finished) return;

        const actorId = resolveActorId({
          socketId: socket.id,
          roomCode,
          room,
          sessionToken,
        });
        if (!actorId) return;

        const actor = room.game.players.find((p: any) => p.id === actorId);
        if (!actor || normalizeRoleKey(actor.roleKey) !== "judge") {
          socket.emit("error", { message: "Эту кнопку может использовать только судья." });
          return;
        }

        const key = getActionCooldownKey(roomCode, actorId, "silence");
        const now = Date.now();
        const cooldownEndsAt = actionCooldowns.get(key) ?? 0;
        if (cooldownEndsAt > now) {
          socket.emit("influence_cooldown", {
            action: "silence",
            cooldownEndsAt,
          });
          return;
        }

        const nextCooldownEndsAt = now + JUDGE_SILENCE_COOLDOWN_MS;
        actionCooldowns.set(key, nextCooldownEndsAt);
        socket.emit("influence_cooldown", {
          action: "silence",
          cooldownEndsAt: nextCooldownEndsAt,
        });
        io.to(roomCode).emit("influence_announcement", {
          id: crypto.randomUUID(),
          kind: "silence",
          title: "ТИШИНА В ЗАЛЕ!",
          durationMs: INFLUENCE_ANNOUNCEMENT_DURATION_MS,
        });
      },
    );

    socket.on(
      "trigger_warning",
      ({
        code,
        targetPlayerId,
        sessionToken,
      }: {
        code: string;
        targetPlayerId: string;
        sessionToken?: string;
      }) => {
        const roomCode = normalizeRoomCode(code);
        const room = getRoom(roomCode);
        if (!room?.game || room.game.finished) return;

        const actorId = resolveActorId({
          socketId: socket.id,
          roomCode,
          room,
          sessionToken,
        });
        if (!actorId) return;

        const actor = room.game.players.find((p: any) => p.id === actorId);
        if (!actor || normalizeRoleKey(actor.roleKey) !== "judge") {
          socket.emit("error", { message: "Предупреждение может выдавать только судья." });
          return;
        }

        if (!targetPlayerId || targetPlayerId === actorId) {
          socket.emit("error", { message: "Нельзя выдать предупреждение этому игроку." });
          return;
        }

        const targetPlayer = room.game.players.find((p: any) => p.id === targetPlayerId);
        if (!targetPlayer) {
          socket.emit("error", { message: "Игрок не найден." });
          return;
        }
        const targetRole = normalizeRoleKey(targetPlayer.roleKey);
        if (targetRole === "judge" || targetRole === "observer") {
          socket.emit("error", { message: "Этому игроку нельзя выдавать предупреждение." });
          return;
        }

        const result = applyWarningToPlayer(roomCode, targetPlayerId);
        if (!result) return;
        if (!result.changed) {
          socket.emit("error", {
            message: "Этому игроку уже выдан максимум предупреждений (3).",
          });
          return;
        }

        io.to(roomCode).emit("game_players_updated", {
          players: mapGamePlayers(result.room.game.players),
        });
      },
    );

    socket.on(
      "remove_warning",
      ({
        code,
        targetPlayerId,
        sessionToken,
      }: {
        code: string;
        targetPlayerId: string;
        sessionToken?: string;
      }) => {
        const roomCode = normalizeRoomCode(code);
        const room = getRoom(roomCode);
        if (!room?.game || room.game.finished) return;

        const actorId = resolveActorId({
          socketId: socket.id,
          roomCode,
          room,
          sessionToken,
        });
        if (!actorId) return;

        const actor = room.game.players.find((p: any) => p.id === actorId);
        if (!actor || normalizeRoleKey(actor.roleKey) !== "judge") {
          socket.emit("error", { message: "Снимать предупреждения может только судья." });
          return;
        }

        if (!targetPlayerId || targetPlayerId === actorId) {
          socket.emit("error", { message: "Нельзя изменить предупреждение этому игроку." });
          return;
        }

        const targetPlayer = room.game.players.find((p: any) => p.id === targetPlayerId);
        if (!targetPlayer) {
          socket.emit("error", { message: "Игрок не найден." });
          return;
        }
        const targetRole = normalizeRoleKey(targetPlayer.roleKey);
        if (targetRole === "judge" || targetRole === "observer") {
          socket.emit("error", { message: "Этому игроку нельзя изменять предупреждения." });
          return;
        }

        const result = removeWarningFromPlayer(roomCode, targetPlayerId);
        if (!result) return;
        if (!result.changed) {
          socket.emit("error", {
            message: "У этого игрока нет предупреждений.",
          });
          return;
        }

        io.to(roomCode).emit("game_players_updated", {
          players: mapGamePlayers(result.room.game.players),
        });
      },
    );

    socket.on(
      "kick_player",
      ({ code, targetPlayerId, sessionToken }: { code: string; targetPlayerId: string; sessionToken?: string }) => {
        const roomCode = normalizeRoomCode(code);
        const room = getRoom(roomCode);
        if (!room) {
          socket.emit("error", { message: "Room not found." });
          return;
        }
        const actorId = resolveActorId({
          socketId: socket.id,
          roomCode,
          room,
          sessionToken
        });
        if (!actorId || room.hostId !== actorId) {
          socket.emit("error", { message: "Только ведущий может кикать игроков." });
          return;
        }
        if (room.started || room.game) {
          socket.emit("error", { message: "Кик доступен только в лобби до старта матча." });
          return;
        }
        if (targetPlayerId === room.hostId) {
          socket.emit("error", { message: "Ведущего нельзя кикнуть." });
          return;
        }

        const targetPlayer = room.players.find((p: any) => p.id === targetPlayerId);
        if (!targetPlayer) {
          socket.emit("error", { message: "Игрок не найден в лобби." });
          return;
        }

        const targetSocketId = targetPlayer.socketId;
        clearReconnectCleanup(roomCode, targetPlayerId);
        const updatedRoom = removePlayer(roomCode, targetPlayerId);

        const mappingEntry = [...socketToRoom.entries()].find(
          ([, value]) => value.roomCode === roomCode && value.playerId === targetPlayerId
        );
        if (mappingEntry) {
          socketToRoom.delete(mappingEntry[0]);
        }
        if (targetSocketId) {
          socketToRoom.delete(targetSocketId);
          io.to(targetSocketId).emit("kicked", {
            message: "Вы были кикнуты из лобби."
          });
          io.in(targetSocketId).socketsLeave(roomCode);
        }

        if (updatedRoom) {
          io.to(roomCode).emit("room_updated", buildRoomUpdatePayload(updatedRoom));
        } else {
          cleanupRoomCaches(roomCode);
        }
        emitPublicMatches(io);
      }
    );

    socket.on("reveal_fact", ({ code, factId, sessionToken }: { code: string; factId: string; sessionToken?: string }) => {
      const roomCode = normalizeRoomCode(code);
      const room = getRoom(roomCode);
      if (!room?.game) return;
      const actorId = resolveActorId({
        socketId: socket.id,
        roomCode,
        room,
        sessionToken
      });
      if (!actorId) return;
      const currentStageName = getCurrentStageName(
        room.game.stages,
        room.game.stageIndex,
      );

      if (isPreparationStage(currentStageName)) {
        socket.emit("error", {
          message: "На этапе «Подготовка» раскрывать факты нельзя.",
        });
        return;
      }

      const currentPlayer = room.game.players.find((p: any) => p.id === actorId);
      if (!currentPlayer) return;

      if (!canRoleRevealFactsAtStage(currentPlayer.roleKey, currentStageName)) {
        socket.emit("error", {
          message:
            "Сейчас вы не можете раскрывать факты. Можно на своем этапе и на этапе «Перекрестный допрос».",
        });
        return;
      }

      const isCurrentPlayerOpeningSpeech = isRoleOpeningSpeechStage(
        currentPlayer.roleKey,
        currentStageName,
      );
      if (isCurrentPlayerOpeningSpeech) {
        const revealedFactsOnThisOpeningStage = room.game.revealedFacts.filter(
          (fact: any) =>
            fact.ownerId === actorId && fact.stageIndex === room.game!.stageIndex,
        ).length;

        if (revealedFactsOnThisOpeningStage >= 2) {
          socket.emit("error", {
            message:
              "На своем вступительном этапе можно раскрыть максимум 2 факта.",
          });
          return;
        }
      }

      const updatedRoom = revealFact(roomCode, actorId, factId);
      if (!updatedRoom) return;

      io.to(roomCode).emit("facts_updated", {
        revealedFacts: updatedRoom.game!.revealedFacts,
        players: updatedRoom.game!.players.map((p: any) => ({ id: p.id, facts: p.facts }))
      });

      const myPlayer = updatedRoom.game!.players.find((p: any) => p.id === actorId);
      if (myPlayer) {
        io.to(myPlayer.socketId).emit("my_facts_updated", { facts: myPlayer.facts });
      }
      emitFactRevealPermissions(io, updatedRoom);
    });

    socket.on("use_card", ({ code, cardId, sessionToken }: { code: string; cardId: string; sessionToken?: string }) => {
      const roomCode = normalizeRoomCode(code);
      const room = getRoom(roomCode);
      if (!room?.game) return;
      const actorId = resolveActorId({
        socketId: socket.id,
        roomCode,
        room,
        sessionToken
      });
      if (!actorId) return;
      const currentStageName = getCurrentStageName(
        room.game.stages,
        room.game.stageIndex,
      );
      if (isPreparationStage(currentStageName)) {
        socket.emit("error", { message: "На этапе «Подготовка» карты механик использовать нельзя." });
        return;
      }

      const updatedRoom = useCard(roomCode, actorId, cardId);
      if (!updatedRoom) return;

      io.to(roomCode).emit("cards_updated", {
        usedCards: updatedRoom.game!.usedCards
      });

      const latestUsedCard =
        updatedRoom.game!.usedCards[updatedRoom.game!.usedCards.length - 1];
      if (latestUsedCard) {
        io.to(roomCode).emit("influence_announcement", {
          id: crypto.randomUUID(),
          kind: "card",
          title: latestUsedCard.name || "CARD",
          durationMs: INFLUENCE_ANNOUNCEMENT_DURATION_MS,
        });
      }

      const myPlayer = updatedRoom.game!.players.find((p: any) => p.id === actorId);
      if (myPlayer) {
        io.to(myPlayer.socketId).emit("my_cards_updated", { cards: myPlayer.cards });
      }
    });
    socket.on("next_stage", ({ code, sessionToken }: { code: string; sessionToken?: string }) => {
      const roomCode = normalizeRoomCode(code);
      const room = getRoom(roomCode);
      if (!room?.game) return;
      const actorId = resolveActorId({
        socketId: socket.id,
        roomCode,
        room,
        sessionToken
      });
      if (!actorId) return;
      const judgePlayer = room.game.players.find((p: any) => p.roleKey === "judge");
      const canControl = room.hostId === actorId || judgePlayer?.id === actorId;
      if (!canControl) {
        socket.emit("error", { message: "Только ведущий или судья может менять этапы." });
        return;
      }

      const updatedRoom = nextStage(roomCode);
      if (!updatedRoom) return;

      io.to(roomCode).emit("stage_updated", { stageIndex: updatedRoom.game!.stageIndex });
      emitPublicMatches(io);
      emitFactRevealPermissions(io, updatedRoom);
    });

    socket.on("prev_stage", ({ code, sessionToken }: { code: string; sessionToken?: string }) => {
      const roomCode = normalizeRoomCode(code);
      const room = getRoom(roomCode);
      if (!room?.game) return;
      const actorId = resolveActorId({
        socketId: socket.id,
        roomCode,
        room,
        sessionToken
      });
      if (!actorId) return;
      const judgePlayer = room.game.players.find((p: any) => p.roleKey === "judge");
      const canControl = room.hostId === actorId || judgePlayer?.id === actorId;
      if (!canControl) {
        socket.emit("error", { message: "Только ведущий или судья может менять этапы." });
        return;
      }

      const updatedRoom = prevStage(roomCode);
      if (!updatedRoom) return;

      io.to(roomCode).emit("stage_updated", { stageIndex: updatedRoom.game!.stageIndex });
      emitPublicMatches(io);
      emitFactRevealPermissions(io, updatedRoom);
    });

    socket.on("set_verdict", ({ code, verdict, sessionToken }: { code: string; verdict: string; sessionToken?: string }) => {
      const roomCode = normalizeRoomCode(code);
      const room = getRoom(roomCode);
      if (!room?.game) return;
      const actorId = resolveActorId({
        socketId: socket.id,
        roomCode,
        room,
        sessionToken
      });
      if (!actorId) return;

      const judgePlayer = room.game.players.find((p: any) => p.roleKey === "judge");
      if (!judgePlayer || judgePlayer.id !== actorId) {
        socket.emit("error", { message: "Только судья может выносить вердикт." });
        return;
      }

      const updatedRoom = setVerdict(roomCode, verdict);
      if (!updatedRoom) return;
      const expectedVerdict = resolveExpectedVerdictFromTruth(
        updatedRoom.game?.caseData?.truth,
      );
      void recordMatchOutcome({
        roomCode,
        verdict,
        expectedVerdict,
        matchStartedAt: updatedRoom.game?.matchStartedAt,
        matchFinishedAt: Date.now(),
        players: (updatedRoom.game?.players ?? []).map((player: any) => ({
          userId: player.userId,
          roleKey: player.roleKey,
          nickname: player.name,
          roleTitle: player.roleTitle,
        })),
      }).catch((error) => {
        console.error("recordMatchOutcome failed", error);
      });
      const closeAt = Date.now() + VERDICT_ROOM_CLOSE_MS;
      updatedRoom.game!.verdictCloseAt = closeAt;

      io.to(roomCode).emit("verdict_set", {
        verdict: updatedRoom.game!.verdict,
        verdictEvaluation: updatedRoom.game!.verdictEvaluation,
        finished: true,
        closeAt,
        truth: updatedRoom.game!.caseData.truth
      });
      scheduleVerdictRoomClose(roomCode);
      emitPublicMatches(io);
    });

    function handleLeave(socketId: string, preserveForRejoin: boolean) {
      const info = socketToRoom.get(socketId);
      if (!info) return;

      socketToRoom.delete(socketId);

      const room = getRoom(info.roomCode);
      if (!room) return;
      const lobbyPlayer = room?.players.find((p: any) => p.id === info.playerId);
      const gamePlayer = room?.game?.players.find((p: any) => p.id === info.playerId);
      const leavingPlayer = lobbyPlayer || gamePlayer;
      const leavingName = leavingPlayer?.name || "Игрок";
      const wasInGame = !!room?.game;
      const shouldPreserveReconnect =
        preserveForRejoin &&
        !(!wasInGame && room.hostId === info.playerId && room.players.length <= 1);

      if (wasInGame) {
        if (shouldPreserveReconnect) {
          const disconnectedUntil = Date.now() + RECONNECT_GRACE_MS;
          const updatedRoom =
            markPlayerDisconnected(info.roomCode, info.playerId, disconnectedUntil) ??
            room;
          socket.leave(info.roomCode);
          socket.emit("reconnect_available", {
            code: info.roomCode,
            sessionToken: info.sessionToken,
            expiresAt: disconnectedUntil,
            timeoutMs: RECONNECT_GRACE_MS,
            persistent: false,
          });

          socket.to(info.roomCode).emit("player_left", {
            playerId: info.playerId,
            playerName: leavingName,
            disconnectedUntil,
          });

          if (updatedRoom?.game) {
            io.to(info.roomCode).emit("game_players_updated", {
              players: mapGamePlayers(updatedRoom.game.players),
            });
            const connectedPlayersCount = updatedRoom.game.players.filter(
              (player: any) =>
                typeof player?.socketId === "string" && player.socketId.trim().length > 0,
            ).length;
            const reconnectablePlayersCount = updatedRoom.game.players.filter((player: any) => {
              const isConnected =
                typeof player?.socketId === "string" && player.socketId.trim().length > 0;
              if (isConnected) return false;
              return (
                typeof player?.disconnectedUntil === "number" &&
                player.disconnectedUntil > Date.now()
              );
            }).length;
            if (connectedPlayersCount === 0 && reconnectablePlayersCount === 0) {
              closeRoomAndNotify(
                info.roomCode,
                "Матч закрыт, так как в комнате не осталось активных игроков.",
              );
              return;
            }
          }
          emitPublicMatches(io);
          scheduleReconnectCleanup(info.roomCode, info.playerId);
        } else {
          clearReconnectCleanup(info.roomCode, info.playerId);
          const updatedRoom = removePlayer(info.roomCode, info.playerId);

          socket.to(info.roomCode).emit("player_left", {
            playerId: info.playerId,
            playerName: leavingName
          });

          if (updatedRoom?.game) {
            io.to(info.roomCode).emit("game_players_updated", {
              players: mapGamePlayers(updatedRoom.game.players),
            });
            const connectedPlayersCount = updatedRoom.game.players.filter(
              (player: any) =>
                typeof player?.socketId === "string" && player.socketId.trim().length > 0,
            ).length;
            if (connectedPlayersCount === 0) {
              closeRoomAndNotify(
                info.roomCode,
                "Матч закрыт, так как в комнате не осталось активных игроков.",
              );
              return;
            }
          }
          emitPublicMatches(io);
        }
      } else {
        if (shouldPreserveReconnect) {
          const disconnectedUntil = Date.now() + RECONNECT_GRACE_MS;
          const updatedRoom =
            markPlayerDisconnected(info.roomCode, info.playerId, disconnectedUntil) ??
            room;
          socket.leave(info.roomCode);
          socket.emit("reconnect_available", {
            code: info.roomCode,
            sessionToken: info.sessionToken,
            expiresAt: disconnectedUntil,
            timeoutMs: RECONNECT_GRACE_MS,
            persistent: false,
          });
          socket.to(info.roomCode).emit("room_updated", {
            ...buildRoomUpdatePayload(updatedRoom),
          });
          const connectedPlayersCount = updatedRoom.players.filter(
            (player: any) =>
              typeof player?.socketId === "string" && player.socketId.trim().length > 0,
          ).length;
          const reconnectablePlayersCount = updatedRoom.players.filter((player: any) => {
            const isConnected =
              typeof player?.socketId === "string" && player.socketId.trim().length > 0;
            if (isConnected) return false;
            return (
              typeof player?.disconnectedUntil === "number" &&
              player.disconnectedUntil > Date.now()
            );
          }).length;
          if (connectedPlayersCount === 0 && reconnectablePlayersCount === 0) {
            clearReconnectCleanup(info.roomCode, info.playerId);
            deleteRoom(info.roomCode);
            emitPublicMatches(io);
            deleteRoomSnapshot(info.roomCode);
            return;
          }
          emitPublicMatches(io);
          scheduleReconnectCleanup(info.roomCode, info.playerId);
        } else {
          clearReconnectCleanup(info.roomCode, info.playerId);
          const updatedRoom = removePlayer(info.roomCode, info.playerId);
          if (updatedRoom) {
            socket.to(info.roomCode).emit("room_updated", {
              ...buildRoomUpdatePayload(updatedRoom),
            });
            const connectedPlayersCount = updatedRoom.players.filter(
              (player: any) =>
                typeof player?.socketId === "string" && player.socketId.trim().length > 0,
            ).length;
            if (connectedPlayersCount === 0) {
              deleteRoom(info.roomCode);
              emitPublicMatches(io);
              deleteRoomSnapshot(info.roomCode);
              return;
            }
          }
          emitPublicMatches(io);
        }
      }
    }

    socket.on("leave_room", (payload?: { preserveForRejoin?: boolean }) => {
      const preserveForRejoin = payload?.preserveForRejoin !== false;
      handleLeave(socket.id, preserveForRejoin);
    });

    socket.on("disconnect", () => {
      const preserveForRejoin = !forcedNoRejoinDisconnect.delete(socket.id);
      handleLeave(socket.id, preserveForRejoin);
      socketIpById.delete(socket.id);
    });
  });

  return io;
}


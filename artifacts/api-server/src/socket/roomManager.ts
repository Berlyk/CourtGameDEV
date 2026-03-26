import {
  mechanicPool,
  cases,
  roleOrderByCount,
} from "./gameData.js";

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
  name: string;
  selectedBadgeKey?: string;
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
}

export interface Room {
  code: string;
  roomName?: string;
  modeKey: RoomModeKey;
  maxPlayers: number;
  hostId: string;
  players: Player[];
  game: GameState | null;
  started: boolean;
  isHostJudge: boolean;
  visibility: "public" | "private";
  password?: string;
  venueLabel?: string;
  venueUrl?: string;
  createdAt: number;
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
}

export interface CreateRoomOptions {
  modeKey?: RoomModeKey;
  visibility?: "public" | "private";
  password?: string;
  roomName?: string;
  venueLabel?: string;
  venueUrl?: string;
}

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

function normalizeLoadedPlayer(player: any): Player | null {
  if (!player || typeof player.id !== "string" || typeof player.name !== "string") {
    return null;
  }
  return {
    id: player.id,
    userId: typeof player.userId === "string" ? player.userId : undefined,
    name: player.name,
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
      visibility: normalizeVisibility(snapshot.visibility),
      password:
        typeof snapshot.password === "string" && snapshot.password.trim()
          ? snapshot.password.trim()
          : undefined,
      venueLabel:
        typeof snapshot.venueLabel === "string" ? snapshot.venueLabel : undefined,
      venueUrl: typeof snapshot.venueUrl === "string" ? snapshot.venueUrl : undefined,
      createdAt:
        typeof snapshot.createdAt === "number" ? snapshot.createdAt : Date.now(),
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
      };
      loadedRoom.started = true;
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
  const room: Room = {
    code,
    roomName,
    modeKey,
    maxPlayers,
    hostId: player.id,
    players: [player],
    game: null,
    started: false,
    isHostJudge: false,
    visibility,
    password,
    venueLabel,
    venueUrl,
    createdAt: Date.now(),
    lobbyChat: [],
  };
  rooms.set(code, room);
  return room;
}

export function setHostJudge(code: string, isHostJudge: boolean): Room | null {
  const room = rooms.get(code);
  if (!room) return null;
  room.isHostJudge = isHostJudge;
  return room;
}

export function getRoom(code: string): Room | undefined {
  return rooms.get(code);
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
  return room;
}

export function joinRunningGameAsWitness(code: string, player: Player): Room | null {
  const room = rooms.get(code);
  if (!room?.game) return null;

  const witnessPlayer: Player = {
    ...player,
    roleKey: "witness",
    roleTitle: "\u0421\u0432\u0438\u0434\u0435\u0442\u0435\u043b\u044c",
    goal: "\u041d\u0430\u0431\u043b\u044e\u0434\u0430\u0442\u044c \u0437\u0430 \u043f\u0440\u043e\u0446\u0435\u0441\u0441\u043e\u043c \u0441\u0443\u0434\u0430 \u0438, \u043f\u043e \u0442\u0440\u0435\u0431\u043e\u0432\u0430\u043d\u0438\u044e \u0441\u0443\u0434\u044c\u0438, \u0434\u0430\u0432\u0430\u0442\u044c \u043f\u043e\u043a\u0430\u0437\u0430\u043d\u0438\u044f \u0432\u043e \u0432\u0440\u0435\u043c\u044f \u043f\u0435\u0440\u0435\u043a\u0440\u0451\u0441\u0442\u043d\u043e\u0433\u043e \u0434\u043e\u043f\u0440\u043e\u0441\u0430.",
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
  avatar?: string | null
): { room: Room; playerId: string; playerName: string } | null {
  const room = rooms.get(code);
  if (!room) return null;
  const normalizedToken = sessionToken.trim();
  if (!normalizedToken) return null;
  const normalizedAvatar = avatar || undefined;

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
      const lobbyPlayer = room.players.find(p => p.id === player.id);
      if (lobbyPlayer) {
        lobbyPlayer.socketId = newSocketId;
        lobbyPlayer.disconnectedUntil = undefined;
        if (avatar !== undefined) {
          lobbyPlayer.avatar = normalizedAvatar;
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
    return { room, playerId: player.id, playerName: player.name };
  }

  return null;
}

export function reclaimDisconnectedPlayerByName(
  code: string,
  playerName: string,
  newSocketId: string,
  avatar?: string | null,
): { room: Room; playerId: string; playerName: string; sessionToken: string } | null {
  const room = rooms.get(code);
  if (!room) return null;

  const normalizedName = playerName.trim().toLowerCase();
  if (!normalizedName) return null;
  const normalizedAvatar = avatar || undefined;

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
  }

  const mirrorGamePlayer = room.game?.players.find((p) => p.id === targetPlayer.id);
  if (mirrorGamePlayer) {
    mirrorGamePlayer.socketId = newSocketId;
    mirrorGamePlayer.disconnectedUntil = undefined;
    mirrorGamePlayer.sessionToken = targetPlayer.sessionToken;
    if (avatar !== undefined) {
      mirrorGamePlayer.avatar = normalizedAvatar;
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
): { room: Room; playerId: string; playerName: string; sessionToken: string } | null {
  const room = rooms.get(code);
  if (!room) return null;
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) return null;
  const normalizedAvatar = avatar || undefined;

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
  }

  const mirrorGamePlayer = room.game?.players.find((p) => p.id === targetPlayer.id);
  if (mirrorGamePlayer) {
    mirrorGamePlayer.socketId = newSocketId;
    mirrorGamePlayer.disconnectedUntil = undefined;
    mirrorGamePlayer.sessionToken = targetPlayer.sessionToken;
    if (avatar !== undefined) {
      mirrorGamePlayer.avatar = normalizedAvatar;
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

  if (room.hostId === playerId) {
    const nextHostId = room.players[0]?.id ?? room.game?.players[0]?.id;
    if (nextHostId) {
      room.hostId = nextHostId;
    }
  }

  return room;
}

export function markPlayerDisconnected(
  code: string,
  playerId: string,
  disconnectedUntil: number,
): Room | null {
  const room = rooms.get(code);
  if (!room) return null;

  const applyDisconnected = (player?: Player) => {
    if (!player) return;
    player.socketId = "";
    player.disconnectedUntil = disconnectedUntil;
  };

  applyDisconnected(room.players.find((p) => p.id === playerId));
  if (room.game) {
    applyDisconnected(room.game.players.find((p) => p.id === playerId));
  }

  return room;
}

export function listPublicMatches(): PublicMatchInfo[] {
  cleanupStaleRooms();
  return [...rooms.values()]
    .map((room) => {
      const hostPlayer =
        room.players.find((p) => p.id === room.hostId) ??
        room.game?.players.find((p: any) => p.id === room.hostId);
      const playerSource = room.game ? room.game.players : room.players;
      const connectedPlayersCount = playerSource.filter(
        (p: any) => typeof p?.socketId === "string" && p.socketId.trim().length > 0,
      ).length;

      return {
        code: room.code,
        roomName: room.roomName,
        modeKey: room.modeKey,
        visibility: room.visibility,
        hostName: hostPlayer?.name ?? "Host",
        playerCount: connectedPlayersCount,
        maxPlayers: room.maxPlayers,
        started: room.started,
        currentStage: room.game
          ? room.game.stages[room.game.stageIndex] ?? undefined
          : undefined,
        createdAt: room.createdAt,
        venueLabel: room.venueLabel,
        venueUrl: room.venueUrl,
        requiresPassword: !!room.password,
      };
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}

function isPlayerConnected(player: Player): boolean {
  return typeof player?.socketId === "string" && player.socketId.trim().length > 0;
}

function canStillReconnect(player: Player, nowMs: number): boolean {
  const hasAccount = typeof player.userId === "string" && player.userId.trim().length > 0;
  if (hasAccount) return true;
  return (
    !isPlayerConnected(player) &&
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
    const hasReconnectWindow = sourcePlayers.some((player) => canStillReconnect(player, nowMs));
    const finishedWithoutPeople = !!room.game?.finished && !hasConnectedPlayers && !hasReconnectWindow;
    const emptyRoom = sourcePlayers.length === 0;
    const disconnectedAndExpired = !hasConnectedPlayers && !hasReconnectWindow;

    if (hardExpired || finishedWithoutPeople || emptyRoom || disconnectedAndExpired) {
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
    const socketId = player.socketId?.trim() ?? "";
    if (!socketId) return;
    if (isSocketAlive(socketId)) return;

    player.socketId = "";
    if (
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
  },
): Room | null {
  const room = rooms.get(code);
  if (!room) return null;

  const normalizedName = profile.name?.trim();
  const normalizedAvatar = profile.avatar || undefined;
  const normalizedBanner = profile.banner || undefined;
  const normalizedBadgeKey = profile.selectedBadgeKey || undefined;
  const hasName = !!normalizedName;
  const hasAvatar = profile.avatar !== undefined;
  const hasBanner = profile.banner !== undefined;
  const hasBadge = profile.selectedBadgeKey !== undefined;

  if (!hasName && !hasAvatar && !hasBanner && !hasBadge) return room;

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

  return room;
}

export function startGame(code: string): Room | null {
  const room = rooms.get(code);
  if (!room) return null;
  if (room.modeKey === "quick_flex") {
    if (room.players.length < 3 || room.players.length > room.maxPlayers) {
      return null;
    }
  } else if (room.players.length !== room.maxPlayers) {
    return null;
  }

const count = room.players.length;
const availableCases = cases[count] || cases[3];

console.log("=== START GAME ===");
console.log("PLAYER COUNT:", count);
console.log(
  "AVAILABLE CASES:",
  availableCases.map((c: any) => `${c.id} | ${c.title}`)
);

const selectedCase = pickRandom(availableCases)[0];
const roleKeys = shuffle(roleOrderByCount[count]);
const stages = buildStagesByPlayerCount(count);

  if (room.isHostJudge) {
    const hostIndex = room.players.findIndex(p => p.id === room.hostId);
    const judgeRoleIndex = roleKeys.indexOf("judge");
    if (hostIndex !== -1 && judgeRoleIndex !== -1 && hostIndex !== judgeRoleIndex) {
      [roleKeys[hostIndex], roleKeys[judgeRoleIndex]] = [roleKeys[judgeRoleIndex], roleKeys[hostIndex]];
    }
  }

  const assignedPlayers: Player[] = room.players.map((player, index) => {
    const roleKey = roleKeys[index];
    const roleData = selectedCase.roles[roleKey];
    return {
      ...player,
      roleKey,
      roleTitle: roleData.title,
      goal: roleData.goal,
      facts: roleKey === "judge" ? [] : roleData.facts.map((text: string, i: number) => ({
        id: `${player.id}-fact-${i}`,
        text,
        revealed: false
      })),
      cards: roleKey === "judge" ? [] : pickRandom(mechanicPool, 3).map((card: any, i: number) => ({
        ...card,
        id: `${player.id}-card-${i}`,
        used: false
      }))
    };
  });

  room.game = {
    caseData: selectedCase,
    players: assignedPlayers,
    stages,
    stageIndex: 0,
    revealedFacts: [],
    usedCards: [],
    activeProtest: null,
    finished: false,
    verdict: "",
    verdictEvaluation: "",
    verdictCloseAt: null,
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

export function setVerdict(code: string, verdict: string): Room | null {
  const room = rooms.get(code);
  if (!room?.game) return null;

  const truth = room.game.caseData.truth.toLowerCase().replace(/ё/g, "е");
  let expectedVerdict = "Частично виновен";

  if (truth.includes("не виновен") || truth.includes("не виноват")) {
    expectedVerdict = "Не виновен";
  } else if (truth.includes("частично винов")) {
    expectedVerdict = "Частично виновен";
  } else {
    expectedVerdict = "Виновен";
  }

  const verdictEvaluation =
    verdict === expectedVerdict
      ? `Судья вынес правильный вердикт: ${verdict}.`
      : `Судья ошибся. Правильнее было бы выбрать: ${expectedVerdict}.`;

  room.game.verdict = verdict;
  room.game.verdictEvaluation = verdictEvaluation;
  room.game.finished = true;

  return room;
}


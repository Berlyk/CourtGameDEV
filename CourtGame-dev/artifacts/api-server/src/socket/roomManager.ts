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
  name: string;
  socketId: string;
  sessionToken?: string;
  avatar?: string;
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

export interface GameState {
  caseData: any;
  players: Player[];
  stages: string[];
  stageIndex: number;
  revealedFacts: RevealedFact[];
  usedCards: UsedCard[];
  finished: boolean;
  verdict: string;
  verdictEvaluation: string;
}

export interface Room {
  code: string;
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
  hostName: string;
  playerCount: number;
  maxPlayers: number;
  started: boolean;
  createdAt: number;
  venueLabel?: string;
  venueUrl?: string;
  requiresPassword: boolean;
}

export interface CreateRoomOptions {
  visibility?: "public" | "private";
  password?: string;
  venueLabel?: string;
  venueUrl?: string;
}

const rooms = new Map<string, Room>();

function normalizeVisibility(value: string | undefined): "public" | "private" {
  if (value === "public") return "public";
  return "private";
}

function normalizeRoomPassword(password: string | undefined): string | undefined {
  if (!password) return undefined;
  const trimmed = password.trim();
  return trimmed ? trimmed.slice(0, 64) : undefined;
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
  const visibility = normalizeVisibility(options?.visibility);
  const password = normalizeRoomPassword(options?.password);
  const venueLabel = normalizeVenueLabel(options?.venueLabel);
  const venueUrl = normalizeVenueUrl(options?.venueUrl);
  const room: Room = {
    code,
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
  if (room.players.length >= 6) return null;
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
      if (avatar !== undefined) {
        player.avatar = normalizedAvatar;
      }
      const lobbyPlayer = room.players.find(p => p.id === player.id);
      if (lobbyPlayer) {
        lobbyPlayer.socketId = newSocketId;
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
    if (avatar !== undefined) {
      player.avatar = normalizedAvatar;
    }
    return { room, playerId: player.id, playerName: player.name };
  }

  return null;
}

export function removePlayer(code: string, playerId: string): Room | null {
  const room = rooms.get(code);
  if (!room) return null;
  room.players = room.players.filter(p => p.id !== playerId);
  if (room.players.length === 0) {
    rooms.delete(code);
    return null;
  }
  if (room.hostId === playerId && room.players.length > 0) {
    room.hostId = room.players[0].id;
  }
  return room;
}

export function listPublicMatches(): PublicMatchInfo[] {
  return [...rooms.values()]
    .filter((room) => room.visibility === "public")
    .map((room) => {
      const connectedLobbyPlayers = room.players.filter((p) => !!p.socketId);
      const hostPlayer =
        room.players.find((p) => p.id === room.hostId) ??
        room.game?.players.find((p: any) => p.id === room.hostId);

      return {
        code: room.code,
        hostName: hostPlayer?.name ?? "Host",
        playerCount: connectedLobbyPlayers.length,
        maxPlayers: 6,
        started: room.started,
        createdAt: room.createdAt,
        venueLabel: room.venueLabel,
        venueUrl: room.venueUrl,
        requiresPassword: !!room.password,
      };
    })
    .filter((match) => match.playerCount > 0)
    .sort((a, b) => b.createdAt - a.createdAt);
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
  profile: { name?: string; avatar?: string | null },
): Room | null {
  const room = rooms.get(code);
  if (!room) return null;

  const normalizedName = profile.name?.trim();
  const normalizedAvatar = profile.avatar || undefined;
  const hasName = !!normalizedName;
  const hasAvatar = profile.avatar !== undefined;

  if (!hasName && !hasAvatar) return room;

  const applyProfile = (player: Player) => {
    if (hasName && normalizedName) {
      player.name = normalizedName;
    }
    if (hasAvatar) {
      player.avatar = normalizedAvatar;
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
  if (room.players.length < 3 || room.players.length > 6) return null;

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
    finished: false,
    verdict: "",
    verdictEvaluation: ""
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

  const truth = room.game.caseData.truth.toLowerCase();
  let expectedVerdict = "Частично виновен";

  if (truth.includes("не виновен") || truth.includes("Не виновен") || truth.includes("не виноват")) {
    expectedVerdict = "Не виновен";
  } else if (truth.includes("частично виновен") || truth.includes("Частично виновен") || truth.includes("слегка виновен") || truth.includes("частично виновенн")) {
    expectedVerdict = "Частично виновен";
  } else {
    expectedVerdict = "Виновен";
  }

  const verdictEvaluation = verdict === expectedVerdict
    ? `Судья вынес правильный вердикт: ${verdict}.`
    : `Судья ошибся. Правильнее было бы выбрать: ${expectedVerdict}.`;

  room.game.verdict = verdict;
  room.game.verdictEvaluation = verdictEvaluation;
  room.game.finished = true;

  return room;
}

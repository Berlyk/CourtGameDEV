import { Server as SocketIOServer } from "socket.io";
import type { Server as HttpServer } from "http";
import {
  addLobbyChatMessage,
  createRoom,
  joinRoom,
  joinRunningGameAsWitness,
  isJoinPasswordValid,
  rejoinRoom,
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
  setHostJudge,
  updatePlayerAvatar,
  updatePlayerProfile,
  type CreateRoomOptions,
} from "./roomManager.js";

function randomCode(): string {
  return Math.random().toString(36).slice(2, 7).toUpperCase();
}

const PREPARATION_STAGE_MARKER = "подготов";
const CROSS_EXAMINATION_STAGE_MARKERS = ["перекрест", "допрос"];
const OPENING_STAGE_MARKERS = ["выступлен", "вступительн"];
const CLOSING_STAGE_MARKERS = ["финальн", "заключительн"];
const RECONNECT_GRACE_MS = 30_000;
const PROTEST_COOLDOWN_MS = 30_000;
const JUDGE_SILENCE_COOLDOWN_MS = 15_000;
const WARNING_COOLDOWN_MS = 60_000;
const INFLUENCE_ANNOUNCEMENT_DURATION_MS = 3_000;
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
  | "witness";

function normalizeRoleKey(roleKey: string | undefined): CanonicalRole | null {
  if (!roleKey) return null;
  const normalized = roleKey.trim();
  const alias: Record<string, CanonicalRole> = {
    plaintiff: "plaintiff",
    defendant: "defendant",
    plaintiffLawyer: "plaintiffLawyer",
    defenseLawyer: "defenseLawyer",
    defendantLawyer: "defenseLawyer",
    prosecutor: "prosecutor",
    judge: "judge",
    witness: "witness",
  };
  return alias[normalized] ?? null;
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
  const hasDefendant = normalizedStageName.includes("ответчик");
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

  const speechOwnerRole = resolveSpeechOwnerRole(stageName);
  if (!speechOwnerRole || speechOwnerRole !== roleKey) return false;

  const isOpeningStage = isOpeningSpeechStage(stageName);
  const isClosingStage = isClosingSpeechStage(stageName);
  return isOpeningStage || isClosingStage;
}

function isRoleOpeningSpeechStage(roleKey: string | undefined, stageName: string): boolean {
  if (!roleKey || !stageName) return false;
  const speechOwnerRole = resolveSpeechOwnerRole(stageName);
  return !!speechOwnerRole && speechOwnerRole === roleKey && isOpeningSpeechStage(stageName);
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
  return players.map((p: any) => ({
    id: p.id,
    name: p.name,
    avatar: p.avatar,
    roleKey: p.roleKey,
    roleTitle: p.roleTitle,
    warningCount: typeof p?.warningCount === "number" ? p.warningCount : 0,
    disconnectedUntil:
      typeof p?.disconnectedUntil === "number" ? p.disconnectedUntil : undefined,
  }));
}

function mapLobbyPlayers(players: any[]) {
  return players.map((p: any) => ({
    id: p.id,
    name: p.name,
    avatar: p.avatar,
    warningCount: typeof p?.warningCount === "number" ? p.warningCount : 0,
    disconnectedUntil:
      typeof p?.disconnectedUntil === "number" ? p.disconnectedUntil : undefined,
  }));
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
      maxPlayers: room.maxPlayers,
      hostId: room.hostId,
      players: mapLobbyPlayers(room.players),
      started: room.started,
      isHostJudge: room.isHostJudge,
      visibility: room.visibility,
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
    hostId: room.hostId,
    caseData: room.game.caseData,
    stages: room.game.stages,
    stageIndex: room.game.stageIndex,
    revealedFacts: room.game.revealedFacts,
    usedCards: room.game.usedCards,
    finished: room.game.finished,
    verdict: room.game.verdict,
    verdictEvaluation: room.game.verdictEvaluation,
    players: mapGamePlayers(room.game.players),
    me: myPlayer ? {
      id: myPlayer.id,
      name: myPlayer.name,
      avatar: myPlayer.avatar,
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

export function setupSocket(httpServer: HttpServer) {
  const io = new SocketIOServer(httpServer, {
    cors: { origin: "*" },
    path: "/api/socket.io"
  });

  const socketToRoom = new Map<
    string,
    { roomCode: string; playerId: string; sessionToken: string }
  >();
  const reconnectCleanupTimers = new Map<string, ReturnType<typeof setTimeout>>();
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
      io.to(roomCode).emit("room_updated", {
        players: mapLobbyPlayers(room.players),
        hostId: room.hostId,
        roomName: room.roomName,
        modeKey: room.modeKey,
        maxPlayers: room.maxPlayers,
        isHostJudge: room.isHostJudge,
        visibility: room.visibility,
        venueLabel: room.venueLabel,
        venueUrl: room.venueUrl,
        requiresPassword: !!room.password,
        lobbyChat: room.lobbyChat,
      });
    }
    emitPublicMatches(io);
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

  io.on("connection", (socket) => {
    socket.on("list_public_matches", () => {
      socket.emit("public_matches_updated", {
        matches: listPublicMatches(),
      });
    });

    socket.on(
      "create_room",
      ({
        playerName,
        avatar,
        options,
      }: {
        playerName: string;
        avatar?: string | null;
        options?: CreateRoomOptions;
      }) => {
      const code = randomCode();
      const playerId = crypto.randomUUID();
      const sessionToken = crypto.randomUUID();
      const player = {
        id: playerId,
        name: playerName || "Игрок 1",
        socketId: socket.id,
        sessionToken,
        avatar: avatar || undefined
      };
      const room = createRoom(code, player, options);

      socketToRoom.set(socket.id, { roomCode: code, playerId, sessionToken });
      socket.join(code);
      socket.emit("room_joined", {
        playerId,
        sessionToken,
        state: getRoomState(room, playerId)
      });
      emitPublicMatches(io);
    });

    socket.on("join_room", ({ code, playerName, avatar, password }: { code: string; playerName: string; avatar?: string | null; password?: string }) => {
      const roomCode = normalizeRoomCode(code);
      const room = getRoom(roomCode);
      const trimmedName = (playerName || "").trim();

      if (!room) {
        socket.emit("error", { message: "\u041a\u043e\u043c\u043d\u0430\u0442\u0430 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u0430. \u041f\u0440\u043e\u0432\u0435\u0440\u044c\u0442\u0435 \u043a\u043e\u0434." });
        return;
      }
      if (!trimmedName) {
        socket.emit("error", { message: "\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043d\u0438\u043a\u043d\u0435\u0439\u043c \u043f\u0435\u0440\u0435\u0434 \u0432\u0445\u043e\u0434\u043e\u043c." });
        return;
      }
      if (!isJoinPasswordValid(roomCode, password)) {
        socket.emit("error", { message: "\u041d\u0435\u0432\u0435\u0440\u043d\u044b\u0439 \u043f\u0430\u0440\u043e\u043b\u044c \u043a\u043e\u043c\u043d\u0430\u0442\u044b." });
        return;
      }

      // If a player with this nickname disconnected earlier, reclaim their slot/role.
      const reclaimed = reclaimDisconnectedPlayerByName(
        roomCode,
        trimmedName,
        socket.id,
        avatar,
      );
      if (reclaimed) {
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
        }
        if (reclaimed.room.game) {
          socket.to(roomCode).emit("player_rejoined", {
            playerId: reclaimed.playerId,
            playerName: reclaimed.playerName.trim(),
          });
          io.to(roomCode).emit("game_players_updated", {
            players: mapGamePlayers(reclaimed.room.game.players),
          });
        } else {
          io.to(roomCode).emit("room_updated", {
            players: mapLobbyPlayers(reclaimed.room.players),
            hostId: reclaimed.room.hostId,
            roomName: reclaimed.room.roomName,
            modeKey: reclaimed.room.modeKey,
            maxPlayers: reclaimed.room.maxPlayers,
            isHostJudge: reclaimed.room.isHostJudge,
            visibility: reclaimed.room.visibility,
            venueLabel: reclaimed.room.venueLabel,
            venueUrl: reclaimed.room.venueUrl,
            requiresPassword: !!reclaimed.room.password,
            lobbyChat: reclaimed.room.lobbyChat,
          });
        }
        emitPublicMatches(io);
        return;
      }

      if (isNameTaken(roomCode, trimmedName)) {
        socket.emit("error", { message: `\u041d\u0438\u043a\u043d\u0435\u0439\u043c \u00ab${trimmedName}\u00bb \u0443\u0436\u0435 \u0437\u0430\u043d\u044f\u0442 \u0432 \u044d\u0442\u043e\u0439 \u043a\u043e\u043c\u043d\u0430\u0442\u0435.` });
        return;
      }

      const playerId = crypto.randomUUID();
      const sessionToken = crypto.randomUUID();
      const player = {
        id: playerId,
        name: trimmedName,
        socketId: socket.id,
        sessionToken,
        avatar: avatar || undefined
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
        return;
      }

      if (room.players.length >= room.maxPlayers) {
        socket.emit("error", { message: `Комната заполнена (максимум ${room.maxPlayers} игроков).` });
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

      socket.to(roomCode).emit("room_updated", {
        players: mapLobbyPlayers(updatedRoom.players),
        hostId: updatedRoom.hostId,
        roomName: updatedRoom.roomName,
        modeKey: updatedRoom.modeKey,
        maxPlayers: updatedRoom.maxPlayers,
        isHostJudge: updatedRoom.isHostJudge,
        visibility: updatedRoom.visibility,
        venueLabel: updatedRoom.venueLabel,
        venueUrl: updatedRoom.venueUrl,
        requiresPassword: !!updatedRoom.password,
        lobbyChat: updatedRoom.lobbyChat,
      });
      emitPublicMatches(io);
    });

    socket.on("rejoin_room", ({ code, sessionToken, avatar }: { code: string; sessionToken: string; avatar?: string | null }) => {
      const roomCode = normalizeRoomCode(code);
      if (!sessionToken?.trim()) {
        socket.emit("rejoin_failed", { message: "Недействительная сессия." });
        return;
      }
      const result = rejoinRoom(roomCode, sessionToken, socket.id, avatar);

      if (!result) {
        socket.emit("rejoin_failed", { message: "Комната не найдена или вас нет в ней." });
        return;
      }

      const { room, playerId } = result;
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
        io.to(roomCode).emit("room_updated", {
          players: mapLobbyPlayers(room.players),
          hostId: room.hostId,
          roomName: room.roomName,
          modeKey: room.modeKey,
          maxPlayers: room.maxPlayers,
          isHostJudge: room.isHostJudge,
          visibility: room.visibility,
          venueLabel: room.venueLabel,
          venueUrl: room.venueUrl,
          requiresPassword: !!room.password,
          lobbyChat: room.lobbyChat,
        });
      }
      emitPublicMatches(io);
    });

    socket.on("start_game", ({ code, sessionToken }: { code: string; sessionToken?: string }) => {
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
      if (room.modeKey === "quick_flex") {
        if (room.players.length < 3 || room.players.length > room.maxPlayers) {
          socket.emit("error", {
            message: `Для старта быстрой комнаты нужно от 3 до ${room.maxPlayers} игроков.`,
          });
          return;
        }
      } else if (room.players.length !== room.maxPlayers) {
        socket.emit("error", {
          message: `Для старта нужно ровно ${room.maxPlayers} игроков.`,
        });
        return;
      }

      const updatedRoom = startGame(roomCode);
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
      socket.to(roomCode).emit("room_updated", {
        players: mapLobbyPlayers(room.players),
        hostId: room.hostId,
        roomName: room.roomName,
        modeKey: room.modeKey,
        maxPlayers: room.maxPlayers,
        isHostJudge,
        visibility: room.visibility,
        venueLabel: room.venueLabel,
        venueUrl: room.venueUrl,
        requiresPassword: !!room.password,
        lobbyChat: room.lobbyChat,
      });
    });

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

        io.to(roomCode).emit("room_updated", {
          players: mapLobbyPlayers(room.players),
          hostId: room.hostId,
          roomName: room.roomName,
          modeKey: room.modeKey,
          maxPlayers: room.maxPlayers,
          isHostJudge: room.isHostJudge,
          visibility: room.visibility,
          venueLabel: room.venueLabel,
          venueUrl: room.venueUrl,
          requiresPassword: !!room.password,
          lobbyChat: room.lobbyChat,
        });
      }
    );

    socket.on(
      "update_profile",
      ({
        code,
        name,
        avatar,
        sessionToken,
      }: {
        code: string;
        name?: string;
        avatar?: string | null;
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

        const nextName = name?.trim();
        if (nextName && isNameTakenByOther(roomCode, actorId, nextName)) {
          socket.emit("error", {
            message: `\u041d\u0438\u043a\u043d\u0435\u0439\u043c \u00ab${nextName}\u00bb \u0443\u0436\u0435 \u0437\u0430\u043d\u044f\u0442 \u0432 \u044d\u0442\u043e\u0439 \u043a\u043e\u043c\u043d\u0430\u0442\u0435.`,
          });
          return;
        }

        const updatedRoom = updatePlayerProfile(roomCode, actorId, {
          name: nextName,
          avatar,
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
          io.to(roomCode).emit("room_updated", {
            players: mapLobbyPlayers(updatedRoom.players),
            hostId: updatedRoom.hostId,
            roomName: updatedRoom.roomName,
            modeKey: updatedRoom.modeKey,
            maxPlayers: updatedRoom.maxPlayers,
            isHostJudge: updatedRoom.isHostJudge,
            visibility: updatedRoom.visibility,
            venueLabel: updatedRoom.venueLabel,
            venueUrl: updatedRoom.venueUrl,
            requiresPassword: !!updatedRoom.password,
            lobbyChat: updatedRoom.lobbyChat,
          });
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
        if (normalizeRoleKey(actor.roleKey) === "judge") {
          socket.emit("error", { message: "Судья не использует кнопку «Протестую»." });
          return;
        }

        const stageName = getCurrentStageName(room.game.stages, room.game.stageIndex);
        if (!isCrossExaminationStage(stageName)) {
          socket.emit("error", { message: "Протест доступен только на этапе «Перекрестный допрос»." });
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
        io.to(roomCode).emit("influence_announcement", {
          id: crypto.randomUUID(),
          kind: "protest",
          title: "ПРОТЕСТУЮ!",
          subtitle: actor.roleTitle || actor.name,
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
        if (normalizeRoleKey(targetPlayer.roleKey) === "judge") {
          socket.emit("error", { message: "Судье нельзя выдать предупреждение." });
          return;
        }

        const key = getActionCooldownKey(roomCode, actorId, "warning");
        const now = Date.now();
        const cooldownEndsAt = actionCooldowns.get(key) ?? 0;
        if (cooldownEndsAt > now) {
          socket.emit("influence_cooldown", {
            action: "warning",
            cooldownEndsAt,
          });
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

        const nextCooldownEndsAt = now + WARNING_COOLDOWN_MS;
        actionCooldowns.set(key, nextCooldownEndsAt);
        socket.emit("influence_cooldown", {
          action: "warning",
          cooldownEndsAt: nextCooldownEndsAt,
        });

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
          socket.emit("error", { message: "РЎРЅРёРјР°С‚СЊ РїСЂРµРґСѓРїСЂРµР¶РґРµРЅРёСЏ РјРѕР¶РµС‚ С‚РѕР»СЊРєРѕ СЃСѓРґСЊСЏ." });
          return;
        }

        if (!targetPlayerId || targetPlayerId === actorId) {
          socket.emit("error", { message: "РќРµР»СЊР·СЏ РёР·РјРµРЅРёС‚СЊ РїСЂРµРґСѓРїСЂРµР¶РґРµРЅРёРµ СЌС‚РѕРјСѓ РёРіСЂРѕРєСѓ." });
          return;
        }

        const targetPlayer = room.game.players.find((p: any) => p.id === targetPlayerId);
        if (!targetPlayer) {
          socket.emit("error", { message: "РРіСЂРѕРє РЅРµ РЅР°Р№РґРµРЅ." });
          return;
        }
        if (normalizeRoleKey(targetPlayer.roleKey) === "judge") {
          socket.emit("error", { message: "РЎСѓРґСЊСЋ РЅРµР»СЊР·СЏ РёР·РјРµРЅСЏС‚СЊ РїСЂРµРґСѓРїСЂРµР¶РґРµРЅРёСЏ." });
          return;
        }

        const key = getActionCooldownKey(roomCode, actorId, "warning");
        const now = Date.now();
        const cooldownEndsAt = actionCooldowns.get(key) ?? 0;
        if (cooldownEndsAt > now) {
          socket.emit("influence_cooldown", {
            action: "warning",
            cooldownEndsAt,
          });
          return;
        }

        const result = removeWarningFromPlayer(roomCode, targetPlayerId);
        if (!result) return;
        if (!result.changed) {
          socket.emit("error", {
            message: "РЈ СЌС‚РѕРіРѕ РёРіСЂРѕРєР° РЅРµС‚ РїСЂРµРґСѓРїСЂРµР¶РґРµРЅРёР№.",
          });
          return;
        }

        const nextCooldownEndsAt = now + WARNING_COOLDOWN_MS;
        actionCooldowns.set(key, nextCooldownEndsAt);
        socket.emit("influence_cooldown", {
          action: "warning",
          cooldownEndsAt: nextCooldownEndsAt,
        });

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
          socket.emit("error", { message: "Only host can kick players." });
          return;
        }
        if (room.started || room.game) {
          socket.emit("error", { message: "Kick is available only in lobby before game starts." });
          return;
        }
        if (targetPlayerId === room.hostId) {
          socket.emit("error", { message: "Host cannot be kicked." });
          return;
        }

        const targetPlayer = room.players.find((p: any) => p.id === targetPlayerId);
        if (!targetPlayer) {
          socket.emit("error", { message: "Player not found in room." });
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
            message: "You were kicked from the room by the host."
          });
          io.in(targetSocketId).socketsLeave(roomCode);
        }

        if (updatedRoom) {
          io.to(roomCode).emit("room_updated", {
            players: mapLobbyPlayers(updatedRoom.players),
            hostId: updatedRoom.hostId,
            roomName: updatedRoom.roomName,
            modeKey: updatedRoom.modeKey,
            maxPlayers: updatedRoom.maxPlayers,
            isHostJudge: updatedRoom.isHostJudge,
            visibility: updatedRoom.visibility,
            venueLabel: updatedRoom.venueLabel,
            venueUrl: updatedRoom.venueUrl,
            requiresPassword: !!updatedRoom.password,
            lobbyChat: updatedRoom.lobbyChat,
          });
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

      io.to(roomCode).emit("verdict_set", {
        verdict: updatedRoom.game!.verdict,
        verdictEvaluation: updatedRoom.game!.verdictEvaluation,
        finished: true,
        truth: updatedRoom.game!.caseData.truth
      });
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
          });
          socket.to(info.roomCode).emit("room_updated", {
            players: mapLobbyPlayers(updatedRoom.players),
            hostId: updatedRoom.hostId,
            roomName: updatedRoom.roomName,
            modeKey: updatedRoom.modeKey,
            maxPlayers: updatedRoom.maxPlayers,
            isHostJudge: updatedRoom.isHostJudge,
            visibility: updatedRoom.visibility,
            venueLabel: updatedRoom.venueLabel,
            venueUrl: updatedRoom.venueUrl,
            requiresPassword: !!updatedRoom.password,
            lobbyChat: updatedRoom.lobbyChat,
          });
          emitPublicMatches(io);
          scheduleReconnectCleanup(info.roomCode, info.playerId);
        } else {
          clearReconnectCleanup(info.roomCode, info.playerId);
          const updatedRoom = removePlayer(info.roomCode, info.playerId);
          if (updatedRoom) {
            socket.to(info.roomCode).emit("room_updated", {
              players: mapLobbyPlayers(updatedRoom.players),
              hostId: updatedRoom.hostId,
              roomName: updatedRoom.roomName,
              modeKey: updatedRoom.modeKey,
              maxPlayers: updatedRoom.maxPlayers,
              isHostJudge: updatedRoom.isHostJudge,
              visibility: updatedRoom.visibility,
              venueLabel: updatedRoom.venueLabel,
              venueUrl: updatedRoom.venueUrl,
              requiresPassword: !!updatedRoom.password,
              lobbyChat: updatedRoom.lobbyChat,
            });
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
      handleLeave(socket.id, true);
    });
  });

  return io;
}


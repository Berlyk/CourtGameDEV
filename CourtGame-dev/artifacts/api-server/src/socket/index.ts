import { Server as SocketIOServer } from "socket.io";
import type { Server as HttpServer } from "http";
import {
  addLobbyChatMessage,
  createRoom,
  joinRoom,
  joinRunningGameAsWitness,
  isJoinPasswordValid,
  rejoinRoom,
  isNameTaken,
  isNameTakenByOther,
  listPublicMatches,
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
type SpeechOwnerRole =
  | "plaintiff"
  | "defendant"
  | "plaintiffLawyer"
  | "defenseLawyer"
  | "prosecutor";

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

function isPlayerTemporarilyDisconnected(player: any): boolean {
  return !player?.socketId && (player?.disconnectedUntil ?? 0) > 0;
}

function mapGamePlayers(players: any[]) {
  return players.map((p: any) => ({
    id: p.id,
    name: p.name,
    avatar: p.avatar,
    roleKey: p.roleKey,
    roleTitle: p.roleTitle,
    isDisconnected: isPlayerTemporarilyDisconnected(p),
    reconnectExpiresAt: p.disconnectedUntil ?? null,
  }));
}

function mapLobbyPlayers(players: any[]) {
  return players.map((p: any) => ({
    id: p.id,
    name: p.name,
    avatar: p.avatar,
    isDisconnected: isPlayerTemporarilyDisconnected(p),
    reconnectExpiresAt: p.disconnectedUntil ?? null,
  }));
}

function getRoomState(room: any, playerId: string) {
  if (!room.game) {
    return {
      type: "room",
      code: room.code,
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
  const normalizeRoomCode = (code: string): string => code.trim().toUpperCase();

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

  const disconnectCleanupTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const cleanupKey = (roomCode: string, playerId: string) =>
    `${roomCode}:${playerId}`;

  const clearDisconnectCleanup = (roomCode: string, playerId: string) => {
    const key = cleanupKey(roomCode, playerId);
    const timer = disconnectCleanupTimers.get(key);
    if (!timer) return;
    clearTimeout(timer);
    disconnectCleanupTimers.delete(key);
  };

  const emitRoomUpdated = (room: any) => {
    io.to(room.code).emit("room_updated", {
      players: mapLobbyPlayers(room.players),
      hostId: room.hostId,
      isHostJudge: room.isHostJudge,
      visibility: room.visibility,
      venueLabel: room.venueLabel,
      venueUrl: room.venueUrl,
      requiresPassword: !!room.password,
      lobbyChat: room.lobbyChat,
    });
  };

  const emitGamePlayersUpdated = (room: any) => {
    if (!room?.game) return;
    io.to(room.code).emit("game_players_updated", {
      players: mapGamePlayers(room.game.players),
    });
  };

  const scheduleDisconnectCleanup = (roomCode: string, playerId: string) => {
    clearDisconnectCleanup(roomCode, playerId);

    const key = cleanupKey(roomCode, playerId);
    const timer = setTimeout(() => {
      disconnectCleanupTimers.delete(key);

      const room = getRoom(roomCode);
      if (!room) {
        emitPublicMatches(io);
        return;
      }

      const lobbyPlayer = room.players.find((p: any) => p.id === playerId);
      const gamePlayer = room.game?.players.find((p: any) => p.id === playerId);
      const stillConnected = !!lobbyPlayer?.socketId || !!gamePlayer?.socketId;
      if (stillConnected) {
        emitPublicMatches(io);
        return;
      }

      const deadline = Math.max(
        lobbyPlayer?.disconnectedUntil ?? 0,
        gamePlayer?.disconnectedUntil ?? 0,
      );
      if (deadline > Date.now()) {
        scheduleDisconnectCleanup(roomCode, playerId);
        return;
      }

      const updatedRoom = removePlayer(roomCode, playerId);
      if (updatedRoom) {
        if (updatedRoom.game) {
          emitGamePlayersUpdated(updatedRoom);
        } else {
          emitRoomUpdated(updatedRoom);
        }
      }
      emitPublicMatches(io);
    }, RECONNECT_GRACE_MS + 100);

    disconnectCleanupTimers.set(key, timer);
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
        disconnectedUntil: null,
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
        disconnectedUntil: null,
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
        io.to(roomCode).emit("game_players_updated", {
          players: mapGamePlayers(updatedRoom.game.players)
        });
        emitPublicMatches(io);
        return;
      }

      if (room.players.length >= 6) {
        socket.emit("error", { message: "\u041a\u043e\u043c\u043d\u0430\u0442\u0430 \u0437\u0430\u043f\u043e\u043b\u043d\u0435\u043d\u0430 (\u043c\u0430\u043a\u0441\u0438\u043c\u0443\u043c 6 \u0438\u0433\u0440\u043e\u043a\u043e\u0432)." });
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
      clearDisconnectCleanup(roomCode, playerId);
      socketToRoom.set(socket.id, { roomCode, playerId, sessionToken });
      socket.join(roomCode);

      socket.emit("room_joined", {
        playerId,
        sessionToken,
        state: getRoomState(room, playerId)
      });

      if (room.game) {
        socket.to(roomCode).emit("player_rejoined", {
          playerId,
          playerName: result.playerName.trim()
        });
        emitGamePlayersUpdated(room);
      } else {
        emitRoomUpdated(room);
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
      if (room.players.length < 3) {
        socket.emit("error", { message: "Нужно минимум 3 игрока." });
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
        clearDisconnectCleanup(roomCode, targetPlayerId);
        const updatedRoom = removePlayer(roomCode, targetPlayerId, {
          force: true,
        });

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
          emitRoomUpdated(updatedRoom);
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
    });

    function handleLeave(
      socketId: string,
      fallback?: {
        code?: string;
        sessionToken?: string;
        playerId?: string;
      },
    ): {
      code: string;
      sessionToken: string;
      reconnectExpiresAt: number;
    } | null {
      const mappedInfo = socketToRoom.get(socketId) ?? null;
      const fallbackCode = normalizeRoomCode((fallback?.code ?? "").trim());
      const roomCode = mappedInfo?.roomCode ?? fallbackCode;
      const fallbackToken = (fallback?.sessionToken ?? "").trim();
      const fallbackPlayerId = (fallback?.playerId ?? "").trim();

      if (!roomCode) return null;

      socketToRoom.delete(socketId);
      socket.leave(roomCode);

      const room = getRoom(roomCode);
      if (!room) return null;

      const effectiveSessionToken =
        mappedInfo?.sessionToken ?? fallbackToken;
      const effectiveMappedPlayerId =
        mappedInfo?.playerId ?? fallbackPlayerId;

      let leavingLobbyPlayer =
        room.players.find((p: any) => p.id === effectiveMappedPlayerId) ?? null;
      let leavingGamePlayer =
        room.game?.players.find((p: any) => p.id === effectiveMappedPlayerId) ??
        null;

      if ((!leavingLobbyPlayer || !leavingGamePlayer) && effectiveSessionToken) {
        const byToken = findPlayerBySessionToken(room, effectiveSessionToken);
        if (byToken) {
          leavingLobbyPlayer =
            leavingLobbyPlayer ??
            room.players.find((p: any) => p.id === byToken.id) ??
            null;
          leavingGamePlayer =
            leavingGamePlayer ??
            room.game?.players.find((p: any) => p.id === byToken.id) ??
            null;
        }
      }

      const effectivePlayerId =
        leavingLobbyPlayer?.id ??
        leavingGamePlayer?.id ??
        effectiveMappedPlayerId;
      const reconnectSessionToken =
        effectiveSessionToken ||
        leavingLobbyPlayer?.sessionToken ||
        leavingGamePlayer?.sessionToken ||
        "";
      if (!effectivePlayerId || !reconnectSessionToken) {
        return null;
      }
      const leavingName = leavingLobbyPlayer?.name || leavingGamePlayer?.name || "Guest";
      const disconnectedUntil = Date.now() + RECONNECT_GRACE_MS;

      if (leavingLobbyPlayer) {
        leavingLobbyPlayer.socketId = "";
        leavingLobbyPlayer.disconnectedUntil = disconnectedUntil;
      }
      if (leavingGamePlayer) {
        leavingGamePlayer.socketId = "";
        leavingGamePlayer.disconnectedUntil = disconnectedUntil;
      }

      const reconnectPayload = {
        code: roomCode,
        sessionToken: reconnectSessionToken,
        reconnectExpiresAt: disconnectedUntil,
      };

      io.to(socketId).emit("reconnect_available", reconnectPayload);

      if (room.game) {
        io.to(roomCode).emit("player_left", {
          playerId: effectivePlayerId,
          playerName: leavingName,
          reconnectExpiresAt: disconnectedUntil,
        });
        emitGamePlayersUpdated(room);
      } else {
        emitRoomUpdated(room);
      }

      scheduleDisconnectCleanup(roomCode, effectivePlayerId);
      emitPublicMatches(io);
      return reconnectPayload;
    }

    socket.on(
      "leave_room",
      (
        payload?:
          | {
              code?: string;
              sessionToken?: string;
              playerId?: string;
            }
          | ((payload: {
              code: string;
              sessionToken: string;
              reconnectExpiresAt: number;
            } | null) => void),
        ack?: (payload: {
          code: string;
          sessionToken: string;
          reconnectExpiresAt: number;
        } | null) => void,
      ) => {
      const maybePayload =
        typeof payload === "function" || !payload ? undefined : payload;
      const maybeAck =
        typeof payload === "function" ? payload : ack;
      const reconnectPayload = handleLeave(socket.id, maybePayload);
      if (typeof maybeAck === "function") {
        maybeAck(reconnectPayload);
      }
    },
    );

    socket.on("disconnect", () => {
      handleLeave(socket.id);
    });
  });

  return io;
}

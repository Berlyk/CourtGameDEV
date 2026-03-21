import { Server as SocketIOServer } from "socket.io";
import type { Server as HttpServer } from "http";
import {
  createRoom,
  joinRoom,
  joinRunningGameAsWitness,
  rejoinRoom,
  isNameTaken,
  removePlayer,
  startGame,
  revealFact,
  useCard,
  nextStage,
  prevStage,
  setVerdict,
  getRoom,
  setHostJudge,
  updatePlayerAvatar
} from "./roomManager.js";

function randomCode(): string {
  return Math.random().toString(36).slice(2, 7).toUpperCase();
}

const PREPARATION_STAGE_MARKER = "подготов";
const CROSS_EXAMINATION_STAGE_MARKERS = ["перекрест", "допрос"];
const OPENING_STAGE_MARKERS = ["выступлен", "вступительн"];
const CLOSING_STAGE_MARKERS = ["финальн", "заключительн"];
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
function mapGamePlayers(players: any[]) {
  return players.map((p: any) => ({
    id: p.id,
    name: p.name,
    avatar: p.avatar,
    roleKey: p.roleKey,
    roleTitle: p.roleTitle
  }));
}

function getRoomState(room: any, playerId: string) {
  if (!room.game) {
    return {
      type: "room",
      code: room.code,
      hostId: room.hostId,
      players: room.players.map((p: any) => ({ id: p.id, name: p.name, avatar: p.avatar })),
      started: room.started,
      isHostJudge: room.isHostJudge
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

export function setupSocket(httpServer: HttpServer) {
  const io = new SocketIOServer(httpServer, {
    cors: { origin: "*" },
    path: "/api/socket.io"
  });

  const socketToRoom = new Map<string, { roomCode: string; playerId: string }>();

  io.on("connection", (socket) => {
    socket.on("create_room", ({ playerName, avatar }: { playerName: string; avatar?: string | null }) => {
      const code = randomCode();
      const playerId = crypto.randomUUID();
      const player = { id: playerId, name: playerName || "Игрок 1", socketId: socket.id, avatar: avatar || undefined };
      const room = createRoom(code, player);

      socketToRoom.set(socket.id, { roomCode: code, playerId });
      socket.join(code);
      socket.emit("room_joined", { playerId, state: getRoomState(room, playerId) });
    });

    socket.on("join_room", ({ code, playerName, avatar }: { code: string; playerName: string; avatar?: string | null }) => {
      const roomCode = code.trim().toUpperCase();
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
      if (isNameTaken(roomCode, trimmedName)) {
        socket.emit("error", { message: `\u041d\u0438\u043a\u043d\u0435\u0439\u043c \u00ab${trimmedName}\u00bb \u0443\u0436\u0435 \u0437\u0430\u043d\u044f\u0442 \u0432 \u044d\u0442\u043e\u0439 \u043a\u043e\u043c\u043d\u0430\u0442\u0435.` });
        return;
      }

      const playerId = crypto.randomUUID();
      const player = { id: playerId, name: trimmedName, socketId: socket.id, avatar: avatar || undefined };

      if (room.started) {
        const updatedRoom = joinRunningGameAsWitness(roomCode, player);
        if (!updatedRoom?.game) {
          socket.emit("error", { message: "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0432\u043e\u0439\u0442\u0438 \u0432 \u0443\u0436\u0435 \u0438\u0434\u0443\u0449\u0438\u0439 \u043c\u0430\u0442\u0447." });
          return;
        }

        socketToRoom.set(socket.id, { roomCode, playerId });
        socket.join(roomCode);
        socket.emit("room_joined", { playerId, state: getRoomState(updatedRoom, playerId) });
        io.to(roomCode).emit("game_players_updated", {
          players: mapGamePlayers(updatedRoom.game.players)
        });
        return;
      }

      if (room.players.length >= 6) {
        socket.emit("error", { message: "\u041a\u043e\u043c\u043d\u0430\u0442\u0430 \u0437\u0430\u043f\u043e\u043b\u043d\u0435\u043d\u0430 (\u043c\u0430\u043a\u0441\u0438\u043c\u0443\u043c 6 \u0438\u0433\u0440\u043e\u043a\u043e\u0432)." });
        return;
      }

      const updatedRoom = joinRoom(roomCode, player);
      if (!updatedRoom) {
        socket.emit("error", { message: "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0432\u043e\u0439\u0442\u0438 \u0432 \u043a\u043e\u043c\u043d\u0430\u0442\u0443." });
        return;
      }

      socketToRoom.set(socket.id, { roomCode, playerId });
      socket.join(roomCode);
      socket.emit("room_joined", { playerId, state: getRoomState(updatedRoom, playerId) });

      socket.to(roomCode).emit("room_updated", {
        players: updatedRoom.players.map((p: any) => ({ id: p.id, name: p.name, avatar: p.avatar })),
        hostId: updatedRoom.hostId
      });
    });

    socket.on("rejoin_room", ({ code, playerName, avatar }: { code: string; playerName: string; avatar?: string | null }) => {
      const roomCode = code.trim().toUpperCase();
      const result = rejoinRoom(roomCode, playerName, socket.id, avatar);

      if (!result) {
        socket.emit("rejoin_failed", { message: "Комната не найдена или вас нет в ней." });
        return;
      }

      const { room, playerId } = result;
      socketToRoom.set(socket.id, { roomCode, playerId });
      socket.join(roomCode);

      socket.emit("room_joined", { playerId, state: getRoomState(room, playerId) });

      if (room.game) {
        socket.to(roomCode).emit("player_rejoined", { playerId, playerName: playerName.trim() });
      }
    });

    socket.on("start_game", ({ code, playerId }: { code: string; playerId: string }) => {
      const room = getRoom(code);
      if (!room || room.hostId !== playerId) {
        socket.emit("error", { message: "Только ведущий может начать игру." });
        return;
      }
      if (room.players.length < 3) {
        socket.emit("error", { message: "Нужно минимум 3 игрока." });
        return;
      }

      const updatedRoom = startGame(code);
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
    });

    socket.on("set_host_judge", ({ code, playerId, isHostJudge }: { code: string; playerId: string; isHostJudge: boolean }) => {
      const room = getRoom(code);
      if (!room || room.hostId !== playerId) return;
      setHostJudge(code, isHostJudge);
      socket.to(code).emit("room_updated", {
        players: room.players.map((p: any) => ({ id: p.id, name: p.name, avatar: p.avatar })),
        hostId: room.hostId,
        isHostJudge
      });
    });

    socket.on(
      "update_avatar",
      ({ code, playerId, avatar }: { code: string; playerId: string; avatar?: string | null }) => {
        if (!avatar) return;
        const room = updatePlayerAvatar(code, playerId, avatar);
        if (!room) return;

        if (room.game) {
          io.to(code).emit("game_players_updated", {
            players: mapGamePlayers(room.game.players)
          });
          return;
        }

        io.to(code).emit("room_updated", {
          players: room.players.map((p: any) => ({ id: p.id, name: p.name, avatar: p.avatar })),
          hostId: room.hostId,
          isHostJudge: room.isHostJudge
        });
      }
    );

    socket.on(
      "kick_player",
      ({ code, playerId, targetPlayerId }: { code: string; playerId: string; targetPlayerId: string }) => {
        const room = getRoom(code);
        if (!room) {
          socket.emit("error", { message: "Room not found." });
          return;
        }
        if (room.hostId !== playerId) {
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
        const updatedRoom = removePlayer(code, targetPlayerId);

        const mappingEntry = [...socketToRoom.entries()].find(
          ([, value]) => value.roomCode === code && value.playerId === targetPlayerId
        );
        if (mappingEntry) {
          socketToRoom.delete(mappingEntry[0]);
        }
        if (targetSocketId) {
          socketToRoom.delete(targetSocketId);
          io.to(targetSocketId).emit("kicked", {
            message: "You were kicked from the room by the host."
          });
          io.in(targetSocketId).socketsLeave(code);
        }

        if (updatedRoom) {
          io.to(code).emit("room_updated", {
            players: updatedRoom.players.map((p: any) => ({ id: p.id, name: p.name, avatar: p.avatar })),
            hostId: updatedRoom.hostId,
            isHostJudge: updatedRoom.isHostJudge
          });
        }
      }
    );

    socket.on("reveal_fact", ({ code, playerId, factId }: { code: string; playerId: string; factId: string }) => {
      const room = getRoom(code);
      if (!room?.game) return;
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

      const currentPlayer = room.game.players.find((p: any) => p.id === playerId);
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
            fact.ownerId === playerId && fact.stageIndex === room.game!.stageIndex,
        ).length;

        if (revealedFactsOnThisOpeningStage >= 2) {
          socket.emit("error", {
            message:
              "На своем вступительном этапе можно раскрыть максимум 2 факта.",
          });
          return;
        }
      }

      const updatedRoom = revealFact(code, playerId, factId);
      if (!updatedRoom) return;

      io.to(code).emit("facts_updated", {
        revealedFacts: updatedRoom.game!.revealedFacts,
        players: updatedRoom.game!.players.map((p: any) => ({ id: p.id, facts: p.facts }))
      });

      const myPlayer = updatedRoom.game!.players.find((p: any) => p.id === playerId);
      if (myPlayer) {
        io.to(myPlayer.socketId).emit("my_facts_updated", { facts: myPlayer.facts });
      }
      emitFactRevealPermissions(io, updatedRoom);
    });

    socket.on("use_card", ({ code, playerId, cardId }: { code: string; playerId: string; cardId: string }) => {
      const room = getRoom(code);
      if (!room?.game) return;
      const currentStageName = getCurrentStageName(
        room.game.stages,
        room.game.stageIndex,
      );
      if (isPreparationStage(currentStageName)) {
        socket.emit("error", { message: "На этапе «Подготовка» карты механик использовать нельзя." });
        return;
      }

      const updatedRoom = useCard(code, playerId, cardId);
      if (!updatedRoom) return;

      io.to(code).emit("cards_updated", {
        usedCards: updatedRoom.game!.usedCards
      });

      const myPlayer = updatedRoom.game!.players.find((p: any) => p.id === playerId);
      if (myPlayer) {
        io.to(myPlayer.socketId).emit("my_cards_updated", { cards: myPlayer.cards });
      }
    });

    socket.on("next_stage", ({ code, playerId }: { code: string; playerId: string }) => {
      const room = getRoom(code);
      if (!room?.game) return;
      const judgePlayer = room.game.players.find((p: any) => p.roleKey === "judge");
      const canControl = room.hostId === playerId || judgePlayer?.id === playerId;
      if (!canControl) {
        socket.emit("error", { message: "Только ведущий или судья может менять этапы." });
        return;
      }

      const updatedRoom = nextStage(code);
      if (!updatedRoom) return;

      io.to(code).emit("stage_updated", { stageIndex: updatedRoom.game!.stageIndex });
      emitFactRevealPermissions(io, updatedRoom);
    });

    socket.on("prev_stage", ({ code, playerId }: { code: string; playerId: string }) => {
      const room = getRoom(code);
      if (!room?.game) return;
      const judgePlayer = room.game.players.find((p: any) => p.roleKey === "judge");
      const canControl = room.hostId === playerId || judgePlayer?.id === playerId;
      if (!canControl) {
        socket.emit("error", { message: "Только ведущий или судья может менять этапы." });
        return;
      }

      const updatedRoom = prevStage(code);
      if (!updatedRoom) return;

      io.to(code).emit("stage_updated", { stageIndex: updatedRoom.game!.stageIndex });
      emitFactRevealPermissions(io, updatedRoom);
    });

    socket.on("set_verdict", ({ code, playerId, verdict }: { code: string; playerId: string; verdict: string }) => {
      const room = getRoom(code);
      if (!room?.game) return;

      const judgePlayer = room.game.players.find((p: any) => p.roleKey === "judge");
      if (!judgePlayer || judgePlayer.id !== playerId) {
        socket.emit("error", { message: "Только судья может выносить вердикт." });
        return;
      }

      const updatedRoom = setVerdict(code, verdict);
      if (!updatedRoom) return;

      io.to(code).emit("verdict_set", {
        verdict: updatedRoom.game!.verdict,
        verdictEvaluation: updatedRoom.game!.verdictEvaluation,
        finished: true,
        truth: updatedRoom.game!.caseData.truth
      });
    });

    function handleLeave(socketId: string) {
      const info = socketToRoom.get(socketId);
      if (!info) return;

      socketToRoom.delete(socketId);

      const room = getRoom(info.roomCode);
      const leavingPlayer = room?.players.find((p: any) => p.id === info.playerId)
        || room?.game?.players.find((p: any) => p.id === info.playerId);
      const leavingName = leavingPlayer?.name || "Игрок";
      const wasInGame = !!room?.game;

      if (wasInGame) {
        if (leavingPlayer) leavingPlayer.socketId = "";
        socket.to(info.roomCode).emit("player_left", {
          playerId: info.playerId,
          playerName: leavingName
        });
      } else {
        const updatedRoom = removePlayer(info.roomCode, info.playerId);
        if (updatedRoom) {
          socket.to(info.roomCode).emit("room_updated", {
            players: updatedRoom.players.map((p: any) => ({ id: p.id, name: p.name, avatar: p.avatar })),
            hostId: updatedRoom.hostId
          });
        }
      }
    }

    socket.on("leave_room", () => {
      handleLeave(socket.id);
    });

    socket.on("disconnect", () => {
      handleLeave(socket.id);
    });
  });

  return io;
}


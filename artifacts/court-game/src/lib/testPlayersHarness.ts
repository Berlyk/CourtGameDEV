import { io, type Socket } from "socket.io-client";

interface TestFact {
  id: string;
  text: string;
  revealed: boolean;
}

interface TestCard {
  id: string;
  name: string;
  description: string;
  used: boolean;
}

interface TestPlayerInfo {
  id: string;
  name: string;
  avatar?: string;
  roleKey?: string;
  roleTitle?: string;
}

interface TestRoomState {
  type: "room";
  code: string;
  hostId: string;
  players: TestPlayerInfo[];
  started: boolean;
  isHostJudge?: boolean;
}

interface TestGameMe {
  id: string;
  name: string;
  avatar?: string;
  roleKey: string;
  roleTitle: string;
  goal: string;
  facts: TestFact[];
  cards: TestCard[];
  canRevealFactsNow?: boolean;
}

interface TestRevealedFact {
  id: string;
  ownerId?: string;
  text: string;
  owner: string;
  ownerRole: string;
  stageIndex?: number;
}

interface TestUsedCard {
  id: string;
  ownerId?: string;
  owner: string;
  ownerRole: string;
  name: string;
  description: string;
}

interface TestGameState {
  type: "game";
  code: string;
  hostId: string;
  players: TestPlayerInfo[];
  stages: string[];
  stageIndex: number;
  revealedFacts: TestRevealedFact[];
  usedCards: TestUsedCard[];
  finished: boolean;
  verdict: string;
  verdictEvaluation: string;
  me: TestGameMe | null;
}

type TestSocketState = TestRoomState | TestGameState;

interface TestPlayerConnection {
  roomCode: string;
  name: string;
  socket: Socket;
  latestState: TestSocketState | null;
}

interface AddTestPlayersResult {
  added: string[];
  failed: Array<{ name: string; reason: string }>;
  activeCount: number;
}

interface TestActionResult {
  ok: boolean;
  reason?: string;
}

export interface TestRoleView {
  playerId: string;
  playerName: string;
  roleKey: string;
  roleTitle: string;
  goal: string;
  facts: TestFact[];
  cards: TestCard[];
  canRevealFactsNow: boolean;
  stageIndex: number;
  stages: string[];
}

function isTruthyEnvValue(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return (
    normalized === "1" ||
    normalized === "true" ||
    normalized === "yes" ||
    normalized === "on"
  );
}

const TEST_TOOLS_ENABLED = isTruthyEnvValue(
  import.meta.env.VITE_ENABLE_TEST_TOOLS,
);
const TEST_TOOLS_STORAGE_KEY = "court_test_tools_enabled";
const ROOM_CAP = 6;

const roomConnections = new Map<string, TestPlayerConnection[]>();
let testPlayerCounter = 1;

function isTestToolsAllowedHost(): boolean {
  if (typeof window === "undefined") return true;
  const host = window.location.hostname.toLowerCase();

  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".local")
  ) {
    return true;
  }

  return (
    host.includes("-dev") ||
    host.startsWith("dev-") ||
    host.includes("test-")
  );
}

function readStoredFlag(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return isTruthyEnvValue(
      window.localStorage.getItem(TEST_TOOLS_STORAGE_KEY) ?? undefined,
    );
  } catch {
    return false;
  }
}

function readQueryFlag(): boolean | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("test-tools") ?? params.get("testTools");
  if (raw === null) return null;
  return isTruthyEnvValue(raw);
}

function persistFlag(value: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TEST_TOOLS_STORAGE_KEY, value ? "1" : "0");
  } catch {
    // ignore localStorage access issues
  }
}

function resolveBrowserFlag(): boolean {
  const queryFlag = readQueryFlag();
  if (queryFlag !== null) {
    persistFlag(queryFlag);
    return queryFlag;
  }
  return readStoredFlag();
}

function normalizeRoomCode(roomCode: string): string {
  return roomCode.trim().toUpperCase();
}

function getConnections(roomCode: string): TestPlayerConnection[] {
  return roomConnections.get(roomCode) ?? [];
}

function setConnections(roomCode: string, next: TestPlayerConnection[]) {
  if (next.length === 0) {
    roomConnections.delete(roomCode);
    return;
  }
  roomConnections.set(roomCode, next);
}

function findConnection(
  roomCode: string,
  socket: Socket,
): TestPlayerConnection | null {
  const existing = getConnections(roomCode).find((entry) => entry.socket === socket);
  return existing ?? null;
}

function findConnectionByName(
  roomCode: string,
  playerName: string,
): TestPlayerConnection | null {
  const normalizedName = playerName.trim().toLowerCase();
  const existing = getConnections(roomCode).find(
    (entry) => entry.name.trim().toLowerCase() === normalizedName,
  );
  return existing ?? null;
}

function findGameConnectionByPlayerId(
  roomCode: string,
  playerId: string,
): TestPlayerConnection | null {
  const existing = getConnections(roomCode).find(
    (entry) =>
      entry.latestState?.type === "game" && entry.latestState.me?.id === playerId,
  );
  return existing ?? null;
}

function updateGameState(
  roomCode: string,
  socket: Socket,
  updater: (gameState: TestGameState) => TestGameState,
) {
  const entry = findConnection(roomCode, socket);
  if (!entry || !entry.latestState || entry.latestState.type !== "game") return;
  entry.latestState = updater(entry.latestState);
}

function removeConnection(roomCode: string, socket: Socket) {
  const current = getConnections(roomCode);
  if (current.length === 0) return;
  setConnections(
    roomCode,
    current.filter((entry) => entry.socket !== socket),
  );
}

function nextTestPlayerName(existingNames: Set<string>): string {
  while (true) {
    const candidate = `Test Player ${testPlayerCounter++}`;
    if (!existingNames.has(candidate)) return candidate;
  }
}

function toErrorReason(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Unexpected join failure";
}

function attachStateSync(connection: TestPlayerConnection) {
  const { roomCode, socket } = connection;

  socket.on("game_started", ({ state }: { state: TestGameState }) => {
    const entry = findConnection(roomCode, socket);
    if (!entry) return;
    entry.latestState = state;
  });

  socket.on("game_players_updated", ({ players }: { players: TestPlayerInfo[] }) => {
    updateGameState(roomCode, socket, (prev) => ({ ...prev, players }));
  });

  socket.on(
    "facts_updated",
    ({ revealedFacts }: { revealedFacts: TestRevealedFact[] }) => {
      updateGameState(roomCode, socket, (prev) => ({ ...prev, revealedFacts }));
    },
  );

  socket.on("my_facts_updated", ({ facts }: { facts: TestFact[] }) => {
    updateGameState(roomCode, socket, (prev) => {
      if (!prev.me) return prev;
      return { ...prev, me: { ...prev.me, facts } };
    });
  });

  socket.on("cards_updated", ({ usedCards }: { usedCards: TestUsedCard[] }) => {
    updateGameState(roomCode, socket, (prev) => ({ ...prev, usedCards }));
  });

  socket.on("my_cards_updated", ({ cards }: { cards: TestCard[] }) => {
    updateGameState(roomCode, socket, (prev) => {
      if (!prev.me) return prev;
      return { ...prev, me: { ...prev.me, cards } };
    });
  });

  socket.on("stage_updated", ({ stageIndex }: { stageIndex: number }) => {
    updateGameState(roomCode, socket, (prev) => ({ ...prev, stageIndex }));
  });

  socket.on(
    "verdict_set",
    ({
      verdict,
      verdictEvaluation,
      finished,
    }: {
      verdict: string;
      verdictEvaluation: string;
      finished: boolean;
    }) => {
      updateGameState(roomCode, socket, (prev) => ({
        ...prev,
        verdict,
        verdictEvaluation,
        finished,
      }));
    },
  );

  socket.on(
    "fact_reveal_permission",
    ({ canRevealFactsNow }: { canRevealFactsNow: boolean }) => {
      updateGameState(roomCode, socket, (prev) => {
        if (!prev.me) return prev;
        return {
          ...prev,
          me: {
            ...prev.me,
            canRevealFactsNow,
          },
        };
      });
    },
  );
}

async function connectAndJoinRoom(
  roomCode: string,
  name: string,
): Promise<
  | { ok: true; connection: TestPlayerConnection }
  | { ok: false; reason: string }
> {
  return new Promise((resolve) => {
    const socket = io({
      path: "/api/socket.io",
      transports: ["websocket", "polling"],
      forceNew: true,
      reconnection: false,
    });

    let settled = false;
    const settle = (
      result:
        | { ok: true; connection: TestPlayerConnection }
        | { ok: false; reason: string },
    ) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      socket.off("connect", onConnect);
      socket.off("room_joined", onRoomJoined);
      socket.off("error", onJoinError);
      socket.off("connect_error", onConnectError);
      resolve(result);
    };

    const onConnect = () => {
      socket.emit("join_room", {
        code: roomCode,
        playerName: name,
      });
    };

    const onRoomJoined = ({
      state,
    }: {
      playerId: string;
      state: TestSocketState;
    }) => {
      const connection: TestPlayerConnection = {
        roomCode,
        name,
        socket,
        latestState: state,
      };

      socket.on("disconnect", () => {
        removeConnection(roomCode, socket);
      });
      attachStateSync(connection);
      settle({ ok: true, connection });
    };

    const onJoinError = (payload: { message?: string } | string) => {
      const reason =
        typeof payload === "string"
          ? payload
          : payload?.message ?? "Join rejected by server";
      socket.disconnect();
      settle({ ok: false, reason });
    };

    const onConnectError = (error: unknown) => {
      socket.disconnect();
      settle({ ok: false, reason: toErrorReason(error) });
    };

    const timeoutId = window.setTimeout(() => {
      socket.disconnect();
      settle({ ok: false, reason: "Join timeout" });
    }, 5000);

    socket.on("connect", onConnect);
    socket.on("room_joined", onRoomJoined);
    socket.on("error", onJoinError);
    socket.on("connect_error", onConnectError);
  });
}

export function isTestToolsEnabled(): boolean {
  if (!isTestToolsAllowedHost()) return false;
  return TEST_TOOLS_ENABLED || resolveBrowserFlag();
}

export function setTestToolsEnabledForBrowser(enabled: boolean): void {
  if (!isTestToolsAllowedHost()) return;
  persistFlag(enabled);
}

export function canRenderTestToolsUI(): boolean {
  return isTestToolsAllowedHost();
}

export function listTestPlayers(roomCode: string): string[] {
  if (!isTestToolsEnabled()) return [];
  const code = normalizeRoomCode(roomCode);
  return getConnections(code).map((entry) => entry.name);
}

export function listTestRoleViews(roomCode: string): TestRoleView[] {
  if (!isTestToolsEnabled()) return [];
  const code = normalizeRoomCode(roomCode);
  const views: TestRoleView[] = [];

  for (const entry of getConnections(code)) {
    if (!entry.latestState || entry.latestState.type !== "game") continue;
    const me = entry.latestState.me;
    if (!me) continue;
    views.push({
      playerId: me.id,
      playerName: me.name,
      roleKey: me.roleKey,
      roleTitle: me.roleTitle,
      goal: me.goal,
      facts: me.facts ?? [],
      cards: me.cards ?? [],
      canRevealFactsNow: me.canRevealFactsNow === true,
      stageIndex: entry.latestState.stageIndex,
      stages: entry.latestState.stages ?? [],
    });
  }

  return views;
}

export async function addTestPlayers(
  roomCode: string,
  count: number,
): Promise<AddTestPlayersResult> {
  if (!isTestToolsEnabled()) {
    return {
      added: [],
      failed: [{ name: "-", reason: "Test tools are disabled" }],
      activeCount: 0,
    };
  }

  const code = normalizeRoomCode(roomCode);
  const current = getConnections(code);
  const existingNames = new Set(current.map((entry) => entry.name));
  const added: string[] = [];
  const failed: Array<{ name: string; reason: string }> = [];

  const slots = Math.max(0, ROOM_CAP - current.length);
  const safeCount = Math.max(0, Math.min(count, slots));

  for (let i = 0; i < safeCount; i += 1) {
    const name = nextTestPlayerName(existingNames);
    existingNames.add(name);
    const joined = await connectAndJoinRoom(code, name);
    if (!joined.ok) {
      failed.push({ name, reason: joined.reason });
      continue;
    }
    current.push(joined.connection);
    added.push(name);
  }

  setConnections(code, current);
  return { added, failed, activeCount: current.length };
}

export function disconnectTestPlayersFromRoom(roomCode: string): number {
  if (!isTestToolsEnabled()) return 0;
  const code = normalizeRoomCode(roomCode);
  const current = getConnections(code);
  if (current.length === 0) return 0;

  for (const entry of current) {
    entry.socket.emit("leave_room");
    entry.socket.disconnect();
  }
  roomConnections.delete(code);
  return current.length;
}

export function disconnectTestPlayerByName(
  roomCode: string,
  playerName: string,
): boolean {
  if (!isTestToolsEnabled()) return false;
  const code = normalizeRoomCode(roomCode);
  const entry = findConnectionByName(code, playerName);
  if (!entry) return false;

  entry.socket.emit("leave_room");
  entry.socket.disconnect();
  removeConnection(code, entry.socket);
  return true;
}

export function triggerTestPlayerRevealNextFact(
  roomCode: string,
  playerId: string,
): TestActionResult {
  if (!isTestToolsEnabled()) {
    return { ok: false, reason: "Test tools are disabled" };
  }
  const code = normalizeRoomCode(roomCode);
  const entry = findGameConnectionByPlayerId(code, playerId);
  if (!entry || !entry.latestState || entry.latestState.type !== "game" || !entry.latestState.me) {
    return { ok: false, reason: "Player connection not found" };
  }

  const nextFact = entry.latestState.me.facts.find((fact) => !fact.revealed);
  if (!nextFact) {
    return { ok: false, reason: "No unrevealed facts left" };
  }

  entry.socket.emit("reveal_fact", {
    code,
    playerId,
    factId: nextFact.id,
  });

  entry.latestState = {
    ...entry.latestState,
    me: {
      ...entry.latestState.me,
      facts: entry.latestState.me.facts.map((fact) =>
        fact.id === nextFact.id ? { ...fact, revealed: true } : fact,
      ),
    },
  };

  return { ok: true };
}

export function triggerTestPlayerUseNextCard(
  roomCode: string,
  playerId: string,
): TestActionResult {
  if (!isTestToolsEnabled()) {
    return { ok: false, reason: "Test tools are disabled" };
  }
  const code = normalizeRoomCode(roomCode);
  const entry = findGameConnectionByPlayerId(code, playerId);
  if (!entry || !entry.latestState || entry.latestState.type !== "game" || !entry.latestState.me) {
    return { ok: false, reason: "Player connection not found" };
  }

  const nextCard = entry.latestState.me.cards.find((card) => !card.used);
  if (!nextCard) {
    return { ok: false, reason: "No unused cards left" };
  }

  entry.socket.emit("use_card", {
    code,
    playerId,
    cardId: nextCard.id,
  });

  entry.latestState = {
    ...entry.latestState,
    me: {
      ...entry.latestState.me,
      cards: entry.latestState.me.cards.map((card) =>
        card.id === nextCard.id ? { ...card, used: true } : card,
      ),
    },
  };

  return { ok: true };
}

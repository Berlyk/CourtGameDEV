import { io, type Socket } from "socket.io-client";

interface TestPlayerConnection {
  roomCode: string;
  name: string;
  socket: Socket;
}

interface AddTestPlayersResult {
  added: string[];
  failed: Array<{ name: string; reason: string }>;
  activeCount: number;
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

function readStoredFlag(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return isTruthyEnvValue(window.localStorage.getItem(TEST_TOOLS_STORAGE_KEY) ?? undefined);
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
const ROOM_CAP = 6;

const roomConnections = new Map<string, TestPlayerConnection[]>();
let testPlayerCounter = 1;

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

    const onRoomJoined = () => {
      const connection: TestPlayerConnection = { roomCode, name, socket };
      socket.on("disconnect", () => {
        removeConnection(roomCode, socket);
      });
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
  return TEST_TOOLS_ENABLED || resolveBrowserFlag();
}

export function setTestToolsEnabledForBrowser(enabled: boolean): void {
  persistFlag(enabled);
}

export function listTestPlayers(roomCode: string): string[] {
  if (!isTestToolsEnabled()) return [];
  const code = normalizeRoomCode(roomCode);
  return getConnections(code).map((entry) => entry.name);
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

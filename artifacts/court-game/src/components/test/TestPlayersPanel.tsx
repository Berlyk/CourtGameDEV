import { useEffect, useMemo, useState } from "react";
import { Eye, LogIn, Play, UserPlus, UserX, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  addTestPlayers,
  disconnectTestPlayerByName,
  disconnectTestPlayersFromRoom,
  isTestToolsEnabled,
  listTestPlayers,
  listTestRoleViews,
  setTestToolsEnabledForBrowser,
  triggerTestPlayerRevealNextFact,
  triggerTestPlayerUseNextCard,
  type TestRoleView,
} from "@/lib/testPlayersHarness";

interface PlayerOption {
  id: string;
  name: string;
  roleTitle?: string;
  isHost?: boolean;
}

interface TestPlayersPanelProps {
  roomCode: string;
  currentPlayers: number;
  isHost: boolean;
  mode: "room" | "game";
  players: PlayerOption[];
  currentPlayerId?: string | null;
  onTakeOverPlayer?: (playerName: string) => void;
  onStartGame?: () => void;
  canStartGame?: boolean;
  stages?: string[];
  currentStageIndex?: number;
  onJumpToStage?: (targetIndex: number) => void;
  canControlStages?: boolean;
  selfRoleView?: TestRoleView | null;
}

const ROOM_CAP = 6;

function mergeRoleViews(
  selfRoleView: TestRoleView | null | undefined,
  externalViews: TestRoleView[],
): TestRoleView[] {
  const byId = new Map<string, TestRoleView>();
  for (const view of externalViews) byId.set(view.playerId, view);
  if (selfRoleView) byId.set(selfRoleView.playerId, selfRoleView);
  return [...byId.values()];
}

export default function TestPlayersPanel({
  roomCode,
  currentPlayers,
  isHost,
  mode,
  players,
  currentPlayerId = null,
  onTakeOverPlayer,
  onStartGame,
  canStartGame,
  stages = [],
  currentStageIndex = 0,
  onJumpToStage,
  canControlStages = false,
  selfRoleView,
}: TestPlayersPanelProps) {
  const [managedPlayers, setManagedPlayers] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [toolsEnabled, setToolsEnabled] = useState(isTestToolsEnabled());
  const [open, setOpen] = useState(false);
  const [roleViews, setRoleViews] = useState<TestRoleView[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);

  const enabled = toolsEnabled;
  const availableSlots = useMemo(
    () => Math.max(0, ROOM_CAP - currentPlayers),
    [currentPlayers],
  );

  const selectedRole =
    roleViews.find((role) => role.playerId === selectedRoleId) ??
    roleViews[0] ??
    null;

  useEffect(() => {
    if (!isHost) return;
    setToolsEnabled(isTestToolsEnabled());
  }, [isHost, roomCode]);

  useEffect(() => {
    if (!enabled || !open) return;
    setManagedPlayers(listTestPlayers(roomCode));
    setStatus("");
  }, [enabled, roomCode, open, mode]);

  useEffect(() => {
    if (!enabled || !open || mode !== "game") return;

    const refreshRoleViews = () => {
      const views = mergeRoleViews(selfRoleView, listTestRoleViews(roomCode));
      setRoleViews(views);
      setSelectedRoleId((prev) => prev ?? views[0]?.playerId ?? null);
    };

    refreshRoleViews();
    const timer = window.setInterval(refreshRoleViews, 900);
    return () => window.clearInterval(timer);
  }, [enabled, open, mode, roomCode, selfRoleView]);

  if (!isHost && !toolsEnabled) return null;

  const handleAdd = async (count: number) => {
    if (!isHost) {
      setStatus("Только хост может добавлять тест-игроков.");
      return 0;
    }
    if (busy || availableSlots <= 0) return 0;
    setBusy(true);
    setStatus("");

    const result = await addTestPlayers(roomCode, Math.min(count, availableSlots));
    setManagedPlayers(listTestPlayers(roomCode));

    if (result.failed.length > 0) {
      const firstFailure = result.failed[0];
      setStatus(
        `Добавлено: ${result.added.length}. Ошибка (${firstFailure.name}): ${firstFailure.reason}`,
      );
    } else {
      setStatus(`Добавлено ${result.added.length} тест-игрок(ов).`);
    }

    setBusy(false);
    return result.added.length;
  };

  const handleQuickStart = async () => {
    if (!isHost) {
      setStatus("Только хост может запускать матч.");
      return;
    }
    const need = Math.max(0, 3 - currentPlayers);
    if (need > 0) {
      await handleAdd(need);
    }
    if (onStartGame) {
      window.setTimeout(() => onStartGame(), 250);
    }
  };

  const handleClear = () => {
    if (!isHost) {
      setStatus("Только хост может удалять тест-игроков.");
      return;
    }
    if (busy) return;
    const disconnected = disconnectTestPlayersFromRoom(roomCode);
    setManagedPlayers([]);
    setStatus(`Отключено ${disconnected} тест-игрок(ов).`);
  };

  const handleDisconnectSelected = () => {
    if (!selectedRole) return;
    const removed = disconnectTestPlayerByName(roomCode, selectedRole.playerName);
    setManagedPlayers(listTestPlayers(roomCode));
    setStatus(
      removed
        ? `Игрок ${selectedRole.playerName} отключен.`
        : "Выбранный игрок не является тест-игроком.",
    );
  };

  const handleRevealFact = () => {
    if (!selectedRole) return;
    const result = triggerTestPlayerRevealNextFact(roomCode, selectedRole.playerId);
    setStatus(result.ok ? "Команда раскрыть факт отправлена." : result.reason ?? "Ошибка");
  };

  const handleUseCard = () => {
    if (!selectedRole) return;
    const result = triggerTestPlayerUseNextCard(roomCode, selectedRole.playerId);
    setStatus(result.ok ? "Команда применить карту отправлена." : result.reason ?? "Ошибка");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="rounded-xl border-amber-500/60 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20 hover:text-amber-100"
        >
          <Wrench className="w-4 h-4" />
          Тест-инструменты
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[82vh] overflow-y-auto border-amber-500/35 bg-zinc-950 text-zinc-100">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-amber-200">
              <Wrench className="w-4 h-4" />
              Test Tools
            </span>
            <Badge className="border border-amber-500/40 bg-amber-900/50 text-amber-100">
              {isHost ? "host" : "non-host"}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {!toolsEnabled ? (
          <div className="space-y-3">
            <div className="text-sm text-amber-100/80">
              Тестовые функции выключены для этого браузера.
            </div>
            <Button
              size="sm"
              className="rounded-xl bg-amber-500 text-zinc-950 hover:bg-amber-400 border-0"
              onClick={() => {
                setTestToolsEnabledForBrowser(true);
                setToolsEnabled(true);
              }}
            >
              Включить Test Tools
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 space-y-3">
              <div className="text-sm font-semibold text-zinc-100">
                Войти как другой игрок
              </div>
              <div className="flex flex-wrap gap-2">
                {players.map((player) => (
                  <Button
                    key={player.id}
                    size="sm"
                    variant={currentPlayerId === player.id ? "secondary" : "outline"}
                    className={
                      currentPlayerId === player.id
                        ? "rounded-xl bg-zinc-100 text-zinc-950 hover:bg-zinc-200 border-0"
                        : "rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-100"
                    }
                    onClick={() => onTakeOverPlayer?.(player.name)}
                    disabled={!onTakeOverPlayer}
                  >
                    <LogIn className="w-4 h-4" />
                    {player.name}
                    {player.isHost && " • host"}
                    {player.roleTitle ? ` • ${player.roleTitle}` : ""}
                  </Button>
                ))}
              </div>
            </div>

            {isHost && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-950/10 p-3 space-y-3">
                <div className="text-sm font-semibold text-amber-100">
                  Быстрые игроки
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    className="rounded-xl bg-amber-500 text-zinc-950 hover:bg-amber-400 border-0 disabled:bg-zinc-800 disabled:text-zinc-500"
                    onClick={() => handleAdd(1)}
                    disabled={busy || availableSlots <= 0}
                  >
                    <UserPlus className="w-4 h-4" />
                    +1 игрок
                  </Button>
                  <Button
                    size="sm"
                    className="rounded-xl bg-amber-500 text-zinc-950 hover:bg-amber-400 border-0 disabled:bg-zinc-800 disabled:text-zinc-500"
                    onClick={() => handleAdd(2)}
                    disabled={busy || availableSlots <= 0}
                  >
                    <UserPlus className="w-4 h-4" />
                    +2 игрока
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="rounded-xl bg-zinc-100 text-zinc-950 hover:bg-zinc-200 border-0 disabled:bg-zinc-800 disabled:text-zinc-500"
                    onClick={() => handleAdd(availableSlots)}
                    disabled={busy || availableSlots <= 0}
                  >
                    заполнить комнату
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-50"
                    onClick={handleClear}
                    disabled={busy || managedPlayers.length === 0}
                  >
                    <UserX className="w-4 h-4" />
                    удалить тест-игроков
                  </Button>
                </div>
                <div className="text-xs text-zinc-400">
                  Управляемых тест-игроков: {managedPlayers.length}
                </div>
              </div>
            )}

            {mode === "room" && isHost && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 space-y-3">
                <div className="text-sm font-semibold text-zinc-100">
                  Быстрый старт матча
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    className="rounded-xl bg-red-600 hover:bg-red-500 text-white border-0 disabled:bg-zinc-800 disabled:text-zinc-500"
                    onClick={handleQuickStart}
                    disabled={busy}
                  >
                    <Play className="w-4 h-4" />
                    Добить до 3 и старт
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="rounded-xl bg-zinc-100 text-zinc-950 hover:bg-zinc-200 border-0 disabled:bg-zinc-800 disabled:text-zinc-500"
                    onClick={onStartGame}
                    disabled={!onStartGame || !canStartGame || busy}
                  >
                    <Play className="w-4 h-4" />
                    Старт сейчас
                  </Button>
                </div>
              </div>
            )}

            {mode === "game" && (
              <>
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
                    <Eye className="w-4 h-4" />
                    Просмотр ролей и действия
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {roleViews.length === 0 ? (
                      <div className="text-xs text-zinc-400">
                        Нет данных ролей. Добавьте тест-игроков и дождитесь старта.
                      </div>
                    ) : (
                      roleViews.map((view) => (
                        <Button
                          key={view.playerId}
                          size="sm"
                          variant={
                            selectedRole?.playerId === view.playerId
                              ? "secondary"
                              : "outline"
                          }
                          className={
                            selectedRole?.playerId === view.playerId
                              ? "rounded-xl bg-zinc-100 text-zinc-950 hover:bg-zinc-200 border-0"
                              : "rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-100"
                          }
                          onClick={() => setSelectedRoleId(view.playerId)}
                        >
                          {view.playerName} • {view.roleTitle}
                        </Button>
                      ))
                    )}
                  </div>

                  {selectedRole && (
                    <>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="rounded-xl bg-zinc-100 text-zinc-950 hover:bg-zinc-200 border-0"
                          onClick={() => onTakeOverPlayer?.(selectedRole.playerName)}
                          disabled={!onTakeOverPlayer}
                        >
                          <LogIn className="w-4 h-4" />
                          Войти как выбранная роль
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-100"
                          onClick={handleRevealFact}
                        >
                          Раскрыть факт (роль)
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-100"
                          onClick={handleUseCard}
                        >
                          Применить карту (роль)
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-100"
                          onClick={handleDisconnectSelected}
                        >
                          Выкинуть выбранного тест-игрока
                        </Button>
                      </div>

                      <div className="grid md:grid-cols-3 gap-3 text-xs">
                        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-2 space-y-1">
                          <div className="text-zinc-300 font-semibold">
                            Роль и цель
                          </div>
                          <div className="text-zinc-100">{selectedRole.roleTitle}</div>
                          <div className="text-zinc-400">{selectedRole.goal}</div>
                          <div className="text-zinc-500">
                            Может раскрывать факт сейчас:{" "}
                            {selectedRole.canRevealFactsNow ? "да" : "нет"}
                          </div>
                        </div>
                        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-2 space-y-1">
                          <div className="text-zinc-300 font-semibold">
                            Факты ({selectedRole.facts.length})
                          </div>
                          {selectedRole.facts.slice(0, 6).map((fact) => (
                            <div key={fact.id} className="text-zinc-400">
                              • {fact.text}
                            </div>
                          ))}
                        </div>
                        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-2 space-y-1">
                          <div className="text-zinc-300 font-semibold">
                            Карты ({selectedRole.cards.length})
                          </div>
                          {selectedRole.cards.slice(0, 6).map((card) => (
                            <div key={card.id} className="text-zinc-400">
                              • {card.name}
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 space-y-3">
                  <div className="text-sm font-semibold text-zinc-100">
                    Быстрый переход по этапам
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {stages.map((stage, index) => (
                      <Button
                        key={`${index}-${stage}`}
                        size="sm"
                        variant={index === currentStageIndex ? "secondary" : "outline"}
                        className={
                          index === currentStageIndex
                            ? "rounded-xl bg-zinc-100 text-zinc-950 hover:bg-zinc-200 border-0"
                            : "rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-100"
                        }
                        onClick={() => onJumpToStage?.(index)}
                        disabled={!onJumpToStage || !canControlStages}
                      >
                        {index + 1}. {stage}
                      </Button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {status && <div className="text-xs text-amber-100/90">{status}</div>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

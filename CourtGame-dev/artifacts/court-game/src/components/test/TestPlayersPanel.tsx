import { useEffect, useMemo, useState } from "react";
import { UserPlus, UserX, Wrench } from "lucide-react";
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
  disconnectTestPlayersFromRoom,
  isTestToolsEnabled,
  listTestPlayers,
  setTestToolsEnabledForBrowser,
} from "@/lib/testPlayersHarness";

interface TestPlayersPanelProps {
  roomCode: string;
  currentPlayers: number;
  isHost: boolean;
}

const ROOM_CAP = 6;

export default function TestPlayersPanel({
  roomCode,
  currentPlayers,
  isHost,
}: TestPlayersPanelProps) {
  const [managedPlayers, setManagedPlayers] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [toolsEnabled, setToolsEnabled] = useState(isTestToolsEnabled());
  const [open, setOpen] = useState(false);

  const enabled = isHost && toolsEnabled;

  useEffect(() => {
    if (!isHost) return;
    setToolsEnabled(isTestToolsEnabled());
  }, [isHost, roomCode]);

  useEffect(() => {
    if (!enabled || !open) return;
    setManagedPlayers(listTestPlayers(roomCode));
    setStatus("");
  }, [enabled, roomCode, open]);

  const availableSlots = useMemo(
    () => Math.max(0, ROOM_CAP - currentPlayers),
    [currentPlayers],
  );

  if (!isHost) return null;

  const handleAdd = async (count: number) => {
    if (busy || availableSlots <= 0) return;
    setBusy(true);
    setStatus("");
    const result = await addTestPlayers(roomCode, Math.min(count, availableSlots));
    setManagedPlayers(listTestPlayers(roomCode));

    if (result.failed.length > 0) {
      const firstFailure = result.failed[0];
      setStatus(
        `Added: ${result.added.length}. First failure (${firstFailure.name}): ${firstFailure.reason}`,
      );
    } else {
      setStatus(`Added ${result.added.length} test player(s).`);
    }
    setBusy(false);
  };

  const handleClear = () => {
    if (busy) return;
    const disconnected = disconnectTestPlayersFromRoom(roomCode);
    setManagedPlayers([]);
    setStatus(`Disconnected ${disconnected} test player(s).`);
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
      <DialogContent className="max-w-lg border-amber-500/35 bg-zinc-950 text-zinc-100">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-amber-200">
              <Wrench className="w-4 h-4" />
              Test Tools
            </span>
            <Badge className="border border-amber-500/40 bg-amber-900/50 text-amber-100">
              host only
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {!toolsEnabled ? (
          <div className="space-y-3">
            <div className="text-sm text-amber-100/80">
              Test helpers are disabled for this browser session.
            </div>
            <Button
              size="sm"
              className="rounded-xl bg-amber-500 text-zinc-950 hover:bg-amber-400 border-0"
              onClick={() => {
                setTestToolsEnabledForBrowser(true);
                setToolsEnabled(true);
              }}
            >
              Enable Test Tools
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-xs text-amber-100/80">
              Temporary helper for test environment.
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                className="rounded-xl bg-amber-500 text-zinc-950 hover:bg-amber-400 border-0 disabled:bg-zinc-800 disabled:text-zinc-500"
                onClick={() => handleAdd(1)}
                disabled={busy || availableSlots <= 0}
              >
                <UserPlus className="w-4 h-4" />
                +1 player
              </Button>
              <Button
                size="sm"
                className="rounded-xl bg-amber-500 text-zinc-950 hover:bg-amber-400 border-0 disabled:bg-zinc-800 disabled:text-zinc-500"
                onClick={() => handleAdd(2)}
                disabled={busy || availableSlots <= 0}
              >
                <UserPlus className="w-4 h-4" />
                +2 players
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="rounded-xl bg-zinc-100 text-zinc-950 hover:bg-zinc-200 border-0 disabled:bg-zinc-800 disabled:text-zinc-500"
                onClick={() => handleAdd(availableSlots)}
                disabled={busy || availableSlots <= 0}
              >
                fill room
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-50"
                onClick={handleClear}
                disabled={busy || managedPlayers.length === 0}
              >
                <UserX className="w-4 h-4" />
                clear test players
              </Button>
            </div>

            <div className="text-xs text-zinc-400">
              Managed test players: {managedPlayers.length}
            </div>

            {status && <div className="text-xs text-amber-100/90">{status}</div>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Copy,
  Gavel,
  Scale,
  UserPlus,
  UserX,
  Play,
  Eye,
  EyeOff,
  Shield,
  AlertCircle,
  Sparkles,
  Camera,
  CircleHelp,
  Crown,
  ScrollText,
  Gamepad2,
  Search,
  Wrench,
  MessageSquare,
  Lock,
  Globe,
  UserCircle2,
  ChevronDown,
  DoorOpen,
  ArrowLeft,
  LogIn,
  FlipHorizontal,
  Laptop,
  CalendarDays,
  Clock3,
  Medal,
  Mic2,
  BrainCircuit,
  Swords,
  Gem,
  BookOpenText,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getSocket } from "@/lib/socket";
import { Switch } from "@/components/ui/switch";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const DEFAULT_GAME_STAGES = [
  "Подготовка",
  "Выступление истца",
  "Выступление ответчика",
  "Перекрестный допрос",
  "Финальная речь истца",
  "Финальная речь ответчика",
  "Решение судьи",
];

type RoomModeKey =
  | "quick_flex"
  | "civil_3"
  | "criminal_4"
  | "criminal_5"
  | "company_6";

const ROOM_MODE_OPTIONS: Array<{
  key: RoomModeKey;
  title: string;
  subtitle: string;
  maxPlayers: number;
}> = [
  {
    key: "civil_3",
    title: "Гражданский спор / Трудовой спор",
    subtitle: "Короткий формат на 3 участников.",
    maxPlayers: 3,
  },
  {
    key: "criminal_4",
    title: "Уголовное дело (4)",
    subtitle: "Режим с адвокатом ответчика.",
    maxPlayers: 4,
  },
  {
    key: "criminal_5",
    title: "Уголовное дело (5)",
    subtitle: "Режим с прокурором.",
    maxPlayers: 5,
  },
  {
    key: "company_6",
    title: "Суд на компанию",
    subtitle: "Полный состав сторон.",
    maxPlayers: 6,
  },
];

const QUICK_ROOM_MODE = {
  key: "quick_flex" as RoomModeKey,
  title: "Быстрая комната",
  subtitle: "Свободный набор, старт от 3 до 6 игроков.",
  maxPlayers: 6,
};
const DISCORD_INVITE_URL = "https://discord.gg/6UZ7xDxnhR";
const RECONNECT_GRACE_MS = 30_000;
const VERDICT_CLOSE_COUNTDOWN_MS = 30_000;
const AUTH_TOKEN_STORAGE_KEY = "court_auth_token";
const AUTH_USER_STORAGE_KEY = "court_auth_user";
const GUEST_NAME_STORAGE_KEY = "court_guest_name";
const BANNER_STORAGE_KEY = "court_banner";
const RECONNECT_PERSISTENT_STORAGE_KEY = "court_reconnect_persistent";
const RANK_TOAST_PENDING_STORAGE_KEY = "court_rank_toast_pending";
const GUEST_NAME_PREFIX = "Гость-";
const PROFILE_BIO_MAX = 150;
// ВРЕМЕННО: режим для проверки анимации рангового апа (1 успешный матч -> переход ранга в окне прогресса).
const DEBUG_INSTANT_RANK_UP_ON_MATCH = true;

const BADGE_ICONS: Record<string, LucideIcon> = {
  plaintiff: Scale,
  defendant: Shield,
  plaintiffLawyer: UserCircle2,
  defenseLawyer: Lock,
  prosecutor: ScrollText,
  judge: Gavel,
  winner: Sparkles,
  legend: Crown,
  media: Camera,
  creator: Laptop,
  host: UserPlus,
  innovator: Wrench,
  moderator: Shield,
  admin: Shield,
  rankNovice: Medal,
  rankDebater: BookOpenText,
  rankOrator: Mic2,
  rankStrategist: BrainCircuit,
  rankMaster: Swords,
  rankVerdict: Gem,
};

const BADGE_THEME: Record<
  string,
  {
    chip: string;
    icon: string;
    iconOnly?: string;
  }
> = {
  plaintiff: {
    chip: "border-sky-500/55 bg-sky-500/20 text-sky-200",
    icon: "bg-sky-500/30 text-sky-100",
    iconOnly: "text-sky-300",
  },
  defendant: {
    chip: "border-zinc-500/65 bg-zinc-500/20 text-zinc-200",
    icon: "bg-zinc-500/35 text-zinc-100",
    iconOnly: "text-zinc-200",
  },
  plaintiffLawyer: {
    chip: "border-indigo-500/55 bg-indigo-500/20 text-indigo-200",
    icon: "bg-indigo-500/35 text-indigo-100",
    iconOnly: "text-indigo-300",
  },
  defenseLawyer: {
    chip: "border-emerald-500/55 bg-emerald-500/20 text-emerald-200",
    icon: "bg-emerald-500/35 text-emerald-100",
    iconOnly: "text-emerald-300",
  },
  prosecutor: {
    chip: "border-amber-500/65 bg-amber-500/25 text-amber-100",
    icon: "bg-amber-500/40 text-amber-100",
    iconOnly: "text-amber-200",
  },
  judge: {
    chip: "border-violet-500/55 bg-violet-500/20 text-violet-200",
    icon: "bg-violet-500/35 text-violet-100",
    iconOnly: "text-violet-300",
  },
  winner: {
    chip: "border-yellow-500/55 bg-yellow-500/20 text-yellow-200",
    icon: "bg-yellow-500/35 text-yellow-100",
    iconOnly: "text-yellow-300",
  },
  legend: {
    chip: "border-violet-500/65 bg-violet-500/25 text-violet-100",
    icon: "bg-violet-500/40 text-violet-100",
    iconOnly: "text-violet-200",
  },
  media: {
    chip: "border-cyan-500/55 bg-cyan-500/20 text-cyan-200",
    icon: "bg-cyan-500/35 text-cyan-100",
    iconOnly: "text-cyan-300",
  },
  creator: {
    chip: "border-red-500/65 bg-red-600/25 text-red-100",
    icon: "bg-red-600/45 text-red-100",
    iconOnly: "text-red-200",
  },
  host: {
    chip: "border-rose-500/55 bg-rose-500/20 text-rose-200",
    icon: "bg-rose-500/35 text-rose-100",
    iconOnly: "text-rose-300",
  },
  innovator: {
    chip: "border-lime-500/55 bg-lime-500/20 text-lime-200",
    icon: "bg-lime-500/35 text-lime-100",
    iconOnly: "text-lime-300",
  },
  moderator: {
    chip: "border-amber-500/55 bg-amber-500/20 text-amber-200",
    icon: "bg-amber-500/35 text-amber-100",
    iconOnly: "text-amber-300",
  },
  admin: {
    chip: "border-purple-500/55 bg-purple-500/20 text-purple-200",
    icon: "bg-purple-500/35 text-purple-100",
    iconOnly: "text-purple-300",
  },
  rankNovice: {
    chip: "border-slate-400/65 bg-slate-500/20 text-slate-100 shadow-[0_0_14px_rgba(148,163,184,0.25)]",
    icon: "bg-slate-500/35 text-slate-50 shadow-[0_0_12px_rgba(148,163,184,0.4)]",
    iconOnly: "text-slate-200 drop-shadow-[0_0_6px_rgba(203,213,225,0.55)]",
  },
  rankDebater: {
    chip: "border-sky-400/70 bg-sky-500/20 text-sky-100 shadow-[0_0_14px_rgba(56,189,248,0.3)]",
    icon: "bg-sky-500/35 text-sky-50 shadow-[0_0_12px_rgba(56,189,248,0.45)]",
    iconOnly: "text-sky-200 drop-shadow-[0_0_6px_rgba(125,211,252,0.55)]",
  },
  rankOrator: {
    chip: "border-violet-400/70 bg-violet-500/20 text-violet-100 shadow-[0_0_14px_rgba(167,139,250,0.28)]",
    icon: "bg-violet-500/35 text-violet-50 shadow-[0_0_12px_rgba(167,139,250,0.42)]",
    iconOnly: "text-violet-200 drop-shadow-[0_0_6px_rgba(221,214,254,0.55)]",
  },
  rankStrategist: {
    chip: "border-teal-400/70 bg-teal-500/20 text-teal-100 shadow-[0_0_14px_rgba(45,212,191,0.3)]",
    icon: "bg-teal-500/35 text-teal-50 shadow-[0_0_12px_rgba(45,212,191,0.42)]",
    iconOnly: "text-teal-200 drop-shadow-[0_0_6px_rgba(153,246,228,0.55)]",
  },
  rankMaster: {
    chip: "border-red-400/70 bg-red-500/20 text-red-100 shadow-[0_0_14px_rgba(248,113,113,0.3)]",
    icon: "bg-red-500/35 text-red-50 shadow-[0_0_12px_rgba(248,113,113,0.42)]",
    iconOnly: "text-red-200 drop-shadow-[0_0_6px_rgba(252,165,165,0.58)]",
  },
  rankVerdict: {
    chip: "border-transparent bg-[linear-gradient(120deg,rgba(239,68,68,0.24),rgba(168,85,247,0.24))] text-red-100 shadow-[0_0_16px_rgba(239,68,68,0.35)]",
    icon: "bg-[linear-gradient(135deg,rgba(239,68,68,0.55),rgba(168,85,247,0.55))] text-white shadow-[0_0_14px_rgba(239,68,68,0.42)]",
    iconOnly: "text-red-200 drop-shadow-[0_0_8px_rgba(244,114,182,0.6)]",
  },
};

const SITE_RULES: string[] = [
  "Запрещено иметь нецензурные ники.",
  "Запрещено в информации о себе использовать оскорбления, дискриминацию, экстремизм и мат.",
  "Запрещены любые попытки накрутки статистики в личном кабинете.",
  "Запрещены любые деструктивные действия: угрозы, домогательства, спам, ложная информация и ухудшение опыта других игроков.",
  "Запрещен обман: ложные обвинения, фальсификация данных, подделка сообщений и мошенничество.",
  "Запрещено искать и использовать уязвимости сайта. Найденные уязвимости нужно сообщать администрации через почту или Discord.",
];

const RULES_INTRO_TEXT =
  "Добро пожаловать на сайт CourtGame. Соблюдайте правила для комфортной и справедливой игры.";

function generateGuestName(): string {
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return `${GUEST_NAME_PREFIX}${randomPart}`;
}

function getOrCreateGuestName(): string {
  const stored = localStorage.getItem(GUEST_NAME_STORAGE_KEY)?.trim() ?? "";
  if (stored) return stored;
  const next = generateGuestName();
  localStorage.setItem(GUEST_NAME_STORAGE_KEY, next);
  return next;
}

const ROOM_MODE_BY_KEY = Object.fromEntries(
  [...ROOM_MODE_OPTIONS, QUICK_ROOM_MODE].map((mode) => [mode.key, mode]),
) as Record<RoomModeKey, { key: RoomModeKey; title: string; subtitle: string; maxPlayers: number }>;

function getRoomModeMeta(modeKey: RoomModeKey | undefined, fallbackMaxPlayers = 6) {
  if (modeKey && ROOM_MODE_BY_KEY[modeKey]) {
    return ROOM_MODE_BY_KEY[modeKey];
  }
  return {
    key: "company_6" as RoomModeKey,
    title: `Режим на ${fallbackMaxPlayers} игроков`,
    subtitle: "Параметры режима определяются хостом.",
    maxPlayers: fallbackMaxPlayers,
  };
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

function isPreparationStageName(stageName: string): boolean {
  return normalizeStageName(stageName).includes(PREPARATION_STAGE_MARKER);
}

function isCrossExaminationStageName(stageName: string): boolean {
  return stageIncludesAll(
    normalizeStageName(stageName),
    CROSS_EXAMINATION_STAGE_MARKERS,
  );
}

function isOpeningSpeechStageName(stageName: string): boolean {
  return OPENING_STAGE_MARKERS.some((marker) =>
    normalizeStageName(stageName).includes(marker),
  );
}

function isClosingSpeechStageName(stageName: string): boolean {
  return CLOSING_STAGE_MARKERS.some((marker) =>
    normalizeStageName(stageName).includes(marker),
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

function isRoleSpeechStageName(roleKey: string, stageName: string): boolean {
  if (!roleKey) return false;
  const speechOwnerRole = resolveSpeechOwnerRole(stageName);
  if (!speechOwnerRole || speechOwnerRole !== roleKey) {
    return false;
  }

  const isOpeningStage = isOpeningSpeechStageName(stageName);
  const isClosingStage = isClosingSpeechStageName(stageName);
  return isOpeningStage || isClosingStage;
}

function isRoleOpeningSpeechStageName(roleKey: string, stageName: string): boolean {
  if (!roleKey) return false;
  const speechOwnerRole = resolveSpeechOwnerRole(stageName);
  return (
    !!speechOwnerRole &&
    speechOwnerRole === roleKey &&
    isOpeningSpeechStageName(stageName)
  );
}

function canRoleRevealFactsAtStage(roleKey: string, stageName: string): boolean {
  if (!roleKey) return false;
  if (isCrossExaminationStageName(stageName)) return true;
  return isRoleSpeechStageName(roleKey, stageName);
}

function resolveNormalizedSpeechRole(
  roleKey: string | undefined,
  roleTitle: string | undefined,
): SpeechOwnerRole | null {
  const normalizedRoleTitle = (roleTitle ?? "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .trim();

  if (normalizedRoleTitle.includes("адвокат") && normalizedRoleTitle.includes("истц")) {
    return "plaintiffLawyer";
  }
  if (normalizedRoleTitle.includes("адвокат") && normalizedRoleTitle.includes("ответчик")) {
    return "defenseLawyer";
  }
  if (normalizedRoleTitle.includes("прокурор")) return "prosecutor";
  if (normalizedRoleTitle.includes("истец")) return "plaintiff";
  if (normalizedRoleTitle.includes("ответчик")) return "defendant";

  const aliasByKey: Record<string, SpeechOwnerRole> = {
    plaintiff: "plaintiff",
    defendant: "defendant",
    plaintiffLawyer: "plaintiffLawyer",
    defenseLawyer: "defenseLawyer",
    defendantLawyer: "defenseLawyer",
    prosecutor: "prosecutor",
  };

  if (!roleKey) return null;
  return aliasByKey[roleKey] ?? null;
}
const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: "easeOut" },
  },
  exit: { opacity: 0, y: -12, transition: { duration: 0.22, ease: "easeIn" } },
};

const cardVariants = {
  initial: { opacity: 0, y: 24 },
  animate: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.38, delay: i * 0.07, ease: "easeOut" },
  }),
};

const entryVariants = {
  initial: { opacity: 0, scale: 0.92, y: 18 },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.3, ease: "easeOut" },
  },
  exit: {
    opacity: 0,
    scale: 0.88,
    x: -24,
    transition: { duration: 0.22, ease: "easeIn" },
  },
};

const floatingHelpButtonVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.92 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 420, damping: 28, mass: 0.7 },
  },
  exit: {
    opacity: 0,
    y: 16,
    scale: 0.95,
    transition: { duration: 0.18, ease: "easeInOut" },
  },
};

const HIDE_SCROLLBAR_CLASS =
  "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden [&::-webkit-scrollbar-button]:hidden";

function CourtAtmosphereBackground() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[#0b0b0f]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-5%,rgba(255,255,255,0.05),transparent_46%),radial-gradient(ellipse_at_50%_110%,rgba(255,255,255,0.04),transparent_48%)]" />

      <div className="absolute inset-y-0 left-0 w-[20vw] min-w-[74px] max-w-[230px] opacity-[0.14]">
        <div className="relative h-full w-full bg-[linear-gradient(to_right,rgba(212,212,216,0.11),rgba(212,212,216,0.03)_24%,transparent_72%,rgba(212,212,216,0.05))]">
          <div className="absolute inset-y-0 left-[22%] w-[15%] bg-zinc-200/10 rounded-t-[28px]" />
          <div className="absolute inset-y-0 left-[48%] w-[11%] bg-zinc-200/8 rounded-t-[20px]" />
          <div className="absolute inset-y-0 right-[18%] w-px bg-zinc-100/12" />
        </div>
      </div>
      <div className="absolute inset-y-0 right-0 w-[20vw] min-w-[74px] max-w-[230px] opacity-[0.14]">
        <div className="relative h-full w-full bg-[linear-gradient(to_left,rgba(212,212,216,0.11),rgba(212,212,216,0.03)_24%,transparent_72%,rgba(212,212,216,0.05))]">
          <div className="absolute inset-y-0 right-[22%] w-[15%] bg-zinc-200/10 rounded-t-[28px]" />
          <div className="absolute inset-y-0 right-[48%] w-[11%] bg-zinc-200/8 rounded-t-[20px]" />
          <div className="absolute inset-y-0 left-[18%] w-px bg-zinc-100/12" />
        </div>
      </div>

      <div className="absolute left-[7%] top-[28%] h-[220px] w-[130px] opacity-[0.06]">
        <div className="absolute left-[54%] top-[42%] h-2 w-24 -translate-x-1/2 rotate-[34deg] rounded-full bg-zinc-300/70" />
        <div className="absolute left-[66%] top-[30%] h-7 w-16 -translate-x-1/2 rotate-[34deg] rounded-md border border-zinc-300/45 bg-zinc-300/28" />
        <div className="absolute left-[42%] top-[57%] h-5 w-14 -translate-x-1/2 rotate-[34deg] rounded-md border border-zinc-300/38 bg-zinc-300/20" />
      </div>
      <div className="absolute right-[7%] top-[30%] h-[220px] w-[130px] opacity-[0.06]">
        <div className="absolute left-[46%] top-[42%] h-2 w-24 -translate-x-1/2 -rotate-[34deg] rounded-full bg-zinc-300/70" />
        <div className="absolute left-[34%] top-[30%] h-7 w-16 -translate-x-1/2 -rotate-[34deg] rounded-md border border-zinc-300/45 bg-zinc-300/28" />
        <div className="absolute left-[58%] top-[57%] h-5 w-14 -translate-x-1/2 -rotate-[34deg] rounded-md border border-zinc-300/38 bg-zinc-300/20" />
      </div>

      <div className="absolute inset-0 opacity-[0.05] mix-blend-soft-light bg-[radial-gradient(rgba(255,255,255,0.24)_0.5px,transparent_0.8px)] [background-size:3px_3px]" />
    </div>
  );
}

interface DevLogEntry {
  date: string;
  version: string;
  title: string;
  changes: string[];
}

const CURRENT_VERSION = "Beta 0.4.5";

const DEVLOG_ENTRIES: DevLogEntry[] = [
  {
    date: "24.03.2026",
    version: CURRENT_VERSION,
    title: "Релиз Beta 0.4.5: стабильность комнат, протесты и интерфейс",
    changes: [
      "Добавлена серверная очистка зависших/старых комнат.",
      "Переработана механика протестов: активный протест, решение судьи (Принять/Отклонить), блокировка параллельных протестов.",
      "Свидетелям отключена кнопка «Протестую».",
      "Добавлены уведомления о применении карты механики.",
      "Полностью переработан блок «Предупреждения» у судьи.",
      "Улучшен приватный чат адвокат ↔ клиент (размер, верстка, стабильность длинных сообщений).",
      "На главную добавлена кнопка «Поиск игроков» с переходом в Discord.",
      "На страницу «Разработка» добавлена кнопка «Сообщить о баге» с переходом в Discord.",
    ],
  },
  {
    date: "22.03.2026",
    version: "Beta 0.4",
    title: "Релиз Beta 0.4: подбор игроков, влияние и переподключение",
    changes: [
      "Добавлен раздел «Подбор игроков» с отображением активных комнат и быстрым входом.",
      "Добавлено расширенное создание матча: выбор режима, лимита игроков, приватности и пароля.",
      "Добавлены открытые/приватные комнаты, проверка пароля при входе и отображение статуса матча.",
      "Добавлена и интегрирована система профиля игрока в верхнюю навигацию.",
      "Проведён крупный редизайн главной страницы, лобби и мобильной версии интерфейса.",
      "Добавлена система «Влияние» в матче: протест, тишина в зале, предупреждения, заметки.",
      "Добавлена система предупреждений судьи с возможностью выдавать и снимать предупреждения.",
      "Переработана система выхода/переподключения: трекинг отключений, таймер удержания, очистка игроков и комнат.",
      "Проведено исправление визуальных и игровых багов.",
      "Добавлен приватный чат «адвокат ↔ клиент».",
      "Добавлен чат лобби.",
    ],
  },
  {
    date: "20.03.2026",
    version: "Beta 0.3",
    title: "Релиз Beta 0.3: модульное меню, помощь и этапы",
    changes: [
      "Добавлено модульное верхнее меню навигации с вкладками.",
      "Добавлена страница «Помощь» с полноценным справочником по игре.",
      "Добавлена страница «Разработка» с дев-блогом обновлений.",
      "Проведено исправление визуальных и игровых багов.",
      "Переработана система игровых этапов под разные составы игроков.",
    ],
  },
  {
    date: "19.03.2026",
    version: "Beta 0.2",
    title: "Стабилизация лобби и расширение игровых механик",
    changes: [
      "Добавлены аватарки игроков с отображением в лобби и во время матча.",
      "Добавлен переключатель «Я — Судья» для ведущего в лобби.",
      "Добавлена роль наблюдателя «Свидетель» для подключения в уже идущий матч.",
      "Ведущий может кикать игроков из лобби с уведомлением о кике.",
      "Добавлена подсветка последнего раскрытого факта и последней механики.",
      "Во вступительной речи ограничение: можно раскрыть не более 2 фактов.",
      "На этапе «Подготовка» отключено раскрытие фактов и применение механик.",
    ],
  },
];
const DEVLOG_PAGE_SIZE = 2;

interface HelpTopic {
  id: string;
  category: string;
  title: string;
  content: string;
  keywords: string[];
}

interface HelpTopicDraft {
  id?: string;
  category: string;
  title: string;
  content: string | string[];
  keywords?: string[] | string;
}

// How to add new help data quickly:
// 1) Add an object in HELP_TOPICS_SOURCE with category/title/content.
// 2) "id" and "keywords" are optional and will be generated automatically.
const HELP_TOPICS_SOURCE: HelpTopicDraft[] = [
  // ===== РОЛИ =====
  {
    id: "role-judge",
    category: "Роли",
    title: "Судья",
    content:
      "Судья руководит процессом, следит за порядком заседания, объявляет этапы, дает или ограничивает право голоса, рассматривает протесты и спорные моменты, а в конце выносит вердикт. Судья не поддерживает ни одну из сторон и должен оценивать дело по ходу процесса, раскрытым фактам, логике выступлений и общей убедительности участников.",
    keywords: ["судья", "вердикт", "этапы", "роль", "кто такой судья"],
  },
  {
    id: "role-prosecutor",
    category: "Роли",
    title: "Прокурор",
    content:
      "Прокурор открывает обвинительную линию и задает ее общий вектор. Его задача состоит в том, чтобы показать судье, почему версия обвинения заслуживает доверия, какие обстоятельства говорят против ответчика и где защита пытается ослабить очевидные выводы. Прокурор усиливает позицию истца, но действует как отдельный участник процесса.",
    keywords: ["прокурор", "обвинение", "роль", "кто такой прокурор"],
  },
  {
    id: "role-plaintiff",
    category: "Роли",
    title: "Истец",
    content:
      "Истец это сторона, которая обращается в суд с требованием. Именно он утверждает, что его права были нарушены, ему был причинен вред или с ним поступили несправедливо. Его задача состоит в том, чтобы показать судье, в чем именно состоит претензия и почему она обоснована.",
    keywords: ["истец", "требования", "роль", "кто такой истец"],
  },
  {
    id: "role-defendant",
    category: "Роли",
    title: "Ответчик",
    content:
      "Ответчик это сторона, к которой предъявлены требования или обвинения. Его задача состоит в том, чтобы опровергнуть позицию обвинения, объяснить свои действия, ослабить выводы оппонентов и убедить судью, что требования истца полностью или частично необоснованны.",
    keywords: ["ответчик", "защита", "роль", "кто такой ответчик"],
  },
  {
    id: "role-plaintiff-lawyer",
    category: "Роли",
    title: "Адвокат истца",
    content:
      "Адвокат истца представляет интересы истца и строит юридическую и риторическую линию обвинения. Он развивает позицию стороны, помогает подавать факты в выгодном свете, задает вопросы и показывает судье, почему требования истца должны быть удовлетворены.",
    keywords: ["адвокат истца", "истец", "роль", "кто такой адвокат истца"],
  },
  {
    id: "role-defendant-lawyer",
    category: "Роли",
    title: "Адвокат ответчика",
    content:
      "Адвокат ответчика представляет интересы защиты. Он ищет слабые места в позиции обвинения, указывает на противоречия, подчеркивает выгодные для ответчика обстоятельства и старается убедить судью, что линия защиты выглядит сильнее и надежнее.",
    keywords: ["адвокат ответчика", "ответчик", "роль", "кто такой адвокат ответчика"],
  },
  {
    id: "role-witness",
    category: "Роли",
    title: "Свидетель",
    content:
      "Свидетель это дополнительный участник процесса. Свидетелей может быть неограниченное количество. Обычно они выступают как наблюдатели, но судья при желании может подключить их к игре, дать им слово или использовать их как часть разбирательства. Свидетель не управляет процессом самостоятельно и говорит только тогда, когда ему это разрешено.",
    keywords: ["свидетель", "свидетели", "роль", "наблюдатель"],
  },

  // ===== ПРАВИЛА ИГРЫ =====
  {
    id: "rules-goal",
    category: "Правила игры",
    title: "Главная цель игры",
    content:
      "Главная цель сторон это убедить судью в своей версии событий. Для этого игроки используют речь, факты, вопросы, логику, тайминг и карты механик. Побеждает та сторона, чья позиция по итогу процесса выглядит для судьи более сильной, последовательной и обоснованной.",
    keywords: ["цель игры", "победа", "как выиграть", "правила"],
  },
  {
    id: "rules-general-logic",
    category: "Правила игры",
    title: "Общая логика процесса",
    content:
      "Игра идет поэтапно. Сначала участники знакомятся со своими ролями и фактами, затем проходят вступительные речи, после этого основная стадия спора и перекрестного допроса, далее заключительные слова, а в конце решение судьи. Каждому этапу соответствует своя логика выступлений и свои допустимые действия.",
    keywords: ["логика процесса", "этапы", "порядок суда", "правила"],
  },
  {
    id: "rules-speaking-order",
    category: "Правила игры",
    title: "Очередность выступлений",
    content:
      "Если судья не установил иной порядок, право голоса выдается по базовой логике процесса. На ключевых этапах сначала выступает прокурор, затем истец, затем адвокат истца, после этого ответчик и затем адвокат ответчика. Такая очередность помогает сохранить понятную структуру обвинения и защиты.",
    keywords: ["очередность", "право голоса", "кто говорит первым"],
  },
  {
    id: "rules-judge-authority",
    category: "Правила игры",
    title: "Полномочия судьи",
    content:
      "Судья вправе регулировать темп заседания, останавливать хаос, ограничивать лишние реплики, решать спорные вопросы, принимать или отклонять протесты, давать слово свидетелям и переводить процесс к следующему этапу. Если ситуация прямо не описана в правилах помощи, окончательное решение принимает судья.",
    keywords: ["полномочия судьи", "власть судьи", "судья решает"],
  },
  {
    id: "rules-who-speaks",
    category: "Правила игры",
    title: "Кто может говорить",
    content:
      "Говорит тот участник, которому предоставлено право голоса текущим этапом или решением судьи. Нельзя бесконечно перебивать других участников и вести параллельный спор вне своей очереди. Если кто то вмешивается не по порядку, судья вправе его остановить.",
    keywords: ["кто говорит", "очередь", "реплики", "порядок речи"],
  },
  {
    id: "rules-behavior",
    category: "Правила игры",
    title: "Поведение в процессе",
    content:
      "Участникам следует говорить по делу, не уходить слишком далеко от темы и не разрушать структуру матча хаотичными выкриками. Жесткая риторика и давление допустимы как часть игры, но порядок процесса важнее. Чем собраннее и понятнее ваша линия, тем выше шанс убедить судью.",
    keywords: ["поведение", "этикет", "участники", "как себя вести"],
  },

  // ===== ФАКТЫ =====
  {
    id: "facts-what",
    category: "Факты",
    title: "Что такое факты",
    content:
      "Факты это важная внутриигровая информация, привязанная к роли. Они раскрывают обстоятельства дела, усиливают позицию стороны, создают неожиданные повороты и могут полностью изменить восприятие спора. Факт особенно силен тогда, когда он раскрыт в нужный момент.",
    keywords: ["факты", "что это", "что такое факты"],
  },
  {
    id: "facts-secret",
    category: "Факты",
    title: "Почему факты скрыты",
    content:
      "Факты скрыты в начале матча, потому что процесс должен раскрываться постепенно. Это не дает сторонам сразу выложить все ключевые аргументы и заставляет думать о стратегии. Правильный тайминг раскрытия фактов часто важнее самого факта.",
    keywords: ["скрытые факты", "почему скрыты", "тайна"],
  },
  {
    id: "facts-reveal",
    category: "Факты",
    title: "Как раскрываются факты",
    content:
      "Факты раскрываются кнопкой «Раскрыть». После раскрытия этот факт становится известен всем участникам процесса. На подготовке раскрытие запрещено, потому что этот этап нужен для ознакомления с ролью и планирования линии поведения.",
    keywords: ["факты", "раскрыть", "подготовка", "как раскрываются"],
  },
  {
    id: "facts-impact",
    category: "Факты",
    title: "Как факты влияют на дело",
    content:
      "После раскрытия факт становится частью общей картины дела. Его могут использовать и ваша сторона, и оппоненты. Судья оценивает факт не сам по себе, а вместе с контекстом, логикой сторон и тем, насколько он усиливает или разрушает уже сказанное в процессе.",
    keywords: ["факты", "влияние", "судья", "как влияют"],
  },
  {
    id: "facts-strategy",
    category: "Факты",
    title: "Как использовать факты грамотно",
    content:
      "Сильный факт не всегда стоит раскрывать сразу. Иногда выгоднее сначала дать оппоненту высказаться, позволить ему построить уязвимую линию и только потом раскрыть факт, который эту линию разрушит. Лучше всего факты работают вместе с вопросами, риторикой и логикой.",
    keywords: ["стратегия фактов", "когда раскрывать", "как использовать факты"],
  },

  // ===== КАРТЫ МЕХАНИК =====
  {
    id: "cards-what",
    category: "Карты механик",
    title: "Что такое карты механик",
    content:
      "Карты механик это специальные игровые эффекты, которые временно меняют обычный ход процесса. Они могут нарушить чужой план, изменить темп спора, усилить вашу позицию или создать нестандартную ситуацию. Именно карты делают матчи менее предсказуемыми.",
    keywords: ["карты механик", "что это", "механики", "карты"],
  },
  {
    id: "cards-how",
    category: "Карты механик",
    title: "Как использовать карты",
    content:
      "Чтобы применить карту, нажмите «Применить», когда она доступна по таймингу и не запрещена текущим этапом. После использования карта считается разыгранной. Не стоит тратить карту без причины. Лучше использовать ее в момент, когда она дает реальное преимущество.",
    keywords: ["карты механик", "применить", "использование", "как использовать"],
  },
  {
    id: "cards-when",
    category: "Карты механик",
    title: "Когда карты доступны",
    content:
      "На этапе подготовки карты механик недоступны. В остальных этапах они применяются по ситуации и с учетом логики матча. Если конкретная механика вызывает спор, окончательное решение по допустимости ее применения принимает судья.",
    keywords: ["карты механик", "когда", "подготовка", "тайминг"],
  },
  {
    id: "cards-strategy",
    category: "Карты механик",
    title: "Тайминг карт",
    content:
      "Самая сильная карта это не та, которую разыграли первой, а та, которую разыграли в нужный момент. Часто лучший эффект достигается тогда, когда карта ломает уже выстроенный аргумент оппонента, сбивает темп его выступления или усиливает ваш самый важный ход.",
    keywords: ["тайминг", "стратегия карт", "когда играть карту"],
  },

  // ===== КАК ПРОХОДИТ СУД =====
  {
    id: "court-flow",
    category: "Как проходит суд",
    title: "Общий порядок этапов",
    content:
      "Базовая структура матча выглядит так: подготовка, вступительная речь, стадия прений сторон и перекрестного допроса, заключительное слово, затем вердикт судьи. Судья может управлять темпом, но общая логика суда строится именно вокруг этих этапов.",
    keywords: ["этапы", "порядок матча", "как проходит суд", "общий порядок"],
  },
  {
    id: "preparation",
    category: "Как проходит суд",
    title: "Подготовка",
    content:
      "На подготовке участники изучают свою роль, свои факты и общую ситуацию. Это этап планирования. Здесь не раскрываются факты и не разыгрываются карты механик. Игрок должен понять, какую линию он будет проводить в течение всего процесса.",
    keywords: ["подготовка", "этап подготовки", "начало игры"],
  },
  {
    id: "opening",
    category: "Как проходит суд",
    title: "Вступительная речь",
    content:
      "Вступительная речь это этап, на котором стороны коротко обозначают свою позицию и задают судье начальную рамку восприятия дела. Базовый порядок выступлений такой: сначала прокурор, затем истец, затем адвокат истца, потом ответчик и затем адвокат ответчика. На этом этапе важно не утонуть в деталях, а ясно показать свою версию событий.",
    keywords: ["вступительная речь", "этап", "начало процесса", "очередность"],
  },
  {
    id: "arguments",
    category: "Как проходит суд",
    title: "Прения сторон",
    content:
      "Прения сторон это основной этап спора. Здесь участники развивают свои доводы, спорят с чужими аргументами, атакуют слабые места, раскрывают факты и используют карты механик. Базовая логика права голоса сохраняется такой же: сначала прокурор, затем истец, затем адвокат истца, потом ответчик и затем адвокат ответчика, если судья не решил иначе.",
    keywords: ["прения сторон", "аргументы", "основной этап", "очередность"],
  },
  {
    id: "questioning",
    category: "Как проходит суд",
    title: "Перекрестный допрос",
    content:
      "Перекрестный допрос это часть стадии прений сторон, в которой участники задают вопросы оппонентам, чтобы выявить противоречия, уточнить слабые места, вынудить ошибиться или заставить раскрыть неудобную информацию. Порядок участия в этой стадии по умолчанию совпадает с общей логикой права голоса, если судья не определил иной порядок.",
    keywords: ["перекрестный допрос", "допрос", "вопросы", "прения"],
  },
  {
    id: "closing",
    category: "Как проходит суд",
    title: "Заключительное слово",
    content:
      "Заключительное слово это финальный этап выступлений перед вердиктом. Здесь стороны уже не должны растягивать новую линию спора, а должны кратко и четко подвести итог сказанному. Базовая очередность та же: прокурор, истец, адвокат истца, ответчик, адвокат ответчика.",
    keywords: ["заключительное слово", "финал", "резюме", "очередность"],
  },
  {
    id: "verdict",
    category: "Как проходит суд",
    title: "Вердикт судьи",
    content:
      "После завершения всех выступлений и споров судья анализирует ход процесса, раскрытые факты, качество аргументов и общую убедительность сторон, после чего выносит вердикт. Вердикт это финальная точка матча и итог всей работы участников.",
    keywords: ["решение судьи", "вердикт", "финал дела"],
  },
  {
    id: "protests",
    category: "Как проходит суд",
    title: "Протесты",
    content:
      "Если участник считает вопрос, реплику, действие или поведение оппонента некорректным, он может заявить протест. После этого судья решает, принять протест или отклонить его. Протест используется для защиты порядка процесса и не должен превращаться в спам.",
    keywords: ["протесты", "правила", "судья", "как заявить протест"],
  },
  {
    id: "witness-use",
    category: "Как проходит суд",
    title: "Как подключаются свидетели",
    content:
      "Свидетели не обязаны активно участвовать в каждом матче. По умолчанию они являются наблюдателями. Если судья считает нужным, он может дать им слово, привлечь к разбирательству или использовать их как дополнительный элемент процесса. Пока судья не разрешил выступление, свидетель не получает самостоятельное право голоса.",
    keywords: ["свидетели", "как участвуют свидетели", "подключение свидетелей"],
  },

  // ===== КАК УСТРОЕН СУД =====
  {
    id: "court-meaning",
    category: "Как устроен суд",
    title: "Что вообще происходит в суде",
    content:
      "Суд это разбирательство, в котором разные стороны представляют свои версии событий, спорят о фактах и пытаются убедить судью в своей правоте. Внутри игры эта логика сохранена в упрощенном виде. Суть процесса состоит не в хаотичном споре, а в последовательном столкновении позиций.",
    keywords: ["что такое суд", "как устроен суд", "суть суда"],
  },
  {
    id: "court-sides",
    category: "Как устроен суд",
    title: "Кто такие стороны процесса",
    content:
      "Стороны процесса это участники, между которыми идет спор. В этой игре основными сторонами являются истец и ответчик, а также их представители. Прокурор усиливает обвинительную линию, а судья не относится ни к одной из сторон и оценивает их со стороны.",
    keywords: ["стороны процесса", "истец и ответчик", "кто участвует"],
  },
  {
    id: "court-burden",
    category: "Как устроен суд",
    title: "Что значит доказать позицию",
    content:
      "Доказать позицию значит не просто заявить свою версию, а убедить судью, что она лучше объясняет события, лучше держится под вопросами и сильнее подтверждается тем, что уже было раскрыто в деле. Слабая уверенность без логики обычно уступает хорошо построенной линии.",
    keywords: ["доказать позицию", "доказывание", "бремя доказывания"],
  },
  {
    id: "court-objections",
    category: "Как устроен суд",
    title: "Зачем нужны протесты и возражения",
    content:
      "Протесты и возражения нужны для того, чтобы процесс не превращался в хаос и беспорядочный крик. Если участник уходит в некорректную линию, нарушает порядок или задает спорный вопрос, другая сторона может попытаться это остановить. Судья оценивает, насколько такое вмешательство обосновано.",
    keywords: ["возражения", "протесты", "зачем нужны протесты"],
  },

  // ===== ТЕРМИНЫ =====
  {
    id: "term-motion",
    category: "Термины",
    title: "Ходатайство",
    content:
      "Ходатайство это обращение к судье с просьбой совершить определенное процессуальное действие, разрешить что либо, учесть обстоятельство или изменить порядок разбирательства. Проще говоря, это официальный запрос к суду по ходу дела.",
    keywords: ["ходатайство", "что такое ходатайство", "термин"],
  },
  {
    id: "term-objection",
    category: "Термины",
    title: "Протест",
    content:
      "Протест это заявление о том, что действие, реплика, вопрос или поведение участника считаются некорректными, спорными или нарушающими порядок процесса. После протеста судья принимает решение, удовлетворить его или отклонить.",
    keywords: ["протест", "что такое протест", "термин"],
  },
  {
    id: "term-testimony",
    category: "Термины",
    title: "Показания",
    content:
      "Показания это сведения, которые участник или свидетель сообщает суду о событиях, обстоятельствах и своей версии произошедшего. Сила показаний зависит от их последовательности, логичности и того, не опровергаются ли они фактами.",
    keywords: ["показания", "что такое показания", "термин"],
  },
  {
    id: "term-argument",
    category: "Термины",
    title: "Аргумент",
    content:
      "Аргумент это мысль или довод, который поддерживает вашу позицию и помогает убедить судью. Хороший аргумент должен не просто звучать уверенно, а выдерживать вопросы, связываться с фактами и усиливать общую линию стороны.",
    keywords: ["аргумент", "что такое аргумент", "термин"],
  },
  {
    id: "term-evidence",
    category: "Термины",
    title: "Доказательство",
    content:
      "Доказательство это то, на чем строится убеждение суда. В логике игры доказательствами выступают прежде всего раскрытые факты, последовательные показания, сильные аргументы и обнаруженные противоречия оппонента.",
    keywords: ["доказательство", "доказательства", "термин"],
  },
  {
    id: "term-cross",
    category: "Термины",
    title: "Перекрестный допрос",
    content:
      "Перекрестный допрос это стадия или способ ведения вопросов, при котором одна сторона проверяет чужую позицию на прочность. Его задача состоит в том, чтобы выявить неточности, противоречия, слабые места или вынудить оппонента к неудобному ответу.",
    keywords: ["перекрестный допрос", "допрос", "термин"],
  },
  {
    id: "term-verdict",
    category: "Термины",
    title: "Вердикт",
    content:
      "Вердикт это итоговое решение судьи по завершении процесса. Он отражает то, какую сторону судья посчитал более убедительной и каким увидел исход спора по итогам всего матча.",
    keywords: ["вердикт", "что такое вердикт", "термин"],
  },
  {
    id: "term-pleading",
    category: "Термины",
    title: "Прения сторон",
    content:
      "Прения сторон это основная стадия спора, в которой участники сопоставляют свои позиции, атакуют аргументы друг друга, раскрывают факты, отвечают на неудобные моменты и стараются склонить судью на свою сторону.",
    keywords: ["прения сторон", "что такое прения", "термин"],
  },
  {
    id: "term-opening",
    category: "Термины",
    title: "Вступительная речь",
    content:
      "Вступительная речь это первое структурированное выступление стороны, в котором она обозначает свою позицию, общую версию событий и направление дальнейшей аргументации. Это не подробный спор, а задание рамки восприятия дела.",
    keywords: ["вступительная речь", "что такое вступительная речь", "термин"],
  },
  {
    id: "term-closing",
    category: "Термины",
    title: "Заключительное слово",
    content:
      "Заключительное слово это финальное выступление перед вердиктом, в котором сторона кратко подводит итог своей позиции, напоминает о главных доводах и показывает судье, почему именно ее линия выглядит сильнее.",
    keywords: ["заключительное слово", "что такое заключительное слово", "термин"],
  },
  {
    id: "term-burden",
    category: "Термины",
    title: "Бремя доказывания",
    content:
      "Бремя доказывания это обязанность стороны убедительно подтверждать свои утверждения. Если вы что то заявляете, но не можете это удержать логикой, фактами и ответами на вопросы, судья может посчитать позицию слабой.",
    keywords: ["бремя доказывания", "доказывание", "термин"],
  },
  {
    id: "term-relevance",
    category: "Термины",
    title: "Релевантность",
    content:
      "Релевантность это значимость сказанного для рассматриваемого дела. Если реплика, вопрос или аргумент не помогают понять обстоятельства спора и не связаны с предметом процесса, судья может посчитать их нерелевантными.",
    keywords: ["релевантность", "релевантный", "термин"],
  },
  {
    id: "term-admissibility",
    category: "Термины",
    title: "Допустимость",
    content:
      "Допустимость это оценка того, можно ли вообще учитывать определенный аргумент, действие, вопрос или материал внутри процесса. В игровой логике допустимость часто решается судьей, если возникает спор о корректности хода.",
    keywords: ["допустимость", "допустимый", "термин"],
  },
  {
    id: "term-materiality",
    category: "Термины",
    title: "Существенность",
    content:
      "Существенность это важность обстоятельства для исхода дела. Не каждая деталь одинаково ценна. Судья обычно больше внимания уделяет тем моментам, которые реально влияют на понимание вины, ответственности или правоты сторон.",
    keywords: ["существенность", "существенный", "термин"],
  },
  {
    id: "term-contradiction",
    category: "Термины",
    title: "Противоречие",
    content:
      "Противоречие это несовпадение между словами участника, его предыдущими заявлениями, фактами или общей логикой дела. Найденное противоречие часто ослабляет доверие к позиции стороны и может стать ключевой точкой атаки в споре.",
    keywords: ["противоречие", "несовпадение", "термин"],
  },
  {
    id: "term-precedent",
    category: "Термины",
    title: "Прецедент",
    content:
      "Прецедент это ранее существовавший случай, на который можно ориентироваться при оценке похожей ситуации. Внутри игры этот термин полезен как способ мышления: если обстоятельства похожи на уже знакомый тип дела, участник может пытаться провести аналогию.",
    keywords: ["прецедент", "что такое прецедент", "термин"],
  },
  {
    id: "term-case-law",
    category: "Термины",
    title: "Казуальная практика",
    content:
      "Казуальная практика это подход, при котором логика оценки строится на конкретных случаях и типичных кейсах. Проще говоря, это ориентир на то, как обычно рассматриваются похожие ситуации и какие выводы из них следуют.",
    keywords: ["казуальная практика", "кейсы", "практика", "термин"],
  },
  {
    id: "term-judicial-practice",
    category: "Термины",
    title: "Судебная практика",
    content:
      "Судебная практика это сложившийся подход к рассмотрению похожих дел. Внутри игры этот термин можно понимать как ориентир на типичную судебную логику, здравый смысл процесса и повторяющиеся модели оценки обстоятельств.",
    keywords: ["судебная практика", "практика", "термин"],
  },
  {
    id: "term-motive",
    category: "Термины",
    title: "Мотив",
    content:
      "Мотив это предполагаемая причина, по которой участник мог действовать определенным образом. Мотив сам по себе не заменяет доказательства, но может усиливать общую логику позиции и делать версию событий более правдоподобной.",
    keywords: ["мотив", "что такое мотив", "термин"],
  },
  {
    id: "term-intent",
    category: "Термины",
    title: "Умысел",
    content:
      "Умысел это осознанное намерение совершить определенное действие или допустить определенный результат. В логике разбирательства различие между случайностью, неосторожностью и умыслом может сильно влиять на восприятие ситуации судьей.",
    keywords: ["умысел", "намерение", "термин"],
  },
  {
    id: "term-negligence",
    category: "Термины",
    title: "Неосторожность",
    content:
      "Неосторожность это поведение, при котором человек не стремился к плохому результату напрямую, но допустил его из за невнимательности, беспечности или отсутствия должной осторожности. Это важное понятие для оценки степени вины.",
    keywords: ["неосторожность", "невнимательность", "термин"],
  },

  // ===== СОВЕТЫ НОВИЧКУ =====
  {
    id: "tips-beginner",
    category: "Советы новичку",
    title: "С чего начать новичку",
    content:
      "Если вы играете впервые, сначала внимательно прочитайте свою роль и свои факты. Затем определите главный смысл своей позиции. Не пытайтесь сразу сказать все. Лучше выбрать простую и ясную линию, а уже потом усиливать ее по ходу процесса.",
    keywords: ["новичок", "с чего начать", "первый матч"],
  },
  {
  id: "term-presumption",
  category: "Термины",
  title: "Презумпция невиновности",
  content:
    "Презумпция невиновности это принцип, при котором человек считается невиновным, пока его вина не доказана. Обязанность доказать вину лежит на стороне обвинения, а любые сомнения трактуются в пользу защиты.",
  keywords: ["презумпция невиновности", "невиновен пока не доказано", "доказывание", "термин"],
  },
  {
  id: "term-crime-structure",
  category: "Термины",
  title: "Состав преступления",
  content:
    "Состав преступления это совокупность обязательных признаков, по которым деяние считается преступлением. Включает объект, действие, лицо и его намерение. Если хотя бы одного элемента нет, обвинение становится слабым или необоснованным.",
  keywords: ["состав преступления", "признаки преступления", "термин"],
  },
  {
    id: "tips-speaking",
    category: "Советы новичку",
    title: "Как говорить убедительно",
    content:
      "Говорите коротко, ясно и последовательно. Не перескакивайте между разными мыслями и не перегружайте речь лишним шумом. Для судьи почти всегда убедительнее тот, кто держит четкую линию, чем тот, кто просто говорит много.",
    keywords: ["как говорить", "убедительность", "риторика", "новичок"],
  },
  {
    id: "tips-mistakes",
    category: "Советы новичку",
    title: "Частые ошибки игроков",
    content:
      "Частые ошибки это хаотичная речь без структуры, раннее раскрытие сильных фактов, слабое использование вопросов, бессмысленная трата карт механик и игнорирование своей роли в процессе. Чем лучше вы понимаете порядок этапов и логику суда, тем сильнее будет ваша игра.",
    keywords: ["ошибки", "частые ошибки", "советы", "новичок"],
  },
];


function normalizeHelpContent(content: string | string[]): string {
  return Array.isArray(content)
    ? content.map((line) => line.trim()).filter(Boolean).join("\n\n")
    : content;
}

function normalizeHelpKeywords(
  keywords: string[] | string | undefined,
): string[] {
  if (!keywords) return [];
  if (Array.isArray(keywords)) return keywords;
  return keywords
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildHelpTopicId(topic: HelpTopicDraft, index: number): string {
  return topic.id ?? `help-topic-${index + 1}`;
}

const HELP_TOPICS: HelpTopic[] = HELP_TOPICS_SOURCE.map((topic, index) => ({
  id: buildHelpTopicId(topic, index),
  category: topic.category,
  title: topic.title,
  content: normalizeHelpContent(topic.content),
  keywords: normalizeHelpKeywords(topic.keywords),
}));

const HELP_CATEGORY_ORDER = Array.from(
  new Set(HELP_TOPICS.map((topic) => topic.category)),
);

function normalizeHelpText(text: string): string {
  return text.toLowerCase().trim();
}

function isHelpTopicMatch(topic: HelpTopic, query: string): boolean {
  if (!query.trim()) return true;
  const normalized = normalizeHelpText(query);
  const fullText = normalizeHelpText(
    `${topic.title} ${topic.content} ${topic.keywords.join(" ")}`,
  );
  return fullText.includes(normalized);
}

function HelpCenter({
  query,
  onQueryChange,
  compact = false,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  compact?: boolean;
}) {
  const filteredTopics = useMemo(
    () => HELP_TOPICS.filter((topic) => isHelpTopicMatch(topic, query)),
    [query],
  );

  const groupedTopics = useMemo(
    () =>
      HELP_CATEGORY_ORDER.map((category) => ({
        category,
        items: filteredTopics.filter((item) => item.category === category),
      })).filter((group) => group.items.length > 0),
    [filteredTopics],
  );

  const hasSearchQuery = query.trim().length > 0;
  const [openCategoryValues, setOpenCategoryValues] = useState<string[]>([]);
  const [openTopicValuesByCategory, setOpenTopicValuesByCategory] = useState<
    Record<string, string[]>
  >({});

  useEffect(() => {
    if (!hasSearchQuery) {
      setOpenCategoryValues([]);
      setOpenTopicValuesByCategory({});
      return;
    }

    const nextCategories = groupedTopics.map((group) => group.category);
    const nextOpenTopics = Object.fromEntries(
      groupedTopics.map((group) => [
        group.category,
        group.items.map((item) => item.id),
      ]),
    ) as Record<string, string[]>;

    setOpenCategoryValues(nextCategories);
    setOpenTopicValuesByCategory(nextOpenTopics);
  }, [hasSearchQuery, groupedTopics]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Поиск по помощи..."
          className={`pl-10 rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-red-500 ${
            compact ? "h-10" : "h-11"
          }`}
        />
      </div>

      {filteredTopics.length === 0 ? (
        <Card className="rounded-2xl border-zinc-800 bg-zinc-900/80 text-zinc-100">
          <CardContent className="p-5 text-sm text-zinc-400">
            Ничего не найдено. Попробуйте другой запрос.
          </CardContent>
        </Card>
      ) : (
        <Accordion
          type="multiple"
          className="space-y-3"
          value={openCategoryValues}
          onValueChange={setOpenCategoryValues}
        >
          {groupedTopics.map((group) => (
            <AccordionItem
              key={group.category}
              value={group.category}
              className="border-0"
            >
              <Card className="rounded-2xl border-zinc-800 bg-zinc-900/80 text-zinc-100">
                <CardHeader className="p-0">
                  <AccordionTrigger className="h-16 px-5 py-0 text-zinc-100 hover:no-underline">
                    <span
                      className={`flex items-center gap-2 leading-none ${
                        compact ? "text-base" : "text-lg"
                      }`}
                    >
                      {group.category}
                      <Badge className="bg-zinc-800 text-zinc-300 border border-zinc-700">
                        {group.items.length}
                      </Badge>
                    </span>
                  </AccordionTrigger>
                </CardHeader>
                <AccordionContent>
                  <CardContent className={compact ? "pt-0 pb-4" : "pt-0"}>
                    <Accordion
                      type="multiple"
                      className="w-full"
                      value={openTopicValuesByCategory[group.category] ?? []}
                      onValueChange={(values) =>
                        setOpenTopicValuesByCategory((prev) => ({
                          ...prev,
                          [group.category]: values,
                        }))
                      }
                    >
                      {group.items.map((item) => (
                        <AccordionItem
                          key={item.id}
                          value={item.id}
                          className="border-zinc-800"
                        >
                          <AccordionTrigger className="text-zinc-100 hover:no-underline">
                            {item.title}
                          </AccordionTrigger>
                          <AccordionContent className="text-zinc-400 leading-relaxed whitespace-pre-line">
                            {item.content}
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </CardContent>
                </AccordionContent>
              </Card>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}

interface PlayerInfo {
  id: string;
  userId?: string;
  name: string;
  avatar?: string;
  banner?: string;
  selectedBadgeKey?: string;
  roleKey?: string;
  roleTitle?: string;
  warningCount?: number;
  disconnectedUntil?: number;
}

interface Fact {
  id: string;
  text: string;
  revealed: boolean;
}

interface Card_ {
  id: string;
  name: string;
  description: string;
  used: boolean;
}

interface RevealedFact {
  id: string;
  ownerId?: string;
  text: string;
  owner: string;
  ownerRole: string;
  stageIndex?: number;
}

interface UsedCard {
  id: string;
  ownerId?: string;
  owner: string;
  ownerRole: string;
  name: string;
  description: string;
}

interface LobbyChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  text: string;
  createdAt: number;
}

interface LawyerChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: number;
}

interface LawyerChatPartner {
  id: string;
  name: string;
  roleTitle?: string;
}

interface InfluenceAnnouncement {
  id: string;
  kind: "protest" | "silence" | "warning" | "card";
  title: string;
  subtitle?: string;
  durationMs?: number;
}

interface ActiveProtest {
  id: string;
  actorId: string;
  actorName: string;
  actorRoleTitle: string;
  createdAt: number;
}

interface PublicMatchInfo {
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

interface AuthUser {
  id: string;
  login: string;
  email: string;
  nickname: string;
  avatar?: string;
  banner?: string;
  bio?: string;
  gender?: "male" | "female" | "other";
  birthDate?: string;
  hideAge: boolean;
  createdAt: number;
  selectedBadgeKey?: string;
}

interface PublicUserProfile {
  id: string;
  nickname: string;
  avatar?: string;
  banner?: string;
  bio?: string;
  gender?: "male" | "female" | "other";
  birthDate?: string;
  hideAge: boolean;
  age?: number;
  createdAt: number;
  stats?: {
    totalMatches: number;
    totalWins: number;
    totalWinRate: number;
    roleStats: Array<{
      roleKey: string;
      matches: number;
      wins: number;
      winRate: number;
    }>;
  };
  rank?: {
    key: string;
    title: string;
    points: number;
    level: number;
    minPoints: number;
    nextPoints?: number;
    nextTitle?: string;
    progressCurrent: number;
    progressTarget: number;
  };
  badges?: Array<{
    key: string;
    title: string;
    description: string;
    active: boolean;
    category?: "rank" | "earned" | "manual";
    progressCurrent?: number;
    progressTarget?: number;
    progressLabel?: string;
  }>;
  selectedBadgeKey?: string;
  recentMatches?: Array<{
    roomCode: string;
    verdict: string;
    expectedVerdict: string;
    roleKey: string;
    roleTitle: string;
    didWin: boolean;
    finishedAt: number;
    participants: Array<{
      userId?: string;
      nickname: string;
      roleKey: string;
      roleTitle: string;
      isSelf: boolean;
    }>;
  }>;
  subscription?: {
    tier: "none" | string;
    label: string;
  };
}

interface MyPlayer {
  id: string;
  userId?: string;
  name: string;
  avatar?: string;
  banner?: string;
  roleKey: string;
  roleTitle: string;
  goal: string;
  facts: Fact[];
  cards: Card_[];
  canRevealFactsNow?: boolean;
}

interface GameState {
  caseData: {
    mode: string;
    title: string;
    description: string;
    truth: string;
    evidence: string[];
  };
  players: PlayerInfo[];
  stages: string[];
  stageIndex: number;
  revealedFacts: RevealedFact[];
  usedCards: UsedCard[];
  activeProtest: ActiveProtest | null;
  finished: boolean;
  verdict: string;
  verdictEvaluation: string;
  verdictCloseAt?: number | null;
  matchExpiresAt?: number | null;
  me: MyPlayer | null;
  code: string;
  hostId: string;
}

interface RoomState {
  code: string;
  roomName?: string;
  modeKey?: RoomModeKey;
  maxPlayers?: number;
  hostId: string;
  players: PlayerInfo[];
  started: boolean;
  isHostJudge?: boolean;
  visibility?: "public" | "private";
  venueLabel?: string;
  venueUrl?: string;
  requiresPassword?: boolean;
  lobbyChat?: LobbyChatMessage[];
}

function Avatar({
  src,
  name,
  size = 32,
}: {
  src: string | null;
  name: string;
  size?: number;
}) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className="rounded-full object-cover flex-shrink-0 border border-zinc-700"
        style={{ width: size, height: size }}
      />
    );
  }
  const initials = name ? name.slice(0, 2).toUpperCase() : "??";
  return (
    <div
      className="rounded-full bg-zinc-700 text-zinc-200 flex items-center justify-center flex-shrink-0 text-xs font-bold border border-zinc-600"
      style={{ width: size, height: size }}
    >
      {initials}
    </div>
  );
}

function buildNeutralBannerGradient(): string {
  return "linear-gradient(180deg, rgba(70,74,84,0.88) 0%, rgba(46,49,58,0.9) 100%)";
}

function getBannerStyle(
  banner: string | null | undefined,
  _avatar: string | null | undefined,
  _seedName: string,
): React.CSSProperties {
  const normalizedBanner = typeof banner === "string" ? banner.trim() : "";
  if (normalizedBanner) {
    return {
      backgroundImage: `url(${normalizedBanner})`,
      backgroundSize: "cover",
      backgroundPosition: "50% 35%",
      backgroundRepeat: "no-repeat",
    };
  }
  return {
    backgroundImage: buildNeutralBannerGradient(),
  };
}

const ROLE_TITLES: Record<string, string> = {
  plaintiff: "Истец",
  defendant: "Ответчик",
  plaintiffLawyer: "Адвокат истца",
  defenseLawyer: "Адвокат ответчика",
  prosecutor: "Прокурор",
  judge: "Судья",
  witness: "Свидетель",
};

function getGenderLabel(gender: PublicUserProfile["gender"]): string {
  if (gender === "male") return "Мужской";
  if (gender === "female") return "Женский";
  if (gender === "other") return "Другой";
  return "Не указан";
}

function computeAgeFromIsoDate(isoDate: string | undefined): number | undefined {
  if (!isoDate) return undefined;
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return undefined;
  const now = new Date();
  let age = now.getFullYear() - year;
  const monthDiff = now.getMonth() + 1 - month;
  const dayDiff = now.getDate() - day;
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) age -= 1;
  if (age < 13 || age > 120) return undefined;
  return age;
}

function formatIsoDateToRu(value: string | undefined): string {
  if (!value) return "";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  return `${match[3]}.${match[2]}.${match[1]}`;
}

function parseRuDateToIso(value: string): string | null {
  const normalized = value.trim();
  if (!normalized) return null;
  const match = normalized.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) return null;
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day
    .toString()
    .padStart(2, "0")}`;
}

type CropTarget = "avatar" | "banner";
const AVATAR_CROP_VIEW_SIZE = 280;
const BANNER_CROP_VIEW_WIDTH = 960;
const BANNER_CROP_VIEW_HEIGHT = 270;

function normalizeBadgeVisualKey(badgeKey?: string): string | undefined {
  if (!badgeKey) return undefined;
  const trimmed = badgeKey.trim();
  const roleKey = trimmed.startsWith("role_") ? trimmed.slice("role_".length) : trimmed;
  const roleAliases: Record<string, string> = {
    plaintiff_lawyer: "plaintiffLawyer",
    defense_lawyer: "defenseLawyer",
    defense_lawer: "defenseLawyer",
    plaintifflawyer: "plaintiffLawyer",
    defenselawyer: "defenseLawyer",
    rank_novice: "rankNovice",
    rank_debater: "rankDebater",
    rank_orator: "rankOrator",
    rank_strategist: "rankStrategist",
    rank_master: "rankMaster",
    rank_verdict: "rankVerdict",
    novice: "rankNovice",
    debater: "rankDebater",
    orator: "rankOrator",
    strategist: "rankStrategist",
    master: "rankMaster",
    verdict: "rankVerdict",
  };
  return roleAliases[roleKey] ?? roleKey;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

async function cropImageDataUrl(options: {
  sourceDataUrl: string;
  target: CropTarget;
  zoom: number;
  offsetX: number;
  offsetY: number;
  flipX: boolean;
}): Promise<string> {
  const { sourceDataUrl, target, flipX } = options;
  const zoom = clampNumber(options.zoom, 1, 3);
  const viewWidth = target === "avatar" ? AVATAR_CROP_VIEW_SIZE : BANNER_CROP_VIEW_WIDTH;
  const viewHeight = target === "avatar" ? AVATAR_CROP_VIEW_SIZE : BANNER_CROP_VIEW_HEIGHT;
  const outputWidth = target === "avatar" ? 512 : 1280;
  const outputHeight = target === "avatar" ? 512 : 360;

  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const sourceWidth = image.naturalWidth || image.width;
      const sourceHeight = image.naturalHeight || image.height;
      if (!sourceWidth || !sourceHeight) {
        resolve(sourceDataUrl);
        return;
      }

      const baseScale = Math.max(viewWidth / sourceWidth, viewHeight / sourceHeight);
      const displayWidth = sourceWidth * baseScale * zoom;
      const displayHeight = sourceHeight * baseScale * zoom;
      const maxOffsetX = Math.max(0, (displayWidth - viewWidth) / 2);
      const maxOffsetY = Math.max(0, (displayHeight - viewHeight) / 2);
      const offsetX = clampNumber(options.offsetX, -maxOffsetX, maxOffsetX);
      const offsetY = clampNumber(options.offsetY, -maxOffsetY, maxOffsetY);

      const sx = clampNumber(
        ((displayWidth - viewWidth) / 2 - offsetX) / (baseScale * zoom),
        0,
        sourceWidth - 1,
      );
      const sy = clampNumber(
        ((displayHeight - viewHeight) / 2 - offsetY) / (baseScale * zoom),
        0,
        sourceHeight - 1,
      );
      const cropWidth = clampNumber(viewWidth / (baseScale * zoom), 1, sourceWidth - sx);
      const cropHeight = clampNumber(viewHeight / (baseScale * zoom), 1, sourceHeight - sy);

      const canvas = document.createElement("canvas");
      canvas.width = outputWidth;
      canvas.height = outputHeight;
      const context = canvas.getContext("2d");
      if (!context) {
        resolve(sourceDataUrl);
        return;
      }
      if (flipX) {
        context.save();
        context.translate(outputWidth, 0);
        context.scale(-1, 1);
      }
      context.drawImage(
        image,
        sx,
        sy,
        cropWidth,
        cropHeight,
        0,
        0,
        outputWidth,
        outputHeight,
      );
      if (flipX) {
        context.restore();
      }

      resolve(canvas.toDataURL("image/jpeg", 0.88));
    };
    image.onerror = () => resolve(sourceDataUrl);
    image.src = sourceDataUrl;
  });
}

async function authRequest<T>(
  path: string,
  options?: {
    method?: "GET" | "POST" | "PATCH";
    token?: string | null;
    body?: unknown;
  },
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method: options?.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options?.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof payload?.message === "string" && payload.message.trim()
        ? payload.message
        : "Ошибка запроса.";
    throw new Error(message);
  }
  return payload as T;
}

function localizeAuthError(message: string): string {
  if (/[А-Яа-яЁё]/.test(message)) {
    return message;
  }
  const normalized = message.trim().toLowerCase();
  if (!normalized) return "Произошла ошибка. Попробуйте снова.";
  if (
    normalized.includes("invalid login/email or password") ||
    normalized.includes("login failed")
  ) {
    return "Неверный логин/email или пароль.";
  }
  if (
    normalized.includes("login is already taken") ||
    normalized.includes("login already taken") ||
    (normalized.includes("login") && normalized.includes("already") && normalized.includes("taken"))
  ) {
    return "Логин уже занят.";
  }
  if (
    normalized.includes("email is already in use") ||
    normalized.includes("email already taken") ||
    (normalized.includes("email") && normalized.includes("already")) ||
    normalized.includes("email_normalized")
  ) {
    return "Эта почта уже используется.";
  }
  if (
    normalized.includes("nickname is already taken") ||
    normalized.includes("nickname already taken") ||
    (normalized.includes("nickname") && normalized.includes("already")) ||
    normalized.includes("nickname_normalized") ||
    normalized.includes("login_normalized")
  ) {
    return "Никнейм уже занят.";
  }
  if (normalized.includes("duplicate key")) {
    return "Никнейм уже занят.";
  }
  if (normalized.includes("passwords do not match")) {
    return "Пароли не совпадают.";
  }
  if (normalized.includes("password must be at least 6")) {
    return "Пароль должен быть не короче 6 символов.";
  }
  if (normalized.includes("invalid birth date")) {
    return "Укажите корректную дату рождения.";
  }
  if (
    normalized.includes("must be at least 13") ||
    normalized.includes("не младше 13")
  ) {
    return "Вам должно быть не меньше 13 лет.";
  }
  if (normalized.includes("login must be at least 3")) {
    return "Логин должен быть не короче 3 символов.";
  }
  if (normalized.includes("valid email")) {
    return "Введите корректную почту.";
  }
  if (normalized.includes("must accept the site rules")) {
    return "Нужно принять правила сайта.";
  }
  if (normalized.includes("please enter login/email and password")) {
    return "Введите логин/email и пароль.";
  }
  if (normalized.includes("invalid current password")) {
    return "Текущий пароль введен неверно.";
  }
  if (
    normalized.includes("current password and new password are required") ||
    normalized.includes("current password and new email are required")
  ) {
    return "Заполните обязательные поля.";
  }
  if (normalized.includes("password change failed")) {
    return "Не удалось сменить пароль.";
  }
  if (normalized.includes("email change failed")) {
    return "Не удалось сменить почту.";
  }
  if (normalized.includes("user not found")) {
    return "Профиль игрока не найден.";
  }
  if (normalized.includes("unauthorized") || normalized.includes("invalid session")) {
    return "Сессия истекла. Войдите снова.";
  }
  if (normalized.includes("not found")) {
    return "Не найдено.";
  }
  return "Произошла ошибка. Попробуйте снова.";
}

function isNicknameTakenError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("никнейм уже занят") ||
    normalized.includes("логин уже занят") ||
    normalized.includes("nickname already taken") ||
    normalized.includes("login already taken")
  );
}

function isEmailTakenError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("эта почта уже используется") ||
    normalized.includes("эта почта уже занята") ||
    normalized.includes("email already taken")
  );
}

function getBadgeTheme(
  badgeKey?: string,
): { chip: string; icon: string; iconOnly?: string } {
  const visualKey = normalizeBadgeVisualKey(badgeKey);
  if (!badgeKey) {
    return {
      chip: "border-zinc-600 bg-zinc-800/60 text-zinc-200",
      icon: "border-zinc-600 bg-zinc-800/60 text-zinc-200",
      iconOnly: "text-zinc-300",
    };
  }
  return BADGE_THEME[visualKey ?? ""] ?? {
    chip: "border-zinc-600 bg-zinc-800/60 text-zinc-200",
    icon: "border-zinc-600 bg-zinc-800/60 text-zinc-200",
    iconOnly: "text-zinc-300",
  };
}

function BadgeGlyph({
  badgeKey,
  className = "",
}: {
  badgeKey?: string;
  className?: string;
}) {
  const visualKey = normalizeBadgeVisualKey(badgeKey);
  const Icon = visualKey ? BADGE_ICONS[visualKey] : undefined;
  if (!Icon) {
    return (
      <span
        className={`inline-flex items-center justify-center leading-none align-middle shrink-0 ${className}`}
      >
        ★
      </span>
    );
  }
  return <Icon className={`inline-block align-middle leading-none shrink-0 ${className}`} />;
}

function rankKeyToBadgeVisualKey(rankKey?: string): string | undefined {
  if (!rankKey) return undefined;
  const normalized = rankKey.trim().toLowerCase();
  const map: Record<string, string> = {
    novice: "rankNovice",
    debater: "rankDebater",
    orator: "rankOrator",
    strategist: "rankStrategist",
    master: "rankMaster",
    verdict: "rankVerdict",
    rank_novice: "rankNovice",
    rank_debater: "rankDebater",
    rank_orator: "rankOrator",
    rank_strategist: "rankStrategist",
    rank_master: "rankMaster",
    rank_verdict: "rankVerdict",
  };
  return map[normalized];
}

function getNextRankKey(rankKey?: string): string | undefined {
  const normalized = rankKey?.trim().toLowerCase();
  if (!normalized) return undefined;
  const order = ["novice", "debater", "orator", "strategist", "master", "verdict"];
  const index = order.findIndex((item) => item === normalized);
  if (index < 0 || index >= order.length - 1) return undefined;
  return order[index + 1];
}

function getRankTitleByKey(rankKey?: string): string {
  const normalized = rankKey?.trim().toLowerCase();
  const map: Record<string, string> = {
    novice: "НОВИЧОК",
    debater: "СПОРЩИК",
    orator: "ОРАТОР",
    strategist: "СТРАТЕГ",
    master: "МАСТЕР",
    verdict: "ВЕРДИКТ",
  };
  return map[normalized ?? ""] ?? "РАНГ";
}

const RANK_PROGRESS_COLOR_BY_VISUAL_KEY: Record<string, string> = {
  rankNovice: "#94a3b8",
  rankDebater: "#38bdf8",
  rankOrator: "#a78bfa",
  rankStrategist: "#2dd4bf",
  rankMaster: "#f87171",
  rankVerdict: "#fb7185",
};

function getRankProgressVisual(fromRankKey?: string, toRankKey?: string): {
  gradient: string;
  glow: string;
  shimmer: string;
} {
  const fromVisual = rankKeyToBadgeVisualKey(fromRankKey) ?? "rankNovice";
  const toVisual = rankKeyToBadgeVisualKey(toRankKey) ?? fromVisual;
  const fromColor = RANK_PROGRESS_COLOR_BY_VISUAL_KEY[fromVisual] ?? "#f43f5e";
  const toColor = RANK_PROGRESS_COLOR_BY_VISUAL_KEY[toVisual] ?? fromColor;
  return {
    gradient: `linear-gradient(90deg, ${fromColor} 0%, ${toColor} 100%)`,
    glow: `${toColor}66`,
    shimmer: `${toColor}88`,
  };
}

function getBadgeTitleByKey(
  badgeKey: string | undefined,
  badges?: Array<{ key: string; title: string }>,
): string {
  if (!badgeKey) return "";
  return badges?.find((item) => item.key === badgeKey)?.title ?? badgeKey;
}

function getBadgeCategory(badge: {
  key: string;
  category?: "rank" | "earned" | "manual";
}): "rank" | "earned" | "manual" {
  if (badge.category) return badge.category;
  if (badge.key.startsWith("rank_")) return "rank";
  if (
    ["media", "creator", "host", "innovator", "moderator", "admin", "legend"].includes(
      badge.key,
    )
  ) {
    return "manual";
  }
  return "earned";
}

function PlayerCard({
  player,
  isHost,
  canKick = false,
  onKick,
  onOpenProfile,
  nowTs,
}: {
  player: PlayerInfo;
  isHost: boolean;
  canKick?: boolean;
  onKick?: () => void;
  onOpenProfile?: (userId?: string) => void;
  nowTs: number;
}) {
  const canOpenProfile = !!player.userId && !!onOpenProfile;
  const badgeTheme = getBadgeTheme(player.selectedBadgeKey);
  const disconnectRemainingMs =
    typeof player.disconnectedUntil === "number"
      ? Math.max(0, player.disconnectedUntil - nowTs)
      : 0;
  const isDisconnected = disconnectRemainingMs > 0;
  const disconnectProgress = isDisconnected
    ? 1 - Math.min(1, disconnectRemainingMs / RECONNECT_GRACE_MS)
    : 1;
  const red = Math.round(239 + (113 - 239) * disconnectProgress);
  const green = Math.round(68 + (113 - 68) * disconnectProgress);
  const blue = Math.round(68 + (122 - 68) * disconnectProgress);
  const doorColor = `rgb(${red}, ${green}, ${blue})`;
  return (
    <motion.div variants={cardVariants} initial="initial" animate="animate">
      <Card className="rounded-2xl shadow-sm bg-zinc-900/90 border-zinc-800 text-zinc-100">
        <CardContent className="relative overflow-hidden p-4 pt-5 flex items-center justify-between gap-3">
          <div
            className="pointer-events-none absolute inset-[6px] rounded-[16px] opacity-85"
            style={getBannerStyle(player.banner, player.avatar, player.name)}
          />
          <div className="pointer-events-none absolute inset-[6px] rounded-[16px] bg-black/35" />
          <button
            type="button"
            disabled={!canOpenProfile}
            onClick={() => canOpenProfile && onOpenProfile?.(player.userId)}
            className={`relative z-10 flex items-center gap-3 min-w-0 text-left ${
              canOpenProfile
                ? "cursor-pointer transition-colors hover:text-zinc-100"
                : "cursor-default"
            }`}
          >
            <Avatar src={player.avatar ?? null} name={player.name} size={72} />
            <div className="min-w-0">
              <div className="font-semibold text-base truncate inline-flex items-center gap-2">
                <span className="truncate">{player.name}</span>
                {player.selectedBadgeKey ? (
                  <span
                    className={`inline-flex h-6 w-6 shrink-0 self-center items-center justify-center rounded-md border border-zinc-600/80 shadow-[0_0_0_1px_rgba(0,0,0,0.28)] ${badgeTheme.icon}`}
                  >
                    <BadgeGlyph badgeKey={player.selectedBadgeKey} className="h-3.5 w-3.5" />
                  </span>
                ) : null}
              </div>
              <div className="text-sm text-zinc-400">
                {isHost ? "Ведущий комнаты" : "Игрок"}
              </div>
            </div>
          </button>
          <div className="relative z-10 flex items-center gap-2">
            {(player.warningCount ?? 0) > 0 && (
              <Badge className="bg-red-950/70 text-red-300 border border-red-700/70">
                Предупреждения: {player.warningCount}/3
              </Badge>
            )}
            {isDisconnected && (
              <motion.div
                animate={{ opacity: [0.85, 1, 0.85], scale: [1, 1.04, 1] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-900/80 px-2 py-1"
                title={`Игрок вышел. Осталось ${Math.ceil(disconnectRemainingMs / 1000)} сек.`}
              >
                <DoorOpen className="h-4 w-4" style={{ color: doorColor }} />
                <span className="text-xs text-zinc-400">
                  {Math.ceil(disconnectRemainingMs / 1000)}s
                </span>
              </motion.div>
            )}
            <Badge
              className={
                isHost
                  ? "bg-red-600 text-white border-0"
                  : "bg-zinc-800 text-zinc-100 border border-zinc-700"
              }
            >
              {isHost ? "Host" : "Игрок"}
            </Badge>
            {canKick && onKick && (
              <Button
                size="sm"
                className="h-8 rounded-full px-3 gap-1.5 bg-red-600/90 hover:bg-red-500 text-white border-0 shadow-sm shadow-red-900/30"
                onClick={onKick}
              >
                <UserX className="w-3.5 h-3.5" />
                Kick
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function InfoBlock({
  title,
  icon,
  children,
  action,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Card className="rounded-2xl shadow-sm h-full bg-zinc-900/90 border-zinc-800 text-zinc-100">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-2 text-lg text-zinc-100">
          <span className="flex items-center gap-2">
            {icon}
            {title}
          </span>
          {action}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-zinc-100">{children}</CardContent>
    </Card>
  );
}

type HomeTab = "play" | "development" | "help";

function ContextHelp({
  open,
  onOpenChange,
  query,
  onQueryChange,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  query: string;
  onQueryChange: (value: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <motion.button
          type="button"
          variants={floatingHelpButtonVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          whileHover={{ y: -2, scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          className={`fixed right-5 bottom-5 left-auto z-40 h-11 rounded-2xl px-3.5 inline-flex items-center gap-2 border backdrop-blur-md shadow-[0_12px_30px_rgba(0,0,0,0.45)] transition-colors ${
            open
              ? "border-red-500/55 bg-red-950/75 text-red-100"
              : "border-zinc-700 bg-zinc-900/90 text-zinc-100 hover:bg-zinc-900 hover:border-zinc-500"
          }`}
        >
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-red-600 text-white shadow-sm shadow-red-900/50">
            <CircleHelp className="w-3.5 h-3.5" />
          </span>
          Помощь
        </motion.button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl p-0 border-zinc-800 bg-zinc-950 text-zinc-100 origin-bottom-right data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 data-[state=open]:slide-in-from-right-8 data-[state=open]:slide-in-from-bottom-8 data-[state=closed]:slide-out-to-right-8 data-[state=closed]:slide-out-to-bottom-8 duration-200">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="text-zinc-100">Помощь по игре</DialogTitle>
          <DialogDescription className="sr-only">
            Справочная информация по ролям, этапам и механикам игры.
          </DialogDescription>
        </DialogHeader>
        <div className={`px-6 pb-6 max-h-[75vh] overflow-y-auto ${HIDE_SCROLLBAR_CLASS}`}>
          <HelpCenter
            query={query}
            onQueryChange={onQueryChange}
            compact
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ScreenTransitionLoader({ open }: { open: boolean }) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="screen-transition-loader"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16, ease: "easeInOut" }}
          className="fixed inset-0 z-[260] m-0 p-0 grid place-items-center bg-[#09090d]"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeInOut" }}
            className="relative flex flex-col items-center gap-4"
          >
            <motion.span
              aria-hidden
              className="absolute -inset-6 rounded-full bg-red-500/10 blur-2xl"
              animate={{ opacity: [0.45, 0.72, 0.45] }}
              transition={{ duration: 1.3, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.img
              src="/favicon.png"
              alt="CourtGame"
              className="relative z-10 h-32 w-32 select-none drop-shadow-[0_0_24px_rgba(248,113,113,0.42)]"
              animate={{ rotate: [0, 3, 0, -3, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="relative z-10 h-2 w-40 overflow-hidden rounded-full bg-zinc-800"
              initial={{ opacity: 0.85 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.25 }}
            >
              <motion.span
                className="absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-red-300 to-transparent"
                animate={{ x: ["-120%", "260%"] }}
                transition={{ duration: 1.05, repeat: Infinity, ease: "linear" }}
              />
            </motion.div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

export default function App() {
  const [screen, setScreen] = useState<"home" | "profile" | "room" | "game">(
    "home",
  );
  const [screenTransitionLoading, setScreenTransitionLoading] = useState(false);
  const prevScreenRef = useRef<"home" | "profile" | "room" | "game">("home");
  const screenTransitionTimerRef = useRef<number | null>(null);
  const [homeTab, setHomeTab] = useState<HomeTab>("play");
  const [devlogPage, setDevlogPage] = useState(1);
  const [playView, setPlayView] = useState<"quick" | "matches">("quick");
  const [mainHelpQuery, setMainHelpQuery] = useState("");
  const [contextHelpOpen, setContextHelpOpen] = useState(false);
  const [contextHelpQuery, setContextHelpQuery] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [profileNicknameDraft, setProfileNicknameDraft] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(
    () => localStorage.getItem(BANNER_STORAGE_KEY),
  );
  const [profileAvatarDraft, setProfileAvatarDraft] = useState<string | null>(null);
  const [profileBannerDraft, setProfileBannerDraft] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(
    () => localStorage.getItem(AUTH_TOKEN_STORAGE_KEY),
  );
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => {
    const raw = localStorage.getItem(AUTH_USER_STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  });
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [registerLoginError, setRegisterLoginError] = useState("");
  const [registerEmailError, setRegisterEmailError] = useState("");
  const [loginOrEmail, setLoginOrEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [registerLogin, setRegisterLogin] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState("");
  const [registerAcceptRules, setRegisterAcceptRules] = useState(false);
  const [authView, setAuthView] = useState<"form" | "rules">("form");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showRegisterConfirmPassword, setShowRegisterConfirmPassword] = useState(false);
  const [profileBio, setProfileBio] = useState("");
  const [profileGender, setProfileGender] = useState<"" | "male" | "female" | "other">("");
  const [profileBirthDate, setProfileBirthDate] = useState("");
  const [profileNicknameError, setProfileNicknameError] = useState("");
  const [profileBirthDateError, setProfileBirthDateError] = useState("");
  const [profileHideAge, setProfileHideAge] = useState(false);
  const [emailChangeCurrentPassword, setEmailChangeCurrentPassword] = useState("");
  const [emailChangeNext, setEmailChangeNext] = useState("");
  const [passwordChangeCurrent, setPasswordChangeCurrent] = useState("");
  const [passwordChangeNext, setPasswordChangeNext] = useState("");
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [profileActionLoading, setProfileActionLoading] = useState(false);
  const [myProfileLoading, setMyProfileLoading] = useState(false);
  const [myProfile, setMyProfile] = useState<PublicUserProfile | null>(null);
  const [profileMatchesOpen, setProfileMatchesOpen] = useState(false);
  const [selectedBadgeKey, setSelectedBadgeKey] = useState<string>("");
  const [badgePickerOpen, setBadgePickerOpen] = useState(false);
  const [profileExitConfirmOpen, setProfileExitConfirmOpen] = useState(false);
  const [viewPlayerProfileOpen, setViewPlayerProfileOpen] = useState(false);
  const [viewProfileBadgeHintOpen, setViewProfileBadgeHintOpen] = useState(false);
  const [viewPlayerProfileLoading, setViewPlayerProfileLoading] = useState(false);
  const [viewPlayerProfileError, setViewPlayerProfileError] = useState("");
  const [viewPlayerProfile, setViewPlayerProfile] = useState<PublicUserProfile | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [kickedAlert, setKickedAlert] = useState("");
  const [rankResultToast, setRankResultToast] = useState<{
    fromKey: string;
    toKey: string;
    fromTitle: string;
    toTitle: string;
    delta: number;
    fromPoints: number;
    toPoints: number;
    fromProgressPercent: number;
    toProgressPercent: number;
    remainingToNext: number | null;
    progressGradient: string;
    progressGlow: string;
    progressShimmer: string;
    rankUp: boolean;
  } | null>(null);
  const [copiedRoomCode, setCopiedRoomCode] = useState(false);
  const [startGameLoading, setStartGameLoading] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [reconnectExpiresAt, setReconnectExpiresAt] = useState<number | null>(() => {
    const raw = localStorage.getItem("court_reconnect_expires_at");
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) ? parsed : null;
  });
  const [reconnectPersistent, setReconnectPersistent] = useState<boolean>(() => {
    return localStorage.getItem(RECONNECT_PERSISTENT_STORAGE_KEY) === "1";
  });
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [createMatchDialogOpen, setCreateMatchDialogOpen] = useState(false);
  const [publicMatches, setPublicMatches] = useState<PublicMatchInfo[]>([]);
  const [joinPasswordDialogOpen, setJoinPasswordDialogOpen] = useState(false);
  const [joinPasswordDialogMatch, setJoinPasswordDialogMatch] = useState<PublicMatchInfo | null>(null);
  const [joinPasswordInput, setJoinPasswordInput] = useState("");
  const [joinPasswordDialogError, setJoinPasswordDialogError] = useState("");
  const [joinPasswordVisible, setJoinPasswordVisible] = useState(false);
  const [createRoomName, setCreateRoomName] = useState("");
  const [createRoomMode, setCreateRoomMode] = useState<RoomModeKey>("civil_3");
  const [createRoomPrivate, setCreateRoomPrivate] = useState(false);
  const [createVoiceUrl, setCreateVoiceUrl] = useState("");
  const [createRoomPassword, setCreateRoomPassword] = useState("");
  const [createRoomPasswordVisible, setCreateRoomPasswordVisible] = useState(false);
  const [badgeRulesOpen, setBadgeRulesOpen] = useState(false);
  const [imageCropDialogOpen, setImageCropDialogOpen] = useState(false);
  const [imageCropTarget, setImageCropTarget] = useState<CropTarget>("avatar");
  const [imageCropSource, setImageCropSource] = useState<string | null>(null);
  const [imageCropZoom, setImageCropZoom] = useState(1);
  const [imageCropOffsetX, setImageCropOffsetX] = useState(0);
  const [imageCropOffsetY, setImageCropOffsetY] = useState(0);
  const [imageCropFlipX, setImageCropFlipX] = useState(false);
  const [imageCropLoading, setImageCropLoading] = useState(false);
  const [imageCropNaturalWidth, setImageCropNaturalWidth] = useState(1024);
  const [imageCropNaturalHeight, setImageCropNaturalHeight] = useState(1024);
  const [lobbyChatInput, setLobbyChatInput] = useState("");
  const [lobbyChatMessages, setLobbyChatMessages] = useState<LobbyChatMessage[]>([]);
  const [influenceView, setInfluenceView] = useState<
    "main" | "chat" | "notes" | "verdict" | "warnings"
  >(
    "main",
  );
  const [lawyerChatPartner, setLawyerChatPartner] = useState<LawyerChatPartner | null>(
    null,
  );
  const [lawyerChatMessages, setLawyerChatMessages] = useState<LawyerChatMessage[]>(
    [],
  );
  const [lawyerChatInput, setLawyerChatInput] = useState("");
  const [lawyerChatUnreadCount, setLawyerChatUnreadCount] = useState(0);
  const [influenceNotes, setInfluenceNotes] = useState("");
  const [protestCooldownEndsAt, setProtestCooldownEndsAt] = useState(0);
  const [silenceCooldownEndsAt, setSilenceCooldownEndsAt] = useState(0);
  const [influenceAnnouncement, setInfluenceAnnouncement] =
    useState<InfluenceAnnouncement | null>(null);

  const [myId, setMyId] = useState<string | null>(null);
  const [mySessionToken, setMySessionToken] = useState<string | null>(
    () => localStorage.getItem("court_session_token"),
  );
  const [adminHostId, setAdminHostId] = useState<string | null>(
    () => localStorage.getItem("court_admin_host_id"),
  );
  const [adminHostSessionToken, setAdminHostSessionToken] = useState<string | null>(
    () => localStorage.getItem("court_admin_host_token"),
  );
  const [room, setRoom] = useState<RoomState | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [showFactHistory, setShowFactHistory] = useState(false);
  const [isHostJudge, setIsHostJudge] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const profileBirthDateRef = useRef<HTMLInputElement>(null);
  const lobbyChatScrollRef = useRef<HTMLDivElement>(null);
  const lawyerChatScrollRef = useRef<HTMLDivElement>(null);
  const imageCropDragStateRef = useRef<{
    dragging: boolean;
    pointerId: number;
    startX: number;
    startY: number;
    startOffsetX: number;
    startOffsetY: number;
  } | null>(null);
  const imageCropViewport = useMemo(() => {
    if (imageCropTarget === "avatar") {
      return { width: AVATAR_CROP_VIEW_SIZE, height: AVATAR_CROP_VIEW_SIZE };
    }
    return { width: BANNER_CROP_VIEW_WIDTH, height: BANNER_CROP_VIEW_HEIGHT };
  }, [imageCropTarget]);
  const imageCropBaseScale = useMemo(() => {
    return Math.max(
      imageCropViewport.width / Math.max(1, imageCropNaturalWidth),
      imageCropViewport.height / Math.max(1, imageCropNaturalHeight),
    );
  }, [imageCropNaturalHeight, imageCropNaturalWidth, imageCropViewport.height, imageCropViewport.width]);
  const imageCropDisplayWidth = imageCropNaturalWidth * imageCropBaseScale * imageCropZoom;
  const imageCropDisplayHeight = imageCropNaturalHeight * imageCropBaseScale * imageCropZoom;
  const imageCropMaxOffsetX = Math.max(0, (imageCropDisplayWidth - imageCropViewport.width) / 2);
  const imageCropMaxOffsetY = Math.max(0, (imageCropDisplayHeight - imageCropViewport.height) / 2);
  const joinPasswordDialogOpenRef = useRef(false);
  const influenceViewRef = useRef<
    "main" | "chat" | "notes" | "verdict" | "warnings"
  >("main");
  const myIdRef = useRef<string | null>(null);
  const myProfileRef = useRef<PublicUserProfile | null>(null);
  const influenceAnnouncementTimerRef = useRef<number | null>(null);
  const lastAutoRejoinAttemptAtRef = useRef(0);
  const socket = getSocket();
  const activeRoomCode = room?.code ?? game?.code ?? null;
  const sharedAvatar = avatar;
  const sharedBanner = banner;
  const isAuthenticated = !!authUser && !!authToken;
  const selectedCreateMode = getRoomModeMeta(createRoomMode);
  const reconnectSecondsLeft =
    reconnectExpiresAt !== null
      ? Math.max(0, Math.ceil((reconnectExpiresAt - nowMs) / 1000))
      : 0;

  useEffect(() => {
    if (prevScreenRef.current === screen) return;
    prevScreenRef.current = screen;
    if (screenTransitionTimerRef.current !== null) {
      window.clearTimeout(screenTransitionTimerRef.current);
    }
    setScreenTransitionLoading(true);
    screenTransitionTimerRef.current = window.setTimeout(() => {
      setScreenTransitionLoading(false);
      screenTransitionTimerRef.current = null;
    }, 520);
  }, [screen]);

  useEffect(() => {
    return () => {
      if (screenTransitionTimerRef.current !== null) {
        window.clearTimeout(screenTransitionTimerRef.current);
      }
    };
  }, []);
  const protestCooldownLeft = Math.max(
    0,
    Math.ceil((protestCooldownEndsAt - nowMs) / 1000),
  );
  const silenceCooldownLeft = Math.max(
    0,
    Math.ceil((silenceCooldownEndsAt - nowMs) / 1000),
  );
  const devlogTotalPages = Math.max(
    1,
    Math.ceil(DEVLOG_ENTRIES.length / DEVLOG_PAGE_SIZE),
  );
  const currentDevlogPage = Math.min(devlogPage, devlogTotalPages);
  const visibleDevlogEntries = DEVLOG_ENTRIES.slice(
    (currentDevlogPage - 1) * DEVLOG_PAGE_SIZE,
    currentDevlogPage * DEVLOG_PAGE_SIZE,
  );
  const notesStorageKey =
    game && game.me ? `court_notes_${game.code}_${game.me.id}` : null;

  const clearReconnectWindow = useCallback(() => {
    localStorage.removeItem("court_reconnect_expires_at");
    localStorage.removeItem(RECONNECT_PERSISTENT_STORAGE_KEY);
    setReconnectExpiresAt(null);
    setReconnectPersistent(false);
  }, []);

  const emitRankResultToast = useCallback(
    (
      nextProfile: PublicUserProfile,
      previousRank?: PublicUserProfile["rank"] | null,
    ) => {
      const nextRank = nextProfile.rank;
      if (!nextRank) return;
      const safePreviousRank = previousRank ?? myProfileRef.current?.rank ?? nextRank;
      const rawDelta = nextRank.points - safePreviousRank.points;
      const rankUpBase = nextRank.level > safePreviousRank.level;
      const nextRankKeyBase =
        !rankUpBase && nextRank.nextTitle
          ? getNextRankKey(nextRank.key) ?? nextRank.key
          : nextRank.key;
      let delta = rawDelta;
      let rankUp = rankUpBase;
      let nextRankKeyForDisplay = nextRankKeyBase;
      const fallbackNextRankKey =
        getNextRankKey(nextRank.key) ?? getNextRankKey(safePreviousRank.key);
      const fallbackNextRankTitle = fallbackNextRankKey
        ? getRankTitleByKey(fallbackNextRankKey)
        : nextRank.title;
      const fallbackNextTitle =
        (nextRank.nextTitle && nextRank.nextTitle.trim()) || fallbackNextRankTitle;
      const nextRankTitleForDisplay =
        !rankUp && nextRank.nextTitle
          ? nextRank.nextTitle
          : rankUp
            ? nextRank.title
            : getRankTitleByKey(nextRankKeyForDisplay);
      let resolvedNextTitle =
        !rankUp &&
        nextRankTitleForDisplay.trim().toUpperCase() ===
          (safePreviousRank.title ?? "").trim().toUpperCase()
          ? fallbackNextTitle
          : nextRankTitleForDisplay;
      const prevTarget = Math.max(1, safePreviousRank.progressTarget || 1);
      const nextTarget = Math.max(1, nextRank.progressTarget || 1);
      const fromProgressPercent = Math.min(
        100,
        Math.max(0, (safePreviousRank.progressCurrent / prevTarget) * 100),
      );
      let toProgressPercent = Math.min(
        100,
        Math.max(0, (nextRank.progressCurrent / nextTarget) * 100),
      );
      const latestMatchDidWin = nextProfile.recentMatches?.[0]?.didWin;
      const progressedByBar = Math.max(
        0,
        (nextRank.progressCurrent ?? 0) - (safePreviousRank.progressCurrent ?? 0),
      );
      if (delta <= 0 && progressedByBar > 0) {
        delta = progressedByBar;
      }
      if (delta === 0 && latestMatchDidWin === false) {
        delta = -1;
      }
      if (delta === 0 && latestMatchDidWin === true) {
        delta = 1;
      }
      if (delta <= 0 && rankUp) {
        delta = 1;
      }
      if (
        DEBUG_INSTANT_RANK_UP_ON_MATCH &&
        latestMatchDidWin === true &&
        !rankUp &&
        fallbackNextRankKey
      ) {
        if (delta <= 0) {
          delta = 1;
        }
        rankUp = true;
        nextRankKeyForDisplay = fallbackNextRankKey;
        resolvedNextTitle = getRankTitleByKey(fallbackNextRankKey);
        toProgressPercent = 100;
      }
      const remainingToNext = rankUp
        ? 0
        : nextRank.nextTitle
          ? Math.max(0, (nextRank.nextPoints ?? nextRank.points) - nextRank.points)
          : null;
      const progressVisual = getRankProgressVisual(
        safePreviousRank.key,
        rankUp ? nextRankKeyForDisplay : nextRank.key,
      );
      setRankResultToast({
        fromKey: safePreviousRank.key,
        toKey: nextRankKeyForDisplay,
        fromTitle: safePreviousRank.title,
        toTitle: resolvedNextTitle,
        delta,
        fromPoints: safePreviousRank.points,
        toPoints: nextRank.points,
        fromProgressPercent,
        toProgressPercent,
        remainingToNext,
        progressGradient: progressVisual.gradient,
        progressGlow: progressVisual.glow,
        progressShimmer: progressVisual.shimmer,
        rankUp,
      });
    },
    [],
  );

  const syncRankResultAfterMatch = useCallback(
    (previousRank?: PublicUserProfile["rank"] | null) => {
      if (!authToken) return Promise.resolve();
      return authRequest<{ profile: PublicUserProfile }>("/auth/profile", { token: authToken })
        .then((payload) => {
          setMyProfile(payload.profile);
          emitRankResultToast(payload.profile, previousRank);
          localStorage.removeItem(RANK_TOAST_PENDING_STORAGE_KEY);
        })
        .catch(() => undefined);
    },
    [authToken, emitRankResultToast],
  );

  const startReconnectWindow = useCallback(
    (expiresAt?: number | null, persistent = false) => {
      const fallbackCode = room?.code ?? game?.code ?? localStorage.getItem("court_session");
      const fallbackToken = mySessionToken ?? localStorage.getItem("court_session_token");
      if (!fallbackCode || !fallbackToken) {
        clearReconnectWindow();
        return;
      }

      const safeExpiresAt = persistent
        ? null
        : typeof expiresAt === "number" && Number.isFinite(expiresAt)
          ? expiresAt
          : Date.now() + RECONNECT_GRACE_MS;
      localStorage.setItem("court_session", fallbackCode);
      localStorage.setItem("court_session_token", fallbackToken);
      if (safeExpiresAt !== null) {
        localStorage.setItem("court_reconnect_expires_at", String(safeExpiresAt));
      } else {
        localStorage.removeItem("court_reconnect_expires_at");
      }
      if (persistent) {
        localStorage.setItem(RECONNECT_PERSISTENT_STORAGE_KEY, "1");
      } else {
        localStorage.removeItem(RECONNECT_PERSISTENT_STORAGE_KEY);
      }
      setReconnectExpiresAt(safeExpiresAt);
      setReconnectPersistent(persistent);
      setHasSession(true);
    },
    [clearReconnectWindow, game?.code, mySessionToken, room?.code],
  );

  useEffect(() => {
    if (screen !== "home" || !authToken) return;
    const pending = localStorage.getItem(RANK_TOAST_PENDING_STORAGE_KEY);
    if (!pending) return;
    localStorage.removeItem(RANK_TOAST_PENDING_STORAGE_KEY);
    void syncRankResultAfterMatch(myProfileRef.current?.rank);
  }, [authToken, screen, syncRankResultAfterMatch]);

  const attemptSessionRejoin = useCallback(
    (source: "boot" | "connect" | "manual" = "manual") => {
      const sessionCode = localStorage.getItem("court_session");
      const sessionToken =
        (mySessionToken ?? localStorage.getItem("court_session_token")) || "";
      if (!sessionCode || !sessionToken.trim()) return;

      const now = Date.now();
      const minIntervalMs = source === "connect" ? 1200 : 400;
      if (now - lastAutoRejoinAttemptAtRef.current < minIntervalMs) return;
      lastAutoRejoinAttemptAtRef.current = now;

      setHasSession(true);
      socket.emit("rejoin_room", {
        code: sessionCode,
        sessionToken: sessionToken.trim(),
        avatar: sharedAvatar || undefined,
      });
    },
    [mySessionToken, sharedAvatar, socket],
  );

  useEffect(() => {
    const styleId = "court-auth-autofill-dark";
    if (document.getElementById(styleId)) return;
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      input:-webkit-autofill,
      input:-webkit-autofill:hover,
      input:-webkit-autofill:focus,
      select:-webkit-autofill,
      select:-webkit-autofill:hover,
      select:-webkit-autofill:focus,
      textarea:-webkit-autofill,
      textarea:-webkit-autofill:hover,
      textarea:-webkit-autofill:focus {
        -webkit-text-fill-color: rgb(244 244 245) !important;
        -webkit-box-shadow: 0 0 0px 1000px rgb(24 24 27) inset !important;
        box-shadow: 0 0 0px 1000px rgb(24 24 27) inset !important;
        background-color: rgb(24 24 27) !important;
        caret-color: rgb(244 244 245) !important;
        transition: background-color 9999s ease-in-out 0s;
      }
      ::-webkit-scrollbar-button {
        display: none !important;
        width: 0 !important;
        height: 0 !important;
      }
    `;
    document.head.appendChild(style);
  }, []);

  const renderPublicProfileDialog = () => {
    const genderLabel =
      viewPlayerProfile?.gender === "male"
        ? "Мужской"
        : viewPlayerProfile?.gender === "female"
          ? "Женский"
          : viewPlayerProfile?.gender === "other"
            ? "Другой"
            : "Не указан";
    const ageLabel = viewPlayerProfile?.hideAge
      ? "Скрыт"
      : typeof viewPlayerProfile?.age === "number"
        ? `${viewPlayerProfile.age} лет`
        : "Не указан";
    const createdAtLabel =
      typeof viewPlayerProfile?.createdAt === "number"
        ? new Date(viewPlayerProfile.createdAt).toLocaleDateString("ru-RU")
        : "";

    return (
      <Dialog
        open={viewPlayerProfileOpen}
        onOpenChange={(open) => {
          setViewPlayerProfileOpen(open);
          if (!open) setViewProfileBadgeHintOpen(false);
        }}
      >
        <DialogContent className="max-w-[520px] overflow-visible border-zinc-800 bg-zinc-950 text-zinc-100">
          <DialogHeader>
            <DialogTitle>Профиль игрока</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Публичная информация.
            </DialogDescription>
          </DialogHeader>
          {viewPlayerProfileLoading ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 text-sm text-zinc-400">
              Загрузка профиля...
            </div>
          ) : viewPlayerProfileError ? (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
              {viewPlayerProfileError}
            </div>
          ) : viewPlayerProfile ? (
            <div className="space-y-4">
              <div className="rounded-3xl border border-zinc-800 bg-zinc-950/70">
                <div
                  className="relative min-h-[122px] rounded-3xl p-4 flex items-end overflow-visible"
                  style={getBannerStyle(
                    viewPlayerProfile.banner,
                    viewPlayerProfile.avatar,
                    viewPlayerProfile.nickname,
                  )}
                >
                  <div className="absolute inset-0 rounded-3xl bg-gradient-to-t from-black/75 via-black/35 to-black/10" />
                  <div className="relative z-10 flex items-end gap-3">
                    <Avatar src={viewPlayerProfile.avatar ?? null} name={viewPlayerProfile.nickname} size={82} />
                    <div>
                      <div className="text-xl font-bold leading-none truncate max-w-[240px] sm:max-w-[320px]">
                        {viewPlayerProfile.nickname}
                      </div>
                      {viewPlayerProfile.selectedBadgeKey ? (
                        <div className="mt-2 relative inline-flex">
                          <button
                            type="button"
                            onClick={() =>
                              setViewProfileBadgeHintOpen((prev) => !prev)
                            }
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                              getBadgeTheme(viewPlayerProfile.selectedBadgeKey).chip
                            }`}
                          >
                            <BadgeGlyph
                              badgeKey={viewPlayerProfile.selectedBadgeKey}
                              className={`h-3.5 w-3.5 ${getBadgeTheme(viewPlayerProfile.selectedBadgeKey).iconOnly ?? "text-zinc-300"}`}
                            />
                            <span>
                              {getBadgeTitleByKey(
                                viewPlayerProfile.selectedBadgeKey,
                                viewPlayerProfile.badges,
                              )}
                            </span>
                          </button>
                          {viewProfileBadgeHintOpen ? (
                            <div className="absolute left-0 top-full z-30 mt-2 w-[min(84vw,320px)] rounded-xl border border-zinc-700 bg-zinc-900/95 px-3 py-2 text-sm leading-relaxed text-zinc-200 shadow-[0_10px_24px_rgba(0,0,0,0.45)] whitespace-pre-wrap break-words">
                              {viewPlayerProfile.badges?.find(
                                (badge) => badge.key === viewPlayerProfile.selectedBadgeKey,
                              )?.description ?? "Информация о бейдже отсутствует."}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                      <div className="mt-2 text-xs text-zinc-300">
                        Профиль с {createdAtLabel || "неизвестной даты"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {(viewPlayerProfile.gender || typeof viewPlayerProfile.age === "number") && (
                <div className="grid grid-cols-1 gap-3 text-sm">
                  {viewPlayerProfile.gender && (
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2">
                      <div className="text-zinc-500 text-xs">Пол</div>
                      <div className="text-zinc-100 mt-1">{genderLabel}</div>
                    </div>
                  )}
                  {typeof viewPlayerProfile.age === "number" && (
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2">
                      <div className="text-zinc-500 text-xs">Возраст</div>
                      <div className="text-zinc-100 mt-1">{ageLabel}</div>
                    </div>
                  )}
                </div>
              )}
              {viewPlayerProfile.bio?.trim() && (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2">
                  <div className="text-zinc-500 text-xs">О себе</div>
                  <div className="text-zinc-100 mt-1 whitespace-pre-wrap break-words overflow-hidden">
                    {viewPlayerProfile.bio}
                  </div>
                </div>
              )}
              {viewPlayerProfile.rank ? (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-zinc-100">
                      Ранг: {viewPlayerProfile.rank.title}
                    </div>
                    <div className="text-xs text-zinc-400">
                      {viewPlayerProfile.rank.points} очк.
                    </div>
                  </div>
                </div>
              ) : null}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-2 py-2">
                  <div className="text-[11px] text-zinc-500">Матчей</div>
                  <div className="text-sm font-semibold mt-1">{viewPlayerProfile.stats?.totalMatches ?? 0}</div>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-2 py-2">
                  <div className="text-[11px] text-zinc-500">Побед</div>
                  <div className="text-sm font-semibold mt-1">{viewPlayerProfile.stats?.totalWins ?? 0}</div>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-2 py-2">
                  <div className="text-[11px] text-zinc-500">Winrate</div>
                  <div className="text-sm font-semibold mt-1">
                    {Math.round(viewPlayerProfile.stats?.totalWinRate ?? 0)}%
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 text-sm text-zinc-400">
              Профиль не загружен.
            </div>
          )}
        </DialogContent>
      </Dialog>
    );
  };

  useEffect(() => {
    const savedName = localStorage.getItem("court_nickname");
    const savedAvatar = localStorage.getItem("court_avatar");
    const savedBanner = localStorage.getItem(BANNER_STORAGE_KEY);
    if (savedAvatar) setAvatar(savedAvatar);
    if (savedBanner) setBanner(savedBanner);

    if (savedName) {
      setPlayerName(savedName);
      setProfileNicknameDraft(savedName);
    } else if (authUser?.nickname) {
      setPlayerName(authUser.nickname);
      setProfileNicknameDraft(authUser.nickname);
      localStorage.setItem("court_nickname", authUser.nickname);
    } else {
      const guestName = getOrCreateGuestName();
      setPlayerName(guestName);
      setProfileNicknameDraft(guestName);
      localStorage.setItem("court_nickname", guestName);
    }

    const sessionCode = localStorage.getItem("court_session");
    const sessionToken = localStorage.getItem("court_session_token");
    if (sessionCode && sessionToken) {
      setHasSession(true);
      attemptSessionRejoin("boot");
    } else if (sessionCode && !sessionToken) {
      localStorage.removeItem("court_session");
      setHasSession(false);
    }
  }, [attemptSessionRejoin, authUser?.nickname]);

  useEffect(() => {
    if (!authToken) return;
    let cancelled = false;
    authRequest<{ user: AuthUser }>("/auth/me", { token: authToken })
      .then(({ user }) => {
        if (cancelled) return;
        setAuthUser(user);
        localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
        setPlayerName(user.nickname);
        setProfileNicknameDraft(user.nickname);
        localStorage.setItem("court_nickname", user.nickname);
        if (user.avatar) {
          setAvatar(user.avatar);
          localStorage.setItem("court_avatar", user.avatar);
        }
        if (user.banner) {
          setBanner(user.banner);
          localStorage.setItem(BANNER_STORAGE_KEY, user.banner);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setAuthToken(null);
        setAuthUser(null);
        localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
        localStorage.removeItem(AUTH_USER_STORAGE_KEY);
      });
    return () => {
      cancelled = true;
    };
  }, [authToken]);

  useEffect(() => {
    if (!authUser) return;
    setProfileNicknameDraft(authUser.nickname);
    setProfileBio(authUser.bio ?? "");
    setProfileGender(
      authUser.gender === "male" || authUser.gender === "female" || authUser.gender === "other"
        ? authUser.gender
        : "",
    );
    setProfileBirthDate(formatIsoDateToRu(authUser.birthDate));
    setProfileHideAge(!!authUser.hideAge);
  }, [authUser]);

  useEffect(() => {
    if (screen !== "profile") return;
    setProfileAvatarDraft(avatar);
    setProfileBannerDraft(banner);
  }, [screen, avatar, banner]);

  useEffect(() => {
    if (!authToken || !isAuthenticated) {
      setMyProfile(null);
      setMyProfileLoading(false);
      return;
    }
    if (screen !== "profile") return;
    let cancelled = false;
    setMyProfileLoading(true);
    authRequest<{ profile: PublicUserProfile }>("/auth/profile", { token: authToken })
      .then((payload) => {
        if (cancelled) return;
        setMyProfile(payload.profile);
      })
      .catch(() => {
        if (cancelled) return;
        setMyProfile(null);
      })
      .finally(() => {
        if (cancelled) return;
        setMyProfileLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authToken, isAuthenticated, screen]);

  useEffect(() => {
    if (myProfile?.selectedBadgeKey) {
      setSelectedBadgeKey(myProfile.selectedBadgeKey);
      return;
    }
    const firstActive = myProfile?.badges?.find((badge) => badge.active)?.key;
    if (firstActive) setSelectedBadgeKey(firstActive);
  }, [myProfile]);

  useEffect(() => {
    if (screen !== "home") return;
    socket.emit("list_public_matches");
  }, [socket, screen]);

  useEffect(() => {
    const onConnect = () => {
      attemptSessionRejoin("connect");
    };
    socket.on("connect", onConnect);
    return () => {
      socket.off("connect", onConnect);
    };
  }, [attemptSessionRejoin, socket]);

  useEffect(() => {
    if (screen !== "home" || homeTab !== "play" || playView !== "matches") return;
    socket.emit("list_public_matches");
  }, [socket, screen, homeTab, playView]);

  useEffect(() => {
    if (screen !== "home") {
      setProfileMenuOpen(false);
    }
  }, [screen]);

  useEffect(() => {
    joinPasswordDialogOpenRef.current = joinPasswordDialogOpen;
  }, [joinPasswordDialogOpen]);

  useEffect(() => {
    influenceViewRef.current = influenceView;
    if (influenceView === "chat") {
      setLawyerChatUnreadCount(0);
    }
  }, [influenceView]);

  useEffect(() => {
    myIdRef.current = myId;
  }, [myId]);

  useEffect(() => {
    myProfileRef.current = myProfile;
  }, [myProfile]);

  useEffect(() => {
    if (screen !== "game") {
      setInfluenceView("main");
      setLawyerChatUnreadCount(0);
      setLawyerChatMessages([]);
      setLawyerChatInput("");
      setLawyerChatPartner(null);
      setInfluenceNotes("");
      setProtestCooldownEndsAt(0);
      setSilenceCooldownEndsAt(0);
      setInfluenceAnnouncement(null);
      return;
    }
    setInfluenceView("main");
    setLawyerChatUnreadCount(0);
  }, [screen, game?.code]);

  useEffect(() => {
    if (!notesStorageKey) {
      setInfluenceNotes("");
      return;
    }
    setInfluenceNotes(localStorage.getItem(notesStorageKey) ?? "");
  }, [notesStorageKey]);

  useEffect(() => {
    if (!notesStorageKey) return;
    localStorage.setItem(notesStorageKey, influenceNotes.slice(0, 5000));
  }, [influenceNotes, notesStorageKey]);

  useEffect(() => {
    if (screen !== "room") return;
    const container = lobbyChatScrollRef.current;
    if (!container) return;
    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
  }, [lobbyChatMessages, screen, room?.code]);

  useEffect(() => {
    if (screen !== "game" || influenceView !== "chat") return;
    const container = lawyerChatScrollRef.current;
    if (!container) return;
    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
  }, [influenceView, lawyerChatMessages, screen, game?.code]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 250);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (reconnectPersistent) return;
    if (reconnectExpiresAt === null) return;
    if (reconnectExpiresAt > nowMs) return;
    if (room || game) return;

    clearReconnectWindow();
    localStorage.removeItem("court_session");
    localStorage.removeItem("court_session_token");
    setHasSession(false);
    setMySessionToken(null);
  }, [clearReconnectWindow, game, nowMs, reconnectExpiresAt, reconnectPersistent, room]);

  useEffect(() => {
    if (screen !== "game" || !game || !mySessionToken) return;
    socket.emit("get_lawyer_chat_state", {
      code: game.code,
      sessionToken: mySessionToken,
    });
  }, [screen, game?.code, game?.me?.id, mySessionToken, socket]);

  useEffect(() => {
    socket.on(
      "room_joined",
      ({
        playerId,
        sessionToken,
        state,
      }: {
        playerId: string;
        sessionToken?: string;
        state: any;
      }) => {
        setMyId(playerId);
        if (sessionToken) {
          setMySessionToken(sessionToken);
          localStorage.setItem("court_session_token", sessionToken);
        }
        localStorage.setItem("court_session", state.code);
        clearReconnectWindow();
        setHasSession(true);
        setStartGameLoading(false);
        setCreateMatchDialogOpen(false);
        setProfileMenuOpen(false);
        setJoinPasswordDialogOpen(false);
        setJoinPasswordDialogMatch(null);
        setJoinPasswordInput("");
        setJoinPasswordDialogError("");
        setJoinPasswordVisible(false);
        if (state.hostId === playerId && sessionToken) {
          setAdminHostId(playerId);
          localStorage.setItem("court_admin_host_id", playerId);
          setAdminHostSessionToken(sessionToken);
          localStorage.setItem("court_admin_host_token", sessionToken);
        }
        if (sharedAvatar) {
          socket.emit("update_avatar", {
            code: state.code,
            sessionToken,
            avatar: sharedAvatar,
          });
        }
        if (state.type === "room") {
          const roomState = state as RoomState;
          if (!roomState || !Array.isArray(roomState.players)) {
            clearReconnectWindow();
            localStorage.removeItem("court_session");
            localStorage.removeItem("court_session_token");
            setHasSession(false);
            setError("Комната недоступна или уже закрыта.");
            setRoom(null);
            setGame(null);
            setLobbyChatMessages([]);
            setScreen("home");
            return;
          }
          setRoom({
            ...roomState,
            players: roomState.players.map((p) =>
              p.id === playerId && avatar ? { ...p, avatar } : p,
            ),
          });
          setLobbyChatMessages(roomState.lobbyChat ?? []);
          setIsHostJudge(state.isHostJudge ?? false);
          setGame(null);
          setScreen("room");
        } else {
          const gameState = state as GameState;
          if (
            !gameState ||
            !Array.isArray(gameState.players) ||
            !gameState.me ||
            !Array.isArray(gameState.stages) ||
            gameState.stages.length === 0 ||
            !gameState.caseData
          ) {
            clearReconnectWindow();
            localStorage.removeItem("court_session");
            localStorage.removeItem("court_session_token");
            setHasSession(false);
            setError("Матч недоступен или уже завершен.");
            setRoom(null);
            setGame(null);
            setLobbyChatMessages([]);
            setScreen("home");
            return;
          }
          setGame({
            ...gameState,
            players: gameState.players.map((p) =>
              p.id === playerId && avatar ? { ...p, avatar } : p,
            ),
            me:
              gameState.me && avatar
                ? { ...gameState.me, avatar }
                : gameState.me,
          });
          setRoom(null);
          setLobbyChatMessages([]);
          setScreen("game");
        }
      },
    );

    socket.on(
      "room_updated",
      ({
        players,
        hostId,
        isHostJudge: hj,
        roomName,
        modeKey,
        maxPlayers,
        visibility,
        venueLabel,
        venueUrl,
        requiresPassword,
        lobbyChat,
      }: {
        players: PlayerInfo[];
        hostId: string;
        isHostJudge?: boolean;
        roomName?: string;
        modeKey?: RoomModeKey;
        maxPlayers?: number;
        visibility?: "public" | "private";
        venueLabel?: string;
        venueUrl?: string;
        requiresPassword?: boolean;
        lobbyChat?: LobbyChatMessage[];
      }) => {
        setRoom((prev) => {
          if (!prev) return prev;
          const mergedPlayers = players.map((nextPlayer) => {
            const prevPlayer = prev.players.find((p) => p.id === nextPlayer.id);
            return {
              ...nextPlayer,
              avatar: nextPlayer.avatar ?? prevPlayer?.avatar,
            };
          });
          return {
            ...prev,
            players: mergedPlayers,
            hostId,
            roomName: roomName ?? prev.roomName,
            modeKey: modeKey ?? prev.modeKey,
            maxPlayers: maxPlayers ?? prev.maxPlayers,
            visibility: visibility ?? prev.visibility,
            venueLabel: venueLabel ?? prev.venueLabel,
            venueUrl: venueUrl ?? prev.venueUrl,
            requiresPassword: requiresPassword ?? prev.requiresPassword,
            lobbyChat: lobbyChat ?? prev.lobbyChat,
          };
        });
        if (lobbyChat) {
          setLobbyChatMessages(lobbyChat);
        }
        if (hj !== undefined) setIsHostJudge(hj);
      },
    );

    socket.on("game_players_updated", ({ players }: { players: PlayerInfo[] }) => {
      setGame((prev) => {
        if (!prev) return prev;
        const mergedPlayers = players.map((nextPlayer) => {
          const prevPlayer = prev.players.find((p) => p.id === nextPlayer.id);
          return {
            ...nextPlayer,
            avatar: nextPlayer.avatar ?? prevPlayer?.avatar,
          };
        });

        if (!prev.me) {
          return { ...prev, players: mergedPlayers };
        }

        const updatedSelf = mergedPlayers.find((p) => p.id === prev.me!.id);
        return {
          ...prev,
          players: mergedPlayers,
          me: updatedSelf
            ? {
                ...prev.me,
                avatar: updatedSelf.avatar ?? prev.me.avatar,
                roleKey: updatedSelf.roleKey ?? prev.me.roleKey,
                roleTitle: updatedSelf.roleTitle ?? prev.me.roleTitle,
              }
            : prev.me,
        };
      });
    });

    socket.on(
      "game_profile_updated",
      ({
        players,
        revealedFacts,
        usedCards,
      }: {
        players: PlayerInfo[];
        revealedFacts: RevealedFact[];
        usedCards: UsedCard[];
      }) => {
        setGame((prev) => {
          if (!prev) return prev;
          const updatedMe =
            prev.me ? players.find((player) => player.id === prev.me!.id) : null;
          return {
            ...prev,
            players,
            revealedFacts,
            usedCards,
            me:
              prev.me && updatedMe
                ? {
                    ...prev.me,
                    name: updatedMe.name,
                    avatar: updatedMe.avatar,
                    roleKey: updatedMe.roleKey ?? prev.me.roleKey,
                    roleTitle: updatedMe.roleTitle ?? prev.me.roleTitle,
                  }
                : prev.me,
          };
        });
      },
    );

    socket.on("public_matches_updated", ({ matches }: { matches: PublicMatchInfo[] }) => {
      setPublicMatches(matches);
    });

    socket.on(
      "lobby_chat_updated",
      ({ messages }: { messages: LobbyChatMessage[] }) => {
        setLobbyChatMessages(messages);
        setRoom((prev) => (prev ? { ...prev, lobbyChat: messages } : prev));
      },
    );

    socket.on(
      "lawyer_chat_state",
      ({
        enabled,
        partner,
        messages,
      }: {
        enabled: boolean;
        partner: LawyerChatPartner | null;
        messages: LawyerChatMessage[];
      }) => {
        if (!enabled) {
          setLawyerChatPartner(null);
          setLawyerChatMessages([]);
          setLawyerChatUnreadCount(0);
          setInfluenceView((prev) => (prev === "chat" ? "main" : prev));
          return;
        }

        setLawyerChatPartner(partner);
        setLawyerChatMessages(messages ?? []);
        if (influenceViewRef.current === "chat") {
          setLawyerChatUnreadCount(0);
        }
      },
    );

    socket.on(
      "lawyer_chat_updated",
      ({
        partner,
        messages,
      }: {
        partner: LawyerChatPartner | null;
        messages: LawyerChatMessage[];
      }) => {
        if (partner) {
          setLawyerChatPartner(partner);
        }
        setLawyerChatMessages((prev) => {
          const nextMessages = messages ?? [];
          if (influenceViewRef.current !== "chat") {
            const prevIds = new Set(prev.map((item) => item.id));
            const me = myIdRef.current;
            const unreadAdded = nextMessages.filter(
              (item) => !prevIds.has(item.id) && item.senderId !== me,
            ).length;
            if (unreadAdded > 0) {
              setLawyerChatUnreadCount((value) => value + unreadAdded);
            }
          } else {
            setLawyerChatUnreadCount(0);
          }
          return nextMessages;
        });
      },
    );

    socket.on(
      "influence_cooldown",
      ({
        action,
        cooldownEndsAt,
      }: {
        action: "protest" | "silence" | "warning";
        cooldownEndsAt: number;
      }) => {
        if (action === "protest") {
          setProtestCooldownEndsAt(cooldownEndsAt || 0);
          return;
        }
        if (action === "silence") {
          setSilenceCooldownEndsAt(cooldownEndsAt || 0);
          return;
        }
      },
    );

    socket.on("influence_announcement", (announcement: InfluenceAnnouncement) => {
      setInfluenceAnnouncement(announcement);
      if (influenceAnnouncementTimerRef.current) {
        window.clearTimeout(influenceAnnouncementTimerRef.current);
      }
      const duration = announcement?.durationMs ?? 3000;
      influenceAnnouncementTimerRef.current = window.setTimeout(() => {
        setInfluenceAnnouncement(null);
      }, duration);
    });

    socket.on(
      "protest_state_updated",
      ({ activeProtest }: { activeProtest: ActiveProtest | null }) => {
        setGame((prev) =>
          prev ? { ...prev, activeProtest: activeProtest ?? null } : prev,
        );
      },
    );

    socket.on(
      "reconnect_available",
      ({
        code,
        sessionToken,
        expiresAt,
        persistent,
      }: {
        code?: string;
        sessionToken?: string;
        expiresAt?: number;
        persistent?: boolean;
      }) => {
        if (code) {
          localStorage.setItem("court_session", code);
        }
        if (sessionToken) {
          localStorage.setItem("court_session_token", sessionToken);
          setMySessionToken(sessionToken);
        }
        startReconnectWindow(expiresAt ?? null, !!persistent);
      },
    );

    socket.on("rejoin_failed", () => {
      clearReconnectWindow();
      localStorage.removeItem("court_session");
      localStorage.removeItem("court_session_token");
      localStorage.removeItem("court_admin_host_id");
      localStorage.removeItem("court_admin_host_token");
      setMySessionToken(null);
      setAdminHostId(null);
      setAdminHostSessionToken(null);
      setHasSession(false);
      setLobbyChatMessages([]);
      setScreen("home");
    });

    socket.on("kicked", () => {
      clearReconnectWindow();
      localStorage.removeItem("court_session");
      localStorage.removeItem("court_session_token");
      setHasSession(false);
      setRoom(null);
      setGame(null);
      setMyId(null);
      setMySessionToken(null);
      setAdminHostId(null);
      localStorage.removeItem("court_admin_host_id");
      setAdminHostSessionToken(null);
      localStorage.removeItem("court_admin_host_token");
      setJoinCode("");
      setCopiedRoomCode(false);
      setIsHostJudge(false);
      setStartGameLoading(false);
      setContextHelpOpen(false);
      setLobbyChatMessages([]);
      setJoinPasswordDialogOpen(false);
      setJoinPasswordDialogMatch(null);
      setJoinPasswordInput("");
      setJoinPasswordDialogError("");
      setJoinPasswordVisible(false);
      setProfileMenuOpen(false);
      setScreen("home");
      setKickedAlert(
        "Вы были кикнуты из комнаты.",
      );
      setTimeout(() => setKickedAlert(""), 5000);
    });

    socket.on("room_closed", () => {
      const previousRank = myProfileRef.current?.rank;
      if (authToken) {
        localStorage.setItem(RANK_TOAST_PENDING_STORAGE_KEY, "1");
      }
      clearReconnectWindow();
      localStorage.removeItem("court_session");
      localStorage.removeItem("court_session_token");
      localStorage.removeItem("court_admin_host_id");
      localStorage.removeItem("court_admin_host_token");
      setHasSession(false);
      setRoom(null);
      setGame(null);
      setMyId(null);
      setMySessionToken(null);
      setAdminHostId(null);
      setAdminHostSessionToken(null);
      setJoinCode("");
      setCopiedRoomCode(false);
      setIsHostJudge(false);
      setStartGameLoading(false);
      setContextHelpOpen(false);
      setLobbyChatInput("");
      setLobbyChatMessages([]);
      setProfileMenuOpen(false);
      setCreateMatchDialogOpen(false);
      setScreen("home");
      void syncRankResultAfterMatch(previousRank);
    });

    socket.on("game_started", ({ state }: { state: any }) => {
      setStartGameLoading(false);
      setGame(state as GameState);
      setRoom(null);
      setLobbyChatMessages([]);
      setScreen("game");
    });

    socket.on(
      "facts_updated",
      ({ revealedFacts }: { revealedFacts: RevealedFact[] }) => {
        setGame((prev) => (prev ? { ...prev, revealedFacts } : prev));
      },
    );

    socket.on("my_facts_updated", ({ facts }: { facts: Fact[] }) => {
      setGame((prev) =>
        prev && prev.me ? { ...prev, me: { ...prev.me, facts } } : prev,
      );
    });

    socket.on(
      "fact_reveal_permission",
      ({ canRevealFactsNow }: { canRevealFactsNow: boolean }) => {
        setGame((prev) =>
          prev && prev.me
            ? {
                ...prev,
                me: {
                  ...prev.me,
                  canRevealFactsNow,
                },
              }
            : prev,
        );
      },
    );

    socket.on("cards_updated", ({ usedCards }: { usedCards: UsedCard[] }) => {
      setGame((prev) => (prev ? { ...prev, usedCards } : prev));
    });

    socket.on("my_cards_updated", ({ cards }: { cards: Card_[] }) => {
      setGame((prev) =>
        prev && prev.me ? { ...prev, me: { ...prev.me, cards } } : prev,
      );
    });

    socket.on("stage_updated", ({ stageIndex }: { stageIndex: number }) => {
      setGame((prev) => (prev ? { ...prev, stageIndex } : prev));
    });

    socket.on(
      "verdict_set",
      ({ verdict, verdictEvaluation, finished, closeAt }: any) => {
        const resolvedCloseAt =
          Number.isFinite(closeAt) && closeAt > 0
            ? closeAt
            : Date.now() + VERDICT_CLOSE_COUNTDOWN_MS;
        setGame((prev) =>
          prev
            ? {
                ...prev,
                verdict,
                verdictEvaluation,
                finished,
                verdictCloseAt: resolvedCloseAt,
              }
            : prev,
        );
        if (authToken) {
          authRequest<{ profile: PublicUserProfile }>("/auth/profile", { token: authToken })
            .then((payload) => setMyProfile(payload.profile))
            .catch(() => undefined);
        }
      },
    );

    socket.on("error", ({ message }: { message: string }) => {
      setStartGameLoading(false);
      if (message.toLowerCase().includes("парол")) {
        setJoinPasswordDialogError(message);
        if (joinPasswordDialogOpenRef.current) {
          return;
        }
      }
      setError(message);
      setTimeout(() => setError(""), 4000);
    });

    return () => {
      if (influenceAnnouncementTimerRef.current) {
        window.clearTimeout(influenceAnnouncementTimerRef.current);
        influenceAnnouncementTimerRef.current = null;
      }
      socket.off("room_joined");
      socket.off("room_updated");
      socket.off("game_players_updated");
      socket.off("game_profile_updated");
      socket.off("public_matches_updated");
      socket.off("lobby_chat_updated");
      socket.off("player_left");
      socket.off("player_rejoined");
      socket.off("lawyer_chat_state");
      socket.off("lawyer_chat_updated");
      socket.off("influence_cooldown");
      socket.off("influence_announcement");
      socket.off("protest_state_updated");
      socket.off("reconnect_available");
      socket.off("rejoin_failed");
      socket.off("kicked");
      socket.off("room_closed");
      socket.off("game_started");
      socket.off("facts_updated");
      socket.off("my_facts_updated");
      socket.off("fact_reveal_permission");
      socket.off("cards_updated");
      socket.off("my_cards_updated");
      socket.off("stage_updated");
      socket.off("verdict_set");
      socket.off("error");
    };
  }, [socket, avatar, authToken, clearReconnectWindow, sharedAvatar, startReconnectWindow, syncRankResultAfterMatch]);

  const createQuickRoom = useCallback(() => {
    const name = playerName.trim() || getOrCreateGuestName();
    localStorage.setItem("court_nickname", name);
    socket.emit("create_room", {
      playerName: name,
      avatar: sharedAvatar || undefined,
      banner: sharedBanner || undefined,
      authToken: authToken || undefined,
      options: {
        visibility: "public",
        modeKey: "quick_flex",
      },
    });
  }, [socket, playerName, sharedAvatar, sharedBanner, authToken]);

  const createRoomFromPanel = useCallback(() => {
    const name = playerName.trim() || getOrCreateGuestName();
    if (createRoomPrivate && !createRoomPassword.trim()) {
      setError("Для приватной комнаты задайте пароль.");
      setTimeout(() => setError(""), 3000);
      return false;
    }
    localStorage.setItem("court_nickname", name);
    socket.emit("create_room", {
      playerName: name,
      avatar: sharedAvatar || undefined,
      banner: sharedBanner || undefined,
      authToken: authToken || undefined,
      options: {
        modeKey: createRoomMode,
        visibility: createRoomPrivate ? "private" : "public",
        roomName: createRoomName.trim() || undefined,
        venueUrl: createVoiceUrl.trim() || undefined,
        password:
          createRoomPrivate && createRoomPassword.trim()
            ? createRoomPassword.trim()
            : undefined,
      },
    });
    return true;
  }, [
    socket,
    playerName,
    sharedAvatar,
    authToken,
    sharedBanner,
    createRoomMode,
    createRoomPrivate,
    createRoomName,
    createVoiceUrl,
    createRoomPassword,
  ]);

  const joinRoom = useCallback((options?: { code?: string; password?: string }) => {
    const targetCode = (options?.code ?? joinCode).trim().toUpperCase();
    if (!targetCode) return;
    const password = (options?.password ?? "").trim();
    const name = playerName.trim() || getOrCreateGuestName();
    localStorage.setItem("court_nickname", name);
    socket.emit("join_room", {
      code: targetCode,
      playerName: name,
      avatar: sharedAvatar || undefined,
      banner: sharedBanner || undefined,
      authToken: authToken || undefined,
      password: password || undefined,
    });
  }, [socket, joinCode, playerName, sharedAvatar, sharedBanner, authToken]);

  const reloadMyProfile = useCallback(async () => {
    if (!authToken) return;
    try {
      const payload = await authRequest<{ profile: PublicUserProfile }>("/auth/profile", {
        token: authToken,
      });
      setMyProfile(payload.profile);
    } catch {
      // ignore
    }
  }, [authToken]);

  const resetProfileMedia = useCallback(() => {
    setProfileAvatarDraft(null);
    setProfileBannerDraft(null);
  }, []);

  const saveExtendedProfile = useCallback(async (): Promise<boolean> => {
    if (!authToken) return false;
    setProfileNicknameError("");
    setProfileBirthDateError("");
    const normalizedName = profileNicknameDraft.trim();
    if (!normalizedName) {
      setProfileNicknameError("Введите никнейм.");
      return false;
    }
    const normalizedBirthDateRaw = profileBirthDate.trim();
    const normalizedBirthDate = normalizedBirthDateRaw
      ? parseRuDateToIso(normalizedBirthDateRaw)
      : null;
    if (normalizedBirthDateRaw && !normalizedBirthDate) {
      setProfileBirthDateError("Укажите верную дату рождения.");
      return false;
    }
    const age = computeAgeFromIsoDate(normalizedBirthDate || undefined);
    if (normalizedBirthDateRaw && typeof age !== "number") {
      setProfileBirthDateError("Вам должно быть не меньше 13 лет.");
      return false;
    }
    setProfileActionLoading(true);
    try {
      const payload = await authRequest<{ user: AuthUser }>("/auth/profile", {
        method: "PATCH",
        token: authToken,
        body: {
          nickname: normalizedName,
          avatar: profileAvatarDraft,
          banner: profileBannerDraft,
          bio: profileBio.trim() || null,
          gender: profileGender || null,
          birthDate: normalizedBirthDate || null,
          hideAge: profileHideAge,
          selectedBadgeKey: selectedBadgeKey || null,
        },
      });
      setAuthUser(payload.user);
      localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(payload.user));
      setPlayerName(normalizedName);
      setProfileNicknameDraft(normalizedName);
      setAvatar(profileAvatarDraft);
      setBanner(profileBannerDraft);
      localStorage.setItem("court_nickname", normalizedName);
      if (profileAvatarDraft) {
        localStorage.setItem("court_avatar", profileAvatarDraft);
      } else {
        localStorage.removeItem("court_avatar");
      }
      if (profileBannerDraft) {
        localStorage.setItem(BANNER_STORAGE_KEY, profileBannerDraft);
      } else {
        localStorage.removeItem(BANNER_STORAGE_KEY);
      }
      if (activeRoomCode && mySessionToken) {
        socket.emit("update_profile", {
          code: activeRoomCode,
          sessionToken: mySessionToken,
          name: normalizedName,
          avatar: profileAvatarDraft,
          banner: profileBannerDraft,
          selectedBadgeKey: selectedBadgeKey || null,
        });
      }
      await reloadMyProfile();
      return true;
    } catch (err) {
      const message = err instanceof Error ? localizeAuthError(err.message) : "Ошибка обновления профиля.";
      if (isNicknameTakenError(message)) {
        setProfileNicknameError("Этот ник уже занят.");
      } else if (isEmailTakenError(message)) {
        setError("Эта почта уже занята.");
        setTimeout(() => setError(""), 3500);
      } else {
        setError(message);
        setTimeout(() => setError(""), 3500);
      }
      return false;
    } finally {
      setProfileActionLoading(false);
    }
  }, [
    authToken,
    profileNicknameDraft,
    profileBirthDate,
    profileBio,
    profileGender,
    profileHideAge,
    reloadMyProfile,
    selectedBadgeKey,
    profileAvatarDraft,
    profileBannerDraft,
    activeRoomCode,
    mySessionToken,
    socket,
  ]);

  const changePassword = useCallback(async (): Promise<boolean> => {
    if (!authToken) return false;
    if (!passwordChangeCurrent || !passwordChangeNext) return false;
    setProfileActionLoading(true);
    try {
      await authRequest<{ ok: boolean }>("/auth/password", {
        method: "PATCH",
        token: authToken,
        body: {
          currentPassword: passwordChangeCurrent,
          nextPassword: passwordChangeNext,
        },
      });
      setPasswordChangeCurrent("");
      setPasswordChangeNext("");
      await reloadMyProfile();
      setError("Пароль обновлен.");
      setTimeout(() => setError(""), 2500);
      return true;
    } catch (err) {
      const message = err instanceof Error ? localizeAuthError(err.message) : "Не удалось сменить пароль.";
      setError(message);
      setTimeout(() => setError(""), 3500);
      return false;
    } finally {
      setProfileActionLoading(false);
    }
  }, [authToken, passwordChangeCurrent, passwordChangeNext, reloadMyProfile]);

  const changeEmail = useCallback(async (): Promise<boolean> => {
    if (!authToken) return false;
    if (!emailChangeCurrentPassword || !emailChangeNext.trim()) return false;
    setProfileActionLoading(true);
    try {
      const payload = await authRequest<{ user: AuthUser }>("/auth/email", {
        method: "PATCH",
        token: authToken,
        body: {
          currentPassword: emailChangeCurrentPassword,
          nextEmail: emailChangeNext.trim(),
        },
      });
      setAuthUser(payload.user);
      localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(payload.user));
      setEmailChangeCurrentPassword("");
      setEmailChangeNext("");
      await reloadMyProfile();
      setError("Почта обновлена.");
      setTimeout(() => setError(""), 2500);
      return true;
    } catch (err) {
      const message = err instanceof Error ? localizeAuthError(err.message) : "Не удалось сменить почту.";
      setError(message);
      setTimeout(() => setError(""), 3500);
      return false;
    } finally {
      setProfileActionLoading(false);
    }
  }, [authToken, emailChangeCurrentPassword, emailChangeNext, reloadMyProfile]);

  const openUserProfile = useCallback(
    async (userId?: string) => {
      if (!userId) return;
      setViewPlayerProfileOpen(true);
      setViewPlayerProfileLoading(true);
      setViewPlayerProfileError("");
      setViewPlayerProfile(null);
      try {
        const payload = await authRequest<{ profile: PublicUserProfile }>(`/auth/public/${userId}`);
        setViewPlayerProfile(payload.profile);
      } catch (err) {
        const message = err instanceof Error ? localizeAuthError(err.message) : "Не удалось загрузить профиль.";
        setViewPlayerProfileError(message);
      } finally {
        setViewPlayerProfileLoading(false);
      }
    },
    [],
  );

  const sendLobbyChatMessage = useCallback(() => {
    const text = lobbyChatInput.trim();
    if (!room || !mySessionToken || !text) return;
    socket.emit("send_lobby_chat", {
      code: room.code,
      sessionToken: mySessionToken,
      text,
    });
    setLobbyChatInput("");
  }, [socket, room, mySessionToken, lobbyChatInput]);

  const joinPublicMatch = useCallback(
    (match: PublicMatchInfo) => {
      setJoinPasswordDialogError("");
      if (match.requiresPassword) {
        setJoinPasswordDialogMatch(match);
        setJoinPasswordInput("");
        setJoinPasswordVisible(false);
        setJoinPasswordDialogOpen(true);
        return;
      }
      joinRoom({ code: match.code });
    },
    [joinRoom],
  );

  const joinByCodeFromQuickInput = useCallback(() => {
    const targetCode = joinCode.trim().toUpperCase();
    if (!targetCode) return;
    const listedMatch = publicMatches.find((match) => match.code === targetCode);
    if (listedMatch?.requiresPassword) {
      setJoinPasswordDialogMatch(listedMatch);
      setJoinPasswordInput("");
      setJoinPasswordDialogError("");
      setJoinPasswordVisible(false);
      setJoinPasswordDialogOpen(true);
      return;
    }
    joinRoom({ code: targetCode });
  }, [joinCode, publicMatches, joinRoom]);

  const openVoiceLink = useCallback((url: string | undefined) => {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  }, []);

  const joinPublicMatchWithPassword = useCallback(() => {
    if (!joinPasswordDialogMatch) return;
    const password = joinPasswordInput.trim();
    setJoinPasswordDialogError("");
    if (!password) {
      setJoinPasswordDialogError("Введите пароль комнаты.");
      return;
    }
    joinRoom({ code: joinPasswordDialogMatch.code, password });
  }, [joinPasswordDialogMatch, joinPasswordInput, joinRoom]);

  const openProfileScreen = useCallback(() => {
    setProfileMenuOpen(false);
    setScreen("profile");
  }, []);

  const handlePlayerNameChange = useCallback((value: string) => {
    setProfileNicknameDraft(value.slice(0, 20));
  }, []);

  const handleAuthSuccess = useCallback((user: AuthUser, token: string) => {
    setAuthUser(user);
    setAuthToken(token);
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
    localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
    localStorage.setItem("court_nickname", user.nickname);
    setPlayerName(user.nickname);
    setProfileNicknameDraft(user.nickname);
    if (user.avatar) {
      setAvatar(user.avatar);
      localStorage.setItem("court_avatar", user.avatar);
    }
    if (user.banner) {
      setBanner(user.banner);
      localStorage.setItem(BANNER_STORAGE_KEY, user.banner);
    }
    setAuthError("");
    setAuthDialogOpen(false);
    setAuthMode("login");
    if (activeRoomCode && mySessionToken) {
      socket.emit("update_profile", {
        code: activeRoomCode,
        sessionToken: mySessionToken,
        name: user.nickname,
        avatar: user.avatar ?? null,
        banner: user.banner ?? null,
      });
    }
    setScreen("profile");
  }, [activeRoomCode, mySessionToken, socket]);

  const submitLogin = useCallback(async () => {
    if (authLoading) return;
    setAuthLoading(true);
    setAuthError("");
    try {
      const payload = await authRequest<{ user: AuthUser; token: string }>("/auth/login", {
        method: "POST",
        body: {
          loginOrEmail: loginOrEmail.trim(),
          password: loginPassword,
        },
      });
      handleAuthSuccess(payload.user, payload.token);
      setLoginPassword("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не удалось выполнить вход.";
      setAuthError(localizeAuthError(message));
    } finally {
      setAuthLoading(false);
    }
  }, [authLoading, handleAuthSuccess, loginOrEmail, loginPassword]);

  const submitRegister = useCallback(async () => {
    if (authLoading) return;
    setAuthLoading(true);
    setAuthError("");
    setRegisterLoginError("");
    setRegisterEmailError("");
    try {
      const payload = await authRequest<{ user: AuthUser; token: string }>("/auth/register", {
        method: "POST",
        body: {
          login: registerLogin.trim(),
          email: registerEmail.trim(),
          password: registerPassword,
          confirmPassword: registerConfirmPassword,
          acceptRules: registerAcceptRules,
        },
      });
      handleAuthSuccess(payload.user, payload.token);
      setRegisterPassword("");
      setRegisterConfirmPassword("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не удалось зарегистрироваться.";
      const localized = localizeAuthError(message);
      if (isNicknameTakenError(localized)) {
        setRegisterLoginError("Этот ник уже занят.");
      } else if (isEmailTakenError(localized)) {
        setRegisterEmailError("Эта почта уже занята.");
      } else {
        setAuthError(localized);
      }
    } finally {
      setAuthLoading(false);
    }
  }, [
    authLoading,
    handleAuthSuccess,
    registerAcceptRules,
    registerConfirmPassword,
    registerEmail,
    registerLogin,
    registerPassword,
  ]);

  const logoutAccount = useCallback(() => {
    if (authToken) {
      authRequest("/auth/logout", {
        method: "POST",
        token: authToken,
      }).catch(() => undefined);
    }

    setAuthToken(null);
    setAuthUser(null);
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    localStorage.removeItem(AUTH_USER_STORAGE_KEY);

    const guestName = getOrCreateGuestName();
    setPlayerName(guestName);
    localStorage.setItem("court_nickname", guestName);
    setAvatar(null);
    localStorage.removeItem("court_avatar");
    setBanner(null);
    localStorage.removeItem(BANNER_STORAGE_KEY);
    setProfileMenuOpen(false);
    setScreen("home");
  }, [authToken]);

  const reconnect = useCallback(() => {
    if (
      !reconnectPersistent &&
      reconnectExpiresAt !== null &&
      reconnectExpiresAt <= Date.now()
    ) {
      clearReconnectWindow();
      localStorage.removeItem("court_session");
      localStorage.removeItem("court_session_token");
      setHasSession(false);
      return;
    }
    attemptSessionRejoin("manual");
  }, [
    attemptSessionRejoin,
    clearReconnectWindow,
    reconnectExpiresAt,
    reconnectPersistent,
  ]);

  const roomControlPlayerId =
    room && adminHostId === room.hostId ? adminHostId : myId;
  const gameControlPlayerId =
    game && adminHostId === game.hostId ? adminHostId : myId;
  const roomControlSessionToken =
    room && adminHostId === room.hostId
      ? adminHostSessionToken ?? mySessionToken
      : mySessionToken;
  const gameControlSessionToken =
    game && adminHostId === game.hostId
      ? adminHostSessionToken ?? mySessionToken
      : mySessionToken;

  const startGame = useCallback(() => {
    if (!room || !roomControlSessionToken) return;
    setStartGameLoading(true);
    socket.emit("start_game", {
      code: room.code,
      sessionToken: roomControlSessionToken,
    });
  }, [socket, room, roomControlSessionToken]);

  const toggleHostJudge = useCallback((checked: boolean) => {
    if (!room || !roomControlSessionToken) return;
    setIsHostJudge(checked);
    socket.emit("set_host_judge", {
      code: room.code,
      sessionToken: roomControlSessionToken,
      isHostJudge: checked,
    });
  }, [socket, room, roomControlSessionToken]);

  const kickPlayerFromRoom = useCallback(
    (targetPlayerId: string) => {
      if (!room || !roomControlSessionToken || roomControlPlayerId !== room.hostId) return;
      socket.emit("kick_player", {
        code: room.code,
        sessionToken: roomControlSessionToken,
        targetPlayerId,
      });
    },
    [socket, room, roomControlPlayerId, roomControlSessionToken],
  );

  const revealFact = useCallback(
    (factId: string) => {
      if (!game || !mySessionToken) return;
      socket.emit("reveal_fact", {
        code: game.code,
        sessionToken: mySessionToken,
        factId,
      });
    },
    [socket, game, mySessionToken],
  );

  const useCard = useCallback(
    (cardId: string) => {
      if (!game || !mySessionToken) return;
      socket.emit("use_card", {
        code: game.code,
        sessionToken: mySessionToken,
        cardId,
      });
    },
    [socket, game, mySessionToken],
  );

  const advanceStage = useCallback(() => {
    if (!game || !gameControlSessionToken) return;
    socket.emit("next_stage", {
      code: game.code,
      sessionToken: gameControlSessionToken,
    });
  }, [socket, game, gameControlSessionToken]);

  const retreatStage = useCallback(() => {
    if (!game || !gameControlSessionToken) return;
    socket.emit("prev_stage", {
      code: game.code,
      sessionToken: gameControlSessionToken,
    });
  }, [socket, game, gameControlSessionToken]);

  const submitVerdict = useCallback(
    (verdict: string) => {
      if (!game || !mySessionToken) return;
      socket.emit("set_verdict", {
        code: game.code,
        sessionToken: mySessionToken,
        verdict,
      });
    },
    [socket, game, mySessionToken],
  );

  const triggerProtest = useCallback(() => {
    if (!game || !mySessionToken) return;
    socket.emit("trigger_protest", {
      code: game.code,
      sessionToken: mySessionToken,
    });
  }, [game, mySessionToken, socket]);

  const resolveProtest = useCallback(
    (resolution: "accepted" | "rejected") => {
      if (!game || !mySessionToken) return;
      socket.emit("resolve_protest", {
        code: game.code,
        sessionToken: mySessionToken,
        resolution,
      });
    },
    [game, mySessionToken, socket],
  );

  const triggerJudgeSilence = useCallback(() => {
    if (!game || !mySessionToken) return;
    socket.emit("trigger_judge_silence", {
      code: game.code,
      sessionToken: mySessionToken,
    });
  }, [game, mySessionToken, socket]);

  const triggerJudgeWarning = useCallback(
    (targetPlayerId: string) => {
      if (!game || !mySessionToken || !targetPlayerId) return;
      socket.emit("trigger_warning", {
        code: game.code,
        targetPlayerId,
        sessionToken: mySessionToken,
      });
    },
    [game, mySessionToken, socket],
  );

  const removeJudgeWarning = useCallback(
    (targetPlayerId: string) => {
      if (!game || !mySessionToken || !targetPlayerId) return;
      socket.emit("remove_warning", {
        code: game.code,
        targetPlayerId,
        sessionToken: mySessionToken,
      });
    },
    [game, mySessionToken, socket],
  );

  const openLawyerChat = useCallback(() => {
    if (!game || !mySessionToken) return;
    setLawyerChatUnreadCount(0);
    setInfluenceView("chat");
    socket.emit("get_lawyer_chat_state", {
      code: game.code,
      sessionToken: mySessionToken,
    });
  }, [game, mySessionToken, socket]);

  const sendLawyerChatMessage = useCallback(() => {
    if (!game || !mySessionToken || !lawyerChatPartner) return;
    const text = lawyerChatInput.trim();
    if (!text) return;
    socket.emit("send_lawyer_chat", {
      code: game.code,
      sessionToken: mySessionToken,
      text,
    });
    setLawyerChatInput("");
  }, [game, lawyerChatInput, lawyerChatPartner, mySessionToken, socket]);

  const returnHomeWithSession = useCallback(() => {
    const previousRank = myProfileRef.current?.rank;
    const finishedWithVerdict = !!game?.verdict;
    const shouldPreserveReconnect =
      !!game || !!(room && !(myId === room.hostId && room.players.length <= 1));
    if (shouldPreserveReconnect) {
      startReconnectWindow();
    } else {
      clearReconnectWindow();
      localStorage.removeItem("court_session");
      localStorage.removeItem("court_session_token");
      setHasSession(false);
      setMySessionToken(null);
    }
    socket.emit("leave_room", { preserveForRejoin: shouldPreserveReconnect });
    setScreen("home");
    setRoom(null);
    setGame(null);
    setMyId(null);
    setAdminHostId(null);
    localStorage.removeItem("court_admin_host_id");
    setAdminHostSessionToken(null);
    localStorage.removeItem("court_admin_host_token");
    setJoinCode("");
    setJoinPasswordDialogOpen(false);
    setJoinPasswordDialogMatch(null);
    setJoinPasswordInput("");
    setJoinPasswordDialogError("");
    setJoinPasswordVisible(false);
    setKickedAlert("");
    setCopiedRoomCode(false);
    setIsHostJudge(false);
    setStartGameLoading(false);
    setContextHelpOpen(false);
    setLobbyChatInput("");
    setLobbyChatMessages([]);
    setProfileMenuOpen(false);
    setCreateMatchDialogOpen(false);
    if (finishedWithVerdict) {
      if (authToken) {
        localStorage.setItem(RANK_TOAST_PENDING_STORAGE_KEY, "1");
      }
      void syncRankResultAfterMatch(previousRank);
    }
  }, [authToken, clearReconnectWindow, game, myId, room, socket, startReconnectWindow, syncRankResultAfterMatch]);

  const finalExit = useCallback(() => {
    const previousRank = myProfileRef.current?.rank;
    const finishedWithVerdict = !!game?.verdict;
    const shouldPreserveReconnect =
      !!game || !!(room && !(myId === room.hostId && room.players.length <= 1));
    if (shouldPreserveReconnect) {
      startReconnectWindow();
    } else {
      clearReconnectWindow();
      localStorage.removeItem("court_session");
      localStorage.removeItem("court_session_token");
      setHasSession(false);
      setMySessionToken(null);
    }
    socket.emit("leave_room", { preserveForRejoin: shouldPreserveReconnect });
    setScreen("home");
    setRoom(null);
    setGame(null);
    setMyId(null);
    setAdminHostId(null);
    localStorage.removeItem("court_admin_host_id");
    setAdminHostSessionToken(null);
    localStorage.removeItem("court_admin_host_token");
    setJoinCode("");
    setJoinPasswordDialogOpen(false);
    setJoinPasswordDialogMatch(null);
    setJoinPasswordInput("");
    setJoinPasswordDialogError("");
    setJoinPasswordVisible(false);
    setKickedAlert("");
    setCopiedRoomCode(false);
    setStartGameLoading(false);
    setContextHelpOpen(false);
    setLobbyChatInput("");
    setLobbyChatMessages([]);
    setProfileMenuOpen(false);
    setCreateMatchDialogOpen(false);
    if (finishedWithVerdict) {
      if (authToken) {
        localStorage.setItem(RANK_TOAST_PENDING_STORAGE_KEY, "1");
      }
      void syncRankResultAfterMatch(previousRank);
    }
  }, [authToken, clearReconnectWindow, game, myId, room, socket, startReconnectWindow, syncRankResultAfterMatch]);

  const compressImage = useCallback(
    (inputDataUrl: string, maxSide: number): Promise<string> =>
      new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
          const width = Math.max(1, Math.round(img.width * scale));
          const height = Math.max(1, Math.round(img.height * scale));

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(inputDataUrl);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.82));
        };
        img.onerror = () => resolve(inputDataUrl);
        img.src = inputDataUrl;
      }),
    [],
  );

  const openImageCropper = useCallback(
    (file: File, target: CropTarget) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = (ev.target?.result as string) || "";
        if (!dataUrl) return;
        const img = new Image();
        img.onload = () => {
          setImageCropNaturalWidth(Math.max(1, img.naturalWidth || img.width || 1024));
          setImageCropNaturalHeight(Math.max(1, img.naturalHeight || img.height || 1024));
          setImageCropTarget(target);
          setImageCropSource(dataUrl);
          setImageCropZoom(1);
          setImageCropOffsetX(0);
          setImageCropOffsetY(0);
          setImageCropFlipX(false);
          setImageCropDialogOpen(true);
        };
        img.onerror = () => {
          setImageCropNaturalWidth(1024);
          setImageCropNaturalHeight(1024);
          setImageCropTarget(target);
          setImageCropSource(dataUrl);
          setImageCropZoom(1);
          setImageCropOffsetX(0);
          setImageCropOffsetY(0);
          setImageCropFlipX(false);
          setImageCropDialogOpen(true);
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    },
    [],
  );

  const applyImageCrop = useCallback(async () => {
    if (!imageCropSource) return;
    setImageCropLoading(true);
    try {
      const cropped = await cropImageDataUrl({
        sourceDataUrl: imageCropSource,
        target: imageCropTarget,
        zoom: imageCropZoom,
        offsetX: imageCropOffsetX,
        offsetY: imageCropOffsetY,
        flipX: imageCropFlipX,
      });

      if (imageCropTarget === "avatar") {
        const compactAvatar = await compressImage(cropped, 384);
        setProfileAvatarDraft(compactAvatar);
      } else {
        const compactBanner = await compressImage(cropped, 1280);
        setProfileBannerDraft(compactBanner);
      }

      setImageCropDialogOpen(false);
      setImageCropSource(null);
    } finally {
      setImageCropLoading(false);
    }
  }, [
    compressImage,
    imageCropOffsetX,
    imageCropOffsetY,
    imageCropFlipX,
    imageCropSource,
    imageCropTarget,
    imageCropZoom,
  ]);

  const resetImageCrop = useCallback(() => {
    setImageCropZoom(1);
    setImageCropOffsetX(0);
    setImageCropOffsetY(0);
    setImageCropFlipX(false);
  }, []);

  const startImageCropDrag = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!imageCropSource) return;
      event.preventDefault();
      (event.currentTarget as HTMLDivElement).setPointerCapture(event.pointerId);
      imageCropDragStateRef.current = {
        dragging: true,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startOffsetX: imageCropOffsetX,
        startOffsetY: imageCropOffsetY,
      };
    },
    [imageCropOffsetX, imageCropOffsetY, imageCropSource],
  );

  const moveImageCropDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = imageCropDragStateRef.current;
    if (!dragState?.dragging || dragState.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - dragState.startX;
    const deltaY = event.clientY - dragState.startY;
    setImageCropOffsetX(clampNumber(dragState.startOffsetX + deltaX, -imageCropMaxOffsetX, imageCropMaxOffsetX));
    setImageCropOffsetY(clampNumber(dragState.startOffsetY + deltaY, -imageCropMaxOffsetY, imageCropMaxOffsetY));
  }, [imageCropMaxOffsetX, imageCropMaxOffsetY]);

  const endImageCropDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = imageCropDragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    imageCropDragStateRef.current = null;
    (event.currentTarget as HTMLDivElement).releasePointerCapture(event.pointerId);
  }, []);
  const onImageCropWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      event.preventDefault();
      const nextZoom = clampNumber(imageCropZoom + (event.deltaY < 0 ? 0.08 : -0.08), 1, 3);
      setImageCropZoom(nextZoom);
    },
    [imageCropZoom],
  );
  useEffect(() => {
    setImageCropOffsetX((prev) => clampNumber(prev, -imageCropMaxOffsetX, imageCropMaxOffsetX));
    setImageCropOffsetY((prev) => clampNumber(prev, -imageCropMaxOffsetY, imageCropMaxOffsetY));
  }, [imageCropMaxOffsetX, imageCropMaxOffsetY]);

  const handleAvatarChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      openImageCropper(file, "avatar");
      e.target.value = "";
    },
    [openImageCropper],
  );

  const handleBannerChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      openImageCropper(file, "banner");
      e.target.value = "";
    },
    [openImageCropper],
  );

  const copyCode = useCallback((code: string) => {
    if (!navigator.clipboard) {
      setError("Не удалось скопировать код комнаты.");
      setTimeout(() => setError(""), 4000);
      return;
    }
    navigator.clipboard
      .writeText(code)
      .then(() => {
        setCopiedRoomCode(true);
        setTimeout(() => setCopiedRoomCode(false), 2000);
      })
      .catch(() => {
        setError("Не удалось скопировать код комнаты.");
        setTimeout(() => setError(""), 4000);
      });
  }, []);

  if (screen === "profile") {
    const profileData: PublicUserProfile | null = myProfile
      ? myProfile
      : authUser
        ? {
            id: authUser.id,
            nickname: authUser.nickname,
            avatar: authUser.avatar,
            banner: authUser.banner,
            bio: authUser.bio,
            gender: authUser.gender,
            birthDate: authUser.birthDate,
            hideAge: authUser.hideAge,
            createdAt: authUser.createdAt,
          }
        : null;

    const registeredAtLabel =
      typeof profileData?.createdAt === "number"
        ? new Date(profileData.createdAt).toLocaleDateString("ru-RU")
        : "Не указана";
    const genderLabel = getGenderLabel(profileData?.gender);
    const computedAge = computeAgeFromIsoDate(profileData?.birthDate);
    const ageLabel = profileData?.hideAge
      ? "Скрыт"
      : typeof profileData?.age === "number"
        ? `${profileData.age} лет`
        : typeof computedAge === "number"
          ? `${computedAge} лет`
        : "Не указан";

    const totalMatches = profileData?.stats?.totalMatches ?? 0;
    const totalWins = profileData?.stats?.totalWins ?? 0;
    const totalWinRate = profileData?.stats?.totalWinRate ?? 0;
    const currentRank = profileData?.rank;
    const currentRankVisualKey = rankKeyToBadgeVisualKey(currentRank?.key);
    const currentRankTheme = getBadgeTheme(currentRankVisualKey);
    const rankProgressPercent = currentRank
      ? Math.max(
          0,
          Math.min(
            100,
            currentRank.progressTarget > 0
              ? (currentRank.progressCurrent / currentRank.progressTarget) * 100
              : 0,
          ),
        )
      : 0;
    const badges = profileData?.badges ?? [];
    const activeBadges = badges.filter((badge) => badge.active);
    const currentSelectedBadgeTitle =
      getBadgeTitleByKey(selectedBadgeKey, badges) || "Без бейджа";
    const baseSelectedBadgeKey =
      myProfile?.selectedBadgeKey ?? myProfile?.badges?.find((badge) => badge.active)?.key ?? "";
    const hasUnsavedProfileChanges =
      profileNicknameDraft.trim() !== (authUser?.nickname ?? "").trim() ||
      profileBio !== (authUser?.bio ?? "") ||
      profileGender !==
        (authUser?.gender === "male" || authUser?.gender === "female" || authUser?.gender === "other"
          ? authUser.gender
          : "") ||
      profileBirthDate !== formatIsoDateToRu(authUser?.birthDate) ||
      profileHideAge !== !!authUser?.hideAge ||
      (profileAvatarDraft ?? null) !== (avatar ?? null) ||
      (profileBannerDraft ?? null) !== (banner ?? null) ||
      (selectedBadgeKey || "") !== (baseSelectedBadgeKey || "");
    const requestLeaveProfile = async () => {
      if (profileActionLoading) return;
      if (!hasUnsavedProfileChanges) {
        setScreen("home");
        return;
      }
      setProfileExitConfirmOpen(true);
    };

    return (
      <motion.div
        key="profile"
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className="relative isolate min-h-screen overflow-x-hidden overflow-y-scroll bg-[#0b0b0f] text-zinc-100 p-6 md:p-10 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        <CourtAtmosphereBackground />
        <div className="max-w-7xl mx-auto">
          <Card className="rounded-[28px] border-zinc-800 bg-zinc-900/95 text-zinc-100 overflow-visible">
            <CardContent className="p-6 md:p-8 space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm uppercase tracking-[0.16em] text-zinc-500">Профиль</div>
                  <h2 className="mt-2 text-3xl font-bold">Личный кабинет</h2>
                  <p className="mt-2 text-zinc-400">
                    Управляйте профилем, безопасностью и личной статистикой.
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-100"
                  onClick={() => {
                    void requestLeaveProfile();
                  }}
                >
                  Назад
                </Button>
              </div>

              <div className="rounded-3xl border border-zinc-800 bg-zinc-950/70 overflow-hidden">
                <div
                  className="relative min-h-[122px] md:min-h-[122px] p-5 md:p-6 flex flex-col justify-end cursor-pointer group/banner"
                  style={getBannerStyle(profileBannerDraft, profileAvatarDraft, playerName || "Игрок")}
                  onClick={() => bannerInputRef.current?.click()}
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/45 to-black/15" />
                  <div className="absolute inset-0 opacity-0 group-hover/banner:opacity-100 transition-opacity bg-black/15" />
                  <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-center gap-4 min-w-0">
                      <div
                        className="relative cursor-pointer group/avatar"
                        onClick={(e) => {
                          e.stopPropagation();
                          avatarInputRef.current?.click();
                        }}
                      >
                        <Avatar src={profileAvatarDraft} name={playerName || "?"} size={138} />
                        <div className="absolute inset-0 rounded-full bg-black/55 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity">
                          <Camera className="w-6 h-6 text-white" />
                        </div>
                      </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-3xl font-bold leading-none">{playerName || "Игрок"}</div>
                            {selectedBadgeKey && (
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
                                  getBadgeTheme(selectedBadgeKey).chip
                                }`}
                              >
                                <BadgeGlyph
                                  badgeKey={selectedBadgeKey}
                                  className={`h-3.5 w-3.5 ${getBadgeTheme(selectedBadgeKey).iconOnly ?? "text-zinc-300"}`}
                                />
                                {getBadgeTitleByKey(selectedBadgeKey, badges)}
                              </span>
                            )}
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                            <span className="inline-flex h-8 items-center rounded-full border border-zinc-600 bg-black/35 px-3 whitespace-nowrap">
                              Возраст: {ageLabel}
                          </span>
                          <span className="inline-flex h-8 items-center rounded-full border border-zinc-600 bg-black/35 px-3 whitespace-nowrap">
                            Пол: {genderLabel}
                          </span>
                            <span className="inline-flex h-8 items-center rounded-full border border-zinc-600 bg-black/35 px-3 whitespace-nowrap">
                              С нами с: {registeredAtLabel}
                            </span>
                          </div>
                        </div>
                      </div>
                    <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                      <Button
                        variant="outline"
                        className="rounded-xl border-zinc-500/70 bg-black/30 text-zinc-100 hover:bg-black/50 hover:text-zinc-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          void resetProfileMedia();
                        }}
                      >
                        Сброс
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
              <input
                ref={bannerInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleBannerChange}
              />
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />

              <div className="grid items-start gap-4 xl:grid-cols-[1.35fr_1fr]">
                <div className="space-y-4">
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 md:p-5">
                    <div className="text-lg font-semibold">Личная информация</div>
                    <div className="text-sm text-zinc-500 mt-1">
                      Ник, описание, пол и возрастной профиль.
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(190px,240px)]">
                      <div className="md:col-span-2">
                        <label className="text-sm text-zinc-300">Никнейм</label>
                        <Input
                          value={profileNicknameDraft}
                          onChange={(e) => {
                            handlePlayerNameChange(e.target.value);
                            if (profileNicknameError) setProfileNicknameError("");
                          }}
                          placeholder="Например: Berly"
                          className="mt-2 h-11 rounded-xl border border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-red-500/40"
                        />
                        {profileNicknameError ? (
                          <div className="mt-1 px-1 text-xs text-red-300">{profileNicknameError}</div>
                        ) : null}
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-sm text-zinc-300">О себе</label>
                        <textarea
                          value={profileBio}
                          onChange={(e) => setProfileBio(e.target.value.slice(0, PROFILE_BIO_MAX))}
                          placeholder="Коротко о себе..."
                          className="mt-2 h-24 w-full resize-none rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
                        />
                        <div
                          className={`mt-1 text-xs text-left ${
                            profileBio.length >= PROFILE_BIO_MAX ? "text-red-400" : "text-zinc-500"
                          }`}
                        >
                          {profileBio.length}/{PROFILE_BIO_MAX}
                        </div>
                      </div>
                      <div>
                        <label className="text-sm text-zinc-300">Пол</label>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          {[
                            { value: "male", label: "Мужской" },
                            { value: "female", label: "Женский" },
                          ].map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() =>
                                setProfileGender(option.value as "" | "male" | "female" | "other")
                              }
                              className={`h-10 rounded-xl border px-3 text-sm transition-colors ${
                                profileGender === option.value
                                  ? "border-red-500 bg-red-600 text-white"
                                  : "border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
                              }`}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="max-w-[240px]">
                        <label className="text-sm text-zinc-300">Дата рождения</label>
                        <div className="relative mt-2">
                          <Input
                            ref={profileBirthDateRef}
                            type="text"
                            value={profileBirthDate}
                            placeholder="ДД.ММ.ГГГГ"
                            onChange={(e) => {
                              const next = e.target.value
                                .replace(/[^\d.]/g, "")
                                .replace(/^(\d{2})(\d)/, "$1.$2")
                                .replace(/^(\d{2}\.\d{2})(\d)/, "$1.$2")
                                .slice(0, 10);
                              setProfileBirthDate(next);
                              if (profileBirthDateError) setProfileBirthDateError("");
                            }}
                            className="h-11 rounded-xl border border-zinc-700 bg-zinc-900 pr-11 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-red-500/40"
                          />
                          <button
                            type="button"
                            className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md border border-zinc-700 bg-zinc-900 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
                            onClick={() => {
                              profileBirthDateRef.current?.focus();
                            }}
                            aria-label="Поле даты рождения"
                          >
                            <CalendarDays className="h-4 w-4" />
                          </button>
                        </div>
                        {profileBirthDateError ? (
                          <div className="mt-1 px-1 text-xs text-red-300">{profileBirthDateError}</div>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-1">
                      <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 px-3 py-2 flex items-center justify-between">
                        <div>
                          <div className="text-sm text-zinc-100">Скрыть возраст</div>
                          <div className="text-xs text-zinc-500">Возраст в профиле будет скрыт.</div>
                        </div>
                        <Switch checked={profileHideAge} onCheckedChange={setProfileHideAge} />
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        onClick={saveExtendedProfile}
                        disabled={profileActionLoading}
                        className="rounded-xl bg-red-600 hover:bg-red-500 text-white border-0"
                      >
                        Сохранить личные данные
                      </Button>
                      <Button
                        variant="outline"
                        className="rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-100"
                        onClick={() => {
                          void requestLeaveProfile();
                        }}
                      >
                        В главное меню
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 md:p-5">
                    <div className="text-lg font-semibold">Безопасность</div>
                    <div className="text-sm text-zinc-500 mt-1">Управление доступом к аккаунту.</div>
                    <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-900/55 px-3 py-3">
                      <div className="text-sm text-zinc-500">Текущая почта</div>
                      <div className="mt-1 text-sm text-zinc-100 break-all">
                        {authUser?.email ?? "Гостевой режим"}
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <Button
                        variant="outline"
                        className="h-11 rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-100"
                        onClick={() => setPasswordDialogOpen(true)}
                      >
                        Сменить пароль
                      </Button>
                      <Button
                        variant="outline"
                        className="h-11 rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-100"
                        onClick={() => setEmailDialogOpen(true)}
                      >
                        Сменить почту
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="self-start flex flex-col gap-4">
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 md:p-5 space-y-3">
                    <div className="text-lg font-semibold">Подписка</div>
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/55 px-3 py-3">
                      <div className="text-sm text-zinc-500">Текущий статус</div>
                      <div className="mt-1 text-base font-semibold text-zinc-100">
                        {profileData?.subscription?.label ?? "Нет подписки"}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 md:p-5 space-y-3">
                    <div className="text-lg font-semibold">Ранг</div>
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/55 px-3 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="inline-flex items-center gap-2 text-base font-semibold text-zinc-100">
                          <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ${currentRankTheme.icon}`}>
                            <BadgeGlyph
                              badgeKey={currentRankVisualKey}
                              className={`h-4 w-4 ${currentRankTheme.iconOnly ?? "text-zinc-300"}`}
                            />
                          </span>
                          <span>{currentRank?.title ?? "НОВИЧОК"}</span>
                        </div>
                        <div className="text-xs text-zinc-400">
                          Очки: {currentRank?.points ?? 0}
                        </div>
                      </div>
                      <div className="mt-2 h-2 w-full rounded-full bg-zinc-800">
                        <div
                          className="h-2 rounded-full bg-red-500 transition-all"
                          style={{ width: `${rankProgressPercent}%` }}
                        />
                      </div>
                      <div className="mt-2 text-xs text-zinc-400">
                        {currentRank?.nextTitle
                          ? `До ранга «${currentRank.nextTitle}»: ${Math.max(
                              0,
                              (currentRank.nextPoints ?? 0) - currentRank.points,
                            )} очк.`
                          : "Максимальный ранг достигнут"}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 md:p-5">
                    <div className="text-lg font-semibold">Бейджи</div>
                    <div className="text-sm text-zinc-500 mt-1">
                      Активные и доступные награды профиля.
                    </div>
                    <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-900/55 p-2 overflow-visible">
                      <div className="text-xs text-zinc-500 px-1 pb-2">Выбранный бейдж</div>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setBadgePickerOpen((prev) => !prev)}
                          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-left text-zinc-100 hover:bg-zinc-800 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                              {selectedBadgeKey ? (
                                <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${getBadgeTheme(selectedBadgeKey).icon}`}>
                                  <BadgeGlyph badgeKey={selectedBadgeKey} className="h-3.5 w-3.5" />
                                </span>
                              ) : null}
                              <span className="truncate text-sm font-semibold">{currentSelectedBadgeTitle}</span>
                            </div>
                            <ChevronDown
                              className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform ${
                                badgePickerOpen ? "rotate-180" : ""
                              }`}
                            />
                          </div>
                        </button>
                        {badgePickerOpen && (
                          <div className="absolute top-full z-[170] mt-2 w-full overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950 shadow-[0_18px_44px_rgba(0,0,0,0.55)]">
                            <div className="max-h-[min(18rem,calc(100vh-12rem))] overflow-y-auto p-1.5 [scrollbar-width:thin] [scrollbar-color:rgba(113,113,122,0.9)_rgba(24,24,27,0.45)] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-zinc-900/55 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-700/85 [&::-webkit-scrollbar-thumb:hover]:bg-zinc-500">
                              {activeBadges.map((badge) => (
                                <button
                                  key={`select-${badge.key}`}
                                  type="button"
                                  onClick={() => {
                                    setSelectedBadgeKey(badge.key);
                                    setBadgePickerOpen(false);
                                  }}
                                  className={`w-full rounded-md border px-2.5 py-2 text-left transition-colors ${
                                    selectedBadgeKey === badge.key
                                      ? "border-red-500 bg-red-600/20 text-red-200"
                                      : "border-zinc-800 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${getBadgeTheme(badge.key).icon}`}>
                                      <BadgeGlyph badgeKey={badge.key} className="h-3.5 w-3.5" />
                                    </span>
                                    <span className="truncate text-sm font-semibold">{badge.title}</span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        className="mt-2 w-full rounded-lg border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-100"
                        onClick={() => setBadgeRulesOpen(true)}
                      >
                        Как получить бейджи
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 md:p-5">
                    <div className="text-lg font-semibold">Статистика</div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-2 py-3">
                        <div className="text-xs text-zinc-500">Матчей</div>
                        <div className="mt-1 text-xl font-bold">{totalMatches}</div>
                      </div>
                      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-2 py-3">
                        <div className="text-xs text-zinc-500">Побед</div>
                        <div className="mt-1 text-xl font-bold">{totalWins}</div>
                      </div>
                      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-2 py-3">
                        <div className="text-xs text-zinc-500">Winrate</div>
                        <div className="mt-1 text-xl font-bold">{Math.round(totalWinRate)}%</div>
                      </div>
                    </div>
                    <div className="mt-3 h-2 w-full rounded-full bg-zinc-800">
                      <div
                        className="h-2 rounded-full bg-red-500 transition-all"
                        style={{ width: `${Math.max(0, Math.min(100, totalWinRate))}%` }}
                      />
                    </div>
                    <div className="mt-4 space-y-2">
                      <Button
                        variant="outline"
                        className="w-full rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-100"
                        onClick={() => setProfileMatchesOpen(true)}
                        disabled={(profileData?.recentMatches ?? []).length === 0}
                      >
                        Последние матчи
                      </Button>
                    </div>
                  </div>

                </div>
              </div>
            </CardContent>
          </Card>
          {myProfileLoading && (
            <div className="mt-3 text-center text-sm text-zinc-500">Загружаем статистику и бейджи...</div>
          )}
        </div>
        <Dialog open={profileMatchesOpen} onOpenChange={setProfileMatchesOpen}>
          <DialogContent className="max-w-3xl border-zinc-800 bg-zinc-950 text-zinc-100">
            <DialogHeader>
              <DialogTitle>Последние матчи</DialogTitle>
              <DialogDescription className="text-zinc-400">
                История матчей и результаты по вашей роли.
              </DialogDescription>
            </DialogHeader>
            <div className={`max-h-[60vh] overflow-y-auto space-y-2 pr-1 ${HIDE_SCROLLBAR_CLASS}`}>
              {(profileData?.recentMatches ?? []).length ? (
                (profileData?.recentMatches ?? []).map((match, idx) => (
                  <div
                    key={`${match.roomCode}-${idx}-${match.finishedAt}`}
                    className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold">
                        {match.didWin ? "Победа" : "Поражение"} · {match.roleTitle}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {new Date(match.finishedAt).toLocaleString("ru-RU")}
                      </div>
                    </div>
                    <div className="text-xs text-zinc-400">
                      Комната {match.roomCode} · Вердикт: {match.verdict}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {match.participants.map((participant, pIndex) => (
                        <button
                          key={`${participant.nickname}-${pIndex}`}
                          type="button"
                          className={`rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs ${
                            participant.userId
                              ? "text-zinc-200 hover:bg-zinc-800"
                              : "text-zinc-400 cursor-default"
                          }`}
                          disabled={!participant.userId}
                          onClick={() => openUserProfile(participant.userId)}
                        >
                          {participant.nickname} · {participant.roleTitle}
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              ) : null}
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={badgeRulesOpen} onOpenChange={setBadgeRulesOpen}>
          <DialogContent className="max-w-2xl border-zinc-800 bg-zinc-950 text-zinc-100">
            <DialogHeader>
              <DialogTitle>Бейджи и условия</DialogTitle>
              <DialogDescription className="text-zinc-400">
                Здесь показаны доступные бейджи и как их открыть.
              </DialogDescription>
            </DialogHeader>
            <div className="relative">
              <div className="max-h-[60vh] overflow-y-auto pr-1 pb-2 pt-1 space-y-4 [scrollbar-width:thin] [scrollbar-color:rgba(113,113,122,0.9)_rgba(24,24,27,0.45)] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-zinc-900/55 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-700/85 [&::-webkit-scrollbar-thumb:hover]:bg-zinc-500">
                <div className="relative z-20 rounded-lg border border-zinc-800 bg-zinc-950/95 px-3 py-2 text-center text-xs uppercase tracking-[0.12em] text-zinc-400">
                  Получаемые
                </div>
                {badges
                  .filter((badge) => getBadgeCategory(badge) === "earned")
                  .map((badge) => (
                    <div
                      key={`rules-${badge.key}`}
                      className={`rounded-xl border px-3 py-3 ${getBadgeTheme(badge.key).chip}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-zinc-700/70 bg-black/30">
                            <BadgeGlyph badgeKey={badge.key} className={`h-4 w-4 ${getBadgeTheme(badge.key).iconOnly ?? "text-zinc-300"}`} />
                          </span>
                          <div className="text-sm font-semibold truncate">{badge.title}</div>
                        </div>
                        <div className="text-xs text-zinc-300">{badge.active ? "Доступен" : "Закрыт"}</div>
                      </div>
                      <div className="mt-2 text-xs text-zinc-300/90">{badge.description}</div>
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-[11px] text-zinc-300/80">
                          <span>Прогресс</span>
                          <span>{badge.progressLabel ?? (badge.active ? "Получен" : "Не получен")}</span>
                        </div>
                        <div className="mt-1 h-1.5 w-full rounded-full bg-black/35">
                          <div
                            className={`h-1.5 rounded-full transition-all ${
                              badge.active ? "bg-red-400" : "bg-zinc-500"
                            }`}
                            style={{
                              width: `${Math.max(
                                0,
                                Math.min(
                                  100,
                                  badge.progressTarget && badge.progressTarget > 0
                                    ? ((badge.progressCurrent ?? 0) / badge.progressTarget) * 100
                                    : badge.active
                                      ? 100
                                      : 0,
                                ),
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                <div className="relative z-20 mt-1 rounded-lg border border-zinc-800 bg-zinc-950/95 px-3 py-2 text-center text-xs uppercase tracking-[0.12em] text-zinc-400">
                  Ранговые
                </div>
                {badges
                  .filter((badge) => getBadgeCategory(badge) === "rank")
                  .map((badge) => (
                    <div
                      key={`rules-${badge.key}`}
                      className={`rounded-xl border px-3 py-3 ${getBadgeTheme(badge.key).chip}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-zinc-700/70 bg-black/30">
                            <BadgeGlyph badgeKey={badge.key} className={`h-4 w-4 ${getBadgeTheme(badge.key).iconOnly ?? "text-zinc-300"}`} />
                          </span>
                          <div className="text-sm font-semibold truncate">{badge.title}</div>
                        </div>
                        <div className="text-xs text-zinc-300">{badge.active ? "Доступен" : "Закрыт"}</div>
                      </div>
                      <div className="mt-2 text-xs text-zinc-300/90">{badge.description}</div>
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-[11px] text-zinc-300/80">
                          <span>Прогресс</span>
                          <span>{badge.progressLabel ?? (badge.active ? "Получен" : "Не получен")}</span>
                        </div>
                        <div className="mt-1 h-1.5 w-full rounded-full bg-black/35">
                          <div
                            className={`h-1.5 rounded-full transition-all ${
                              badge.active ? "bg-red-400" : "bg-zinc-500"
                            }`}
                            style={{
                              width: `${Math.max(
                                0,
                                Math.min(
                                  100,
                                  badge.progressTarget && badge.progressTarget > 0
                                    ? ((badge.progressCurrent ?? 0) / badge.progressTarget) * 100
                                    : badge.active
                                      ? 100
                                      : 0,
                                ),
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                <div className="relative z-20 mt-1 rounded-lg border border-zinc-800 bg-zinc-950/95 px-3 py-2 text-center text-xs uppercase tracking-[0.12em] text-zinc-400">
                  Выдаваемые
                </div>
                {badges
                  .filter((badge) => getBadgeCategory(badge) === "manual")
                  .map((badge) => (
                    <div
                      key={`rules-${badge.key}`}
                      className={`rounded-xl border px-3 py-3 ${getBadgeTheme(badge.key).chip}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-zinc-700/70 bg-black/30">
                            <BadgeGlyph badgeKey={badge.key} className={`h-4 w-4 ${getBadgeTheme(badge.key).iconOnly ?? "text-zinc-300"}`} />
                          </span>
                          <div className="text-sm font-semibold truncate">{badge.title}</div>
                        </div>
                        <div className="text-xs text-zinc-300">{badge.active ? "Доступен" : "Закрыт"}</div>
                      </div>
                      <div className="mt-2 text-xs text-zinc-300/90">{badge.description}</div>
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-[11px] text-zinc-300/80">
                          <span>Прогресс</span>
                          <span>{badge.progressLabel ?? (badge.active ? "Получен" : "Не получен")}</span>
                        </div>
                        <div className="mt-1 h-1.5 w-full rounded-full bg-black/35">
                          <div
                            className={`h-1.5 rounded-full transition-all ${
                              badge.active ? "bg-red-400" : "bg-zinc-500"
                            }`}
                            style={{
                              width: `${Math.max(
                                0,
                                Math.min(
                                  100,
                                  badge.progressTarget && badge.progressTarget > 0
                                    ? ((badge.progressCurrent ?? 0) / badge.progressTarget) * 100
                                    : badge.active
                                      ? 100
                                      : 0,
                                ),
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={profileExitConfirmOpen} onOpenChange={setProfileExitConfirmOpen}>
          <DialogContent className="max-w-md border-zinc-800 bg-zinc-950 text-zinc-100">
            <DialogHeader>
              <DialogTitle>Сохранить изменения?</DialogTitle>
              <DialogDescription className="text-zinc-400">
                В профиле есть несохраненные изменения.
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-2">
              <Button
                className="flex-1 rounded-xl bg-red-600 text-white hover:bg-red-500 border-0"
                disabled={profileActionLoading}
                onClick={async () => {
                  const ok = await saveExtendedProfile();
                  if (!ok) return;
                  setProfileExitConfirmOpen(false);
                  setScreen("home");
                }}
              >
                Сохранить
              </Button>
              <Button
                variant="outline"
                className="flex-1 rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-100"
                disabled={profileActionLoading}
                onClick={() => {
                  setProfileExitConfirmOpen(false);
                  setScreen("home");
                }}
              >
                Сбросить
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
          <DialogContent className="max-w-md border-zinc-800 bg-zinc-950 text-zinc-100">
            <DialogHeader>
              <DialogTitle>Сменить пароль</DialogTitle>
              <DialogDescription className="text-zinc-400">
                Подтвердите текущий пароль и введите новый.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                type="password"
                value={passwordChangeCurrent}
                onChange={(e) => setPasswordChangeCurrent(e.target.value)}
                placeholder="Текущий пароль"
                className="h-11 rounded-xl border border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-red-500/40"
              />
              <Input
                type="password"
                value={passwordChangeNext}
                onChange={(e) => setPasswordChangeNext(e.target.value)}
                placeholder="Новый пароль"
                className="h-11 rounded-xl border border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-red-500/40"
              />
              <Button
                onClick={async () => {
                  const ok = await changePassword();
                  if (ok) setPasswordDialogOpen(false);
                }}
                disabled={profileActionLoading || !passwordChangeCurrent || !passwordChangeNext}
                className="w-full h-11 rounded-xl bg-red-600 text-white hover:bg-red-500 border-0"
              >
                Сохранить пароль
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
          <DialogContent className="max-w-md border-zinc-800 bg-zinc-950 text-zinc-100">
            <DialogHeader>
              <DialogTitle>Сменить почту</DialogTitle>
              <DialogDescription className="text-zinc-400">
                Введите новую почту и подтвердите текущий пароль.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                type="email"
                value={emailChangeNext}
                onChange={(e) => setEmailChangeNext(e.target.value)}
                placeholder="Новая почта"
                className="h-11 rounded-xl border border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-red-500/40"
              />
              <Input
                type="password"
                value={emailChangeCurrentPassword}
                onChange={(e) => setEmailChangeCurrentPassword(e.target.value)}
                placeholder="Текущий пароль"
                className="h-11 rounded-xl border border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-red-500/40"
              />
              <Button
                onClick={async () => {
                  const ok = await changeEmail();
                  if (ok) setEmailDialogOpen(false);
                }}
                disabled={profileActionLoading || !emailChangeCurrentPassword || !emailChangeNext.trim()}
                className="w-full h-11 rounded-xl bg-red-600 text-white hover:bg-red-500 border-0"
              >
                Сохранить почту
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog
          open={imageCropDialogOpen}
          onOpenChange={(open) => {
            setImageCropDialogOpen(open);
            if (!open) {
              setImageCropSource(null);
              setImageCropLoading(false);
            }
          }}
        >
          <DialogContent className="max-w-[1120px] border-zinc-800 bg-zinc-950 text-zinc-100">
            <DialogHeader>
              <DialogTitle>Редактировать изображение</DialogTitle>
              <DialogDescription className="text-zinc-400">
                Выберите область, которая будет установлена для {imageCropTarget === "avatar" ? "аватара" : "баннера"}.
              </DialogDescription>
            </DialogHeader>
            {imageCropSource ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                  {imageCropTarget === "avatar" ? (
                    <div
                      className="relative mx-auto h-[320px] w-[320px] overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-950"
                      onPointerDown={startImageCropDrag}
                      onPointerMove={moveImageCropDrag}
                      onPointerUp={endImageCropDrag}
                      onPointerCancel={endImageCropDrag}
                      onWheel={onImageCropWheel}
                    >
                      <img
                        src={imageCropSource}
                        alt="crop-bg"
                        draggable={false}
                        className="absolute left-1/2 top-1/2 max-w-none select-none pointer-events-none"
                        style={{
                          transform: `translate(calc(-50% + ${imageCropOffsetX}px), calc(-50% + ${imageCropOffsetY}px)) scaleX(${imageCropFlipX ? -1 : 1})`,
                          transformOrigin: "center center",
                          width: `${imageCropDisplayWidth}px`,
                          height: `${imageCropDisplayHeight}px`,
                        }}
                      />
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <div className="h-[280px] w-[280px] rounded-full border border-zinc-200/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.42)]" />
                      </div>
                      <img
                        src={imageCropSource}
                        alt="crop-active"
                        draggable={false}
                        className="absolute left-1/2 top-1/2 max-w-none select-none pointer-events-none opacity-0"
                        style={{
                          transform: `translate(calc(-50% + ${imageCropOffsetX}px), calc(-50% + ${imageCropOffsetY}px)) scaleX(${imageCropFlipX ? -1 : 1})`,
                          transformOrigin: "center center",
                          width: `${imageCropDisplayWidth}px`,
                          height: `${imageCropDisplayHeight}px`,
                        }}
                      />
                    </div>
                  ) : (
                    <div
                      className="relative mx-auto h-[280px] w-full overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950"
                      onPointerDown={startImageCropDrag}
                      onPointerMove={moveImageCropDrag}
                      onPointerUp={endImageCropDrag}
                      onPointerCancel={endImageCropDrag}
                      onWheel={onImageCropWheel}
                    >
                      <img
                        src={imageCropSource}
                        alt="crop-bg"
                        draggable={false}
                        className="absolute left-1/2 top-1/2 max-w-none select-none pointer-events-none"
                        style={{
                          transform: `translate(calc(-50% + ${imageCropOffsetX}px), calc(-50% + ${imageCropOffsetY}px)) scaleX(${imageCropFlipX ? -1 : 1})`,
                          transformOrigin: "center center",
                          width: `${imageCropDisplayWidth}px`,
                          height: `${imageCropDisplayHeight}px`,
                        }}
                      />
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <div className="relative h-[270px] w-[960px] max-w-[96%] overflow-hidden rounded-xl border border-zinc-500/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.42)]">
                          <img
                            src={imageCropSource}
                            alt="crop-active"
                            draggable={false}
                            className="absolute left-1/2 top-1/2 max-w-none select-none"
                            style={{
                              transform: `translate(calc(-50% + ${imageCropOffsetX}px), calc(-50% + ${imageCropOffsetY}px)) scaleX(${imageCropFlipX ? -1 : 1})`,
                              transformOrigin: "center center",
                              width: `${imageCropDisplayWidth}px`,
                              height: `${imageCropDisplayHeight}px`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs text-zinc-400">Масштаб</label>
                    <Input
                      type="range"
                      min={1}
                      max={3}
                      step={0.01}
                      value={imageCropZoom}
                      onChange={(e) => setImageCropZoom(Number(e.target.value))}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-zinc-400">Действия</label>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-100 gap-2"
                        onClick={() => setImageCropFlipX((prev) => !prev)}
                      >
                        <FlipHorizontal className="h-4 w-4" />
                        Перевернуть
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-100"
                    onClick={resetImageCrop}
                  >
                    Сброс
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-100"
                      onClick={() => setImageCropDialogOpen(false)}
                    >
                      Отмена
                    </Button>
                    <Button
                      type="button"
                      className="rounded-xl bg-red-600 text-white hover:bg-red-500 border-0"
                      onClick={() => void applyImageCrop()}
                      disabled={imageCropLoading}
                    >
                      {imageCropLoading ? "Сохраняем..." : "Применить"}
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
        {renderPublicProfileDialog()}
        <ScreenTransitionLoader open={screenTransitionLoading} />
      </motion.div>
    );
  }

  if (screen === "home") {
    return (
      <motion.div
        key="home"
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className="relative isolate h-screen bg-[#0b0b0f] text-zinc-100 p-4 sm:p-6 md:p-10 overflow-x-hidden overflow-y-scroll [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        <CourtAtmosphereBackground />
        <AnimatePresence>
          {kickedAlert && (
            <motion.div
              key="kicked"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="max-w-6xl mx-auto mb-4 bg-red-600/20 border border-red-600/40 text-red-300 rounded-xl px-4 py-3 text-sm"
            >
              {kickedAlert}
            </motion.div>
          )}
          {rankResultToast && (
            <motion.div
              key={`rank-overlay-${rankResultToast.fromTitle}-${rankResultToast.toTitle}-${rankResultToast.delta}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[220] flex items-center justify-center bg-black/75 backdrop-blur-[3px] p-4"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.88, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 14 }}
                transition={{ type: "spring", stiffness: 190, damping: 17 }}
                className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-red-500/45 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 p-6 sm:p-7 shadow-[0_30px_100px_rgba(0,0,0,0.75)]"
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.08),transparent_58%),radial-gradient(circle_at_70%_18%,rgba(113,113,122,0.12),transparent_52%)]"
                />
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                      Итоги матча
                    </div>
                    <div className="mt-1 text-3xl sm:text-4xl font-extrabold text-zinc-100 flex items-center gap-2">
                      <Sparkles className="w-6 h-6 text-red-400 drop-shadow-[0_0_10px_rgba(248,113,113,0.6)]" />
                      Прогресс ранга
                    </div>
                  </div>
                  <div
                    className={`rounded-full border px-3 py-1 text-xs font-semibold shadow-[0_0_20px_rgba(248,113,113,0.22)] ${
                      rankResultToast.rankUp
                        ? "border-red-400/45 bg-red-500/15 text-red-200"
                        : "border-zinc-500/45 bg-zinc-700/30 text-zinc-200"
                    }`}
                  >
                    {rankResultToast.rankUp ? "Ранг повышен" : "Прогресс обновлён"}
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-4">
                  <div className="flex items-center justify-between gap-3 text-sm mb-3">
                    <span
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${getBadgeTheme(rankKeyToBadgeVisualKey(rankResultToast.fromKey)).chip}`}
                    >
                      <BadgeGlyph
                        badgeKey={rankKeyToBadgeVisualKey(rankResultToast.fromKey)}
                        className={`h-3.5 w-3.5 ${getBadgeTheme(rankKeyToBadgeVisualKey(rankResultToast.fromKey)).iconOnly ?? "text-zinc-300"}`}
                      />
                      {rankResultToast.fromTitle}
                    </span>
                    <span className="text-zinc-500">→</span>
                    <motion.span
                      animate={
                        rankResultToast.rankUp
                          ? {
                              scale: [1, 1.045, 1],
                              boxShadow: [
                                "0 0 10px rgba(244,244,245,0.14)",
                                "0 0 20px rgba(244,244,245,0.28)",
                                "0 0 10px rgba(244,244,245,0.14)",
                              ],
                            }
                          : undefined
                      }
                      transition={
                        rankResultToast.rankUp
                          ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" }
                          : undefined
                      }
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${getBadgeTheme(rankKeyToBadgeVisualKey(rankResultToast.toKey)).chip}`}
                    >
                      <BadgeGlyph
                        badgeKey={rankKeyToBadgeVisualKey(rankResultToast.toKey)}
                        className={`h-3.5 w-3.5 ${getBadgeTheme(rankKeyToBadgeVisualKey(rankResultToast.toKey)).iconOnly ?? "text-zinc-300"}`}
                      />
                      {rankResultToast.toTitle}
                    </motion.span>
                  </div>
                  <div className="relative h-4 rounded-full bg-zinc-800 overflow-hidden border border-zinc-700">
                    <motion.div
                      initial={{ width: `${rankResultToast.fromProgressPercent}%` }}
                      animate={{ width: `${rankResultToast.toProgressPercent}%` }}
                      transition={{ duration: 2.2, ease: [0.22, 1, 0.36, 1] }}
                      className="relative h-full rounded-full"
                      style={{
                        backgroundImage:
                          rankResultToast.delta >= 0
                            ? rankResultToast.progressGradient
                            : "linear-gradient(90deg, #52525b 0%, #71717a 100%)",
                        boxShadow:
                          rankResultToast.delta >= 0
                            ? `0 0 12px ${rankResultToast.progressGlow}`
                            : "0 0 10px rgba(113,113,122,0.28)",
                      }}
                    >
                      {rankResultToast.delta >= 0 && (
                        <>
                          <motion.span
                            aria-hidden
                            className="absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/24 to-transparent"
                            animate={{ x: ["-120%", "240%"] }}
                            transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}
                          />
                          <motion.span
                            aria-hidden
                            className="absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent to-transparent"
                            style={{
                              backgroundImage: `linear-gradient(90deg, transparent 0%, ${rankResultToast.progressShimmer} 50%, transparent 100%)`,
                            }}
                            animate={{ x: ["-120%", "240%"] }}
                            transition={{ duration: 2.2, repeat: Infinity, ease: "linear", delay: 1.1 }}
                          />
                        </>
                      )}
                    </motion.div>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs sm:text-sm">
                    <span className="text-zinc-400">
                      {rankResultToast.remainingToNext === null
                        ? "Максимальный ранг достигнут"
                        : `До следующего ранга: ${rankResultToast.remainingToNext} очк.`}
                    </span>
                    <span
                      className="font-semibold text-zinc-100"
                    >
                      {rankResultToast.delta >= 0
                        ? `+${rankResultToast.delta} очк. рейтинга`
                        : `${rankResultToast.delta} очк. рейтинга`}
                    </span>
                  </div>
                  {rankResultToast.rankUp && rankResultToast.toProgressPercent >= 100 ? (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5, duration: 0.35 }}
                      className={`mt-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${getBadgeTheme(rankKeyToBadgeVisualKey(rankResultToast.toKey)).chip}`}
                    >
                      <Sparkles className="h-3.5 w-3.5 text-zinc-100" />
                      Получен новый ранг
                    </motion.div>
                  ) : null}
                </div>

                <div className="mt-5 flex justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setRankResultToast(null)}
                    className="border-zinc-700 text-zinc-100 hover:bg-zinc-800"
                  >
                    Закрыть
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="max-w-6xl mx-auto mb-8 flex justify-center">
          <div className="relative w-full sm:w-auto min-w-0">
            <div className="w-full sm:w-auto rounded-[28px] border border-zinc-800 bg-zinc-900/90 p-1.5 shadow-sm shadow-black/30">
              <div className="sm:flex sm:items-center sm:gap-1">
                <div className="grid grid-cols-3 gap-1.5 sm:flex sm:items-center sm:gap-1">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setHomeTab("play");
                      setProfileMenuOpen(false);
                    }}
                    className={`h-10 rounded-full px-2 sm:px-4 gap-1.5 sm:gap-2 text-[13px] sm:text-sm transition-all duration-200 hover:-translate-y-0.5 ${
                      homeTab === "play"
                        ? "bg-red-600 text-white hover:bg-red-500"
                        : "text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800"
                    }`}
                  >
                    <Gamepad2 className="w-4 h-4" />
                    Играть
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setHomeTab("development");
                      setProfileMenuOpen(false);
                    }}
                    className={`h-10 rounded-full px-2 sm:px-4 gap-1.5 sm:gap-2 text-[13px] sm:text-sm transition-all duration-200 hover:-translate-y-0.5 ${
                      homeTab === "development"
                        ? "bg-red-600 text-white hover:bg-red-500"
                        : "text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800"
                    }`}
                  >
                    <Wrench className="w-4 h-4" />
                    Разработка
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setHomeTab("help");
                      setProfileMenuOpen(false);
                    }}
                    className={`h-10 rounded-full px-2 sm:px-4 gap-1.5 sm:gap-2 text-[13px] sm:text-sm transition-all duration-200 hover:-translate-y-0.5 ${
                      homeTab === "help"
                        ? "bg-red-600 text-white hover:bg-red-500"
                        : "text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800"
                    }`}
                  >
                    <CircleHelp className="w-4 h-4" />
                    Помощь
                  </Button>
                </div>

                <div className="mt-1.5 border-t border-zinc-800/80 pt-1.5 sm:mt-0 sm:pt-0 sm:border-t-0 sm:ml-1 sm:pl-2 sm:border-l sm:border-zinc-700/80">
                  {isAuthenticated ? (
                    <Button
                      variant="outline"
                      onClick={() => setProfileMenuOpen((prev) => !prev)}
                      className="h-10 w-full sm:w-auto rounded-full border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-100 pl-1 pr-3 gap-2.5 justify-start transition-all duration-200 hover:-translate-y-0.5"
                    >
                      <Avatar src={avatar} name={playerName || "Игрок"} size={32} />
                      <span className="max-w-[130px] truncate text-sm">{playerName || "Игрок"}</span>
                      <ChevronDown className="w-4 h-4 text-zinc-400" />
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setAuthMode("login");
                        setAuthView("form");
                        setAuthDialogOpen(true);
                      }}
                      className="h-10 w-full sm:w-[124px] rounded-full border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-100 px-4 gap-2 inline-flex items-center justify-center transition-all duration-200 hover:-translate-y-0.5"
                    >
                      <LogIn className="w-4 h-4" />
                      Войти
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <AnimatePresence>
              {isAuthenticated && profileMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.96 }}
                  className="absolute right-0 top-full mt-2 w-56 rounded-2xl border border-zinc-800 bg-zinc-900/95 shadow-2xl shadow-black/50 p-2 z-30"
                >
                  <button
                    type="button"
                    onClick={openProfileScreen}
                    className="w-full rounded-xl px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-800 flex items-center gap-2"
                  >
                    <UserCircle2 className="w-4 h-4" />
                    Открыть профиль
                  </button>
                  <button
                    type="button"
                    onClick={logoutAccount}
                    className="w-full rounded-xl px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-800 flex items-center gap-2"
                  >
                    <DoorOpen className="w-4 h-4" />
                    Выйти из аккаунта
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <Dialog
              open={authDialogOpen}
              onOpenChange={(open) => {
                setAuthDialogOpen(open);
                if (!open) {
                  setAuthError("");
                  setAuthView("form");
                }
              }}
            >
              <DialogContent className="max-w-md border-zinc-800 bg-zinc-950 text-zinc-100">
                {authView === "rules" ? (
                  <>
                    <DialogHeader>
                      <DialogTitle>Правила сайта</DialogTitle>
                      <DialogDescription className="text-zinc-400">
                        Ознакомьтесь с правилами перед регистрацией.
                      </DialogDescription>
                    </DialogHeader>
                    <div className={`space-y-2 max-h-[65vh] overflow-y-auto pr-1 ${HIDE_SCROLLBAR_CLASS}`}>
                      <p className="text-sm text-zinc-400">{RULES_INTRO_TEXT}</p>
                      <ol className="list-decimal pl-5 space-y-2 text-sm text-zinc-300">
                        {SITE_RULES.map((rule) => (
                          <li key={rule}>{rule}</li>
                        ))}
                      </ol>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setAuthView("form")}
                      className="w-full h-11 rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-100"
                    >
                      Назад к регистрации
                    </Button>
                  </>
                ) : (
                  <>
                    <DialogHeader>
                      <DialogTitle>
                        {authMode === "login" ? "Вход в аккаунт" : "Регистрация"}
                      </DialogTitle>
                      <DialogDescription className="text-zinc-400">
                        {authMode === "login"
                          ? "Войдите, чтобы использовать личный профиль."
                          : "Создайте аккаунт. После регистрации откроется ваш профиль."}
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          variant={authMode === "login" ? "secondary" : "outline"}
                          onClick={() => {
                            setAuthMode("login");
                            setAuthError("");
                            setRegisterLoginError("");
                            setRegisterEmailError("");
                          }}
                          className={
                            authMode === "login"
                              ? "rounded-xl border border-zinc-600 bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
                              : "rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-100"
                          }
                        >
                          Вход
                        </Button>
                        <Button
                          type="button"
                          variant={authMode === "register" ? "secondary" : "outline"}
                          onClick={() => {
                            setAuthMode("register");
                            setAuthError("");
                            setRegisterLoginError("");
                            setRegisterEmailError("");
                          }}
                          className={
                            authMode === "register"
                              ? "rounded-xl border border-zinc-600 bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
                              : "rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-100"
                          }
                        >
                          Регистрация
                        </Button>
                      </div>

                      {authMode === "login" ? (
                        <div className="space-y-2">
                          <Input
                            value={loginOrEmail}
                            onChange={(e) => setLoginOrEmail(e.target.value)}
                            placeholder="Логин или почта"
                            className="h-11 rounded-xl border border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-red-500/40"
                          />
                          <div className="relative">
                            <Input
                              type={showLoginPassword ? "text" : "password"}
                              value={loginPassword}
                              onChange={(e) => setLoginPassword(e.target.value)}
                              placeholder="Пароль"
                              className="h-11 rounded-xl border border-zinc-700 bg-zinc-900 pr-11 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-red-500/40"
                              onKeyDown={(e) => e.key === "Enter" && submitLogin()}
                            />
                            <button
                              type="button"
                              onClick={() => setShowLoginPassword((prev) => !prev)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
                            >
                              {showLoginPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                          <Button
                            type="button"
                            onClick={submitLogin}
                            disabled={authLoading || !loginOrEmail.trim() || !loginPassword}
                            className="w-full h-11 rounded-xl bg-red-600 hover:bg-red-500 text-white border-0"
                          >
                            {authLoading ? "Входим..." : "Войти"}
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Input
                            value={registerLogin}
                            onChange={(e) => {
                              setRegisterLogin(e.target.value.slice(0, 20));
                              if (registerLoginError) setRegisterLoginError("");
                            }}
                            placeholder="Логин"
                            className="h-11 rounded-xl border border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-red-500/40"
                          />
                          {registerLoginError ? (
                            <div className="px-1 text-xs text-red-300">{registerLoginError}</div>
                          ) : null}
                          <Input
                            value={registerEmail}
                            onChange={(e) => {
                              setRegisterEmail(e.target.value);
                              if (registerEmailError) setRegisterEmailError("");
                            }}
                            placeholder="Почта"
                            className="h-11 rounded-xl border border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-red-500/40"
                          />
                          {registerEmailError ? (
                            <div className="px-1 text-xs text-red-300">{registerEmailError}</div>
                          ) : null}
                          <div className="relative">
                            <Input
                              type={showRegisterPassword ? "text" : "password"}
                              value={registerPassword}
                              onChange={(e) => setRegisterPassword(e.target.value)}
                              placeholder="Пароль"
                              className="h-11 rounded-xl border border-zinc-700 bg-zinc-900 pr-11 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-red-500/40"
                            />
                            <button
                              type="button"
                              onClick={() => setShowRegisterPassword((prev) => !prev)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
                            >
                              {showRegisterPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                          <div className="relative">
                            <Input
                              type={showRegisterConfirmPassword ? "text" : "password"}
                              value={registerConfirmPassword}
                              onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                              placeholder="Подтверждение пароля"
                              className="h-11 rounded-xl border border-zinc-700 bg-zinc-900 pr-11 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-red-500/40"
                              onKeyDown={(e) => e.key === "Enter" && submitRegister()}
                            />
                            <button
                              type="button"
                              onClick={() => setShowRegisterConfirmPassword((prev) => !prev)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
                            >
                              {showRegisterConfirmPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                          <label className="flex items-start gap-2 rounded-xl border border-zinc-800 bg-zinc-900/75 px-3 py-2 text-sm text-zinc-300">
                            <input
                              type="checkbox"
                              className="mt-1 accent-red-600"
                              checked={registerAcceptRules}
                              onChange={(e) => setRegisterAcceptRules(e.target.checked)}
                            />
                            <span>
                              Я ознакомлен с{" "}
                              <button
                                type="button"
                                className="text-red-300 underline underline-offset-2 hover:text-red-200"
                                onClick={() => setAuthView("rules")}
                              >
                                правилами сайта
                              </button>
                              .
                            </span>
                          </label>
                          <Button
                            type="button"
                            onClick={submitRegister}
                            disabled={
                              authLoading ||
                              !registerLogin.trim() ||
                              !registerEmail.trim() ||
                              !registerPassword ||
                              !registerConfirmPassword ||
                              !registerAcceptRules
                            }
                            className="w-full h-11 rounded-xl bg-red-600 hover:bg-red-500 text-white border-0"
                          >
                            {authLoading ? "Создаем..." : "Зарегистрироваться"}
                          </Button>
                        </div>
                      )}

                      {authError && (
                        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                          {authError}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {homeTab === "play" && (
          <div className="w-full max-w-6xl mx-auto space-y-6 min-w-0">
            <div className="mx-auto grid w-full max-w-md grid-cols-2 gap-2">
              <Button
                variant={playView === "quick" ? "secondary" : "outline"}
                onClick={() => setPlayView("quick")}
                className={
                  playView === "quick"
                    ? "w-full rounded-full bg-zinc-100 text-zinc-950 hover:bg-zinc-200 border-0 transition-all duration-200 hover:-translate-y-0.5"
                    : "w-full rounded-full border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-100 transition-all duration-200 hover:-translate-y-0.5"
                }
              >
                Быстрый вход
              </Button>
              <Button
                variant={playView === "matches" ? "secondary" : "outline"}
                onClick={() => {
                  setPlayView("matches");
                  socket.emit("list_public_matches");
                }}
                className={
                  playView === "matches"
                    ? "w-full rounded-full bg-zinc-100 text-zinc-950 hover:bg-zinc-200 border-0 gap-2 transition-all duration-200 hover:-translate-y-0.5"
                    : "w-full rounded-full border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-100 gap-2 transition-all duration-200 hover:-translate-y-0.5"
                }
              >
                <Globe className="w-4 h-4" />
                Подбор игроков
              </Button>
            </div>

            <AnimatePresence mode="wait">
              {playView === "quick" ? (
                <motion.div
                  key="play-quick"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-6 lg:gap-3 items-stretch w-full min-w-0 max-w-full lg:max-w-[1120px] mx-auto"
                >
                  <motion.div
                    custom={0}
                    variants={cardVariants}
                    initial="initial"
                    animate="animate"
                    className="min-w-0 lg:max-w-[540px] lg:justify-self-end"
                  >
                    <Card className="w-full min-w-0 rounded-[28px] shadow-sm border border-zinc-800 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 h-full text-zinc-100">
                      <CardContent className="p-6 sm:p-8 md:p-10 h-full flex flex-col justify-between gap-8">
                        <div className="space-y-5">
                          <Badge className="rounded-full px-3 py-1 text-sm bg-red-600/90 hover:bg-red-600 text-white border-0">
                            Made By Berly
                          </Badge>
                          <div className="space-y-3">
                            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">СУД</h1>
                            <p className="text-base md:text-lg text-zinc-400 max-w-xl">
                              Ролевая настольная игра о судебных разбирательствах. Получите роль,
                              изучите факты дела и попробуйте убедить судью в своей правоте.
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 auto-rows-fr gap-3 text-sm">
                          {[
                            { title: "3-6 игроков", sub: "Разные роли и режимы" },
                            { title: "Карты механик", sub: "Дают особые возможности" },
                            { title: "Улики", sub: "Объективные и общие" },
                            { title: "Факты", sub: "Раскрываются по ходу суда" },
                          ].map((item, i) => (
                            <motion.div
                              key={item.title}
                              custom={i + 1}
                              variants={cardVariants}
                              initial="initial"
                              animate="animate"
                              whileHover={{ y: -2 }}
                              whileTap={{ scale: 0.995 }}
                              className="h-full"
                            >
                              <Card className="h-full rounded-2xl bg-zinc-900/90 border-zinc-800 text-zinc-100">
                                <CardContent className="h-full p-4 space-y-1.5">
                                  <div className="font-semibold">{item.title}</div>
                                  <div className="text-zinc-400">{item.sub}</div>
                                </CardContent>
                              </Card>
                            </motion.div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>

                  <motion.div
                    custom={1}
                    variants={cardVariants}
                    initial="initial"
                    animate="animate"
                    className="min-w-0 lg:max-w-[620px] lg:justify-self-start"
                  >
                    <Card className="w-full min-w-0 rounded-[28px] shadow-sm h-full bg-gradient-to-br from-zinc-900/95 via-zinc-900/92 to-zinc-800/85 border-zinc-800 text-zinc-100">
                      <CardContent className="p-6 sm:p-8 md:p-10 space-y-6">
                        <AnimatePresence>
                          {error && (
                            <motion.div
                              key="err"
                              initial={{ opacity: 0, y: -8 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -8 }}
                              className="bg-red-600/20 border border-red-600/40 text-red-400 rounded-xl px-4 py-3 text-sm"
                            >
                              {error}
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <div className="grid gap-4">
                          <motion.div
                            initial={{ opacity: 0.85, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.32, ease: "easeOut" }}
                            className="rounded-2xl border border-zinc-700/90 bg-gradient-to-br from-zinc-900/85 via-zinc-900/74 to-zinc-800/62 px-4 py-5 sm:px-6 sm:py-6 space-y-4"
                          >
                            <motion.div className="px-1" whileHover={{ y: -1 }} whileTap={{ scale: 0.985 }}>
                              <Button
                                onClick={createQuickRoom}
                                className="w-full h-16 rounded-2xl text-4xl gap-2 bg-red-600 hover:bg-red-600 text-white border-0 text-[33px] font-bold tracking-tight shadow-[0_8px_28px_rgba(220,38,38,0.35)] transition-transform duration-200 hover:-translate-y-0.5"
                              >
                                Создать игру
                              </Button>
                            </motion.div>
                            <Separator className="bg-zinc-800" />
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="h-12 flex-1 min-w-0 rounded-xl border border-zinc-700 bg-zinc-900/80 px-3 flex items-center gap-2">
                                <span className="text-zinc-400 font-semibold">#</span>
                                <Input
                                  value={joinCode}
                                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                                  placeholder="Введите код"
                                  className="h-10 bg-transparent border-0 p-0 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-0 focus-visible:ring-offset-0"
                                  onKeyDown={(e) =>
                                    e.key === "Enter" && joinByCodeFromQuickInput()
                                  }
                                />
                              </div>
                              <Button
                                onClick={joinByCodeFromQuickInput}
                                disabled={!joinCode.trim()}
                                className="h-12 min-w-[100px] rounded-xl bg-zinc-100 text-zinc-950 hover:bg-zinc-200 border-0 text-lg transition-all duration-200 hover:-translate-y-0.5"
                              >
                                Войти
                              </Button>
                            </div>
                            <motion.a
                              href={DISCORD_INVITE_URL}
                              target="_blank"
                              rel="noopener noreferrer"
                              whileHover={{ y: -1 }}
                              whileTap={{ scale: 0.99 }}
                              className="block"
                            >
                              <div className="h-12 w-full rounded-xl border border-zinc-700/80 bg-zinc-900/70 px-4 flex items-center justify-center gap-2 text-zinc-100 hover:bg-zinc-800/90 transition-colors">
                                <svg
                                  viewBox="0 0 16 16"
                                  aria-hidden="true"
                                  className="h-5 w-5 shrink-0"
                                  fill="currentColor"
                                >
                                  <path d="M13.545 2.907A13.227 13.227 0 0 0 10.227 2c-.158.287-.34.666-.465.965a12.19 12.19 0 0 0-3.523 0A10.809 10.809 0 0 0 5.772 2a13.14 13.14 0 0 0-3.319.907C.353 6.057-.212 9.13.067 12.16c1.391 1.03 2.739 1.656 4.063 2.071.328-.447.62-.918.874-1.417a8.925 8.925 0 0 1-1.377-.662c.116-.084.23-.171.34-.26 2.651 1.257 5.523 1.257 8.142 0 .11.09.224.176.34.26-.439.257-.9.48-1.378.662.257.5.55.97.878 1.417 1.327-.415 2.676-1.04 4.066-2.071.327-3.513-.563-6.559-2.47-9.254ZM5.349 10.478c-.797 0-1.45-.732-1.45-1.632 0-.9.64-1.634 1.45-1.634.816 0 1.456.741 1.45 1.634 0 .9-.64 1.632-1.45 1.632Zm5.302 0c-.797 0-1.45-.732-1.45-1.632 0-.9.64-1.634 1.45-1.634.816 0 1.456.741 1.45 1.634 0 .9-.634 1.632-1.45 1.632Z" />
                                </svg>
                                <span className="font-semibold">Поиск игроков</span>
                              </div>
                            </motion.a>
                          </motion.div>

                          <AnimatePresence>
                            {hasSession && (reconnectPersistent || reconnectSecondsLeft > 0) && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.28 }}
                              >
                                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                                  <Button
                                    onClick={reconnect}
                                    variant="outline"
                                    className="w-full h-12 rounded-xl border-red-600/50 text-red-400 hover:bg-red-600/10 hover:text-red-300 gap-2"
                                  >
                                    {reconnectPersistent ? (
                                      "↩ Переподключиться к игре"
                                    ) : (
                                      <span className="inline-flex items-center gap-2">
                                        <motion.span
                                          animate={{ opacity: [0.7, 1, 0.7] }}
                                          transition={{ duration: 1.15, repeat: Infinity, ease: "easeInOut" }}
                                          className="inline-flex"
                                        >
                                          <DoorOpen className="h-4 w-4" />
                                        </motion.span>
                                        <span>{`↩ Переподключиться к игре (${reconnectSecondsLeft}s)`}</span>
                                      </span>
                                    )}
                                  </Button>
                                </motion.div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        <Separator className="bg-zinc-800" />

                        <div className="space-y-3">
                          <div className="font-semibold">Функционал</div>
                          <div className="grid gap-2 text-sm text-zinc-400">
                            <div>• создайте комнату и поделитесь кодом с игроками</div>
                            <div>• выберите режим и фиксированный лимит участников</div>
                            <div>• приватные комнаты защищаются паролем</div>
                            <div>• в лобби доступен общий чат и управление этапами</div>
                          </div>
                        </div>

                      </CardContent>
                    </Card>
                  </motion.div>
                </motion.div>
              ) : (
                <motion.div
                  key="play-matches"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                >
                  <Card className="rounded-[28px] border-zinc-800 bg-zinc-900/95 text-zinc-100">
                    <CardContent className="p-6 md:p-8 space-y-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="space-y-1">
                          <h2 className="text-2xl font-semibold tracking-tight">Подбор игроков</h2>
                          <p className="text-sm text-zinc-400">
                            Выберите комнату для входа или создайте свою.
                          </p>
                        </div>
                        <div className="flex w-full sm:w-auto items-center">
                          <Button
                            onClick={() => setCreateMatchDialogOpen(true)}
                            className="w-full sm:w-auto h-14 rounded-xl bg-red-600 hover:bg-red-600 text-white border-0 gap-2 px-9 text-lg font-semibold transition-all duration-200 hover:-translate-y-0.5 shadow-[0_0_0_1px_rgba(239,68,68,0.5),0_10px_28px_rgba(220,38,38,0.35)] hover:shadow-[0_0_0_1px_rgba(248,113,113,0.7),0_16px_36px_rgba(220,38,38,0.45)]"
                          >
                            <UserPlus className="w-4 h-4" />
                            Создать матч
                          </Button>
                        </div>
                      </div>

                      <AnimatePresence>
                        {error && (
                          <motion.div
                            key="matches-err"
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className="bg-red-600/20 border border-red-600/40 text-red-400 rounded-xl px-4 py-3 text-sm"
                          >
                            {error}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <div className="space-y-3">
                        {publicMatches.length === 0 && (
                          <div className="text-sm text-zinc-500">
                            Сейчас нет доступных комнат.
                          </div>
                        )}
                        {publicMatches.map((match) => {
                          const modeMeta = getRoomModeMeta(match.modeKey, match.maxPlayers);
                          const roomTitle = match.roomName?.trim() || `Комната ${match.hostName}`;
                          const hasLock = match.requiresPassword;
                          const showLockBadge = hasLock || match.visibility === "private";
                          const roomTypeLabel =
                            match.visibility === "private" ? "Приватная" : "Публичная";
                          const statusLabel = match.started
                            ? "Матч уже идёт"
                            : "Лобби набирает игроков";
                          return (
                            <motion.div
                              key={match.code}
                              layout
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              whileHover={{ y: -2 }}
                              className="rounded-2xl border border-zinc-800 bg-zinc-950/70 px-4 py-4 md:px-5"
                            >
                              <div className="flex flex-col gap-4 md:gap-5 lg:flex-row lg:items-center lg:justify-between">
                                <div className="min-w-0 space-y-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="text-base font-semibold text-zinc-100 truncate">
                                      {roomTitle}
                                    </h3>
                                    <Badge className="bg-zinc-800 text-zinc-100 border border-zinc-700">
                                      {match.playerCount}/{match.maxPlayers}
                                    </Badge>
                                    <Badge className="bg-zinc-800 text-zinc-200 border border-zinc-700">
                                      {roomTypeLabel}
                                    </Badge>
                                    {showLockBadge && (
                                      <Badge className="bg-zinc-800 text-zinc-100 border border-zinc-700 gap-1">
                                        <Lock className="w-3.5 h-3.5" />
                                        {hasLock ? "С паролем" : "Закрытая"}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-400">
                                    <span>Хост: {match.hostName}</span>
                                    <span>{statusLabel}</span>
                                    <span className="text-zinc-300">
                                      Режим: {modeMeta.title}
                                    </span>
                                    {match.currentStage && (
                                      <span className="text-zinc-300">
                                        Этап: {match.currentStage}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 w-full lg:w-auto">
                                  <Button
                                    className="h-11 w-full lg:w-auto lg:min-w-[128px] rounded-xl bg-zinc-100 text-zinc-950 hover:bg-zinc-200 border-0 text-base font-semibold"
                                    onClick={() => joinPublicMatch(match)}
                                  >
                                    Войти
                                  </Button>
                                  {match.venueUrl && (
                                    <Button
                                      variant="outline"
                                      className="h-11 rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-100"
                                      onClick={() => openVoiceLink(match.venueUrl)}
                                    >
                                      Войс
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            <Dialog
              open={createMatchDialogOpen}
              onOpenChange={(open) => {
                setCreateMatchDialogOpen(open);
                if (!open) {
                  setCreateRoomPasswordVisible(false);
                }
              }}
            >
              <DialogContent
                className={`w-[calc(100vw-1rem)] sm:w-[calc(100vw-2rem)] max-w-2xl max-h-[88vh] overflow-y-auto border-zinc-800 bg-zinc-950 text-zinc-100 p-4 sm:p-6 ${HIDE_SCROLLBAR_CLASS} [&>button]:h-12 [&>button]:w-12 [&>button>svg]:h-7 [&>button>svg]:w-7 [&>button]:top-2 [&>button]:right-2`}
              >
                <DialogHeader className="space-y-1">
                  <DialogTitle>Создать матч</DialogTitle>
                  <DialogDescription className="text-zinc-400">
                    Настройте комнату для раздела «Подбор игроков».
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-5">
                  <div className="rounded-2xl border border-zinc-800 bg-gradient-to-r from-zinc-900 via-zinc-900/80 to-zinc-900 px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.12em] text-zinc-400">
                      Выбранный режим
                    </div>
                    <div className="mt-1 text-sm font-semibold text-zinc-100">
                      {selectedCreateMode.title}
                    </div>
                    <div className="mt-1 text-xs text-zinc-400">
                      На {selectedCreateMode.maxPlayers} игроков
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-sm text-zinc-300">Название комнаты</label>
                      <Input
                        value={createRoomName}
                        onChange={(e) => setCreateRoomName(e.target.value)}
                        placeholder="Например: Вечерний суд #1"
                        className="h-11 rounded-xl bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-sm text-zinc-300">Ссылка на войс (опционально)</label>
                      <Input
                        value={createVoiceUrl}
                        onChange={(e) => setCreateVoiceUrl(e.target.value)}
                        placeholder="https://discord.gg/... или другая ссылка"
                        className="h-11 rounded-xl bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-sm text-zinc-300">Режим матча</label>
                      <div className="grid gap-2 md:grid-cols-2">
                        {ROOM_MODE_OPTIONS.map((mode) => (
                          <button
                            key={mode.key}
                            type="button"
                            onClick={() => setCreateRoomMode(mode.key)}
                            className={`text-left rounded-xl border px-3 py-3 transition-colors ${
                              createRoomMode === mode.key
                                ? "border-red-500/70 bg-red-600/15"
                                : "border-zinc-700 bg-zinc-900 hover:bg-zinc-800"
                            }`}
                          >
                            <div className="text-sm font-semibold text-zinc-100">
                              {mode.title}
                            </div>
                            <div className="text-xs text-zinc-400 mt-1">
                              {mode.subtitle}
                            </div>
                            <div className="text-xs text-zinc-500 mt-2">
                              На {mode.maxPlayers} игроков
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="md:col-span-2 rounded-xl border border-zinc-800 bg-zinc-900/70 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium text-zinc-100">
                            Приватная комната
                          </div>
                          <div className="text-xs text-zinc-500">
                            В приватную комнату можно зайти только по коду и паролю.
                          </div>
                        </div>
                        <Switch
                          checked={createRoomPrivate}
                          onCheckedChange={(checked) => {
                            setCreateRoomPrivate(checked);
                            if (!checked) {
                              setCreateRoomPassword("");
                              setCreateRoomPasswordVisible(false);
                            }
                          }}
                        />
                      </div>
                    </div>
                    {createRoomPrivate && (
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-sm text-zinc-300">Пароль комнаты</label>
                        <div className="relative">
                          <Input
                            value={createRoomPassword}
                            type={createRoomPasswordVisible ? "text" : "password"}
                            onChange={(e) => setCreateRoomPassword(e.target.value)}
                            placeholder="Введите пароль для входа"
                            className="h-11 rounded-xl bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 pr-11"
                          />
                          <button
                            type="button"
                            onClick={() => setCreateRoomPasswordVisible((prev) => !prev)}
                            className="absolute inset-y-0 right-0 w-11 inline-flex items-center justify-center text-zinc-400 hover:text-zinc-200"
                          >
                            {createRoomPasswordVisible ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  <Button
                    onClick={() => {
                      const created = createRoomFromPanel();
                      if (!created) return;
                      setCreateMatchDialogOpen(false);
                      setCreateRoomName("");
                      setCreateVoiceUrl("");
                      setCreateRoomPassword("");
                      setCreateRoomPrivate(false);
                      setCreateRoomPasswordVisible(false);
                      setCreateRoomMode("civil_3");
                    }}
                    className="w-full h-11 rounded-xl bg-red-600 hover:bg-red-500 text-white border-0 gap-2"
                  >
                    <UserPlus className="w-4 h-4" />
                    Создать комнату
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog
              open={joinPasswordDialogOpen}
              onOpenChange={(open) => {
                setJoinPasswordDialogOpen(open);
                if (!open) {
                  setJoinPasswordDialogMatch(null);
                  setJoinPasswordInput("");
                  setJoinPasswordDialogError("");
                  setJoinPasswordVisible(false);
                }
              }}
            >
              <DialogContent className="max-w-md border-zinc-800 bg-zinc-950 text-zinc-100">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    Вход в закрытую комнату
                  </DialogTitle>
                  <DialogDescription className="text-zinc-400">
                    {joinPasswordDialogMatch
                      ? `Введите пароль для комнаты ${joinPasswordDialogMatch.code}.`
                      : "Введите пароль комнаты."}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="relative">
                    <Input
                      type={joinPasswordVisible ? "text" : "password"}
                      value={joinPasswordInput}
                      onChange={(e) => {
                        setJoinPasswordInput(e.target.value);
                        if (joinPasswordDialogError) {
                          setJoinPasswordDialogError("");
                        }
                      }}
                      onKeyDown={(e) => e.key === "Enter" && joinPublicMatchWithPassword()}
                      placeholder="Пароль комнаты"
                      className="h-11 rounded-xl bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 pr-11"
                    />
                    <button
                      type="button"
                      onClick={() => setJoinPasswordVisible((prev) => !prev)}
                      className="absolute inset-y-0 right-0 w-11 inline-flex items-center justify-center text-zinc-400 hover:text-zinc-200"
                    >
                      {joinPasswordVisible ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {joinPasswordDialogError && (
                    <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                      {joinPasswordDialogError}
                    </div>
                  )}
                  <Button
                    onClick={joinPublicMatchWithPassword}
                    className="w-full h-11 rounded-xl bg-zinc-100 text-zinc-950 hover:bg-zinc-200 border-0"
                  >
                    Войти
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
        {homeTab === "development" && (
          <div className="max-w-6xl mx-auto">
            <Card className="rounded-[28px] border-zinc-800 bg-zinc-900/95 text-zinc-100">
              <CardContent className="relative p-8 md:p-10 space-y-6">
                <motion.a
                  href={DISCORD_INVITE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.99 }}
                  className="absolute right-8 top-8 md:right-10 md:top-10 z-10"
                >
                  <Button
                    variant="outline"
                    className="h-10 rounded-xl border-red-500/35 bg-red-950/20 text-red-100 hover:bg-red-900/30 hover:text-white gap-2 px-4"
                  >
                    <AlertCircle className="w-4 h-4" />
                    <span>Сообщить о баге</span>
                  </Button>
                </motion.a>
                <div className="flex justify-center">
                  <div className="w-full max-w-md rounded-3xl border border-red-500/35 bg-gradient-to-br from-red-950/50 via-zinc-900 to-zinc-900 px-6 py-5 text-center shadow-[0_16px_40px_rgba(185,28,28,0.25)]">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-red-300/80">
                      Build
                    </div>
                    <div className="mt-2 text-3xl md:text-4xl font-semibold text-red-100">
                      {CURRENT_VERSION}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {visibleDevlogEntries.map((entry, index) => (
                    <motion.div
                      key={`${entry.date}-${entry.title}`}
                      custom={(currentDevlogPage - 1) * DEVLOG_PAGE_SIZE + index}
                      variants={cardVariants}
                      initial="initial"
                      animate="animate"
                    >
                      <Card className="rounded-2xl border-zinc-800 bg-zinc-900 text-zinc-100">
                        <CardContent className="p-5 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="font-semibold">{entry.title}</div>
                            <Badge className="bg-zinc-800 text-zinc-100 border border-zinc-700">
                              {entry.date}
                            </Badge>
                          </div>
                          <div className="text-sm text-zinc-400">
                            Версия: {entry.version}
                          </div>
                          <div className="space-y-2 text-sm text-zinc-300">
                            {entry.changes.map((change) => (
                              <div key={change}>• {change}</div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
                <div className="pt-2 flex items-center justify-center gap-3">
                  <Button
                    variant="outline"
                    className="rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-40"
                    onClick={() => setDevlogPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentDevlogPage <= 1}
                  >
                    ← Пред.
                  </Button>
                  <div className="text-sm text-zinc-400 min-w-[120px] text-center">
                    Страница {currentDevlogPage} из {devlogTotalPages}
                  </div>
                  <Button
                    variant="outline"
                    className="rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-40"
                    onClick={() =>
                      setDevlogPage((prev) => Math.min(devlogTotalPages, prev + 1))
                    }
                    disabled={currentDevlogPage >= devlogTotalPages}
                  >
                    След. →
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {homeTab === "help" && (
          <div className="max-w-6xl mx-auto">
            <Card className="rounded-[28px] border-zinc-800 bg-zinc-900/95 text-zinc-100">
              <CardContent className="p-8 md:p-10">
                <HelpCenter
                  query={mainHelpQuery}
                  onQueryChange={setMainHelpQuery}
                />
              </CardContent>
            </Card>
          </div>
        )}
        {renderPublicProfileDialog()}
        <ScreenTransitionLoader open={screenTransitionLoading} />
      </motion.div>
    );
  }

  if (screen === "room" && room) {
    const roomModeMeta = getRoomModeMeta(room.modeKey, room.maxPlayers ?? 6);
    const roomMaxPlayers = room.maxPlayers ?? roomModeMeta.maxPlayers;
    const isQuickRoomMode = room.modeKey === "quick_flex";
    const canStartRoomNow = isQuickRoomMode
      ? room.players.length >= 3 && room.players.length <= roomMaxPlayers
      : room.players.length === roomMaxPlayers;
    const neededPlayersForStart = isQuickRoomMode
      ? Math.max(0, 3 - room.players.length)
      : Math.max(0, roomMaxPlayers - room.players.length);
    return (
      <motion.div
        key="room"
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className="relative isolate min-h-screen bg-[#0b0b0f] text-zinc-100 p-4 sm:p-6 md:p-10"
      >
        <CourtAtmosphereBackground />
        <div className="max-w-6xl mx-auto space-y-6">
          <AnimatePresence>
            {error && (
              <motion.div
                key="err"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="bg-red-600/20 border border-red-600/40 text-red-400 rounded-xl px-4 py-3 text-sm"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div
            custom={0}
            variants={cardVariants}
            initial="initial"
            animate="animate"
          >
            <Card className="rounded-[28px] shadow-sm bg-zinc-900/95 border-zinc-800 text-zinc-100">
              <CardContent className="p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-zinc-400">
                    <Scale className="w-4 h-4" />
                    Код комнаты
                  </div>
                  {room.roomName && (
                    <div className="text-base font-semibold text-zinc-100">
                      {room.roomName}
                    </div>
                  )}
                  <div className="text-3xl font-bold tracking-[0.25em] text-red-400">
                    {room.code}
                  </div>
                  <div className="text-sm text-zinc-400">
                    Поделитесь кодом с другими игроками •{" "}
                    {isQuickRoomMode ? "3–6 участников" : `${roomMaxPlayers} участников`}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge className="bg-zinc-800 text-zinc-100 border border-zinc-700">
                      {roomModeMeta.title}
                    </Badge>
                    <Badge className="bg-zinc-800 text-zinc-100 border border-zinc-700">
                      {room.visibility === "private" ? "Приватная" : "Публичная"}
                    </Badge>
                    {room.requiresPassword && (
                      <Badge className="bg-zinc-800 text-zinc-100 border border-zinc-700">
                        С паролем
                      </Badge>
                    )}
                    {room.venueUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 rounded-lg border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 hover:text-zinc-100 gap-1"
                        onClick={() => openVoiceLink(room.venueUrl)}
                      >
                        Войс
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="secondary"
                    className="rounded-xl gap-2 bg-zinc-100 text-zinc-950 hover:bg-zinc-200 border-0"
                    onClick={() => copyCode(room.code)}
                  >
                    <Copy className="w-4 h-4" />
                    {copiedRoomCode ? "Скопировано" : "Скопировать"}
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-100"
                    onClick={returnHomeWithSession}
                  >
                    Выйти
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-6">
            <motion.div
              custom={1}
              variants={cardVariants}
              initial="initial"
              animate="animate"
            >
              <InfoBlock
                title="Игроки в комнате"
                icon={<UserPlus className="w-5 h-5" />}
                action={myId === room.hostId ? (
                  <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl border border-zinc-700 bg-zinc-800/70">
                    <label htmlFor="host-judge" className="text-base font-semibold text-zinc-200 cursor-pointer select-none">
                      Я - Судья
                    </label>
                    <Switch
                      id="host-judge"
                      checked={isHostJudge}
                      onCheckedChange={toggleHostJudge}
                      className="scale-110"
                    />
                  </div>
                ) : undefined}
              >
                <div className="relative flex min-h-[460px] lg:min-h-[660px] flex-col pb-12">
                  <div className="grid gap-3">
                    <AnimatePresence>
                      {room.players.map((player) => (
                        <PlayerCard
                          key={player.id}
                          player={player}
                          isHost={player.id === room.hostId}
                          canKick={myId === room.hostId && player.id !== room.hostId}
                          onKick={() => kickPlayerFromRoom(player.id)}
                          onOpenProfile={openUserProfile}
                          nowTs={nowMs}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                  {neededPlayersForStart > 0 && (
                    <div className="absolute inset-x-0 bottom-1 text-center text-sm text-zinc-500">
                      Ожидание игроков... (нужно ещё минимум {neededPlayersForStart})
                    </div>
                  )}
                </div>
              </InfoBlock>
            </motion.div>

            <motion.div
              custom={2}
              variants={cardVariants}
              initial="initial"
              animate="animate"
            >
              <div className="space-y-6">
                <InfoBlock
                  title="Доступные режимы"
                  icon={<Gavel className="w-5 h-5" />}
                >
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span>Игроков сейчас</span>
                      <Badge className="bg-zinc-800 text-zinc-100 border border-zinc-700">
                        {room.players.length}/{roomMaxPlayers}
                      </Badge>
                    </div>
                    <Separator />
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2">
                      <div className="text-xs uppercase tracking-[0.12em] text-zinc-500">
                        Выбранный режим
                      </div>
                      <div className="text-zinc-100 font-medium mt-1">
                        {roomModeMeta.title}
                      </div>
                      <div className="text-xs text-zinc-400 mt-1">{roomModeMeta.subtitle}</div>
                    </div>
                    <div className="text-zinc-400 pt-2">
                      Ведущий запускает игру, сайт случайно выбирает подходящее
                      дело и распределяет роли.
                    </div>
                    {myId === room.hostId && (
                      <Button
                        className="mt-3 h-10 rounded-xl gap-2 bg-red-600 hover:bg-red-500 text-white border-0 disabled:bg-zinc-800 disabled:text-zinc-500"
                        onClick={startGame}
                        disabled={
                          startGameLoading || !canStartRoomNow
                        }
                      >
                        <Play className="w-4 h-4" />
                        {startGameLoading ? "Запуск..." : "Запустить матч"}
                      </Button>
                    )}
                  </div>
                </InfoBlock>

                <InfoBlock
                  title="Чат лобби"
                  icon={<MessageSquare className="w-5 h-5" />}
                >
                  <div className="space-y-3">
                    <div
                      ref={lobbyChatScrollRef}
                      className={`rounded-2xl border border-zinc-800 bg-zinc-950/70 p-3 h-[360px] overflow-y-auto overflow-x-hidden ${HIDE_SCROLLBAR_CLASS}`}
                    >
                      <div className="space-y-2">
                        {lobbyChatMessages.length === 0 && (
                          <div className="text-sm text-zinc-500">
                            Сообщений пока нет.
                          </div>
                        )}
                        {lobbyChatMessages.map((message) => (
                          <div
                            key={message.id}
                            className="rounded-xl border border-zinc-800 bg-zinc-900/55 p-3"
                          >
                            <div className="flex items-start gap-3 min-w-0">
                              <Avatar
                                src={message.senderAvatar ?? null}
                                name={message.senderName}
                                size={30}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2 text-zinc-400 text-xs">
                                  <span className="text-sm font-semibold text-zinc-100">
                                    {message.senderName}
                                  </span>
                                  <span>•</span>
                                  <span>
                                    {new Date(message.createdAt).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </span>
                                </div>
                                <div className="mt-1 text-zinc-200 text-sm whitespace-pre-wrap break-all overflow-hidden">
                                  {message.text}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={lobbyChatInput}
                        onChange={(e) => setLobbyChatInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && sendLobbyChatMessage()}
                        placeholder="Сообщение в лобби..."
                        className="h-10 rounded-xl bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
                      />
                      <Button
                        onClick={sendLobbyChatMessage}
                        className="h-10 rounded-xl bg-zinc-100 text-zinc-950 hover:bg-zinc-200 border-0"
                        disabled={!lobbyChatInput.trim()}
                      >
                        Отправить
                      </Button>
                    </div>
                  </div>
                </InfoBlock>
              </div>
            </motion.div>
          </div>
          <ContextHelp
            open={contextHelpOpen}
            onOpenChange={setContextHelpOpen}
            query={contextHelpQuery}
            onQueryChange={setContextHelpQuery}
          />
        </div>
        {renderPublicProfileDialog()}
        <ScreenTransitionLoader open={screenTransitionLoading} />
      </motion.div>
    );
  }

  if (screen === "game" && game && game.me) {
    const gameStages =
      game.stages && game.stages.length > 0 ? game.stages : DEFAULT_GAME_STAGES;
    const currentStage = gameStages[game.stageIndex] ?? gameStages[0];
    const stageProgress = ((game.stageIndex + 1) / gameStages.length) * 100;
    const isHost = myId === game.hostId;
    const hasGameAdminAccess = gameControlPlayerId === game.hostId;
    const isJudge = game.me.roleKey === "judge";
    const isWitness = game.me.roleKey === "witness";
    const isObserverRole = isJudge || isWitness;
    const visibleFacts = game.revealedFacts.slice(-3);
    const visibleCards = game.usedCards.slice(-3);
    const latestRevealedFactId =
      game.revealedFacts.length > 0
        ? game.revealedFacts[game.revealedFacts.length - 1].id
        : null;
    const latestUsedCardId =
      game.usedCards.length > 0
        ? game.usedCards[game.usedCards.length - 1].id
        : null;
    const isPreparationStage = isPreparationStageName(currentStage);
    const isCrossExaminationStage = isCrossExaminationStageName(currentStage);
    const isVerdictStage = game.stageIndex >= gameStages.length - 1;
    const normalizedMyRoleKey = (game.me.roleKey ?? "").toLowerCase();
    const isLawyerRole =
      normalizedMyRoleKey.includes("lawyer") ||
      (game.me.roleTitle ?? "").toLowerCase().includes("адвокат");
    const lawyerChatButtonLabel = isLawyerRole
      ? "Чат с клиентом"
      : "Чат с адвокатом";
    const canRevealFactsAtCurrentStage = game.me.canRevealFactsNow === true;
    const hasActiveProtest = !!game.activeProtest;
    const verdictCloseAt =
      typeof game.verdictCloseAt === "number" ? game.verdictCloseAt : null;
    const verdictMsLeft =
      verdictCloseAt !== null ? Math.max(0, verdictCloseAt - nowMs) : 0;
    const verdictSecondsLeft =
      verdictCloseAt !== null
        ? Math.max(0, Math.ceil(verdictMsLeft / 1000))
        : 0;
    const verdictRingRadius = 24;
    const verdictRingLength = 2 * Math.PI * verdictRingRadius;
    const verdictRingProgress =
      verdictCloseAt !== null
        ? Math.min(1, Math.max(0, verdictMsLeft / VERDICT_CLOSE_COUNTDOWN_MS))
        : 0;
    const verdictRingOffset =
      verdictRingLength * (1 - verdictRingProgress);
    const canUseProtest =
      !isJudge &&
      !isWitness &&
      !game.finished &&
      !hasActiveProtest &&
      isCrossExaminationStage &&
      protestCooldownLeft <= 0;
    const matchExpiresAt =
      typeof game.matchExpiresAt === "number" ? game.matchExpiresAt : null;
    const matchMsLeft =
      matchExpiresAt !== null ? Math.max(0, matchExpiresAt - nowMs) : 0;
    const matchHoursLeft = Math.floor(matchMsLeft / (60 * 60 * 1000));
    const matchMinutesLeft = Math.floor((matchMsLeft % (60 * 60 * 1000)) / (60 * 1000));
    const matchSecondsLeft = Math.floor((matchMsLeft % (60 * 1000)) / 1000);
    const canUseJudgeSilence = isJudge && !game.finished && silenceCooldownLeft <= 0;
    const canUseJudgeWarning = isJudge && !game.finished;
    const isCardAnnouncement = influenceAnnouncement?.kind === "card";
    const announcementTitle = influenceAnnouncement?.title ?? "";
    const isProtestAcceptedAnnouncement =
      influenceAnnouncement?.kind === "protest" && /ПРИНЯТ/i.test(announcementTitle);
    const isProtestRejectedAnnouncement =
      influenceAnnouncement?.kind === "protest" && /ОТКЛОНЕН/i.test(announcementTitle);
    const warningTargets = game.players.filter(
      (player) => player.id !== game.me!.id && player.roleKey !== "judge",
    );
    return (
      <motion.div
        key="game"
        variants={pageVariants}
        initial="initial"
        animate="animate"
        className="relative isolate min-h-screen overflow-x-hidden bg-[#0b0b0f] text-zinc-100 p-4 sm:p-6 md:p-10"
      >
        <CourtAtmosphereBackground />
        <AnimatePresence>
          {showFactHistory && (
            <motion.div
              key="fact-history-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-zinc-950/90 backdrop-blur-sm flex items-center justify-center p-6"
              onClick={(e) =>
                e.target === e.currentTarget && setShowFactHistory(false)
              }
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.93, y: 24 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.93, y: 16 }}
                transition={{ type: "spring", stiffness: 240, damping: 24 }}
                className="w-full max-w-lg max-h-[80vh] flex flex-col"
              >
                <Card className="rounded-[28px] border-zinc-800 bg-zinc-900 text-zinc-100 flex flex-col overflow-hidden">
                  <CardHeader className="pb-3 flex-shrink-0">
                    <CardTitle className="flex items-center justify-between text-lg text-zinc-100">
                      <span className="flex items-center gap-2">
                        <Eye className="w-5 h-5" />
                        История фактов
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg h-8 w-8 p-0"
                        onClick={() => setShowFactHistory(false)}
                      >
                        ✕
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className={`overflow-y-auto flex-1 space-y-3 pb-6 ${HIDE_SCROLLBAR_CLASS}`}>
                    {game.revealedFacts.length === 0 ? (
                      <div className="text-sm text-zinc-400">
                        Пока никто не раскрыл ни одного факта.
                      </div>
                    ) : (
                      game.revealedFacts.map((fact, i) => {
                        const ownerPlayer = game.players.find(
                          (p) => p.id === fact.ownerId,
                        );
                        return (
                          <motion.div
                            key={fact.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.04 }}
                          >
                            <Card className="rounded-2xl border-dashed border-zinc-700 bg-zinc-800/60 text-zinc-100">
                              <CardContent className="p-4 min-h-[120px]">
                                <div className="flex items-center justify-between gap-3 mb-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <Avatar
                                      src={ownerPlayer?.avatar ?? null}
                                      name={fact.owner}
                                      size={34}
                                    />
                                    <div className="font-semibold text-base leading-none truncate">
                                      {fact.owner}
                                    </div>
                                  </div>
                                  <Badge className="bg-zinc-700 text-zinc-100 border border-zinc-600">
                                    {fact.ownerRole}
                                  </Badge>
                                </div>
                                <div className="min-h-[64px]">
                                  <div className="text-base text-zinc-300 leading-relaxed">
                                    {fact.text}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          </motion.div>
                        );
                      })
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
          )}

          {game.finished && (
            <motion.div
              key="verdict-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-zinc-950/95 backdrop-blur-sm flex items-center justify-center p-6"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.88, y: 32 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{
                  delay: 0.1,
                  type: "spring",
                  stiffness: 220,
                  damping: 22,
                }}
                className="w-full max-w-lg"
              >
                <Card className="rounded-[28px] border-zinc-800 bg-zinc-900 text-zinc-100">
                  <CardContent className="relative p-8 space-y-6 text-center">
                    {verdictCloseAt !== null && verdictSecondsLeft > 0 && (
                      <div className="absolute top-5 right-5 flex items-center justify-center">
                        <div className="relative h-14 w-14">
                          <svg
                            className="h-14 w-14 -rotate-90"
                            viewBox="0 0 56 56"
                            aria-hidden="true"
                          >
                            <circle
                              cx="28"
                              cy="28"
                              r={verdictRingRadius}
                              fill="none"
                              stroke="rgba(113, 113, 122, 0.45)"
                              strokeWidth="4"
                            />
                            <circle
                              cx="28"
                              cy="28"
                              r={verdictRingRadius}
                              fill="none"
                              stroke="#ef4444"
                              strokeWidth="4"
                              strokeLinecap="round"
                              strokeDasharray={verdictRingLength}
                              strokeDashoffset={verdictRingOffset}
                              className="transition-[stroke-dashoffset] duration-200 ease-linear"
                            />
                          </svg>
                          <div className="absolute inset-0 grid place-items-center text-sm font-semibold text-zinc-100">
                            {verdictSecondsLeft}
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="space-y-2">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.3, type: "spring" }}
                      >
                        <Badge className="rounded-full px-3 py-1 text-sm bg-red-600/90 text-white border-0">
                          Игра завершена
                        </Badge>
                      </motion.div>
                      <h1 className="text-3xl font-bold pt-2">Вердикт суда</h1>
                    </div>
                    <motion.div
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.25 }}
                      className="bg-zinc-800/60 rounded-2xl p-6 space-y-1"
                    >
                      <div className="text-sm text-zinc-400">Решение судьи</div>
                      <div className="text-2xl font-bold text-red-400">
                        {game.verdict}
                      </div>
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                      className="text-left space-y-3"
                    >
                      <div className="bg-zinc-800/40 rounded-2xl p-4">
                        <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">
                          Реальная правда дела
                        </div>
                        <div className="text-sm text-zinc-300">
                          {game.caseData.truth}
                        </div>
                      </div>
                      {game.verdictEvaluation && (
                        <div className="bg-red-600/10 border border-red-600/30 rounded-2xl p-4">
                          <div className="text-sm font-medium text-red-400">
                            {game.verdictEvaluation}
                          </div>
                        </div>
                      )}
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.55 }}
                    >
                      <Button
                        onClick={finalExit}
                        className="w-full h-12 rounded-xl text-base bg-zinc-100 text-zinc-950 hover:bg-zinc-200 border-0"
                      >
                        Выйти в главное меню
                      </Button>
                    </motion.div>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="max-w-7xl mx-auto space-y-6">
          <AnimatePresence>
            {error && (
              <motion.div
                key="err"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="bg-red-600/20 border border-red-600/40 text-red-400 rounded-xl px-4 py-3 text-sm"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {hasActiveProtest && (
              <motion.div
                key={`active-protest-${game.activeProtest!.id}`}
                initial={{ opacity: 0, scale: 0.86, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 1.03, y: -10 }}
                transition={{ duration: 0.24, ease: "easeOut" }}
                className="fixed inset-0 z-[69] pointer-events-none flex items-center justify-center px-4"
              >
                <div className="w-full max-w-3xl text-center">
                  <div className="inline-flex max-w-full flex-col items-center rounded-2xl border border-zinc-700/70 bg-zinc-950/88 px-8 py-5 shadow-[0_18px_64px_rgba(0,0,0,0.7)]">
                    <motion.div
                      animate={{
                        textShadow: [
                          "0 0 18px rgba(239,68,68,0.35)",
                          "0 0 34px rgba(239,68,68,0.85)",
                          "0 0 20px rgba(239,68,68,0.45)",
                        ],
                      }}
                      transition={{ duration: 1.05, repeat: Infinity, ease: "easeInOut" }}
                      className="text-[clamp(2.1rem,7vw,4.9rem)] font-black tracking-[0.04em] whitespace-nowrap leading-none text-red-500 uppercase"
                    >
                      ПРОТЕСТУЮ!
                    </motion.div>
                    <div className="mt-3 rounded-lg border border-zinc-600/60 bg-black/30 px-4 py-2 text-base md:text-lg text-zinc-100 font-semibold">
                      {game.activeProtest?.actorRoleTitle}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
            {influenceAnnouncement && (
              <motion.div
                key={`${influenceAnnouncement.id}-text`}
                initial={{ opacity: 0, scale: 0.86, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 1.03, y: -10 }}
                transition={{ duration: 0.24, ease: "easeOut" }}
                className="fixed inset-0 z-[70] pointer-events-none flex items-center justify-center px-4"
              >
                <div className="w-full text-center flex justify-center">
                  <div
                    className={`inline-flex flex-col items-center rounded-2xl border border-zinc-700/70 bg-zinc-950/88 px-5 py-4 shadow-[0_18px_64px_rgba(0,0,0,0.7)] ${
                      isCardAnnouncement
                        ? "max-w-[min(90vw,760px)] sm:px-8 sm:py-5"
                        : "max-w-[min(92vw,980px)] sm:px-7 sm:py-5"
                    }`}
                  >
                    {isCardAnnouncement && (
                      <div className="mb-2 text-[11px] sm:text-xs font-semibold uppercase tracking-[0.11em] text-zinc-400">
                        Использована карта механики
                      </div>
                    )}
                    <motion.div
                      animate={{
                        textShadow: isCardAnnouncement
                          ? [
                              "0 0 14px rgba(244,63,94,0.28)",
                              "0 0 24px rgba(244,63,94,0.5)",
                              "0 0 16px rgba(244,63,94,0.32)",
                            ]
                          : isProtestAcceptedAnnouncement
                            ? [
                                "0 0 18px rgba(16,185,129,0.35)",
                                "0 0 34px rgba(16,185,129,0.85)",
                                "0 0 20px rgba(16,185,129,0.45)",
                              ]
                          : [
                              "0 0 18px rgba(239,68,68,0.35)",
                              "0 0 34px rgba(239,68,68,0.85)",
                              "0 0 20px rgba(239,68,68,0.45)",
                            ],
                      }}
                      transition={{ duration: 1.05, repeat: Infinity, ease: "easeInOut" }}
                      className={`max-w-full break-words [text-wrap:balance] font-black uppercase ${
                        isCardAnnouncement
                          ? "text-[clamp(1.55rem,4.2vw,2.7rem)] tracking-[0.018em] leading-[0.98] text-rose-300"
                          : isProtestAcceptedAnnouncement
                            ? "text-[clamp(1.9rem,6.1vw,4.6rem)] tracking-[0.02em] leading-[0.92] text-emerald-400"
                            : isProtestRejectedAnnouncement
                              ? "text-[clamp(1.9rem,6.1vw,4.6rem)] tracking-[0.02em] leading-[0.92] text-red-500"
                              : "text-[clamp(1.9rem,6.1vw,4.6rem)] tracking-[0.02em] leading-[0.92] text-red-500"
                      }`}
                    >
                      {influenceAnnouncement.title}
                    </motion.div>
                    {influenceAnnouncement.subtitle && !isCardAnnouncement && (
                      <div
                        className={`mt-3 rounded-lg border border-zinc-600/60 bg-black/30 px-4 py-2 text-zinc-100 font-semibold ${
                          isCardAnnouncement ? "text-sm md:text-base" : "text-base md:text-lg"
                        }`}
                      >
                        {influenceAnnouncement.subtitle}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <Card className="rounded-[28px] shadow-sm border border-zinc-800 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-zinc-100">
            <CardContent className="p-8 space-y-6">
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                <div className="space-y-2 max-w-3xl">
                  <div className="flex items-center gap-2 text-sm text-zinc-400">
                    <Badge className="bg-zinc-800 text-zinc-100 border border-zinc-700">
                      {game.caseData.mode}
                    </Badge>
                    <span>{game.caseData.title}</span>
                    <span className="text-zinc-600">• Комната {game.code}</span>
                  </div>
                  <h1 className="text-3xl md:text-4xl font-bold">
                    {game.caseData.description}
                  </h1>
                </div>

                <div className="min-w-[260px] space-y-3">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentStage}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.25 }}
                      className="text-sm font-medium"
                    >
                      Этап: {currentStage}
                    </motion.div>
                  </AnimatePresence>
                  <Progress
                    value={stageProgress}
                    className="h-3 bg-zinc-800 [&>div]:bg-red-600 [&>div]:transition-all [&>div]:duration-500"
                  />
                  <div className="flex flex-wrap gap-3">
                    {(isHost || isJudge) && (
                      <>
                        <Button
                          variant="outline"
                          className="rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-40"
                          onClick={retreatStage}
                          disabled={game.stageIndex <= 0 || game.finished}
                        >
                          ← Пред.
                        </Button>
                        <Button
                          variant="secondary"
                          className="rounded-xl bg-zinc-100 text-zinc-950 hover:bg-zinc-200 border-0 disabled:bg-zinc-800 disabled:text-zinc-500"
                          onClick={advanceStage}
                          disabled={
                            game.stageIndex >= gameStages.length - 1 ||
                            game.finished
                          }
                        >
                          След. →
                        </Button>
                      </>
                    )}
                    <Button
                      variant="outline"
                      className="rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-100"
                      onClick={returnHomeWithSession}
                    >
                      Выйти
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid xl:grid-cols-[1.1fr_1.1fr_0.9fr] gap-6">
            <InfoBlock title="Ваша роль" icon={<Shield className="w-5 h-5" />}>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Avatar src={game.me.avatar ?? avatar} name={game.me.name} size={56} />
                  <div>
                    <div className="text-2xl font-bold">
                      {game.me.roleTitle}
                    </div>
                    <div className="text-sm text-zinc-400">{game.me.name}</div>
                  </div>
                </div>
                <div>
                  <div className="font-semibold mb-1">Цель</div>
                  <p className="text-sm text-zinc-400">{game.me.goal}</p>
                </div>
                <Separator />
                <div>
                  <div className="font-semibold mb-2 text-sm">
                    Все участники
                  </div>
                  <div className="space-y-1">
                    {game.players.map((p) => (
                      <div
                        key={p.id}
                        className={`relative overflow-hidden rounded-xl border bg-zinc-900/60 px-2.5 py-1.5 flex items-center justify-between text-sm ${
                          p.userId
                            ? "cursor-pointer border-zinc-800 hover:border-zinc-700"
                            : "border-zinc-800"
                        }`}
                        onClick={() => p.userId && openUserProfile(p.userId)}
                      >
                        <div
                          className="pointer-events-none absolute inset-0 opacity-80"
                          style={getBannerStyle(p.banner, p.avatar, p.name)}
                        />
                        <div className="pointer-events-none absolute inset-0 bg-black/35" />
                        <div className="relative z-10 flex items-center gap-2 min-w-0">
                          <div
                            className={`inline-flex items-center gap-2 min-w-0 rounded-md px-1 py-0.5 text-left ${
                              p.userId
                                ? "text-zinc-300 hover:text-zinc-100 transition-colors"
                                : "text-zinc-400"
                            }`}
                          >
                            <Avatar src={p.avatar ?? null} name={p.name} size={32} />
                            <span className="truncate">{p.name}</span>
                            {p.selectedBadgeKey ? (
                              <span
                                className={`inline-flex h-6 w-6 shrink-0 self-center items-center justify-center rounded-md border border-zinc-600/80 shadow-[0_0_0_1px_rgba(0,0,0,0.28)] ${
                                  getBadgeTheme(p.selectedBadgeKey).icon
                                }`}
                              >
                                <BadgeGlyph badgeKey={p.selectedBadgeKey} className="h-3.5 w-3.5" />
                              </span>
                            ) : null}
                          </div>
                          {(p.warningCount ?? 0) > 0 && (
                            <Badge className="bg-red-950/70 text-red-300 border border-red-700/70">
                              {p.warningCount}/3
                            </Badge>
                          )}
                          {typeof p.disconnectedUntil === "number" &&
                            p.disconnectedUntil > nowMs && (
                              <motion.span
                                animate={{ opacity: [0.85, 1, 0.85] }}
                                transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                                className="inline-flex items-center"
                                title={`Игрок вышел. Осталось ${Math.ceil((p.disconnectedUntil - nowMs) / 1000)} сек.`}
                              >
                                <DoorOpen
                                  className="h-4 w-4"
                                  style={{
                                    color: `rgb(${Math.round(
                                      239 + (113 - 239) *
                                        (1 - Math.min(1, (p.disconnectedUntil - nowMs) / RECONNECT_GRACE_MS)),
                                    )}, ${Math.round(
                                      68 + (113 - 68) *
                                        (1 - Math.min(1, (p.disconnectedUntil - nowMs) / RECONNECT_GRACE_MS)),
                                    )}, ${Math.round(
                                      68 + (122 - 68) *
                                        (1 - Math.min(1, (p.disconnectedUntil - nowMs) / RECONNECT_GRACE_MS)),
                                    )})`,
                                  }}
                                />
                              </motion.span>
                            )}
                        </div>
                        <span className="relative z-10 text-zinc-500">{p.roleTitle}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </InfoBlock>

            <InfoBlock title="Улики дела" icon={<Eye className="w-5 h-5" />}>
              <div className="space-y-3">
                {game.caseData.evidence.map((item, index) => (
                  <motion.div
                    key={index}
                    custom={index}
                    variants={cardVariants}
                    initial="initial"
                    animate="animate"
                  >
                    <Card className="rounded-2xl border-dashed border-zinc-700 bg-zinc-900/80 text-zinc-100">
                      <CardContent className="p-4 text-sm">{item}</CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </InfoBlock>

            <InfoBlock title="Влияние" icon={<Gavel className="w-5 h-5" />}>
              <div className="space-y-3">
                {influenceView === "chat" && lawyerChatPartner ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-zinc-300">
                        Чат с {lawyerChatPartner.name}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 rounded-lg text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
                        onClick={() => setInfluenceView("main")}
                      >
                        <ArrowLeft className="h-4 w-4 mr-1" />
                        Назад
                      </Button>
                    </div>
                    <div
                      ref={lawyerChatScrollRef}
                      className={`rounded-xl border border-zinc-800 bg-zinc-950/70 p-3 h-[280px] md:h-[320px] overflow-y-auto overflow-x-hidden ${HIDE_SCROLLBAR_CLASS}`}
                    >
                      <div className="space-y-2 min-w-0">
                        {lawyerChatMessages.length === 0 && (
                          <div className="text-sm text-zinc-500">
                            Пока нет сообщений.
                          </div>
                        )}
                        {lawyerChatMessages.map((message) => {
                          const own = message.senderId === myId;
                          return (
                            <div
                              key={message.id}
                              className={`flex min-w-0 ${own ? "justify-end" : "justify-start"}`}
                            >
                              <div
                                className={`max-w-full md:max-w-[85%] min-w-0 rounded-xl px-3 py-2 text-sm ${
                                  own ? "bg-red-600 text-white" : "bg-zinc-800 text-zinc-200"
                                }`}
                              >
                                <div className="text-[11px] opacity-75 mb-1">
                                  {message.senderName} ·{" "}
                                  {new Date(message.createdAt).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </div>
                                <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                                  {message.text}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Input
                        value={lawyerChatInput}
                        onChange={(e) => setLawyerChatInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && sendLawyerChatMessage()}
                        placeholder={
                          isLawyerRole ? "Сообщение клиенту..." : "Сообщение адвокату..."
                        }
                        className="h-10 rounded-xl bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
                      />
                      <Button
                        className="h-10 rounded-xl bg-zinc-100 text-zinc-950 hover:bg-zinc-200 border-0"
                        onClick={sendLawyerChatMessage}
                        disabled={!lawyerChatInput.trim()}
                      >
                        Отправить
                      </Button>
                    </div>
                  </div>
                ) : influenceView === "notes" ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-zinc-300">Личные заметки</div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 rounded-lg text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
                        onClick={() => setInfluenceView("main")}
                      >
                        <ArrowLeft className="h-4 w-4 mr-1" />
                        Назад
                      </Button>
                    </div>
                    <textarea
                      value={influenceNotes}
                      onChange={(e) => setInfluenceNotes(e.target.value)}
                      placeholder="Записывайте мысли по делу..."
                      className={`w-full h-[220px] resize-none rounded-xl border border-zinc-700 bg-zinc-950/75 p-3 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:ring-1 focus:ring-red-500/60 ${HIDE_SCROLLBAR_CLASS}`}
                    />
                    <div className="text-xs text-zinc-500">
                      Заметки видите только вы. Сохраняются до конца матча.
                    </div>
                  </div>
                ) : influenceView === "verdict" && isJudge ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-zinc-300">Вердикт</div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 rounded-lg text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
                        onClick={() => setInfluenceView("main")}
                      >
                        <ArrowLeft className="h-4 w-4 mr-1" />
                        Назад
                      </Button>
                    </div>
                    <div className={`text-sm ${isVerdictStage ? "text-zinc-400" : "text-zinc-500"}`}>
                      {isVerdictStage
                        ? "Финальный этап. Вынесите решение."
                        : `Доступно на этапе «${gameStages[gameStages.length - 1]}»`}
                    </div>
                    {(["Виновен", "Не виновен", "Частично виновен"] as const).map((v, i) => (
                      <motion.div
                        key={v}
                        custom={i}
                        variants={cardVariants}
                        initial="initial"
                        animate="animate"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                      >
                        <Button
                          className={`w-full rounded-xl border-0 disabled:bg-zinc-800 disabled:text-zinc-500 ${
                            i === 0
                              ? "bg-red-600 hover:bg-red-500 text-white"
                              : i === 1
                                ? "bg-zinc-100 text-zinc-950 hover:bg-zinc-200"
                                : "bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
                          }`}
                          onClick={() => submitVerdict(v)}
                          disabled={!isVerdictStage || game.finished}
                        >
                          {v}
                        </Button>
                      </motion.div>
                    ))}
                  </div>
                ) : influenceView === "warnings" && isJudge ? (
                  <div className="space-y-3 min-w-0 overflow-hidden">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-zinc-300">Предупреждения</div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 rounded-lg text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
                        onClick={() => setInfluenceView("main")}
                      >
                        <ArrowLeft className="h-4 w-4 mr-1" />
                        Назад
                      </Button>
                    </div>
                    <div
                      className="space-y-2.5 max-h-[340px] overflow-y-auto overflow-x-hidden pr-2 [scrollbar-width:thin] [scrollbar-color:rgba(113,113,122,0.9)_rgba(24,24,27,0.45)] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-zinc-900/55 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-700/85 [&::-webkit-scrollbar-thumb:hover]:bg-zinc-500"
                    >
                      {warningTargets.length === 0 ? (
                        <div className="text-sm text-zinc-500">
                          Нет игроков для предупреждения.
                        </div>
                      ) : (
                        warningTargets.map((player) => {
                          const warningCount = player.warningCount ?? 0;
                          const reachedLimit = warningCount >= 3;
                          const canWarn = canUseJudgeWarning && !reachedLimit;
                          const canRemove = canUseJudgeWarning && warningCount > 0;
                          return (
                            <div
                              key={player.id}
                              className="rounded-xl border border-zinc-800/90 bg-gradient-to-r from-zinc-950/75 via-zinc-900/55 to-zinc-950/75 p-3 overflow-hidden"
                            >
                              <div className="flex items-start gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm font-semibold truncate">
                                    {player.name}
                                  </div>
                                  <div className="text-xs text-zinc-500 truncate">
                                    {player.roleTitle}
                                  </div>
                                </div>
                                <div className="shrink-0 flex flex-col items-end gap-1">
                                  <Badge className="bg-red-950/70 text-red-300 border border-red-700/70">
                                    {warningCount}/3
                                  </Badge>
                                </div>
                              </div>
                              <div className="mt-2.5 min-w-0 flex items-center gap-2">
                                {warningCount === 0 ? (
                                  <Button
                                    className={`h-8 w-full min-w-0 rounded-lg px-3 text-xs font-semibold ${
                                      canWarn
                                        ? "border-red-500/45 bg-red-500/16 text-red-200 hover:bg-red-500/26 hover:text-red-100"
                                        : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:bg-zinc-900"
                                    }`}
                                    disabled={!canWarn}
                                    onClick={() => triggerJudgeWarning(player.id)}
                                    variant="outline"
                                  >
                                    <span className="truncate">Выдать предупреждение</span>
                                  </Button>
                                ) : (
                                  <>
                                    <Button
                                      className={`h-8 min-w-0 flex-1 rounded-lg px-3 text-xs font-semibold ${
                                        canWarn
                                          ? "border-red-500/45 bg-red-500/16 text-red-200 hover:bg-red-500/26 hover:text-red-100"
                                          : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:bg-zinc-900"
                                      }`}
                                      disabled={!canWarn}
                                      onClick={() => triggerJudgeWarning(player.id)}
                                      variant="outline"
                                    >
                                      <span className="truncate">Добавить</span>
                                    </Button>
                                    <Button
                                      variant="outline"
                                      className={`h-8 min-w-0 flex-1 rounded-lg px-3 text-xs font-semibold ${
                                        canRemove
                                          ? "border-zinc-600 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-100"
                                          : "border-zinc-700 bg-zinc-900 text-zinc-500 hover:bg-zinc-900"
                                      }`}
                                      disabled={!canRemove}
                                      onClick={() => removeJudgeWarning(player.id)}
                                    >
                                      <span className="truncate">Убрать</span>
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {isJudge ? (
                      <>
                        {hasActiveProtest && (
                          <div className="rounded-xl border border-zinc-800 bg-zinc-950/75 p-3 space-y-2.5">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-400">
                              Активный протест
                            </div>
                            <div className="text-sm font-semibold text-zinc-100">
                              {game.activeProtest?.actorRoleTitle}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <Button
                                variant="outline"
                                className="h-10 rounded-xl border-emerald-500/50 bg-emerald-500/12 text-emerald-300 hover:bg-emerald-500/20 hover:text-emerald-200"
                                onClick={() => resolveProtest("accepted")}
                              >
                                Принять
                              </Button>
                              <Button
                                variant="outline"
                                className="h-10 rounded-xl border-red-500/50 bg-red-500/10 text-red-300 hover:bg-red-500/18 hover:text-red-200"
                                onClick={() => resolveProtest("rejected")}
                              >
                                Отклонить
                              </Button>
                            </div>
                          </div>
                        )}
                        <Button
                          className={`w-full h-12 rounded-xl border-0 text-base font-bold ${
                            isVerdictStage
                              ? "bg-red-600 text-white hover:bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.45)]"
                              : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                          }`}
                          onClick={() => setInfluenceView("verdict")}
                        >
                          Вердикт
                        </Button>
                        <Button
                          className={`w-full h-12 rounded-xl border-0 ${
                            canUseJudgeSilence
                              ? "bg-red-600 text-white hover:bg-red-500 shadow-[0_0_18px_rgba(239,68,68,0.38)]"
                              : "bg-zinc-800 text-zinc-400 hover:bg-zinc-800"
                          }`}
                          disabled={!canUseJudgeSilence}
                          onClick={triggerJudgeSilence}
                          title="Тишина в зале!"
                        >
                          <span className="whitespace-nowrap">
                            Тишина в зале!
                            {silenceCooldownLeft > 0 ? ` (${silenceCooldownLeft}s)` : ""}
                          </span>
                        </Button>
                        <Button
                          variant="outline"
                          className="w-full h-12 rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-100"
                          onClick={() => setInfluenceView("warnings")}
                        >
                          Предупреждение
                        </Button>
                        <Button
                          variant="outline"
                          className="w-full h-12 rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-100"
                          onClick={() => setInfluenceView("notes")}
                        >
                          Заметки
                        </Button>
                      </>
                    ) : (
                      <>
                        {!isWitness && (
                          <Button
                            className={`w-full h-14 rounded-xl border-0 text-lg font-black tracking-[0.05em] transition-all ${
                              canUseProtest
                                ? "bg-red-600 text-white hover:bg-red-500 shadow-[0_0_28px_rgba(239,68,68,0.58)]"
                                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-800"
                            }`}
                            onClick={triggerProtest}
                            disabled={!canUseProtest}
                          >
                            {hasActiveProtest ? "ПРОТЕСТ АКТИВЕН" : "ПРОТЕСТУЮ"}
                            {!hasActiveProtest && protestCooldownLeft > 0
                              ? ` (${protestCooldownLeft}s)`
                              : ""}
                          </Button>
                        )}
                        {lawyerChatPartner && (
                          <Button
                            variant="outline"
                            className={`w-full h-12 rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-100 ${
                              lawyerChatUnreadCount > 0 ? "animate-pulse" : ""
                            }`}
                            onClick={openLawyerChat}
                          >
                            {lawyerChatButtonLabel}
                            {lawyerChatUnreadCount > 0 && (
                              <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-xs text-white">
                                {lawyerChatUnreadCount}
                              </span>
                            )}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          className="w-full h-12 rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-100"
                          onClick={() => setInfluenceView("notes")}
                        >
                          Заметки
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </InfoBlock>
          </div>

          <div
            className={`grid gap-6 ${isObserverRole ? "xl:grid-cols-2" : "xl:grid-cols-[1fr_1fr_1fr_1fr]"}`}
          >
            <InfoBlock
              title="Раскрытые факты"
              icon={<Eye className="w-5 h-5" />}
              action={
                game.revealedFacts.length > 0 ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg h-7 px-2"
                    onClick={() => setShowFactHistory(true)}
                  >
                    История ({game.revealedFacts.length})
                  </Button>
                ) : undefined
              }
            >
              <div className="space-y-3 min-h-[80px]">
                {visibleFacts.length === 0 ? (
                  <div className="text-sm text-zinc-400">
                    Пока никто не раскрыл ни одного факта.
                  </div>
                ) : (
                  <AnimatePresence mode="popLayout">
                    {visibleFacts.map((fact) => {
                      const isLatestFact = fact.id === latestRevealedFactId;
                      const ownerPlayer = game.players.find(
                        (p) => p.id === fact.ownerId,
                      );
                      return (
                      <motion.div
                        key={fact.id}
                        variants={entryVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        layout
                      >
                        <Card
                          className={
                            isLatestFact
                              ? "rounded-2xl border border-red-500/35 bg-red-950/15 text-zinc-100 ring-1 ring-red-500/20 shadow-[0_0_10px_rgba(220,38,38,0.12)]"
                              : "rounded-2xl border-dashed border-zinc-700 bg-zinc-900/80 text-zinc-100"
                          }
                        >
                          <CardContent className="p-4 min-h-[120px]">
                            <div className="flex items-center justify-between gap-3 mb-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <Avatar
                                  src={ownerPlayer?.avatar ?? null}
                                  name={fact.owner}
                                  size={34}
                                />
                                <div className="font-semibold text-base leading-none truncate">
                                  {fact.owner}
                                </div>
                              </div>
                              <Badge
                                className={
                                  isLatestFact
                                    ? "bg-red-600/20 text-red-100 border border-red-500/30"
                                    : "bg-zinc-800 text-zinc-100 border border-zinc-700"
                                }
                              >
                                {fact.ownerRole}
                              </Badge>
                            </div>
                            <div className="min-h-[64px]">
                              <div className="text-base text-zinc-300 leading-relaxed">
                                {fact.text}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                      );
                    })}
                  </AnimatePresence>
                )}
              </div>
            </InfoBlock>

            {!isObserverRole && (
              <InfoBlock
                title="Ваши факты"
                icon={<AlertCircle className="w-5 h-5" />}
              >
                <div className="space-y-3">
                  {game.me.facts.length === 0 ? (
                    <div className="text-sm text-zinc-400">
                      У вас нет фактов для раскрытия.
                    </div>
                  ) : (
                    game.me.facts.map((fact) => {
                      const canRevealThisFact =
                        !fact.revealed &&
                        !game.finished &&
                        canRevealFactsAtCurrentStage;

                      return (
                        <Card
                          key={fact.id}
                          className="rounded-2xl bg-zinc-900/80 border-zinc-800 text-zinc-100"
                        >
                          <CardContent className="p-4 flex flex-col gap-3">
                            <div className="text-sm">{fact.text}</div>
                            <div className="flex items-center justify-between gap-3">
                              <Badge
                                className={
                                  fact.revealed
                                    ? "bg-red-600 text-white border-0"
                                    : "bg-zinc-800 text-zinc-100 border border-zinc-700"
                                }
                              >
                                {fact.revealed ? "Раскрыт" : "Скрыт"}
                              </Badge>
                              <motion.div
                                whileHover={{ scale: 1.04 }}
                                whileTap={{ scale: 0.96 }}
                              >
                              <Button
                                  size="sm"
                                  variant="outline"
                                  className={
                                    canRevealThisFact
                                      ? "rounded-xl !bg-red-600 hover:!bg-red-500 !text-white !border-red-500/70"
                                      : "rounded-xl !bg-zinc-800 !text-zinc-500 !border-zinc-700 hover:!bg-zinc-800"
                                  }
                                  onClick={() => revealFact(fact.id)}
                                  disabled={!canRevealThisFact}
                                >
                                  Раскрыть
                                </Button>
                              </motion.div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </div>
              </InfoBlock>
            )}

            {!isObserverRole && (
              <InfoBlock
                title="Ваши карты механик"
                icon={<Scale className="w-5 h-5" />}
              >
                <div className="space-y-3">
                  {game.me.cards.map((card) => (
                    <Card
                      key={card.id}
                      className="rounded-2xl bg-zinc-900/80 border-zinc-800 text-zinc-100"
                    >
                      <CardContent className="p-4 flex flex-col gap-3">
                        <div>
                          <div className="font-semibold">{card.name}</div>
                          <div className="text-sm text-zinc-400 mt-1">
                            {card.description}
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <Badge
                            className={
                              card.used
                                ? "border border-zinc-700 bg-zinc-900 text-zinc-300"
                                : "bg-red-600 text-white border-0"
                            }
                          >
                            {card.used ? "Использована" : "Готова"}
                          </Badge>
                          <motion.div
                            whileHover={{ scale: 1.04 }}
                            whileTap={{ scale: 0.96 }}
                          >
                            <Button
                              size="sm"
                              variant="secondary"
                              className="rounded-xl bg-zinc-100 text-zinc-950 hover:bg-zinc-200 border-0 disabled:bg-zinc-800 disabled:text-zinc-500"
                              onClick={() => useCard(card.id)}
                              disabled={card.used || game.finished || isPreparationStage}
                            >
                              Применить
                            </Button>
                          </motion.div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </InfoBlock>
            )}

            <InfoBlock
              title="Журнал механик"
              icon={<Sparkles className="w-5 h-5" />}
            >
              <div className="space-y-3 min-h-[80px]">
                {visibleCards.length === 0 ? (
                  <div className="text-sm text-zinc-400">
                    Пока ни одна карта не была использована.
                  </div>
                ) : (
                  <AnimatePresence mode="popLayout">
                    {visibleCards.map((entry) => {
                      const isLatestCard = entry.id === latestUsedCardId;
                      const ownerPlayer = game.players.find(
                        (p) => p.id === entry.ownerId,
                      );
                      return (
                      <motion.div
                        key={entry.id}
                        variants={entryVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        layout
                      >
                        <Card
                          className={
                            isLatestCard
                              ? "rounded-2xl border border-red-500/35 bg-red-950/15 text-zinc-100 ring-1 ring-red-500/20 shadow-[0_0_10px_rgba(220,38,38,0.12)]"
                              : "rounded-2xl border-dashed border-zinc-700 bg-zinc-900/80 text-zinc-100"
                          }
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between gap-3 mb-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <Avatar
                                  src={ownerPlayer?.avatar ?? null}
                                  name={entry.owner}
                                  size={30}
                                />
                                <div className="font-semibold text-sm truncate">
                                  {entry.owner}
                                </div>
                              </div>
                              <Badge
                                className={
                                  isLatestCard
                                    ? "bg-red-600/20 text-red-100 border border-red-500/30"
                                    : "bg-zinc-800 text-zinc-100 border border-zinc-700"
                                }
                              >
                                {entry.ownerRole}
                              </Badge>
                            </div>
                            <div className="font-semibold">{entry.name}</div>
                            <div className="text-sm text-zinc-400 mt-1">
                              {entry.description}
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                      );
                    })}
                  </AnimatePresence>
                )}
              </div>
            </InfoBlock>
          </div>
          {matchExpiresAt !== null && !game.finished && (
            <div className="fixed right-5 bottom-[4.35rem] sm:bottom-[4.45rem] left-auto z-30 rounded-xl border border-zinc-700/80 bg-zinc-950/85 px-2.5 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs font-semibold text-zinc-200 shadow-[0_8px_22px_rgba(0,0,0,0.45)] backdrop-blur-sm">
              <span className="sm:hidden inline-flex items-center gap-2">
                <Clock3 className="h-3.5 w-3.5 text-zinc-300" />
                <span className="text-red-300">
                  {String(matchHoursLeft).padStart(2, "0")}:
                  {String(matchMinutesLeft).padStart(2, "0")}:
                  {String(matchSecondsLeft).padStart(2, "0")}
                </span>
              </span>
              <span className="hidden sm:inline-flex items-center gap-2">
                <Clock3 className="h-3.5 w-3.5 text-zinc-300" />
                <span>До авто-закрытия:</span>
                <span className="text-red-300">
                  {String(matchHoursLeft).padStart(2, "0")}:
                  {String(matchMinutesLeft).padStart(2, "0")}:
                  {String(matchSecondsLeft).padStart(2, "0")}
                </span>
              </span>
            </div>
          )}
          <ContextHelp
            open={contextHelpOpen}
            onOpenChange={setContextHelpOpen}
            query={contextHelpQuery}
            onQueryChange={setContextHelpQuery}
          />
        </div>
        {renderPublicProfileDialog()}
        <ScreenTransitionLoader open={screenTransitionLoading} />
      </motion.div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <motion.div
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ repeat: Infinity, duration: 1.8 }}
        className="text-zinc-400 text-sm"
      >
        Загрузка...
      </motion.div>
    </div>
  );
}



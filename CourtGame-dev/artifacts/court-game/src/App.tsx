import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  Shield,
  AlertCircle,
  Sparkles,
  Camera,
  CircleHelp,
  Gamepad2,
  Search,
  Wrench,
} from "lucide-react";
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
import TestPlayersPanel from "@/components/test/TestPlayersPanel";
import { disconnectTestPlayersFromRoom } from "@/lib/testPlayersHarness";

const DEFAULT_GAME_STAGES = [
  "Подготовка",
  "Выступление истца",
  "Выступление ответчика",
  "Перекрестный допрос",
  "Финальная речь истца",
  "Финальная речь ответчика",
  "Решение судьи",
];


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
  "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden";

interface DevLogEntry {
  date: string;
  version: string;
  title: string;
  changes: string[];
}

const CURRENT_VERSION = "Beta 0.3";

const DEVLOG_ENTRIES: DevLogEntry[] = [
  {
    date: "20.03.2026",
    version: CURRENT_VERSION,
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
  name: string;
  avatar?: string;
  roleKey?: string;
  roleTitle?: string;
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

interface MyPlayer {
  id: string;
  name: string;
  avatar?: string;
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
  finished: boolean;
  verdict: string;
  verdictEvaluation: string;
  me: MyPlayer | null;
  code: string;
  hostId: string;
}

interface RoomState {
  code: string;
  hostId: string;
  players: PlayerInfo[];
  started: boolean;
  isHostJudge?: boolean;
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

function PlayerCard({
  player,
  isHost,
  canKick = false,
  onKick,
}: {
  player: PlayerInfo;
  isHost: boolean;
  canKick?: boolean;
  onKick?: () => void;
}) {
  return (
    <motion.div variants={cardVariants} initial="initial" animate="animate">
      <Card className="rounded-2xl shadow-sm bg-zinc-900/90 border-zinc-800 text-zinc-100">
        <CardContent className="p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar src={player.avatar ?? null} name={player.name} size={52} />
            <div className="min-w-0">
              <div className="font-semibold text-base truncate">{player.name}</div>
              <div className="text-sm text-zinc-400">
                {isHost ? "Ведущий комнаты" : "Игрок"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              className={
                isHost
                  ? "bg-red-600 text-white border-0"
                  : "bg-zinc-800 text-zinc-100 border border-zinc-700"
              }
            >
              {isHost ? "Host" : "Player"}
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

export default function App() {
  const [screen, setScreen] = useState<"setup" | "home" | "room" | "game">(
    "home",
  );
  const [homeTab, setHomeTab] = useState<HomeTab>("play");
  const [mainHelpQuery, setMainHelpQuery] = useState("");
  const [contextHelpOpen, setContextHelpOpen] = useState(false);
  const [contextHelpQuery, setContextHelpQuery] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [disconnectAlert, setDisconnectAlert] = useState("");
  const [rejoinAlert, setRejoinAlert] = useState("");
  const [kickedAlert, setKickedAlert] = useState("");
  const [copiedRoomCode, setCopiedRoomCode] = useState(false);
  const [startGameLoading, setStartGameLoading] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  const [myId, setMyId] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [showFactHistory, setShowFactHistory] = useState(false);
  const [isHostJudge, setIsHostJudge] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const socket = getSocket();
  const activeRoomCode = room?.code ?? game?.code ?? null;

  useEffect(() => {
    const savedName = localStorage.getItem("court_nickname");
    const savedAvatar = localStorage.getItem("court_avatar");
    if (savedAvatar) setAvatar(savedAvatar);

    if (savedName) {
      setPlayerName(savedName);
      const sessionCode = localStorage.getItem("court_session");
      if (sessionCode) {
        setHasSession(true);
        socket.emit("rejoin_room", {
          code: sessionCode,
          playerName: savedName,
        });
      }
    } else {
      setScreen("setup");
    }
  }, []);

  useEffect(() => {
    socket.on(
      "room_joined",
      ({ playerId, state }: { playerId: string; state: any }) => {
        setMyId(playerId);
        localStorage.setItem("court_session", state.code);
        setHasSession(true);
        setStartGameLoading(false);
        if (avatar) {
          socket.emit("update_avatar", {
            code: state.code,
            playerId,
            avatar,
          });
        }
        if (state.type === "room") {
          const roomState = state as RoomState;
          setRoom({
            ...roomState,
            players: roomState.players.map((p) =>
              p.id === playerId && avatar ? { ...p, avatar } : p,
            ),
          });
          setIsHostJudge(state.isHostJudge ?? false);
          setGame(null);
          setScreen("room");
        } else {
          const gameState = state as GameState;
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
          setScreen("game");
        }
      },
    );

    socket.on(
      "room_updated",
      ({ players, hostId, isHostJudge: hj }: { players: PlayerInfo[]; hostId: string; isHostJudge?: boolean }) => {
        setRoom((prev) => {
          if (!prev) return prev;
          const mergedPlayers = players.map((nextPlayer) => {
            const prevPlayer = prev.players.find((p) => p.id === nextPlayer.id);
            return {
              ...nextPlayer,
              avatar: nextPlayer.avatar ?? prevPlayer?.avatar,
            };
          });
          return { ...prev, players: mergedPlayers, hostId };
        });
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
      "player_left",
      ({ playerName: name }: { playerId: string; playerName: string }) => {
        setDisconnectAlert(`⚠️ ${name} покинул игру`);
        setTimeout(() => setDisconnectAlert(""), 6000);
      },
    );

    socket.on(
      "player_rejoined",
      ({ playerName: name }: { playerName: string }) => {
        setRejoinAlert(`${name} вернулся в игру`);
        setTimeout(() => setRejoinAlert(""), 4000);
      },
    );

    socket.on("rejoin_failed", () => {
      localStorage.removeItem("court_session");
      setHasSession(false);
      setScreen("home");
    });

    socket.on("kicked", () => {
      localStorage.removeItem("court_session");
      setHasSession(false);
      setRoom(null);
      setGame(null);
      setMyId(null);
      setJoinCode("");
      setDisconnectAlert("");
      setRejoinAlert("");
      setCopiedRoomCode(false);
      setIsHostJudge(false);
      setStartGameLoading(false);
      setContextHelpOpen(false);
      setScreen("home");
      setKickedAlert(
        "\u0412\u044b \u0431\u044b\u043b\u0438 \u043a\u0438\u043a\u043d\u0443\u0442\u044b \u0438\u0437 \u043a\u043e\u043c\u043d\u0430\u0442\u044b.",
      );
      setTimeout(() => setKickedAlert(""), 5000);
    });

    socket.on("game_started", ({ state }: { state: any }) => {
      setStartGameLoading(false);
      setGame(state as GameState);
      setRoom(null);
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
      ({ verdict, verdictEvaluation, finished }: any) => {
        setGame((prev) =>
          prev ? { ...prev, verdict, verdictEvaluation, finished } : prev,
        );
      },
    );

    socket.on("error", ({ message }: { message: string }) => {
      setStartGameLoading(false);
      setError(message);
      setTimeout(() => setError(""), 4000);
    });

    return () => {
      socket.off("room_joined");
      socket.off("room_updated");
      socket.off("game_players_updated");
      socket.off("player_left");
      socket.off("player_rejoined");
      socket.off("rejoin_failed");
      socket.off("kicked");
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
  }, [socket, avatar]);

  const createRoom = useCallback(() => {
    const name = playerName.trim() || "Игрок";
    localStorage.setItem("court_nickname", name);
    socket.emit("create_room", { playerName: name });
  }, [socket, playerName]);

  const joinRoom = useCallback(() => {
    if (!joinCode.trim()) return;
    const name = playerName.trim() || "Игрок";
    socket.emit("join_room", {
      code: joinCode.trim().toUpperCase(),
      playerName: name,
    });
  }, [socket, joinCode, playerName]);

  const reconnect = useCallback(() => {
    const savedName = localStorage.getItem("court_nickname");
    const sessionCode = localStorage.getItem("court_session");
    if (savedName && sessionCode) {
      socket.emit("rejoin_room", {
        code: sessionCode,
        playerName: savedName,
      });
    }
  }, [socket]);

  const startGame = useCallback(() => {
    if (!room || !myId) return;
    setStartGameLoading(true);
    socket.emit("start_game", { code: room.code, playerId: myId });
  }, [socket, room, myId]);

  const toggleHostJudge = useCallback((checked: boolean) => {
    if (!room || !myId) return;
    setIsHostJudge(checked);
    socket.emit("set_host_judge", { code: room.code, playerId: myId, isHostJudge: checked });
  }, [socket, room, myId]);

  const kickPlayerFromRoom = useCallback(
    (targetPlayerId: string) => {
      if (!room || !myId || myId !== room.hostId) return;
      socket.emit("kick_player", {
        code: room.code,
        playerId: myId,
        targetPlayerId,
      });
    },
    [socket, room, myId],
  );

  const revealFact = useCallback(
    (factId: string) => {
      if (!game || !myId) return;
      socket.emit("reveal_fact", { code: game.code, playerId: myId, factId });
    },
    [socket, game, myId],
  );

  const useCard = useCallback(
    (cardId: string) => {
      if (!game || !myId) return;
      socket.emit("use_card", { code: game.code, playerId: myId, cardId });
    },
    [socket, game, myId],
  );

  const advanceStage = useCallback(() => {
    if (!game || !myId) return;
    socket.emit("next_stage", { code: game.code, playerId: myId });
  }, [socket, game, myId]);

  const retreatStage = useCallback(() => {
    if (!game || !myId) return;
    socket.emit("prev_stage", { code: game.code, playerId: myId });
  }, [socket, game, myId]);

  const submitVerdict = useCallback(
    (verdict: string) => {
      if (!game || !myId) return;
      socket.emit("set_verdict", { code: game.code, playerId: myId, verdict });
    },
    [socket, game, myId],
  );

  const resetAll = useCallback(() => {
    if (activeRoomCode) {
      disconnectTestPlayersFromRoom(activeRoomCode);
    }
    socket.emit("leave_room");
    setScreen("home");
    setRoom(null);
    setGame(null);
    setMyId(null);
    setJoinCode("");
    setDisconnectAlert("");
    setRejoinAlert("");
    setKickedAlert("");
    setCopiedRoomCode(false);
    setIsHostJudge(false);
    setStartGameLoading(false);
    setContextHelpOpen(false);
  }, [socket, activeRoomCode]);

  const finalExit = useCallback(() => {
    if (activeRoomCode) {
      disconnectTestPlayersFromRoom(activeRoomCode);
    }
    socket.emit("leave_room");
    localStorage.removeItem("court_session");
    setHasSession(false);
    setScreen("home");
    setRoom(null);
    setGame(null);
    setMyId(null);
    setJoinCode("");
    setKickedAlert("");
    setCopiedRoomCode(false);
    setStartGameLoading(false);
    setContextHelpOpen(false);
  }, [socket, activeRoomCode]);

  const setupNickname = useCallback(() => {
    const name = playerName.trim();
    if (!name) return;
    localStorage.setItem("court_nickname", name);
    setScreen("home");
  }, [playerName]);

  const compressAvatar = useCallback(
    (inputDataUrl: string): Promise<string> =>
      new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const maxSide = 256;
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
          resolve(canvas.toDataURL("image/jpeg", 0.78));
        };
        img.onerror = () => resolve(inputDataUrl);
        img.src = inputDataUrl;
      }),
    [],
  );

  const handleAvatarChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const dataUrl = ev.target?.result as string;
        const compactAvatar = await compressAvatar(dataUrl);
        setAvatar(compactAvatar);
        localStorage.setItem("court_avatar", compactAvatar);
      };
      reader.readAsDataURL(file);
    },
    [compressAvatar],
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

  if (screen === "setup") {
    return (
      <motion.div
        key="setup"
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6"
      >
        <div className="w-full max-w-sm space-y-4">
          <Card className="rounded-[28px] border-zinc-800 bg-zinc-900/95 text-zinc-100">
            <CardContent className="p-8 space-y-6">
              <div className="space-y-2 text-center">
                <Badge className="rounded-full px-3 py-1 text-sm bg-red-600/90 text-white border-0">
                  СУД
                </Badge>
                <h1 className="text-2xl font-bold pt-2">Добро пожаловать!</h1>
                <p className="text-sm text-zinc-400">
                  Придумайте никнейм — он сохранится и будет привязан к вам в
                  каждой игре.
                </p>
              </div>

              <div className="flex flex-col items-center gap-3">
                <div
                  className="relative cursor-pointer group"
                  onClick={() => avatarInputRef.current?.click()}
                >
                  <Avatar src={avatar} name={playerName || "?"} size={72} />
                  <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="w-5 h-5 text-white" />
                  </div>
                </div>
                <span className="text-xs text-zinc-500">
                  Нажмите, чтобы добавить фото
                </span>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Ваш никнейм</label>
                <Input
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Например: Артём"
                  className="h-12 rounded-xl bg-zinc-100 text-zinc-950 placeholder:text-zinc-400 border-0 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-0"
                  onKeyDown={(e) => e.key === "Enter" && setupNickname()}
                  autoFocus
                />
              </div>
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button
                  onClick={setupNickname}
                  disabled={!playerName.trim()}
                  className="w-full h-12 rounded-xl text-base bg-red-600 hover:bg-red-500 text-white border-0 disabled:bg-zinc-700 disabled:text-zinc-500"
                >
                  Продолжить
                </Button>
              </motion.div>
            </CardContent>
          </Card>
        </div>
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
        className="min-h-screen bg-zinc-950 text-zinc-100 p-6 md:p-10"
      >
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
        </AnimatePresence>

        <div className="max-w-6xl mx-auto mb-6 flex justify-center">
          <div className="inline-flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-900/90 p-1.5 shadow-sm shadow-black/30">
            <Button
              variant="ghost"
              onClick={() => setHomeTab("play")}
              className={`h-9 rounded-full px-4 gap-2 ${
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
              onClick={() => setHomeTab("development")}
              className={`h-9 rounded-full px-4 gap-2 ${
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
              onClick={() => setHomeTab("help")}
              className={`h-9 rounded-full px-4 gap-2 ${
                homeTab === "help"
                  ? "bg-red-600 text-white hover:bg-red-500"
                  : "text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800"
              }`}
            >
              <CircleHelp className="w-4 h-4" />
              Помощь
            </Button>
          </div>
        </div>

        {homeTab === "play" && (
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-6 items-stretch">
          <motion.div
            custom={0}
            variants={cardVariants}
            initial="initial"
            animate="animate"
          >
            <Card className="rounded-[28px] shadow-sm border border-zinc-800 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 h-full text-zinc-100">
              <CardContent className="p-8 md:p-10 h-full flex flex-col justify-between gap-8">
                <div className="space-y-5">
                  <Badge className="rounded-full px-3 py-1 text-sm bg-red-600/90 hover:bg-red-600 text-white border-0">
                    Made By Berly
                  </Badge>
                  <div className="space-y-3">
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
                      СУД
                    </h1>
                    <p className="text-base md:text-lg text-zinc-400 max-w-xl">
                      Ролевая настольная игра о судебных разбирательствах.
                      Получите роль, изучите факты дела и попробуйте убедить
                      судью в своей правоте.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    { title: "3–6 игроков", sub: "Разные роли и режимы" },
                    { title: "Карты Механик", sub: "Дают особые возможности" },
                    { title: "Улики", sub: "Объективные и общие" },
                    { title: "Факты", sub: "Раскрываются по ходу суда" },
                  ].map((item, i) => (
                    <motion.div
                      key={item.title}
                      custom={i + 1}
                      variants={cardVariants}
                      initial="initial"
                      animate="animate"
                    >
                      <Card className="rounded-2xl bg-zinc-900/90 border-zinc-800 text-zinc-100">
                        <CardContent className="p-4">
                          <div className="font-semibold">{item.title}</div>
                          <div className="text-zinc-400 mt-1">{item.sub}</div>
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
          >
            <Card className="rounded-[28px] shadow-sm h-full bg-zinc-900/95 border-zinc-800 text-zinc-100">
              <CardContent className="p-8 md:p-10 space-y-6">
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

                <div className="flex items-center gap-4">
                  <div
                    className="relative cursor-pointer group flex-shrink-0"
                    onClick={() => avatarInputRef.current?.click()}
                  >
                    <Avatar src={avatar} name={playerName} size={52} />
                    <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Camera className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                  <div className="flex-1 space-y-2">
                    <label className="text-sm font-medium">Ваш никнейм</label>
                    <Input
                      value={playerName}
                      onChange={(e) => {
                        setPlayerName(e.target.value);
                        if (e.target.value.trim())
                          localStorage.setItem(
                            "court_nickname",
                            e.target.value.trim(),
                          );
                      }}
                      placeholder="Например: Артём"
                      className="h-11 rounded-xl bg-zinc-100 text-zinc-950 placeholder:text-zinc-400 border-0 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-0"
                    />
                  </div>
                </div>

                <div className="grid gap-3">
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    <Button
                      onClick={createRoom}
                      className="w-full h-12 rounded-xl text-base gap-2 bg-red-600 hover:bg-red-500 text-white border-0"
                    >
                      <UserPlus className="w-4 h-4" />
                      Создать комнату
                    </Button>
                  </motion.div>

                  <div className="flex gap-3">
                    <Input
                      value={joinCode}
                      onChange={(e) =>
                        setJoinCode(e.target.value.toUpperCase())
                      }
                      placeholder="Код комнаты"
                      className="h-12 rounded-xl bg-zinc-100 text-zinc-950 placeholder:text-zinc-400 border-0 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-0"
                      onKeyDown={(e) => e.key === "Enter" && joinRoom()}
                    />
                    <motion.div
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.97 }}
                    >
                      <Button
                        onClick={joinRoom}
                        variant="secondary"
                        disabled={!joinCode.trim()}
                        className="h-12 rounded-xl px-6 bg-zinc-100 text-zinc-950 hover:bg-zinc-200 border-0"
                      >
                        Войти
                      </Button>
                    </motion.div>
                  </div>

                  <AnimatePresence>
                    {hasSession && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.28 }}
                      >
                        <motion.div
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.97 }}
                        >
                          <Button
                            onClick={reconnect}
                            variant="outline"
                            className="w-full h-12 rounded-xl border-red-600/50 text-red-400 hover:bg-red-600/10 hover:text-red-300 gap-2"
                          >
                            ↩ Переподключиться к игре
                          </Button>
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="font-semibold">Функционал</div>
                  <div className="grid gap-2 text-sm text-zinc-400">
                    <div>• создайте комнату и поделитесь кодом с игроками</div>
                    <div>
                      • ведущий запускает игру и роли раздаются автоматически
                    </div>
                    <div>• каждый видит только свои факты и карты механик</div>
                    <div>
                      • раскрытые факты и использованные карты видят все
                    </div>
                    <div>• судья меняет этапы и выносит финальный вердикт</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
        )}

        {homeTab === "development" && (
          <div className="max-w-6xl mx-auto">
            <Card className="rounded-[28px] border-zinc-800 bg-zinc-900/95 text-zinc-100">
              <CardContent className="p-8 md:p-10 space-y-6">
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
                  {DEVLOG_ENTRIES.map((entry, index) => (
                    <motion.div
                      key={`${entry.date}-${entry.title}`}
                      custom={index}
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
      </motion.div>
    );
  }

  if (screen === "room" && room) {
    return (
      <motion.div
        key="room"
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className="min-h-screen bg-zinc-950 text-zinc-100 p-6 md:p-10"
      >
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
                  <div className="text-3xl font-bold tracking-[0.25em] text-red-400">
                    {room.code}
                  </div>
                  <div className="text-sm text-zinc-400">
                    Поделитесь кодом с другими игроками • 3–6 участников
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
                  {myId === room.hostId && (
                    <motion.div
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                    >
                      <Button
                        className="rounded-xl gap-2 bg-red-600 hover:bg-red-500 text-white border-0 disabled:bg-zinc-800 disabled:text-zinc-500"
                        onClick={startGame}
                        disabled={
                          startGameLoading ||
                          room.players.length < 3 ||
                          room.players.length > 6
                        }
                      >
                        <Play className="w-4 h-4" />
                        {startGameLoading ? "\u0417\u0430\u043f\u0443\u0441\u043a..." : "\u041d\u0430\u0447\u0430\u0442\u044c \u0438\u0433\u0440\u0443"}
                      </Button>
                    </motion.div>
                  )}
                  <Button
                    variant="outline"
                    className="rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-100"
                    onClick={resetAll}
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
                  <div className="flex items-center gap-3 px-3 py-1.5 rounded-xl border border-zinc-700 bg-zinc-800/60">
                    <label htmlFor="host-judge" className="text-sm font-medium text-zinc-200 cursor-pointer select-none">
                      Я - Судья
                    </label>
                    <Switch
                      id="host-judge"
                      checked={isHostJudge}
                      onCheckedChange={toggleHostJudge}
                    />
                  </div>
                ) : undefined}
              >
                <div className="grid gap-3">
                  <AnimatePresence>
                    {room.players.map((player) => (
                      <PlayerCard
                        key={player.id}
                        player={player}
                        isHost={player.id === room.hostId}
                        canKick={myId === room.hostId && player.id !== room.hostId}
                        onKick={() => kickPlayerFromRoom(player.id)}
                      />
                    ))}
                  </AnimatePresence>
                  {room.players.length < 3 && (
                    <div className="text-sm text-zinc-500 mt-2">
                      Ожидание игроков... (нужно ещё минимум{" "}
                      {3 - room.players.length})
                    </div>
                  )}
                </div>
              </InfoBlock>
              <TestPlayersPanel
                roomCode={room.code}
                currentPlayers={room.players.length}
                isHost={myId === room.hostId}
              />
            </motion.div>

            <motion.div
              custom={2}
              variants={cardVariants}
              initial="initial"
              animate="animate"
            >
              <InfoBlock
                title="Доступные режимы"
                icon={<Gavel className="w-5 h-5" />}
              >
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span>Игроков сейчас</span>
                    <Badge className="bg-zinc-800 text-zinc-100 border border-zinc-700">
                      {room.players.length}
                    </Badge>
                  </div>
                  <Separator />
                  {room.players.length === 3 && (
                    <div>Гражданский спор, трудовой спор</div>
                  )}
                  {room.players.length === 4 && <div>Уголовное дело</div>}
                  {room.players.length === 5 && <div>Уголовное дело</div>}
                  {room.players.length >= 6 && <div>Суд на компанию</div>}
                  <div className="text-zinc-400 pt-2">
                    Ведущий запускает игру, сайт случайно выбирает подходящее
                    дело и распределяет роли.
                  </div>
                </div>
              </InfoBlock>
            </motion.div>
          </div>
          <ContextHelp
            open={contextHelpOpen}
            onOpenChange={setContextHelpOpen}
            query={contextHelpQuery}
            onQueryChange={setContextHelpQuery}
          />
        </div>
      </motion.div>
    );
  }

  if (screen === "game" && game && game.me) {
    const gameStages =
      game.stages && game.stages.length > 0 ? game.stages : DEFAULT_GAME_STAGES;
    const currentStage = gameStages[game.stageIndex] ?? gameStages[0];
    const stageProgress = ((game.stageIndex + 1) / gameStages.length) * 100;
    const isHost = myId === game.hostId;
    const isJudge = game.me.roleKey === "judge";
    const isWitness = game.me.roleKey === "witness";
    const isObserverRole = isJudge || isWitness;
    const judgePlayer = game.players.find((p) => p.roleKey === "judge");
    const visibleFacts = game.revealedFacts.slice(-3);
    const visibleCards = game.usedCards.slice(-3);
    const latestUsedCardId =
      game.usedCards.length > 0
        ? game.usedCards[game.usedCards.length - 1].id
        : null;
    const isPreparationStage = isPreparationStageName(currentStage);
    const canRevealFactsAtCurrentStage = game.me.canRevealFactsNow === true;

    return (
      <motion.div
        key="game"
        variants={pageVariants}
        initial="initial"
        animate="animate"
        className="min-h-screen bg-zinc-950 text-zinc-100 p-6 md:p-10"
      >
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
                  <CardContent className="p-8 space-y-6 text-center">
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
            {disconnectAlert && (
              <motion.div
                key="disc"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="bg-yellow-500/15 border border-yellow-500/40 text-yellow-300 rounded-xl px-4 py-3 text-sm font-medium"
              >
                {disconnectAlert}
              </motion.div>
            )}
            {rejoinAlert && (
              <motion.div
                key="rej"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="bg-green-500/15 border border-green-500/40 text-green-300 rounded-xl px-4 py-3 text-sm font-medium"
              >
                ✓ {rejoinAlert}
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
                      onClick={resetAll}
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
                        className="flex items-center justify-between text-sm"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar src={p.avatar ?? null} name={p.name} size={32} />
                          <span className="text-zinc-300 truncate">{p.name}</span>
                        </div>
                        <span className="text-zinc-500">{p.roleTitle}</span>
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

            <InfoBlock title="Вердикт" icon={<Gavel className="w-5 h-5" />}>
              <div className="space-y-3">
                {isJudge ? (
                  <>
                    <div
                      className={`text-sm ${game.stageIndex < gameStages.length - 1 ? "text-zinc-500" : "text-zinc-400"}`}
                    >
                      {game.stageIndex < gameStages.length - 1
                        ? `Доступно на этапе «${gameStages[gameStages.length - 1]}»`
                        : "Финальный этап. Вынесите решение."}
                    </div>
                    {(
                      ["Виновен", "Не виновен", "Частично виновен"] as const
                    ).map((v, i) => (
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
                          className={`w-full rounded-xl border-0 disabled:bg-zinc-800 disabled:text-zinc-500 ${i === 0 ? "bg-red-600 hover:bg-red-500 text-white" : i === 1 ? "bg-zinc-100 text-zinc-950 hover:bg-zinc-200" : "bg-zinc-800 text-zinc-100 hover:bg-zinc-700"}`}
                          onClick={() => submitVerdict(v)}
                          disabled={
                            game.stageIndex < gameStages.length - 1 || game.finished
                          }
                        >
                          {v}
                        </Button>
                      </motion.div>
                    ))}
                  </>
                ) : (
                  <div className="text-sm text-zinc-400">
                    Вердикт выносит судья
                    {judgePlayer ? ` — ${judgePlayer.name}` : ""}.
                    {game.stageIndex < gameStages.length - 1 && (
                      <span className="block mt-1 text-zinc-500">
                        Дождитесь последнего этапа.
                      </span>
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
                        <Card className="rounded-2xl border-dashed border-zinc-700 bg-zinc-900/80 text-zinc-100">
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
                              <Badge className="bg-zinc-800 text-zinc-100 border border-zinc-700">
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
          <ContextHelp
            open={contextHelpOpen}
            onOpenChange={setContextHelpOpen}
            query={contextHelpQuery}
            onQueryChange={setContextHelpQuery}
          />
        </div>
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

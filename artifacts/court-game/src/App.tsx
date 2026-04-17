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
  BarChart3,
  BadgeCheck,
  Diamond,
  Flame,
  Users,
  ImageIcon,
  Mic2,
  BrainCircuit,
  Swords,
  Gem,
  BookOpenText,
  Menu,
  X,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SUBSCRIPTION_LABELS,
  SUBSCRIPTION_PLANS,
  canAccessPack,
  getRequiredTierForCapability,
  getRequiredTierForPack,
  hasCapability,
  normalizeSubscriptionTier,
  resolveSubscriptionView,
  type SubscriptionCapabilityKey,
  type SubscriptionDuration,
  type SubscriptionTier,
} from "@/subscriptions";

const DEFAULT_GAME_STAGES = [
  "Подготовка",
  "Выступление истца",
  "Выступление ответчика",
  "Перекрестный допрос",
  "Финальная речь истца",
  "Финальная речь ответчика",
  "Решение судьи",
];

const DiscordLogoIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d="M20.317 4.369A19.791 19.791 0 0 0 15.43 3c-.21.375-.455.88-.623 1.275a18.27 18.27 0 0 0-5.614 0A12.46 12.46 0 0 0 8.57 3a19.736 19.736 0 0 0-4.89 1.37C.587 9.046-.247 13.607.17 18.1a19.902 19.902 0 0 0 5.993 3.03 14.43 14.43 0 0 0 1.284-2.089 12.9 12.9 0 0 1-2.03-.97c.171-.128.338-.262.499-.4 3.918 1.84 8.165 1.84 12.037 0 .163.14.33.274.5.4a12.87 12.87 0 0 1-2.033.972c.37.73.799 1.426 1.285 2.087a19.857 19.857 0 0 0 5.996-3.03c.49-5.208-.837-9.727-3.384-13.73ZM8.02 15.337c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.95-2.418 2.155-2.418 1.216 0 2.17 1.095 2.157 2.418 0 1.334-.95 2.42-2.155 2.42Zm7.958 0c-1.184 0-2.156-1.085-2.156-2.419 0-1.333.95-2.418 2.155-2.418 1.216 0 2.17 1.095 2.157 2.418 0 1.334-.95 2.42-2.156 2.42Z" />
  </svg>
);

const GoogleLogoIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path
      fill="#EA4335"
      d="M12.24 10.285v3.94h5.516c-.237 1.275-.95 2.355-2.02 3.081l3.266 2.534c1.904-1.755 3-4.336 3-7.4 0-.7-.063-1.372-.179-2.024l-9.583-.131z"
    />
    <path
      fill="#34A853"
      d="M12 22c2.7 0 4.965-.895 6.62-2.428l-3.266-2.534c-.907.607-2.069.967-3.354.967-2.577 0-4.76-1.739-5.54-4.078H3.09v2.628A9.997 9.997 0 0 0 12 22z"
    />
    <path
      fill="#FBBC05"
      d="M6.46 13.927a5.996 5.996 0 0 1 0-3.854V7.445H3.09a10 10 0 0 0 0 9.11l3.37-2.628z"
    />
    <path
      fill="#4285F4"
      d="M12 6.005c1.468 0 2.786.505 3.824 1.496l2.866-2.866C16.96 3.036 14.696 2 12 2a9.997 9.997 0 0 0-8.91 5.445l3.37 2.628c.78-2.339 2.963-4.068 5.54-4.068z"
    />
  </svg>
);

type RoomModeKey =
  | "quick_flex"
  | "civil_3"
  | "criminal_4"
  | "criminal_5"
  | "company_6";

type AssignableRole =
  | "judge"
  | "plaintiff"
  | "defendant"
  | "defenseLawyer"
  | "prosecutor"
  | "plaintiffLawyer";

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
    title: "Уголовное дело (Среднее)",
    subtitle: "Режим с адвокатом ответчика.",
    maxPlayers: 4,
  },
  {
    key: "criminal_5",
    title: "Уголовное дело (Тяжкое)",
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

const ASSIGNABLE_ROLE_TITLES: Record<AssignableRole, string> = {
  judge: "Судья",
  plaintiff: "Истец",
  defendant: "Ответчик",
  defenseLawyer: "Адвокат ответчика",
  prosecutor: "Прокурор",
  plaintiffLawyer: "Адвокат истца",
};

const ROLE_KEYS_BY_PLAYERS: Record<number, AssignableRole[]> = {
  3: ["judge", "plaintiff", "defendant"],
  4: ["judge", "plaintiff", "defendant", "defenseLawyer"],
  5: ["judge", "plaintiff", "defendant", "defenseLawyer", "prosecutor"],
  6: ["judge", "plaintiff", "defendant", "defenseLawyer", "prosecutor", "plaintiffLawyer"],
};

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
const MAX_PROFILE_IMAGE_UPLOAD_BYTES = 6 * 1024 * 1024;
const MAX_PROFILE_GIF_UPLOAD_BYTES = 3 * 1024 * 1024;
const LOCAL_MEDIA_CACHE_MAX_CHARS = 350_000;
const SUBSCRIPTION_DURATION_UI_OPTIONS: Array<{
  key: Extract<SubscriptionDuration, "1_month" | "1_year">;
  label: string;
}> = [
  { key: "1_month", label: "1 месяц" },
  { key: "1_year", label: "1 год" },
];
type ShopPaymentCategory = "russia" | "crypto";
type ShopPaidTier = Exclude<SubscriptionTier, "free">;
type ShopPaidDuration = Extract<SubscriptionDuration, "1_month" | "1_year">;
type ShopPaymentMethod = {
  id: number;
  category: ShopPaymentCategory;
  providerCategory: "cis" | "crypto";
  title: string;
  previewGradient: string;
  logoUrl: string;
};

const SHOP_PAYMENT_SECTIONS: Array<{
  key: ShopPaymentCategory;
  title: string;
  description: string;
}> = [
  {
    key: "russia",
    title: "Россия",
    description: "Оплата через карты, СБП и локальные методы.",
  },
  {
    key: "crypto",
    title: "Криптовалюта",
    description: "USDT TRC20, ETH и TON через FreeKassa.",
  },
];

const SHOP_PAYMENT_METHODS: ShopPaymentMethod[] = [
  {
    id: 42,
    category: "russia",
    providerCategory: "cis",
    title: "СБП",
    previewGradient: "radial-gradient(110% 120% at 0% 0%, rgba(75,140,255,0.34), rgba(75,140,255,0.02) 62%)",
    logoUrl: "/payment-logos/sbp.svg",
  },
  {
    id: 4,
    category: "russia",
    providerCategory: "cis",
    title: "Visa",
    previewGradient: "radial-gradient(110% 120% at 0% 0%, rgba(69,119,255,0.30), rgba(69,119,255,0.02) 62%)",
    logoUrl: "/payment-logos/visa.svg",
  },
  {
    id: 8,
    category: "russia",
    providerCategory: "cis",
    title: "Mastercard",
    previewGradient: "radial-gradient(110% 120% at 0% 0%, rgba(244,119,41,0.30), rgba(244,119,41,0.02) 62%)",
    logoUrl: "/payment-logos/mastercard.svg",
  },
  {
    id: 12,
    category: "russia",
    providerCategory: "cis",
    title: "МИР",
    previewGradient: "radial-gradient(110% 120% at 0% 0%, rgba(41,197,143,0.30), rgba(41,197,143,0.02) 62%)",
    logoUrl: "/payment-logos/mir.svg",
  },
  {
    id: 15,
    category: "crypto",
    providerCategory: "crypto",
    title: "USDT TRC20",
    previewGradient: "radial-gradient(110% 120% at 0% 0%, rgba(29,184,146,0.34), rgba(29,184,146,0.02) 62%)",
    logoUrl: "/payment-logos/usdt-trc20.svg",
  },
  {
    id: 26,
    category: "crypto",
    providerCategory: "crypto",
    title: "Ethereum",
    previewGradient: "radial-gradient(110% 120% at 0% 0%, rgba(130,102,255,0.34), rgba(130,102,255,0.02) 62%)",
    logoUrl: "/payment-logos/ethereum.svg",
  },
  {
    id: 41,
    category: "crypto",
    providerCategory: "crypto",
    title: "TON",
    previewGradient: "radial-gradient(110% 120% at 0% 0%, rgba(59,130,246,0.34), rgba(59,130,246,0.02) 62%)",
    logoUrl: "/payment-logos/ton.svg",
  },
];
const SHOP_PRICE_MATRIX_RUB: Record<ShopPaidTier, Record<ShopPaidDuration, number>> = {
  trainee: { "1_month": 250, "1_year": 2500 },
  practitioner: { "1_month": 500, "1_year": 5000 },
  arbiter: { "1_month": 800, "1_year": 8000 },
};
type AdminPromoKind = "subscription" | "badge";
const ADMIN_PROMO_KIND_OPTIONS: Array<{ key: AdminPromoKind; label: string }> = [
  { key: "subscription", label: "Подписка" },
  { key: "badge", label: "Бейдж" },
];
const ADMIN_BADGE_PROMO_OPTIONS: Array<{ key: string; label: string }> = [
  { key: "sub_trainee", label: "Бейдж «Стажер»" },
  { key: "sub_practitioner", label: "Бейдж «Практик»" },
  { key: "sub_arbiter", label: "Бейдж «Арбитр»" },
  { key: "legend", label: "Бейдж «Легенда»" },
  { key: "media", label: "Бейдж «Медиа»" },
  { key: "host", label: "Бейдж «Ведущий»" },
  { key: "innovator", label: "Бейдж «Новатор»" },
  { key: "moderator", label: "Бейдж «Модератор»" },
  { key: "admin", label: "Бейдж «Администратор»" },
];

const LEGAL_DOCS = {
  privacy: {
    title: "Политика конфиденциальности CourtGame",
    updatedAt: "08 апреля 2026",
    intro:
      "Документ описывает, какие данные мы обрабатываем, зачем это нужно и как пользователь может управлять своей информацией.",
    sections: [
      {
        title: "1. Какие данные мы собираем",
        paragraphs: [
          "При регистрации и использовании аккаунта обрабатываются логин, email, никнейм, дата создания аккаунта, настройки профиля, данные авторизации и сведения о сессиях.",
          "Во время игры обрабатываются технические данные комнаты: код, участники, роли, выбранные паки, этапы матча, системные события и сообщения, отправленные пользователем в игровых чатах.",
          "Для подписочной системы обрабатываются статус подписки, тариф, период действия, история платежей, история продлений, а также история активации промокодов.",
        ],
      },
      {
        title: "2. Технические данные устройства",
        paragraphs: [
          "Для стабильной работы сервиса могут обрабатываться технические параметры подключения: IP-адрес, тип устройства, время запросов, диагностические коды ошибок и данные производительности.",
          "Эти данные используются только для обеспечения безопасности, защиты от злоупотреблений и улучшения стабильности платформы.",
        ],
      },
      {
        title: "3. Файлы cookie и локальное хранилище",
        paragraphs: [
          "Сайт может использовать технические cookie и локальное хранилище браузера для сохранения сессии, пользовательских настроек, состояния интерфейса и корректного восстановления подключения.",
          "Отключение cookie или очистка локального хранилища может повлиять на доступность отдельных функций.",
        ],
      },
      {
        title: "4. Цели обработки данных",
        paragraphs: [
          "Данные используются для авторизации, работы лобби и матчей, отображения профиля, работы подписок и платного функционала, анти-спама и технической диагностики ошибок.",
          "Подписочные и платежные данные используются для корректного предоставления доступа к функциям, продления тарифа, применения ограничений и выполнения финансовых операций.",
        ],
      },
      {
        title: "5. Сроки хранения",
        paragraphs: [
          "Данные аккаунта и игровая статистика хранятся в течение срока использования сервиса пользователем и разумного периода после прекращения использования для выполнения обязательств и обеспечения безопасности.",
          "Технические логи и журналы событий хранятся ограниченное время, необходимое для расследования инцидентов, предотвращения нарушений и поддержки стабильной работы.",
        ],
      },
      {
        title: "6. Передача данных третьим лицам",
        paragraphs: [
          "Данные не продаются и не передаются сторонним рекламным сетям.",
          "Передача может происходить только в рамках работы инфраструктуры проекта (хостинг/база данных) и только в объеме, необходимом для функционирования сервиса.",
        ],
      },
      {
        title: "7. Права пользователя",
        paragraphs: [
          "Пользователь может запросить уточнение, обновление или удаление данных аккаунта через администратора проекта.",
          "Пользователь может прекратить использование сервиса в любой момент; при этом отдельные данные могут храниться в объеме, требуемом законодательством и политикой безопасности.",
        ],
      },
      {
        title: "8. Защита данных",
        paragraphs: [
          "Доступ к персональным данным ограничен по роли и технической необходимости.",
          "Мы применяем организационные и технические меры для защиты данных от несанкционированного доступа, изменения, утраты или удаления.",
        ],
      },
      {
        title: "9. Изменения политики",
        paragraphs: [
          "Мы можем обновлять этот документ при изменении функционала или требований безопасности. Актуальная версия публикуется в интерфейсе сайта.",
        ],
      },
    ],
  },
  terms: {
    title: "Пользовательское соглашение CourtGame",
    updatedAt: "08 апреля 2026",
    intro:
      "Документ определяет правила использования сайта и игры, ответственность сторон и допустимое поведение пользователей.",
    sections: [
      {
        title: "1. Общие положения",
        paragraphs: [
          "Используя CourtGame, пользователь подтверждает согласие с правилами сервиса и обязуется соблюдать нормы поведения внутри игры и чатов.",
          "Сервис предоставляется в текущем виде с регулярными обновлениями и доработками.",
        ],
      },
      {
        title: "2. Аккаунт и безопасность",
        paragraphs: [
          "Пользователь отвечает за сохранность данных входа и действия, совершенные под его аккаунтом.",
          "Запрещено передавать аккаунт третьим лицам для обхода ограничений или манипуляций в рейтинге.",
        ],
      },
      {
        title: "3. Правила поведения",
        paragraphs: [
          "Запрещены оскорбления, угрозы, дискриминация, спам, массовый флуд и деструктивное поведение, мешающее ходу матча.",
          "Запрещены попытки взлома, эксплуатации багов, подмены данных клиента и любые действия, направленные на нарушение работы сервиса.",
          "Запрещается использовать сервис для обсуждения политических тем, политической агитации, пропаганды, разжигания общественной розни, а также для любых дискуссий, способных перевести игровой процесс в конфликт на политической почве.",
        ],
      },
      {
        title: "4. Подписки и доступ к функциям",
        paragraphs: [
          "Доступ к отдельным функциям зависит от уровня подписки. Отсутствие подписки может ограничивать использование рейтинга, паков и дополнительных настроек.",
          "После оплаты подписки доступ к функциям предоставляется в рамках выбранного тарифа и срока действия подписки.",
        ],
      },
      {
        title: "5. Платежи, продление и возвраты",
        paragraphs: [
          "Условия оплаты, продления, отмены подписки и возвратов регулируются правилами платежного процесса и применимым законодательством.",
          "Пользователь обязуется указывать корректные платежные данные и использовать только законные способы оплаты.",
        ],
      },
      {
        title: "6. Интеллектуальная собственность",
        paragraphs: [
          "Интерфейс, игровые материалы, логотипы, тексты и программный код защищены правом интеллектуальной собственности.",
          "Копирование, распространение или коммерческое использование материалов сервиса без разрешения правообладателя запрещено.",
        ],
      },
      {
        title: "7. Ограничение ответственности",
        paragraphs: [
          "Администрация проекта не несет ответственность за косвенные убытки, перерывы доступа, а также последствия использования сервиса вне его прямого назначения.",
          "В случае технических сбоев мы прикладываем разумные усилия для восстановления корректной работы в кратчайшие сроки.",
        ],
      },
      {
        title: "8. Модерация и санкции",
        paragraphs: [
          "За нарушение правил могут применяться предупреждения, ограничение функций, временная или постоянная блокировка аккаунта.",
          "Решения по спорным ситуациям принимаются администрацией на основании доступных логов и технических данных.",
        ],
      },
      {
        title: "9. Изменение условий",
        paragraphs: [
          "Мы можем обновлять условия пользовательского соглашения при изменении функционала сервиса, юридических требований или бизнес-процессов.",
          "Новая редакция вступает в силу с момента публикации в интерфейсе сайта, если иное не указано в тексте обновления.",
        ],
      },
      {
        title: "10. Применимое право",
        paragraphs: [
          "Споры, возникающие в связи с использованием сервиса, разрешаются в порядке, предусмотренном применимым законодательством.",
          "Перед обращением в суд стороны стремятся урегулировать спор в досудебном порядке через обращение в поддержку проекта.",
        ],
      },
      {
        title: "11. Дополнительные правила платформы",
        paragraphs: [
          "Запрещено использовать нецензурные ники.",
          "Запрещено размещать в профиле оскорбления, дискриминацию, экстремизм и нецензурную лексику.",
          "Запрещены попытки накрутки статистики и иных игровых показателей.",
          "Запрещены угрозы, домогательства, спам, массовый флуд, намеренная дезинформация и иные деструктивные действия, ухудшающие опыт других пользователей.",
          "Запрещены ложные обвинения, подделка сообщений, фальсификация данных и мошеннические действия.",
          "Запрещено искать и использовать уязвимости сервиса; обнаруженные уязвимости необходимо незамедлительно передавать администрации проекта по официальным каналам связи.",
        ],
      },
    ],
  },
  offer: {
    title: "Публичная оферта CourtGame",
    updatedAt: "17 апреля 2026",
    intro:
      "Настоящая оферта регулирует порядок приобретения подписки и платных функций CourtGame, условия оплаты, сроки доступа и иные существенные условия сделки.",
    sections: [
      {
        title: "1. Общие положения",
        paragraphs: [
          "Оферта адресована неограниченному кругу пользователей и считается принятой с момента оплаты подписки или активации платного доступа.",
          "Оплата означает полное и безоговорочное согласие пользователя с условиями оферты и сопутствующих документов сервиса.",
        ],
      },
      {
        title: "2. Предмет оферты",
        paragraphs: [
          "Сервис предоставляет пользователю ограниченное право доступа к выбранному подписочному тарифу на оплаченный срок.",
          "Состав функций зависит от активного тарифа и может быть изменен в рамках развития продукта при сохранении общей логики подписки.",
        ],
      },
      {
        title: "3. Стоимость и порядок оплаты",
        paragraphs: [
          "Стоимость подписки, срок действия и доступные способы оплаты указываются в интерфейсе магазина на момент оформления платежа.",
          "Оплата выполняется через подключенные платежные системы; сервис не хранит реквизиты банковских карт пользователя.",
        ],
      },
      {
        title: "4. Момент предоставления доступа",
        paragraphs: [
          "Доступ к подписке предоставляется после подтверждения успешной оплаты платежным провайдером.",
          "В случае временной задержки со стороны платежной системы доступ может быть активирован с небольшой технической паузой.",
        ],
      },
      {
        title: "5. Срок действия и продление",
        paragraphs: [
          "Подписка действует в течение оплаченного периода (например, 1 месяц или 1 год) с момента активации.",
          "Автопродление не применяется, если иное прямо не указано в интерфейсе оплаты.",
        ],
      },
      {
        title: "6. Возвраты и спорные платежи",
        paragraphs: [
          "Вопросы возврата рассматриваются индивидуально с учетом факта предоставления доступа и требований применимого законодательства.",
          "При оспаривании платежа сервис вправе временно ограничить платные функции до завершения проверки обстоятельств.",
        ],
      },
      {
        title: "7. Ответственность сторон",
        paragraphs: [
          "Сервис обязуется предоставить оплаченный доступ в рамках технических возможностей платформы.",
          "Пользователь обязуется указывать корректные данные и использовать только законные способы оплаты.",
        ],
      },
      {
        title: "8. Ограничение и отзыв подписки",
        paragraphs: [
          "Сервис вправе временно ограничить или отозвать подписку (полностью или частично) при нарушении правил платформы, выявлении мошеннических действий, попытках взлома, злоупотреблениях, оспаривании платежа (chargeback) или по требованию уполномоченных органов.",
          "При существенном нарушении условий сервиса доступ может быть прекращен без компенсации неиспользованного периода, если иное не предусмотрено применимым законодательством.",
          "Сервис вправе корректировать ошибочно выданный платный доступ, если он был активирован из-за технической ошибки, сбоя интеграции или некорректной оплаты.",
        ],
      },
      {
        title: "9. Изменение оферты",
        paragraphs: [
          "Сервис вправе обновлять условия оферты при изменении функционала, бизнес-процессов или юридических требований.",
          "Новая редакция вступает в силу с момента публикации в интерфейсе сайта, если в тексте не указано иное.",
        ],
      },
    ],
  },
} as const;

function getSubscriptionTierLabel(tier: SubscriptionTier): string {
  if (tier === "trainee") return "Стажер";
  if (tier === "practitioner") return "Практик";
  if (tier === "arbiter") return "Арбитр";
  return "Бесплатно";
}

const SUBSCRIPTION_TIER_PRIORITY: Record<SubscriptionTier, number> = {
  free: 0,
  trainee: 1,
  practitioner: 2,
  arbiter: 3,
};

function getHigherSubscriptionTier(a: SubscriptionTier, b: SubscriptionTier): SubscriptionTier {
  return SUBSCRIPTION_TIER_PRIORITY[a] >= SUBSCRIPTION_TIER_PRIORITY[b] ? a : b;
}

function isPackLockedForTier(
  pack: { key?: string; title?: string; isAdult?: boolean } | null | undefined,
  tier: SubscriptionTier,
): boolean {
  if (!pack) return false;
  return !canAccessPack(tier, {
    key: pack.key,
    title: pack.title,
    isAdult: pack.isAdult,
  });
}

function getCasePackVisual(packKey: string | undefined, packTitle: string | undefined): {
  card: string;
  countChip: string;
  vibe: string;
} {
  const key = (packKey ?? "").toLowerCase();
  const title = (packTitle ?? "").toLowerCase();
  const full = `${key} ${title}`;
  if (full.includes("medieval") || full.includes("средневек")) {
    return {
      card: "border-amber-600/60 bg-[radial-gradient(140%_90%_at_5%_0%,rgba(180,83,9,0.24),transparent_52%),radial-gradient(90%_70%_at_95%_100%,rgba(120,53,15,0.18),transparent_60%),linear-gradient(140deg,rgba(30,24,18,0.97),rgba(24,24,27,0.92))]",
      countChip: "border-amber-400/40 bg-amber-600/25 text-amber-100",
      vibe: "Хроники королевства",
    };
  }
  if (full.includes("18+")) {
    return {
      card: "border-fuchsia-700/60 bg-[radial-gradient(120%_90%_at_10%_0%,rgba(162,28,175,0.24),transparent_52%),linear-gradient(135deg,rgba(24,24,27,0.96),rgba(39,39,42,0.9))]",
      countChip: "border-fuchsia-400/40 bg-fuchsia-600/25 text-fuchsia-100",
      vibe: "Для взрослой аудитории",
    };
  }
  if (full.includes("hard") || full.includes("тяж") || full.includes("жест")) {
    return {
      card: "border-violet-700/60 bg-[radial-gradient(130%_90%_at_5%_0%,rgba(109,40,217,0.26),transparent_52%),radial-gradient(90%_70%_at_95%_100%,rgba(76,29,149,0.2),transparent_62%),linear-gradient(140deg,rgba(27,23,40,0.97),rgba(24,24,27,0.92))]",
      countChip: "border-violet-400/40 bg-violet-600/25 text-violet-100",
      vibe: "Максимальные ставки",
    };
  }
  if (full.includes("cyber") || full.includes("кибер")) {
    return {
      card: "border-cyan-700/65 bg-[radial-gradient(140%_90%_at_5%_0%,rgba(8,145,178,0.25),transparent_55%),radial-gradient(95%_70%_at_95%_100%,rgba(14,116,144,0.2),transparent_60%),linear-gradient(140deg,rgba(20,30,38,0.97),rgba(24,24,27,0.92))]",
      countChip: "border-cyan-400/40 bg-cyan-600/25 text-cyan-100",
      vibe: "Неон и корпорации",
    };
  }
  if (full.includes("запад") || full.includes("west")) {
    return {
      card: "border-orange-700/60 bg-[radial-gradient(140%_90%_at_5%_0%,rgba(194,65,12,0.26),transparent_52%),radial-gradient(95%_70%_at_95%_100%,rgba(154,52,18,0.2),transparent_62%),linear-gradient(140deg,rgba(39,24,17,0.97),rgba(24,24,27,0.92))]",
      countChip: "border-orange-400/40 bg-orange-600/25 text-orange-100",
      vibe: "Пыль и револьверы",
    };
  }
  if (full.includes("boys")) {
    return {
      card: "border-indigo-700/55 bg-[radial-gradient(140%_90%_at_5%_0%,rgba(99,102,241,0.2),transparent_56%),radial-gradient(95%_70%_at_95%_100%,rgba(67,56,202,0.18),transparent_62%),linear-gradient(140deg,rgba(32,34,48,0.97),rgba(24,24,27,0.92))]",
      countChip: "border-indigo-400/35 bg-indigo-600/25 text-indigo-100",
      vibe: "Сверхлюди и скандалы",
    };
  }
  if (full.includes("рим") || full.includes("roman")) {
    return {
      card: "border-yellow-700/60 bg-[radial-gradient(140%_90%_at_5%_0%,rgba(161,98,7,0.24),transparent_56%),radial-gradient(95%_70%_at_95%_100%,rgba(120,53,15,0.2),transparent_62%),linear-gradient(140deg,rgba(38,31,20,0.97),rgba(24,24,27,0.92))]",
      countChip: "border-yellow-400/40 bg-yellow-600/25 text-yellow-100",
      vibe: "Сенат и право",
    };
  }
  if (full.includes("classic") || full.includes("класс")) {
    return {
      card: "border-red-700/55 bg-[radial-gradient(140%_90%_at_5%_0%,rgba(127,29,29,0.24),transparent_56%),radial-gradient(95%_70%_at_95%_100%,rgba(127,29,29,0.18),transparent_62%),linear-gradient(140deg,rgba(34,21,23,0.97),rgba(24,24,27,0.92))]",
      countChip: "border-red-400/40 bg-red-600/25 text-red-100",
      vibe: "Классический суд",
    };
  }
  return {
    card: "border-zinc-700 bg-[radial-gradient(120%_90%_at_10%_0%,rgba(63,63,70,0.24),transparent_52%),linear-gradient(135deg,rgba(24,24,27,0.96),rgba(39,39,42,0.9))]",
    countChip: "border-zinc-500/50 bg-zinc-800/80 text-zinc-100",
    vibe: "Судебные дела",
  };
}

function getCasePackTitleDisplay(title: string | undefined): string {
  const normalized = (title ?? "").trim();
  if (normalized.toUpperCase() === "ОСОБО ТЯЖКИЕ ПРЕСТУПЛЕНИЯ") {
    return "ОСОБО ТЯЖКИЕ";
  }
  return (normalized || "ПАК").toUpperCase();
}

function getCasePackSortOrder(
  pack: { key?: string; title?: string; sortOrder?: number } | null | undefined,
): number {
  const key = (pack?.key ?? "").toLowerCase();
  const title = (pack?.title ?? "").toLowerCase();
  const full = `${key} ${title}`;
  if (full.includes("classic") || full.includes("класс")) return 0;
  if (
    full.includes("hard_cases") ||
    full.includes("особо тяж") ||
    full.includes("тяжк")
  )
    return 1;
  if (full.includes("18+")) return 2;
  if (full.includes("запад") || full.includes("west")) return 3;
  if (full.includes("средневек") || full.includes("medieval")) return 4;
  if (full.includes("cyberpunk")) return 5;
  if (full.includes("boys")) return 6;
  if (full.includes("рим") || full.includes("roman")) return 7;
  return typeof pack?.sortOrder === "number" ? pack.sortOrder + 100 : 999;
}

function getSubscriptionPlanBadgeKey(tier: SubscriptionTier): string | undefined {
  if (tier === "trainee") return "sub_trainee";
  if (tier === "practitioner") return "sub_practitioner";
  if (tier === "arbiter") return "sub_arbiter";
  return undefined;
}

function normalizeSubscriptionFeatureText(feature: string): string {
  const trimmed = feature.trim();
  const normalized = trimmed.toLowerCase().replace(/ё/g, "е");
  if (normalized.includes("выбор своей роли")) {
    return "Выбор роли хоста в своем лобби";
  }
  if (normalized.includes("разрешение игрокам выбирать роли")) {
    return "Выбор ролей игроками в лобби";
  }
  if (normalized.includes("подсветка комнаты")) {
    return "Выделение и приоритет комнаты";
  }
  return trimmed;
}

function getSubscriptionFeatureIcon(feature: string): LucideIcon {
  const normalized = feature.toLowerCase().replace(/ё/g, "е");
  if (normalized.includes("рейтинг") || normalized.includes("рангов")) return BarChart3;
  if (normalized.includes("баннер")) return ImageIcon;
  if (normalized.includes("игрок") || normalized.includes("роли")) return Users;
  if (normalized.includes("приват")) return Lock;
  if (normalized.includes("gif")) return Camera;
  if (normalized.includes("пак")) return ScrollText;
  if (normalized.includes("бейдж")) return BadgeCheck;
  if (normalized.includes("подсвет")) return Sparkles;
  if (normalized.includes("все из")) return Crown;
  if (normalized.includes("создание")) return Wrench;
  return Sparkles;
}

function getSubscriptionDurationLabel(duration: SubscriptionDuration | string): string {
  if (duration === "1_day") return "1 день";
  if (duration === "3_days") return "3 дня";
  if (duration === "7_days") return "7 дней";
  if (duration === "1_month") return "1 месяц";
  if (duration === "1_year") return "1 год";
  if (duration === "forever") return "Навсегда";
  return "1 месяц";
}

function getAdminBadgePromoLabel(key: string): string {
  const option = ADMIN_BADGE_PROMO_OPTIONS.find((item) => item.key === key);
  if (option) return option.label;
  return key;
}

function formatPromoDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const BADGE_ICONS: Record<string, LucideIcon> = {
  plaintiff: Scale,
  defendant: Shield,
  plaintiffLawyer: UserCircle2,
  defenseLawyer: Lock,
  prosecutor: ScrollText,
  judge: Gavel,
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
  subTrainee: BadgeCheck,
  subPractitioner: Diamond,
  subArbiter: Flame,
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
  subTrainee: {
    chip: "border-cyan-400/70 bg-cyan-500/18 text-cyan-100 shadow-[0_0_14px_rgba(34,211,238,0.24)]",
    icon: "bg-cyan-500/35 text-cyan-50 shadow-[0_0_10px_rgba(34,211,238,0.28)]",
    iconOnly: "text-cyan-200 drop-shadow-[0_0_6px_rgba(103,232,249,0.55)]",
  },
  subPractitioner: {
    chip: "border-red-400/70 bg-red-500/20 text-red-100 shadow-[0_0_16px_rgba(248,113,113,0.3)]",
    icon: "bg-red-500/35 text-red-50 shadow-[0_0_12px_rgba(248,113,113,0.35)]",
    iconOnly: "text-red-200 drop-shadow-[0_0_7px_rgba(252,165,165,0.55)]",
  },
  subArbiter: {
    chip: "border-emerald-400/70 bg-emerald-500/16 text-emerald-100 shadow-[0_0_16px_rgba(52,211,153,0.28)]",
    icon: "bg-emerald-500/35 text-emerald-50 shadow-[0_0_12px_rgba(52,211,153,0.34)]",
    iconOnly: "text-emerald-200 drop-shadow-[0_0_7px_rgba(167,243,208,0.55)]",
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
  const usedRaw = localStorage.getItem("court_guest_numbers_used");
  let parsed: unknown[] = [];
  if (usedRaw) {
    try {
      parsed = JSON.parse(usedRaw);
    } catch {
      parsed = [];
    }
  }
  const used = new Set<number>(
    parsed.filter((value): value is number => Number.isFinite(value)),
  );
  let randomPart = 0;
  for (let i = 0; i < 10000; i += 1) {
    const candidate = Math.floor(10000 + Math.random() * 90000);
    if (!used.has(candidate)) {
      randomPart = candidate;
      break;
    }
  }
  if (!randomPart) {
    randomPart = Date.now() % 100000;
  }
  used.add(randomPart);
  localStorage.setItem("court_guest_numbers_used", JSON.stringify([...used].slice(-5000)));
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
  const fallbackTitle =
    fallbackMaxPlayers <= 3
      ? "Гражданский спор / Трудовой спор"
      : fallbackMaxPlayers <= 5
        ? "Уголовное дело"
        : "Суд на компанию";
  return {
    key: "company_6" as RoomModeKey,
    title: fallbackTitle,
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
const LOADER_LOGO_SRC = "/favicon.png";

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

const CURRENT_VERSION = "Beta 0.5";
const DEVLOG_SEEN_STORAGE_KEY = "court_devlog_seen_version";

const DEVLOG_ENTRIES: DevLogEntry[] = [
  {
    date: "10.04.2026",
    version: CURRENT_VERSION,
    title: "Релиз Beta 0.5: профили, подписки и большое обновление систем",
    changes: [
      "Добавлен магазин и система подписок с новыми игровыми возможностями.",
      "Добавлены промокоды с активацией наград.",
      "Добавлены бейджи и их выдача по прогрессу/активностям.",
      "Добавлены личные профили игроков.",
      "Добавлена глубокая кастомизация профиля (аватар, баннер и оформление).",
      "Добавлен просмотр профилей других игроков прямо в интерфейсе игры.",
      "Добавлена игровая статистика игрока.",
      "Добавлена история матчей.",
      "Добавлен рейтинг и ранговая прогрессия.",
      "Добавлена система предпочитаемой роли игрока.",
      "Добавлен выбор роли в лобби с расширенной логикой доступа.",
      "Добавлены новые паки дел и переработан каталог паков.",
      "Сильно расширено управление комнатой для хоста.",
      "Добавлены наблюдатели в матчах и настройки их количества.",
      "Добавлены таймеры выступления и заключительной речи.",
      "Добавлен лимит протестов как отдельная настройка комнаты.",
      "Добавлена передача хоста другому игроку прямо из управления комнатой.",
      "Полностью переработана система инцидентов.",
      "Добавлена система блокировок и контроль нарушений.",
      "Добавлены юридические разделы: пользовательское соглашение и политика конфиденциальности.",
      "Переработано окно «Помощь»: структура, навигация и удобство чтения.",
      "Выполнен крупный редизайн интерфейсов и состояний по всему сайту, включая мобильную адаптацию.",
    ],
  },
  {
    date: "24.03.2026",
    version: "Beta 0.4.5",
    title: "Релиз Beta 0.4.5: стабильность комнат, протесты и интерфейс",
    changes: [
      "Добавлена серверная очистка зависших/старых комнат.",
      "Переработана механика протестов: активный протест, решение судьи (Принять/Отклонить), блокировка параллельных протестов.",
      "Свидетелям отключена кнопка «Протестую».",
      "Добавлены уведомления о применении карты механики.",
      "Полностью переработан блок «Предупреждения» у судьи.",
      "Улучшен приватный чат адвокат - клиент (размер, верстка, стабильность длинных сообщений).",
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
      "Добавлен приватный чат «адвокат - клиент».",
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
    <div className="relative space-y-4">
      <div className="pointer-events-none absolute -top-10 right-12 h-28 w-28 rounded-full bg-zinc-700/12 blur-3xl" />
      <div className="pointer-events-none absolute bottom-8 left-10 h-28 w-28 rounded-full bg-zinc-600/10 blur-3xl" />
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
          {groupedTopics.map((group, idx) => (
            <motion.div
              key={group.category}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24, delay: idx * 0.045, ease: "easeOut" }}
            >
              <AccordionItem value={group.category} className="border-0">
                <Card className="rounded-2xl border-zinc-800 bg-zinc-900 text-zinc-100 shadow-[0_10px_24px_rgba(0,0,0,0.24)]">
                <CardHeader className="p-0">
                  <AccordionTrigger className="relative h-16 px-5 py-0 text-zinc-100 hover:no-underline !justify-between text-left [&>svg]:right-5">
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
            </motion.div>
          ))}
        </Accordion>
      )}
    </div>
  );
}

interface PlayerInfo {
  id: string;
  userId?: string;
  subscriptionTier?: SubscriptionTier;
  name: string;
  isBot?: boolean;
  avatar?: string;
  banner?: string;
  selectedBadgeKey?: string;
  preferredRole?: AssignableRole | null;
  lobbyAssignedRole?: AssignableRole | null;
  roleAssignmentSource?: "auto_preference" | "manual" | "random" | null;
  rolePreferenceStatus?: "idle" | "assigned" | "conflict" | "unavailable";
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
  casePackKey?: string;
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
  hostSubscriptionTier?: SubscriptionTier;
  isPromoted?: boolean;
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
  preferredRole?: AssignableRole;
  adminRole?: "administrator" | "moderator" | null;
  ban?: {
    isBanned: boolean;
    isPermanent: boolean;
    bannedUntil: number | null;
    reason?: string;
  };
}

interface CasePackInfo {
  key: string;
  title: string;
  description: string;
  isAdult?: boolean;
  sortOrder?: number;
  caseCount?: number;
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
    category?: "rank" | "earned" | "manual" | "subscription";
    progressCurrent?: number;
    progressTarget?: number;
    progressLabel?: string;
  }>;
  selectedBadgeKey?: string;
  preferredRole?: AssignableRole;
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
    tier: SubscriptionTier | string;
    label: string;
    startAt?: number | null;
    endAt?: number | null;
    isLifetime?: boolean;
    source?: "manual" | "system" | string;
    duration?: SubscriptionDuration | string;
    isActive?: boolean;
    daysLeft?: number | null;
  };
}

interface AdminPromoCodeView {
  code: string;
  promoKind: AdminPromoKind;
  badgeKey: string | null;
  badgeKeys?: string[];
  tier: SubscriptionTier;
  duration: SubscriptionDuration;
  source: string;
  isActive: boolean;
  maxUses: number | null;
  usedCount: number;
  startsAt: string | null;
  expiresAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

interface AdminLookupUserView {
  id: string;
  login: string;
  email: string;
  nickname: string;
  createdAt: number;
  adminRole?: "owner" | "administrator" | "moderator" | null;
  ban?: {
    isBanned: boolean;
    isPermanent: boolean;
    bannedUntil: number | null;
    reason?: string;
  };
  subscription: {
    tier: SubscriptionTier | string;
    duration: SubscriptionDuration | string;
    isActive: boolean;
    daysLeft: number | null;
    isLifetime: boolean;
  };
}

type AdminAccessRole = "owner" | "administrator" | "moderator" | null;
type AdminPanelSection = "users" | "promos" | "staff" | "subscriptions" | "bots";

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
  openingSpeechTimerSec?: number | null;
  closingSpeechTimerSec?: number | null;
  protestLimitEnabled?: boolean;
  maxProtestsPerPlayer?: number | null;
  me: MyPlayer | null;
  code: string;
  hostId: string;
  venueUrl?: string;
}

interface RoomState {
  code: string;
  roomName?: string;
  modeKey?: RoomModeKey;
  casePackKey?: string;
  maxPlayers?: number;
  hostId: string;
  players: PlayerInfo[];
  started: boolean;
  isHostJudge?: boolean;
  usePreferredRoles?: boolean;
  allowWitnesses?: boolean;
  maxObservers?: number;
  openingSpeechTimerSec?: number | null;
  closingSpeechTimerSec?: number | null;
  protestLimitEnabled?: boolean;
  maxProtestsPerPlayer?: number | null;
  visibility?: "public" | "private";
  venueLabel?: string;
  venueUrl?: string;
  requiresPassword?: boolean;
  hostSubscriptionTier?: SubscriptionTier;
  isPromoted?: boolean;
  lobbyChat?: LobbyChatMessage[];
}

type GifCropTarget = "avatar" | "banner";
type GifCropMeta = {
  v: 1;
  kind: "gif_crop";
  src: string;
  target: GifCropTarget;
  zoom: number;
  focusX: number;
  focusY: number;
  flipX: boolean;
  displayRatioX?: number;
  displayRatioY?: number;
  offsetRatioX?: number;
  offsetRatioY?: number;
};

const GIF_CROP_PREFIX = "cgif1:";

function Avatar({
  src,
  name,
  size = 32,
}: {
  src: string | null;
  name: string;
  size?: number;
}) {
  const gifMeta = parseGifCropMeta(src);
  const finalSrc = gifMeta?.src ?? src;
  if (finalSrc && gifMeta?.target === "avatar") {
    const hasPreciseRatios =
      typeof gifMeta.displayRatioX === "number" &&
      Number.isFinite(gifMeta.displayRatioX) &&
      gifMeta.displayRatioX > 0 &&
      typeof gifMeta.displayRatioY === "number" &&
      Number.isFinite(gifMeta.displayRatioY) &&
      gifMeta.displayRatioY > 0 &&
      typeof gifMeta.offsetRatioX === "number" &&
      Number.isFinite(gifMeta.offsetRatioX) &&
      typeof gifMeta.offsetRatioY === "number" &&
      Number.isFinite(gifMeta.offsetRatioY);
    const mediaWidth = hasPreciseRatios
      ? size * (gifMeta.displayRatioX ?? 1)
      : size;
    const mediaHeight = hasPreciseRatios
      ? size * (gifMeta.displayRatioY ?? 1)
      : size;
    const offsetXPx = hasPreciseRatios
      ? size * (gifMeta.offsetRatioX ?? 0)
      : 0;
    const offsetYPx = hasPreciseRatios
      ? size * (gifMeta.offsetRatioY ?? 0)
      : 0;
    return (
      <div
        className="relative overflow-hidden rounded-full flex-shrink-0 border border-zinc-700"
        style={{ width: size, height: size }}
      >
        <img
          src={finalSrc}
          alt={name}
          className="absolute left-1/2 top-1/2 max-w-none select-none pointer-events-none"
          style={{
            width: mediaWidth,
            height: mediaHeight,
            objectFit: "cover",
            objectPosition: hasPreciseRatios ? "50% 50%" : `${gifMeta.focusX}% ${gifMeta.focusY}%`,
            transform: hasPreciseRatios
              ? `translate(calc(-50% + ${offsetXPx}px), calc(-50% + ${offsetYPx}px)) scaleX(${gifMeta.flipX ? -1 : 1})`
              : `translate(-50%, -50%) ${gifMeta.flipX ? "scaleX(-1) " : ""}scale(${gifMeta.zoom})`,
            transformOrigin: hasPreciseRatios ? "center center" : `${gifMeta.focusX}% ${gifMeta.focusY}%`,
          }}
        />
      </div>
    );
  }
  if (finalSrc) {
    return (
      <img
        src={finalSrc}
        alt={name}
        className="rounded-full object-cover flex-shrink-0 border border-zinc-700"
        style={{
          width: size,
          height: size,
        }}
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

function encodeGifCropMeta(meta: GifCropMeta): string {
  try {
    const json = JSON.stringify(meta);
    return `${GIF_CROP_PREFIX}${btoa(json)}`;
  } catch {
    return meta.src;
  }
}

function parseGifCropMeta(value: string | null | undefined): GifCropMeta | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith(GIF_CROP_PREFIX)) return null;
  try {
    const encoded = trimmed.slice(GIF_CROP_PREFIX.length);
    const decoded = atob(encoded);
    const parsed = JSON.parse(decoded) as Partial<GifCropMeta>;
    if (parsed?.kind !== "gif_crop" || parsed?.v !== 1 || typeof parsed.src !== "string") {
      return null;
    }
    const zoom = Number(parsed.zoom);
    const focusX = Number(parsed.focusX);
    const focusY = Number(parsed.focusY);
    const displayRatioX = Number(parsed.displayRatioX);
    const displayRatioY = Number(parsed.displayRatioY);
    const offsetRatioX = Number(parsed.offsetRatioX);
    const offsetRatioY = Number(parsed.offsetRatioY);
    return {
      v: 1,
      kind: "gif_crop",
      src: parsed.src,
      target: parsed.target === "avatar" ? "avatar" : "banner",
      zoom: Number.isFinite(zoom) ? Math.max(1, Math.min(3, zoom)) : 1,
      focusX: Number.isFinite(focusX) ? Math.max(0, Math.min(100, focusX)) : 50,
      focusY: Number.isFinite(focusY) ? Math.max(0, Math.min(100, focusY)) : 50,
      flipX: !!parsed.flipX,
      displayRatioX: Number.isFinite(displayRatioX) ? Math.max(0.1, Math.min(10, displayRatioX)) : undefined,
      displayRatioY: Number.isFinite(displayRatioY) ? Math.max(0.1, Math.min(10, displayRatioY)) : undefined,
      offsetRatioX: Number.isFinite(offsetRatioX) ? Math.max(-5, Math.min(5, offsetRatioX)) : undefined,
      offsetRatioY: Number.isFinite(offsetRatioY) ? Math.max(-5, Math.min(5, offsetRatioY)) : undefined,
    };
  } catch {
    return null;
  }
}

function isAnimatedProfileMediaValue(value: string | null | undefined): boolean {
  if (!value || typeof value !== "string") return false;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return false;
  if (trimmed.startsWith(GIF_CROP_PREFIX.toLowerCase())) return true;
  if (trimmed.startsWith("data:image/gif")) return true;
  return trimmed.includes(".gif");
}

function getBannerStyle(
  banner: string | null | undefined,
  _avatar: string | null | undefined,
  _seedName: string,
): React.CSSProperties {
  const normalizedBanner = typeof banner === "string" ? banner.trim() : "";
  const gifMeta = parseGifCropMeta(normalizedBanner);
  if (gifMeta?.target === "banner") {
    return {
      backgroundImage: `url(${gifMeta.src})`,
      backgroundSize: `${Math.max(100, gifMeta.zoom * 100)}%`,
      backgroundPosition: `${gifMeta.focusX}% ${gifMeta.focusY}%`,
      backgroundRepeat: "no-repeat",
    };
  }
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
  observer: "Наблюдатель",
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
const AVATAR_CROP_VIEW_SIZE = 320;
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
    sub_trainee: "subTrainee",
    sub_practitioner: "subPractitioner",
    sub_arbiter: "subArbiter",
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
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    token?: string | null;
    body?: unknown;
    headers?: Record<string, string>;
  },
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method: options?.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        ...(options?.token ? { Authorization: `Bearer ${options.token}` } : {}),
        ...(options?.headers ?? {}),
      },
      body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new Error("Не удалось выполнить запрос. Проверьте подключение.");
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 413) {
      throw new Error("Файл слишком большой. Уменьшите размер изображения.");
    }
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
  if (normalized.includes("password must be at least 8")) {
    return "Пароль должен быть не короче 8 символов.";
  }
  if (normalized.includes("password must be at least 6")) {
    return "Пароль должен быть не короче 8 символов.";
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
    return "Нужно принять пользовательское соглашение.";
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
  if (normalized.includes("invalid subscription plan")) {
    return "Выберите корректный тариф подписки.";
  }
  if (normalized.includes("invalid payment region")) {
    return "Выберите категорию оплаты.";
  }
  if (normalized.includes("invalid payment method")) {
    return "Выберите способ оплаты.";
  }
  if (normalized.includes("method is not available")) {
    return "Этот способ оплаты сейчас недоступен.";
  }
  if (normalized.includes("europe payment provider is not available")) {
    return "Оплата для Европы будет добавлена позже.";
  }
  if (normalized.includes("freekassa is not configured")) {
    return "Платежный шлюз еще не настроен на сервере.";
  }
  if (normalized.includes("failed to connect to freekassa")) {
    return "Не удалось связаться с платежным шлюзом. Попробуйте позже.";
  }
  if (normalized.includes("returned an error while creating payment")) {
    return "Платежный шлюз вернул ошибку при создании оплаты.";
  }
  if (normalized.includes("merchant api key not exist")) {
    return "На сервере указан неверный API-ключ кассы.";
  }
  if (normalized.includes("invalid merchant")) {
    return "На сервере указан неверный ID кассы.";
  }
  if (normalized.includes("merchant is blocked")) {
    return "Касса временно недоступна. Обратитесь в поддержку.";
  }
  if (normalized.includes("did not return checkout url")) {
    return "Платежный шлюз не вернул ссылку на оплату.";
  }
  if (normalized.includes("not found")) {
    return "Не найдено.";
  }
  if (
    normalized.includes("quota exceeded") ||
    normalized.includes("quotaexceeded") ||
    normalized.includes("storage quota")
  ) {
    return "Файл слишком большой для локального кэша браузера. Попробуйте GIF меньшего размера.";
  }
  if (
    normalized.includes("value too long for type character varying") ||
    normalized.includes("request entity too large")
  ) {
    return "Файл слишком большой. Выберите GIF меньшего размера.";
  }
  return "Произошла ошибка. Попробуйте снова.";
}

function extractCooldownSeconds(message: string): number | null {
  const ruMatch = message.match(/через\s+(\d+)\s*сек/i);
  if (ruMatch?.[1]) {
    return Math.max(1, Number(ruMatch[1]) || 0);
  }
  const enMatch = message.match(/in\s+(\d+)\s*sec/i);
  if (enMatch?.[1]) {
    return Math.max(1, Number(enMatch[1]) || 0);
  }
  return null;
}

function safeSetLocalStorageItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function safeRemoveLocalStorageItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function persistMediaToLocalCache(key: string, value: string | null | undefined): void {
  if (!value) {
    safeRemoveLocalStorageItem(key);
    return;
  }
  if (value.length > LOCAL_MEDIA_CACHE_MAX_CHARS) {
    // Крупные dataURL оставляем только в БД/состоянии, не кладем в localStorage.
    safeRemoveLocalStorageItem(key);
    return;
  }
  safeSetLocalStorageItem(key, value);
}

function persistAuthUserToLocalCache(user: AuthUser): void {
  const cachedUser: AuthUser = { ...user };
  if (cachedUser.avatar && cachedUser.avatar.length > LOCAL_MEDIA_CACHE_MAX_CHARS) {
    cachedUser.avatar = undefined;
  }
  if (cachedUser.banner && cachedUser.banner.length > LOCAL_MEDIA_CACHE_MAX_CHARS) {
    cachedUser.banner = undefined;
  }
  const serialized = JSON.stringify(cachedUser);
  if (!safeSetLocalStorageItem(AUTH_USER_STORAGE_KEY, serialized)) {
    const minimalUser: AuthUser = { ...cachedUser, avatar: undefined, banner: undefined };
    safeSetLocalStorageItem(AUTH_USER_STORAGE_KEY, JSON.stringify(minimalUser));
  }
}

function isBanStateActive(
  ban: AuthUser["ban"] | null | undefined,
  nowMs: number,
): ban is NonNullable<AuthUser["ban"]> {
  if (!ban?.isBanned) return false;
  if (ban.isPermanent) return true;
  if (typeof ban.bannedUntil !== "number") return false;
  return ban.bannedUntil > nowMs;
}

function getBanCountdownParts(msLeft: number): {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
} {
  const totalSeconds = Math.max(0, Math.floor(msLeft / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds };
}

function formatSubscriptionTimeLeftLabel(
  subscription: {
    isLifetime?: boolean;
    endAt?: number | null;
    daysLeft?: number | null;
    tier?: SubscriptionTier | string;
  },
  nowMs: number,
): string {
  const normalizedTier = normalizeSubscriptionTier(subscription.tier);
  if (normalizedTier === "free") return "Бесплатный доступ";
  if (subscription.isLifetime) return "Навсегда";
  const endAtMs =
    typeof subscription.endAt === "number" && Number.isFinite(subscription.endAt)
      ? subscription.endAt
      : null;
  if (endAtMs !== null) {
    const msLeft = Math.max(0, endAtMs - nowMs);
    const totalHours = Math.max(1, Math.ceil(msLeft / (60 * 60 * 1000)));
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    if (totalHours <= 24 || days <= 1) {
      return `Осталось: ${totalHours} ч`;
    }
    return `Осталось: ${days} д ${hours} ч`;
  }
  if (typeof subscription.daysLeft === "number" && Number.isFinite(subscription.daysLeft)) {
    if (subscription.daysLeft <= 1) {
      return "Осталось: до 24 ч";
    }
    return `Осталось: ${subscription.daysLeft} д`;
  }
  return "Срок уточняется";
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

function getLobbyAssignableRoles(
  modeKey: RoomModeKey | undefined,
  activePlayersCount: number,
  maxPlayers: number,
): AssignableRole[] {
  if (modeKey === "quick_flex") {
    const count = Math.max(3, Math.min(maxPlayers, activePlayersCount));
    return ROLE_KEYS_BY_PLAYERS[count] ?? ROLE_KEYS_BY_PLAYERS[3];
  }
  const modeMeta = getRoomModeMeta(modeKey, maxPlayers);
  return ROLE_KEYS_BY_PLAYERS[modeMeta.maxPlayers] ?? ROLE_KEYS_BY_PLAYERS[3];
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
        ?
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
  category?: "rank" | "earned" | "manual" | "subscription";
}): "rank" | "earned" | "manual" | "subscription" {
  if (badge.category) return badge.category;
  if (badge.key.startsWith("rank_")) return "rank";
  if (badge.key.startsWith("sub_")) return "subscription";
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
  showLobbyAssignedRole = false,
  canKick = false,
  rolePickerButton,
  onKick,
  onOpenProfile,
  nowTs,
}: {
  player: PlayerInfo;
  isHost: boolean;
  showLobbyAssignedRole?: boolean;
  canKick?: boolean;
  rolePickerButton?: {
    label: string;
    hint?: string;
    locked?: boolean;
    onClick: () => void;
  } | null;
  onKick?: () => void;
  onOpenProfile?: (payload: {
    playerId: string;
    userId?: string;
    name: string;
    avatar?: string;
    banner?: string;
    selectedBadgeKey?: string;
  }) => void;
  nowTs: number;
}) {
  const canOpenProfile = !!player.userId && !!onOpenProfile;
  const badgeTheme = getBadgeTheme(player.selectedBadgeKey);
  const disconnectRemainingMs =
    typeof player.disconnectedUntil === "number"
      ? Math.max(0, player.disconnectedUntil - nowTs)
      : 0;
  const isDisconnected = disconnectRemainingMs > 0;
  const playerRoleLabel = showLobbyAssignedRole
    ? player.lobbyAssignedRole
      ? ASSIGNABLE_ROLE_TITLES[player.lobbyAssignedRole]
      : "Случайная"
    : isHost
      ? "Ведущий комнаты"
      : player.roleKey === "witness"
        ? "Свидетель"
        : player.roleKey === "observer"
          ? "Наблюдатель"
          : "Игрок";
  const disconnectProgress = isDisconnected
    ? 1 - Math.min(1, disconnectRemainingMs / RECONNECT_GRACE_MS)
    : 1;
  const red = Math.round(239 + (113 - 239) * disconnectProgress);
  const green = Math.round(68 + (113 - 68) * disconnectProgress);
  const blue = Math.round(68 + (122 - 68) * disconnectProgress);
  const doorColor = `rgb(${red}, ${green}, ${blue})`;
  return (
    <motion.div variants={cardVariants} initial="initial" animate="animate">
      <Card className="rounded-2xl shadow-sm bg-zinc-900/90 text-zinc-100 border-zinc-800">
        <CardContent className="relative overflow-hidden p-4 pt-5 flex items-center justify-between gap-3">
          <div
            className="pointer-events-none absolute inset-[6px] rounded-[16px] opacity-85"
            style={getBannerStyle(player.banner, player.avatar, player.name)}
          />
          <div className="pointer-events-none absolute inset-[6px] rounded-[16px] bg-black/35" />
          <button
            type="button"
            disabled={!canOpenProfile}
            onClick={() =>
              canOpenProfile &&
              onOpenProfile?.({
                playerId: player.id,
                userId: player.userId,
                name: player.name,
                avatar: player.avatar,
                banner: player.banner,
                selectedBadgeKey: player.selectedBadgeKey,
              })
            }
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
                    className={`inline-flex h-6 w-6 shrink-0 self-center items-center justify-center rounded-md ${badgeTheme.icon}`}
                  >
                    <BadgeGlyph badgeKey={player.selectedBadgeKey} className="h-3.5 w-3.5" />
                  </span>
                ) : null}
              </div>
              <div
                className="text-sm text-zinc-200"
                style={{ textShadow: "0 1px 2px rgba(0,0,0,0.85), 0 0 10px rgba(0,0,0,0.45)" }}
              >
                {playerRoleLabel}
              </div>
            </div>
          </button>
          <div className="relative z-10 flex items-center gap-2">
            {rolePickerButton ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                title={rolePickerButton.hint}
                className={`h-8 rounded-full border px-3 text-zinc-100 transition ${
                  rolePickerButton.locked
                    ? "border-zinc-700 bg-zinc-900/75 text-zinc-300 hover:bg-zinc-800"
                    : "border-zinc-700 bg-zinc-900/80 hover:bg-zinc-800"
                }`}
                onClick={rolePickerButton.onClick}
              >
                {rolePickerButton.locked && <Lock className="mr-1 h-3.5 w-3.5" />}
                {rolePickerButton.label}
              </Button>
            ) : null}
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

type HomeTab = "play" | "shop" | "development" | "help";

function ContextHelp({
  open,
  onOpenChange,
  query,
  onQueryChange,
  floatingOffsetClass = "bottom-5",
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  query: string;
  onQueryChange: (value: string) => void;
  floatingOffsetClass?: string;
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
          className={`fixed right-5 ${floatingOffsetClass} left-auto z-40 h-11 rounded-2xl px-3.5 inline-flex items-center gap-2 border backdrop-blur-md shadow-[0_12px_30px_rgba(0,0,0,0.45)] transition-colors ${
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
  const [logoFailed, setLogoFailed] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const preload = new Image();
    preload.decoding = "async";
    preload.src = LOADER_LOGO_SRC;
    preload.onerror = () => setLogoFailed(true);
    // Держим ссылку на Image в window, чтобы logo не выгружался из памяти между экранами.
    (window as any).__courtLoaderLogo = preload;
  }, []);
  if (typeof document === "undefined") return null;
  return createPortal(
    <>
      <img
        src={LOADER_LOGO_SRC}
        alt=""
        aria-hidden
        className="pointer-events-none fixed h-0 w-0 opacity-0"
      />
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
              {logoFailed ? (
                <motion.div
                  className="relative z-10 grid h-32 w-32 place-items-center rounded-full border border-zinc-700 bg-zinc-900/80 text-zinc-100 drop-shadow-[0_0_24px_rgba(248,113,113,0.35)]"
                  animate={{ rotate: [0, 3, 0, -3, 0] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                >
                  <Scale className="h-12 w-12" />
                </motion.div>
              ) : (
                <motion.img
                  src={LOADER_LOGO_SRC}
                  alt="CourtGame"
                  className="relative z-10 h-32 w-32 select-none drop-shadow-[0_0_24px_rgba(248,113,113,0.42)]"
                  animate={{ rotate: [0, 3, 0, -3, 0] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                  onError={() => setLogoFailed(true)}
                  loading="eager"
                  decoding="async"
                  fetchPriority="high"
                />
              )}
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
      </AnimatePresence>
    </>,
    document.body,
  );
}

export default function App() {
  const [screen, setScreen] = useState<"home" | "profile" | "room" | "game">(
    "home",
  );
  const [homeTab, setHomeTab] = useState<HomeTab>("play");
  const [, setHasUnseenDevlog] = useState(() => {
    try {
      return localStorage.getItem(DEVLOG_SEEN_STORAGE_KEY) !== CURRENT_VERSION;
    } catch {
      return true;
    }
  });
  const [shopDuration, setShopDuration] = useState<
    Extract<SubscriptionDuration, "1_month" | "1_year">
  >("1_month");
  const [shopPriceRevealReady, setShopPriceRevealReady] = useState(true);
  const [promoDialogOpen, setPromoDialogOpen] = useState(false);
  const [promoCodeInput, setPromoCodeInput] = useState("");
  const [promoCodeLoading, setPromoCodeLoading] = useState(false);
  const [promoCodeResult, setPromoCodeResult] = useState<{
    kind: "success" | "error";
    text: string;
    rewards?: Array<{ type: "subscription" | "badge"; label: string }>;
  } | null>(null);
  const [promoRewardsDialogOpen, setPromoRewardsDialogOpen] = useState(false);
  const [promoRewardsResult, setPromoRewardsResult] = useState<{
    text: string;
    rewards: Array<{ type: "subscription" | "badge"; label: string }>;
  } | null>(null);
  const [shopPaymentDialogOpen, setShopPaymentDialogOpen] = useState(false);
  const [shopPaymentTier, setShopPaymentTier] = useState<ShopPaidTier | null>(null);
  const [shopPaymentLoading, setShopPaymentLoading] = useState(false);
  const [shopPaymentError, setShopPaymentError] = useState("");
  const [loaderForceHidden, setLoaderForceHidden] = useState(false);
  const [adminToolsOpen, setAdminToolsOpen] = useState(false);
  const [adminPanelKey, setAdminPanelKey] = useState(
    () => localStorage.getItem("court_admin_panel_key") ?? "",
  );
  const [adminPanelKeyVisible, setAdminPanelKeyVisible] = useState(false);
  const [adminPromoCodeDraft, setAdminPromoCodeDraft] = useState("");
  const [adminPromoKind, setAdminPromoKind] = useState<AdminPromoKind>("subscription");
  const [adminPromoBadgeKey, setAdminPromoBadgeKey] = useState("sub_trainee");
  const [adminPromoBadgeKeys, setAdminPromoBadgeKeys] = useState<string[]>([]);
  const [adminPromoTier, setAdminPromoTier] = useState<SubscriptionTier>("trainee");
  const [adminPromoDuration, setAdminPromoDuration] = useState<SubscriptionDuration>("1_month");
  const [adminPromoMaxUses, setAdminPromoMaxUses] = useState("");
  const [adminPromoStartsAt, setAdminPromoStartsAt] = useState("");
  const [adminPromoExpiresAt, setAdminPromoExpiresAt] = useState("");
  const [adminPromoIsActive, setAdminPromoIsActive] = useState(true);
  const [adminAccessGranted, setAdminAccessGranted] = useState(false);
  const [adminAccessLoading, setAdminAccessLoading] = useState(false);
  const [adminAccessRole, setAdminAccessRole] = useState<AdminAccessRole>(null);
  const [adminSessionToken, setAdminSessionToken] = useState<string | null>(null);
  const [adminPanelSection, setAdminPanelSection] = useState<AdminPanelSection>("users");
  const [adminUserLookupQuery, setAdminUserLookupQuery] = useState("");
  const [adminUserLookupLoading, setAdminUserLookupLoading] = useState(false);
  const [adminUserLookupResult, setAdminUserLookupResult] = useState<AdminLookupUserView | null>(null);
  const [adminModerationNickname, setAdminModerationNickname] = useState("");
  const [adminModerationLoading, setAdminModerationLoading] = useState(false);
  const [adminStaffTargetUserId, setAdminStaffTargetUserId] = useState("");
  const [adminStaffTargetRole, setAdminStaffTargetRole] = useState<"moderator" | "administrator">(
    "moderator",
  );
  const [adminStaffLoading, setAdminStaffLoading] = useState(false);
  const [adminSubscriptionUserId, setAdminSubscriptionUserId] = useState("");
  const [adminSubscriptionTier, setAdminSubscriptionTier] = useState<SubscriptionTier>("trainee");
  const [adminSubscriptionDuration, setAdminSubscriptionDuration] =
    useState<SubscriptionDuration>("1_month");
  const [adminSubscriptionLoading, setAdminSubscriptionLoading] = useState(false);
  const [adminBanUserId, setAdminBanUserId] = useState("");
  const [adminBanDays, setAdminBanDays] = useState("7");
  const [adminBanForever, setAdminBanForever] = useState(false);
  const [adminBanReason, setAdminBanReason] = useState("");
  const [adminBanLoading, setAdminBanLoading] = useState(false);
  const [adminPromos, setAdminPromos] = useState<AdminPromoCodeView[]>([]);
  const [adminPromoLoading, setAdminPromoLoading] = useState(false);
  const [adminPromoListLoading, setAdminPromoListLoading] = useState(false);
  const [adminPromoActionCode, setAdminPromoActionCode] = useState<string | null>(null);
  const [adminPromoFeedback, setAdminPromoFeedback] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);
  const [legalDialogType, setLegalDialogType] = useState<keyof typeof LEGAL_DOCS | null>(null);
  const [upsellModalOpen, setUpsellModalOpen] = useState(false);
  const [upsellTitle, setUpsellTitle] = useState("Функция недоступна");
  const [upsellDescription, setUpsellDescription] = useState("");
  const [upsellRequiredTier, setUpsellRequiredTier] =
    useState<SubscriptionTier>("trainee");
  const [profileSubscriptionHighlight, setProfileSubscriptionHighlight] = useState(0);
  const [profileSubscriptionHighlightPending, setProfileSubscriptionHighlightPending] = useState(false);
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
  const [preferredRoleDraft, setPreferredRoleDraft] = useState<AssignableRole | "">("");
  const [preferredRolePickerOpen, setPreferredRolePickerOpen] = useState(false);
  const [profileNicknameError, setProfileNicknameError] = useState("");
  const [profileBirthDateError, setProfileBirthDateError] = useState("");
  const [profileHideAge, setProfileHideAge] = useState(false);
  const [emailChangeCurrentPassword, setEmailChangeCurrentPassword] = useState("");
  const [emailChangeNext, setEmailChangeNext] = useState("");
  const [emailChangeCode, setEmailChangeCode] = useState("");
  const [emailChangeCodeSent, setEmailChangeCodeSent] = useState(false);
  const [emailChangeNotice, setEmailChangeNotice] = useState("");
  const [emailChangeNoticeKind, setEmailChangeNoticeKind] = useState<"info" | "success" | "error">("info");
  const [emailChangeCooldownUntil, setEmailChangeCooldownUntil] = useState(0);
  const [showEmailChangeCurrentPassword, setShowEmailChangeCurrentPassword] = useState(false);
  const [passwordChangeNext, setPasswordChangeNext] = useState("");
  const [passwordChangeConfirm, setPasswordChangeConfirm] = useState("");
  const [passwordChangeCode, setPasswordChangeCode] = useState("");
  const [passwordChangeCodeSent, setPasswordChangeCodeSent] = useState(false);
  const [passwordChangeNotice, setPasswordChangeNotice] = useState("");
  const [passwordChangeNoticeKind, setPasswordChangeNoticeKind] = useState<"info" | "success" | "error">(
    "info",
  );
  const [passwordChangeCooldownUntil, setPasswordChangeCooldownUntil] = useState(0);
  const [showPasswordChangeNext, setShowPasswordChangeNext] = useState(false);
  const [showPasswordChangeConfirm, setShowPasswordChangeConfirm] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [passwordRecoveryDialogOpen, setPasswordRecoveryDialogOpen] = useState(false);
  const [passwordRecoveryEmail, setPasswordRecoveryEmail] = useState("");
  const [passwordRecoveryEmailError, setPasswordRecoveryEmailError] = useState("");
  const [passwordRecoveryCode, setPasswordRecoveryCode] = useState("");
  const [passwordRecoveryStep, setPasswordRecoveryStep] = useState<"email" | "code" | "password">("email");
  const [passwordRecoveryNotice, setPasswordRecoveryNotice] = useState("");
  const [passwordRecoveryNoticeKind, setPasswordRecoveryNoticeKind] = useState<
    "info" | "success" | "error"
  >("info");
  const [passwordRecoveryCooldownUntil, setPasswordRecoveryCooldownUntil] = useState(0);
  const [passwordRecoveryNextPassword, setPasswordRecoveryNextPassword] = useState("");
  const [passwordRecoveryConfirmPassword, setPasswordRecoveryConfirmPassword] = useState("");
  const [showPasswordRecoveryNext, setShowPasswordRecoveryNext] = useState(false);
  const [showPasswordRecoveryConfirm, setShowPasswordRecoveryConfirm] = useState(false);
  const [passwordRecoveryLoading, setPasswordRecoveryLoading] = useState(false);
  const [openRecoveryAfterAuthClose, setOpenRecoveryAfterAuthClose] = useState(false);
  const [recoveryPrefillEmail, setRecoveryPrefillEmail] = useState("");
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
  const [passwordUpdatedToast, setPasswordUpdatedToast] = useState(false);
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

  useEffect(() => {
    if (homeTab !== "development") return;
    setHasUnseenDevlog(false);
    try {
      localStorage.setItem(DEVLOG_SEEN_STORAGE_KEY, CURRENT_VERSION);
    } catch {}
  }, [homeTab]);
  const [copiedRoomCode, setCopiedRoomCode] = useState(false);
  const [startGameLoading, setStartGameLoading] = useState(false);
  const [roomActionPending, setRoomActionPending] = useState<"create" | "join" | null>(null);
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
  const passwordChangeCooldownLeft = Math.max(
    0,
    Math.ceil((passwordChangeCooldownUntil - nowMs) / 1000),
  );
  const emailChangeCooldownLeft = Math.max(0, Math.ceil((emailChangeCooldownUntil - nowMs) / 1000));
  const passwordRecoveryCooldownLeft = Math.max(
    0,
    Math.ceil((passwordRecoveryCooldownUntil - nowMs) / 1000),
  );
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [createMatchDialogOpen, setCreateMatchDialogOpen] = useState(false);
  const createMatchDialogRef = useRef<HTMLDivElement | null>(null);
  const oauthAuthHashHandledRef = useRef("");
  const passwordUpdatedToastTimerRef = useRef<number | null>(null);
  const [publicMatches, setPublicMatches] = useState<PublicMatchInfo[]>([]);
  const [joinPasswordDialogOpen, setJoinPasswordDialogOpen] = useState(false);
  const [observerListDialogOpen, setObserverListDialogOpen] = useState(false);
  const [roomManageOpen, setRoomManageOpen] = useState(false);
  const [manageAllowWitnesses, setManageAllowWitnesses] = useState(true);
  const [manageMaxObservers, setManageMaxObservers] = useState(6);
  const [manageOpeningTimerEnabled, setManageOpeningTimerEnabled] = useState(false);
  const [manageOpeningTimerSec, setManageOpeningTimerSec] = useState(60);
  const [manageClosingTimerEnabled, setManageClosingTimerEnabled] = useState(false);
  const [manageClosingTimerSec, setManageClosingTimerSec] = useState(60);
  const [manageProtestLimitEnabled, setManageProtestLimitEnabled] = useState(false);
  const [manageProtestLimit, setManageProtestLimit] = useState(2);
  const [manageTransferHostId, setManageTransferHostId] = useState("");
  const [manageRoomPassword, setManageRoomPassword] = useState("");
  const [manageRoomPasswordVisible, setManageRoomPasswordVisible] = useState(false);
  const [adminBotCount, setAdminBotCount] = useState(1);
  const [lobbyRoleDialogOpen, setLobbyRoleDialogOpen] = useState(false);
  const [lobbyRoleTargetPlayerId, setLobbyRoleTargetPlayerId] = useState<string | null>(null);
  const [pendingFactRevealIds, setPendingFactRevealIds] = useState<string[]>([]);
  const [joinPasswordDialogMatch, setJoinPasswordDialogMatch] = useState<PublicMatchInfo | null>(null);
  const [joinPasswordInput, setJoinPasswordInput] = useState("");
  const [joinPasswordDialogError, setJoinPasswordDialogError] = useState("");
  const [joinPasswordVisible, setJoinPasswordVisible] = useState(false);
  const [createRoomName, setCreateRoomName] = useState("");
  const [createRoomMode, setCreateRoomMode] = useState<RoomModeKey>("civil_3");
  const [createRoomPackKey, setCreateRoomPackKey] = useState("classic");
  const [createPackCatalogOpen, setCreatePackCatalogOpen] = useState(false);
  const [casePacks, setCasePacks] = useState<CasePackInfo[]>([]);
  const [createRoomPrivate, setCreateRoomPrivate] = useState(false);
  const [createVoiceUrl, setCreateVoiceUrl] = useState("");
  const [createRoomPassword, setCreateRoomPassword] = useState("");
  const [createRoomPasswordVisible, setCreateRoomPasswordVisible] = useState(false);
  const [badgeRulesOpen, setBadgeRulesOpen] = useState(false);
  const [imageCropDialogOpen, setImageCropDialogOpen] = useState(false);
  const [imageCropTarget, setImageCropTarget] = useState<CropTarget>("avatar");
  const [imageCropSource, setImageCropSource] = useState<string | null>(null);
  const [imageCropSourceIsGif, setImageCropSourceIsGif] = useState(false);
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
  const [speechTimerDeadlineAt, setSpeechTimerDeadlineAt] = useState<number | null>(null);
  const [speechTimerLabel, setSpeechTimerLabel] = useState("");
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
  const showPasswordUpdatedToast = useCallback(() => {
    if (passwordUpdatedToastTimerRef.current !== null) {
      window.clearTimeout(passwordUpdatedToastTimerRef.current);
    }
    setPasswordUpdatedToast(true);
    passwordUpdatedToastTimerRef.current = window.setTimeout(() => {
      setPasswordUpdatedToast(false);
      passwordUpdatedToastTimerRef.current = null;
    }, 2200);
  }, []);

  useEffect(
    () => () => {
      if (passwordUpdatedToastTimerRef.current !== null) {
        window.clearTimeout(passwordUpdatedToastTimerRef.current);
      }
    },
    [],
  );

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
  const knownUserIdByPlayerIdRef = useRef<Record<string, string>>({});
  const influenceAnnouncementTimerRef = useRef<number | null>(null);
  const roomActionTimeoutRef = useRef<number | null>(null);
  const ignoreLateRoomJoinedRef = useRef(false);
  const lastAutoRejoinAttemptAtRef = useRef(0);
  const speechTimerStageRef = useRef<string>("");
  const routeSyncInitializedRef = useRef(false);
  const shopDurationBootRef = useRef(true);
  const adminPromoAutoLoadKeyRef = useRef<string>("");
  const socket = getSocket();
  const activeRoomCode = room?.code ?? game?.code ?? null;
  const sharedAvatar = avatar;
  const sharedBanner = banner;
  const clearRoomActionPending = useCallback(() => {
    setRoomActionPending(null);
    if (roomActionTimeoutRef.current) {
      window.clearTimeout(roomActionTimeoutRef.current);
      roomActionTimeoutRef.current = null;
    }
  }, []);
  const beginRoomActionPending = useCallback((type: "create" | "join") => {
    if (roomActionTimeoutRef.current) {
      window.clearTimeout(roomActionTimeoutRef.current);
    }
    ignoreLateRoomJoinedRef.current = false;
    setRoomActionPending(type);
    roomActionTimeoutRef.current = window.setTimeout(() => {
      setRoomActionPending(null);
      roomActionTimeoutRef.current = null;
    }, 12000);
  }, []);
  const isAuthenticated = !!authUser && !!authToken;
  const activeBan = useMemo(() => {
    const ban = authUser?.ban;
    if (!ban) return null;
    return isBanStateActive(ban, nowMs) ? ban : null;
  }, [authUser?.ban, nowMs]);
  const isUserBanned = !!activeBan;
  const isCreatorAdmin = (authUser?.login ?? "").trim().toLowerCase() === "berly";
  const isStaffAdmin = authUser?.adminRole === "administrator" || authUser?.adminRole === "moderator";
  const canSeeAdminButton = isAuthenticated && !isUserBanned && (isCreatorAdmin || isStaffAdmin);
  const adminPanelKeyTrimmed = adminPanelKey.trim();
  const adminSessionTokenTrimmed = adminSessionToken?.trim() ?? "";
  const adminCanManagePromos = adminAccessRole === "owner";
  const adminCanManageSubscriptions = adminAccessRole === "owner";
  const adminCanBanUsers = adminAccessRole === "owner" || adminAccessRole === "administrator";
  const adminCanManageStaff = adminAccessRole === "owner" || adminAccessRole === "administrator";
  const adminCanModerateUsers =
    adminAccessRole === "owner" ||
    adminAccessRole === "administrator" ||
    adminAccessRole === "moderator";
  const buildAdminHeaders = useCallback(
    (sessionTokenOverride?: string | null) => {
      const resolvedSession = (sessionTokenOverride ?? adminSessionTokenTrimmed).trim();
      const headers: Record<string, string> = {};
      if (adminPanelKeyTrimmed) {
        headers["x-admin-key"] = adminPanelKeyTrimmed;
      }
      if (resolvedSession) {
        headers["x-admin-session"] = resolvedSession;
      }
      return headers;
    },
    [adminPanelKeyTrimmed, adminSessionTokenTrimmed],
  );
  const rememberKnownUserIds = useCallback((players?: Array<{ id?: string; userId?: string }>) => {
    if (!Array.isArray(players)) return;
    players.forEach((player) => {
      const pid = typeof player?.id === "string" ? player.id : "";
      const uid = typeof player?.userId === "string" ? player.userId : "";
      if (!pid || !uid) return;
      knownUserIdByPlayerIdRef.current[pid] = uid;
    });
  }, []);
  const selectedCreateMode = getRoomModeMeta(createRoomMode);
  const mySubscription = resolveSubscriptionView(
    myProfile?.subscription ?? authUser?.subscription ?? null,
  );
  const myTier = normalizeSubscriptionTier(mySubscription.tier);
  const shopPaymentPlan = useMemo(
    () => (shopPaymentTier ? SUBSCRIPTION_PLANS.find((plan) => plan.tier === shopPaymentTier) ?? null : null),
    [shopPaymentTier],
  );
  const shopPaymentAmountRub = useMemo(() => {
    if (!shopPaymentTier) return 0;
    return SHOP_PRICE_MATRIX_RUB[shopPaymentTier][shopDuration];
  }, [shopPaymentTier, shopDuration]);
  const shopPaymentMethodsByCategory = useMemo(() => {
    return {
      russia: SHOP_PAYMENT_METHODS.filter((method) => method.category === "russia"),
      crypto: SHOP_PAYMENT_METHODS.filter((method) => method.category === "crypto"),
    } satisfies Record<ShopPaymentCategory, ShopPaymentMethod[]>;
  }, []);
  const roomHostTier = normalizeSubscriptionTier(room?.hostSubscriptionTier ?? "free");
  const isMyHostRoom = !!room && room.hostId === (myId ?? "");
  const effectiveLobbyTier = isMyHostRoom
    ? getHigherSubscriptionTier(myTier, roomHostTier)
    : myTier;
  const canUseRating = hasCapability(myTier, "canUseRating");
  const canUseProfileBanner = hasCapability(myTier, "canUseProfileBanner");
  const canUseAnimatedProfileMedia = hasCapability(myTier, "canUseAnimatedProfileMedia");
  const canCreatePrivateRooms = hasCapability(myTier, "canCreatePrivateRooms");
  const canLetPlayersChooseRoles = hasCapability(effectiveLobbyTier, "canLetPlayersChooseRoles");
  const canChooseRoleInOwnLobby = hasCapability(effectiveLobbyTier, "canChooseRoleInOwnLobby");
  const canCreatePacks = hasCapability(myTier, "canCreatePacks");
  const baseCreatePackKey = casePacks.find((pack) => pack.key === "classic")?.key ?? casePacks[0]?.key ?? "classic";
  const freeCreatePack = casePacks.find((pack) => pack.key === baseCreatePackKey) ?? casePacks[0] ?? null;
  const selectedCreatePack =
    casePacks.find((pack) => pack.key === createRoomPackKey) ?? freeCreatePack;
  const selectedCreatePackLocked = isPackLockedForTier(selectedCreatePack, myTier);
  const availableCreateCaseCount = Math.max(
    0,
    selectedCreatePackLocked
      ? freeCreatePack?.caseCount ?? 0
      : selectedCreatePack?.caseCount ?? 0,
  );
  const navigateToShop = useCallback(() => {
    setUpsellModalOpen(false);
    setShopPaymentDialogOpen(false);
    setShopPaymentError("");
    setShopPaymentLoading(false);
    setPromoDialogOpen(false);
    setCreateMatchDialogOpen(false);
    setCreatePackCatalogOpen(false);
    setJoinPasswordDialogOpen(false);
    setJoinPasswordDialogMatch(null);
    setJoinPasswordInput("");
    setJoinPasswordDialogError("");
    setJoinPasswordVisible(false);
    setRoomManageOpen(false);
    setLobbyRoleDialogOpen(false);
    setObserverListDialogOpen(false);
    setHomeTab("shop");
    setScreen("home");
  }, []);
  const resolvePathFromState = useCallback(() => {
    if (screen === "profile") return "/profile";
    if (screen === "room") {
      return room?.code ? `/room/${encodeURIComponent(room.code)}` : "/room";
    }
    if (screen === "game") {
      const code = game?.code ?? room?.code ?? "";
      return code ? `/match/${encodeURIComponent(code)}` : "/match";
    }
    if (homeTab === "shop") return "/shop";
    if (homeTab === "development") return "/development";
    if (homeTab === "help") return "/help";
    return "/";
  }, [screen, homeTab, room?.code, game?.code]);
  const applyRouteFromPath = useCallback(
    (rawPath: string) => {
      const normalized = (rawPath || "/").trim().toLowerCase();
      if (normalized === "/profile") {
        setScreen("profile");
        return;
      }
      if (normalized === "/shop") {
        setScreen("home");
        setHomeTab("shop");
        return;
      }
      if (normalized === "/development") {
        setScreen("home");
        setHomeTab("development");
        return;
      }
      if (normalized === "/help") {
        setScreen("home");
        setHomeTab("help");
        return;
      }
      if (normalized.startsWith("/room/")) {
        const codeRaw = rawPath.split("/")[2] ?? "";
        const code = decodeURIComponent(codeRaw).trim().toUpperCase();
        if (room?.code && room.code.toUpperCase() === code) {
          setScreen("room");
          return;
        }
        setScreen("home");
        setHomeTab("play");
        if (code) {
          setJoinCode(code);
        }
        return;
      }
      if (normalized.startsWith("/match/")) {
        const codeRaw = rawPath.split("/")[2] ?? "";
        const code = decodeURIComponent(codeRaw).trim().toUpperCase();
        if (game?.code && game.code.toUpperCase() === code) {
          setScreen("game");
          return;
        }
        setScreen("home");
        setHomeTab("play");
        if (code) {
          setJoinCode(code);
        }
        return;
      }
      setScreen("home");
      setHomeTab("play");
    },
    [room?.code, game?.code],
  );
  useEffect(() => {
    if (routeSyncInitializedRef.current) return;
    routeSyncInitializedRef.current = true;
    applyRouteFromPath(window.location.pathname);
  }, [applyRouteFromPath]);
  useEffect(() => {
    const onPopState = () => {
      applyRouteFromPath(window.location.pathname);
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, [applyRouteFromPath]);
  useEffect(() => {
    if (!routeSyncInitializedRef.current) return;
    const nextPath = resolvePathFromState();
    if (window.location.pathname !== nextPath) {
      window.history.replaceState(
        window.history.state,
        "",
        `${nextPath}${window.location.search}${window.location.hash}`,
      );
    }
  }, [resolvePathFromState]);
  const openSubscriptionUpsell = useCallback(
    (
      capability: SubscriptionCapabilityKey,
      description: string,
      customTitle = "Функция недоступна",
    ) => {
      const requiredTier = getRequiredTierForCapability(capability);
      setUpsellTitle(customTitle);
      setUpsellDescription(description);
      setUpsellRequiredTier(requiredTier);
      setUpsellModalOpen(true);
    },
    [],
  );
  const handleShopPaymentDialogChange = useCallback((open: boolean) => {
    setShopPaymentDialogOpen(open);
    if (!open) {
      setShopPaymentError("");
      setShopPaymentLoading(false);
    }
  }, []);
  const openShopPaymentDialog = useCallback(
    (tier: ShopPaidTier) => {
      if (!authToken) {
        setAuthMode("login");
        setAuthView("form");
        setAuthError("Войдите в аккаунт, чтобы продолжить оплату.");
        setAuthDialogOpen(true);
        return;
      }
      setShopPaymentTier(tier);
      setShopPaymentError("");
      setShopPaymentDialogOpen(true);
    },
    [authToken],
  );
  const createShopPayment = useCallback(
    async (method: ShopPaymentMethod) => {
      if (shopPaymentLoading) return;
      if (!shopPaymentTier) {
        setShopPaymentError("Сначала выберите тариф.");
        return;
      }
      if (!authToken) {
        setShopPaymentDialogOpen(false);
        setAuthMode("login");
        setAuthView("form");
        setAuthError("Сессия истекла. Войдите снова, чтобы продолжить оплату.");
        setAuthDialogOpen(true);
        return;
      }
      setShopPaymentError("");
      setShopPaymentLoading(true);
      try {
        const payload = await authRequest<{ ok: true; checkoutUrl: string }>(
          "/payments/freekassa/create",
          {
            method: "POST",
            token: authToken,
            body: {
              tier: shopPaymentTier,
              duration: shopDuration,
              category: method.providerCategory,
              paymentSystemId: method.id,
            },
          },
        );
        const checkoutUrl = String(payload?.checkoutUrl ?? "").trim();
        if (!checkoutUrl) {
          throw new Error("Не удалось получить ссылку на оплату.");
        }
        window.location.href = checkoutUrl;
      } catch (error) {
        const rawMessage = error instanceof Error ? String(error.message ?? "").trim() : "";
        const message = rawMessage || "Не удалось создать платеж. Попробуйте снова.";
        setShopPaymentError(localizeAuthError(message));
      } finally {
        setShopPaymentLoading(false);
      }
    },
    [authToken, shopDuration, shopPaymentLoading, shopPaymentTier],
  );
  const applyPromoCode = useCallback(async () => {
    if (promoCodeLoading) return;
    const code = promoCodeInput.trim();
    if (!code) {
      setPromoCodeResult({ kind: "error", text: "Введите промокод." });
      return;
    }
    if (!authToken) {
      setPromoCodeResult({
        kind: "error",
        text: "Нужно войти в аккаунт для активации промокода.",
      });
      setAuthMode("login");
      setAuthDialogOpen(true);
      return;
    }
    setPromoCodeLoading(true);
    setPromoCodeResult(null);
    try {
      const payload = await authRequest<{
        ok: true;
        message: string;
        rewards?: Array<{ type: "subscription" | "badge"; label: string }>;
      }>("/auth/promo/apply", {
        method: "PATCH",
        token: authToken,
        body: { code },
      });
      const rawRewards = Array.isArray(payload.rewards) ? payload.rewards : [];
      const subscriptionReward = rawRewards.find((item) => item.type === "subscription");
      const normalizedRewards = rawRewards.filter((item) => {
        if (item.type !== "badge") return true;
        if (!subscriptionReward) return true;
        const rewardLabel = item.label.toLowerCase();
        const subscriptionLabel = subscriptionReward.label.toLowerCase();
        const isTierBadgeDuplicate =
          (rewardLabel.includes("стажер") && subscriptionLabel.includes("стажер")) ||
          (rewardLabel.includes("практик") && subscriptionLabel.includes("практик")) ||
          (rewardLabel.includes("арбитр") && subscriptionLabel.includes("арбитр"));
        return !isTierBadgeDuplicate;
      });
      setPromoCodeInput("");
      setPromoRewardsResult({
        text: payload.message || "Промокод активирован.",
        rewards: normalizedRewards,
      });
      setPromoRewardsDialogOpen(true);
      try {
        const profilePayload = await authRequest<{ profile: PublicUserProfile }>("/auth/profile", {
          token: authToken,
        });
        setMyProfile(profilePayload.profile);
      } catch {
        // промокод уже применен; если профиль не обновился, не показываем ложную ошибку
      }
    } catch (error) {
      setPromoCodeResult({
        kind: "error",
        text:
          error instanceof Error
            ? localizeAuthError(error.message)
            : "Не удалось активировать промокод.",
      });
    } finally {
      setPromoCodeLoading(false);
    }
  }, [authToken, promoCodeInput, promoCodeLoading]);
  const generateAdminPromoCode = useCallback(() => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const makePart = (len: number) =>
      Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    setAdminPromoCodeDraft(`${makePart(4)}-${makePart(4)}-${makePart(4)}`);
  }, []);
  const checkAdminAccess = useCallback(async (): Promise<string | null> => {
    if (!authToken || !canSeeAdminButton) {
      setAdminAccessGranted(false);
      setAdminSessionToken(null);
      setAdminAccessRole(null);
      setAdminUserLookupResult(null);
      return null;
    }
    setAdminAccessLoading(true);
    try {
      const payload = await authRequest<{
        ok: true;
        admin: true;
        userId: string;
        role?: "owner" | "administrator" | "moderator";
        adminSession: string;
      }>("/auth/admin/access", {
        token: authToken,
        headers: adminPanelKeyTrimmed ? { "x-admin-key": adminPanelKeyTrimmed } : undefined,
      });
      const session = typeof payload?.adminSession === "string" ? payload.adminSession.trim() : "";
      const role: AdminAccessRole =
        payload?.role === "owner" || payload?.role === "administrator" || payload?.role === "moderator"
          ? payload.role
          : null;
      if (session) {
        setAdminSessionToken(session);
        setAdminAccessGranted(true);
        setAdminAccessRole(role);
        return session;
      } else {
        setAdminSessionToken(null);
        setAdminAccessGranted(false);
        setAdminAccessRole(null);
        setAdminUserLookupResult(null);
        return null;
      }
    } catch {
      setAdminSessionToken(null);
      setAdminAccessGranted(false);
      setAdminAccessRole(null);
      setAdminUserLookupResult(null);
      return null;
    } finally {
      setAdminAccessLoading(false);
    }
  }, [authToken, canSeeAdminButton, adminPanelKeyTrimmed]);
  const invalidateAdminSession = useCallback(() => {
    setAdminAccessGranted(false);
    setAdminSessionToken(null);
    setAdminAccessRole(null);
  }, []);
  const isAdminSessionError = useCallback((error: unknown) => {
    return (
      error instanceof Error &&
      /сессия админ-панели истекла/i.test(error.message)
    );
  }, []);
  const ensureAdminHeaders = useCallback(async (): Promise<Record<string, string> | null> => {
    if (!authToken || !canSeeAdminButton) return null;
    let session = adminSessionTokenTrimmed;
    if (!session || !adminAccessGranted) {
      const refreshed = await checkAdminAccess();
      if (refreshed) {
        session = refreshed;
      } else {
        return null;
      }
    }
    const headers = buildAdminHeaders(session);
    return Object.keys(headers).length ? headers : null;
  }, [
    authToken,
    canSeeAdminButton,
    adminSessionTokenTrimmed,
    adminAccessGranted,
    checkAdminAccess,
    buildAdminHeaders,
  ]);
  const loadAdminPromos = useCallback(async () => {
    if (!authToken || !canSeeAdminButton || !adminCanManagePromos) return;
    const headers = await ensureAdminHeaders();
    if (!headers) return;
    setAdminPromoListLoading(true);
    setAdminPromoFeedback(null);
    try {
      const payload = await authRequest<{ ok: true; promos: AdminPromoCodeView[] }>(
        "/auth/admin/promo/list",
        {
          token: authToken,
          headers,
        },
      );
      setAdminPromos(Array.isArray(payload.promos) ? payload.promos : []);
    } catch (error) {
      if (isAdminSessionError(error)) {
        invalidateAdminSession();
      }
      setAdminPromoFeedback({
        kind: "error",
        text:
          error instanceof Error
            ? localizeAuthError(error.message)
            : "Не удалось загрузить промокоды.",
      });
    } finally {
      setAdminPromoListLoading(false);
    }
  }, [
    authToken,
    canSeeAdminButton,
    adminCanManagePromos,
    ensureAdminHeaders,
    invalidateAdminSession,
    isAdminSessionError,
  ]);
  const submitAdminPromo = useCallback(async () => {
    if (!authToken || !canSeeAdminButton || !adminCanManagePromos) return;
    const headers = await ensureAdminHeaders();
    if (!headers) {
      setAdminPromoFeedback({ kind: "error", text: "Доступ к админ-панели не подтвержден." });
      return;
    }
    const code = adminPromoCodeDraft.trim().toUpperCase();
    if (!code) {
      setAdminPromoFeedback({ kind: "error", text: "Введите код промокода." });
      return;
    }
    const parsedBadgeKeys = Array.from(new Set(adminPromoBadgeKeys));
    const fallbackBadgeKey = adminPromoBadgeKey.trim();
    if (fallbackBadgeKey && !parsedBadgeKeys.includes(fallbackBadgeKey)) {
      parsedBadgeKeys.push(fallbackBadgeKey);
    }
    if (adminPromoKind === "badge" && parsedBadgeKeys.length === 0) {
      setAdminPromoFeedback({ kind: "error", text: "Выберите хотя бы один бейдж для промокода." });
      return;
    }
    if (adminPromoExpiresAt && adminPromoStartsAt && adminPromoExpiresAt < adminPromoStartsAt) {
      setAdminPromoFeedback({ kind: "error", text: "Дата окончания должна быть позже даты старта." });
      return;
    }
    const parsedMaxUses = adminPromoMaxUses.trim()
      ? Math.max(0, Math.floor(Number(adminPromoMaxUses)))
      : null;
    if (parsedMaxUses !== null && !Number.isFinite(parsedMaxUses)) {
      setAdminPromoFeedback({ kind: "error", text: "Лимит использований должен быть числом." });
      return;
    }
    setAdminPromoLoading(true);
    setAdminPromoFeedback(null);
    try {
      await authRequest<{ ok: true }>("/auth/admin/promo", {
        method: "PATCH",
        token: authToken,
        headers,
        body: {
          code,
          promoKind: adminPromoKind,
          badgeKey: adminPromoKind === "badge" ? adminPromoBadgeKey.trim() : null,
          badgeKeys: parsedBadgeKeys,
          tier: adminPromoKind === "subscription" ? adminPromoTier : "free",
          duration: adminPromoDuration,
          isActive: adminPromoIsActive,
          maxUses: parsedMaxUses,
          startsAt: adminPromoStartsAt ? new Date(adminPromoStartsAt).toISOString() : null,
          expiresAt: adminPromoExpiresAt ? new Date(adminPromoExpiresAt).toISOString() : null,
        },
      });
      setAdminPromoFeedback({ kind: "success", text: "Промокод сохранён." });
      setAdminPromoCodeDraft("");
      setAdminPromoMaxUses("");
      setAdminPromoStartsAt("");
      setAdminPromoExpiresAt("");
      setAdminPromoTier("trainee");
      setAdminPromoDuration("1_month");
      setAdminPromoKind("subscription");
      setAdminPromoBadgeKey("sub_trainee");
      setAdminPromoBadgeKeys([]);
      setAdminPromoIsActive(true);
      await loadAdminPromos();
    } catch (error) {
      if (isAdminSessionError(error)) {
        invalidateAdminSession();
      }
      setAdminPromoFeedback({
        kind: "error",
        text:
          error instanceof Error
            ? localizeAuthError(error.message)
            : "Не удалось сохранить промокод.",
      });
    } finally {
      setAdminPromoLoading(false);
    }
  }, [
    authToken,
    canSeeAdminButton,
    adminCanManagePromos,
    ensureAdminHeaders,
    adminPromoCodeDraft,
    adminPromoKind,
    adminPromoBadgeKey,
    adminPromoBadgeKeys,
    adminPromoDuration,
    adminPromoExpiresAt,
    adminPromoIsActive,
    adminPromoMaxUses,
    adminPromoStartsAt,
    adminPromoTier,
    loadAdminPromos,
    invalidateAdminSession,
    isAdminSessionError,
  ]);
  const deleteAdminPromo = useCallback(
    async (code: string) => {
      if (!authToken || !canSeeAdminButton || !adminCanManagePromos || !code) return;
      const headers = await ensureAdminHeaders();
      if (!headers) {
        setAdminPromoFeedback({ kind: "error", text: "Доступ к админ-панели не подтвержден." });
        return;
      }
      setAdminPromoListLoading(true);
      setAdminPromoFeedback(null);
      try {
        await authRequest<{ ok: true }>("/auth/admin/promo/delete", {
          method: "PATCH",
          token: authToken,
          headers,
          body: { code },
        });
        setAdminPromoFeedback({ kind: "success", text: `Промокод ${code} удалён.` });
        await loadAdminPromos();
      } catch (error) {
        if (isAdminSessionError(error)) {
          invalidateAdminSession();
        }
        setAdminPromoFeedback({
          kind: "error",
          text:
            error instanceof Error
              ? localizeAuthError(error.message)
              : "Не удалось удалить промокод.",
        });
      } finally {
        setAdminPromoListLoading(false);
      }
    },
    [
      authToken,
      canSeeAdminButton,
      adminCanManagePromos,
      ensureAdminHeaders,
      loadAdminPromos,
      invalidateAdminSession,
      isAdminSessionError,
    ],
  );
  const updateAdminPromo = useCallback(
    async (
      promo: AdminPromoCodeView,
      patch: Partial<{
        isActive: boolean;
        maxUses: number | null;
        startsAt: string | null;
        expiresAt: string | null;
      }>,
    ) => {
      if (!authToken || !canSeeAdminButton || !adminCanManagePromos) return;
      const headers = await ensureAdminHeaders();
      if (!headers) {
        setAdminPromoFeedback({ kind: "error", text: "Доступ к админ-панели не подтвержден." });
        return;
      }
      setAdminPromoActionCode(promo.code);
      setAdminPromoFeedback(null);
      try {
        await authRequest<{ ok: true }>("/auth/admin/promo", {
          method: "PATCH",
          token: authToken,
          headers,
          body: {
            code: promo.code,
            promoKind: promo.promoKind,
            badgeKey: promo.promoKind === "badge" ? promo.badgeKey : null,
            badgeKeys: promo.badgeKeys ?? (promo.badgeKey ? [promo.badgeKey] : []),
            tier: promo.promoKind === "subscription" ? promo.tier : "free",
            duration: promo.duration,
            isActive: patch.isActive ?? promo.isActive,
            maxUses: patch.maxUses ?? promo.maxUses,
            startsAt: patch.startsAt ?? promo.startsAt,
            expiresAt: patch.expiresAt ?? promo.expiresAt,
          },
        });
        setAdminPromoFeedback({
          kind: "success",
          text: `Промокод ${promo.code} обновлён.`,
        });
        await loadAdminPromos();
      } catch (error) {
        if (isAdminSessionError(error)) {
          invalidateAdminSession();
        }
        setAdminPromoFeedback({
          kind: "error",
          text:
            error instanceof Error
              ? localizeAuthError(error.message)
              : "Не удалось обновить промокод.",
        });
      } finally {
        setAdminPromoActionCode(null);
      }
    },
    [
      authToken,
      canSeeAdminButton,
      adminCanManagePromos,
      ensureAdminHeaders,
      loadAdminPromos,
      invalidateAdminSession,
      isAdminSessionError,
    ],
  );
  const submitAdminSubscription = useCallback(async () => {
    if (!authToken || !canSeeAdminButton || !adminCanManageSubscriptions) return;
    const headers = await ensureAdminHeaders();
    if (!headers) {
      setAdminPromoFeedback({ kind: "error", text: "Доступ к админ-панели не подтвержден." });
      return;
    }
    const userId = adminSubscriptionUserId.trim();
    if (!userId) {
      setAdminPromoFeedback({ kind: "error", text: "Введите userId для выдачи подписки." });
      return;
    }
    setAdminSubscriptionLoading(true);
    setAdminPromoFeedback(null);
    try {
      await authRequest<{ ok: true }>("/auth/admin/subscription", {
        method: "PATCH",
        token: authToken,
        headers,
        body: {
          userId,
          tier: adminSubscriptionTier,
          duration: adminSubscriptionDuration,
          source: "manual",
        },
      });
      setAdminPromoFeedback({
        kind: "success",
        text: `Подписка выдана: ${getSubscriptionTierLabel(adminSubscriptionTier)} (${getSubscriptionDurationLabel(adminSubscriptionDuration)}).`,
      });
    } catch (error) {
      if (isAdminSessionError(error)) {
        invalidateAdminSession();
      }
      setAdminPromoFeedback({
        kind: "error",
        text:
          error instanceof Error
            ? localizeAuthError(error.message)
            : "Не удалось выдать подписку.",
      });
    } finally {
      setAdminSubscriptionLoading(false);
    }
  }, [
    authToken,
    canSeeAdminButton,
    adminCanManageSubscriptions,
    ensureAdminHeaders,
    adminSubscriptionUserId,
    adminSubscriptionTier,
    adminSubscriptionDuration,
    invalidateAdminSession,
    isAdminSessionError,
  ]);
  const findAdminUser = useCallback(async () => {
    if (!authToken || !canSeeAdminButton || !adminCanModerateUsers) return;
    const headers = await ensureAdminHeaders();
    if (!headers) {
      setAdminPromoFeedback({ kind: "error", text: "Доступ к админ-панели не подтвержден." });
      return;
    }
    const query =
      adminUserLookupQuery.trim() ||
      adminSubscriptionUserId.trim() ||
      adminBanUserId.trim() ||
      adminStaffTargetUserId.trim();
    if (!query) {
      setAdminPromoFeedback({
        kind: "error",
        text: "Введите login, email, nickname или userId для поиска.",
      });
      return;
    }
    setAdminUserLookupLoading(true);
    setAdminPromoFeedback(null);
    try {
      const payload = (await Promise.race([
        authRequest<{ ok: true; user: AdminLookupUserView }>("/auth/admin/user/find", {
          method: "POST",
          token: authToken,
          headers,
          body: { query },
        }),
        new Promise<never>((_, reject) =>
          window.setTimeout(
            () => reject(new Error("Сервер не ответил на поиск. Попробуйте снова.")),
            9000,
          ),
        ),
      ])) as { ok: true; user: AdminLookupUserView };
      if (!payload?.user || typeof payload.user.id !== "string") {
        throw new Error("Пользователь не найден.");
      }
      setAdminUserLookupQuery(query);
      setAdminUserLookupResult(payload.user);
      setAdminModerationNickname(payload.user.nickname);
      if (payload.user.adminRole === "administrator" || payload.user.adminRole === "moderator") {
        setAdminStaffTargetRole(payload.user.adminRole);
      }
      setAdminPromoFeedback({
        kind: "success",
        text: `Найден пользователь: ${payload.user.nickname} (${payload.user.id}).`,
      });
    } catch (error) {
      if (isAdminSessionError(error)) {
        invalidateAdminSession();
      }
      setAdminUserLookupResult(null);
      setAdminPromoFeedback({
        kind: "error",
        text:
          error instanceof Error
            ? localizeAuthError(error.message)
            : "Не удалось найти пользователя.",
      });
    } finally {
      setAdminUserLookupLoading(false);
    }
  }, [
    authToken,
    canSeeAdminButton,
    adminCanModerateUsers,
    ensureAdminHeaders,
    adminUserLookupQuery,
    adminSubscriptionUserId,
    adminBanUserId,
    adminStaffTargetUserId,
    invalidateAdminSession,
    isAdminSessionError,
  ]);
  const submitAdminBan = useCallback(async () => {
    if (!authToken || !canSeeAdminButton || !adminCanBanUsers) return;
    const headers = await ensureAdminHeaders();
    if (!headers) {
      setAdminPromoFeedback({ kind: "error", text: "Доступ к админ-панели не подтвержден." });
      return;
    }
    const userId = adminBanUserId.trim();
    if (!userId) {
      setAdminPromoFeedback({ kind: "error", text: "Введите userId для блокировки." });
      return;
    }
    const days = Math.floor(Number(adminBanDays));
    if (!adminBanForever && (!Number.isFinite(days) || days <= 0)) {
      setAdminPromoFeedback({ kind: "error", text: "Укажите число дней больше 0." });
      return;
    }
    setAdminBanLoading(true);
    setAdminPromoFeedback(null);
    try {
      const payload = await authRequest<{
        ok: true;
        ban: { isBanned: boolean; isPermanent: boolean; bannedUntil: number | null; reason?: string };
      }>("/auth/admin/ban", {
        method: "PATCH",
        token: authToken,
        headers,
        body: {
          userId,
          forever: adminBanForever,
          days: adminBanForever ? null : days,
          reason: adminBanReason.trim() || null,
        },
      });
      setAdminUserLookupResult((prev) =>
        prev && prev.id === userId
          ? {
              ...prev,
              ban: payload.ban,
            }
          : prev,
      );
      setAdminPromoFeedback({
        kind: "success",
        text: adminBanForever
          ? "Пользователь заблокирован навсегда."
          : `Пользователь заблокирован на ${days} дн.`,
      });
    } catch (error) {
      if (isAdminSessionError(error)) {
        invalidateAdminSession();
      }
      setAdminPromoFeedback({
        kind: "error",
        text:
          error instanceof Error
            ? localizeAuthError(error.message)
            : "Не удалось выдать блокировку.",
      });
    } finally {
      setAdminBanLoading(false);
    }
  }, [
    authToken,
    canSeeAdminButton,
    adminCanBanUsers,
    ensureAdminHeaders,
    adminBanUserId,
    adminBanDays,
    adminBanForever,
    adminBanReason,
    invalidateAdminSession,
    isAdminSessionError,
  ]);
  const clearAdminBan = useCallback(async () => {
    if (!authToken || !canSeeAdminButton || !adminCanBanUsers) return;
    const headers = await ensureAdminHeaders();
    if (!headers) {
      setAdminPromoFeedback({ kind: "error", text: "Доступ к админ-панели не подтвержден." });
      return;
    }
    const userId = adminBanUserId.trim();
    if (!userId) {
      setAdminPromoFeedback({ kind: "error", text: "Введите userId пользователя." });
      return;
    }
    setAdminBanLoading(true);
    setAdminPromoFeedback(null);
    try {
      const payload = await authRequest<{
        ok: true;
        ban: { isBanned: boolean; isPermanent: boolean; bannedUntil: number | null; reason?: string };
      }>("/auth/admin/ban", {
        method: "PATCH",
        token: authToken,
        headers,
        body: {
          userId,
          clear: true,
        },
      });
      setAdminUserLookupResult((prev) =>
        prev && prev.id === userId
          ? {
              ...prev,
              ban: payload.ban,
            }
          : prev,
      );
      setAdminPromoFeedback({ kind: "success", text: "Блокировка снята." });
    } catch (error) {
      if (isAdminSessionError(error)) {
        invalidateAdminSession();
      }
      setAdminPromoFeedback({
        kind: "error",
        text:
          error instanceof Error
            ? localizeAuthError(error.message)
            : "Не удалось снять блокировку.",
      });
    } finally {
      setAdminBanLoading(false);
    }
  }, [
    authToken,
    canSeeAdminButton,
    adminCanBanUsers,
    ensureAdminHeaders,
    adminBanUserId,
    invalidateAdminSession,
    isAdminSessionError,
  ]);
  const submitAdminModeration = useCallback(async () => {
    if (!authToken || !canSeeAdminButton || !adminCanModerateUsers) return;
    const headers = await ensureAdminHeaders();
    if (!headers) {
      setAdminPromoFeedback({ kind: "error", text: "Доступ к админ-панели не подтвержден." });
      return;
    }
    const userId = (adminStaffTargetUserId || adminSubscriptionUserId || adminBanUserId).trim();
    if (!userId) {
      setAdminPromoFeedback({ kind: "error", text: "Введите userId пользователя." });
      return;
    }
    const nextNickname = adminModerationNickname.trim();
    setAdminModerationLoading(true);
    setAdminPromoFeedback(null);
    try {
      const payload = await authRequest<{
        ok: true;
        user: { id: string; nickname: string; avatar: string | null; banner: string | null };
      }>("/auth/admin/user/moderate", {
        method: "PATCH",
        token: authToken,
        headers,
        body: {
          userId,
          nickname: nextNickname || undefined,
          clearAvatar: false,
          clearBanner: false,
        },
      });
      setAdminUserLookupResult((prev) =>
        prev && prev.id === userId
          ? {
              ...prev,
              nickname: payload.user.nickname,
            }
          : prev,
      );
      setAdminModerationNickname("");
      setAdminPromoFeedback({ kind: "success", text: "Данные пользователя обновлены." });
    } catch (error) {
      if (isAdminSessionError(error)) invalidateAdminSession();
      setAdminPromoFeedback({
        kind: "error",
        text:
          error instanceof Error
            ? localizeAuthError(error.message)
            : "Не удалось обновить профиль пользователя.",
      });
    } finally {
      setAdminModerationLoading(false);
    }
  }, [
    authToken,
    canSeeAdminButton,
    adminCanModerateUsers,
    ensureAdminHeaders,
    adminStaffTargetUserId,
    adminSubscriptionUserId,
    adminBanUserId,
    adminModerationNickname,
    invalidateAdminSession,
    isAdminSessionError,
  ]);
  const clearAdminUserMedia = useCallback(
    async (target: "avatar" | "banner") => {
      if (!authToken || !canSeeAdminButton || !adminCanModerateUsers) return;
      const headers = await ensureAdminHeaders();
      if (!headers) {
        setAdminPromoFeedback({ kind: "error", text: "Доступ к админ-панели не подтвержден." });
        return;
      }
      const userId = (adminStaffTargetUserId || adminSubscriptionUserId || adminBanUserId).trim();
      if (!userId) {
        setAdminPromoFeedback({ kind: "error", text: "Введите userId пользователя." });
        return;
      }
      setAdminModerationLoading(true);
      setAdminPromoFeedback(null);
      try {
        await authRequest<{ ok: true; user: { id: string } }>("/auth/admin/user/moderate", {
          method: "PATCH",
          token: authToken,
          headers,
          body: {
            userId,
            clearAvatar: target === "avatar",
            clearBanner: target === "banner",
          },
        });
        setAdminPromoFeedback({
          kind: "success",
          text: target === "avatar" ? "Аватар удален." : "Баннер удален.",
        });
      } catch (error) {
        if (isAdminSessionError(error)) invalidateAdminSession();
        setAdminPromoFeedback({
          kind: "error",
          text:
            error instanceof Error
              ? localizeAuthError(error.message)
              : "Не удалось применить действие модерации.",
        });
      } finally {
        setAdminModerationLoading(false);
      }
    },
    [
      authToken,
      canSeeAdminButton,
      adminCanModerateUsers,
      ensureAdminHeaders,
      adminStaffTargetUserId,
      adminSubscriptionUserId,
      adminBanUserId,
      invalidateAdminSession,
      isAdminSessionError,
    ],
  );
  const submitAdminStaffRole = useCallback(async () => {
    if (!authToken || !canSeeAdminButton || !adminCanManageStaff) return;
    const headers = await ensureAdminHeaders();
    if (!headers) {
      setAdminPromoFeedback({ kind: "error", text: "Доступ к админ-панели не подтвержден." });
      return;
    }
    const userId = adminStaffTargetUserId.trim();
    if (!userId) {
      setAdminPromoFeedback({ kind: "error", text: "Введите userId сотрудника." });
      return;
    }
    setAdminStaffLoading(true);
    setAdminPromoFeedback(null);
    try {
      const payload = await authRequest<{ ok: true; role: "administrator" | "moderator" | null }>(
        "/auth/admin/staff/role",
        {
          method: "PATCH",
          token: authToken,
          headers,
          body: { userId, role: adminStaffTargetRole },
        },
      );
      setAdminUserLookupResult((prev) =>
        prev && prev.id === userId
          ? {
              ...prev,
              adminRole: payload.role,
            }
          : prev,
      );
      setAdminPromoFeedback({
        kind: "success",
        text: payload.role
          ? `Роль выдана: ${payload.role === "administrator" ? "Администратор" : "Модератор"}.`
          : "Роль сотрудника снята.",
      });
    } catch (error) {
      if (isAdminSessionError(error)) invalidateAdminSession();
      setAdminPromoFeedback({
        kind: "error",
        text:
          error instanceof Error ? localizeAuthError(error.message) : "Не удалось обновить роль.",
      });
    } finally {
      setAdminStaffLoading(false);
    }
  }, [
    authToken,
    canSeeAdminButton,
    adminCanManageStaff,
    ensureAdminHeaders,
    adminStaffTargetUserId,
    adminStaffTargetRole,
    invalidateAdminSession,
    isAdminSessionError,
  ]);
  const removeAdminStaffRole = useCallback(async () => {
    if (!authToken || !canSeeAdminButton || !adminCanManageStaff) return;
    const headers = await ensureAdminHeaders();
    if (!headers) {
      setAdminPromoFeedback({ kind: "error", text: "Доступ к админ-панели не подтвержден." });
      return;
    }
    const userId = adminStaffTargetUserId.trim();
    if (!userId) {
      setAdminPromoFeedback({ kind: "error", text: "Введите userId сотрудника." });
      return;
    }
    setAdminStaffLoading(true);
    setAdminPromoFeedback(null);
    try {
      await authRequest<{ ok: true; role: null }>("/auth/admin/staff/role", {
        method: "PATCH",
        token: authToken,
        headers,
        body: { userId, role: "none" },
      });
      setAdminUserLookupResult((prev) =>
        prev && prev.id === userId
          ? {
              ...prev,
              adminRole: null,
            }
          : prev,
      );
      setAdminPromoFeedback({ kind: "success", text: "Роль сотрудника снята." });
    } catch (error) {
      if (isAdminSessionError(error)) invalidateAdminSession();
      setAdminPromoFeedback({
        kind: "error",
        text:
          error instanceof Error ? localizeAuthError(error.message) : "Не удалось снять роль.",
      });
    } finally {
      setAdminStaffLoading(false);
    }
  }, [
    authToken,
    canSeeAdminButton,
    adminCanManageStaff,
    ensureAdminHeaders,
    adminStaffTargetUserId,
    invalidateAdminSession,
    isAdminSessionError,
  ]);
  useEffect(() => {
    localStorage.setItem("court_admin_panel_key", adminPanelKey);
  }, [adminPanelKey]);
  useEffect(() => {
    if (!adminAccessGranted) return;
    setAdminAccessGranted(false);
    setAdminSessionToken(null);
    setAdminAccessRole(null);
  }, [adminPanelKeyTrimmed]);
  useEffect(() => {
    if (!adminPromoFeedback) return;
    const timer = window.setTimeout(() => setAdminPromoFeedback(null), 3200);
    return () => window.clearTimeout(timer);
  }, [adminPromoFeedback]);
  useEffect(() => {
    if (!promoCodeResult) return;
    const timer = window.setTimeout(() => setPromoCodeResult(null), 3600);
    return () => window.clearTimeout(timer);
  }, [promoCodeResult]);
  useEffect(() => {
    setAdminSessionToken(null);
    setAdminAccessGranted(false);
    setAdminAccessRole(null);
  }, [authToken]);
  useEffect(() => {
    if (!canSeeAdminButton) {
      setAdminAccessGranted(false);
      setAdminSessionToken(null);
      setAdminAccessRole(null);
      setAdminUserLookupResult(null);
      return;
    }
  }, [canSeeAdminButton]);
  useEffect(() => {
    if (!adminToolsOpen) return;
    setAdminSubscriptionUserId("");
    setAdminBanUserId("");
    setAdminStaffTargetUserId("");
  }, [adminToolsOpen]);
  useEffect(() => {
    if (!profileSubscriptionHighlightPending) return;
    if (screen !== "profile" || myProfileLoading) return;
    const timer = window.setTimeout(() => {
      setProfileSubscriptionHighlight(Date.now());
      setProfileSubscriptionHighlightPending(false);
    }, 280);
    return () => window.clearTimeout(timer);
  }, [profileSubscriptionHighlightPending, screen, myProfileLoading]);
  useEffect(() => {
    if (
      !adminToolsOpen ||
      !authToken ||
      !adminAccessGranted ||
      !adminCanManagePromos ||
      adminPanelSection !== "promos"
    ) {
      adminPromoAutoLoadKeyRef.current = "";
      return;
    }
    const autoLoadKey = `${authToken}:${adminSessionTokenTrimmed}:${adminPanelSection}`;
    if (adminPromoAutoLoadKeyRef.current === autoLoadKey) {
      return;
    }
    adminPromoAutoLoadKeyRef.current = autoLoadKey;
    void loadAdminPromos();
  }, [
    adminToolsOpen,
    authToken,
    adminAccessGranted,
    adminCanManagePromos,
    adminPanelSection,
    adminSessionTokenTrimmed,
    loadAdminPromos,
  ]);
  useEffect(() => {
    if (!adminToolsOpen) return;
    setAdminPromoFeedback(null);
  }, [adminToolsOpen]);
  useEffect(() => {
    if (!adminAccessGranted) return;
    if (adminAccessRole === "owner") return;
    if (adminPanelSection === "promos" || adminPanelSection === "subscriptions") {
      setAdminPanelSection("users");
    }
  }, [adminAccessGranted, adminAccessRole, adminPanelSection]);
  useEffect(() => {
    if (shopDurationBootRef.current) {
      shopDurationBootRef.current = false;
      setShopPriceRevealReady(true);
      return;
    }
    setShopPriceRevealReady(false);
    const timer = window.setTimeout(() => {
      setShopPriceRevealReady(true);
    }, 320);
    return () => window.clearTimeout(timer);
  }, [shopDuration]);
  useEffect(() => {
    if (!createPackCatalogOpen) return;
    window.requestAnimationFrame(() => {
      if (createMatchDialogRef.current) {
        createMatchDialogRef.current.scrollTop = 0;
      }
    });
  }, [createPackCatalogOpen]);
  useEffect(() => {
    if (canCreatePrivateRooms || !createRoomPrivate) return;
    setCreateRoomPrivate(false);
    setCreateRoomPassword("");
    setCreateRoomPasswordVisible(false);
  }, [canCreatePrivateRooms, createRoomPrivate]);
  useEffect(() => {
    return () => {
      if (roomActionTimeoutRef.current) {
        window.clearTimeout(roomActionTimeoutRef.current);
        roomActionTimeoutRef.current = null;
      }
    };
  }, []);
  const reconnectSecondsLeft =
    reconnectExpiresAt !== null
      ? Math.max(0, Math.ceil((reconnectExpiresAt - nowMs) / 1000))
      : 0;
  const globalBlockingLoading =
    authLoading || myProfileLoading || imageCropLoading;
  const safeGlobalBlockingLoading = globalBlockingLoading && !loaderForceHidden;
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

  useEffect(() => {
    if (!globalBlockingLoading) {
      setLoaderForceHidden(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setLoaderForceHidden(true);
    }, 12000);
    return () => window.clearTimeout(timer);
  }, [globalBlockingLoading]);

  useEffect(() => {
    if (screen !== "room" && screen !== "game") {
      setLobbyRoleDialogOpen(false);
    }
  }, [screen]);
  useEffect(() => {
    setAdminToolsOpen(false);
  }, [screen, homeTab]);
  useEffect(() => {
    if (!createMatchDialogOpen && !roomManageOpen && !observerListDialogOpen) return;
    setAdminToolsOpen(false);
  }, [createMatchDialogOpen, roomManageOpen, observerListDialogOpen]);

  useEffect(() => {
    if (!room) return;
    setManageAllowWitnesses(room.allowWitnesses !== false);
    setManageMaxObservers(
      Math.max(0, Math.min(6, Number.isFinite(room.maxObservers ?? NaN) ? Number(room.maxObservers) : 6)),
    );
    const openingSec = typeof room.openingSpeechTimerSec === "number" ? room.openingSpeechTimerSec : 60;
    const closingSec = typeof room.closingSpeechTimerSec === "number" ? room.closingSpeechTimerSec : 60;
    setManageOpeningTimerEnabled(typeof room.openingSpeechTimerSec === "number");
    setManageOpeningTimerSec(Math.max(15, Math.min(180, openingSec)));
    setManageClosingTimerEnabled(typeof room.closingSpeechTimerSec === "number");
    setManageClosingTimerSec(Math.max(15, Math.min(180, closingSec)));
    setManageProtestLimitEnabled(!!room.protestLimitEnabled);
    const protestLimit = typeof room.maxProtestsPerPlayer === "number" ? room.maxProtestsPerPlayer : 2;
    setManageProtestLimit(Math.max(1, Math.min(10, protestLimit)));
  }, [room]);
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
      const canUseRatingNow = !!resolveSubscriptionView(nextProfile.subscription ?? null).capabilities
        .canUseRating;
      if (!canUseRatingNow) {
        setRankResultToast(null);
        return;
      }
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
      ignoreLateRoomJoinedRef.current = false;
      const rejoinPayload: { code: string; sessionToken: string; avatar?: string; banner?: string } = {
        code: sessionCode,
        sessionToken: sessionToken.trim(),
      };
      if (!authToken && sharedAvatar) {
        rejoinPayload.avatar = sharedAvatar;
      }
      if (!authToken && sharedBanner) {
        rejoinPayload.banner = sharedBanner;
      }
      socket.emit("rejoin_room", rejoinPayload);
    },
    [authToken, mySessionToken, sharedAvatar, sharedBanner, socket],
  );

  useEffect(() => {
    const styleId = "court-auth-autofill-dark";
    if (document.getElementById(styleId)) return;
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      html, body {
        scrollbar-width: none !important;
        -ms-overflow-style: none !important;
      }
      html::-webkit-scrollbar,
      body::-webkit-scrollbar {
        width: 0 !important;
        height: 0 !important;
        display: none !important;
      }
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
      .court-range {
        -webkit-appearance: none;
        appearance: none;
        width: 100%;
        border-radius: 9999px;
        background: linear-gradient(90deg, rgba(239,68,68,0.92), rgba(113,113,122,0.45));
        outline: none;
      }
      .court-range::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 16px;
        height: 16px;
        border-radius: 9999px;
        border: 2px solid rgba(255,255,255,0.9);
        background: rgb(220 38 38);
        box-shadow: 0 0 0 3px rgba(239,68,68,0.2);
        cursor: pointer;
      }
      .court-range::-moz-range-thumb {
        width: 16px;
        height: 16px;
        border-radius: 9999px;
        border: 2px solid rgba(255,255,255,0.9);
        background: rgb(220 38 38);
        box-shadow: 0 0 0 3px rgba(239,68,68,0.2);
        cursor: pointer;
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
        <DialogContent
          overlayClassName={profileMatchesOpen ? "bg-transparent backdrop-blur-0" : undefined}
          className="max-w-[520px] overflow-visible border-zinc-800 bg-zinc-950 text-zinc-100"
        >
          <DialogHeader>
            <DialogTitle>Профиль игрока</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Публичная информация.
            </DialogDescription>
          </DialogHeader>
          {viewPlayerProfileLoading ? (
            <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
              <div className="h-5 w-40 animate-pulse rounded bg-zinc-800/80" />
              <div className="h-20 animate-pulse rounded-2xl bg-zinc-800/60" />
              <div className="grid grid-cols-3 gap-2">
                <div className="h-14 animate-pulse rounded-xl bg-zinc-800/60" />
                <div className="h-14 animate-pulse rounded-xl bg-zinc-800/60" />
                <div className="h-14 animate-pulse rounded-xl bg-zinc-800/60" />
              </div>
            </div>
          ) : viewPlayerProfileError ? (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
              {viewPlayerProfileError}
            </div>
          ) : viewPlayerProfile ? (
            <div className="space-y-4">
              <div className="rounded-3xl border border-zinc-800 bg-zinc-950/70">
                <div
                  className="relative min-h-[122px] rounded-3xl p-4 flex items-center overflow-visible"
                  style={getBannerStyle(
                    viewPlayerProfile.banner,
                    viewPlayerProfile.avatar,
                    viewPlayerProfile.nickname,
                  )}
                >
                  <div className="absolute inset-0 rounded-3xl bg-gradient-to-t from-black/75 via-black/35 to-black/10" />
                  <div className="relative z-10 flex min-w-0 items-center gap-3">
                    <Avatar src={viewPlayerProfile.avatar ?? null} name={viewPlayerProfile.nickname} size={82} />
                    <div className="min-w-0 flex-1">
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
                            <div className="absolute left-1/2 top-full z-30 mt-2 w-64 max-w-[calc(100vw-4rem)] -translate-x-1/2 rounded-xl border border-zinc-700 bg-zinc-900/95 px-3 py-2 text-sm leading-relaxed text-zinc-200 shadow-[0_10px_24px_rgba(0,0,0,0.45)] whitespace-pre-wrap break-words sm:left-0 sm:translate-x-0">
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
        persistAuthUserToLocalCache(user);
        setPlayerName(user.nickname);
        setProfileNicknameDraft(user.nickname);
        safeSetLocalStorageItem("court_nickname", user.nickname);
        if (user.avatar) {
          setAvatar(user.avatar);
          persistMediaToLocalCache("court_avatar", user.avatar);
        }
        if (user.banner) {
          setBanner(user.banner);
          persistMediaToLocalCache(BANNER_STORAGE_KEY, user.banner);
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
    setPreferredRoleDraft(authUser.preferredRole ?? "");
  }, [authUser]);

  useEffect(() => {
    if (!isUserBanned) return;
    if (screen !== "home") {
      setScreen("home");
    }
    setCreateMatchDialogOpen(false);
    setCreatePackCatalogOpen(false);
    setRoomManageOpen(false);
    setJoinPasswordDialogOpen(false);
    setJoinPasswordDialogMatch(null);
    setJoinPasswordInput("");
    setJoinPasswordDialogError("");
    setProfileMenuOpen(false);
    setAuthDialogOpen(false);
    setContextHelpOpen(false);
  }, [isUserBanned, screen]);

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
    const badges = myProfile?.badges ?? [];
    const selectedFromProfile = myProfile?.selectedBadgeKey;
    const selectedStillActive =
      !!selectedFromProfile &&
      badges.some((badge) => badge.key === selectedFromProfile && badge.active);
    if (selectedStillActive && selectedFromProfile) {
      setSelectedBadgeKey(selectedFromProfile);
      return;
    }
    const firstActive = badges.find((badge) => badge.active)?.key ?? "";
    setSelectedBadgeKey(firstActive);
  }, [myProfile]);

  useEffect(() => {
    if (screen !== "home") return;
    socket.emit("list_public_matches");
    socket.emit("list_case_packs");
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
    if (!createMatchDialogOpen) return;
    socket.emit("list_case_packs");
  }, [createMatchDialogOpen, socket]);

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
    if (openRecoveryAfterAuthClose && !passwordRecoveryDialogOpen) {
      setPasswordRecoveryEmail(recoveryPrefillEmail);
      setPasswordRecoveryEmailError("");
      setPasswordRecoveryStep("email");
      setPasswordRecoveryCode("");
      setPasswordRecoveryNextPassword("");
      setPasswordRecoveryConfirmPassword("");
      setPasswordRecoveryNotice("");
      setShowPasswordRecoveryNext(false);
      setShowPasswordRecoveryConfirm(false);
      setPasswordRecoveryDialogOpen(true);
      setOpenRecoveryAfterAuthClose(false);
      setRecoveryPrefillEmail("");
    }
  }, [openRecoveryAfterAuthClose, passwordRecoveryDialogOpen, recoveryPrefillEmail]);

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
    if (screen !== "game" || !game || !game.me) {
      setSpeechTimerDeadlineAt(null);
      setSpeechTimerLabel("");
      speechTimerStageRef.current = "";
      return;
    }
    const stages = game.stages && game.stages.length > 0 ? game.stages : DEFAULT_GAME_STAGES;
    const stageName = stages[game.stageIndex] ?? "";
    const stageKey = `${game.code}:${game.stageIndex}:${game.me.roleKey ?? ""}`;
    const roleKey = game.me.roleKey ?? "";
    const isOpeningStage = isRoleOpeningSpeechStageName(roleKey, stageName);
    const isClosingStage = isRoleSpeechStageName(roleKey, stageName) && isClosingSpeechStageName(stageName);
    let timerSec: number | null = null;
    let label = "";
    if (isOpeningStage && typeof game.openingSpeechTimerSec === "number") {
      timerSec = game.openingSpeechTimerSec;
      label = "Таймер вступительной речи";
    } else if (isClosingStage && typeof game.closingSpeechTimerSec === "number") {
      timerSec = game.closingSpeechTimerSec;
      label = "Таймер заключительной речи";
    }
    if (!timerSec) {
      setSpeechTimerDeadlineAt(null);
      setSpeechTimerLabel("");
      speechTimerStageRef.current = "";
      return;
    }
    if (speechTimerStageRef.current !== stageKey) {
      speechTimerStageRef.current = stageKey;
      setSpeechTimerDeadlineAt(Date.now() + timerSec * 1000);
      setSpeechTimerLabel(label);
    } else {
      setSpeechTimerLabel(label);
    }
  }, [screen, game]);

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
        if (ignoreLateRoomJoinedRef.current) {
          return;
        }
        clearRoomActionPending();
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
          rememberKnownUserIds(roomState.players);
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
          rememberKnownUserIds(gameState.players);
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
        casePackKey,
        maxPlayers,
        usePreferredRoles,
        allowWitnesses,
        maxObservers,
        openingSpeechTimerSec,
        closingSpeechTimerSec,
        protestLimitEnabled,
        maxProtestsPerPlayer,
        visibility,
        venueLabel,
        venueUrl,
        requiresPassword,
        hostSubscriptionTier,
        lobbyChat,
      }: {
        players: PlayerInfo[];
        hostId: string;
        isHostJudge?: boolean;
        roomName?: string;
        modeKey?: RoomModeKey;
        casePackKey?: string;
        maxPlayers?: number;
        usePreferredRoles?: boolean;
        allowWitnesses?: boolean;
        maxObservers?: number;
        openingSpeechTimerSec?: number | null;
        closingSpeechTimerSec?: number | null;
        protestLimitEnabled?: boolean;
        maxProtestsPerPlayer?: number | null;
        visibility?: "public" | "private";
        venueLabel?: string;
        venueUrl?: string;
        requiresPassword?: boolean;
        hostSubscriptionTier?: SubscriptionTier;
        lobbyChat?: LobbyChatMessage[];
      }) => {
        rememberKnownUserIds(players);
        setRoom((prev) => {
          if (!prev) return prev;
          const mergedPlayers = players.map((nextPlayer) => {
            const prevPlayer = prev.players.find((p) => p.id === nextPlayer.id);
            return {
              ...nextPlayer,
              avatar: nextPlayer.avatar ?? prevPlayer?.avatar,
              banner: nextPlayer.banner ?? prevPlayer?.banner,
            };
          });
          return {
            ...prev,
            players: mergedPlayers,
            hostId,
            roomName: roomName ?? prev.roomName,
            modeKey: modeKey ?? prev.modeKey,
            casePackKey: casePackKey ?? prev.casePackKey,
            maxPlayers: maxPlayers ?? prev.maxPlayers,
            usePreferredRoles: usePreferredRoles ?? prev.usePreferredRoles,
            allowWitnesses: allowWitnesses ?? prev.allowWitnesses,
            maxObservers: maxObservers ?? prev.maxObservers,
            openingSpeechTimerSec:
              openingSpeechTimerSec !== undefined ? openingSpeechTimerSec : prev.openingSpeechTimerSec,
            closingSpeechTimerSec:
              closingSpeechTimerSec !== undefined ? closingSpeechTimerSec : prev.closingSpeechTimerSec,
            protestLimitEnabled:
              protestLimitEnabled !== undefined ? protestLimitEnabled : prev.protestLimitEnabled,
            maxProtestsPerPlayer:
              maxProtestsPerPlayer !== undefined ? maxProtestsPerPlayer : prev.maxProtestsPerPlayer,
            visibility: visibility ?? prev.visibility,
            venueLabel: venueLabel ?? prev.venueLabel,
            venueUrl: venueUrl ?? prev.venueUrl,
            requiresPassword: requiresPassword ?? prev.requiresPassword,
            hostSubscriptionTier: hostSubscriptionTier ?? prev.hostSubscriptionTier,
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
      rememberKnownUserIds(players);
      setGame((prev) => {
        if (!prev) return prev;
        const mergedPlayers = players.map((nextPlayer) => {
          const prevPlayer = prev.players.find((p) => p.id === nextPlayer.id);
          return {
            ...nextPlayer,
            avatar: nextPlayer.avatar ?? prevPlayer?.avatar,
            banner: nextPlayer.banner ?? prevPlayer?.banner,
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
                banner: updatedSelf.banner ?? prev.me.banner,
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
        rememberKnownUserIds(players);
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
                    banner: updatedMe.banner,
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
    socket.on("case_packs_updated", ({ packs }: { packs: CasePackInfo[] }) => {
      const safePacks = Array.isArray(packs) ? packs : [];
      setCasePacks(safePacks);
      if (safePacks.length > 0) {
        const defaultPackKey = safePacks.find((pack) => pack.key === "classic")?.key ?? safePacks[0].key;
        setCreateRoomPackKey((prev) => {
          if (prev) {
            const prevPack = safePacks.find((pack) => pack.key === prev);
            if (prevPack && !isPackLockedForTier(prevPack, myTier)) {
              return prev;
            }
          }
          return defaultPackKey;
        });
      } else {
        setCreateRoomPackKey("classic");
      }
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
      clearRoomActionPending();
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
      clearRoomActionPending();
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
      setKickedAlert("Вы были кикнуты из лобби.");
      setTimeout(() => setKickedAlert(""), 3000);
    });

    socket.on("room_closed", () => {
      clearRoomActionPending();
      const previousRank = myProfileRef.current?.rank;
      if (authToken && myProfileRef.current?.subscription?.capabilities?.canUseRating) {
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
      ({
        revealedFacts,
        players,
      }: {
        revealedFacts: RevealedFact[];
        players?: Array<{ id: string; facts: Fact[] }>;
      }) => {
        setGame((prev) => {
          if (!prev) return prev;
          const myPlayerFacts = players?.find((player) => player.id === prev.me?.id)?.facts;
          if (!myPlayerFacts || !prev.me) {
            return { ...prev, revealedFacts };
          }
          const revealedIds = new Set(
            myPlayerFacts.filter((fact) => fact.revealed).map((fact) => fact.id),
          );
          setPendingFactRevealIds((pending) => pending.filter((id) => !revealedIds.has(id)));
          return {
            ...prev,
            revealedFacts,
            me: {
              ...prev.me,
              facts: myPlayerFacts,
            },
          };
        });
      },
    );

    socket.on("my_facts_updated", ({ facts }: { facts: Fact[] }) => {
      const revealedIds = new Set(
        facts.filter((fact) => fact.revealed).map((fact) => fact.id),
      );
      setPendingFactRevealIds((prev) => prev.filter((id) => !revealedIds.has(id)));
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
      setPendingFactRevealIds([]);
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
      clearRoomActionPending();
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
      socket.off("case_packs_updated");
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
  }, [socket, avatar, authToken, clearReconnectWindow, sharedAvatar, startReconnectWindow, syncRankResultAfterMatch, rememberKnownUserIds, clearRoomActionPending, myTier]);

  const createQuickRoom = useCallback(() => {
    if (isUserBanned) return;
    if (roomActionPending) return;
    const name = playerName.trim() || getOrCreateGuestName();
    localStorage.setItem("court_nickname", name);
    const payload: {
      playerName: string;
      avatar?: string;
      banner?: string;
      authToken?: string;
      options: { visibility: "public"; modeKey: "quick_flex" };
    } = {
      playerName: name,
      authToken: authToken || undefined,
      options: {
        visibility: "public",
        modeKey: "quick_flex",
      },
    };
    if (!authToken && sharedAvatar) {
      payload.avatar = sharedAvatar;
    }
    if (!authToken && sharedBanner) {
      payload.banner = sharedBanner;
    }
    beginRoomActionPending("create");
    socket.emit("create_room", payload);
  }, [socket, playerName, sharedAvatar, sharedBanner, authToken, roomActionPending, beginRoomActionPending, isUserBanned]);

  const createRoomFromPanel = useCallback(() => {
    if (isUserBanned) return false;
    if (roomActionPending) return false;
    const name = playerName.trim() || getOrCreateGuestName();
    if (selectedCreatePackLocked) {
      const requiredTier = getRequiredTierForPack(selectedCreatePack ?? {});
      openSubscriptionUpsell(
        requiredTier === "trainee"
          ? "canAccessPackSevere"
          : "canAccessAllPacks",
        `Выбранный пак доступен с подписки «${getSubscriptionTierLabel(requiredTier)}».`,
      );
      return false;
    }
    if (createRoomPrivate && !canCreatePrivateRooms) {
      openSubscriptionUpsell(
        "canCreatePrivateRooms",
        "Приватные комнаты доступны только в подписке «Арбитр».",
      );
      return false;
    }
    if (createRoomPrivate && !createRoomPassword.trim()) {
      setError("Для приватной комнаты задайте пароль.");
      setTimeout(() => setError(""), 3000);
      return false;
    }
    localStorage.setItem("court_nickname", name);
    const payload: {
      playerName: string;
      avatar?: string;
      banner?: string;
      authToken?: string;
      options: {
        modeKey: RoomModeKey;
        casePackKey: string;
        visibility: "public" | "private";
        roomName?: string;
        venueUrl?: string;
        password?: string;
      };
    } = {
      playerName: name,
      authToken: authToken || undefined,
      options: {
        modeKey: createRoomMode,
        casePackKey: createRoomPackKey || "classic",
        visibility: createRoomPrivate ? "private" : "public",
        roomName: createRoomName.trim() || undefined,
        venueUrl: createVoiceUrl.trim() || undefined,
        password:
          createRoomPrivate && createRoomPassword.trim()
            ? createRoomPassword.trim()
            : undefined,
      },
    };
    if (!authToken && sharedAvatar) {
      payload.avatar = sharedAvatar;
    }
    if (!authToken && sharedBanner) {
      payload.banner = sharedBanner;
    }
    beginRoomActionPending("create");
    socket.emit("create_room", payload);
    return true;
  }, [
    socket,
    playerName,
    sharedAvatar,
    sharedBanner,
    authToken,
    createRoomMode,
    createRoomPackKey,
    selectedCreatePackLocked,
    selectedCreatePack,
    createRoomPrivate,
    createRoomName,
    createVoiceUrl,
    createRoomPassword,
    roomActionPending,
    beginRoomActionPending,
    openSubscriptionUpsell,
    canCreatePrivateRooms,
    isUserBanned,
  ]);

  const joinRoom = useCallback((options?: { code?: string; password?: string }) => {
    if (isUserBanned) return;
    if (roomActionPending) return;
    const targetCode = (options?.code ?? joinCode).trim().toUpperCase();
    if (!targetCode) return;
    const password = (options?.password ?? "").trim();
    const name = playerName.trim() || getOrCreateGuestName();
    localStorage.setItem("court_nickname", name);
    const payload: {
      code: string;
      playerName: string;
      avatar?: string;
      banner?: string;
      authToken?: string;
      password?: string;
    } = {
      code: targetCode,
      playerName: name,
      authToken: authToken || undefined,
      password: password || undefined,
    };
    if (!authToken && sharedAvatar) {
      payload.avatar = sharedAvatar;
    }
    if (!authToken && sharedBanner) {
      payload.banner = sharedBanner;
    }
    beginRoomActionPending("join");
    socket.emit("join_room", payload);
  }, [socket, joinCode, playerName, sharedAvatar, sharedBanner, authToken, roomActionPending, beginRoomActionPending, isUserBanned]);

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
    const authAvatar = authUser?.avatar ?? null;
    const authBanner = authUser?.banner ?? null;
    const profilePatch: Record<string, unknown> = {
      nickname: normalizedName,
      bio: profileBio.trim() || null,
      gender: profileGender || null,
      birthDate: normalizedBirthDate || null,
      hideAge: profileHideAge,
      selectedBadgeKey: selectedBadgeKey || null,
      preferredRole: preferredRoleDraft || null,
    };
    const nextAvatar = profileAvatarDraft ?? null;
    if (
      nextAvatar !== authAvatar &&
      (!nextAvatar ||
        canUseAnimatedProfileMedia ||
        !isAnimatedProfileMediaValue(nextAvatar))
    ) {
      profilePatch.avatar = nextAvatar;
    }
    const nextBanner = profileBannerDraft ?? null;
    if (nextBanner !== authBanner) {
      if (!canUseProfileBanner && nextBanner) {
        openSubscriptionUpsell(
          "canUseProfileBanner",
          "Баннер профиля доступен с подписки «Практик».",
        );
      } else if (
        nextBanner &&
        !canUseAnimatedProfileMedia &&
        isAnimatedProfileMediaValue(nextBanner)
      ) {
        openSubscriptionUpsell(
          "canUseAnimatedProfileMedia",
          "GIF-баннер доступен только в подписке «Арбитр».",
        );
      } else {
        profilePatch.banner = nextBanner;
      }
    }

    setProfileActionLoading(true);
    try {
      const payload = await authRequest<{ user: AuthUser }>("/auth/profile", {
        method: "PATCH",
        token: authToken,
        body: profilePatch,
      });
      setAuthUser(payload.user);
      persistAuthUserToLocalCache(payload.user);
      setPlayerName(normalizedName);
      setProfileNicknameDraft(normalizedName);
      setAvatar(payload.user.avatar ?? null);
      setBanner(payload.user.banner ?? null);
      safeSetLocalStorageItem("court_nickname", normalizedName);
      persistMediaToLocalCache("court_avatar", payload.user.avatar ?? null);
      persistMediaToLocalCache(BANNER_STORAGE_KEY, payload.user.banner ?? null);
      if (activeRoomCode && mySessionToken) {
        const socketProfilePatch: Record<string, unknown> = {
          code: activeRoomCode,
          sessionToken: mySessionToken,
          name: normalizedName,
          selectedBadgeKey: selectedBadgeKey || null,
          preferredRole: preferredRoleDraft || null,
        };
        if (Object.prototype.hasOwnProperty.call(profilePatch, "avatar")) {
          socketProfilePatch.avatar = profileAvatarDraft;
        }
        if (Object.prototype.hasOwnProperty.call(profilePatch, "banner")) {
          socketProfilePatch.banner = profileBannerDraft;
        }
        socket.emit("update_profile", {
          ...socketProfilePatch,
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
    authUser,
    authToken,
    profileNicknameDraft,
    profileBirthDate,
    profileBio,
    profileGender,
    profileHideAge,
    preferredRoleDraft,
    reloadMyProfile,
    selectedBadgeKey,
    profileAvatarDraft,
    profileBannerDraft,
    activeRoomCode,
    mySessionToken,
    socket,
    canUseProfileBanner,
    canUseAnimatedProfileMedia,
    openSubscriptionUpsell,
  ]);

  const requestPasswordChangeCode = useCallback(async (): Promise<boolean> => {
    if (!authToken) return false;
    const nextPassword = passwordChangeNext;
    const confirmPassword = passwordChangeConfirm;
    if (!nextPassword) return false;
    if (nextPassword.length < 8) {
      setPasswordChangeNoticeKind("error");
      setPasswordChangeNotice("Пароль должен быть не короче 8 символов.");
      return false;
    }
    if (!confirmPassword) {
      setPasswordChangeNoticeKind("error");
      setPasswordChangeNotice("Повторите новый пароль.");
      return false;
    }
    if (nextPassword !== confirmPassword) {
      setPasswordChangeNoticeKind("error");
      setPasswordChangeNotice("Пароли не совпадают.");
      return false;
    }
    if (passwordChangeCooldownLeft > 0) {
      return false;
    }
    setProfileActionLoading(true);
    try {
      const payload = await authRequest<{ ok: boolean; message?: string }>("/auth/password/code/request", {
        method: "POST",
        token: authToken,
      });
      setPasswordChangeCodeSent(true);
      setPasswordChangeCooldownUntil(Date.now() + 60_000);
      setPasswordChangeNoticeKind("info");
      setPasswordChangeNotice(payload.message || "Код отправлен на почту.");
      return true;
    } catch (err) {
      const message = err instanceof Error ? localizeAuthError(err.message) : "Не удалось отправить код.";
      const cooldownSeconds = extractCooldownSeconds(message);
      if (cooldownSeconds !== null) {
        setPasswordChangeCooldownUntil(Date.now() + cooldownSeconds * 1000);
      }
      setPasswordChangeNoticeKind("error");
      setPasswordChangeNotice(message);
      return false;
    } finally {
      setProfileActionLoading(false);
    }
  }, [authToken, passwordChangeConfirm, passwordChangeCooldownLeft, passwordChangeNext]);

  const changePassword = useCallback(async (): Promise<boolean> => {
    if (!authToken) return false;
    const nextPassword = passwordChangeNext;
    const confirmPassword = passwordChangeConfirm;
    if (!nextPassword) return false;
    if (nextPassword.length < 8) {
      setPasswordChangeNoticeKind("error");
      setPasswordChangeNotice("Пароль должен быть не короче 8 символов.");
      return false;
    }
    if (!confirmPassword) {
      setPasswordChangeNoticeKind("error");
      setPasswordChangeNotice("Повторите новый пароль.");
      return false;
    }
    if (nextPassword !== confirmPassword) {
      setPasswordChangeNoticeKind("error");
      setPasswordChangeNotice("Пароли не совпадают.");
      return false;
    }
    if (!passwordChangeCodeSent) {
      return requestPasswordChangeCode();
    }

    setProfileActionLoading(true);
    try {
      if (!passwordChangeCode.trim()) {
        return false;
      }

      await authRequest<{ ok: boolean }>("/auth/password/code/confirm", {
        method: "PATCH",
        token: authToken,
        body: {
          code: passwordChangeCode.trim(),
          nextPassword,
        },
      });
      await reloadMyProfile();
      setPasswordChangeNotice("");
      setPasswordDialogOpen(false);
      showPasswordUpdatedToast();
      return true;
    } catch (err) {
      const message = err instanceof Error ? localizeAuthError(err.message) : "Не удалось сменить пароль.";
      const cooldownSeconds = extractCooldownSeconds(message);
      if (cooldownSeconds !== null) {
        setPasswordChangeCooldownUntil(Date.now() + cooldownSeconds * 1000);
      }
      setPasswordChangeNoticeKind("error");
      setPasswordChangeNotice(message);
      return false;
    } finally {
      setProfileActionLoading(false);
    }
  }, [
    authToken,
    passwordChangeCode,
    passwordChangeCodeSent,
    passwordChangeConfirm,
    passwordChangeNext,
    requestPasswordChangeCode,
    reloadMyProfile,
    showPasswordUpdatedToast,
  ]);

  const changeEmail = useCallback(async (): Promise<boolean> => {
    if (!authToken) return false;
    if (!emailChangeCurrentPassword || !emailChangeNext.trim()) return false;
    setProfileActionLoading(true);
    try {
      if (!emailChangeCodeSent) {
        if (emailChangeCooldownLeft > 0) {
          setEmailChangeNoticeKind("error");
          setEmailChangeNotice(`Повторный код можно запросить через ${emailChangeCooldownLeft} сек.`);
          return false;
        }
        const payload = await authRequest<{ ok: boolean; message?: string }>("/auth/email/code/request", {
          method: "POST",
          token: authToken,
          body: {
            currentPassword: emailChangeCurrentPassword,
            nextEmail: emailChangeNext.trim(),
          },
        });
        setEmailChangeCodeSent(true);
        setEmailChangeCooldownUntil(Date.now() + 60_000);
        setEmailChangeNoticeKind("info");
        setEmailChangeNotice(
          payload.message || "Код отправлен на новую почту. Если письма нет, проверьте папку «Спам».",
        );
        return false;
      }

      if (!emailChangeCode.trim()) {
        return false;
      }

      const payload = await authRequest<{ user: AuthUser }>("/auth/email/code/confirm", {
        method: "PATCH",
        token: authToken,
        body: {
          nextEmail: emailChangeNext.trim(),
          code: emailChangeCode.trim(),
        },
      });
      setAuthUser(payload.user);
      persistAuthUserToLocalCache(payload.user);
      setEmailChangeCurrentPassword("");
      setEmailChangeNext("");
      setEmailChangeCode("");
      setEmailChangeCodeSent(false);
      await reloadMyProfile();
      setEmailChangeNoticeKind("success");
      setEmailChangeNotice("Почта обновлена.");
      return true;
    } catch (err) {
      const message = err instanceof Error ? localizeAuthError(err.message) : "Не удалось сменить почту.";
      const cooldownSeconds = extractCooldownSeconds(message);
      if (cooldownSeconds !== null) {
        setEmailChangeCooldownUntil(Date.now() + cooldownSeconds * 1000);
      }
      setEmailChangeNoticeKind("error");
      setEmailChangeNotice(message);
      return false;
    } finally {
      setProfileActionLoading(false);
    }
  }, [
    authToken,
    emailChangeCode,
    emailChangeCodeSent,
    emailChangeCooldownLeft,
    emailChangeCurrentPassword,
    emailChangeNext,
    reloadMyProfile,
  ]);

  const requestPasswordRecoveryCode = useCallback(async (): Promise<boolean> => {
    const email = passwordRecoveryEmail.trim();
    setPasswordRecoveryEmailError("");
    if (!email || !email.includes("@")) {
      setPasswordRecoveryNoticeKind("error");
      setPasswordRecoveryNotice("Введите корректную почту.");
      setPasswordRecoveryEmailError("Введите корректную почту.");
      return false;
    }
    if (passwordRecoveryCooldownLeft > 0) return false;
    setPasswordRecoveryLoading(true);
    try {
      await authRequest<{ ok: boolean; message?: string }>("/auth/password/recovery/request", {
        method: "POST",
        body: { email },
      });
      setPasswordRecoveryCode("");
      setPasswordRecoveryStep("code");
      setPasswordRecoveryCooldownUntil(Date.now() + 60_000);
      setPasswordRecoveryNotice("");
      return true;
    } catch (err) {
      const message = err instanceof Error ? localizeAuthError(err.message) : "Не удалось отправить код.";
      const cooldownSeconds = extractCooldownSeconds(message);
      if (cooldownSeconds !== null) {
        setPasswordRecoveryCooldownUntil(Date.now() + cooldownSeconds * 1000);
      }
      setPasswordRecoveryNoticeKind("error");
      setPasswordRecoveryNotice(message);
      if (
        message.toLowerCase().includes("аккаунт") ||
        message.toLowerCase().includes("почт") ||
        message.toLowerCase().includes("email")
      ) {
        setPasswordRecoveryEmailError(message);
        setPasswordRecoveryNotice("");
      }
      return false;
    } finally {
      setPasswordRecoveryLoading(false);
    }
  }, [passwordRecoveryCooldownLeft, passwordRecoveryEmail]);

  const movePasswordRecoveryToPasswordStep = useCallback(async () => {
    const code = passwordRecoveryCode.trim();
    if (!code) {
      setPasswordRecoveryNoticeKind("error");
      setPasswordRecoveryNotice("Введите код из письма.");
      return false;
    }
    setPasswordRecoveryLoading(true);
    try {
      await authRequest<{ ok: boolean }>("/auth/password/recovery/verify", {
        method: "POST",
        body: {
          email: passwordRecoveryEmail.trim(),
          code,
        },
      });
      setPasswordRecoveryNotice("");
      setPasswordRecoveryStep("password");
      return true;
    } catch (err) {
      const message = err instanceof Error ? localizeAuthError(err.message) : "Код неверный или уже истек.";
      setPasswordRecoveryNoticeKind("error");
      setPasswordRecoveryNotice(message);
      return false;
    } finally {
      setPasswordRecoveryLoading(false);
    }
  }, [passwordRecoveryCode, passwordRecoveryEmail]);

  const confirmPasswordRecovery = useCallback(async (): Promise<boolean> => {
    const email = passwordRecoveryEmail.trim();
    const code = passwordRecoveryCode.trim();
    const nextPassword = passwordRecoveryNextPassword;
    const confirmPassword = passwordRecoveryConfirmPassword;
    if (!email || !email.includes("@") || !code || !nextPassword || !confirmPassword) {
      return false;
    }
    if (nextPassword.length < 8) {
      setPasswordRecoveryNoticeKind("error");
      setPasswordRecoveryNotice("Пароль должен быть не короче 8 символов.");
      return false;
    }
    if (nextPassword !== confirmPassword) {
      setPasswordRecoveryNoticeKind("error");
      setPasswordRecoveryNotice("Пароли не совпадают.");
      return false;
    }
    setPasswordRecoveryLoading(true);
    try {
      await authRequest<{ ok: boolean; message?: string }>("/auth/password/recovery/confirm", {
        method: "POST",
        body: {
          email,
          code,
          nextPassword,
        },
      });
      setPasswordRecoveryDialogOpen(false);
      setPasswordRecoveryStep("email");
      setPasswordRecoveryNotice("");
      setPasswordRecoveryCode("");
      setPasswordRecoveryNextPassword("");
      setPasswordRecoveryConfirmPassword("");
      setPasswordRecoveryEmail("");
      setAuthMode("login");
      setAuthDialogOpen(true);
      setAuthError("");
      showPasswordUpdatedToast();
      return true;
    } catch (err) {
      const message =
        err instanceof Error ? localizeAuthError(err.message) : "Не удалось восстановить пароль.";
      setPasswordRecoveryNoticeKind("error");
      setPasswordRecoveryNotice(message);
      return false;
    } finally {
      setPasswordRecoveryLoading(false);
    }
  }, [
    passwordRecoveryCode,
    passwordRecoveryConfirmPassword,
    passwordRecoveryEmail,
    passwordRecoveryNextPassword,
    showPasswordUpdatedToast,
  ]);

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

  const openUserProfileFromPlayer = useCallback(
    (payload: {
      playerId: string;
      userId?: string;
      name: string;
      avatar?: string;
      banner?: string;
      selectedBadgeKey?: string;
    }) => {
      if (!payload.userId) return;
      void openUserProfile(payload.userId);
    },
    [openUserProfile],
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
    if (isUserBanned) return;
    setProfileMenuOpen(false);
    setScreen("profile");
  }, [isUserBanned]);

  const handlePlayerNameChange = useCallback((value: string) => {
    setProfileNicknameDraft(value.slice(0, 20));
  }, []);

  const handleAuthSuccess = useCallback((user: AuthUser, token: string) => {
    setAuthUser(user);
    setAuthToken(token);
    safeSetLocalStorageItem(AUTH_TOKEN_STORAGE_KEY, token);
    persistAuthUserToLocalCache(user);
    safeSetLocalStorageItem("court_nickname", user.nickname);
    setPlayerName(user.nickname);
    setProfileNicknameDraft(user.nickname);
    setPreferredRoleDraft(user.preferredRole ?? "");
    if (user.avatar) {
      setAvatar(user.avatar);
      persistMediaToLocalCache("court_avatar", user.avatar);
    }
    if (user.banner) {
      setBanner(user.banner);
      persistMediaToLocalCache(BANNER_STORAGE_KEY, user.banner);
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
        preferredRole: user.preferredRole ?? null,
      });
    }
    setScreen("profile");
  }, [activeRoomCode, mySessionToken, socket]);

  const startDiscordAuth = useCallback(() => {
    window.location.href = "/api/auth/discord/start";
  }, []);

  const startGoogleAuth = useCallback(() => {
    window.location.href = "/api/auth/google/start";
  }, []);

  useEffect(() => {
    const hashRaw = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;
    if (!hashRaw || hashRaw === oauthAuthHashHandledRef.current) return;
    const params = new URLSearchParams(hashRaw);
    const discordToken = String(params.get("discord_token") ?? "").trim();
    const discordError = String(params.get("discord_error") ?? "").trim();
    const googleToken = String(params.get("google_token") ?? "").trim();
    const googleError = String(params.get("google_error") ?? "").trim();
    if (!discordToken && !discordError && !googleToken && !googleError) return;

    const oauthToken = discordToken || googleToken;
    const oauthError = discordError || googleError;
    const provider = discordToken || discordError ? "Discord" : "Google";

    oauthAuthHashHandledRef.current = hashRaw;
    const clearHash = () => {
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}${window.location.search}`,
      );
    };

    if (oauthError) {
      setAuthMode("login");
      setAuthView("form");
      setAuthError(localizeAuthError(oauthError));
      setAuthDialogOpen(true);
      clearHash();
      return;
    }

    setAuthLoading(true);
    authRequest<{ user: AuthUser }>("/auth/me", { token: oauthToken })
      .then(({ user }) => {
        handleAuthSuccess(user, oauthToken);
      })
      .catch((err) => {
        const message =
          err instanceof Error
            ? localizeAuthError(err.message)
            : `Не удалось войти через ${provider}.`;
        setAuthMode("login");
        setAuthView("form");
        setAuthError(message);
        setAuthDialogOpen(true);
      })
      .finally(() => {
        setAuthLoading(false);
        clearHash();
      });
  }, [handleAuthSuccess]);

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
    if (isUserBanned) return;
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
  }, [authToken, isUserBanned]);

  const reconnect = useCallback(() => {
    if (isUserBanned) return;
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
    isUserBanned,
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
  const adminTargetRoomCode = room?.code ?? game?.code ?? null;
  const canManageAdminBots = !!adminTargetRoomCode && isCreatorAdmin;
  const adminBotPlayers = useMemo(() => {
    if (room) {
      return room.players.filter((player) => player.isBot || /^бот-\d+$/i.test((player.name ?? "").trim()));
    }
    if (game) {
      return game.players.filter((player) => player.isBot || /^бот-\d+$/i.test((player.name ?? "").trim()));
    }
    return [] as PlayerInfo[];
  }, [room, game]);

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

  const togglePreferredRoles = useCallback((checked: boolean) => {
    if (!room || !roomControlSessionToken) return;
    if (checked && !canLetPlayersChooseRoles) {
      openSubscriptionUpsell(
        "canLetPlayersChooseRoles",
        "Разрешать игрокам выбирать роли можно с подписки «Практик».",
      );
      return;
    }
    setRoom((prev) => (prev ? { ...prev, usePreferredRoles: checked } : prev));
    socket.emit("set_use_preferred_roles", {
      code: room.code,
      sessionToken: roomControlSessionToken,
      usePreferredRoles: checked,
    });
  }, [socket, room, roomControlSessionToken, canLetPlayersChooseRoles, openSubscriptionUpsell]);

  const chooseLobbyRole = useCallback((roleKey: AssignableRole | null, targetPlayerId?: string) => {
    if (!room || !roomControlSessionToken) return;
    const isHost = room.hostId === roomControlPlayerId;
    const selfPlayerId = roomControlPlayerId ?? myId ?? "";
    const selfPlayer = room.players.find((player) => player.id === selfPlayerId);
    const selfLobbyTier = normalizeSubscriptionTier(selfPlayer?.subscriptionTier ?? myTier);
    const canChooseRoleInOtherLobbiesNow = hasCapability(
      selfLobbyTier,
      "canChooseRoleInOtherLobbies",
    );
    const targetId = targetPlayerId ?? selfPlayerId;
    const isSelf = !targetId || targetId === selfPlayerId;
    if (isHost) {
      if (isSelf && !canChooseRoleInOwnLobby) {
        openSubscriptionUpsell(
          "canChooseRoleInOwnLobby",
          "Выбор своей роли доступен с подписки «Стажер».",
        );
        return;
      }
      if (!isSelf && !canLetPlayersChooseRoles) {
        openSubscriptionUpsell(
          "canLetPlayersChooseRoles",
          "Управление выбором ролей игроков доступно с подписки «Практик».",
        );
        return;
      }
    } else if (!room.usePreferredRoles && !canChooseRoleInOtherLobbiesNow) {
      openSubscriptionUpsell(
        "canChooseRoleInOtherLobbies",
        "Выбор роли в чужом лобби доступен только в подписке «Арбитр».",
      );
      return;
    }
    if (!isHost && isSelf && !room.usePreferredRoles) {
      const selfPlayer = room.players.find((player) => player.id === selfPlayerId);
      if (selfPlayer?.roleAssignmentSource === "manual") {
        return;
      }
    }
    socket.emit("choose_lobby_role", {
      code: room.code,
      sessionToken: roomControlSessionToken,
      roleKey,
      targetPlayerId,
    });
  }, [
    socket,
    room,
    roomControlSessionToken,
    roomControlPlayerId,
    myTier,
    canChooseRoleInOwnLobby,
    canLetPlayersChooseRoles,
    openSubscriptionUpsell,
  ]);

  const updateRoomManagementSettings = useCallback((patch: Record<string, unknown>) => {
    if (!room || !roomControlSessionToken) return;
    socket.emit("update_room_management", {
      code: room.code,
      sessionToken: roomControlSessionToken,
      patch,
    });
  }, [
    socket,
    room,
    roomControlSessionToken,
  ]);

  const transferRoomHostTo = useCallback((targetPlayerId: string) => {
    if (!room || !roomControlSessionToken || !targetPlayerId || targetPlayerId === room.hostId) return;
    socket.emit("transfer_room_host", {
      code: room.code,
      targetPlayerId,
      sessionToken: roomControlSessionToken,
    });
  }, [socket, room, roomControlSessionToken]);

  const addAdminBots = useCallback(() => {
    if (!adminTargetRoomCode || !adminAccessGranted) return;
    socket.emit("admin_add_bots", {
      code: adminTargetRoomCode,
      authToken: authToken || undefined,
      adminKey: adminPanelKeyTrimmed || undefined,
      count: Math.max(1, Math.min(6, adminBotCount)),
    });
  }, [
    socket,
    authToken,
    adminAccessGranted,
    adminBotCount,
    adminTargetRoomCode,
    adminPanelKeyTrimmed,
  ]);

  const controlAdminPlayer = useCallback((targetPlayerId: string) => {
    if (!adminTargetRoomCode || !adminAccessGranted) return;
    if (!targetPlayerId) return;
    socket.emit("admin_control_player", {
      code: adminTargetRoomCode,
      targetPlayerId,
      authToken: authToken || undefined,
      adminKey: adminPanelKeyTrimmed || undefined,
    });
  }, [socket, adminTargetRoomCode, authToken, adminAccessGranted, adminPanelKeyTrimmed]);

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
      if (pendingFactRevealIds.includes(factId)) return;
      const fact = game.me?.facts.find((item) => item.id === factId);
      if (!fact || fact.revealed || game.me?.canRevealFactsNow !== true) return;
      setPendingFactRevealIds((prev) => (prev.includes(factId) ? prev : [...prev, factId]));
      window.setTimeout(() => {
        setPendingFactRevealIds((prev) => prev.filter((id) => id !== factId));
      }, 2500);
      socket.emit("reveal_fact", {
        code: game.code,
        sessionToken: mySessionToken,
        factId,
      });
    },
    [socket, game, mySessionToken, pendingFactRevealIds],
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
    const shouldPreserveReconnect = false;
    clearReconnectWindow();
    localStorage.removeItem("court_session");
    localStorage.removeItem("court_session_token");
    setHasSession(false);
    setMySessionToken(null);
    clearRoomActionPending();
    ignoreLateRoomJoinedRef.current = true;
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
      if (authToken && myProfileRef.current?.subscription?.capabilities?.canUseRating) {
        localStorage.setItem(RANK_TOAST_PENDING_STORAGE_KEY, "1");
      }
      void syncRankResultAfterMatch(previousRank);
    }
  }, [authToken, clearReconnectWindow, game, socket, syncRankResultAfterMatch, clearRoomActionPending]);

  const finalExit = useCallback(() => {
    const previousRank = myProfileRef.current?.rank;
    const finishedWithVerdict = !!game?.verdict;
    const shouldPreserveReconnect = false;
    clearReconnectWindow();
    localStorage.removeItem("court_session");
    localStorage.removeItem("court_session_token");
    setHasSession(false);
    setMySessionToken(null);
    clearRoomActionPending();
    ignoreLateRoomJoinedRef.current = true;
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
      if (authToken && myProfileRef.current?.subscription?.capabilities?.canUseRating) {
        localStorage.setItem(RANK_TOAST_PENDING_STORAGE_KEY, "1");
      }
      void syncRankResultAfterMatch(previousRank);
    }
  }, [authToken, clearReconnectWindow, game, socket, syncRankResultAfterMatch, clearRoomActionPending]);

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

  const readFileAsDataUrl = useCallback(
    (file: File): Promise<string> =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const dataUrl = (ev.target?.result as string) || "";
          if (dataUrl) {
            resolve(dataUrl);
            return;
          }
          reject(new Error("Не удалось прочитать изображение."));
        };
        reader.onerror = () => reject(new Error("Не удалось прочитать изображение."));
        reader.readAsDataURL(file);
      }),
    [],
  );

  const isGifUpload = useCallback((file: File) => {
    const fileType = (file.type || "").toLowerCase();
    const fileName = (file.name || "").toLowerCase();
    return fileType === "image/gif" || fileName.endsWith(".gif");
  }, []);

  const openImageCropper = useCallback(
    async (file: File, target: CropTarget) => {
      try {
        if (target === "banner" && !canUseProfileBanner) {
          openSubscriptionUpsell(
            "canUseProfileBanner",
            "Баннер профиля доступен с подписки «Практик».",
          );
          return;
        }
        const gifFile = isGifUpload(file);
        if (gifFile && !canUseAnimatedProfileMedia) {
          openSubscriptionUpsell(
            "canUseAnimatedProfileMedia",
            target === "banner"
              ? "GIF-баннер доступен только в подписке «Арбитр»."
              : "GIF-аватар доступен только в подписке «Арбитр».",
          );
          return;
        }
        const maxBytes = gifFile ? MAX_PROFILE_GIF_UPLOAD_BYTES : MAX_PROFILE_IMAGE_UPLOAD_BYTES;
        if (file.size > maxBytes) {
          const maxMb = gifFile
            ? Math.round(MAX_PROFILE_GIF_UPLOAD_BYTES / (1024 * 1024))
            : Math.round(MAX_PROFILE_IMAGE_UPLOAD_BYTES / (1024 * 1024));
          setError(
            gifFile
              ? `GIF слишком тяжелый. Максимум ${maxMb} МБ.`
              : `Файл слишком тяжелый. Максимум ${maxMb} МБ.`,
          );
          setTimeout(() => setError(""), 3500);
          return;
        }
        const dataUrl = await readFileAsDataUrl(file);
        if (!dataUrl) return;
        const img = new Image();
        img.onload = () => {
          setImageCropNaturalWidth(Math.max(1, img.naturalWidth || img.width || 1024));
          setImageCropNaturalHeight(Math.max(1, img.naturalHeight || img.height || 1024));
          setImageCropTarget(target);
          setImageCropSource(dataUrl);
          setImageCropSourceIsGif(gifFile);
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
          setImageCropSourceIsGif(gifFile);
          setImageCropZoom(1);
          setImageCropOffsetX(0);
          setImageCropOffsetY(0);
          setImageCropFlipX(false);
          setImageCropDialogOpen(true);
        };
        img.src = dataUrl;
      } catch {
        setError("Не удалось загрузить изображение.");
        setTimeout(() => setError(""), 3000);
      }
    },
    [
      canUseAnimatedProfileMedia,
      canUseProfileBanner,
      isGifUpload,
      openSubscriptionUpsell,
      readFileAsDataUrl,
    ],
  );

  const applyImageCrop = useCallback(async () => {
    if (!imageCropSource) return;
    setImageCropLoading(true);
    try {
      if (imageCropSourceIsGif) {
        const safeDisplayWidth = Math.max(1, imageCropDisplayWidth);
        const safeDisplayHeight = Math.max(1, imageCropDisplayHeight);
        const focusX = Math.max(0, Math.min(100, (0.5 - imageCropOffsetX / safeDisplayWidth) * 100));
        const focusY = Math.max(0, Math.min(100, (0.5 - imageCropOffsetY / safeDisplayHeight) * 100));
        const displayRatioX = safeDisplayWidth / Math.max(1, imageCropViewport.width);
        const displayRatioY = safeDisplayHeight / Math.max(1, imageCropViewport.height);
        const offsetRatioX = imageCropOffsetX / Math.max(1, imageCropViewport.width);
        const offsetRatioY = imageCropOffsetY / Math.max(1, imageCropViewport.height);
        const encodedGif = encodeGifCropMeta({
          v: 1,
          kind: "gif_crop",
          src: imageCropSource,
          target: imageCropTarget,
          zoom: Math.max(1, Math.min(3, imageCropZoom)),
          focusX,
          focusY,
          flipX: imageCropFlipX,
          displayRatioX,
          displayRatioY,
          offsetRatioX,
          offsetRatioY,
        });
        if (imageCropTarget === "avatar") {
          setProfileAvatarDraft(encodedGif);
        } else {
          setProfileBannerDraft(encodedGif);
        }
        setImageCropDialogOpen(false);
        setImageCropSource(null);
        setImageCropSourceIsGif(false);
        return;
      }
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
      setImageCropSourceIsGif(false);
    } finally {
      setImageCropLoading(false);
    }
  }, [
    compressImage,
    imageCropDisplayHeight,
    imageCropDisplayWidth,
    imageCropOffsetX,
    imageCropOffsetY,
    imageCropFlipX,
    imageCropSource,
    imageCropSourceIsGif,
    imageCropTarget,
    imageCropViewport.height,
    imageCropViewport.width,
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
      void openImageCropper(file, "avatar");
      e.target.value = "";
    },
    [openImageCropper],
  );

  const handleBannerChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      void openImageCropper(file, "banner");
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
  const upsellNestedBackdrop =
    createMatchDialogOpen ||
    roomManageOpen ||
    joinPasswordDialogOpen ||
    lobbyRoleDialogOpen ||
    promoDialogOpen ||
    profileMatchesOpen ||
    badgeRulesOpen ||
    authDialogOpen;
  const activeLegalDoc = legalDialogType ? LEGAL_DOCS[legalDialogType] : null;
  const showLegalFooterOnHomeTabs =
    homeTab === "play" || homeTab === "shop" || homeTab === "development" || homeTab === "help";
  const hasBlockingHomeDialog =
    createMatchDialogOpen ||
    joinPasswordDialogOpen ||
    observerListDialogOpen ||
    roomManageOpen ||
    promoDialogOpen ||
    legalDialogType !== null;
  const showLegalFooter = showLegalFooterOnHomeTabs && !hasBlockingHomeDialog;

  const renderUpsellModal = () => (
    <Dialog open={upsellModalOpen} onOpenChange={setUpsellModalOpen}>
      <DialogContent
        overlayClassName={upsellNestedBackdrop ? "z-[510] !bg-transparent" : "z-[510] bg-black/86"}
        className="z-[520] max-w-[470px] border-red-950/70 bg-[radial-gradient(130%_110%_at_0%_0%,rgba(239,68,68,0.22),transparent_50%),linear-gradient(160deg,rgba(12,10,11,0.98),rgba(10,10,12,0.98))] text-zinc-100 shadow-[0_24px_84px_rgba(0,0,0,0.72)]"
      >
        <DialogHeader>
          <div className="mb-1 inline-flex h-10 w-10 items-center justify-center rounded-full border border-red-400/55 bg-red-600/20 text-red-100 shadow-[0_0_18px_rgba(239,68,68,0.2)]">
            <Lock className="h-4 w-4" />
          </div>
          <DialogTitle className="text-xl">{upsellTitle}</DialogTitle>
          <DialogDescription className="text-zinc-300">
            {upsellDescription}
          </DialogDescription>
          {upsellTitle !== "Оплата скоро" && (
            <div className="mt-2 inline-flex w-fit items-center gap-2 rounded-full border border-red-400/45 bg-red-500/18 px-3 py-1 text-xs font-medium text-red-100 mx-auto sm:mx-0">
              <Crown className="h-3.5 w-3.5" />
              План: {getSubscriptionTierLabel(upsellRequiredTier)}
            </div>
          )}
        </DialogHeader>
        <div className="flex gap-2.5">
          {upsellTitle !== "Оплата скоро" && (
            <Button
              type="button"
              className="h-11 flex-1 rounded-xl bg-red-600 text-white hover:bg-red-500"
              onClick={navigateToShop}
            >
              Перейти в магазин
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            className={`h-11 rounded-xl border-zinc-700 bg-zinc-900/85 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-100 ${upsellTitle !== "Оплата скоро" ? "flex-1" : "w-full"}`}
            onClick={() => setUpsellModalOpen(false)}
          >
            Закрыть
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
  const renderBanOverlay = () => {
    if (!activeBan) return null;
    const countdown =
      !activeBan.isPermanent && typeof activeBan.bannedUntil === "number"
        ? getBanCountdownParts(activeBan.bannedUntil - nowMs)
        : null;
    return (
      <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 px-3 sm:px-4">
        <div className="w-full max-w-2xl rounded-2xl border border-red-500/45 bg-[radial-gradient(120%_130%_at_50%_0%,rgba(239,68,68,0.24),transparent_58%),linear-gradient(165deg,rgba(15,10,12,0.98),rgba(10,10,12,0.98))] p-4 sm:p-5 text-zinc-100 shadow-[0_34px_100px_rgba(0,0,0,0.76)]">
          <div className="text-center text-[clamp(1.5rem,6.2vw,2.35rem)] leading-[0.95] font-black tracking-[0.03em] text-red-100 whitespace-nowrap">
            ВЫ ЗАБЛОКИРОВАНЫ
          </div>
          <div className="mt-4 text-center text-base sm:text-xl text-zinc-200 break-words">
            {activeBan.reason?.trim() ? activeBan.reason.trim() : "Нарушение правил проекта."}
          </div>
          <div className="mt-5">
            {activeBan.isPermanent ? (
              <div className="text-center text-xl font-bold text-red-200">Навсегда</div>
            ) : (
              <div className="mx-auto flex w-full max-w-[520px] items-center justify-center gap-1 rounded-2xl border border-zinc-800/85 bg-zinc-950/45 px-1.5 py-2">
                {[
                  { key: "d", value: countdown?.days ?? 0, label: "дней" },
                  { key: "h", value: countdown?.hours ?? 0, label: "часов" },
                  { key: "m", value: countdown?.minutes ?? 0, label: "минут" },
                  { key: "s", value: countdown?.seconds ?? 0, label: "секунд" },
                ].map((item, idx, arr) => (
                  <div key={`ban-timer-${item.key}`} className="flex shrink-0 items-center justify-center">
                    <div className="w-[66px] rounded-lg border border-zinc-700/70 bg-zinc-950/80 px-1.5 py-1.5 text-center sm:w-[80px]">
                      <div className="text-[15px] font-bold leading-none text-zinc-100">{String(item.value).padStart(2, "0")}</div>
                      <div className="mt-1 text-[9px] uppercase tracking-[0.12em] text-zinc-500">{item.label}</div>
                    </div>
                    {idx < arr.length - 1 && <div className="mx-0.5 text-zinc-700">:</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="mt-3 text-center text-xs text-zinc-500">
            Пока блокировка активна, действия и переходы недоступны.
          </div>
        </div>
      </div>
    );
  };
  const renderAdminTools = () => {
    if (!canSeeAdminButton) return null;
    const currentHostId = room?.hostId ?? game?.hostId ?? null;
    return (
      <>
        <button
          type="button"
          onClick={() => setAdminToolsOpen(true)}
          className="fixed bottom-5 left-5 z-[440] inline-flex h-10 items-center gap-2 rounded-xl border border-red-500/45 bg-zinc-950/92 px-3 text-xs font-semibold text-red-200 shadow-[0_12px_28px_rgba(0,0,0,0.5)] transition hover:border-red-400/70 hover:text-red-100"
        >
          <Wrench className="h-3.5 w-3.5" />
          Админ
        </button>
        <Dialog open={adminToolsOpen} onOpenChange={setAdminToolsOpen}>
          <DialogContent className={`z-[450] max-w-3xl border-zinc-800 bg-zinc-950 text-zinc-100 ${HIDE_SCROLLBAR_CLASS}`}>
            <DialogHeader>
              <DialogTitle>Админ-панель</DialogTitle>
              <DialogDescription className="text-zinc-400">
                Управление промокодами и служебными инструментами.
              </DialogDescription>
            </DialogHeader>
            <div className={`space-y-4 max-h-[75vh] overflow-y-auto pr-1 ${HIDE_SCROLLBAR_CLASS}`}>
              {!adminAccessGranted && (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3">
                  <div className="text-xs uppercase tracking-[0.12em] text-zinc-500">Защита</div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                    <div className="relative">
                      <Input
                        type={adminPanelKeyVisible ? "text" : "password"}
                        value={adminPanelKey}
                        onChange={(event) => setAdminPanelKey(event.target.value)}
                        placeholder="Ключ админ-панели"
                        className="h-10 rounded-xl border-zinc-700 bg-zinc-950 pr-10 text-zinc-100 placeholder:text-zinc-500"
                      />
                      <button
                        type="button"
                        onClick={() => setAdminPanelKeyVisible((prev) => !prev)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 transition hover:text-zinc-200"
                        aria-label={adminPanelKeyVisible ? "Скрыть ключ" : "Показать ключ"}
                      >
                        {adminPanelKeyVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-100"
                      onClick={() => void checkAdminAccess()}
                      disabled={adminAccessLoading}
                    >
                      {adminAccessLoading ? "Проверяем" : "Проверить"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-100"
                      onClick={() => setAdminPanelKey("")}
                    >
                      Очистить
                    </Button>
                  </div>
                  <div className="mt-2 rounded-xl border border-zinc-700 bg-zinc-950/80 px-3 py-2 text-xs text-zinc-400">
                    Доступ не подтвержден. Введите ключ и нажмите «Проверить».
                  </div>
                </div>
              )}
              {adminAccessGranted && (
                <>
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3">
                    <div className="text-xs uppercase tracking-[0.12em] text-zinc-500">Разделы</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {([
                        { key: "users", label: "Пользователи" },
                        { key: "staff", label: "Роли" },
                        { key: "promos", label: "Промокоды" },
                        { key: "subscriptions", label: "Подписки" },
                        { key: "bots", label: "Боты" },
                      ] as Array<{ key: AdminPanelSection; label: string }>).map((item) => {
                        const disabled =
                          (item.key === "promos" && !adminCanManagePromos) ||
                          (item.key === "subscriptions" && !adminCanManageSubscriptions) ||
                          (item.key === "staff" && !adminCanManageStaff && !adminCanModerateUsers) ||
                          (item.key === "users" && !adminCanModerateUsers) ||
                          (item.key === "bots" && !canManageAdminBots);
                        return (
                          <Button
                            key={`admin-section-${item.key}`}
                            type="button"
                            variant={adminPanelSection === item.key ? "default" : "outline"}
                            onClick={() => setAdminPanelSection(item.key)}
                            disabled={disabled}
                            className={
                              adminPanelSection === item.key
                                ? "h-9 rounded-xl bg-red-600 text-white hover:bg-red-500 disabled:bg-zinc-800 disabled:text-zinc-500"
                                : "h-9 rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-45"
                            }
                          >
                            {item.label}
                          </Button>
                        );
                      })}
                    </div>
                    <div className="mt-2 text-xs text-zinc-500">
                      Роль доступа:{" "}
                      {adminAccessRole === "owner"
                        ? "Владелец"
                        : adminAccessRole === "administrator"
                          ? "Администратор"
                          : adminAccessRole === "moderator"
                            ? "Модератор"
                            : "—"}
                    </div>
                  </div>
                  {adminPanelSection === "users" && (
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3">
                    <div className="text-xs uppercase tracking-[0.12em] text-zinc-500">
                      Поиск пользователя
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
                      <Input
                        value={adminUserLookupQuery}
                        onChange={(event) => setAdminUserLookupQuery(event.target.value)}
                        placeholder="login / email / nickname / userId"
                        className="h-10 rounded-xl border-zinc-700 bg-zinc-950 text-zinc-100 placeholder:text-zinc-500"
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void findAdminUser();
                          }
                        }}
                      />
                      <Button
                        type="button"
                        className="h-10 rounded-xl bg-zinc-100 text-zinc-950 hover:bg-zinc-200"
                        onClick={() => void findAdminUser()}
                        disabled={adminUserLookupLoading}
                      >
                        {adminUserLookupLoading ? "Ищем" : "Найти"}
                      </Button>
                    </div>
                    {adminUserLookupResult && (
                      <div className="mt-2 rounded-xl border border-zinc-700 bg-zinc-950/80 px-3 py-2 text-xs text-zinc-300">
                        <div>
                          {adminUserLookupResult.nickname} · {adminUserLookupResult.login}
                        </div>
                        <div className="text-zinc-500">{adminUserLookupResult.email}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-zinc-400">
                          <span>userId: {adminUserLookupResult.id}</span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard
                                .writeText(adminUserLookupResult.id)
                                .then(() =>
                                  setAdminPromoFeedback({
                                    kind: "success",
                                    text: "userId скопирован.",
                                  }),
                                )
                                .catch(() =>
                                  setAdminPromoFeedback({
                                    kind: "error",
                                    text: "Не удалось скопировать userId.",
                                  }),
                                );
                            }}
                            className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[11px] text-zinc-200 transition hover:bg-zinc-800"
                          >
                            Копировать
                          </button>
                        </div>
                        <div className="mt-1 text-zinc-400">
                          Подписка:{" "}
                          {getSubscriptionTierLabel(
                            normalizeSubscriptionTier(adminUserLookupResult.subscription?.tier),
                          )}{" "}
                          ·{" "}
                          {getSubscriptionDurationLabel(
                            adminUserLookupResult.subscription?.duration ?? "1_month",
                          )}
                        </div>
                        <div className="mt-1 text-zinc-400">
                          Блокировка:{" "}
                          {adminUserLookupResult.ban?.isBanned
                            ? adminUserLookupResult.ban.isPermanent
                              ? "Навсегда"
                              : adminUserLookupResult.ban.bannedUntil
                                ? `до ${new Date(adminUserLookupResult.ban.bannedUntil).toLocaleString("ru-RU")}`
                                : "Активна"
                            : "Нет"}
                        </div>
                        <div className="mt-1 text-zinc-400">
                          Роль:{" "}
                          {adminUserLookupResult.adminRole === "administrator"
                            ? "Администратор"
                            : adminUserLookupResult.adminRole === "moderator"
                              ? "Модератор"
                              : "Нет"}
                        </div>
                      </div>
                    )}
                  </div>
                  )}
                  {adminPanelSection === "subscriptions" && adminCanManageSubscriptions && (
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3">
                    <div className="text-xs uppercase tracking-[0.12em] text-zinc-500">Выдать подписку</div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      <Input
                        value={adminSubscriptionUserId}
                        onChange={(event) => setAdminSubscriptionUserId(event.target.value)}
                        placeholder="userId"
                        className="h-10 rounded-xl border-zinc-700 bg-zinc-950 text-zinc-100 placeholder:text-zinc-500 lg:col-span-2"
                      />
                      <select
                        value={adminSubscriptionTier}
                        onChange={(event) =>
                          setAdminSubscriptionTier(normalizeSubscriptionTier(event.target.value))
                        }
                        className="h-10 appearance-none rounded-xl border border-zinc-700 bg-zinc-950 px-3 pr-8 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-red-500/40"
                      >
                        {(["trainee", "practitioner", "arbiter", "free"] as SubscriptionTier[]).map((tier) => (
                          <option key={`admin-sub-tier-${tier}`} value={tier} className="bg-zinc-950 text-zinc-100">
                            {getSubscriptionTierLabel(tier)}
                          </option>
                        ))}
                      </select>
                      <select
                        value={adminSubscriptionDuration}
                        onChange={(event) => setAdminSubscriptionDuration(event.target.value as SubscriptionDuration)}
                        className="h-10 appearance-none rounded-xl border border-zinc-700 bg-zinc-950 px-3 pr-8 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-red-500/40"
                      >
                        {(["1_day", "3_days", "7_days", "1_month", "1_year", "forever"] as SubscriptionDuration[]).map((duration) => (
                          <option key={`admin-sub-duration-${duration}`} value={duration} className="bg-zinc-950 text-zinc-100">
                            {getSubscriptionDurationLabel(duration)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Button
                      type="button"
                      onClick={() => void submitAdminSubscription()}
                      disabled={adminSubscriptionLoading}
                      className="mt-3 h-10 w-full rounded-xl bg-red-600 text-white hover:bg-red-500 disabled:bg-zinc-700 disabled:text-zinc-300"
                    >
                      {adminSubscriptionLoading ? "Выдаем" : "Выдать подписку"}
                    </Button>
                  </div>
                  )}
                  {adminPanelSection === "users" && adminCanBanUsers && (
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3">
                    <div className="text-xs uppercase tracking-[0.12em] text-zinc-500">Блокировка пользователя</div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      <Input
                        value={adminBanUserId}
                        onChange={(event) => setAdminBanUserId(event.target.value)}
                        placeholder="userId"
                        className="h-10 rounded-xl border-zinc-700 bg-zinc-950 text-zinc-100 placeholder:text-zinc-500 lg:col-span-2"
                      />
                      <Input
                        type="number"
                        min={1}
                        value={adminBanDays}
                        onChange={(event) => setAdminBanDays(event.target.value)}
                        placeholder="Дней"
                        disabled={adminBanForever}
                        className="h-10 rounded-xl border-zinc-700 bg-zinc-950 text-zinc-100 placeholder:text-zinc-500 disabled:cursor-not-allowed disabled:opacity-60"
                      />
                      <div className="flex items-center justify-between rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2">
                        <span className="text-xs text-zinc-400">Навсегда</span>
                        <Switch checked={adminBanForever} onCheckedChange={setAdminBanForever} />
                      </div>
                    </div>
                    <Input
                      value={adminBanReason}
                      onChange={(event) => setAdminBanReason(event.target.value)}
                      placeholder="Причина (опционально)"
                      className="mt-2 h-10 rounded-xl border-zinc-700 bg-zinc-950 text-zinc-100 placeholder:text-zinc-500"
                    />
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <Button
                        type="button"
                        onClick={() => void submitAdminBan()}
                        disabled={adminBanLoading}
                        className="h-10 rounded-xl bg-red-600 text-white hover:bg-red-500 disabled:bg-zinc-700 disabled:text-zinc-300"
                      >
                        {adminBanLoading ? "Сохраняем" : "Забанить"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void clearAdminBan()}
                        disabled={adminBanLoading}
                        className="h-10 rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-60"
                      >
                        Снять бан
                      </Button>
                    </div>
                  </div>
                  )}
                  {adminPanelSection === "promos" && adminCanManagePromos && (
                  <>
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3">
                    <div className="text-xs uppercase tracking-[0.12em] text-zinc-500">Создать промокод</div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
                      <Input
                        value={adminPromoCodeDraft}
                        onChange={(event) => setAdminPromoCodeDraft(event.target.value.toUpperCase())}
                        placeholder="Код промокода"
                        className="h-10 rounded-xl border-zinc-700 bg-zinc-950 text-zinc-100 placeholder:text-zinc-500"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={generateAdminPromoCode}
                        className="h-10 rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-100"
                      >
                        Сгенерировать
                      </Button>
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      <select
                        value={adminPromoKind}
                        onChange={(event) => setAdminPromoKind(event.target.value as AdminPromoKind)}
                        className="h-10 appearance-none rounded-xl border border-zinc-700 bg-zinc-950 px-3 pr-8 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-red-500/40"
                      >
                        {ADMIN_PROMO_KIND_OPTIONS.map((option) => (
                          <option key={`admin-promo-kind-${option.key}`} value={option.key} className="bg-zinc-950 text-zinc-100">
                            {option.label}
                          </option>
                        ))}
                      </select>
                      {adminPromoKind === "subscription" ? (
                        <select
                          value={adminPromoTier}
                          onChange={(event) =>
                            setAdminPromoTier(normalizeSubscriptionTier(event.target.value))
                          }
                          className="h-10 appearance-none rounded-xl border border-zinc-700 bg-zinc-950 px-3 pr-8 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-red-500/40"
                        >
                          {(["trainee", "practitioner", "arbiter", "free"] as SubscriptionTier[]).map((tier) => (
                            <option key={`admin-tier-${tier}`} value={tier} className="bg-zinc-950 text-zinc-100">
                              {getSubscriptionTierLabel(tier)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <select
                          value={adminPromoBadgeKey}
                          onChange={(event) => setAdminPromoBadgeKey(event.target.value)}
                          className="h-10 appearance-none rounded-xl border border-zinc-700 bg-zinc-950 px-3 pr-8 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-red-500/40"
                        >
                          {ADMIN_BADGE_PROMO_OPTIONS.map((badge) => (
                            <option key={`admin-badge-${badge.key}`} value={badge.key} className="bg-zinc-950 text-zinc-100">
                              {badge.label}
                            </option>
                          ))}
                        </select>
                      )}
                      <select
                        value={adminPromoDuration}
                        onChange={(event) => setAdminPromoDuration(event.target.value as SubscriptionDuration)}
                        disabled={adminPromoKind !== "subscription"}
                        className="h-10 appearance-none rounded-xl border border-zinc-700 bg-zinc-950 px-3 pr-8 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-red-500/40 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {(["1_day", "3_days", "7_days", "1_month", "1_year", "forever"] as SubscriptionDuration[]).map((duration) => (
                          <option key={`admin-duration-${duration}`} value={duration} className="bg-zinc-950 text-zinc-100">
                            {getSubscriptionDurationLabel(duration)}
                          </option>
                        ))}
                      </select>
                      <Input
                        value={adminPromoMaxUses}
                        onChange={(event) => setAdminPromoMaxUses(event.target.value)}
                        placeholder="Лимит использований"
                        className="h-10 rounded-xl border-zinc-700 bg-zinc-950 text-zinc-100 placeholder:text-zinc-500"
                      />
                    </div>
                    <div className="mt-2 rounded-xl border border-zinc-700 bg-zinc-950 p-2.5">
                      <div className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">
                        Бейджи в промокоде
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {ADMIN_BADGE_PROMO_OPTIONS.map((badge) => {
                          const active = adminPromoBadgeKeys.includes(badge.key);
                          return (
                            <button
                              key={`badge-multi-${badge.key}`}
                              type="button"
                              onClick={() =>
                                setAdminPromoBadgeKeys((prev) =>
                                  prev.includes(badge.key)
                                    ? prev.filter((value) => value !== badge.key)
                                    : [...prev, badge.key],
                                )
                              }
                              className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs transition ${
                                active
                                  ? "border-red-400/60 bg-red-600/20 text-red-100"
                                  : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100"
                              }`}
                            >
                              {badge.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2">
                      <span className="text-xs text-zinc-400">Промокод активен</span>
                      <Switch checked={adminPromoIsActive} onCheckedChange={setAdminPromoIsActive} />
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-xs text-zinc-500">Старт</label>
                        <Input
                          type="datetime-local"
                          value={adminPromoStartsAt}
                          onChange={(event) => setAdminPromoStartsAt(event.target.value)}
                          className="h-10 rounded-xl border-zinc-700 bg-zinc-950 text-zinc-100"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-zinc-500">Срок годности</label>
                        <Input
                          type="datetime-local"
                          value={adminPromoExpiresAt}
                          onChange={(event) => setAdminPromoExpiresAt(event.target.value)}
                          className="h-10 rounded-xl border-zinc-700 bg-zinc-950 text-zinc-100"
                        />
                      </div>
                    </div>
                    <Button
                      type="button"
                      onClick={() => void submitAdminPromo()}
                      disabled={adminPromoLoading}
                      className="mt-3 h-10 w-full rounded-xl bg-red-600 text-white hover:bg-red-500 disabled:bg-zinc-700 disabled:text-zinc-300"
                    >
                      {adminPromoLoading ? "Сохраняем" : "Сохранить промокод"}
                    </Button>
                  </div>
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs uppercase tracking-[0.12em] text-zinc-500">Активные промокоды</div>
                      <div className="text-xs text-zinc-500">Всего: {adminPromos.length}</div>
                    </div>
                    <div className={`mt-2 space-y-2 max-h-60 overflow-y-auto pr-1 ${HIDE_SCROLLBAR_CLASS}`}>
                      {adminPromoListLoading ? (
                        <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-xs text-zinc-400">
                          Загружаем список...
                        </div>
                      ) : adminPromos.length === 0 ? (
                        <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-xs text-zinc-400">
                          Промокоды пока не созданы.
                        </div>
                      ) : (
                        adminPromos.map((promo) => (
                          <div
                            key={`admin-promo-${promo.code}`}
                            className="rounded-xl border border-zinc-800 bg-zinc-950/70 px-3 py-2"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="text-sm font-semibold text-zinc-100">{promo.code}</div>
                                <div className="mt-0.5 text-[11px] text-zinc-500">
                                  {promo.isActive ? "Активен" : "Отключен"} · использований: {promo.usedCount}
                                  {typeof promo.maxUses === "number" && promo.maxUses > 0
                                    ? ` / ${promo.maxUses}`
                                    : ""}
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => {
                                    navigator.clipboard
                                      .writeText(promo.code)
                                      .then(() =>
                                        setAdminPromoFeedback({
                                          kind: "success",
                                          text: `Код ${promo.code} скопирован.`,
                                        }),
                                      )
                                      .catch(() =>
                                        setAdminPromoFeedback({
                                          kind: "error",
                                          text: "Не удалось скопировать код.",
                                        }),
                                      );
                                  }}
                                  className="h-7 rounded-lg border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-200 hover:bg-zinc-800 hover:text-zinc-100"
                                >
                                  Копия
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  disabled={adminPromoActionCode === promo.code}
                                  onClick={() =>
                                    void updateAdminPromo(promo, { isActive: !promo.isActive })
                                  }
                                  className="h-7 rounded-lg border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-200 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-60"
                                >
                                  {promo.isActive ? "Откл" : "Вкл"}
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => void deleteAdminPromo(promo.code)}
                                  className="h-7 rounded-lg border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-200 hover:bg-zinc-800 hover:text-zinc-100"
                                >
                                  Удалить
                                </Button>
                              </div>
                            </div>
                            <div className="mt-1 text-xs text-zinc-400">
                              {promo.promoKind === "badge"
                                ? `Бейджи: ${
                                    (promo.badgeKeys?.length
                                      ? promo.badgeKeys
                                      : promo.badgeKey
                                        ? [promo.badgeKey]
                                        : ["—"]
                                    )
                                      .map((key) => getAdminBadgePromoLabel(key))
                                      .join(" • ")
                                  }`
                                : `${getSubscriptionTierLabel(promo.tier)} • ${getSubscriptionDurationLabel(promo.duration)}`}
                            </div>
                            <div className="mt-1 text-xs text-zinc-500">
                              Срок: {formatPromoDate(promo.startsAt)} — {formatPromoDate(promo.expiresAt)}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  </>
                  )}
                  {adminPanelSection === "staff" && adminCanModerateUsers && (
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3 space-y-3">
                      <div className="text-xs uppercase tracking-[0.12em] text-zinc-500">Модерация профиля</div>
                      <Input
                        value={adminStaffTargetUserId}
                        onChange={(event) => setAdminStaffTargetUserId(event.target.value)}
                        placeholder="userId"
                        className="h-10 rounded-xl border-zinc-700 bg-zinc-950 text-zinc-100 placeholder:text-zinc-500"
                      />
                      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                        <Input
                          value={adminModerationNickname}
                          onChange={(event) => setAdminModerationNickname(event.target.value)}
                          placeholder="Новый ник"
                          className="h-10 rounded-xl border-zinc-700 bg-zinc-950 text-zinc-100 placeholder:text-zinc-500"
                        />
                        <Button
                          type="button"
                          onClick={() => void submitAdminModeration()}
                          disabled={adminModerationLoading}
                          className="h-10 rounded-xl bg-red-600 text-white hover:bg-red-500 disabled:bg-zinc-700 disabled:text-zinc-300"
                        >
                          Сменить ник
                        </Button>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => void clearAdminUserMedia("avatar")}
                            disabled={adminModerationLoading}
                            className="h-10 rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-100"
                          >
                            Убрать аву
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => void clearAdminUserMedia("banner")}
                            disabled={adminModerationLoading}
                            className="h-10 rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-100"
                          >
                            Убрать баннер
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                  {adminPanelSection === "staff" && adminCanManageStaff && (
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3 space-y-3">
                      <div className="text-xs uppercase tracking-[0.12em] text-zinc-500">Роли сотрудников</div>
                      <Input
                        value={adminStaffTargetUserId}
                        onChange={(event) => setAdminStaffTargetUserId(event.target.value)}
                        placeholder="userId"
                        className="h-10 rounded-xl border-zinc-700 bg-zinc-950 text-zinc-100 placeholder:text-zinc-500"
                      />
                      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                        <select
                          value={adminStaffTargetRole}
                          onChange={(event) =>
                            setAdminStaffTargetRole(
                              event.target.value === "administrator" ? "administrator" : "moderator",
                            )
                          }
                          className="h-10 appearance-none rounded-xl border border-zinc-700 bg-zinc-950 px-3 pr-8 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-red-500/40"
                        >
                          <option value="moderator">Модератор</option>
                          <option value="administrator">Администратор</option>
                        </select>
                        <Button
                          type="button"
                          onClick={() => void submitAdminStaffRole()}
                          disabled={adminStaffLoading}
                          className="h-10 rounded-xl bg-red-600 text-white hover:bg-red-500 disabled:bg-zinc-700 disabled:text-zinc-300"
                        >
                          Назначить
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => void removeAdminStaffRole()}
                          disabled={adminStaffLoading}
                          className="h-10 rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-100"
                        >
                          Снять роль
                        </Button>
                      </div>
                    </div>
                  )}
                  {adminPanelSection === "bots" && canManageAdminBots && adminTargetRoomCode && (
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3">
                      <div className="text-xs uppercase tracking-[0.12em] text-zinc-500">Боты</div>
                      <div className={`mt-2 space-y-1 max-h-28 overflow-y-auto pr-1 ${HIDE_SCROLLBAR_CLASS}`}>
                        {adminBotPlayers.length === 0 ? (
                          <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-xs text-zinc-400">
                            Ботов пока нет.
                          </div>
                        ) : (
                          adminBotPlayers.map((bot) => (
                            <button
                              key={`admin-bot-global-${bot.id}`}
                              type="button"
                              onClick={() => controlAdminPlayer(bot.id)}
                              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-left text-xs font-semibold text-zinc-100 transition hover:border-red-500/70 hover:bg-zinc-800"
                            >
                              Зайти за {bot.name}
                            </button>
                          ))
                        )}
                      </div>
                      {currentHostId && myId !== currentHostId && (
                        <button
                          type="button"
                          onClick={() => controlAdminPlayer(currentHostId)}
                          className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-red-500/70 hover:bg-zinc-800"
                        >
                          Вернуться к ведущему
                        </button>
                      )}
                      <div className="mt-2 flex items-center gap-2">
                        <Input
                          type="number"
                          min={1}
                          max={6}
                          value={adminBotCount}
                          onChange={(event) =>
                            setAdminBotCount(Math.max(1, Math.min(6, Number(event.target.value) || 1)))
                          }
                          className="h-9 w-20 rounded-lg border-zinc-700 bg-zinc-900 text-zinc-100"
                        />
                        <Button
                          type="button"
                          onClick={addAdminBots}
                          className="h-9 flex-1 rounded-lg bg-red-600 px-3 text-xs text-white hover:bg-red-500"
                        >
                          Добавить ботов
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            {adminPromoFeedback && (
              <div className="pointer-events-none fixed bottom-6 left-1/2 z-[460] w-[min(92vw,560px)] -translate-x-1/2">
                <div
                  className={`rounded-xl border px-4 py-3 text-sm shadow-[0_14px_34px_rgba(0,0,0,0.45)] ${
                    adminPromoFeedback.kind === "success"
                      ? "border-emerald-500/45 bg-zinc-950/96 text-emerald-200"
                      : "border-red-500/45 bg-zinc-950/96 text-red-200"
                  }`}
                >
                  {adminPromoFeedback.text}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </>
    );
  };

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
    const profileSubscription = resolveSubscriptionView(profileData?.subscription);
    const profileTier = normalizeSubscriptionTier(profileSubscription.tier);
    const profileSubscriptionPulse =
      profileSubscriptionHighlight > 0 && nowMs - profileSubscriptionHighlight < 2800;
    const hasRatingAccessNowForProfile = hasCapability(profileTier, "canUseRating");
    const hasRatingHistoryForProfile =
      hasRatingAccessNowForProfile ||
      profileSubscription.startAt !== null ||
      profileSubscription.endAt !== null ||
      profileSubscription.isLifetime;
    const lockedRatingForProfile = !hasRatingAccessNowForProfile && hasRatingHistoryForProfile;
    const ratingUnavailableForProfile = !hasRatingHistoryForProfile;
    const profileBannerLocked = !canUseProfileBanner;
    const currentRank = profileData?.rank;
    const currentRankVisualKey = rankKeyToBadgeVisualKey(currentRank?.key);
    const currentRankTheme = getBadgeTheme(currentRankVisualKey);
    const rankProgressPercent = currentRank && !ratingUnavailableForProfile
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
    const hasActiveBadges = activeBadges.length > 0;
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
      (selectedBadgeKey || "") !== (baseSelectedBadgeKey || "") ||
      (preferredRoleDraft || "") !== (authUser?.preferredRole || "");
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
        <AnimatePresence>
          {error && (
            <motion.div
              key="profile-global-error"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="pointer-events-none fixed left-1/2 top-4 z-[530] w-[min(90vw,420px)] -translate-x-1/2"
            >
              <div className="rounded-xl border border-red-500/45 bg-zinc-950/95 px-4 py-3 text-center text-sm text-red-200 shadow-[0_14px_34px_rgba(0,0,0,0.45)]">
                {error}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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
                  className="relative h-[176px] md:min-h-[122px] p-3.5 md:p-6 flex items-start md:items-end cursor-pointer group/banner"
                  style={getBannerStyle(profileBannerDraft, profileAvatarDraft, playerName || "Игрок")}
                  onClick={() => {
                    if (profileBannerLocked) {
                      openSubscriptionUpsell(
                        "canUseProfileBanner",
                        "Баннер профиля доступен с подписки «Практик».",
                      );
                      return;
                    }
                    bannerInputRef.current?.click();
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/45 to-black/15" />
                  <div className="absolute inset-0 opacity-0 group-hover/banner:opacity-100 transition-opacity bg-black/15" />
                  {profileBannerLocked && (
                    <div className="pointer-events-none absolute right-2 top-2 inline-flex h-7 items-center gap-1.5 rounded-full border border-zinc-500/80 bg-zinc-900/80 px-2.5 text-[11px] font-semibold text-zinc-100 md:right-3 md:top-3 md:h-8 md:px-3 md:text-xs">
                      <Lock className="h-3.5 w-3.5" />
                      <span>Баннер</span>
                    </div>
                  )}

                  <div className="relative z-10 w-full md:hidden">
                    <div className="pt-7 h-full flex flex-col justify-between">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="relative shrink-0 cursor-pointer group/avatar"
                          onClick={(e) => {
                            e.stopPropagation();
                            avatarInputRef.current?.click();
                          }}
                        >
                          <Avatar src={profileAvatarDraft} name={playerName || "?"} size={72} />
                          <div className="absolute inset-0 rounded-full bg-black/55 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity">
                            <Camera className="w-4 h-4 text-white" />
                          </div>
                        </div>
                        <div className="min-w-0 flex-1 pr-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <div className="max-w-full truncate text-[18px] font-bold leading-none">
                              {playerName || "Игрок"}
                            </div>
                            {selectedBadgeKey && (
                              <span
                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${
                                  getBadgeTheme(selectedBadgeKey).chip
                                }`}
                              >
                                <BadgeGlyph
                                  badgeKey={selectedBadgeKey}
                                  className={`h-3 w-3 ${getBadgeTheme(selectedBadgeKey).iconOnly ?? "text-zinc-300"}`}
                                />
                                {getBadgeTitleByKey(selectedBadgeKey, badges)}
                              </span>
                            )}
                          </div>
                          <div className="mt-1.5 flex flex-wrap gap-1 text-[9px]">
                            <span className="inline-flex h-5 items-center rounded-full border border-zinc-600 bg-black/35 px-1.5 whitespace-nowrap">
                              Возраст: {ageLabel}
                            </span>
                            <span className="inline-flex h-5 items-center rounded-full border border-zinc-600 bg-black/35 px-1.5 whitespace-nowrap">
                              Пол: {genderLabel}
                            </span>
                            <span className="inline-flex h-5 items-center rounded-full border border-zinc-600 bg-black/35 px-1.5 whitespace-nowrap">
                              С нами с: {registeredAtLabel}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="mt-2">
                        <Button
                          variant="outline"
                          className="h-8 w-full rounded-xl border-zinc-500/70 bg-black/30 text-sm text-zinc-100 hover:bg-black/50 hover:text-zinc-100"
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

                  <div className="relative z-10 hidden w-full md:flex md:items-center md:justify-between md:gap-4">
                    <div className="flex min-w-0 items-center gap-4 text-left">
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
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
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
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
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
                    <div className="flex items-center justify-end">
                      <Button
                        variant="outline"
                        className="h-10 min-w-[118px] rounded-xl border-zinc-500/70 bg-black/30 text-zinc-100 hover:bg-black/50 hover:text-zinc-100"
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
                      <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-2.5">
                        <div className="px-1">
                          <div className="text-sm text-zinc-100">Предпочитаемая роль</div>
                          <div className="text-xs text-zinc-500">Роль по умолчанию для лобби с выбором ролей.</div>
                        </div>
                        <div className="relative mt-2">
                          <button
                            type="button"
                            onClick={() => setPreferredRolePickerOpen((prev) => !prev)}
                            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-left text-zinc-100 transition-colors hover:bg-zinc-800"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex min-w-0 items-center gap-2">
                                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-zinc-700 bg-zinc-800/80">
                                  <Shield className="h-3.5 w-3.5 text-zinc-200" />
                                </span>
                                <span className="truncate text-sm font-semibold">
                                  {preferredRoleDraft
                                    ? ASSIGNABLE_ROLE_TITLES[preferredRoleDraft]
                                    : "Без предпочтения"}
                                </span>
                              </div>
                              <ChevronDown
                                className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform ${
                                  preferredRolePickerOpen ? "rotate-180" : ""
                                }`}
                              />
                            </div>
                          </button>
                          {preferredRolePickerOpen && (
                            <div className="absolute top-full z-[170] mt-2 w-full overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950 shadow-[0_18px_44px_rgba(0,0,0,0.55)]">
                              <div className="max-h-[280px] overflow-y-auto p-1.5 [scrollbar-width:thin] [scrollbar-color:rgba(113,113,122,0.9)_rgba(24,24,27,0.45)] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-zinc-900/55 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-700/85 [&::-webkit-scrollbar-thumb:hover]:bg-zinc-500">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPreferredRoleDraft("");
                                    setPreferredRolePickerOpen(false);
                                  }}
                                  className={`w-full rounded-md border px-2.5 py-2 text-left transition-colors ${
                                    preferredRoleDraft === ""
                                      ? "border-red-500 bg-red-600/20 text-red-200"
                                      : "border-zinc-800 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
                                  }`}
                                >
                                  <span className="text-sm font-semibold">Без предпочтения</span>
                                </button>
                                {(Object.keys(ASSIGNABLE_ROLE_TITLES) as AssignableRole[]).map((roleKey) => (
                                  <button
                                    key={`preferred-${roleKey}`}
                                    type="button"
                                    onClick={() => {
                                      setPreferredRoleDraft(roleKey);
                                      setPreferredRolePickerOpen(false);
                                    }}
                                    className={`mt-1 w-full rounded-md border px-2.5 py-2 text-left transition-colors ${
                                      preferredRoleDraft === roleKey
                                        ? "border-red-500 bg-red-600/20 text-red-200"
                                        : "border-zinc-800 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
                                    }`}
                                  >
                                    <span className="text-sm font-semibold">{ASSIGNABLE_ROLE_TITLES[roleKey]}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
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
                        onClick={() => {
                          setPasswordChangeCodeSent(false);
                          setPasswordChangeCode("");
                          setPasswordChangeNext("");
                          setPasswordChangeConfirm("");
                          setPasswordChangeNotice("");
                          setPasswordChangeNoticeKind("info");
                          setPasswordChangeCooldownUntil(0);
                          setShowPasswordChangeNext(false);
                          setShowPasswordChangeConfirm(false);
                          setPasswordDialogOpen(true);
                        }}
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
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 md:p-5 space-y-3 transition-all">
                    <div className="text-lg font-semibold">Подписка</div>
                    <div
                      className={`relative rounded-xl border px-3 py-3 ${
                        profileTier === "free"
                          ? "border-zinc-800 bg-zinc-900/55"
                          : "border-red-500/45 bg-[linear-gradient(140deg,rgba(52,16,20,0.55),rgba(18,11,12,0.72))]"
                      }`}
                    >
                      {profileSubscriptionPulse && (
                        <motion.div
                          aria-hidden
                          className="pointer-events-none absolute inset-0 rounded-xl border border-red-400/80"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: [0.15, 0.95, 0.25, 0.9, 0.2] }}
                          transition={{ duration: 2.2, ease: "easeInOut" }}
                        />
                      )}
                      <div className="text-sm text-zinc-500">Текущий статус</div>
                      <div className="mt-1 flex items-center justify-between gap-3">
                        <span className="text-xl font-semibold text-zinc-100">
                          {SUBSCRIPTION_LABELS[profileTier]}
                        </span>
                        {profileTier !== "free" && (
                          <span className="inline-flex items-center rounded-full border border-red-400/55 bg-red-600/20 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-red-100">
                            Активна
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-sm text-zinc-300">
                        {formatSubscriptionTimeLeftLabel(profileSubscription, nowMs)}
                      </div>
                      {profileTier !== "arbiter" && (
                        <Button
                          type="button"
                          className="mt-3 h-9 w-full rounded-xl bg-red-600 text-white hover:bg-red-500"
                          onClick={navigateToShop}
                        >
                          Обновить план
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 md:p-5 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-lg font-semibold">Ранг</div>
                      {lockedRatingForProfile && (
                        <span className="inline-flex items-center rounded-full border border-zinc-700 bg-zinc-900/80 px-2.5 py-1 text-[11px] font-medium text-zinc-300">
                          Пауза прокачки
                        </span>
                      )}
                    </div>
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/55 px-3 py-2">
                      {ratingUnavailableForProfile ? (
                        <div className="space-y-1.5">
                          <div className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-zinc-100">
                            <Lock className="h-3 w-3 text-zinc-300" />
                            Рейтинг заблокирован
                          </div>
                          <div className="pl-0.5 text-[15px] font-normal leading-[2.0] text-zinc-200 md:text-[15px]">
                            Рейтинг открывается с подпиской «Стажер».
                          </div>
                          <div className="rounded-lg border border-zinc-800 bg-zinc-950/85 px-2.5 py-1 text-[13px] font-normal leading-[2.0] text-zinc-400">
                            До активации подписки рейтинговая прогрессия недоступна.
                          </div>
                        </div>
                      ) : (
                        <>
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
                            {lockedRatingForProfile
                              ? "Прогресс сохранен. Для продолжения прокачки активируйте подписку."
                              : currentRank?.nextTitle
                                ? `До ранга «${currentRank.nextTitle}»: ${Math.max(
                                    0,
                                    (currentRank.nextPoints ?? 0) - currentRank.points,
                                  )} очк.`
                                : "Максимальный ранг достигнут"}
                          </div>
                        </>
                      )}
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
                          onClick={() => {
                            if (!hasActiveBadges) return;
                            setBadgePickerOpen((prev) => !prev);
                          }}
                          className={`w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-left text-zinc-100 transition-colors ${
                            hasActiveBadges ? "hover:bg-zinc-800" : "cursor-default"
                          }`}
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
                            {hasActiveBadges ? (
                              <ChevronDown
                                className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform ${
                                  badgePickerOpen ? "rotate-180" : ""
                                }`}
                              />
                            ) : null}
                          </div>
                        </button>
                        {hasActiveBadges && badgePickerOpen && (
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
          <DialogContent className="max-w-3xl max-h-[82vh] overflow-hidden border-zinc-800 bg-zinc-950 text-zinc-100">
            {viewPlayerProfileOpen && (
              <div className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] bg-black/45" />
            )}
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
                      className={`rounded-xl border px-3 py-3 min-h-[124px] flex flex-col ${getBadgeTheme(badge.key).chip}`}
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
                      className={`rounded-xl border px-3 py-3 min-h-[124px] flex flex-col ${getBadgeTheme(badge.key).chip}`}
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
                  Подписки
                </div>
                {badges
                  .filter((badge) => getBadgeCategory(badge) === "subscription")
                  .map((badge) => (
                    <div
                      key={`rules-${badge.key}`}
                      className={`rounded-xl border px-3 py-3 min-h-[124px] flex flex-col ${getBadgeTheme(badge.key).chip}`}
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
                      className={`rounded-xl border px-3 py-3 min-h-[124px] flex flex-col ${getBadgeTheme(badge.key).chip}`}
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
        <Dialog
          open={passwordDialogOpen}
          onOpenChange={(open) => {
            setPasswordDialogOpen(open);
            if (!open) {
              setPasswordChangeCodeSent(false);
              setPasswordChangeCode("");
              setPasswordChangeNext("");
              setPasswordChangeConfirm("");
              setPasswordChangeNotice("");
              setPasswordChangeNoticeKind("info");
              setPasswordChangeCooldownUntil(0);
              setShowPasswordChangeNext(false);
              setShowPasswordChangeConfirm(false);
            }
          }}
        >
          <DialogContent className="max-w-md border-zinc-800 bg-zinc-950 text-zinc-100">
            <DialogHeader>
              <DialogTitle>Сменить пароль</DialogTitle>
              <DialogDescription className="text-zinc-400">
                Введите новый пароль. Мы отправим код подтверждения на вашу почту.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              {!passwordChangeCodeSent ? (
                <>
                  <div className="relative">
                    <Input
                      type={showPasswordChangeNext ? "text" : "password"}
                      value={passwordChangeNext}
                      onChange={(e) => setPasswordChangeNext(e.target.value)}
                      placeholder="Новый пароль"
                      className="h-11 rounded-xl border border-zinc-700 bg-zinc-900 pr-11 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-red-500/40"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswordChangeNext((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
                    >
                      {showPasswordChangeNext ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      type={showPasswordChangeConfirm ? "text" : "password"}
                      value={passwordChangeConfirm}
                      onChange={(e) => setPasswordChangeConfirm(e.target.value)}
                      placeholder="Повторите новый пароль"
                      className="h-11 rounded-xl border border-zinc-700 bg-zinc-900 pr-11 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-red-500/40"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswordChangeConfirm((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
                    >
                      {showPasswordChangeConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <Input
                    value={passwordChangeCode}
                    onChange={(e) => setPasswordChangeCode(e.target.value)}
                    placeholder="Код из письма"
                    className="h-11 rounded-xl border border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-red-500/40"
                  />
                </>
              )}
              <Button
                onClick={async () => {
                  await changePassword();
                }}
                disabled={
                  profileActionLoading ||
                  !passwordChangeNext ||
                  !passwordChangeConfirm ||
                  passwordChangeNext !== passwordChangeConfirm ||
                  (passwordChangeCodeSent && !passwordChangeCode.trim())
                }
                className="w-full h-11 rounded-xl bg-red-600 text-white hover:bg-red-500 border-0"
              >
                {passwordChangeCodeSent ? "Сменить пароль" : "Отправить код"}
              </Button>
              {passwordChangeCodeSent && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={requestPasswordChangeCode}
                  disabled={profileActionLoading || passwordChangeCooldownLeft > 0}
                  className="w-full h-10 rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-100"
                >
                  {passwordChangeCooldownLeft > 0
                    ? `Новый код через ${passwordChangeCooldownLeft} сек.`
                    : "Отправить код повторно"}
                </Button>
              )}
              {passwordChangeNotice && (
                <div
                  className={`rounded-xl border px-3 py-2 text-sm ${
                    passwordChangeNoticeKind === "error"
                      ? "border-red-500/40 bg-red-500/10 text-red-300"
                      : passwordChangeNoticeKind === "success"
                        ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-200"
                        : "border-zinc-700 bg-zinc-900/80 text-zinc-300"
                  }`}
                >
                  {passwordChangeNotice}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
        <Dialog
          open={emailDialogOpen}
          onOpenChange={(open) => {
            setEmailDialogOpen(open);
            if (!open) {
              setEmailChangeCodeSent(false);
              setEmailChangeCode("");
              setEmailChangeNotice("");
              setShowEmailChangeCurrentPassword(false);
            }
          }}
        >
          <DialogContent className="max-w-md border-zinc-800 bg-zinc-950 text-zinc-100">
            <DialogHeader>
              <DialogTitle>Сменить почту</DialogTitle>
              <DialogDescription className="text-zinc-400">
                Введите новую почту и текущий пароль. Код подтверждения придет на новую почту.
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
              <div className="relative">
                <Input
                  type={showEmailChangeCurrentPassword ? "text" : "password"}
                  value={emailChangeCurrentPassword}
                  onChange={(e) => setEmailChangeCurrentPassword(e.target.value)}
                  placeholder="Текущий пароль"
                  className="h-11 rounded-xl border border-zinc-700 bg-zinc-900 pr-11 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-red-500/40"
                />
                <button
                  type="button"
                  onClick={() => setShowEmailChangeCurrentPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
                >
                  {showEmailChangeCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {emailChangeCodeSent && (
                <>
                  <div className="rounded-xl border border-zinc-700/80 bg-zinc-900/80 px-3 py-2 text-xs text-zinc-300">
                    Если письма нет, проверьте папку «Спам».
                    <div className="mt-1 text-zinc-400">
                      {emailChangeCooldownLeft > 0
                        ? `Новый код можно запросить через ${emailChangeCooldownLeft} сек.`
                        : "Новый код уже можно запрашивать."}
                    </div>
                  </div>
                  <Input
                    value={emailChangeCode}
                    onChange={(e) => setEmailChangeCode(e.target.value)}
                    placeholder="Код из письма"
                    className="h-11 rounded-xl border border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-red-500/40"
                  />
                </>
              )}
              <Button
                onClick={async () => {
                  const ok = await changeEmail();
                  if (ok) setEmailDialogOpen(false);
                }}
                disabled={
                  profileActionLoading ||
                  !emailChangeCurrentPassword ||
                  !emailChangeNext.trim() ||
                  (emailChangeCodeSent && !emailChangeCode.trim())
                }
                className="w-full h-11 rounded-xl bg-red-600 text-white hover:bg-red-500 border-0"
              >
                {emailChangeCodeSent ? "Подтвердить код и сменить почту" : "Отправить код"}
              </Button>
              {emailChangeNotice && (
                <div
                  className={`rounded-xl border px-3 py-2 text-sm ${
                    emailChangeNoticeKind === "error"
                      ? "border-red-500/40 bg-red-500/10 text-red-300"
                      : emailChangeNoticeKind === "success"
                        ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-200"
                        : "border-zinc-700 bg-zinc-900/80 text-zinc-300"
                  }`}
                >
                  {emailChangeNotice}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
        <Dialog
          open={imageCropDialogOpen}
          onOpenChange={(open) => {
            setImageCropDialogOpen(open);
            if (!open) {
              setImageCropSource(null);
              setImageCropSourceIsGif(false);
              setImageCropLoading(false);
            }
          }}
        >
          <DialogContent
            className={`border-zinc-800 bg-zinc-950 text-zinc-100 ${
              imageCropTarget === "avatar" ? "max-w-[560px]" : "max-w-[1120px]"
            }`}
          >
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
                    <div className="mx-auto flex justify-center">
                      <div
                        className="relative overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-950 touch-none"
                        style={{
                          width: `${imageCropViewport.width}px`,
                          height: `${imageCropViewport.height}px`,
                          maxWidth: "100%",
                        }}
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
                          <div className="h-full w-full rounded-full border border-zinc-200/90 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]" />
                        </div>
                      </div>
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
                <div className={`grid gap-3 ${imageCropTarget === "avatar" ? "" : "md:grid-cols-2"}`}>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-zinc-400">Масштаб</label>
                      <span className="text-xs text-zinc-500">{Math.round(imageCropZoom * 100)}%</span>
                    </div>
                    <Input
                      type="range"
                      min={1}
                      max={3}
                      step={0.01}
                      value={imageCropZoom}
                      onChange={(e) => setImageCropZoom(Number(e.target.value))}
                      className="court-range h-2"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-zinc-400">Действия</label>
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 min-w-[170px] rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-100 gap-2"
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
        {renderAdminTools()}
        {renderUpsellModal()}
        {renderBanOverlay()}
        <ScreenTransitionLoader open={safeGlobalBlockingLoading} />
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
        className="relative isolate flex min-h-screen flex-col bg-[#0b0b0f] text-zinc-100 p-4 sm:p-6 md:p-10 overflow-x-hidden"
      >
        <CourtAtmosphereBackground />
        <AnimatePresence>
          {passwordUpdatedToast && (
            <motion.div
              key="password-updated"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="fixed left-1/2 top-4 z-[260] -translate-x-1/2 rounded-2xl border border-emerald-500/45 bg-emerald-500/18 px-5 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-emerald-200 shadow-[0_16px_50px_rgba(0,0,0,0.5)]"
            >
              ПАРОЛЬ ИЗМЕНЕН!
            </motion.div>
          )}
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
                    <span className="text-zinc-500">{">"}</span>
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
                    onClick={() => {
                      localStorage.removeItem(RANK_TOAST_PENDING_STORAGE_KEY);
                      setRankResultToast(null);
                    }}
                    className="border-zinc-700 text-zinc-100 hover:bg-zinc-800"
                  >
                    Закрыть
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="md:hidden fixed inset-x-0 top-0 z-[230] border-b border-zinc-800 bg-zinc-950/96 shadow-[0_10px_34px_rgba(0,0,0,0.55)]">
          <div className="mx-auto flex h-16 w-full max-w-none items-center justify-between px-4">
            <div className="inline-flex min-w-0 items-center gap-2.5">
              <img
                src="/favicon.png"
                alt="CourtGame"
                className="h-10 w-10 object-contain"
              />
              <div className="truncate text-[17px] font-semibold tracking-wide text-zinc-100">
                CourtGame
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setMobileMenuOpen(true)}
              className="h-11 w-11 p-0 rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-100"
              aria-label="Открыть меню"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="md:hidden h-14" />

        <div className="max-w-6xl mx-auto mb-2 md:mb-8 flex justify-center">
          <div className="relative w-full min-w-0">

            <AnimatePresence>
              {mobileMenuOpen && (
                <>
                  <motion.button
                    type="button"
                    aria-label="Закрыть меню"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setMobileMenuOpen(false)}
                    className="md:hidden fixed inset-0 z-[210] bg-black/80 backdrop-blur-[2px]"
                  />
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.22 }}
                    className="md:hidden fixed inset-0 z-[240] flex items-center justify-center px-4 py-4"
                  >
                    <div className="w-full max-h-[92vh] overflow-y-auto rounded-3xl border border-zinc-800 bg-zinc-950/98 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.72)]">
                    <div className="mb-6 flex items-center justify-between">
                      <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">Навигация</div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setMobileMenuOpen(false)}
                        className="h-10 w-10 rounded-xl border-zinc-700 bg-zinc-900/80 p-0 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-100"
                        aria-label="Закрыть меню"
                      >
                        <X className="h-5 w-5" />
                      </Button>
                    </div>
                    <div className="mb-5 text-sm text-zinc-400">
                      Быстрые переходы по разделам сайта и личному кабинету.
                    </div>
                    <div className="mb-8 flex justify-center">
                      {isAuthenticated ? (
                        <Button
                          variant="outline"
                          onClick={() => {
                            setMobileMenuOpen(false);
                            openProfileScreen();
                          }}
                          className="h-16 w-full max-w-[360px] rounded-2xl border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-100 px-3 gap-3 justify-start"
                        >
                          <Avatar src={avatar} name={playerName || "Игрок"} size={34} />
                          <span className="min-w-0 text-left">
                            <span className="block max-w-[220px] truncate text-base font-semibold">{playerName || "Игрок"}</span>
                            <span className="block text-xs text-zinc-400">Личный кабинет</span>
                          </span>
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          onClick={() => {
                            setMobileMenuOpen(false);
                            setAuthMode("login");
                            setAuthView("form");
                            setAuthDialogOpen(true);
                          }}
                          className="h-16 w-full max-w-[360px] rounded-2xl border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-100 px-4 gap-2 inline-flex items-center justify-center"
                        >
                          <LogIn className="w-4 h-4" />
                          Войти
                        </Button>
                      )}
                    </div>
                    <div className="grid gap-4">
                      <Button
                        variant={homeTab === "play" ? "default" : "outline"}
                        onClick={() => {
                          setHomeTab("play");
                          setProfileMenuOpen(false);
                          setMobileMenuOpen(false);
                        }}
                        className={homeTab === "play" ? "h-[52px] rounded-xl bg-red-600 text-white hover:bg-red-500 border-0" : "h-[52px] rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-100"}
                      >
                        <Gamepad2 className="w-4 h-4 mr-2" />
                        Играть
                      </Button>
                      <Button
                        variant={homeTab === "shop" ? "default" : "outline"}
                        onClick={() => {
                          setHomeTab("shop");
                          setProfileMenuOpen(false);
                          setMobileMenuOpen(false);
                        }}
                        className={homeTab === "shop" ? "h-[52px] rounded-xl bg-red-600 text-white hover:bg-red-500 border-0" : "h-[52px] rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-100"}
                      >
                        <Crown className="w-4 h-4 mr-2" />
                        Магазин
                      </Button>
                      <Button
                        variant={homeTab === "development" ? "default" : "outline"}
                        onClick={() => {
                          setHomeTab("development");
                          setProfileMenuOpen(false);
                          setMobileMenuOpen(false);
                        }}
                        className={homeTab === "development" ? "h-[52px] rounded-xl bg-red-600 text-white hover:bg-red-500 border-0" : "h-[52px] rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-100"}
                      >
                        <Wrench className="w-4 h-4 mr-2" />
                        Разработка
                      </Button>
                      <Button
                        variant={homeTab === "help" ? "default" : "outline"}
                        onClick={() => {
                          setHomeTab("help");
                          setMainHelpQuery("");
                          setProfileMenuOpen(false);
                          setMobileMenuOpen(false);
                        }}
                        className={homeTab === "help" ? "h-[52px] rounded-xl bg-red-600 text-white hover:bg-red-500 border-0" : "h-[52px] rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-100"}
                      >
                        <CircleHelp className="w-4 h-4 mr-2" />
                        Помощь
                      </Button>
                    </div>
                    <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                      <div className="text-xs uppercase tracking-[0.14em] text-zinc-500">Дополнительно</div>
                      <div className="mt-2 text-sm text-zinc-300">
                        Поиск игроков и общение доступны в нашем Discord.
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => window.open(DISCORD_INVITE_URL, "_blank", "noopener,noreferrer")}
                        className="mt-3 h-11 w-full rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-100"
                      >
                        <DiscordLogoIcon className="mr-2 h-4 w-4" />
                        Перейти в Discord
                      </Button>
                    </div>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            <div className="hidden md:block w-full sm:w-auto rounded-[28px] border border-zinc-800 bg-zinc-900/90 p-2 shadow-sm shadow-black/30 overflow-visible">
              <div className="sm:flex sm:items-center sm:gap-1">
                <div className={`grid grid-cols-2 gap-1 sm:flex sm:items-center sm:gap-1 overflow-visible sm:overflow-x-auto sm:pr-0.5 ${HIDE_SCROLLBAR_CLASS}`}>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setHomeTab("play");
                      setProfileMenuOpen(false);
                    }}
                    className={`h-11 w-full sm:w-auto shrink-0 rounded-full px-3 sm:px-4 gap-1.5 sm:gap-2 text-[13px] sm:text-sm transition-all duration-200 ${
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
                      setHomeTab("shop");
                      setProfileMenuOpen(false);
                    }}
                    className={`h-11 w-full sm:w-auto shrink-0 rounded-full px-3 sm:px-4 gap-1.5 sm:gap-2 text-[13px] sm:text-sm transition-all duration-200 ${
                      homeTab === "shop"
                        ? "bg-red-600 text-white hover:bg-red-500"
                        : "text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800"
                    }`}
                  >
                    <Crown className="w-4 h-4" />
                    Магазин
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setHomeTab("development");
                      setProfileMenuOpen(false);
                    }}
                    className={`h-11 w-full sm:w-auto shrink-0 rounded-full px-3 sm:px-4 gap-1.5 sm:gap-2 text-[13px] sm:text-sm transition-all duration-200 ${
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
                      setMainHelpQuery("");
                      setProfileMenuOpen(false);
                    }}
                    className={`h-11 w-full sm:w-auto shrink-0 rounded-full px-3 sm:px-4 gap-1.5 sm:gap-2 text-[13px] sm:text-sm transition-all duration-200 ${
                      homeTab === "help"
                        ? "bg-red-600 text-white hover:bg-red-500"
                        : "text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800"
                    }`}
                  >
                    <CircleHelp className="w-4 h-4" />
                    Помощь
                  </Button>
                </div>

                <div className="mt-2 border-t border-zinc-800/80 pt-2 sm:mt-0 sm:pt-0 sm:border-t-0 sm:ml-1 sm:pl-2 sm:border-l sm:border-zinc-700/80 flex justify-center sm:block">
                  {isAuthenticated ? (
                    <Button
                      variant="outline"
                      onClick={() => setProfileMenuOpen((prev) => !prev)}
                      className="h-11 w-auto min-w-[220px] sm:min-w-0 sm:w-auto rounded-full border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-100 pl-1 pr-3 gap-2.5 justify-start transition-all duration-200"
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
                      className="h-11 w-auto min-w-[220px] sm:min-w-0 sm:w-[124px] rounded-full border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-100 px-4 gap-2 inline-flex items-center justify-center transition-all duration-200"
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
            </div>

            <Dialog
              open={authDialogOpen && !openRecoveryAfterAuthClose}
              onOpenChange={(open) => {
                setAuthDialogOpen(open);
                if (!open) {
                  setAuthError("");
                  setAuthView("form");
                }
              }}
            >
              <DialogContent
                overlayClassName="bg-black/88 backdrop-blur-[1.5px] data-[state=open]:animate-none data-[state=closed]:animate-none data-[state=closed]:hidden"
                className="max-w-[400px] border-zinc-800 bg-[radial-gradient(130%_120%_at_0%_0%,rgba(239,68,68,0.2),transparent_54%),linear-gradient(155deg,rgba(15,15,20,0.98),rgba(8,8,12,0.98))] text-zinc-100 shadow-[0_34px_110px_rgba(0,0,0,0.76)] data-[state=open]:animate-none data-[state=closed]:animate-none data-[state=closed]:hidden"
              >
                {authView === "rules" ? (
                  <>
                    <DialogHeader>
                      <DialogTitle>Пользовательское соглашение</DialogTitle>
                      <DialogDescription className="text-zinc-400">
                        Ознакомьтесь с условиями перед регистрацией.
                      </DialogDescription>
                    </DialogHeader>
                    <div className={`space-y-2 max-h-[65vh] overflow-y-auto pr-1 ${HIDE_SCROLLBAR_CLASS}`}>
                      <p className="text-sm text-zinc-400">{LEGAL_DOCS.terms.intro}</p>
                      <div className="space-y-3">
                        {LEGAL_DOCS.terms.sections.map((section) => (
                          <div key={section.title} className="rounded-xl border border-zinc-800 bg-zinc-900/55 p-3">
                            <div className="text-sm font-semibold text-zinc-100">{section.title}</div>
                            <div className="mt-2 space-y-1.5 text-xs text-zinc-300">
                              {section.paragraphs.map((paragraph) => (
                                <p key={`${section.title}-${paragraph}`}>{paragraph}</p>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setAuthView("form")}
                      className="w-full h-11 rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-100"
                    >
                      Назад
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
                      <div className="pt-1 text-[11px] uppercase tracking-[0.14em] text-zinc-500">
                        CourtGame Account
                      </div>
                    </DialogHeader>

                    <div className="space-y-3">
                      <div className="rounded-2xl border border-zinc-700/80 bg-zinc-900/80 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                      <div className="grid grid-cols-2 gap-1.5">
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
                              ? "rounded-xl border border-red-500/55 bg-red-600 text-zinc-100 hover:bg-red-500"
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
                              ? "rounded-xl border border-red-500/55 bg-red-600 text-zinc-100 hover:bg-red-500"
                              : "rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-100"
                          }
                        >
                          Регистрация
                        </Button>
                      </div>
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
                            {authLoading ? "Входим" : "Войти"}
                          </Button>
                          <button
                            type="button"
                            onClick={() => {
                              const prefillEmail = loginOrEmail.trim().includes("@")
                                ? loginOrEmail.trim()
                                : "";
                              setRecoveryPrefillEmail(prefillEmail);
                              setOpenRecoveryAfterAuthClose(true);
                              setAuthDialogOpen(false);
                            }}
                            className="h-10 w-full rounded-xl border border-zinc-700 bg-zinc-900/70 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
                          >
                            Забыли пароль?
                          </button>
                          <div className="px-1 pt-1 text-xs text-zinc-500">Войти с помощью</div>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={startGoogleAuth}
                              disabled={authLoading}
                              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-zinc-600/55 bg-zinc-900 text-zinc-100 transition-colors hover:bg-zinc-800 hover:text-white disabled:opacity-60"
                              title="Войти через Google"
                            >
                              <GoogleLogoIcon className="h-5 w-5" />
                              <span className="text-sm font-medium">Google</span>
                            </button>
                            <button
                              type="button"
                              onClick={startDiscordAuth}
                              disabled={authLoading}
                              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#5865F2]/45 bg-[#20253a] text-zinc-100 transition-colors hover:bg-[#2a314b] hover:text-white disabled:opacity-60"
                              title="Войти через Discord"
                            >
                              <DiscordLogoIcon className="h-5 w-5 text-[#d4d7ff]" />
                              <span className="text-sm font-medium">Discord</span>
                            </button>
                          </div>
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
                              Я принимаю{" "}
                              <button
                                type="button"
                                className="text-red-300 underline underline-offset-2 hover:text-red-200"
                                onClick={() => setAuthView("rules")}
                              >
                                пользовательское соглашение
                              </button>
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
                            className="h-11 w-full rounded-xl bg-red-600 hover:bg-red-500 text-white border-0"
                          >
                            {authLoading ? "Создаем..." : "Зарегистрироваться"}
                          </Button>
                          <div className="px-1 pt-1 text-xs text-zinc-500">Зарегистрироваться с помощью</div>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={startGoogleAuth}
                              disabled={authLoading}
                              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-zinc-600/55 bg-zinc-900 text-zinc-100 transition-colors hover:bg-zinc-800 hover:text-white disabled:opacity-60"
                              title="Регистрация через Google"
                            >
                              <GoogleLogoIcon className="h-5 w-5" />
                              <span className="text-sm font-medium">Google</span>
                            </button>
                            <button
                              type="button"
                              onClick={startDiscordAuth}
                              disabled={authLoading}
                              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#5865F2]/45 bg-[#20253a] text-zinc-100 transition-colors hover:bg-[#2a314b] hover:text-white disabled:opacity-60"
                              title="Регистрация через Discord"
                            >
                              <DiscordLogoIcon className="h-5 w-5 text-[#d4d7ff]" />
                              <span className="text-sm font-medium">Discord</span>
                            </button>
                          </div>
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
            <Dialog
              open={passwordRecoveryDialogOpen}
              onOpenChange={(open) => {
                setPasswordRecoveryDialogOpen(open);
                if (!open) {
                  setPasswordRecoveryStep("email");
                  setPasswordRecoveryNotice("");
                  setPasswordRecoveryCode("");
                  setPasswordRecoveryEmail("");
                  setPasswordRecoveryEmailError("");
                  setPasswordRecoveryNextPassword("");
                  setPasswordRecoveryConfirmPassword("");
                  setPasswordRecoveryLoading(false);
                  setShowPasswordRecoveryNext(false);
                  setShowPasswordRecoveryConfirm(false);
                }
              }}
            >
              <DialogContent
                overlayClassName="bg-black/88 backdrop-blur-[1.5px] data-[state=open]:animate-none data-[state=closed]:animate-none"
                className="max-w-[400px] border-zinc-800 bg-[radial-gradient(130%_120%_at_0%_0%,rgba(239,68,68,0.2),transparent_54%),linear-gradient(155deg,rgba(15,15,20,0.98),rgba(8,8,12,0.98))] text-zinc-100 shadow-[0_34px_110px_rgba(0,0,0,0.76)] data-[state=open]:animate-none data-[state=closed]:animate-none [&>button]:h-7 [&>button]:w-7 [&>button]:sm:h-8 [&>button]:sm:w-8 [&>button_svg]:h-3 [&>button_svg]:w-3"
              >
                <DialogHeader>
                  <DialogTitle>Восстановление пароля</DialogTitle>
                  <DialogDescription className="text-zinc-400">Введите почту, код и новый пароль.</DialogDescription>
                  <div className="pt-1 text-[11px] uppercase tracking-[0.14em] text-zinc-500">
                    CourtGame Account
                  </div>
                </DialogHeader>
                <div className="space-y-3">
                  {passwordRecoveryStep === "email" && (
                    <>
                      <Input
                        type="email"
                        value={passwordRecoveryEmail}
                        onChange={(event) => {
                          setPasswordRecoveryEmail(event.target.value);
                          if (passwordRecoveryEmailError) setPasswordRecoveryEmailError("");
                        }}
                        placeholder="Почта"
                        className="h-11 rounded-xl border border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-red-500/40"
                      />
                      {passwordRecoveryEmailError && (
                        <div className="px-1 text-xs text-red-300">{passwordRecoveryEmailError}</div>
                      )}
                    </>
                  )}
                  {passwordRecoveryStep === "code" && (
                    <>
                      <Input
                        value={passwordRecoveryCode}
                        onChange={(event) => setPasswordRecoveryCode(event.target.value)}
                        placeholder="Код из письма"
                        className="h-11 rounded-xl border border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-red-500/40"
                      />
                    </>
                  )}
                  {passwordRecoveryStep === "password" && (
                    <>
                      <div className="relative">
                        <Input
                          type={showPasswordRecoveryNext ? "text" : "password"}
                          value={passwordRecoveryNextPassword}
                          onChange={(event) => setPasswordRecoveryNextPassword(event.target.value)}
                          placeholder="Новый пароль"
                          className="h-11 rounded-xl border border-zinc-700 bg-zinc-900 pr-11 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-red-500/40"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPasswordRecoveryNext((prev) => !prev)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
                        >
                          {showPasswordRecoveryNext ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <div className="relative">
                        <Input
                          type={showPasswordRecoveryConfirm ? "text" : "password"}
                          value={passwordRecoveryConfirmPassword}
                          onChange={(event) => setPasswordRecoveryConfirmPassword(event.target.value)}
                          placeholder="Повторите новый пароль"
                          className="h-11 rounded-xl border border-zinc-700 bg-zinc-900 pr-11 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-red-500/40"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPasswordRecoveryConfirm((prev) => !prev)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
                        >
                          {showPasswordRecoveryConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </>
                  )}
                  <Button
                    type="button"
                    onClick={async () => {
                      if (passwordRecoveryStep === "email") {
                        await requestPasswordRecoveryCode();
                        return;
                      }
                      if (passwordRecoveryStep === "code") {
                        await movePasswordRecoveryToPasswordStep();
                        return;
                      }
                      await confirmPasswordRecovery();
                    }}
                    disabled={
                      passwordRecoveryLoading ||
                      (passwordRecoveryStep === "email" &&
                        (!passwordRecoveryEmail.trim() || !passwordRecoveryEmail.includes("@"))) ||
                      (passwordRecoveryStep === "code" && !passwordRecoveryCode.trim()) ||
                      (passwordRecoveryStep === "password" &&
                        (!passwordRecoveryNextPassword ||
                          !passwordRecoveryConfirmPassword ||
                          passwordRecoveryNextPassword.length < 8 ||
                          passwordRecoveryNextPassword !== passwordRecoveryConfirmPassword))
                    }
                    className="w-full h-11 rounded-xl bg-red-600 hover:bg-red-500 text-white border-0"
                  >
                    {passwordRecoveryLoading
                      ? "Подождите..."
                      : passwordRecoveryStep === "email"
                        ? "Отправить код"
                        : passwordRecoveryStep === "code"
                          ? "Продолжить"
                          : "Сменить пароль"}
                  </Button>
                  {passwordRecoveryStep === "code" && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={requestPasswordRecoveryCode}
                      disabled={passwordRecoveryLoading || passwordRecoveryCooldownLeft > 0}
                      className="w-full h-10 rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-100"
                    >
                      {passwordRecoveryCooldownLeft > 0
                        ? `Новый код через ${passwordRecoveryCooldownLeft} сек.`
                        : "Отправить код повторно"}
                    </Button>
                  )}
                  {passwordRecoveryNotice && (
                    <div
                      className={`rounded-xl border px-3 py-2 text-sm ${
                        passwordRecoveryNoticeKind === "error"
                          ? "border-red-500/40 bg-red-500/10 text-red-300"
                          : passwordRecoveryNoticeKind === "success"
                            ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-200"
                            : "border-zinc-700 bg-zinc-900/80 text-zinc-300"
                      }`}
                    >
                      {passwordRecoveryNotice}
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
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
                                disabled={roomActionPending !== null}
                                className={`w-full h-16 rounded-2xl text-4xl gap-2 border-0 text-[33px] font-bold tracking-tight transition-all duration-200 ${
                                  roomActionPending !== null
                                    ? "bg-zinc-700 text-zinc-300 shadow-none"
                                    : "bg-red-600 text-white hover:bg-red-500 shadow-[0_8px_28px_rgba(220,38,38,0.35)] hover:-translate-y-0.5"
                                }`}
                              >
                                {roomActionPending === "create" ? "Создание" : "Создать игру"}
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
                                disabled={!joinCode.trim() || roomActionPending !== null}
                                className="h-12 min-w-[100px] rounded-xl bg-zinc-100 text-zinc-950 hover:bg-zinc-200 disabled:bg-zinc-700 disabled:text-zinc-300 border-0 text-lg transition-all duration-200 hover:-translate-y-0.5"
                              >
                                {roomActionPending === "join" ? "Входим" : "Войти"}
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
                                      "Переподключиться к игре"
                                    ) : (
                                      <span className="inline-flex items-center gap-2">
                                        <motion.span
                                          animate={{ opacity: [0.7, 1, 0.7] }}
                                          transition={{ duration: 1.15, repeat: Infinity, ease: "easeInOut" }}
                                          className="inline-flex"
                                        >
                                          <DoorOpen className="h-4 w-4" />
                                        </motion.span>
                                        <span>{`Переподключиться к игре (${reconnectSecondsLeft}s)`}</span>
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
                            disabled={roomActionPending !== null}
                            className={`w-full sm:w-auto h-14 rounded-xl border-0 gap-2 px-9 text-lg font-semibold transition-all duration-200 ${
                              roomActionPending !== null
                                ? "bg-zinc-700 text-zinc-300 shadow-none"
                                : "bg-red-600 text-white hover:bg-red-500 hover:-translate-y-0.5 shadow-[0_0_0_1px_rgba(239,68,68,0.5),0_10px_28px_rgba(220,38,38,0.35)] hover:shadow-[0_0_0_1px_rgba(248,113,113,0.7),0_16px_36px_rgba(220,38,38,0.45)]"
                            }`}
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
                          const promoted = !!match.isPromoted;
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
                              className={`rounded-2xl border px-4 py-4 md:px-5 ${
                                promoted
                                  ? "border-red-500/60 bg-[linear-gradient(130deg,rgba(39,39,42,0.95),rgba(63,15,20,0.78))] shadow-[0_0_0_1px_rgba(239,68,68,0.32),0_0_20px_rgba(239,68,68,0.22)]"
                                  : "border-zinc-800 bg-zinc-950/70"
                              }`}
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
                                    {promoted && (
                                      <Badge className="bg-red-600/20 text-red-100 border border-red-400/60 gap-1">
                                        <Crown className="w-3.5 h-3.5" />
                                        Продвигаемая
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-400">
                                    <span>Хост: {match.hostName}</span>
                                    <span>{statusLabel}</span>
                                    <span className="min-w-0 text-zinc-300 max-w-full break-words [text-wrap:balance]">
                                      <span className="text-zinc-500">Режим:</span> {modeMeta.title}
                                    </span>
                                    {match.currentStage && (
                                      <span className="min-w-0 text-zinc-300 max-w-full break-words [text-wrap:balance]">
                                        <span className="text-zinc-500">Этап:</span> {match.currentStage}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 w-full lg:w-auto">
                                  <Button
                                    disabled={roomActionPending !== null}
                                    className="h-11 w-full lg:w-auto lg:min-w-[128px] rounded-xl bg-zinc-100 text-zinc-950 hover:bg-zinc-200 disabled:bg-zinc-700 disabled:text-zinc-300 border-0 text-base font-semibold"
                                    onClick={() => joinPublicMatch(match)}
                                  >
                                    {roomActionPending === "join" ? "Входим" : "Войти"}
                                  </Button>
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
                if (open) {
                  setUpsellModalOpen(false);
                }
                if (!open) {
                  setCreateRoomPasswordVisible(false);
                  setCreatePackCatalogOpen(false);
                }
              }}
            >
              <DialogContent
                ref={createMatchDialogRef}
                overlayClassName="bg-black/88"
                className={`z-[180] !left-1/2 !top-1/2 !-translate-x-1/2 !-translate-y-1/2 rounded-2xl sm:rounded-3xl w-[calc(100vw-1.15rem)] sm:w-[calc(100vw-2rem)] ${createPackCatalogOpen ? "max-w-[770px]" : "max-w-[780px]"} max-h-[90vh] overflow-y-auto border-zinc-800 bg-zinc-950 text-zinc-100 p-4 sm:p-6 ${HIDE_SCROLLBAR_CLASS} [scrollbar-width:thin] [scrollbar-color:rgba(82,82,91,0.35)_transparent] [&::-webkit-scrollbar]:w-[4px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-600/45 [&::-webkit-scrollbar-thumb:hover]:bg-zinc-500/60`}
              >
                {upsellModalOpen && createMatchDialogOpen && (
                  <div className="pointer-events-none absolute inset-0 z-20 rounded-2xl bg-black/45" />
                )}
                <DialogHeader className="space-y-1">
                  <DialogTitle>Создать матч</DialogTitle>
                  <DialogDescription className="text-zinc-400">
                    {createPackCatalogOpen
                      ? "Выберите пак для комнаты."
                      : "Настройте комнату для раздела «Подбор игроков»."}
                  </DialogDescription>
                </DialogHeader>
                {createPackCatalogOpen ? (
                  <div className="mt-1 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setCreatePackCatalogOpen(false)}
                        className="h-9 rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-100"
                      >
                        Назад
                      </Button>
                      <button
                        type="button"
                        onClick={() =>
                          openSubscriptionUpsell(
                            "canCreatePacks",
                            "Создание паков доступно только в подписке «Арбитр».",
                          )
                        }
                        className="inline-flex h-11 min-w-[150px] items-center justify-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-900 px-5 text-base font-semibold text-zinc-300 transition-colors hover:border-zinc-600 hover:bg-zinc-800 hover:text-zinc-100"
                      >
                        <Lock className="h-4 w-4" />
                        Создать пак • Скоро
                      </button>
                    </div>
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      {[...casePacks]
                        .sort((a, b) => {
                          const aLocked = isPackLockedForTier(a, myTier);
                          const bLocked = isPackLockedForTier(b, myTier);
                          if (aLocked !== bLocked) return aLocked ? 1 : -1;
                          return getCasePackSortOrder(a) - getCasePackSortOrder(b);
                        })
                        .map((pack) => {
                        const isLocked = isPackLockedForTier(pack, myTier);
                        const requiredTier = getRequiredTierForPack(pack);
                        const visual = getCasePackVisual(pack.key, pack.title);
                        const displayTitle = getCasePackTitleDisplay(pack.title);
                        const cardClass = `${visual.card} ${createRoomPackKey === pack.key ? "ring-1 ring-red-500/60 shadow-[0_0_14px_rgba(239,68,68,0.16)]" : ""}`;
                        const content = (
                          <>
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-base font-semibold text-zinc-100 break-words">{displayTitle}</div>
                                <div className="mt-1 text-[12px] leading-5 text-zinc-300 break-words">
                                  {pack.description}
                                </div>
                                <div className="mt-1.5 text-[11px] uppercase tracking-[0.24em] text-zinc-500 break-words">
                                  {visual.vibe}
                                </div>
                              </div>
                              <div className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${visual.countChip}`}>
                                {pack.caseCount ?? 0} дел
                              </div>
                            </div>
                            {isLocked && (
                              <>
                                <div className="pointer-events-none absolute inset-0 rounded-2xl border border-zinc-600/65 bg-[linear-gradient(180deg,rgba(9,10,13,0.22),rgba(9,10,13,0.76))]" />
                                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-zinc-500/75 bg-zinc-950/92 text-zinc-200 shadow-[0_0_14px_rgba(0,0,0,0.45)]">
                                    <Lock className="h-5 w-5" />
                                  </span>
                                </div>
                              </>
                            )}
                          </>
                        );
                        if (isLocked) {
                          return (
                            <button
                              key={pack.key}
                              type="button"
                              onClick={() =>
                                openSubscriptionUpsell(
                                  requiredTier === "trainee"
                                    ? "canAccessPackSevere"
                                    : "canAccessAllPacks",
                                  `Пак «${displayTitle}» доступен с подписки «${getSubscriptionTierLabel(requiredTier)}».`,
                                )
                              }
                              className={`relative overflow-hidden rounded-2xl border px-4 py-3 text-left transition-colors hover:border-zinc-500 ${cardClass}`}
                            >
                              {content}
                            </button>
                          );
                        }
                        return (
                          <button
                            key={pack.key}
                            type="button"
                            onClick={() => {
                              setCreateRoomPackKey(pack.key);
                              setCreatePackCatalogOpen(false);
                            }}
                            className={`relative overflow-hidden rounded-2xl border px-4 py-3 text-left transition-all hover:brightness-105 ${cardClass}`}
                          >
                            {content}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                <div className="mt-1 space-y-3">
                  <div className="rounded-2xl border border-zinc-800 bg-gradient-to-r from-zinc-900 via-zinc-900/80 to-zinc-900 px-4 py-2.5">
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
                  <div className="grid gap-2.5 lg:grid-cols-2">
                    <div className="space-y-2 lg:col-span-2">
                      <label className="text-sm text-zinc-300">Название комнаты</label>
                      <Input
                        value={createRoomName}
                        onChange={(e) => setCreateRoomName(e.target.value)}
                        placeholder="Например: Вечерний суд #1"
                        className="h-11 rounded-xl bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
                      />
                    </div>
                    <div className="space-y-2 lg:col-span-2">
                      <label className="text-sm text-zinc-300">Ссылка на войс (опционально)</label>
                      <Input
                        value={createVoiceUrl}
                        onChange={(e) => setCreateVoiceUrl(e.target.value)}
                        placeholder="https://discord.gg/... или другая ссылка"
                        className="h-11 rounded-xl bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
                      />
                    </div>
                    <div className="space-y-2 lg:col-span-2">
                      <label className="text-sm text-zinc-300">Режим матча</label>
                      <div className="grid gap-2 lg:grid-cols-2">
                        {ROOM_MODE_OPTIONS.map((mode) => (
                          <button
                            key={mode.key}
                            type="button"
                            onClick={() => setCreateRoomMode(mode.key)}
                            className={`text-left rounded-xl border px-3 py-2.5 transition-colors ${
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
                    <div className="space-y-2 lg:col-span-2">
                      <label className="text-sm text-zinc-300">Пак дел</label>
                      <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-2.5">
                        {casePacks.length > 0 ? (
                          <div className="space-y-2">
                            <div className="rounded-xl border border-zinc-700 bg-zinc-950/80 px-3 py-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="text-sm font-semibold text-zinc-100">
                                  {getCasePackTitleDisplay(selectedCreatePack?.title) ?? "Пак не выбран"}
                                </div>
                                <div className="inline-flex items-center rounded-full border border-red-400/50 bg-red-500/20 px-2 py-0.5 text-[11px] font-semibold text-red-100">
                                  {availableCreateCaseCount} дел
                                </div>
                              </div>
                              <div className="mt-1 text-xs text-zinc-400">
                                {selectedCreatePack?.description ?? "Описание пака недоступно."}
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setCreatePackCatalogOpen(true)}
                              className="h-9 w-full rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-zinc-100"
                            >
                              Открыть каталог паков
                            </Button>
                          </div>
                        ) : (
                          <div className="rounded-xl border border-zinc-700 bg-zinc-950/80 px-3 py-3">
                            <div className="text-sm font-semibold text-zinc-100">
                              Паки дел не загружены
                            </div>
                            <div className="mt-1 text-xs text-zinc-400">
                              Проверьте подключение к серверу и загрузку данных из базы.
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    {!createRoomPrivate ? (
                      <div className="lg:col-span-2 rounded-xl border border-zinc-800 bg-zinc-900/70 p-2.5">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-medium text-zinc-100">
                              <span className="inline-flex items-center gap-1.5">
                                Приватная комната
                                {!canCreatePrivateRooms && <Lock className="h-3.5 w-3.5 text-zinc-400" />}
                              </span>
                            </div>
                            <div className="text-xs text-zinc-500">
                              В приватную комнату можно зайти только по коду и паролю.
                            </div>
                          </div>
                          <Switch
                            checked={createRoomPrivate}
                            onCheckedChange={(checked) => {
                              if (checked && !canCreatePrivateRooms) {
                                openSubscriptionUpsell(
                                  "canCreatePrivateRooms",
                                  "Приватные комнаты доступны только в подписке «Арбитр».",
                                );
                                return;
                              }
                              setCreateRoomPrivate(checked);
                            }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2 lg:col-span-2 rounded-xl border border-zinc-800 bg-zinc-900/70 p-2.5">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-medium text-zinc-100">
                              Пароль комнаты
                            </div>
                            <div className="text-xs text-zinc-500">
                              Для входа в комнату потребуется пароль.
                            </div>
                          </div>
                          <Switch
                            checked={createRoomPrivate}
                            onCheckedChange={(checked) => {
                              if (checked && !canCreatePrivateRooms) {
                                openSubscriptionUpsell(
                                  "canCreatePrivateRooms",
                                  "Приватные комнаты доступны только в подписке «Арбитр».",
                                );
                                return;
                              }
                              setCreateRoomPrivate(checked);
                              if (!checked) {
                                setCreateRoomPassword("");
                                setCreateRoomPasswordVisible(false);
                              }
                            }}
                          />
                        </div>
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
                      void createRoomFromPanel();
                    }}
                    disabled={roomActionPending !== null}
                    className={`w-full h-11 rounded-xl border-0 gap-2 ${
                      roomActionPending !== null
                        ? "bg-zinc-700 text-zinc-300"
                        : "bg-red-600 text-white hover:bg-red-500"
                    }`}
                  >
                    <UserPlus className="w-4 h-4" />
                    {roomActionPending === "create" ? "Создание" : "Создать комнату"}
                  </Button>
                </div>
                )}
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
                    disabled={roomActionPending !== null}
                    className="w-full h-11 rounded-xl bg-zinc-100 text-zinc-950 hover:bg-zinc-200 disabled:bg-zinc-700 disabled:text-zinc-300 border-0"
                  >
                    {roomActionPending === "join" ? "Входим" : "Войти"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
        {homeTab === "shop" && (
          <motion.div
            className="max-w-6xl mx-auto space-y-5"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
          >
            <Card className="rounded-[28px] border-zinc-800 bg-zinc-900/95 text-zinc-100 overflow-hidden">
              <CardContent className="p-6 md:p-8">
                <div className="relative rounded-3xl border border-zinc-700/80 bg-[radial-gradient(120%_120%_at_0%_0%,rgba(239,68,68,0.22),transparent_48%),radial-gradient(120%_120%_at_100%_100%,rgba(153,27,27,0.2),transparent_54%),linear-gradient(130deg,rgba(24,24,27,0.95),rgba(39,39,42,0.9))] px-5 py-6 md:px-7 md:py-8">
                  <div className="mx-auto max-w-4xl text-center">
                    <h2 className="text-2xl font-bold sm:text-3xl">Магазин</h2>
                    <p className="mt-2 text-sm text-zinc-300 sm:text-base">
                      Откройте доступ к эксклюзивным функциям, пакам дел, рейтингу и статусным
                      возможностям профиля.
                    </p>
                  </div>
                </div>
                <h3 className="mt-6 text-center text-2xl font-semibold">Обновите свой план</h3>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                  <div className="inline-flex rounded-2xl border border-zinc-700/80 bg-[linear-gradient(180deg,rgba(24,24,27,0.96),rgba(16,16,20,0.96))] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                    {SUBSCRIPTION_DURATION_UI_OPTIONS.map((option) => (
                      <button
                        key={`shop-duration-${option.key}`}
                        type="button"
                        onClick={() => {
                          if (shopDuration === option.key) return;
                          setShopDuration(option.key);
                        }}
                        className={`min-w-[88px] rounded-xl px-3 py-2 text-sm font-medium transition ${
                          shopDuration === option.key
                            ? "bg-[linear-gradient(135deg,rgba(239,68,68,1),rgba(220,38,38,1))] text-white shadow-[0_8px_16px_rgba(239,68,68,0.3)]"
                            : "text-zinc-300 hover:bg-zinc-800/85"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setPromoCodeResult(null);
                      setPromoRewardsResult(null);
                      setPromoRewardsDialogOpen(false);
                      setPromoDialogOpen(true);
                    }}
                    className="h-11 rounded-2xl border-zinc-700/80 bg-[linear-gradient(180deg,rgba(24,24,27,0.96),rgba(16,16,20,0.96))] px-5 text-zinc-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:bg-zinc-800/95 hover:text-zinc-100"
                  >
                    Промокод
                  </Button>
                </div>
                <div className="mt-5 grid gap-4 xl:grid-cols-3">
                  {SUBSCRIPTION_PLANS.map((plan, planIndex) => {
                    const isCurrent = myTier === plan.tier;
                    const displayPrice =
                      shopDuration === "1_year" ? plan.yearPriceRub : plan.monthPriceRub;
                    const yearlyBasePrice = plan.monthPriceRub * 12;
                    const yearlySave = Math.max(0, yearlyBasePrice - plan.yearPriceRub);
                    const planBadgeKey = getSubscriptionPlanBadgeKey(plan.tier);
                    const planBadgeTheme = getBadgeTheme(planBadgeKey);
                    return (
                      <motion.div
                        key={`shop-plan-${plan.tier}`}
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.26, delay: 0.06 + planIndex * 0.06, ease: "easeOut" }}
                        className={`relative flex min-h-[560px] flex-col rounded-3xl border p-6 ${
                          plan.isPopular
                            ? "border-red-400/70 bg-[radial-gradient(120%_100%_at_50%_0%,rgba(239,68,68,0.28),transparent_60%),linear-gradient(160deg,rgba(40,14,18,0.95),rgba(22,22,28,0.95))] shadow-[0_0_0_1px_rgba(248,113,113,0.35),0_0_26px_rgba(239,68,68,0.26)]"
                            : "border-zinc-700 bg-[linear-gradient(160deg,rgba(26,26,30,0.96),rgba(20,20,24,0.96))]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className={`inline-flex h-11 w-11 items-center justify-center rounded-full border border-zinc-600/70 bg-zinc-900/75 ${planBadgeTheme.icon}`}>
                            <BadgeGlyph
                              badgeKey={planBadgeKey}
                              className={`h-5 w-5 ${planBadgeTheme.iconOnly ?? "text-zinc-100"}`}
                            />
                          </div>
                          {plan.isPopular && (
                            <div className="inline-flex h-6 items-center rounded-full border border-red-300/55 bg-red-600/20 px-2 text-[9px] font-semibold uppercase tracking-[0.1em] text-red-100">
                              Рекомендуется
                            </div>
                          )}
                        </div>
                        <div className="mt-4 text-3xl font-bold text-zinc-100">{plan.title}</div>
                        <div className="mt-1 text-sm text-zinc-400">{plan.shortLabel}</div>
                        <AnimatePresence mode="wait" initial={false}>
                          <motion.div
                            key={`shop-price-${plan.tier}-${shopDuration}`}
                            initial={{ opacity: 0, y: 12, scale: 0.98, filter: "blur(2px)" }}
                            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                            exit={{ opacity: 0, y: -10, scale: 1.02, filter: "blur(2px)" }}
                            transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
                          >
                            <div className="mt-4 text-4xl font-bold leading-none text-zinc-100">
                              {displayPrice}
                            </div>
                            <div className="mt-1 text-sm text-zinc-400">
                              RUB / {shopDuration === "1_year" ? "год" : "месяц"}
                            </div>
                            <AnimatePresence initial={false}>
                              {shopDuration === "1_year" && yearlySave > 0 && shopPriceRevealReady && (
                                <motion.div
                                  initial={{ opacity: 0, y: 8, height: 0 }}
                                  animate={{ opacity: 1, y: 0, height: "auto" }}
                                  exit={{ opacity: 0, y: -4, height: 0 }}
                                  transition={{ duration: 0.26, ease: "easeOut", delay: 0.03 }}
                                  className="mt-2 flex items-center gap-2 text-xs overflow-hidden"
                                >
                                  <span className="text-zinc-500 line-through">{yearlyBasePrice} RUB</span>
                                  <span className="inline-flex items-center rounded-full border border-red-500/45 bg-red-600/15 px-2 py-0.5 text-red-100">
                                    2 месяца бесплатно
                                  </span>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        </AnimatePresence>
                        <div className="mt-4 h-px w-full bg-zinc-700/60" />
                        <div className="mt-4 space-y-2.5 text-sm text-zinc-200">
                          {plan.features.map((feature) => (
                            <div key={`${plan.tier}-${feature}`} className="flex items-start gap-2.5">
                              <span className="mt-0.5 inline-flex shrink-0 items-center justify-center text-zinc-300">
                                {React.createElement(getSubscriptionFeatureIcon(feature), {
                                  className: "h-4 w-4",
                                })}
                              </span>
                              <span>{normalizeSubscriptionFeatureText(feature)}</span>
                            </div>
                          ))}
                        </div>
                        <Button
                          type="button"
                          onClick={() => {
                            if (isCurrent) {
                              setScreen("profile");
                              setHomeTab("play");
                              setProfileSubscriptionHighlightPending(true);
                              return;
                            }
                            openShopPaymentDialog(plan.tier as ShopPaidTier);
                          }}
                          className={`mt-auto h-12 w-full rounded-xl font-semibold ${
                            isCurrent
                              ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-800"
                              : "border-0 bg-[linear-gradient(135deg,rgba(239,68,68,1),rgba(220,38,38,1))] text-white shadow-[0_10px_20px_rgba(239,68,68,0.28)] hover:brightness-110"
                          }`}
                        >
                          {isCurrent ? "Ваш текущий план" : "Выбрать"}
                        </Button>
                      </motion.div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
            <Dialog open={shopPaymentDialogOpen} onOpenChange={handleShopPaymentDialogChange}>
              <DialogContent className="w-[calc(100vw-1rem)] sm:w-[calc(100vw-2rem)] max-w-[1180px] h-[min(88vh,740px)] overflow-hidden border-zinc-800/90 bg-[radial-gradient(130%_120%_at_0%_0%,rgba(127,29,29,0.28),transparent_52%),linear-gradient(165deg,rgba(10,10,14,0.98),rgba(8,8,11,0.98))] p-0 text-zinc-100 [&>button]:right-3 [&>button]:top-3 [&>button]:z-50 [&>button]:h-6 [&>button]:w-6 sm:[&>button]:right-4 sm:[&>button]:top-4 sm:[&>button]:h-7 sm:[&>button]:w-7 [&>button_svg]:h-3 [&>button_svg]:w-3">
                <DialogHeader className="sr-only">
                  <DialogTitle>Оплата подписки</DialogTitle>
                  <DialogDescription>Выберите способ оплаты.</DialogDescription>
                </DialogHeader>
                <div className="relative flex h-full min-h-0 flex-col p-3 sm:p-5">
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(72%_66%_at_0%_0%,rgba(220,38,38,0.2),transparent_62%)]" />
                  <div className="relative min-h-0 flex-1 overflow-y-auto pr-1 [scrollbar-width:thin] [scrollbar-color:rgba(82,82,91,0.65)_transparent] [&::-webkit-scrollbar]:w-[8px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-600/70 [&::-webkit-scrollbar-thumb:hover]:bg-zinc-500/90">
                    <div className="space-y-3 pb-1 sm:space-y-4">
                      <div className="rounded-[24px] border border-zinc-800/80 bg-[linear-gradient(150deg,rgba(13,13,18,0.96),rgba(8,8,11,0.98))] p-2.5 sm:p-3">
                        <div className="grid gap-2.5 lg:grid-cols-[minmax(250px,300px)_minmax(0,1fr)_minmax(290px,360px)]">
                          <div className="rounded-2xl bg-zinc-950/45 px-4 py-3.5 text-center">
                          <div className="flex justify-center">
                            <Avatar
                              src={authUser?.avatar ?? sharedAvatar}
                              name={(authUser?.nickname ?? playerName) || "Игрок"}
                              size={74}
                            />
                          </div>
                          <div className="mt-2.5 truncate text-2xl font-semibold text-zinc-100">
                            {((authUser?.nickname ?? playerName) || "Игрок").trim() || "Игрок"}
                          </div>
                          <div className="mt-1 text-sm text-zinc-400">Покупка подписки</div>
                          </div>

                          <div className="rounded-2xl bg-zinc-950/45 px-4 py-3.5">
                          <div className="w-full space-y-1.5 text-base leading-6 text-zinc-200">
                            <div className="grid grid-cols-[minmax(130px,1fr)_auto] items-center gap-3 py-1">
                              <span className="text-zinc-400">Тип товара</span>
                              <span className="text-[17px] font-semibold text-zinc-100">Подписка</span>
                            </div>
                            <div className="grid grid-cols-[minmax(130px,1fr)_auto] items-center gap-3 py-1">
                              <span className="text-zinc-400">Тариф</span>
                              <span className="text-[17px] font-semibold text-zinc-100">
                                {shopPaymentPlan ? getSubscriptionTierLabel(shopPaymentPlan.tier) : "—"}
                              </span>
                            </div>
                            <div className="grid grid-cols-[minmax(130px,1fr)_auto] items-center gap-3 py-1">
                              <span className="text-zinc-400">Период</span>
                              <span className="text-[17px] font-semibold text-zinc-100">{shopDuration === "1_year" ? "1 год" : "1 месяц"}</span>
                            </div>
                            <div className="grid grid-cols-[minmax(130px,1fr)_auto] items-center gap-3 py-1">
                              <span className="text-zinc-400">Автопродление</span>
                              <span className="text-[17px] font-semibold text-zinc-100">Нет</span>
                            </div>
                          </div>
                        </div>

                          <div className="flex items-center justify-center rounded-2xl border border-red-500/45 bg-[radial-gradient(130%_130%_at_0%_0%,rgba(248,113,113,0.35),rgba(239,68,68,0.12)_45%,rgba(127,29,29,0.9)_100%)] px-3 py-2 text-center text-red-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] sm:px-5 sm:py-4.5">
                          <div>
                            <div className="text-xs uppercase tracking-[0.14em] text-red-100/95 sm:text-base sm:tracking-[0.16em]">К оплате</div>
                            <div className="mt-1 flex items-center justify-center gap-2 sm:mt-1.5 sm:block">
                              <div className="text-[2.4rem] font-semibold leading-none sm:text-7xl">{shopPaymentAmountRub}</div>
                              <div className="translate-y-1 text-lg font-semibold leading-none text-red-100/95 sm:mt-1.5 sm:translate-y-0 sm:text-3xl">RUB</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                      <section className="rounded-[24px] border border-zinc-800/80 bg-[linear-gradient(180deg,rgba(14,14,20,0.95),rgba(8,8,11,0.98))] p-3 sm:p-4">
                          <div className="space-y-4 pb-1">
                            <header className="rounded-2xl bg-zinc-950/55 px-4 py-2.5 sm:py-3">
                              <h2 className="text-center text-2xl font-black uppercase tracking-[0.02em] text-zinc-100 sm:text-3xl">
                                Выберите способ оплаты
                              </h2>
                            </header>
                            {SHOP_PAYMENT_SECTIONS.map((section) => {
                              const methods = shopPaymentMethodsByCategory[section.key];
                              return (
                                <div
                                  key={`shop-payment-section-${section.key}`}
                                  className="overflow-hidden rounded-2xl bg-zinc-950/45"
                                >
                                  <div className="px-4 py-3 sm:px-5">
                                    <h3 className="text-3xl font-black leading-none text-zinc-100 sm:text-4xl">{section.title}</h3>
                                    <div className="mt-2 text-sm leading-6 text-zinc-400">{section.description}</div>
                                  </div>

                                  <div className="p-3 sm:p-4">
                                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                      {methods.map((method) => (
                                        <button
                                          key={`shop-payment-method-${method.category}-${method.id}-${method.title}`}
                                          type="button"
                                          disabled={shopPaymentLoading}
                                          onClick={() => void createShopPayment(method)}
                                          className="group relative overflow-hidden rounded-2xl bg-zinc-900/85 p-3 transition duration-200 hover:-translate-y-[1px] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_90%_at_0%_0%,rgba(220,38,38,0.12),transparent_70%)]" />
                                          <div className="relative flex h-full min-h-[96px] flex-col items-center justify-center rounded-xl bg-zinc-950/50 p-2.5 sm:min-h-[124px] sm:p-3">
                                            <div className="flex flex-1 items-center justify-center">
                                              <img
                                                src={method.logoUrl}
                                                alt={method.title}
                                                className={`h-auto w-auto object-contain ${
                                                  method.title === "СБП"
                                                    ? "max-h-[64px] max-w-[92%] sm:max-h-[88px] sm:max-w-[98%]"
                                                    : method.title === "Ethereum"
                                                      ? "max-h-[70px] max-w-[92%] sm:max-h-[96px] sm:max-w-[99%]"
                                                    : method.category === "crypto"
                                                      ? "max-h-[62px] max-w-[90%] sm:max-h-[88px] sm:max-w-[98%]"
                                                    : "max-h-[52px] max-w-[84%] sm:max-h-[66px] sm:max-w-[90%]"
                                                }`}
                                                loading="lazy"
                                              />
                                            </div>
                                            <div className="mt-1 text-center text-[12px] font-medium text-zinc-200 sm:text-sm">
                                              {method.title}
                                            </div>
                                          </div>
                                          <span className="sr-only">{method.title}</span>
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}

                            {shopPaymentError && (
                              <div className="rounded-xl border border-red-500/45 bg-red-900/25 px-3 py-2 text-sm text-red-200">
                                {shopPaymentError}
                              </div>
                            )}
                            {shopPaymentLoading && (
                              <div className="text-xs text-zinc-400">Создаем платеж, подождите…</div>
                            )}
                          </div>
                      </section>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={promoDialogOpen} onOpenChange={setPromoDialogOpen}>
              <DialogContent className="max-w-[460px] border-zinc-800 bg-[radial-gradient(120%_100%_at_0%_0%,rgba(239,68,68,0.2),transparent_55%),linear-gradient(145deg,rgba(13,13,17,0.98),rgba(10,10,12,0.98))] text-zinc-100 p-8 sm:p-9">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-2xl">
                    <Sparkles className="h-5 w-5 text-red-300" />
                    Активация промокода
                  </DialogTitle>
                  <DialogDescription className="text-base text-zinc-400">
                    Введите код, чтобы активировать подписку или бонусный период.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <Input
                    value={promoCodeInput}
                    onChange={(event) => setPromoCodeInput(event.target.value.toUpperCase())}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void applyPromoCode();
                      }
                    }}
                    placeholder="Введите промокод"
                    className="h-14 rounded-xl border-zinc-700 bg-zinc-950/90 text-lg text-zinc-100 placeholder:text-zinc-500"
                  />
                  <Button
                    type="button"
                    onClick={() => {
                      void applyPromoCode();
                    }}
                    disabled={promoCodeLoading}
                    className="h-14 w-full rounded-xl bg-[linear-gradient(135deg,rgba(239,68,68,1),rgba(220,38,38,1))] text-lg font-semibold text-white shadow-[0_10px_20px_rgba(239,68,68,0.28)] hover:brightness-110 disabled:bg-zinc-700 disabled:text-zinc-300"
                  >
                    {promoCodeLoading ? "Проверяем" : "Активировать"}
                  </Button>
                  {promoCodeResult?.kind === "error" && (
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.div
                        key={`promo-result-${promoCodeResult.text}`}
                        initial={{ opacity: 0, y: 10, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.98 }}
                        transition={{ duration: 0.22, ease: "easeOut" }}
                        className="rounded-xl border border-red-500/45 bg-[linear-gradient(145deg,rgba(30,9,12,0.95),rgba(43,11,15,0.92))] px-4 py-3 text-red-200"
                      >
                        <div className="text-sm font-semibold">{promoCodeResult.text}</div>
                      </motion.div>
                    </AnimatePresence>
                  )}
                  {!authToken && (
                    <div className="text-xs text-zinc-500">
                      Для активации промокода нужно войти в аккаунт.
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
            <Dialog
              open={promoRewardsDialogOpen}
              onOpenChange={(open) => {
                setPromoRewardsDialogOpen(open);
                if (!open) {
                  setPromoRewardsResult(null);
                  setPromoDialogOpen(false);
                }
              }}
            >
              <DialogContent
                overlayClassName="!bg-transparent"
                className="max-w-[520px] border-zinc-800 bg-[radial-gradient(130%_120%_at_0%_0%,rgba(239,68,68,0.26),transparent_56%),linear-gradient(145deg,rgba(13,13,17,0.99),rgba(8,8,11,0.99))] text-zinc-100 p-8 sm:p-9"
              >
                <div className="space-y-5">
                  <motion.div
                    initial={{ opacity: 0, y: -12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    className="text-center"
                  >
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-red-400/55 bg-red-600/20 text-red-100 shadow-[0_0_20px_rgba(239,68,68,0.28)]">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div className="mt-3 text-3xl font-bold tracking-tight text-zinc-100">
                      Промокод активирован
                    </div>
                  </motion.div>
                  <div className="rounded-2xl border border-zinc-700/80 bg-zinc-950/75 p-4">
                    <div className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                      Получено
                    </div>
                    <div className="mt-3 space-y-2">
                      {(promoRewardsResult?.rewards?.length
                        ? promoRewardsResult.rewards
                        : [{ type: "subscription" as const, label: "Награда применена" }]
                      ).map((reward, idx) => (
                        <motion.div
                          key={`promo-reward-modal-${reward.type}-${reward.label}-${idx}`}
                          initial={{ opacity: 0, x: -18, scale: 0.98 }}
                          animate={{ opacity: 1, x: 0, scale: 1 }}
                          transition={{ duration: 0.3, delay: 0.18 + idx * 0.22, ease: "easeOut" }}
                          className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 text-sm ${
                            reward.type === "subscription"
                              ? "border-red-400/40 bg-red-600/12 text-red-100"
                              : "border-zinc-600/60 bg-zinc-800/35 text-zinc-100"
                          }`}
                        >
                          {reward.type === "subscription" ? (
                            <Crown className="h-4 w-4 shrink-0" />
                          ) : (
                            <BadgeCheck className="h-4 w-4 shrink-0" />
                          )}
                          <div className="flex min-w-0 flex-col">
                            <span className="text-[10px] uppercase tracking-[0.12em] text-zinc-400">
                              {reward.type === "subscription" ? "Подписка" : "Бейдж"}
                            </span>
                            {reward.type === "subscription" && /\(([^)]+)\)/.test(reward.label) ? (
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold">{reward.label.replace(/\s*\([^)]+\)\s*$/, "")}</span>
                                <span className="rounded-full border border-red-400/45 bg-red-950/45 px-2 py-0.5 text-[11px] text-red-200">
                                  {reward.label.match(/\(([^)]+)\)/)?.[1] ?? ""}
                                </span>
                              </div>
                            ) : (
                              <span className="font-medium">{reward.label}</span>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                  <Button
                    type="button"
                    className="h-12 w-full rounded-xl bg-[linear-gradient(135deg,rgba(239,68,68,1),rgba(220,38,38,1))] text-lg font-semibold text-white shadow-[0_12px_24px_rgba(239,68,68,0.3)] hover:brightness-110"
                    onClick={() => {
                      setPromoRewardsDialogOpen(false);
                      setPromoRewardsResult(null);
                      setPromoDialogOpen(false);
                    }}
                  >
                    Забрать
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </motion.div>
        )}
        {homeTab === "development" && (
          <div className="max-w-[120rem] mx-auto">
            <Card className="rounded-[28px] border-zinc-800 bg-zinc-900/95 text-zinc-100">
              <CardContent className="relative p-8 md:p-10 space-y-6">
                <div className="flex flex-col items-center gap-4 md:gap-5">
                  <div className="w-full max-w-md rounded-3xl border border-red-500/35 bg-gradient-to-br from-red-950/50 via-zinc-900 to-zinc-900 px-6 py-5 text-center shadow-[0_16px_40px_rgba(185,28,28,0.25)]">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-red-300/80">
                      Build
                    </div>
                    <div className="mt-2 text-3xl md:text-4xl font-semibold text-red-100">
                      {CURRENT_VERSION}
                    </div>
                  </div>
                  <motion.a
                    href={DISCORD_INVITE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    <Button
                      variant="outline"
                      className="h-10 rounded-xl border-red-500/35 bg-red-950/20 text-red-100 hover:bg-red-900/30 hover:text-white gap-2 px-4"
                    >
                      <AlertCircle className="w-4 h-4" />
                      <span>Сообщить о баге</span>
                    </Button>
                  </motion.a>
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
                    {"< Пред."}
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
                    {"След. >"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {homeTab === "help" && (
          <motion.div
            key="help-tab-content"
            initial={{ opacity: 0, y: 10, scale: 0.992 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="relative max-w-7xl mx-auto w-full"
          >
            <div className="pointer-events-none absolute -left-10 top-8 h-44 w-44 rounded-full bg-zinc-800/10 blur-3xl" />
            <div className="pointer-events-none absolute right-2 bottom-10 h-44 w-44 rounded-full bg-zinc-700/6 blur-3xl" />
            <Card className="relative rounded-[28px] border-zinc-800 bg-zinc-900/95 text-zinc-100 shadow-[0_24px_64px_rgba(0,0,0,0.5)]">
              <CardContent className="p-6 md:p-8 lg:p-10">
                <div className="mb-5 rounded-2xl border border-zinc-800 bg-gradient-to-r from-zinc-900 via-zinc-900/80 to-zinc-900 px-5 py-4">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Справка CourtGame</div>
                  <div className="mt-1 text-lg font-semibold text-zinc-100">Быстрые ответы по ролям, правилам и механикам</div>
                </div>
                <HelpCenter
                  query={mainHelpQuery}
                  onQueryChange={setMainHelpQuery}
                />
              </CardContent>
            </Card>
          </motion.div>
        )}
        <div className="flex-1" />
        {showLegalFooter && (
          <div className="mx-auto mt-auto w-full max-w-6xl px-3 pb-2 pt-10 text-center text-[11px] text-zinc-600 sm:text-xs">
            <div className="mx-auto flex w-full flex-col items-center justify-center gap-y-1 sm:flex-row sm:flex-wrap sm:gap-x-4">
              <button
                type="button"
                onClick={() => setLegalDialogType("privacy")}
                className="transition-colors hover:text-zinc-400"
              >
                Политика конфиденциальности
              </button>
              <button
                type="button"
                onClick={() => setLegalDialogType("terms")}
                className="transition-colors hover:text-zinc-400"
              >
                Пользовательское соглашение
              </button>
              <button
                type="button"
                onClick={() => setLegalDialogType("offer")}
                className="transition-colors hover:text-zinc-400"
              >
                Публичная оферта
              </button>
            </div>
            <div className="mt-1 flex flex-col items-center justify-center gap-y-1 text-zinc-700 sm:flex-row sm:flex-wrap sm:gap-x-4">
              <span>© 2026 CourtGame. Все права защищены.</span>
              <span>support@courtgame.site</span>
            </div>
          </div>
        )}
        <Dialog
          open={activeLegalDoc !== null}
          onOpenChange={(open) => {
            if (!open) setLegalDialogType(null);
          }}
        >
          {activeLegalDoc ? (
            <DialogContent overlayClassName="bg-black/94" className={`max-w-3xl max-h-[86vh] overflow-y-auto border-zinc-800 bg-zinc-950 pt-9 text-zinc-100 sm:pt-6 ${HIDE_SCROLLBAR_CLASS} [scrollbar-width:thin] [scrollbar-color:rgba(82,82,91,0.45)_transparent] [&::-webkit-scrollbar]:w-[4px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-600/55 [&::-webkit-scrollbar-thumb:hover]:bg-zinc-500/70`}>
              <DialogHeader className="items-center text-center">
                <DialogTitle className="text-xl">{activeLegalDoc.title}</DialogTitle>
                <DialogDescription className="text-zinc-400">
                  Обновлено: {activeLegalDoc.updatedAt}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 text-sm text-zinc-300">
                <p className="text-zinc-200">{activeLegalDoc.intro}</p>
                {activeLegalDoc.sections.map((section) => (
                  <div key={section.title} className="rounded-xl border border-zinc-800 bg-zinc-900/55 px-4 py-3">
                    <div className="text-sm font-semibold text-zinc-100">{section.title}</div>
                    <div className="mt-2 space-y-2 text-zinc-300">
                      {section.paragraphs.map((paragraph) => (
                        <p key={paragraph}>{paragraph}</p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </DialogContent>
          ) : null}
        </Dialog>
        {renderPublicProfileDialog()}
        {renderAdminTools()}
        {renderUpsellModal()}
        {renderBanOverlay()}
        <ScreenTransitionLoader open={safeGlobalBlockingLoading} />
      </motion.div>
    );
  }

  if (screen === "room" && room) {
    const roomModeMeta = getRoomModeMeta(room.modeKey, room.maxPlayers ?? 6);
    const roomPackMeta = casePacks.find((pack) => pack.key === (room.casePackKey ?? "classic"));
    const roomPackTitle = roomPackMeta?.title ?? (room.casePackKey ? room.casePackKey.toUpperCase() : "КЛАССИКА");
    const roomMaxPlayers = room.maxPlayers ?? roomModeMeta.maxPlayers;
    const usePreferredRoles = !!room.usePreferredRoles;
    const lobbyObservers = room.players.filter((player) => player.roleKey === "observer");
    const visibleRoomPlayers = room.players.filter((player) => player.roleKey !== "observer");
    const isQuickRoomMode = room.modeKey === "quick_flex";
    const activeLobbyPlayers = room.players.filter(
      (player) => player.roleKey !== "witness" && player.roleKey !== "observer",
    );
    const activeLobbyPlayersCount = activeLobbyPlayers.length;
    const lobbyAssignableRoles = getLobbyAssignableRoles(
      room.modeKey,
      activeLobbyPlayersCount,
      roomMaxPlayers,
    );
    const occupiedLobbyRolesByPlayer = new Map<AssignableRole, PlayerInfo>();
    activeLobbyPlayers.forEach((player) => {
      if (player.lobbyAssignedRole && !occupiedLobbyRolesByPlayer.has(player.lobbyAssignedRole)) {
        occupiedLobbyRolesByPlayer.set(player.lobbyAssignedRole, player);
      }
    });
    const myLobbyPlayer = room.players.find((player) => player.id === myId) ?? null;
    const selfLobbyTier = normalizeSubscriptionTier(myLobbyPlayer?.subscriptionTier ?? myTier);
    const canChooseRoleInOtherLobbiesInRoom = hasCapability(
      selfLobbyTier,
      "canChooseRoleInOtherLobbies",
    );
    const hostTransferCandidates = room.players.filter((player) => player.id !== room.hostId);
    const hasRoomHostControl = roomControlPlayerId === room.hostId;
    const hostRoomCapabilityTier = normalizeSubscriptionTier(room.hostSubscriptionTier ?? "free");
    const roomManagementTier = hasRoomHostControl
      ? getHigherSubscriptionTier(hostRoomCapabilityTier, myTier)
      : myTier;
    const canCreatePrivateRoomsInRoom = hasCapability(roomManagementTier, "canCreatePrivateRooms");
    const roleDialogTargetPlayer =
      room.players.find((player) => player.id === lobbyRoleTargetPlayerId) ?? myLobbyPlayer;
    const getRolePickerButtonForPlayer = (player: PlayerInfo) => {
      if (player.roleKey === "witness" || player.roleKey === "observer") return null;
      const selfPlayerId = myLobbyPlayer?.id ?? roomControlPlayerId ?? myId;
      const isSelf = player.id === selfPlayerId;
      if (hasRoomHostControl) {
        if (isSelf && !canChooseRoleInOwnLobby) return null;
        if (!isSelf && usePreferredRoles) return null;
        if (!isSelf && !canLetPlayersChooseRoles) return null;
        return {
          label: "Выбрать роль",
          locked: false,
          onClick: () => {
            setLobbyRoleTargetPlayerId(player.id);
            setLobbyRoleDialogOpen(true);
          },
        };
      }
      if (!isSelf) return null;
      if (!usePreferredRoles && player.roleAssignmentSource === "manual") return null;
      if (!usePreferredRoles && !canChooseRoleInOtherLobbiesInRoom) return null;
      return {
        label: "Выбрать роль",
        locked: false,
        onClick: () => {
          setLobbyRoleTargetPlayerId(player.id);
          setLobbyRoleDialogOpen(true);
        },
      };
    };
    const canRenderRoleDialog =
      !!roleDialogTargetPlayer &&
      roleDialogTargetPlayer.roleKey !== "witness" &&
      roleDialogTargetPlayer.roleKey !== "observer" &&
      (hasRoomHostControl
        ? roleDialogTargetPlayer.id === myLobbyPlayer?.id
          ? canChooseRoleInOwnLobby
          : !usePreferredRoles && canLetPlayersChooseRoles
        : roleDialogTargetPlayer.id === (myLobbyPlayer?.id ?? roomControlPlayerId ?? myId) &&
          (usePreferredRoles || canChooseRoleInOtherLobbiesInRoom) &&
          (usePreferredRoles || roleDialogTargetPlayer.roleAssignmentSource !== "manual"));
    const canStartRoomNow = isQuickRoomMode
      ? activeLobbyPlayersCount >= 3 && activeLobbyPlayersCount <= roomMaxPlayers
      : activeLobbyPlayersCount === roomMaxPlayers;
    const neededPlayersForStart = isQuickRoomMode
      ? Math.max(0, 3 - activeLobbyPlayersCount)
      : Math.max(0, roomMaxPlayers - activeLobbyPlayersCount);
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
        {lobbyObservers.length > 0 && (
          <div className="absolute left-4 top-4 z-20 sm:left-6 sm:top-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setObserverListDialogOpen(true)}
              className="h-9 rounded-lg border-zinc-700 bg-zinc-900/85 text-zinc-200 hover:bg-zinc-800 hover:text-zinc-100 gap-1.5 px-3"
            >
              <Eye className="h-4 w-4" />
              {lobbyObservers.length}
            </Button>
          </div>
        )}
        {canRenderRoleDialog && roleDialogTargetPlayer && (
          <Dialog
            open={lobbyRoleDialogOpen}
            onOpenChange={(open) => {
              setLobbyRoleDialogOpen(open);
              if (!open) setLobbyRoleTargetPlayerId(null);
            }}
          >
            <DialogContent className="rounded-2xl border-zinc-800 bg-zinc-950 text-zinc-100 sm:max-w-xl">
              <DialogHeader className="items-center text-center">
                <DialogTitle>Выбор роли</DialogTitle>
                <DialogDescription className="text-zinc-400 text-center">
                  Игрок: {roleDialogTargetPlayer.name}. Свободные роли можно выбрать сразу.
                </DialogDescription>
              </DialogHeader>
              {roleDialogTargetPlayer.rolePreferenceStatus === "conflict" && (
                <div className="rounded-xl border border-red-500/35 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                  Предпочитаемая роль занята. Выберите другую.
                </div>
              )}
              {roleDialogTargetPlayer.rolePreferenceStatus === "unavailable" && (
                <div className="rounded-xl border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-xs text-zinc-200">
                  Предпочитаемая роль недоступна в этом режиме.
                </div>
              )}
              <div className="grid gap-3">
                <button
                  type="button"
                  onClick={() => {
                    chooseLobbyRole(null, roleDialogTargetPlayer.id);
                    setLobbyRoleDialogOpen(false);
                    setLobbyRoleTargetPlayerId(null);
                  }}
                  className={`rounded-2xl border px-4 py-3 text-left transition ${
                    !roleDialogTargetPlayer.lobbyAssignedRole
                      ? "border-red-500 bg-red-600/20 text-white shadow-[0_0_18px_rgba(239,68,68,0.25)]"
                      : "border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold">Случайная</div>
                      <div className="text-xs text-zinc-400">Система выдаст свободную роль при старте.</div>
                    </div>
                    <span className="rounded-full border border-zinc-700 bg-zinc-900/70 px-2 py-0.5 text-[11px] text-zinc-300">
                      Авто
                    </span>
                  </div>
                </button>
                <div className="grid gap-2 sm:grid-cols-2">
                  {lobbyAssignableRoles.map((roleKey) => {
                    const owner = occupiedLobbyRolesByPlayer.get(roleKey);
                    const occupiedByOther = !!owner && owner.id !== roleDialogTargetPlayer.id;
                    const isSelected = roleDialogTargetPlayer.lobbyAssignedRole === roleKey;
                    return (
                      <button
                        key={roleKey}
                        type="button"
                        disabled={occupiedByOther}
                        onClick={() => {
                          chooseLobbyRole(roleKey, roleDialogTargetPlayer.id);
                          setLobbyRoleDialogOpen(false);
                          setLobbyRoleTargetPlayerId(null);
                        }}
                        className={`rounded-2xl border px-3 py-3 text-left transition ${
                          isSelected
                            ? "border-red-500 bg-red-600/20 text-white shadow-[0_0_18px_rgba(239,68,68,0.25)]"
                            : occupiedByOther
                              ? "border-zinc-800 bg-zinc-900/60 text-zinc-500"
                              : "border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
                        }`}
                      >
                        <div className="text-sm font-semibold leading-snug">
                          {ASSIGNABLE_ROLE_TITLES[roleKey]}
                        </div>
                        <div className="mt-1 text-xs text-zinc-400">
                          {occupiedByOther ? `Занято: ${owner?.name ?? "игрок"}` : "Свободно"}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
        {hasRoomHostControl && (
          <Dialog open={roomManageOpen} onOpenChange={setRoomManageOpen}>
            <DialogContent
              className="top-[4vh] sm:top-[6vh] translate-y-0 rounded-3xl border-zinc-800 bg-[radial-gradient(130%_120%_at_0%_0%,rgba(220,38,38,0.13),transparent_45%),linear-gradient(145deg,rgba(13,13,17,0.98),rgba(10,10,12,0.96))] text-zinc-100 sm:max-w-3xl max-h-[88vh] overflow-y-auto [scrollbar-width:thin] [scrollbar-color:rgba(82,82,91,0.28)_transparent] [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-600/40 [&::-webkit-scrollbar-thumb:hover]:bg-zinc-500/55"
            >
              {upsellModalOpen && roomManageOpen && (
                <div className="pointer-events-none absolute inset-0 z-20 rounded-3xl bg-black/45" />
              )}
              <DialogHeader>
                <DialogTitle>Управление комнатой</DialogTitle>
                <DialogDescription className="text-zinc-400">
                  Настройки ведущего для текущего лобби.
                </DialogDescription>
              </DialogHeader>
              <div className="grid items-start gap-3 xl:grid-cols-2">
                <div className="rounded-2xl border border-zinc-800/90 bg-zinc-900/55 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-zinc-100">Я - Судья</div>
                    <Switch checked={isHostJudge} onCheckedChange={toggleHostJudge} />
                  </div>
                </div>
                <div className="rounded-2xl border border-zinc-800/90 bg-zinc-900/55 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-zinc-100 inline-flex items-center gap-1.5">
                      Выбор ролей
                      {!canLetPlayersChooseRoles && <Lock className="h-3.5 w-3.5 text-zinc-400" />}
                    </div>
                    <Switch checked={usePreferredRoles} onCheckedChange={togglePreferredRoles} />
                  </div>
                </div>
                <div className="rounded-2xl border border-zinc-800/90 bg-zinc-900/55 p-3 xl:col-span-2">
                  <div className="text-xs font-semibold tracking-[0.2em] uppercase text-zinc-500">Режим</div>
                  <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-4">
                    {ROOM_MODE_OPTIONS.map((mode) => (
                      <button
                        key={`manage-mode-${mode.key}`}
                        type="button"
                        onClick={() => updateRoomManagementSettings({ modeKey: mode.key })}
                        className={`rounded-xl border px-3 py-2 text-left text-xs transition ${
                          room.modeKey === mode.key
                            ? "border-red-500/80 bg-red-600/20 text-zinc-100 shadow-[0_0_0_1px_rgba(248,113,113,0.25),0_0_16px_rgba(239,68,68,0.2)]"
                            : "border-zinc-700/90 bg-zinc-950/80 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-900"
                        }`}
                      >
                        <div className="font-semibold leading-tight">{mode.title}</div>
                        <div className="mt-1 text-[11px] text-zinc-500">На {mode.maxPlayers} игроков</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-zinc-800/90 bg-zinc-900/55 p-3 xl:col-span-2">
                  <div className="text-xs font-semibold tracking-[0.2em] uppercase text-zinc-500">Пак дел</div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {[...casePacks]
                      .sort((a, b) => {
                        const orderByKey: Record<string, number> = {
                          classic: 0,
                          hard_cases: 1,
                          adult_18_plus: 2,
                          wild_west: 3,
                        };
                        const aTitle = String(a.title ?? "").toLowerCase();
                        const bTitle = String(b.title ?? "").toLowerCase();
                        const aOrder =
                          orderByKey[a.key] ??
                          (aTitle.includes("особо") || aTitle.includes("тяжк")
                            ? 1
                            : aTitle.includes("18+")
                              ? 2
                              : aTitle.includes("запад")
                                ? 3
                                : Number.MAX_SAFE_INTEGER);
                        const bOrder =
                          orderByKey[b.key] ??
                          (bTitle.includes("особо") || bTitle.includes("тяжк")
                            ? 1
                            : bTitle.includes("18+")
                              ? 2
                              : bTitle.includes("запад")
                                ? 3
                                : Number.MAX_SAFE_INTEGER);
                        if (aOrder !== bOrder) return aOrder - bOrder;
                        return getCasePackSortOrder(a) - getCasePackSortOrder(b);
                      })
                      .map((pack) => {
                      const isLocked = isPackLockedForTier(pack, roomManagementTier);
                      return (
                        <button
                          key={`manage-pack-${pack.key}`}
                          type="button"
                          onClick={() => {
                            if (isLocked) {
                              const requiredTier = getRequiredTierForPack(pack);
                              openSubscriptionUpsell(
                                requiredTier === "trainee"
                                  ? "canAccessPackSevere"
                                  : "canAccessAllPacks",
                                `Пак «${getCasePackTitleDisplay(pack.title)}» доступен с подписки «${getSubscriptionTierLabel(requiredTier)}».`,
                              );
                              return;
                            }
                            updateRoomManagementSettings({ casePackKey: pack.key });
                          }}
                          className={`relative overflow-hidden rounded-xl border px-3 py-2 text-left text-xs transition ${
                            isLocked
                              ? "border-zinc-700/90 bg-zinc-950/70 text-zinc-500"
                              : (room.casePackKey ?? "classic") === pack.key
                                ? "border-red-500/80 bg-red-600/20 text-zinc-100 shadow-[0_0_0_1px_rgba(248,113,113,0.25),0_0_16px_rgba(239,68,68,0.18)]"
                                : "border-zinc-700/90 bg-zinc-950/80 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-900"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1.5 font-semibold">
                              {isLocked && <Lock className="h-3.5 w-3.5 text-zinc-500" />}
                              {getCasePackTitleDisplay(pack.title)}
                            </span>
                            <span className="rounded-full border border-zinc-600/80 bg-zinc-900/80 px-2 py-0.5 text-[10px] font-semibold text-zinc-300">
                              {Math.max(0, Number(pack.caseCount ?? 0) || 0)} дел
                            </span>
                          </div>
                          {isLocked && (
                            <div className="pointer-events-none absolute inset-0 rounded-xl border border-zinc-600/55 bg-zinc-950/40" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="rounded-2xl border border-zinc-800/90 bg-zinc-900/55 p-3 xl:col-span-2">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950/55 px-3 py-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium text-zinc-100">Свидетели</div>
                          <div className="text-xs text-zinc-500">
                            Вкл: новые игроки в матче могут стать свидетелями.
                          </div>
                        </div>
                        <Switch
                          checked={manageAllowWitnesses}
                          onCheckedChange={(checked) => {
                            setManageAllowWitnesses(checked);
                            updateRoomManagementSettings({ allowWitnesses: checked });
                          }}
                        />
                      </div>
                    </div>
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950/55 px-3 py-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium text-zinc-100">Наблюдатели</div>
                          <div className="text-xs text-zinc-500">Максимум в комнате</div>
                        </div>
                        <Select
                          value={String(manageMaxObservers)}
                          onValueChange={(value) => {
                            const parsed = Math.max(0, Math.min(6, Number(value) || 0));
                            setManageMaxObservers(parsed);
                            updateRoomManagementSettings({ maxObservers: parsed });
                          }}
                        >
                          <SelectTrigger className="h-10 w-24 rounded-xl border-zinc-700 bg-zinc-950 text-zinc-100 focus:ring-red-500/40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="border-zinc-800 bg-zinc-950 text-zinc-100">
                            {[0, 1, 2, 3, 4, 5, 6].map((value) => (
                              <SelectItem key={`obs-limit-${value}`} value={String(value)}>
                                {value}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-zinc-800/90 bg-zinc-900/55 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-zinc-100">Таймер вступления</div>
                    <Switch
                      checked={manageOpeningTimerEnabled}
                      onCheckedChange={(checked) => {
                        setManageOpeningTimerEnabled(checked);
                        updateRoomManagementSettings({
                          openingSpeechTimerSec: checked ? manageOpeningTimerSec : null,
                        });
                      }}
                    />
                  </div>
                  {manageOpeningTimerEnabled && (
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <div className="text-xs text-zinc-500">Длительность</div>
                      <Select
                        value={String(manageOpeningTimerSec)}
                        onValueChange={(value) => {
                          const parsed = Math.max(15, Math.min(180, Number(value) || 60));
                          setManageOpeningTimerSec(parsed);
                          updateRoomManagementSettings({ openingSpeechTimerSec: parsed });
                        }}
                      >
                        <SelectTrigger className="h-10 w-28 rounded-xl border-zinc-700 bg-zinc-950 text-zinc-100 focus:ring-red-500/40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="border-zinc-800 bg-zinc-950 text-zinc-100">
                          {[15, 30, 45, 60, 90, 120, 150, 180].map((value) => (
                            <SelectItem key={`open-timer-${value}`} value={String(value)}>
                              {value} сек.
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                <div className="rounded-2xl border border-zinc-800/90 bg-zinc-900/55 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-zinc-100">Таймер заключения</div>
                    <Switch
                      checked={manageClosingTimerEnabled}
                      onCheckedChange={(checked) => {
                        setManageClosingTimerEnabled(checked);
                        updateRoomManagementSettings({
                          closingSpeechTimerSec: checked ? manageClosingTimerSec : null,
                        });
                      }}
                    />
                  </div>
                  {manageClosingTimerEnabled && (
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <div className="text-xs text-zinc-500">Длительность</div>
                      <Select
                        value={String(manageClosingTimerSec)}
                        onValueChange={(value) => {
                          const parsed = Math.max(15, Math.min(180, Number(value) || 60));
                          setManageClosingTimerSec(parsed);
                          updateRoomManagementSettings({ closingSpeechTimerSec: parsed });
                        }}
                      >
                        <SelectTrigger className="h-10 w-28 rounded-xl border-zinc-700 bg-zinc-950 text-zinc-100 focus:ring-red-500/40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="border-zinc-800 bg-zinc-950 text-zinc-100">
                          {[15, 30, 45, 60, 90, 120, 150, 180].map((value) => (
                            <SelectItem key={`close-timer-${value}`} value={String(value)}>
                              {value} сек.
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                <div className="rounded-2xl border border-zinc-800/90 bg-zinc-900/55 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-zinc-100">Лимит протестов</div>
                    <Switch
                      checked={manageProtestLimitEnabled}
                      onCheckedChange={(checked) => {
                        setManageProtestLimitEnabled(checked);
                        updateRoomManagementSettings({
                          protestLimitEnabled: checked,
                          maxProtestsPerPlayer: checked ? manageProtestLimit : null,
                        });
                      }}
                    />
                  </div>
                  {manageProtestLimitEnabled && (
                    <div className="mt-2">
                      <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                        <span className="text-zinc-500">На игрока</span>
                        <span className="font-semibold text-zinc-200">{manageProtestLimit}</span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={10}
                        step={1}
                        value={manageProtestLimit}
                        onChange={(e) => {
                          const next = Math.max(1, Math.min(10, Number(e.target.value) || 1));
                          setManageProtestLimit(next);
                        }}
                        onPointerUp={(e) => {
                          const next = Math.max(1, Math.min(10, Number(e.currentTarget.value) || 1));
                          updateRoomManagementSettings({
                            protestLimitEnabled: true,
                            maxProtestsPerPlayer: next,
                          });
                        }}
                        onTouchEnd={(e) => {
                          const next = Math.max(1, Math.min(10, Number(e.currentTarget.value) || 1));
                          updateRoomManagementSettings({
                            protestLimitEnabled: true,
                            maxProtestsPerPlayer: next,
                          });
                        }}
                        onKeyUp={(e) => {
                          if (
                            e.key !== "ArrowLeft" &&
                            e.key !== "ArrowRight" &&
                            e.key !== "ArrowUp" &&
                            e.key !== "ArrowDown" &&
                            e.key !== "Home" &&
                            e.key !== "End"
                          ) {
                            return;
                          }
                          const target = e.currentTarget as HTMLInputElement;
                          const next = Math.max(1, Math.min(10, Number(target.value) || 1));
                          updateRoomManagementSettings({
                            protestLimitEnabled: true,
                            maxProtestsPerPlayer: next,
                          });
                        }}
                        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-zinc-700/65 accent-red-500
                          [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-zinc-700/65
                          [&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-zinc-700/65
                          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:-mt-[5px]
                          [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:rounded-full
                          [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-red-300/60 [&::-webkit-slider-thumb]:bg-red-500
                          [&::-webkit-slider-thumb]:shadow-[0_0_0_2px_rgba(239,68,68,0.22),0_0_8px_rgba(239,68,68,0.22)]
                          [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:rounded-full
                          [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-red-300/60 [&::-moz-range-thumb]:bg-red-500"
                      />
                      <div className="mt-1 flex items-center justify-between text-[10px] text-zinc-600">
                        <span>1</span>
                        <span>10</span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="rounded-2xl border border-zinc-800/90 bg-zinc-900/55 px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium text-zinc-100 inline-flex items-center gap-1.5">
                      Приватная
                      {!canCreatePrivateRoomsInRoom && <Lock className="h-3.5 w-3.5 text-zinc-400" />}
                    </div>
                    <Switch
                      checked={room.visibility === "private"}
                      onCheckedChange={(checked) => {
                        if (checked && !canCreatePrivateRoomsInRoom) {
                          openSubscriptionUpsell(
                            "canCreatePrivateRooms",
                            "Приватные комнаты доступны только в подписке «Арбитр».",
                          );
                          return;
                        }
                        updateRoomManagementSettings({ visibility: checked ? "private" : "public" });
                      }}
                    />
                  </div>
                  {room.visibility === "private" && (
                    <div className="relative mt-2">
                      <Input
                        value={manageRoomPassword}
                        placeholder="Пароль"
                        type={manageRoomPasswordVisible ? "text" : "password"}
                        onChange={(e) => setManageRoomPassword(e.target.value)}
                        className="h-10 rounded-xl border-zinc-700 bg-zinc-950 text-zinc-100 pr-11"
                        onBlur={(e) =>
                          updateRoomManagementSettings({
                            password: e.target.value.trim() ? e.target.value.trim() : null,
                          })
                        }
                      />
                      <button
                        type="button"
                        onClick={() => setManageRoomPasswordVisible((prev) => !prev)}
                        className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center text-zinc-400 hover:text-zinc-200"
                      >
                        {manageRoomPasswordVisible ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
                <div className="rounded-2xl border border-zinc-800/90 bg-zinc-900/55 px-4 py-3 xl:col-span-2">
                  <div className="text-xs text-zinc-500">Передать хоста</div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
                    <Select value={manageTransferHostId} onValueChange={setManageTransferHostId}>
                      <SelectTrigger className="h-10 rounded-xl border-zinc-700 bg-zinc-950 text-zinc-100 focus:ring-red-500/40">
                        <SelectValue placeholder="Выбрать игрока" />
                      </SelectTrigger>
                      <SelectContent className="border-zinc-800 bg-zinc-950 text-zinc-100">
                        {hostTransferCandidates.length === 0 && (
                          <SelectItem value="__none__" disabled>
                            Нет кандидатов
                          </SelectItem>
                        )}
                        {hostTransferCandidates.map((player) => (
                          <SelectItem key={`host-candidate-${player.id}`} value={player.id}>
                            {player.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      className="h-10 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-500"
                      onClick={() => transferRoomHostTo(manageTransferHostId)}
                      disabled={!manageTransferHostId || manageTransferHostId === "__none__"}
                    >
                      Передать
                    </Button>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
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
                action={hasRoomHostControl ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 rounded-xl border-zinc-700 bg-zinc-800/75 px-4 text-zinc-100 hover:bg-zinc-700"
                    onClick={() => setRoomManageOpen(true)}
                  >
                    Управление
                  </Button>
                ) : undefined}
              >
                <div className="relative flex min-h-[460px] lg:min-h-[660px] flex-col pb-12">
                  <div className="grid gap-3">
                    <AnimatePresence>
                      {visibleRoomPlayers.map((player) => {
                        const resolvedUserId =
                          player.userId ?? knownUserIdByPlayerIdRef.current[player.id];
                        return (
                        <div key={player.id} className="relative">
                          {player.id === room.hostId ? (
                            <div className="pointer-events-none absolute inset-x-8 -bottom-1 h-8 rounded-full bg-red-500/16 blur-xl" />
                          ) : null}
                          <PlayerCard
                            player={{ ...player, userId: resolvedUserId }}
                            isHost={player.id === room.hostId}
                            showLobbyAssignedRole={
                              usePreferredRoles || (!usePreferredRoles && !!player.lobbyAssignedRole)
                            }
                            rolePickerButton={getRolePickerButtonForPlayer(player)}
                            canKick={hasRoomHostControl && player.id !== room.hostId}
                            onKick={() => kickPlayerFromRoom(player.id)}
                            onOpenProfile={openUserProfileFromPlayer}
                            nowTs={nowMs}
                          />
                        </div>
                        );
                      })}
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
                      <div className="mt-1 text-xs text-zinc-400">{roomModeMeta.subtitle}</div>
                    </div>
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2">
                      <div className="text-xs uppercase tracking-[0.12em] text-zinc-500">
                        Выбранный пак
                      </div>
                      {(() => {
                        const displayPackTitle = getCasePackTitleDisplay(roomPackTitle);
                        return (
                          <div className="mt-1.5 rounded-lg border border-zinc-700/55 bg-zinc-900/35 px-3 py-2">
                            <div className="truncate text-sm font-medium text-zinc-100">{displayPackTitle}</div>
                            <div className="mt-0.5 truncate text-xs text-zinc-400">
                              {roomPackMeta?.description ?? "Пак выбран для текущего матча."}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                    <div className="text-zinc-400 pt-2">
                      Ведущий запускает игру, сайт случайно выбирает подходящее
                      дело и распределяет роли.
                    </div>
                    {hasRoomHostControl && (
                      <Button
                        className="mt-3 h-10 rounded-xl gap-2 bg-red-600 hover:bg-red-500 text-white border-0 disabled:bg-zinc-800 disabled:text-zinc-500"
                        onClick={startGame}
                        disabled={startGameLoading || !canStartRoomNow}
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
        <Dialog open={observerListDialogOpen} onOpenChange={setObserverListDialogOpen}>
          <DialogContent className="max-w-lg border-zinc-800 bg-zinc-950 text-zinc-100">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Наблюдатели
              </DialogTitle>
              <DialogDescription className="text-zinc-400">
                Сейчас наблюдают: {lobbyObservers.length}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              {lobbyObservers.map((player) => {
                const profileUserId =
                  player.userId ?? knownUserIdByPlayerIdRef.current[player.id];
                const canOpenProfile = !!profileUserId;
                return (
                  <button
                    key={player.id}
                    type="button"
                    disabled={!canOpenProfile}
                    onClick={() =>
                      canOpenProfile
                        ? openUserProfileFromPlayer({
                            playerId: player.id,
                            userId: profileUserId,
                            name: player.name,
                            avatar: player.avatar,
                            banner: player.banner,
                            selectedBadgeKey: player.selectedBadgeKey,
                          })
                        : undefined
                    }
                    className={`relative w-full overflow-hidden rounded-xl border bg-zinc-900/60 px-2.5 py-2 text-left ${
                      canOpenProfile
                        ? "cursor-pointer border-zinc-700 hover:border-zinc-500"
                        : "cursor-default border-zinc-800"
                    }`}
                  >
                    <div
                      className="pointer-events-none absolute inset-0 opacity-80"
                      style={getBannerStyle(player.banner, player.avatar, player.name)}
                    />
                    <div className="pointer-events-none absolute inset-0 bg-black/35" />
                    <div className="relative z-10 flex items-center justify-between gap-2 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar src={player.avatar ?? null} name={player.name} size={34} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="truncate text-sm font-semibold text-zinc-100">{player.name}</span>
                            {player.selectedBadgeKey ? (
                              <span
                                className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${
                                  getBadgeTheme(player.selectedBadgeKey).icon
                                }`}
                              >
                                <BadgeGlyph badgeKey={player.selectedBadgeKey} className="h-3 w-3" />
                              </span>
                            ) : null}
                          </div>
                          <div className="text-xs text-zinc-300">Наблюдатель</div>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>
        {renderAdminTools()}
        {renderUpsellModal()}
        {renderBanOverlay()}
        <ScreenTransitionLoader open={safeGlobalBlockingLoading} />
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
    const isSpectator = game.me.roleKey === "observer";
    const isObserverRole = isJudge || isWitness || isSpectator;
    const gameObservers = game.players.filter((player) => player.roleKey === "observer");
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
      !isSpectator &&
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
    const speechMsLeft =
      typeof speechTimerDeadlineAt === "number" ? Math.max(0, speechTimerDeadlineAt - nowMs) : null;
    const speechSecondsLeft =
      speechMsLeft !== null ? Math.max(0, Math.ceil(speechMsLeft / 1000)) : null;
    const canUseJudgeSilence = isJudge && !game.finished && silenceCooldownLeft <= 0;
    const canUseJudgeWarning = isJudge && !game.finished;
    const isCardAnnouncement = influenceAnnouncement?.kind === "card";
    const announcementTitle = influenceAnnouncement?.title ?? "";
    const isProtestAcceptedAnnouncement =
      influenceAnnouncement?.kind === "protest" && /ПРИНЯТ/i.test(announcementTitle);
    const isProtestRejectedAnnouncement =
      influenceAnnouncement?.kind === "protest" && /ОТКЛОНЕН/i.test(announcementTitle);
    const warningTargets = game.players.filter(
      (player) =>
        player.id !== game.me!.id &&
        player.roleKey !== "judge" &&
        player.roleKey !== "observer",
    );
    const influenceScrollableHeightClass =
      game.players.length >= 8
        ? "h-[360px] md:h-[430px]"
        : game.players.length >= 6
          ? "h-[320px] md:h-[380px]"
          : "h-[280px] md:h-[320px]";
    const warningScrollableHeightClass =
      game.players.length >= 8
        ? "max-h-[500px]"
        : game.players.length >= 6
          ? "max-h-[450px]"
          : "max-h-[420px]";
    return (
      <motion.div
        key="game"
        variants={pageVariants}
        initial="initial"
        animate="animate"
        className="relative isolate min-h-screen overflow-x-hidden bg-[#0b0b0f] text-zinc-100 p-4 sm:p-6 md:p-10"
      >
        <CourtAtmosphereBackground />
        {gameObservers.length > 0 && (
          <div className="absolute left-4 top-4 z-20 sm:left-6 sm:top-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setObserverListDialogOpen(true)}
              className="h-9 rounded-lg border-zinc-700 bg-zinc-900/85 text-zinc-200 hover:bg-zinc-800 hover:text-zinc-100 gap-1.5 px-3"
            >
              <Eye className="h-4 w-4" />
              {gameObservers.length}
            </Button>
          </div>
        )}
        {game.venueUrl && (
          <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => openVoiceLink(game.venueUrl)}
              className="h-9 rounded-lg border-zinc-700 bg-zinc-900/85 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 gap-1.5 px-3"
            >
              <Mic2 className="h-4 w-4" />
              Войс
            </Button>
          </div>
        )}
        {speechSecondsLeft !== null && speechTimerLabel && (
          <div className="fixed inset-0 z-[72] pointer-events-none flex items-center justify-center px-4">
            <div className="w-full max-w-[320px] rounded-2xl border border-zinc-700 bg-zinc-950/95 px-5 py-6 text-center shadow-[0_22px_66px_rgba(0,0,0,0.72)]">
              <div className="text-xs uppercase tracking-[0.14em] text-zinc-400">{speechTimerLabel}</div>
              <div className={`mt-2 text-6xl font-black tabular-nums ${speechSecondsLeft === 0 ? "text-zinc-500" : "text-zinc-100"}`}>
                {speechSecondsLeft}
              </div>
            </div>
          </div>
        )}
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
                        <X className="h-4 w-4" />
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
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-zinc-400 min-w-0">
                    <Badge className="bg-zinc-800 text-zinc-100 border border-zinc-700">
                      {game.caseData.mode}
                    </Badge>
                    <span className="min-w-0 break-words [text-wrap:balance]">{game.caseData.title}</span>
                    <span className="text-zinc-600 break-words">• Комната {game.code}</span>
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
                          {"< Пред."}
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
                          {"След. >"}
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

          <div className="grid xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(0,0.9fr)] gap-6">
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
                    {game.players
                      .filter((player) => player.roleKey !== "observer")
                      .map((p) => {
                      const profileUserId =
                        p.userId ?? knownUserIdByPlayerIdRef.current[p.id];
                      return (
                      <div
                        key={p.id}
                        className={`relative overflow-hidden rounded-xl border bg-zinc-900/60 px-2.5 py-1.5 flex items-center justify-between text-sm ${
                          profileUserId
                            ? "cursor-pointer border-zinc-800 hover:border-zinc-700"
                            : "border-zinc-800"
                        }`}
                        onClick={() =>
                          profileUserId
                            ? openUserProfileFromPlayer({
                                playerId: p.id,
                                userId: profileUserId,
                                name: p.name,
                                avatar: p.avatar,
                                banner: p.banner,
                                selectedBadgeKey: p.selectedBadgeKey,
                              })
                            : undefined
                        }
                      >
                        <div
                          className="pointer-events-none absolute inset-0 opacity-80"
                          style={getBannerStyle(p.banner, p.avatar, p.name)}
                        />
                        <div className="pointer-events-none absolute inset-0 bg-black/35" />
                        <div className="relative z-10 flex items-center gap-2 min-w-0 flex-1">
                          <div
                            className={`inline-flex items-center gap-2 min-w-0 rounded-md px-1 py-0.5 text-left ${
                              profileUserId
                                ? "text-zinc-300 hover:text-zinc-100 transition-colors"
                                : "text-zinc-400"
                            }`}
                          >
                            <Avatar src={p.avatar ?? null} name={p.name} size={32} />
                            <span className="truncate">{p.name}</span>
                            {p.selectedBadgeKey ? (
                              <span
                                className={`inline-flex h-6 w-6 shrink-0 self-center items-center justify-center rounded-md ${
                                  getBadgeTheme(p.selectedBadgeKey).icon
                                }`}
                              >
                                <BadgeGlyph badgeKey={p.selectedBadgeKey} className="h-3.5 w-3.5" />
                              </span>
                            ) : null}
                          </div>
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
                        <div className="relative z-10 ml-2 shrink-0 flex items-center gap-2">
                          {(p.warningCount ?? 0) > 0 && (
                            <Badge className="bg-red-950/70 text-red-300 border border-red-700/70">
                              {p.warningCount}/3
                            </Badge>
                          )}
                          <span
                            className="text-zinc-300 text-right"
                            style={{ textShadow: "0 1px 2px rgba(0,0,0,0.85), 0 0 10px rgba(0,0,0,0.45)" }}
                          >
                            {p.roleTitle}
                          </span>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </InfoBlock>

            <InfoBlock title="Улики дела" icon={<Eye className="w-5 h-5" />}>
              <div className="space-y-3 min-h-[320px]">
                {game.caseData.evidence.map((item, index) => (
                  <motion.div
                    key={index}
                    custom={index}
                    variants={cardVariants}
                    initial="initial"
                    animate="animate"
                  >
                    <Card className="rounded-2xl border-dashed border-zinc-700 bg-zinc-900/80 text-zinc-100">
                      <CardContent className="p-4 text-base leading-relaxed min-h-[74px] flex items-center">{item}</CardContent>
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
                      className={`rounded-xl border border-zinc-800 bg-zinc-950/70 p-3 overflow-y-auto overflow-x-hidden ${influenceScrollableHeightClass} ${HIDE_SCROLLBAR_CLASS}`}
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
                    <div className={`space-y-2.5 overflow-y-auto overflow-x-hidden pr-2 [scrollbar-width:thin] [scrollbar-color:rgba(113,113,122,0.9)_rgba(24,24,27,0.45)] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-zinc-900/55 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-700/85 [&::-webkit-scrollbar-thumb:hover]:bg-zinc-500 ${warningScrollableHeightClass}`}>
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
            className={`grid gap-6 ${isObserverRole ? "xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" : "xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]"}`}
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
              <div className="space-y-3 min-h-[80px] min-w-0">
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
                <div className="space-y-3 min-w-0">
                  {game.me.facts.length === 0 ? (
                    <div className="text-sm text-zinc-400">
                      У вас нет фактов для раскрытия.
                    </div>
                  ) : (
                    game.me.facts.map((fact) => {
                      const canRevealThisFact =
                        !fact.revealed &&
                        !game.finished &&
                        canRevealFactsAtCurrentStage &&
                        !pendingFactRevealIds.includes(fact.id);

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
                <div className="space-y-3 min-w-0">
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
              <div className="space-y-3 min-h-[80px] min-w-0">
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
            <div className="fixed right-5 bottom-[0.55rem] sm:bottom-[0.65rem] left-auto z-30 h-11 rounded-2xl px-3.5 inline-flex items-center gap-2 border border-zinc-700 bg-zinc-900/90 text-zinc-100 backdrop-blur-md shadow-[0_12px_30px_rgba(0,0,0,0.45)]">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-red-600 text-white shadow-sm shadow-red-900/50">
                <Clock3 className="h-3.5 w-3.5" />
              </span>
              <span className="text-sm font-semibold leading-none">До авто-закрытия:</span>
              <span className="text-sm font-semibold text-red-300 leading-none">
                {String(matchHoursLeft).padStart(2, "0")}:
                {String(matchMinutesLeft).padStart(2, "0")}:
                {String(matchSecondsLeft).padStart(2, "0")}
              </span>
            </div>
          )}
          <ContextHelp
            open={contextHelpOpen}
            onOpenChange={setContextHelpOpen}
            query={contextHelpQuery}
            onQueryChange={setContextHelpQuery}
            floatingOffsetClass="bottom-[5.35rem] sm:bottom-[5.55rem]"
          />
        </div>
        {renderPublicProfileDialog()}
        <Dialog open={observerListDialogOpen} onOpenChange={setObserverListDialogOpen}>
          <DialogContent className="max-w-lg border-zinc-800 bg-zinc-950 text-zinc-100">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Наблюдатели
              </DialogTitle>
              <DialogDescription className="text-zinc-400">
                Сейчас наблюдают: {gameObservers.length}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              {gameObservers.map((player) => {
                const profileUserId =
                  player.userId ?? knownUserIdByPlayerIdRef.current[player.id];
                const canOpenProfile = !!profileUserId;
                return (
                  <button
                    key={player.id}
                    type="button"
                    disabled={!canOpenProfile}
                    onClick={() =>
                      canOpenProfile
                        ? openUserProfileFromPlayer({
                            playerId: player.id,
                            userId: profileUserId,
                            name: player.name,
                            avatar: player.avatar,
                            banner: player.banner,
                            selectedBadgeKey: player.selectedBadgeKey,
                          })
                        : undefined
                    }
                    className={`relative w-full overflow-hidden rounded-xl border bg-zinc-900/60 px-2.5 py-2 text-left ${
                      canOpenProfile
                        ? "cursor-pointer border-zinc-700 hover:border-zinc-500"
                        : "cursor-default border-zinc-800"
                    }`}
                  >
                    <div
                      className="pointer-events-none absolute inset-0 opacity-80"
                      style={getBannerStyle(player.banner, player.avatar, player.name)}
                    />
                    <div className="pointer-events-none absolute inset-0 bg-black/35" />
                    <div className="relative z-10 flex items-center justify-between gap-2 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar src={player.avatar ?? null} name={player.name} size={34} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="truncate text-sm font-semibold text-zinc-100">{player.name}</span>
                            {player.selectedBadgeKey ? (
                              <span
                                className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${
                                  getBadgeTheme(player.selectedBadgeKey).icon
                                }`}
                              >
                                <BadgeGlyph badgeKey={player.selectedBadgeKey} className="h-3 w-3" />
                              </span>
                            ) : null}
                          </div>
                          <div className="text-xs text-zinc-300">Наблюдатель</div>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>
        {renderAdminTools()}
        {renderUpsellModal()}
        {renderBanOverlay()}
        <ScreenTransitionLoader open={safeGlobalBlockingLoading} />
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




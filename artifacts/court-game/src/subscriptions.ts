export type SubscriptionTier = "free" | "trainee" | "practitioner" | "arbiter";
export type SubscriptionDuration =
  | "1_day"
  | "3_days"
  | "7_days"
  | "1_month"
  | "1_year"
  | "forever";
export type SubscriptionSource = "manual" | "system";

export interface SubscriptionCapabilities {
  canUseRating: boolean;
  canAccessPackSevere: boolean;
  canAccessPack18: boolean;
  canAccessAllPacks: boolean;
  canChooseRoleInOwnLobby: boolean;
  canLetPlayersChooseRoles: boolean;
  canUseProfileBanner: boolean;
  canUseAnimatedProfileMedia: boolean;
  canHighlightHostedMatch: boolean;
  canCreatePrivateRooms: boolean;
  canChooseRoleInOtherLobbies: boolean;
  canCreatePacks: boolean;
}

export type SubscriptionCapabilityKey = keyof SubscriptionCapabilities;

export interface SubscriptionView {
  tier: SubscriptionTier;
  label: string;
  startAt: number | null;
  endAt: number | null;
  isLifetime: boolean;
  source: SubscriptionSource;
  duration: SubscriptionDuration;
  isActive: boolean;
  daysLeft: number | null;
  capabilities: SubscriptionCapabilities;
}

export interface SubscriptionPlan {
  tier: Exclude<SubscriptionTier, "free">;
  title: string;
  shortLabel: string;
  monthPriceRub: number;
  yearPriceRub: number;
  badge: string;
  isPopular?: boolean;
  features: string[];
}

export const SUBSCRIPTION_TIER_ORDER: SubscriptionTier[] = [
  "free",
  "trainee",
  "practitioner",
  "arbiter",
];

export const SUBSCRIPTION_LABELS: Record<SubscriptionTier, string> = {
  free: "Бесплатный доступ",
  trainee: "Стажер",
  practitioner: "Практик",
  arbiter: "Арбитр",
};

const FREE_CAPABILITIES: SubscriptionCapabilities = {
  canUseRating: false,
  canAccessPackSevere: false,
  canAccessPack18: false,
  canAccessAllPacks: false,
  canChooseRoleInOwnLobby: false,
  canLetPlayersChooseRoles: false,
  canUseProfileBanner: false,
  canUseAnimatedProfileMedia: false,
  canHighlightHostedMatch: false,
  canCreatePrivateRooms: false,
  canChooseRoleInOtherLobbies: false,
  canCreatePacks: false,
};

const TRAINEE_CAPABILITIES: SubscriptionCapabilities = {
  ...FREE_CAPABILITIES,
  canAccessPackSevere: true,
  canAccessPack18: true,
  canUseRating: true,
  canChooseRoleInOwnLobby: true,
};

const PRACTITIONER_CAPABILITIES: SubscriptionCapabilities = {
  ...TRAINEE_CAPABILITIES,
  canAccessAllPacks: true,
  canUseProfileBanner: true,
  canLetPlayersChooseRoles: true,
  canHighlightHostedMatch: true,
};

const ARBITER_CAPABILITIES: SubscriptionCapabilities = {
  ...PRACTITIONER_CAPABILITIES,
  canUseAnimatedProfileMedia: true,
  canCreatePrivateRooms: true,
  canChooseRoleInOtherLobbies: true,
  canCreatePacks: true,
};

export const SUBSCRIPTION_CAPABILITIES: Record<
  SubscriptionTier,
  SubscriptionCapabilities
> = {
  free: FREE_CAPABILITIES,
  trainee: TRAINEE_CAPABILITIES,
  practitioner: PRACTITIONER_CAPABILITIES,
  arbiter: ARBITER_CAPABILITIES,
};

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    tier: "trainee",
    title: "Стажер",
    shortLabel: "Базовый старт",
    monthPriceRub: 250,
    yearPriceRub: 2500,
    badge: "Тариф 1",
    features: [
      "Доступ к пакам «Особо тяжкие» и «18+»",
      "Рейтинг и ранговая прогрессия",
      "Выбор своей роли в своем лобби",
      "Уникальный бейдж подписки",
    ],
  },
  {
    tier: "practitioner",
    title: "Практик",
    shortLabel: "Самый популярный",
    monthPriceRub: 500,
    yearPriceRub: 5000,
    badge: "Тариф 2",
    isPopular: true,
    features: [
      "Все из «Стажер»",
      "Доступ ко всем пакам",
      "Баннер профиля",
      "Игроки выбирают роли сами в лобби",
      "Выделение и приоритет комнаты",
      "Уникальный бейдж подписки",
    ],
  },
  {
    tier: "arbiter",
    title: "Арбитр",
    shortLabel: "Премиум доступ",
    monthPriceRub: 800,
    yearPriceRub: 8000,
    badge: "Тариф 3",
    features: [
      "Все из «Практик»",
      "GIF-аватар и GIF-баннер",
      "Приватные комнаты с паролем",
      "Выбор роли в чужих лобби",
      "Создание паков (скоро)",
      "Уникальный бейдж подписки",
    ],
  },
];

function toTimestamp(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 10_000_000_000 ? Math.floor(value) : Math.floor(value * 1000);
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeDuration(value: unknown): SubscriptionDuration {
  if (
    value === "1_day" ||
    value === "3_days" ||
    value === "7_days" ||
    value === "1_month" ||
    value === "1_year" ||
    value === "forever"
  ) {
    return value;
  }
  return "1_month";
}

function normalizeSource(value: unknown): SubscriptionSource {
  return value === "system" ? "system" : "manual";
}

export function normalizeSubscriptionTier(value: unknown): SubscriptionTier {
  if (value === "trainee" || value === "practitioner" || value === "arbiter") {
    return value;
  }
  return "free";
}

export function hasCapability(
  tier: SubscriptionTier,
  capability: SubscriptionCapabilityKey,
): boolean {
  return !!SUBSCRIPTION_CAPABILITIES[tier][capability];
}

export function getRequiredTierForCapability(
  capability: SubscriptionCapabilityKey,
): SubscriptionTier {
  for (const tier of SUBSCRIPTION_TIER_ORDER) {
    if (SUBSCRIPTION_CAPABILITIES[tier][capability]) {
      return tier;
    }
  }
  return "free";
}

export function resolveSubscriptionView(raw: unknown): SubscriptionView {
  const value = (raw ?? {}) as Partial<SubscriptionView>;
  const sourceTier = normalizeSubscriptionTier(value.tier);
  const nowMs = Date.now();
  const startAt = toTimestamp(value.startAt);
  const endAt = toTimestamp(value.endAt);
  const isLifetime = !!value.isLifetime;
  const isActive =
    sourceTier !== "free" && (isLifetime || endAt === null || endAt > nowMs);
  const tier = isActive ? sourceTier : "free";
  return {
    tier,
    label: SUBSCRIPTION_LABELS[tier],
    startAt,
    endAt: isActive ? endAt : null,
    isLifetime: isActive ? isLifetime : false,
    source: normalizeSource(value.source),
    duration: normalizeDuration(value.duration),
    isActive,
    daysLeft:
      isActive && !isLifetime && typeof endAt === "number"
        ? Math.max(0, Math.ceil((endAt - nowMs) / (24 * 60 * 60 * 1000)))
        : null,
    capabilities: SUBSCRIPTION_CAPABILITIES[tier],
  };
}

function normalizePackText(value: string | undefined | null): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

export function getRequiredTierForPack(pack: {
  key?: string;
  title?: string;
  isAdult?: boolean;
}): SubscriptionTier {
  const key = normalizePackText(pack.key);
  const title = normalizePackText(pack.title);
  if (!key && !title) return "free";
  if (key.startsWith("custom ")) return "free";
  if (key === "classic" || title.includes("класс")) return "free";
  if (
    key.includes("template pack b") ||
    key.includes("template pack f") ||
    key.includes("hard") ||
    title.includes("особо тяж") ||
    key.includes("adult_18_plus") ||
    key.includes("adult 18 plus") ||
    title.includes("18+") ||
    !!pack.isAdult
  ) {
    return "trainee";
  }
  return "practitioner";
}

export function canAccessPack(
  tier: SubscriptionTier,
  pack: { key?: string; title?: string; isAdult?: boolean },
): boolean {
  const requiredTier = getRequiredTierForPack(pack);
  return (
    SUBSCRIPTION_TIER_ORDER.indexOf(tier) >=
    SUBSCRIPTION_TIER_ORDER.indexOf(requiredTier)
  );
}


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

export interface RawSubscriptionState {
  tier?: string | null;
  startAt?: Date | number | string | null;
  endAt?: Date | number | string | null;
  isLifetime?: boolean | null;
  source?: string | null;
  duration?: string | null;
}

export interface SubscriptionState {
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

const DAY_MS = 24 * 60 * 60 * 1000;

export const SUBSCRIPTION_TIER_ORDER: SubscriptionTier[] = [
  "free",
  "trainee",
  "practitioner",
  "arbiter",
];

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

const CAPABILITIES_BY_TIER: Record<SubscriptionTier, SubscriptionCapabilities> = {
  free: FREE_CAPABILITIES,
  trainee: TRAINEE_CAPABILITIES,
  practitioner: PRACTITIONER_CAPABILITIES,
  arbiter: ARBITER_CAPABILITIES,
};

const LABEL_BY_TIER: Record<SubscriptionTier, string> = {
  free: "Бесплатный доступ",
  trainee: "Стажер",
  practitioner: "Практик",
  arbiter: "Арбитр",
};

const DURATION_SET = new Set<SubscriptionDuration>([
  "1_day",
  "3_days",
  "7_days",
  "1_month",
  "1_year",
  "forever",
]);

function toTimestamp(value: Date | number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 10_000_000_000 ? Math.floor(value) : Math.floor(value * 1000);
  }
  if (value instanceof Date) {
    const ts = value.getTime();
    return Number.isFinite(ts) ? ts : null;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function normalizeSubscriptionTier(value: string | null | undefined): SubscriptionTier {
  if (value === "trainee" || value === "practitioner" || value === "arbiter") {
    return value;
  }
  return "free";
}

export function normalizeSubscriptionDuration(
  value: string | null | undefined,
): SubscriptionDuration {
  if (value && DURATION_SET.has(value as SubscriptionDuration)) {
    return value as SubscriptionDuration;
  }
  return "1_month";
}

export function normalizeSubscriptionSource(value: string | null | undefined): SubscriptionSource {
  return value === "system" ? "system" : "manual";
}

export function getCapabilitiesForTier(tier: SubscriptionTier): SubscriptionCapabilities {
  return CAPABILITIES_BY_TIER[tier];
}

export function tierHasAccess(
  tier: SubscriptionTier,
  requiredTier: SubscriptionTier,
): boolean {
  return (
    SUBSCRIPTION_TIER_ORDER.indexOf(tier) >= SUBSCRIPTION_TIER_ORDER.indexOf(requiredTier)
  );
}

export function hasCapability(
  stateOrTier: SubscriptionState | SubscriptionTier,
  capability: SubscriptionCapabilityKey,
): boolean {
  const tier = typeof stateOrTier === "string" ? stateOrTier : stateOrTier.tier;
  return !!CAPABILITIES_BY_TIER[tier][capability];
}

export function getMinimumTierForCapability(
  capability: SubscriptionCapabilityKey,
): SubscriptionTier {
  for (const tier of SUBSCRIPTION_TIER_ORDER) {
    if (CAPABILITIES_BY_TIER[tier][capability]) {
      return tier;
    }
  }
  return "free";
}

export function resolveSubscriptionState(
  raw: RawSubscriptionState | null | undefined,
  nowMs = Date.now(),
): SubscriptionState {
  const sourceTier = normalizeSubscriptionTier(raw?.tier ?? null);
  const sourceStartAt = toTimestamp(raw?.startAt);
  const sourceEndAt = toTimestamp(raw?.endAt);
  const sourceIsLifetime = !!raw?.isLifetime;
  const sourceDuration = normalizeSubscriptionDuration(raw?.duration ?? null);
  const sourceSource = normalizeSubscriptionSource(raw?.source ?? null);
  const isSourceTierPaid = sourceTier !== "free";
  const sourceActive =
    isSourceTierPaid &&
    (sourceIsLifetime || sourceEndAt === null || sourceEndAt > nowMs);
  const tier: SubscriptionTier = sourceActive ? sourceTier : "free";
  const isLifetime = sourceActive ? sourceIsLifetime : false;
  const endAt = sourceActive ? sourceEndAt : null;
  const daysLeft =
    sourceActive && !isLifetime && typeof endAt === "number"
      ? Math.max(0, Math.ceil((endAt - nowMs) / DAY_MS))
      : null;
  return {
    tier,
    label: LABEL_BY_TIER[tier],
    startAt: sourceStartAt,
    endAt,
    isLifetime,
    source: sourceSource,
    duration: sourceDuration,
    isActive: sourceActive,
    daysLeft,
    capabilities: CAPABILITIES_BY_TIER[tier],
  };
}

export function getDurationMs(duration: SubscriptionDuration): number | null {
  switch (duration) {
    case "1_day":
      return DAY_MS;
    case "3_days":
      return 3 * DAY_MS;
    case "7_days":
      return 7 * DAY_MS;
    case "1_month":
      return 30 * DAY_MS;
    case "1_year":
      return 365 * DAY_MS;
    case "forever":
      return null;
    default:
      return 30 * DAY_MS;
  }
}

type PackInput = {
  key?: string | null;
  title?: string | null;
  isAdult?: boolean | null;
};

function normalizeLabel(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

export function getRequiredTierForCasePack(pack: PackInput): SubscriptionTier {
  const key = normalizeLabel(pack.key);
  const title = normalizeLabel(pack.title);
  if (!key && !title) return "free";
  if (key === "classic" || title.includes("класс")) return "free";
  if (
    key.includes("template pack b") ||
    key.includes("template pack f") ||
    key.includes("hard") ||
    title.includes("особо тяж") ||
    key.includes("adult_18_plus") ||
    key.includes("adult 18 plus") ||
    title.includes("18+") ||
    pack.isAdult
  ) {
    return "trainee";
  }
  return "practitioner";
}

export function canAccessCasePack(tier: SubscriptionTier, pack: PackInput): boolean {
  const requiredTier = getRequiredTierForCasePack(pack);
  return tierHasAccess(tier, requiredTier);
}


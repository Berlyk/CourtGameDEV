import crypto from "node:crypto";
import { pool } from "@workspace/db";
import {
  canAccessCasePack,
  getCapabilitiesForTier,
  getDurationMs,
  normalizeSubscriptionDuration,
  normalizeSubscriptionSource,
  normalizeSubscriptionTier,
  resolveSubscriptionState,
  type SubscriptionCapabilityKey,
  type SubscriptionDuration,
  type SubscriptionSource,
  type SubscriptionTier,
} from "./subscriptions.js";

export type PreferredRole =
  | "judge"
  | "plaintiff"
  | "defendant"
  | "defenseLawyer"
  | "prosecutor"
  | "plaintiffLawyer";

export interface AuthUserPublic {
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
  preferredRole?: PreferredRole;
  adminRole?: AdminStaffRole | null;
  ban?: UserBanView;
}

export interface UserRoleStats {
  roleKey: string;
  matches: number;
  wins: number;
  winRate: number;
}

export interface UserStatsSummary {
  totalMatches: number;
  totalWins: number;
  totalWinRate: number;
  roleStats: UserRoleStats[];
}

export interface UserRankView {
  key: string;
  title: string;
  points: number;
  level: number;
  minPoints: number;
  nextPoints?: number;
  nextTitle?: string;
  progressCurrent: number;
  progressTarget: number;
}

export interface UserBadgeView {
  key: string;
  title: string;
  description: string;
  active: boolean;
  category?: "rank" | "earned" | "manual" | "subscription";
  progressCurrent?: number;
  progressTarget?: number;
  progressLabel?: string;
}

export interface UserSubscriptionView {
  tier: SubscriptionTier;
  label: string;
  startAt: number | null;
  endAt: number | null;
  isLifetime: boolean;
  source: SubscriptionSource;
  duration: SubscriptionDuration;
  isActive: boolean;
  daysLeft: number | null;
  capabilities: ReturnType<typeof getCapabilitiesForTier>;
}

export interface UserBanView {
  isBanned: boolean;
  isPermanent: boolean;
  bannedUntil: number | null;
  reason?: string;
}

export type AdminStaffRole = "administrator" | "moderator";

export interface PromoApplyResult {
  message: string;
  subscription: UserSubscriptionView;
  rewards: Array<{
    type: "subscription" | "badge";
    label: string;
  }>;
}

export interface AdminPromoCodeView {
  code: string;
  promoKind: "subscription" | "badge";
  badgeKey: string | null;
  badgeKeys: string[];
  tier: SubscriptionTier;
  duration: SubscriptionDuration;
  source: SubscriptionSource;
  isActive: boolean;
  maxUses: number | null;
  usedCount: number;
  startsAt: string | null;
  expiresAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface AdminUserLookupView {
  id: string;
  login: string;
  email: string;
  nickname: string;
  createdAt: number;
  adminRole: AdminStaffRole | null;
  subscription: UserSubscriptionView;
  ban: UserBanView;
}

export interface UserMatchParticipantView {
  userId?: string;
  nickname: string;
  roleKey: string;
  roleTitle: string;
  isSelf: boolean;
}

export interface UserMatchHistoryView {
  roomCode: string;
  verdict: string;
  expectedVerdict: string;
  roleKey: string;
  roleTitle: string;
  didWin: boolean;
  finishedAt: number;
  participants: UserMatchParticipantView[];
}

export interface AuthUserPublicProfile {
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
  rank: UserRankView;
  stats: UserStatsSummary;
  badges: UserBadgeView[];
  selectedBadgeKey?: string;
  preferredRole?: PreferredRole;
  recentMatches: UserMatchHistoryView[];
  subscription: UserSubscriptionView;
}

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const RANK_DEFINITIONS: Array<{
  key: string;
  title: string;
  minPoints: number;
}> = [
  { key: "novice", title: "НОВИЧОК", minPoints: 0 },
  { key: "debater", title: "СПОРЩИК", minPoints: 15 },
  { key: "orator", title: "ОРАТОР", minPoints: 30 },
  { key: "strategist", title: "СТРАТЕГ", minPoints: 60 },
  { key: "master", title: "МАСТЕР", minPoints: 100 },
  { key: "verdict", title: "ВЕРДИКТ", minPoints: 150 },
];

const ROLE_BADGE_META: Record<
  string,
  { title: string; description: string }
> = {
  plaintiff: {
    title: "Истец",
    description: "50 побед за роль истца.",
  },
  defendant: {
    title: "Ответчик",
    description: "50 побед за роль ответчика.",
  },
  plaintiffLawyer: {
    title: "Адвокат истца",
    description: "50 побед за роль адвоката истца.",
  },
  defenseLawyer: {
    title: "Адвокат",
    description: "50 побед за роль адвоката ответчика.",
  },
  prosecutor: {
    title: "Прокурор",
    description: "50 побед за роль прокурора.",
  },
  judge: {
    title: "Судья",
    description: "50 побед за роль судьи.",
  },
};
const MANUAL_BADGE_META: Record<
  string,
  { title: string; description: string }
> = {
  media: {
    title: "Медиа",
    description: "За медиа-статус и вклад в контент по CourtGame.",
  },
  creator: {
    title: "Создатель",
    description: "За разработку игры.",
  },
  host: {
    title: "Ведущий",
    description: "За проведение официальных матчей.",
  },
  innovator: {
    title: "Новатор",
    description: "Более 5 реализованных идей игрока.",
  },
  moderator: {
    title: "Модератор",
    description: "Игрок является модератором.",
  },
  admin: {
    title: "Администратор",
    description: "Игрок является администратором.",
  },
};

const SUBSCRIPTION_BADGE_META: Record<
  Exclude<SubscriptionTier, "free">,
  { key: string; title: string; description: string }
> = {
  trainee: {
    key: "sub_trainee",
    title: "Стажер",
    description: "Выдается при активной подписке «Стажер».",
  },
  practitioner: {
    key: "sub_practitioner",
    title: "Практик",
    description: "Выдается при активной подписке «Практик».",
  },
  arbiter: {
    key: "sub_arbiter",
    title: "Арбитр",
    description: "Выдается при активной подписке «Арбитр».",
  },
};
const BADGE_PROMO_ALLOWED_KEYS = new Set<string>([
  "winner",
  "legend",
  ...Object.keys(MANUAL_BADGE_META),
  ...Object.keys(ROLE_BADGE_META).map((key) => `role_${key}`),
  ...Object.values(SUBSCRIPTION_BADGE_META).map((entry) => entry.key),
]);
const PROTECTED_OWNER_LOGIN = "berly";

function isProtectedOwnerLogin(loginRaw: string | null | undefined): boolean {
  return String(loginRaw ?? "").trim().toLowerCase() === PROTECTED_OWNER_LOGIN;
}

function getBadgeTitleForPromoReward(badgeKeyRaw: string): string {
  const badgeKey = String(badgeKeyRaw ?? "").trim();
  if (!badgeKey) return "Бейдж";
  if (badgeKey === "winner") return "Победитель";
  if (badgeKey === "legend") return "Легенда";
  if (MANUAL_BADGE_META[badgeKey]) return MANUAL_BADGE_META[badgeKey].title;
  if (badgeKey.startsWith("role_")) {
    const roleKey = badgeKey.slice("role_".length);
    if (ROLE_BADGE_META[roleKey]) return ROLE_BADGE_META[roleKey].title;
  }
  const subMeta = Object.values(SUBSCRIPTION_BADGE_META).find((entry) => entry.key === badgeKey);
  if (subMeta) return subMeta.title;
  return badgeKey;
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

let initPromise: Promise<void> | null = null;

function normalizeLogin(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeNickname(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeAdminStaffRole(value: string | null | undefined): AdminStaffRole | null {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  if (normalized === "administrator") return "administrator";
  if (normalized === "moderator") return "moderator";
  return null;
}

function normalizeBirthDateInput(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new Error("Укажите корректную дату рождения.");
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error("Укажите корректную дату рождения.");
  }
  const now = new Date();
  if (parsed.getTime() > now.getTime()) {
    throw new Error("Укажите корректную дату рождения.");
  }
  let age = now.getUTCFullYear() - year;
  const monthDiff = now.getUTCMonth() - (month - 1);
  const dayDiff = now.getUTCDate() - day;
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }
  if (age < 13) {
    throw new Error("Игрок должен быть не младше 13 лет.");
  }
  if (age > 120) {
    throw new Error("Укажите корректную дату рождения.");
  }
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

function verifyPassword(password: string, salt: string, hashHex: string): boolean {
  const calculated = Buffer.from(hashPassword(password, salt), "hex");
  const expected = Buffer.from(hashHex, "hex");
  if (calculated.length !== expected.length) return false;
  return crypto.timingSafeEqual(calculated, expected);
}

function normalizeIpAddress(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 120);
}

function toPublicUser(row: {
  id: string;
  login: string;
  email: string;
  nickname: string;
  avatar: string | null;
  banner: string | null;
  bio: string | null;
  gender: string | null;
  birth_date: Date | null;
  hide_age: boolean | null;
  selected_badge_key?: string | null;
  preferred_role?: string | null;
  admin_role?: string | null;
  ban_until?: Date | null;
  ban_permanent?: boolean | null;
  ban_reason?: string | null;
  created_at: Date;
}, banOverride?: UserBanView): AuthUserPublic {
  const hasBanFields =
    banOverride ||
    row.ban_until !== undefined ||
    row.ban_permanent !== undefined ||
    row.ban_reason !== undefined;
  const ban = banOverride
    ? banOverride
    : hasBanFields
      ? resolveBanView({
          ban_until: row.ban_until ?? null,
          ban_permanent: row.ban_permanent ?? false,
          ban_reason: row.ban_reason ?? null,
        })
      : undefined;
  return {
    id: row.id,
    login: row.login,
    email: row.email,
    nickname: row.nickname,
    avatar: row.avatar ?? undefined,
    banner: row.banner ?? undefined,
    bio: row.bio ?? undefined,
    gender:
      row.gender === "male" || row.gender === "female" || row.gender === "other"
        ? row.gender
        : undefined,
    birthDate: row.birth_date ? row.birth_date.toISOString().slice(0, 10) : undefined,
    hideAge: !!row.hide_age,
    createdAt: row.created_at.getTime(),
    selectedBadgeKey: row.selected_badge_key ?? undefined,
    preferredRole:
      row.preferred_role === "judge" ||
      row.preferred_role === "plaintiff" ||
      row.preferred_role === "defendant" ||
      row.preferred_role === "defenseLawyer" ||
      row.preferred_role === "prosecutor" ||
      row.preferred_role === "plaintiffLawyer"
        ? row.preferred_role
        : undefined,
    adminRole: normalizeAdminStaffRole(row.admin_role),
    ban,
  };
}

function computeAge(date: Date | null): number | undefined {
  if (!date) return undefined;
  const now = new Date();
  let age = now.getUTCFullYear() - date.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - date.getUTCMonth();
  const dayDiff = now.getUTCDate() - date.getUTCDate();
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }
  return age >= 0 ? age : undefined;
}

type SubscriptionRowShape = {
  subscription_tier?: string | null;
  subscription_start_at?: Date | null;
  subscription_end_at?: Date | null;
  subscription_is_lifetime?: boolean | null;
  subscription_source?: string | null;
  subscription_duration?: string | null;
};

function resolveSubscriptionView(row: SubscriptionRowShape): UserSubscriptionView {
  const resolved = resolveSubscriptionState({
    tier: row.subscription_tier ?? "free",
    startAt: row.subscription_start_at ?? null,
    endAt: row.subscription_end_at ?? null,
    isLifetime: row.subscription_is_lifetime ?? false,
    source: row.subscription_source ?? "manual",
    duration: row.subscription_duration ?? "1_month",
  });
  return {
    tier: resolved.tier,
    label: resolved.label,
    startAt: resolved.startAt,
    endAt: resolved.endAt,
    isLifetime: resolved.isLifetime,
    source: resolved.source,
    duration: resolved.duration,
    isActive: resolved.isActive,
    daysLeft: resolved.daysLeft,
    capabilities: resolved.capabilities,
  };
}

function toPublicProfile(row: {
  id: string;
  nickname: string;
  avatar: string | null;
  banner: string | null;
  bio: string | null;
  gender: string | null;
  birth_date: Date | null;
  hide_age: boolean | null;
  preferred_role?: string | null;
  created_at: Date;
}): AuthUserPublicProfile {
  const age = computeAge(row.birth_date);
  return {
    id: row.id,
    nickname: row.nickname,
    avatar: row.avatar ?? undefined,
    banner: row.banner ?? undefined,
    bio: row.bio ?? undefined,
    gender:
      row.gender === "male" || row.gender === "female" || row.gender === "other"
        ? row.gender
        : undefined,
    birthDate: row.birth_date ? row.birth_date.toISOString().slice(0, 10) : undefined,
    hideAge: !!row.hide_age,
    age: row.hide_age ? undefined : age,
    createdAt: row.created_at.getTime(),
    preferredRole:
      row.preferred_role === "judge" ||
      row.preferred_role === "plaintiff" ||
      row.preferred_role === "defendant" ||
      row.preferred_role === "defenseLawyer" ||
      row.preferred_role === "prosecutor" ||
      row.preferred_role === "plaintiffLawyer"
        ? row.preferred_role
        : undefined,
    rank: {
      key: "novice",
      title: "НОВИЧОК",
      points: 0,
      level: 0,
      minPoints: 0,
      nextPoints: 15,
      nextTitle: "СПОРЩИК",
      progressCurrent: 0,
      progressTarget: 15,
    },
  };
}

function getRankByPoints(rawPoints: number): UserRankView {
  const points = Math.max(0, Math.floor(Number.isFinite(rawPoints) ? rawPoints : 0));
  let levelIndex = 0;
  for (let i = 0; i < RANK_DEFINITIONS.length; i += 1) {
    if (points >= RANK_DEFINITIONS[i].minPoints) {
      levelIndex = i;
    } else {
      break;
    }
  }
  const current = RANK_DEFINITIONS[levelIndex];
  const next = RANK_DEFINITIONS[levelIndex + 1];
  return {
    key: current.key,
    title: current.title,
    points,
    level: levelIndex,
    minPoints: current.minPoints,
    nextPoints: next?.minPoints,
    nextTitle: next?.title,
    progressCurrent: Math.max(0, points - current.minPoints),
    progressTarget: Math.max(1, (next?.minPoints ?? current.minPoints + 1) - current.minPoints),
  };
}

async function ensureTables(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS auth_users (
          id UUID PRIMARY KEY,
          login TEXT NOT NULL,
          login_normalized TEXT NOT NULL UNIQUE,
          email TEXT NOT NULL,
          email_normalized TEXT NOT NULL UNIQUE,
          nickname TEXT NOT NULL,
          nickname_normalized TEXT NOT NULL UNIQUE,
          password_salt TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          accepted_rules_at TIMESTAMPTZ NOT NULL,
          avatar TEXT,
          banner TEXT,
          bio TEXT,
          gender TEXT,
          birth_date DATE,
          hide_age BOOLEAN NOT NULL DEFAULT FALSE,
          preferred_role TEXT,
          ban_until TIMESTAMPTZ,
          ban_permanent BOOLEAN NOT NULL DEFAULT FALSE,
          ban_reason TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await pool.query(`
        ALTER TABLE auth_users
          ADD COLUMN IF NOT EXISTS banner TEXT;
      `);
      await pool.query(`
        ALTER TABLE auth_users
          ADD COLUMN IF NOT EXISTS bio TEXT;
      `);
      await pool.query(`
        ALTER TABLE auth_users
          ADD COLUMN IF NOT EXISTS gender TEXT;
      `);
      await pool.query(`
        ALTER TABLE auth_users
          ADD COLUMN IF NOT EXISTS birth_date DATE;
      `);
      await pool.query(`
        ALTER TABLE auth_users
          ADD COLUMN IF NOT EXISTS hide_age BOOLEAN NOT NULL DEFAULT FALSE;
      `);
      await pool.query(`
        ALTER TABLE auth_users
          ADD COLUMN IF NOT EXISTS selected_badge_key TEXT;
      `);
      await pool.query(`
        ALTER TABLE auth_users
          ADD COLUMN IF NOT EXISTS preferred_role TEXT;
      `);
      await pool.query(`
        ALTER TABLE auth_users
          ADD COLUMN IF NOT EXISTS ban_until TIMESTAMPTZ;
      `);
      await pool.query(`
        ALTER TABLE auth_users
          ADD COLUMN IF NOT EXISTS ban_permanent BOOLEAN NOT NULL DEFAULT FALSE;
      `);
      await pool.query(`
        ALTER TABLE auth_users
          ADD COLUMN IF NOT EXISTS ban_reason TEXT;
      `);
      await pool.query(`
        ALTER TABLE auth_users
          ADD COLUMN IF NOT EXISTS admin_role TEXT;
      `);
      await pool.query(`
        ALTER TABLE auth_users
          ADD COLUMN IF NOT EXISTS subscription_tier TEXT NOT NULL DEFAULT 'free';
      `);
      await pool.query(`
        ALTER TABLE auth_users
          ADD COLUMN IF NOT EXISTS subscription_start_at TIMESTAMPTZ;
      `);
      await pool.query(`
        ALTER TABLE auth_users
          ADD COLUMN IF NOT EXISTS subscription_end_at TIMESTAMPTZ;
      `);
      await pool.query(`
        ALTER TABLE auth_users
          ADD COLUMN IF NOT EXISTS subscription_is_lifetime BOOLEAN NOT NULL DEFAULT FALSE;
      `);
      await pool.query(`
        ALTER TABLE auth_users
          ADD COLUMN IF NOT EXISTS subscription_source TEXT NOT NULL DEFAULT 'manual';
      `);
      await pool.query(`
        ALTER TABLE auth_users
          ADD COLUMN IF NOT EXISTS subscription_duration TEXT NOT NULL DEFAULT '1_month';
      `);
      await pool.query(`
        ALTER TABLE auth_users
          ALTER COLUMN avatar TYPE TEXT,
          ALTER COLUMN banner TYPE TEXT;
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS auth_sessions (
          token UUID PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
          ip_address TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await pool.query(`
        ALTER TABLE auth_sessions
          ADD COLUMN IF NOT EXISTS ip_address TEXT;
      `);

      await pool.query(`
        CREATE INDEX IF NOT EXISTS auth_sessions_user_id_idx
        ON auth_sessions(user_id);
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS auth_sessions_ip_idx
        ON auth_sessions(ip_address);
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS auth_user_ips (
          user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
          ip_address TEXT NOT NULL,
          first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (user_id, ip_address)
        );
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS auth_user_ips_ip_idx
        ON auth_user_ips(ip_address);
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS auth_ip_bans (
          ip_address TEXT PRIMARY KEY,
          source_user_id UUID REFERENCES auth_users(id) ON DELETE SET NULL,
          ban_until TIMESTAMPTZ,
          ban_permanent BOOLEAN NOT NULL DEFAULT FALSE,
          ban_reason TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
      await pool.query(`
        ALTER TABLE auth_ip_bans
          ADD COLUMN IF NOT EXISTS source_user_id UUID REFERENCES auth_users(id) ON DELETE SET NULL;
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS auth_ip_bans_source_user_idx
        ON auth_ip_bans(source_user_id);
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS auth_user_role_stats (
          user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
          role_key TEXT NOT NULL,
          matches INTEGER NOT NULL DEFAULT 0,
          wins INTEGER NOT NULL DEFAULT 0,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (user_id, role_key)
        );
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS auth_user_ranks (
          user_id UUID PRIMARY KEY REFERENCES auth_users(id) ON DELETE CASCADE,
          points INTEGER NOT NULL DEFAULT 0,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS auth_user_badges (
          user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
          badge_key TEXT NOT NULL,
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          granted_by UUID,
          PRIMARY KEY (user_id, badge_key)
        );
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS auth_user_match_history (
          id UUID PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
          room_code TEXT NOT NULL,
          verdict TEXT NOT NULL,
          expected_verdict TEXT NOT NULL,
          role_key TEXT NOT NULL,
          role_title TEXT NOT NULL,
          did_win BOOLEAN NOT NULL DEFAULT FALSE,
          participants JSONB NOT NULL,
          finished_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS auth_user_match_history_user_finished_idx
        ON auth_user_match_history(user_id, finished_at DESC);
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS auth_subscription_promocodes (
          code_normalized TEXT PRIMARY KEY,
          code_display TEXT NOT NULL,
          promo_kind TEXT NOT NULL DEFAULT 'subscription',
          badge_key TEXT,
          badge_keys JSONB NOT NULL DEFAULT '[]'::jsonb,
          tier TEXT NOT NULL DEFAULT 'free',
          duration TEXT NOT NULL DEFAULT '1_month',
          source TEXT NOT NULL DEFAULT 'system',
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          max_uses INTEGER,
          used_count INTEGER NOT NULL DEFAULT 0,
          starts_at TIMESTAMPTZ,
          expires_at TIMESTAMPTZ,
          created_by UUID,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
      await pool.query(`
        ALTER TABLE auth_subscription_promocodes
          ADD COLUMN IF NOT EXISTS promo_kind TEXT NOT NULL DEFAULT 'subscription';
      `);
      await pool.query(`
        ALTER TABLE auth_subscription_promocodes
          ADD COLUMN IF NOT EXISTS badge_key TEXT;
      `);
      await pool.query(`
        ALTER TABLE auth_subscription_promocodes
          ADD COLUMN IF NOT EXISTS badge_keys JSONB NOT NULL DEFAULT '[]'::jsonb;
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS auth_user_promo_redemptions (
          user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
          code_normalized TEXT NOT NULL REFERENCES auth_subscription_promocodes(code_normalized) ON DELETE CASCADE,
          redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (user_id, code_normalized)
        );
      `);
    })();
  }
  return initPromise;
}

async function cleanupSessions(now = Date.now()) {
  await ensureTables();
  const threshold = new Date(now - SESSION_TTL_MS);
  await pool.query("DELETE FROM auth_sessions WHERE created_at < $1", [threshold]);
}

export async function registerAccount(input: {
  login: string;
  email: string;
  password: string;
  nickname?: string;
  clientIp?: string | null;
}): Promise<{ user: AuthUserPublic; token: string }> {
  await cleanupSessions();
  const clientIp = normalizeIpAddress(input.clientIp);
  if (clientIp) {
    const ipBan = await getIpBanViewByAddress(clientIp);
    if (ipBan.isBanned) {
      throw new Error(formatBanMessage(ipBan));
    }
  }

  const login = input.login.trim();
  const email = input.email.trim();
  const nickname = (input.nickname?.trim() || login).slice(0, 20);
  const loginNormalized = normalizeLogin(login);
  const emailNormalized = normalizeEmail(email);
  const nicknameNormalized = normalizeNickname(nickname);

  const conflict = await pool.query<{ login_normalized: string; email_normalized: string; nickname_normalized: string }>(
    `
      SELECT login_normalized, email_normalized, nickname_normalized
      FROM auth_users
      WHERE login_normalized = $1
         OR email_normalized = $2
         OR nickname_normalized = $3
      LIMIT 1
    `,
    [loginNormalized, emailNormalized, nicknameNormalized],
  );

  if (conflict.rowCount) {
    const row = conflict.rows[0];
    if (row.login_normalized === loginNormalized) {
      throw new Error("Логин уже занят.");
    }
    if (row.email_normalized === emailNormalized) {
      throw new Error("Эта почта уже используется.");
    }
    if (row.nickname_normalized === nicknameNormalized) {
      throw new Error("Никнейм уже занят.");
    }
  }

  const userId = crypto.randomUUID();
  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = hashPassword(input.password, salt);
  const acceptedRulesAt = new Date();

  let userResult;
  try {
    userResult = await pool.query<{
    id: string;
    login: string;
    email: string;
    nickname: string;
    avatar: string | null;
    banner: string | null;
    bio: string | null;
    gender: string | null;
    birth_date: Date | null;
    hide_age: boolean | null;
    selected_badge_key: string | null;
    preferred_role: string | null;
    admin_role: string | null;
    created_at: Date;
  }>(
    `
      INSERT INTO auth_users (
        id,
        login,
        login_normalized,
        email,
        email_normalized,
        nickname,
        nickname_normalized,
        password_salt,
        password_hash,
        accepted_rules_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING id, login, email, nickname, avatar, banner, bio, gender, birth_date, hide_age, selected_badge_key, preferred_role, admin_role, created_at
    `,
    [
      userId,
      login,
      loginNormalized,
      email,
      emailNormalized,
      nickname,
      nicknameNormalized,
      salt,
      passwordHash,
      acceptedRulesAt,
    ],
  );
  } catch (error: any) {
    if (error?.code === "23505") {
      const detail = String(error?.detail ?? "").toLowerCase();
      const constraint = String(error?.constraint ?? "").toLowerCase();
      if (detail.includes("email_normalized") || constraint.includes("email_normalized")) {
        throw new Error("Эта почта уже используется.");
      }
      if (detail.includes("login_normalized") || constraint.includes("login_normalized")) {
        throw new Error("Логин уже занят.");
      }
      if (detail.includes("nickname_normalized") || constraint.includes("nickname_normalized")) {
        throw new Error("Никнейм уже занят.");
      }
    }
    throw error;
  }

  const token = crypto.randomUUID();
  await pool.query(
    `INSERT INTO auth_sessions (token, user_id, ip_address, created_at) VALUES ($1, $2, $3, NOW())`,
    [token, userId, clientIp],
  );
  await touchUserIpRecord(userId, clientIp);

  return { user: toPublicUser(userResult.rows[0]), token };
}

export async function loginAccount(input: {
  loginOrEmail: string;
  password: string;
  clientIp?: string | null;
}): Promise<{ user: AuthUserPublic; token: string }> {
  await cleanupSessions();
  const clientIp = normalizeIpAddress(input.clientIp);

  const needle = input.loginOrEmail.trim().toLowerCase();
  const result = await pool.query<{
    id: string;
    login: string;
    email: string;
    nickname: string;
    avatar: string | null;
    banner: string | null;
    bio: string | null;
    gender: string | null;
    birth_date: Date | null;
    hide_age: boolean | null;
    selected_badge_key: string | null;
    preferred_role: string | null;
    admin_role: string | null;
    created_at: Date;
    password_salt: string;
    password_hash: string;
    ban_until: Date | null;
    ban_permanent: boolean | null;
    ban_reason: string | null;
  }>(
    `
      SELECT id, login, email, nickname, avatar, banner, bio, gender, birth_date, hide_age, selected_badge_key, preferred_role, admin_role, created_at, password_salt, password_hash, ban_until, ban_permanent, ban_reason
      FROM auth_users
      WHERE login_normalized = $1 OR email_normalized = $1
      LIMIT 1
    `,
    [needle],
  );

  if (!result.rowCount) {
    throw new Error("Неверный логин/email или пароль.");
  }

  const row = result.rows[0];
  if (!verifyPassword(input.password, row.password_salt, row.password_hash)) {
    throw new Error("Неверный логин/email или пароль.");
  }
  const userBan = resolveBanView(row);
  const ipBan = isProtectedOwnerLogin(row.login)
    ? {
        isBanned: false,
        isPermanent: false,
        bannedUntil: null,
        reason: null,
      }
    : await getIpBanViewByAddress(clientIp);
  const effectiveBan = mergeBanViews(userBan, ipBan);

  const token = crypto.randomUUID();
  await pool.query(
    `INSERT INTO auth_sessions (token, user_id, ip_address, created_at) VALUES ($1, $2, $3, NOW())`,
    [token, row.id, clientIp],
  );
  await touchUserIpRecord(row.id, clientIp);

  return { user: toPublicUser(row, effectiveBan), token };
}

export async function getUserByToken(
  token: string,
  clientIpRaw?: string | null,
): Promise<AuthUserPublic | null> {
  await cleanupSessions();
  const clientIp = normalizeIpAddress(clientIpRaw);

  const result = await pool.query<{
    id: string;
    login: string;
    email: string;
    nickname: string;
    avatar: string | null;
    banner: string | null;
    bio: string | null;
    gender: string | null;
    birth_date: Date | null;
    hide_age: boolean | null;
    selected_badge_key: string | null;
    preferred_role: string | null;
    admin_role: string | null;
    created_at: Date;
    ban_until: Date | null;
    ban_permanent: boolean | null;
    ban_reason: string | null;
  }>(
    `
      SELECT u.id, u.login, u.email, u.nickname, u.avatar, u.banner, u.bio, u.gender, u.birth_date, u.hide_age, u.selected_badge_key, u.preferred_role, u.admin_role, u.created_at, u.ban_until, u.ban_permanent, u.ban_reason
      FROM auth_sessions s
      JOIN auth_users u ON u.id = s.user_id
      WHERE s.token = $1
      LIMIT 1
    `,
    [token],
  );

  if (!result.rowCount) return null;
  const row = result.rows[0];
  await touchUserIpRecord(row.id, clientIp);
  const userBan = resolveBanView(row);
  const ipBan = isProtectedOwnerLogin(row.login)
    ? {
        isBanned: false,
        isPermanent: false,
        bannedUntil: null,
        reason: null,
      }
    : await getIpBanViewByAddress(clientIp);
  const effectiveBan = mergeBanViews(userBan, ipBan);
  return toPublicUser(row, effectiveBan);
}

export async function logoutByToken(token: string): Promise<void> {
  await ensureTables();
  await pool.query(`DELETE FROM auth_sessions WHERE token = $1`, [token]);
}

export async function updateProfileByToken(
  token: string,
  profile: {
    nickname?: string;
    avatar?: string | null;
    banner?: string | null;
    bio?: string | null;
    gender?: "male" | "female" | "other" | null;
    birthDate?: string | null;
    hideAge?: boolean;
    selectedBadgeKey?: string | null;
    preferredRole?: PreferredRole | null;
  },
): Promise<AuthUserPublic | null> {
  await cleanupSessions();

  const sessionResult = await pool.query<{ user_id: string }>(
    `SELECT user_id FROM auth_sessions WHERE token = $1 LIMIT 1`,
    [token],
  );
  if (!sessionResult.rowCount) return null;
  const userId = sessionResult.rows[0].user_id;

  if (typeof profile.nickname === "string") {
    const nextNickname = profile.nickname.trim().slice(0, 20);
    if (nextNickname) {
      const nextNormalized = normalizeNickname(nextNickname);
      const conflict = await pool.query(
        `
          SELECT 1
          FROM auth_users
          WHERE id <> $1 AND nickname_normalized = $2
          LIMIT 1
        `,
        [userId, nextNormalized],
      );
      if (conflict.rowCount) {
        throw new Error("Никнейм уже занят.");
      }

      await pool.query(
        `
          UPDATE auth_users
          SET nickname = $1, nickname_normalized = $2
          WHERE id = $3
        `,
        [nextNickname, nextNormalized, userId],
      );
    }
  }

  if (profile.avatar !== undefined) {
    await pool.query(
      `
        UPDATE auth_users
        SET avatar = $1
        WHERE id = $2
      `,
      [profile.avatar || null, userId],
    );
  }

  if (profile.banner !== undefined) {
    await pool.query(
      `
        UPDATE auth_users
        SET banner = $1
        WHERE id = $2
      `,
      [profile.banner || null, userId],
    );
  }

  if (profile.bio !== undefined) {
    const bio = typeof profile.bio === "string" ? profile.bio.trim().slice(0, 500) : null;
    await pool.query(`UPDATE auth_users SET bio = $1 WHERE id = $2`, [bio || null, userId]);
  }

  if (profile.gender !== undefined) {
    const gender =
      profile.gender === "male" || profile.gender === "female" || profile.gender === "other"
        ? profile.gender
        : null;
    await pool.query(`UPDATE auth_users SET gender = $1 WHERE id = $2`, [gender, userId]);
  }

  if (profile.birthDate !== undefined) {
    const birthDate = normalizeBirthDateInput(profile.birthDate);
    await pool.query(`UPDATE auth_users SET birth_date = $1::date WHERE id = $2`, [birthDate, userId]);
  }

  if (profile.hideAge !== undefined) {
    await pool.query(`UPDATE auth_users SET hide_age = $1 WHERE id = $2`, [
      !!profile.hideAge,
      userId,
    ]);
  }

  if (profile.selectedBadgeKey !== undefined) {
    const selectedBadgeKey =
      typeof profile.selectedBadgeKey === "string" && profile.selectedBadgeKey.trim()
        ? profile.selectedBadgeKey.trim()
        : null;
    if (selectedBadgeKey) {
      const userMeta = await pool.query<{
        login: string;
        created_at: Date;
        selected_badge_key: string | null;
        subscription_tier: string | null;
        subscription_start_at: Date | null;
        subscription_end_at: Date | null;
        subscription_is_lifetime: boolean | null;
        subscription_source: string | null;
        subscription_duration: string | null;
      }>(
        `
          SELECT
            login,
            created_at,
            selected_badge_key,
            subscription_tier,
            subscription_start_at,
            subscription_end_at,
            subscription_is_lifetime,
            subscription_source,
            subscription_duration
          FROM auth_users
          WHERE id = $1
          LIMIT 1
        `,
        [userId],
      );
      if (userMeta.rowCount) {
        const [stats, rank, manualBadgeMap] = await Promise.all([
          getRoleStatsByUserId(userId),
          getRankByUserId(userId),
          getManualBadgeMap(userId),
        ]);
        const subscription = resolveSubscriptionView(userMeta.rows[0]);
        const available = new Set(
          buildBadgeList({
            user: {
              id: userId,
              login: userMeta.rows[0].login,
              created_at: userMeta.rows[0].created_at,
            },
            rank,
            stats,
            manualBadgeMap,
            subscription,
          })
            .filter((badge) => badge.active)
            .map((badge) => badge.key),
        );
        const currentSelectedBadgeKey =
          typeof userMeta.rows[0].selected_badge_key === "string"
            ? userMeta.rows[0].selected_badge_key.trim()
            : "";
        if (!available.has(selectedBadgeKey) && selectedBadgeKey !== currentSelectedBadgeKey) {
          throw new Error("Бейдж недоступен для выбора.");
        }
      }
    }
    await pool.query(`UPDATE auth_users SET selected_badge_key = $1 WHERE id = $2`, [
      selectedBadgeKey,
      userId,
    ]);
  }

  if (profile.preferredRole !== undefined) {
    const preferredRole =
      profile.preferredRole === "judge" ||
      profile.preferredRole === "plaintiff" ||
      profile.preferredRole === "defendant" ||
      profile.preferredRole === "defenseLawyer" ||
      profile.preferredRole === "prosecutor" ||
      profile.preferredRole === "plaintiffLawyer"
        ? profile.preferredRole
        : null;
    await pool.query(`UPDATE auth_users SET preferred_role = $1 WHERE id = $2`, [
      preferredRole,
      userId,
    ]);
  }

  const userResult = await pool.query<{
    id: string;
    login: string;
    email: string;
    nickname: string;
    avatar: string | null;
    banner: string | null;
    bio: string | null;
    gender: string | null;
    birth_date: Date | null;
    hide_age: boolean | null;
    selected_badge_key: string | null;
    preferred_role: string | null;
    created_at: Date;
  }>(
    `
      SELECT id, login, email, nickname, avatar, banner, bio, gender, birth_date, hide_age, selected_badge_key, preferred_role, admin_role, created_at
      FROM auth_users
      WHERE id = $1
      LIMIT 1
    `,
    [userId],
  );

  if (!userResult.rowCount) return null;
  return toPublicUser(userResult.rows[0]);
}

async function getUserWithSecretsByToken(token: string): Promise<{
  userId: string;
  email: string;
  passwordSalt: string;
  passwordHash: string;
} | null> {
  await cleanupSessions();
  const result = await pool.query<{
    user_id: string;
    email: string;
    password_salt: string;
    password_hash: string;
    ban_until: Date | null;
    ban_permanent: boolean | null;
    ban_reason: string | null;
  }>(
    `
      SELECT s.user_id, u.email, u.password_salt, u.password_hash, u.ban_until, u.ban_permanent, u.ban_reason
      FROM auth_sessions s
      JOIN auth_users u ON u.id = s.user_id
      WHERE s.token = $1
      LIMIT 1
    `,
    [token],
  );
  if (!result.rowCount) return null;
  const row = result.rows[0];
  const ban = resolveBanView({
    ban_until: row.ban_until,
    ban_permanent: row.ban_permanent,
    ban_reason: row.ban_reason,
  });
  if (ban.isBanned) {
    return null;
  }
  return {
    userId: row.user_id,
    email: row.email,
    passwordSalt: row.password_salt,
    passwordHash: row.password_hash,
  };
}

export async function changePasswordByToken(
  token: string,
  currentPassword: string,
  nextPassword: string,
): Promise<AuthUserPublic | null> {
  const data = await getUserWithSecretsByToken(token);
  if (!data) return null;

  if (!verifyPassword(currentPassword, data.passwordSalt, data.passwordHash)) {
    throw new Error("Текущий пароль введен неверно.");
  }

  const salt = crypto.randomBytes(16).toString("hex");
  const hash = hashPassword(nextPassword, salt);
  await pool.query(
    `UPDATE auth_users SET password_salt = $1, password_hash = $2 WHERE id = $3`,
    [salt, hash, data.userId],
  );

  return getUserByToken(token);
}

export async function changeEmailByToken(
  token: string,
  currentPassword: string,
  nextEmail: string,
): Promise<AuthUserPublic | null> {
  const data = await getUserWithSecretsByToken(token);
  if (!data) return null;

  if (!verifyPassword(currentPassword, data.passwordSalt, data.passwordHash)) {
    throw new Error("Текущий пароль введен неверно.");
  }

  const emailNormalized = normalizeEmail(nextEmail);
  const conflict = await pool.query(
    `SELECT 1 FROM auth_users WHERE id <> $1 AND email_normalized = $2 LIMIT 1`,
    [data.userId, emailNormalized],
  );
  if (conflict.rowCount) {
    throw new Error("Эта почта уже используется.");
  }

  await pool.query(
    `UPDATE auth_users SET email = $1, email_normalized = $2 WHERE id = $3`,
    [nextEmail.trim(), emailNormalized, data.userId],
  );

  return getUserByToken(token);
}

async function getRoleStatsByUserId(userId: string): Promise<UserStatsSummary> {
  await ensureTables();
  const result = await pool.query<{
    role_key: string;
    matches: number;
    wins: number;
  }>(
    `
      SELECT role_key, matches, wins
      FROM auth_user_role_stats
      WHERE user_id = $1
      ORDER BY role_key ASC
    `,
    [userId],
  );

  const roleStats = result.rows.map((row) => {
    const matches = Number(row.matches) || 0;
    const wins = Number(row.wins) || 0;
    const winRate = matches > 0 ? Math.round((wins / matches) * 1000) / 10 : 0;
    return {
      roleKey: row.role_key,
      matches,
      wins,
      winRate,
    };
  });

  const totalMatches = roleStats.reduce((sum, row) => sum + row.matches, 0);
  const totalWins = roleStats.reduce((sum, row) => sum + row.wins, 0);
  const totalWinRate =
    totalMatches > 0 ? Math.round((totalWins / totalMatches) * 1000) / 10 : 0;

  return {
    totalMatches,
    totalWins,
    totalWinRate,
    roleStats,
  };
}

async function getManualBadgeMap(userId: string): Promise<Map<string, boolean>> {
  await ensureTables();
  const result = await pool.query<{
    badge_key: string;
    is_active: boolean;
  }>(
    `
      SELECT badge_key, is_active
      FROM auth_user_badges
      WHERE user_id = $1
    `,
    [userId],
  );
  return new Map(result.rows.map((row) => [row.badge_key, !!row.is_active]));
}

async function getRankByUserId(userId: string): Promise<UserRankView> {
  await ensureTables();
  const result = await pool.query<{ points: number }>(
    `
      SELECT points
      FROM auth_user_ranks
      WHERE user_id = $1
      LIMIT 1
    `,
    [userId],
  );
  if (!result.rowCount) {
    return getRankByPoints(0);
  }
  return getRankByPoints(result.rows[0].points);
}

async function getRecentMatchHistoryByUserId(
  userId: string,
): Promise<UserMatchHistoryView[]> {
  await ensureTables();
  const result = await pool.query<{
    room_code: string;
    verdict: string;
    expected_verdict: string;
    role_key: string;
    role_title: string;
    did_win: boolean;
    participants: unknown;
    finished_at: Date;
  }>(
    `
      SELECT room_code, verdict, expected_verdict, role_key, role_title, did_win, participants, finished_at
      FROM auth_user_match_history
      WHERE user_id = $1
      ORDER BY finished_at DESC
      LIMIT 5
    `,
    [userId],
  );

  return result.rows.map((row) => {
    const participantsRaw = Array.isArray(row.participants) ? row.participants : [];
    const participants: UserMatchParticipantView[] = participantsRaw
      .map((item: any) => ({
        userId: typeof item?.userId === "string" ? item.userId : undefined,
        nickname: typeof item?.nickname === "string" ? item.nickname : "Игрок",
        roleKey: typeof item?.roleKey === "string" ? item.roleKey : "",
        roleTitle:
          typeof item?.roleTitle === "string"
            ? item.roleTitle
            : ROLE_TITLES[typeof item?.roleKey === "string" ? item.roleKey : ""] ?? "Роль",
        isSelf: !!item?.isSelf,
      }))
      .filter((item) => item.nickname.trim().length > 0);
    return {
      roomCode: row.room_code,
      verdict: row.verdict,
      expectedVerdict: row.expected_verdict,
      roleKey: row.role_key,
      roleTitle: row.role_title,
      didWin: !!row.did_win,
      participants,
      finishedAt: row.finished_at.getTime(),
    };
  });
}

function buildBadgeList(input: {
  user: {
    id: string;
    login: string;
    created_at: Date;
  };
  rank: UserRankView;
  stats: UserStatsSummary;
  manualBadgeMap: Map<string, boolean>;
  subscription: UserSubscriptionView;
}): UserBadgeView[] {
  const { user, rank, stats, manualBadgeMap, subscription } = input;
  const isBerly = isProtectedOwnerLogin(user.login);
  const canUseRating = !!subscription.capabilities.canUseRating;
  const badges: UserBadgeView[] = [];
  const roleStatsMap = new Map(stats.roleStats.map((row) => [row.roleKey, row]));

  for (let i = 0; i < RANK_DEFINITIONS.length; i += 1) {
    const rankDef = RANK_DEFINITIONS[i];
    const nextRankDef = RANK_DEFINITIONS[i + 1];
    const isCurrentRank = rank.key === rankDef.key;
    const progressCurrent = isCurrentRank
      ? rank.progressCurrent
      : rank.points >= rankDef.minPoints
        ? Math.max(
            0,
            (nextRankDef?.minPoints ?? rankDef.minPoints + 1) - rankDef.minPoints,
          )
        : Math.max(0, rank.points - rankDef.minPoints);
    const progressTarget = Math.max(
      1,
      (nextRankDef?.minPoints ?? rankDef.minPoints + 1) - rankDef.minPoints,
    );
    badges.push({
      key: `rank_${rankDef.key}`,
      title: rankDef.title,
      description: `Доступен при достижении ранга «${rankDef.title}».`,
      category: "rank",
      active: isCurrentRank,
      progressCurrent,
      progressTarget,
      progressLabel: isCurrentRank
        ? "Текущий ранг"
        : canUseRating && rank.points >= rankDef.minPoints
          ? "Пройден"
          : canUseRating
            ? `${Math.max(0, rank.points)}/${rankDef.minPoints}`
            : "Открывается с подпиской «Стажер»",
    });
  }

  for (const [roleKey, meta] of Object.entries(ROLE_BADGE_META)) {
    const wins = roleStatsMap.get(roleKey)?.wins ?? 0;
    const active = isBerly || wins >= 50;
    badges.push({
      key: `role_${roleKey}`,
      title: meta.title,
      description: meta.description,
      category: "earned",
      active,
      progressCurrent: active ? 50 : Math.max(0, wins),
      progressTarget: 50,
      progressLabel: active ? "Получен" : `${Math.max(0, wins)}/50 побед`,
    });
  }

  const winnerCurrent = Math.max(0, Math.round(stats.totalWinRate));
  const winnerActive = isBerly || winnerCurrent >= 90;
  badges.push({
    key: "winner",
    title: "Победитель",
    description: "Доступен при общем проценте побед 90% и выше.",
    category: "earned",
    active: winnerActive,
    progressCurrent: winnerActive ? 90 : winnerCurrent,
    progressTarget: 90,
    progressLabel: winnerActive ? "Получен" : `${winnerCurrent}% / 90%`,
  });

  // "Легенда" теперь только вручную (в будущем: промокод/админ-выдача), без авто-выдачи.
  const legendActive = manualBadgeMap.get("legend") ?? false;
  badges.push({
    key: "legend",
    title: "Легенда",
    description: "Игрок участвовал в эпохе Beta 0.4.5.",
    category: "manual",
    active: legendActive,
    progressCurrent: legendActive ? 1 : 0,
    progressTarget: 1,
    progressLabel: legendActive ? "Получен" : "Недоступен",
  });

  for (const [key, meta] of Object.entries(MANUAL_BADGE_META)) {
    const manualActive = manualBadgeMap.get(key) ?? false;
    const implicitCreator = key === "creator" && isBerly;
    const active = isBerly || manualActive || implicitCreator;
    badges.push({
      key,
      title: meta.title,
      description: meta.description,
      category: "manual",
      active,
      progressCurrent: active ? 1 : 0,
      progressTarget: 1,
      progressLabel: active ? "Получен" : "Выдается вручную",
    });
  }

  (["trainee", "practitioner", "arbiter"] as const).forEach((tier) => {
    const meta = SUBSCRIPTION_BADGE_META[tier];
    const active = isBerly || subscription.tier === tier;
    badges.push({
      key: meta.key,
      title: meta.title,
      description: meta.description,
      category: "subscription",
      active,
      progressCurrent: active ? 1 : 0,
      progressTarget: 1,
      progressLabel: active ? "Доступен" : `Открывается с подпиской «${meta.title}»`,
    });
  });

  return badges;
}

export async function getProfileByToken(
  token: string,
  clientIpRaw?: string | null,
): Promise<AuthUserPublicProfile | null> {
  await cleanupSessions();
  const clientIp = normalizeIpAddress(clientIpRaw);
  const result = await pool.query<{
    id: string;
    login: string;
    nickname: string;
    avatar: string | null;
    banner: string | null;
    bio: string | null;
    gender: string | null;
    birth_date: Date | null;
    hide_age: boolean | null;
    selected_badge_key: string | null;
    preferred_role: string | null;
    admin_role: string | null;
    created_at: Date;
    subscription_tier: string | null;
    subscription_start_at: Date | null;
    subscription_end_at: Date | null;
    subscription_is_lifetime: boolean | null;
    subscription_source: string | null;
    subscription_duration: string | null;
    ban_until: Date | null;
    ban_permanent: boolean | null;
    ban_reason: string | null;
  }>(
    `
      SELECT
        u.id,
        u.login,
        u.nickname,
        u.avatar,
        u.banner,
        u.bio,
        u.gender,
        u.birth_date,
        u.hide_age,
        u.selected_badge_key,
        u.preferred_role,
        u.created_at,
        u.subscription_tier,
        u.subscription_start_at,
        u.subscription_end_at,
        u.subscription_is_lifetime,
        u.subscription_source,
        u.subscription_duration,
        u.ban_until,
        u.ban_permanent,
        u.ban_reason
      FROM auth_sessions s
      JOIN auth_users u ON u.id = s.user_id
      WHERE s.token = $1
      LIMIT 1
    `,
    [token],
  );
  if (!result.rowCount) return null;

  const row = result.rows[0];
  await touchUserIpRecord(row.id, clientIp);
  const userBan = resolveBanView(row);
  const ipBan = isProtectedOwnerLogin(row.login)
    ? {
        isBanned: false,
        isPermanent: false,
        bannedUntil: null,
        reason: null,
      }
    : await getIpBanViewByAddress(clientIp);
  const effectiveBan = mergeBanViews(userBan, ipBan);
  if (effectiveBan.isBanned) {
    return null;
  }
  const stats = await getRoleStatsByUserId(row.id);
  const rank = await getRankByUserId(row.id);
  const manualBadgeMap = await getManualBadgeMap(row.id);
  const recentMatches = await getRecentMatchHistoryByUserId(row.id);
  const subscription = resolveSubscriptionView(row);
  const base = toPublicProfile(row);
  const badges = buildBadgeList({
    user: {
      id: row.id,
      login: row.login,
      created_at: row.created_at,
    },
    rank,
    stats,
    manualBadgeMap,
    subscription,
  });
  const selectedBadgeKey =
    typeof row.selected_badge_key === "string" && row.selected_badge_key.trim()
      ? row.selected_badge_key.trim()
      : undefined;
  return {
    ...base,
    rank,
    stats,
    badges,
    selectedBadgeKey,
    recentMatches,
    subscription,
  };
}

function resolveBanView(row: {
  ban_until?: Date | null;
  ban_permanent?: boolean | null;
  ban_reason?: string | null;
}): UserBanView {
  const nowMs = Date.now();
  const banUntilMs =
    row.ban_until instanceof Date && Number.isFinite(row.ban_until.getTime())
      ? row.ban_until.getTime()
      : null;
  const isPermanent = !!row.ban_permanent;
  const isBanned = isPermanent || (banUntilMs !== null && banUntilMs > nowMs);
  const reason =
    typeof row.ban_reason === "string" && row.ban_reason.trim()
      ? row.ban_reason.trim()
      : undefined;
  return {
    isBanned,
    isPermanent,
    bannedUntil: isBanned && !isPermanent ? banUntilMs : null,
    reason,
  };
}

function mergeBanViews(userBan: UserBanView, ipBan: UserBanView): UserBanView {
  if (!userBan.isBanned && !ipBan.isBanned) {
    return {
      isBanned: false,
      isPermanent: false,
      bannedUntil: null,
      reason: undefined,
    };
  }
  if (!userBan.isBanned) return ipBan;
  if (!ipBan.isBanned) return userBan;

  const isPermanent = userBan.isPermanent || ipBan.isPermanent;
  const bannedUntil = isPermanent
    ? null
    : Math.max(userBan.bannedUntil ?? 0, ipBan.bannedUntil ?? 0) || null;
  const reason = userBan.reason || ipBan.reason;
  return {
    isBanned: true,
    isPermanent,
    bannedUntil,
    reason,
  };
}

async function touchUserIpRecord(userIdRaw: string, ipRaw: string | null | undefined): Promise<void> {
  const userId = String(userIdRaw ?? "").trim();
  const ipAddress = normalizeIpAddress(ipRaw);
  if (!userId || !ipAddress) return;
  await pool.query(
    `
      INSERT INTO auth_user_ips (user_id, ip_address, first_seen, last_seen)
      VALUES ($1, $2, NOW(), NOW())
      ON CONFLICT (user_id, ip_address)
      DO UPDATE SET last_seen = NOW()
    `,
    [userId, ipAddress],
  );
}

async function getIpBanViewByAddress(ipRaw: string | null | undefined): Promise<UserBanView> {
  const ipAddress = normalizeIpAddress(ipRaw);
  if (!ipAddress) {
    return {
      isBanned: false,
      isPermanent: false,
      bannedUntil: null,
      reason: undefined,
    };
  }
  const result = await pool.query<{
    ban_until: Date | null;
    ban_permanent: boolean | null;
    ban_reason: string | null;
  }>(
    `
      SELECT ban_until, ban_permanent, ban_reason
      FROM auth_ip_bans
      WHERE ip_address = $1
      LIMIT 1
    `,
    [ipAddress],
  );
  if (!result.rowCount) {
    return {
      isBanned: false,
      isPermanent: false,
      bannedUntil: null,
      reason: undefined,
    };
  }
  const row = result.rows[0];
  const view = resolveBanView(row);
  if (!view.isBanned && !row.ban_permanent && row.ban_until instanceof Date) {
    await pool.query(`DELETE FROM auth_ip_bans WHERE ip_address = $1`, [ipAddress]);
  }
  return view;
}

async function syncUserIpBanRecords(userIdRaw: string, ban: UserBanView): Promise<void> {
  const userId = String(userIdRaw ?? "").trim();
  if (!userId) return;
  if (!ban.isBanned) {
    await pool.query(`DELETE FROM auth_ip_bans WHERE source_user_id = $1`, [userId]);
    return;
  }
  const ipRows = await pool.query<{ ip_address: string }>(
    `
      SELECT ip_address
      FROM (
        SELECT ip_address
        FROM auth_user_ips
        WHERE user_id = $1
        UNION
        SELECT ip_address
        FROM auth_sessions
        WHERE user_id = $1 AND ip_address IS NOT NULL
      ) AS ips
    `,
    [userId],
  );
  if (!ipRows.rowCount) return;
  for (const row of ipRows.rows) {
    const ipAddress = normalizeIpAddress(row.ip_address);
    if (!ipAddress) continue;
    await pool.query(
      `
        INSERT INTO auth_ip_bans (
          ip_address,
          source_user_id,
          ban_until,
          ban_permanent,
          ban_reason,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        ON CONFLICT (ip_address)
        DO UPDATE SET
          source_user_id = EXCLUDED.source_user_id,
          ban_until = EXCLUDED.ban_until,
          ban_permanent = EXCLUDED.ban_permanent,
          ban_reason = EXCLUDED.ban_reason,
          updated_at = NOW()
      `,
      [ipAddress, userId, ban.bannedUntil ? new Date(ban.bannedUntil) : null, ban.isPermanent, ban.reason ?? null],
    );
  }
}

function formatBanMessage(ban: UserBanView): string {
  if (!ban.isBanned) {
    return "Блокировка не активна.";
  }
  if (ban.isPermanent) {
    return ban.reason
      ? `Аккаунт заблокирован навсегда. Причина: ${ban.reason}`
      : "Аккаунт заблокирован навсегда.";
  }
  if (ban.bannedUntil) {
    const until = new Date(ban.bannedUntil).toLocaleString("ru-RU");
    return ban.reason
      ? `Аккаунт заблокирован до ${until}. Причина: ${ban.reason}`
      : `Аккаунт заблокирован до ${until}.`;
  }
  return "Аккаунт заблокирован.";
}

export function getBanMessageForClient(ban: UserBanView): string {
  return formatBanMessage(ban);
}

export async function getEffectiveBanByUserAndIp(input: {
  userId?: string | null;
  ip?: string | null;
}): Promise<UserBanView> {
  await ensureTables();
  const userId = String(input.userId ?? "").trim();
  const ip = normalizeIpAddress(input.ip);

  let userBan: UserBanView = {
    isBanned: false,
    isPermanent: false,
    bannedUntil: null,
    reason: undefined,
  };
  if (userId) {
    const userResult = await pool.query<{
      ban_until: Date | null;
      ban_permanent: boolean | null;
      ban_reason: string | null;
    }>(
      `
        SELECT ban_until, ban_permanent, ban_reason
        FROM auth_users
        WHERE id = $1
        LIMIT 1
      `,
      [userId],
    );
    if (userResult.rowCount) {
      userBan = resolveBanView(userResult.rows[0]);
    }
  }

  const ipBan = await getIpBanViewByAddress(ip);
  return mergeBanViews(userBan, ipBan);
}

export async function getPublicUserProfileById(
  userId: string,
): Promise<AuthUserPublicProfile | null> {
  await ensureTables();
  const result = await pool.query<{
    id: string;
    login: string;
    nickname: string;
    avatar: string | null;
    banner: string | null;
    bio: string | null;
    gender: string | null;
    birth_date: Date | null;
    hide_age: boolean | null;
    selected_badge_key: string | null;
    preferred_role: string | null;
    admin_role: string | null;
    created_at: Date;
    subscription_tier: string | null;
    subscription_start_at: Date | null;
    subscription_end_at: Date | null;
    subscription_is_lifetime: boolean | null;
    subscription_source: string | null;
    subscription_duration: string | null;
  }>(
    `
      SELECT
        id,
        login,
        nickname,
        avatar,
        banner,
        bio,
        gender,
        birth_date,
        hide_age,
        selected_badge_key,
        preferred_role,
        created_at,
        subscription_tier,
        subscription_start_at,
        subscription_end_at,
        subscription_is_lifetime,
        subscription_source,
        subscription_duration
      FROM auth_users
      WHERE id = $1
      LIMIT 1
    `,
    [userId],
  );
  if (!result.rowCount) return null;
  const row = result.rows[0];
  const stats = await getRoleStatsByUserId(row.id);
  const rank = await getRankByUserId(row.id);
  const manualBadgeMap = await getManualBadgeMap(row.id);
  const recentMatches = await getRecentMatchHistoryByUserId(row.id);
  const subscription = resolveSubscriptionView(row);
  const base = toPublicProfile(row);
  const badges = buildBadgeList({
    user: {
      id: row.id,
      login: row.login,
      created_at: row.created_at,
    },
    rank,
    stats,
    manualBadgeMap,
    subscription,
  });
  const selectedBadgeKey =
    typeof row.selected_badge_key === "string" && row.selected_badge_key.trim()
      ? row.selected_badge_key.trim()
      : undefined;
  return {
    ...base,
    rank,
    stats,
    badges,
    selectedBadgeKey,
    recentMatches,
    subscription,
  };
}

export async function getSubscriptionByUserId(userId: string): Promise<UserSubscriptionView> {
  await ensureTables();
  const result = await pool.query<{
    subscription_tier: string | null;
    subscription_start_at: Date | null;
    subscription_end_at: Date | null;
    subscription_is_lifetime: boolean | null;
    subscription_source: string | null;
    subscription_duration: string | null;
  }>(
    `
      SELECT
        subscription_tier,
        subscription_start_at,
        subscription_end_at,
        subscription_is_lifetime,
        subscription_source,
        subscription_duration
      FROM auth_users
      WHERE id = $1
      LIMIT 1
    `,
    [userId],
  );
  if (!result.rowCount) {
    return resolveSubscriptionView({});
  }
  return resolveSubscriptionView(result.rows[0]);
}

export async function userHasCapability(
  userId: string,
  capability: SubscriptionCapabilityKey,
): Promise<boolean> {
  const subscription = await getSubscriptionByUserId(userId);
  return !!subscription.capabilities[capability];
}

export async function canUserAccessCasePackById(
  userId: string,
  pack: { key?: string | null; title?: string | null; isAdult?: boolean | null },
): Promise<boolean> {
  const subscription = await getSubscriptionByUserId(userId);
  return canAccessCasePack(subscription.tier, pack);
}

export async function assignSubscriptionByUserId(input: {
  userId: string;
  tier: string;
  duration?: string | null;
  source?: string | null;
  startAt?: Date | number | string | null;
  endAt?: Date | number | string | null;
}): Promise<UserSubscriptionView | null> {
  await ensureTables();
  const tier = normalizeSubscriptionTier(input.tier);
  const duration = normalizeSubscriptionDuration(input.duration ?? "1_month");
  const source = normalizeSubscriptionSource(input.source ?? "manual");
  const startAtRaw =
    input.startAt instanceof Date
      ? input.startAt
      : input.startAt
        ? new Date(input.startAt)
        : new Date();
  const startAt = Number.isFinite(startAtRaw.getTime()) ? startAtRaw : new Date();
  const explicitEndAt =
    input.endAt instanceof Date
      ? input.endAt
      : input.endAt
        ? new Date(input.endAt)
        : null;
  const durationMs = getDurationMs(duration);
  const isLifetime = tier !== "free" && duration === "forever";
  const endAt =
    tier === "free"
      ? null
      : explicitEndAt && Number.isFinite(explicitEndAt.getTime())
        ? explicitEndAt
        : durationMs === null
          ? null
          : new Date(startAt.getTime() + durationMs);
  const safeStartAt = tier === "free" ? null : startAt;

  const updated = await pool.query<{
    id: string;
  }>(
    `
      UPDATE auth_users
      SET
        subscription_tier = $1,
        subscription_start_at = $2,
        subscription_end_at = $3,
        subscription_is_lifetime = $4,
        subscription_source = $5,
        subscription_duration = $6
      WHERE id = $7
      RETURNING id
    `,
    [tier, safeStartAt, endAt, isLifetime, source, duration, input.userId],
  );
  if (!updated.rowCount) return null;
  return getSubscriptionByUserId(input.userId);
}

function normalizePromoCode(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

function normalizePromoKind(value: string | null | undefined): "subscription" | "badge" {
  const normalized = String(value ?? "subscription")
    .trim()
    .toLowerCase();
  return normalized === "badge" ? "badge" : "subscription";
}

function normalizePromoBadgeKey(value: string | null | undefined): string | null {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  return BADGE_PROMO_ALLOWED_KEYS.has(normalized) ? normalized : null;
}

function normalizePromoBadgeKeys(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const unique = new Set<string>();
  for (const item of values) {
    const normalized = normalizePromoBadgeKey(typeof item === "string" ? item : null);
    if (normalized) unique.add(normalized);
  }
  return Array.from(unique);
}

function promoDurationLabel(duration: SubscriptionDuration): string {
  switch (duration) {
    case "1_day":
      return "1 день";
    case "3_days":
      return "3 дня";
    case "7_days":
      return "7 дней";
    case "1_month":
      return "1 месяц";
    case "1_year":
      return "1 год";
    case "forever":
      return "навсегда";
    default:
      return "1 месяц";
  }
}

export async function applyPromoCodeByToken(
  token: string,
  code: string,
): Promise<PromoApplyResult | null> {
  await cleanupSessions();
  const user = await getUserByToken(token);
  if (!user) return null;

  const normalizedCode = normalizePromoCode(code);
  if (!normalizedCode) {
    throw new Error("Введите промокод.");
  }

  const client = await pool.connect();
  let tier: SubscriptionTier = "free";
  let duration: SubscriptionDuration = "1_month";
  let appliedPromoBadgeKeys: string[] = [];
  try {
    await client.query("BEGIN");
    const promoResult = await client.query<{
      promo_kind: string;
      badge_key: string | null;
      badge_keys: unknown;
      tier: string;
      duration: string;
      source: string;
      is_active: boolean;
      max_uses: number | null;
      used_count: number;
      starts_at: Date | null;
      expires_at: Date | null;
    }>(
      `
        SELECT
          promo_kind,
          badge_key,
          badge_keys,
          tier,
          duration,
          source,
          is_active,
          max_uses,
          used_count,
          starts_at,
          expires_at
        FROM auth_subscription_promocodes
        WHERE code_normalized = $1
        LIMIT 1
        FOR UPDATE
      `,
      [normalizedCode],
    );
    if (!promoResult.rowCount) {
      throw new Error("Промокод не найден.");
    }
    const promo = promoResult.rows[0];
    if (!promo.is_active) {
      throw new Error("Промокод выключен.");
    }

    const nowMs = Date.now();
    if (promo.starts_at && promo.starts_at.getTime() > nowMs) {
      throw new Error("Промокод еще не активен.");
    }
    if (promo.expires_at && promo.expires_at.getTime() <= nowMs) {
      throw new Error("Срок действия промокода истек.");
    }
    if (
      typeof promo.max_uses === "number" &&
      Number.isFinite(promo.max_uses) &&
      promo.max_uses >= 0 &&
      promo.used_count >= promo.max_uses
    ) {
      throw new Error("Лимит активаций промокода исчерпан.");
    }

    const alreadyRedeemed = await client.query(
      `
        SELECT 1
        FROM auth_user_promo_redemptions
        WHERE user_id = $1 AND code_normalized = $2
        LIMIT 1
      `,
      [user.id, normalizedCode],
    );
    if (alreadyRedeemed.rowCount) {
      throw new Error("Этот промокод уже активирован на вашем аккаунте.");
    }

    tier = normalizeSubscriptionTier(promo.tier);
    duration = normalizeSubscriptionDuration(promo.duration);
    const source = normalizeSubscriptionSource(promo.source);
    const promoKind = normalizePromoKind(promo.promo_kind);
    const promoBadgeKey = normalizePromoBadgeKey(promo.badge_key);
    const promoBadgeKeys = normalizePromoBadgeKeys(promo.badge_keys);
    if (promoBadgeKey && !promoBadgeKeys.includes(promoBadgeKey)) {
      promoBadgeKeys.push(promoBadgeKey);
    }
    appliedPromoBadgeKeys = promoBadgeKeys;
    const startAt = new Date();
    const durationMs = getDurationMs(duration);
    const isLifetime = tier !== "free" && duration === "forever";
    const endAt =
      tier === "free"
        ? null
        : durationMs === null
          ? null
          : new Date(startAt.getTime() + durationMs);

    if (promoKind === "badge" && promoBadgeKeys.length === 0) {
        throw new Error("Промокод поврежден: бейдж не найден.");
    }
    if (tier !== "free") {
      await client.query(
        `
          UPDATE auth_users
          SET
            subscription_tier = $1,
            subscription_start_at = $2,
            subscription_end_at = $3,
            subscription_is_lifetime = $4,
            subscription_source = $5,
            subscription_duration = $6
          WHERE id = $7
        `,
        [tier, tier === "free" ? null : startAt, endAt, isLifetime, source, duration, user.id],
      );
    }
    if (promoBadgeKeys.length > 0) {
      for (const badge of promoBadgeKeys) {
        await client.query(
          `
            INSERT INTO auth_user_badges (user_id, badge_key, is_active, granted_at)
            VALUES ($1, $2, TRUE, NOW())
            ON CONFLICT (user_id, badge_key)
            DO UPDATE SET
              is_active = TRUE,
              granted_at = NOW()
          `,
          [user.id, badge],
        );
      }
      await client.query(
        `
          UPDATE auth_users
          SET selected_badge_key = COALESCE(selected_badge_key, $1)
          WHERE id = $2
        `,
        [promoBadgeKeys[0], user.id],
      );
    }

    await client.query(
      `
        INSERT INTO auth_user_promo_redemptions (user_id, code_normalized, redeemed_at)
        VALUES ($1, $2, NOW())
      `,
      [user.id, normalizedCode],
    );

    await client.query(
      `
        UPDATE auth_subscription_promocodes
        SET used_count = used_count + 1, updated_at = NOW()
        WHERE code_normalized = $1
      `,
      [normalizedCode],
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  const subscription = await getSubscriptionByUserId(user.id);
  const rewards: PromoApplyResult["rewards"] = [];
  if (tier !== "free") {
    rewards.push({
      type: "subscription",
      label: `${subscription.label} (${promoDurationLabel(duration)})`,
    });
  }
  if (appliedPromoBadgeKeys.length > 0) {
    for (const badgeKey of appliedPromoBadgeKeys) {
      rewards.push({
        type: "badge",
        label: getBadgeTitleForPromoReward(badgeKey),
      });
    }
  }
  return {
    message:
      rewards.length > 0
        ? `Промокод активирован: ${rewards.map((reward) => reward.label).join(" · ")}.`
        : "Промокод активирован.",
    subscription,
    rewards,
  };
}

export async function upsertPromoCodeByAdmin(input: {
  code: string;
  tier: string;
  promoKind?: string | null;
  badgeKey?: string | null;
  badgeKeys?: unknown;
  duration?: string | null;
  source?: string | null;
  isActive?: boolean;
  maxUses?: number | null;
  startsAt?: Date | string | number | null;
  expiresAt?: Date | string | number | null;
  createdByUserId?: string | null;
}): Promise<{
  code: string;
  promoKind: "subscription" | "badge";
  badgeKey: string | null;
  badgeKeys: string[];
  tier: SubscriptionTier;
  duration: SubscriptionDuration;
}> {
  await ensureTables();
  const normalizedCode = normalizePromoCode(input.code);
  if (!normalizedCode) {
    throw new Error("Укажите промокод.");
  }
  const promoKind = normalizePromoKind(input.promoKind);
  const badgeKey = normalizePromoBadgeKey(input.badgeKey);
  const badgeKeys = normalizePromoBadgeKeys(input.badgeKeys);
  if (badgeKey && !badgeKeys.includes(badgeKey)) {
    badgeKeys.push(badgeKey);
  }
  const tier = normalizeSubscriptionTier(input.tier);
  if (promoKind === "badge" && badgeKeys.length === 0) {
    throw new Error("Выберите корректный бейдж для промокода.");
  }
  if (tier === "free" && badgeKeys.length === 0) {
    throw new Error("Промокод должен выдавать подписку и/или бейдж.");
  }
  const duration = normalizeSubscriptionDuration(input.duration ?? "1_month");
  const source = normalizeSubscriptionSource(input.source ?? "system");
  const maxUses =
    typeof input.maxUses === "number" && Number.isFinite(input.maxUses)
      ? Math.max(0, Math.floor(input.maxUses))
      : null;
  const startsAt =
    input.startsAt instanceof Date
      ? input.startsAt
      : input.startsAt
        ? new Date(input.startsAt)
        : null;
  const expiresAt =
    input.expiresAt instanceof Date
      ? input.expiresAt
      : input.expiresAt
        ? new Date(input.expiresAt)
        : null;

  await pool.query(
    `
      INSERT INTO auth_subscription_promocodes (
        code_normalized,
        code_display,
        promo_kind,
        badge_key,
        badge_keys,
        tier,
        duration,
        source,
        is_active,
        max_uses,
        starts_at,
        expires_at,
        created_by,
        created_at,
        updated_at
      )
      VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11,$12,$13,NOW(),NOW())
      ON CONFLICT (code_normalized)
      DO UPDATE SET
        code_display = EXCLUDED.code_display,
        promo_kind = EXCLUDED.promo_kind,
        badge_key = EXCLUDED.badge_key,
        badge_keys = EXCLUDED.badge_keys,
        tier = EXCLUDED.tier,
        duration = EXCLUDED.duration,
        source = EXCLUDED.source,
        is_active = EXCLUDED.is_active,
        max_uses = EXCLUDED.max_uses,
        starts_at = EXCLUDED.starts_at,
        expires_at = EXCLUDED.expires_at,
        updated_at = NOW()
    `,
    [
      normalizedCode,
      normalizedCode,
      promoKind,
      badgeKey,
      JSON.stringify(badgeKeys),
      tier,
      duration,
      source,
      input.isActive !== false,
      maxUses,
      startsAt && Number.isFinite(startsAt.getTime()) ? startsAt : null,
      expiresAt && Number.isFinite(expiresAt.getTime()) ? expiresAt : null,
      input.createdByUserId ?? null,
    ],
  );

  return { code: normalizedCode, promoKind, badgeKey, badgeKeys, tier, duration };
}

export async function listPromoCodesByAdmin(): Promise<AdminPromoCodeView[]> {
  await ensureTables();
  const result = await pool.query<{
    code_display: string;
    promo_kind: string;
    badge_key: string | null;
    badge_keys: unknown;
    tier: string;
    duration: string;
    source: string;
    is_active: boolean;
    max_uses: number | null;
    used_count: number;
    starts_at: Date | null;
    expires_at: Date | null;
    created_at: Date | null;
    updated_at: Date | null;
  }>(
    `
      SELECT
        code_display,
        promo_kind,
        badge_key,
        badge_keys,
        tier,
        duration,
        source,
        is_active,
        max_uses,
        used_count,
        starts_at,
        expires_at,
        created_at,
        updated_at
      FROM auth_subscription_promocodes
      ORDER BY created_at DESC NULLS LAST, code_display ASC
    `,
  );

  return result.rows.map((row) => ({
    code: String(row.code_display || "").trim().toUpperCase(),
    promoKind: normalizePromoKind(row.promo_kind),
    badgeKey: normalizePromoBadgeKey(row.badge_key),
    badgeKeys: normalizePromoBadgeKeys(row.badge_keys),
    tier: normalizeSubscriptionTier(row.tier),
    duration: normalizeSubscriptionDuration(row.duration),
    source: normalizeSubscriptionSource(row.source),
    isActive: !!row.is_active,
    maxUses: typeof row.max_uses === "number" && Number.isFinite(row.max_uses) ? row.max_uses : null,
    usedCount:
      typeof row.used_count === "number" && Number.isFinite(row.used_count)
        ? Math.max(0, Math.floor(row.used_count))
        : 0,
    startsAt: row.starts_at instanceof Date && Number.isFinite(row.starts_at.getTime()) ? row.starts_at.toISOString() : null,
    expiresAt:
      row.expires_at instanceof Date && Number.isFinite(row.expires_at.getTime())
        ? row.expires_at.toISOString()
        : null,
    createdAt:
      row.created_at instanceof Date && Number.isFinite(row.created_at.getTime())
        ? row.created_at.toISOString()
        : null,
    updatedAt:
      row.updated_at instanceof Date && Number.isFinite(row.updated_at.getTime())
        ? row.updated_at.toISOString()
        : null,
  }));
}

export async function deletePromoCodeByAdmin(code: string): Promise<boolean> {
  await ensureTables();
  const normalizedCode = normalizePromoCode(code);
  if (!normalizedCode) {
    throw new Error("Укажите промокод.");
  }
  const result = await pool.query(
    `
      DELETE FROM auth_subscription_promocodes
      WHERE code_normalized = $1
    `,
    [normalizedCode],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function findUserByAdminQuery(query: string): Promise<AdminUserLookupView | null> {
  await ensureTables();
  const trimmed = String(query ?? "").trim();
  if (!trimmed) {
    throw new Error("Введите login, email, nickname или userId.");
  }

  const normalized = trimmed.toLowerCase();
  const normalizedLike = `%${trimmed}%`;
  const result = await pool.query<{
    id: string;
    login: string;
    email: string;
    nickname: string;
    created_at: Date;
    admin_role: string | null;
    subscription_tier: string | null;
    subscription_start_at: Date | null;
    subscription_end_at: Date | null;
    subscription_is_lifetime: boolean | null;
    subscription_source: string | null;
    subscription_duration: string | null;
    ban_until: Date | null;
    ban_permanent: boolean | null;
    ban_reason: string | null;
  }>(
    `
      SELECT
        id,
        login,
        email,
        nickname,
        created_at,
        admin_role,
        subscription_tier,
        subscription_start_at,
        subscription_end_at,
        subscription_is_lifetime,
        subscription_source,
        subscription_duration,
        ban_until,
        ban_permanent,
        ban_reason
      FROM auth_users
        WHERE
          id::text = $1
          OR LOWER(login) = $2
          OR LOWER(email) = $2
          OR LOWER(nickname) = $2
          OR login ILIKE $3
          OR email ILIKE $3
          OR nickname ILIKE $3
        ORDER BY
          CASE
            WHEN id::text = $1 THEN 0
            WHEN LOWER(login) = $2 OR LOWER(email) = $2 OR LOWER(nickname) = $2 THEN 1
            ELSE 2
          END ASC,
          created_at DESC
        LIMIT 1
      `,
      [trimmed, normalized, normalizedLike],
    );

  if (!result.rowCount) return null;
  const row = result.rows[0];
  return {
    id: row.id,
    login: row.login,
    email: row.email,
    nickname: row.nickname,
    createdAt: row.created_at.getTime(),
    adminRole: normalizeAdminStaffRole(row.admin_role),
    subscription: resolveSubscriptionView(row),
    ban: resolveBanView(row),
  };
}

export async function setUserBanByAdmin(input: {
  userId: string;
  days?: number | null;
  forever?: boolean;
  reason?: string | null;
}): Promise<UserBanView | null> {
  await ensureTables();
  const userId = String(input.userId ?? "").trim();
  if (!userId) {
    throw new Error("Нужен userId.");
  }
  const forever = !!input.forever;
  let days: number | null = null;
  if (!forever) {
    const parsedDays = Number(input.days);
    if (!Number.isFinite(parsedDays) || parsedDays <= 0) {
      throw new Error("Укажите количество дней блокировки.");
    }
    days = Math.min(3650, Math.floor(parsedDays));
  }
  const reason =
    typeof input.reason === "string" && input.reason.trim()
      ? input.reason.trim().slice(0, 300)
      : null;
  const banUntil = forever ? null : new Date(Date.now() + Number(days) * 24 * 60 * 60 * 1000);
  const result = await pool.query<{
    ban_until: Date | null;
    ban_permanent: boolean | null;
    ban_reason: string | null;
    login: string;
  }>(
    `
      UPDATE auth_users
      SET
        ban_until = $1,
        ban_permanent = $2,
        ban_reason = $3
      WHERE id = $4
        AND LOWER(login) <> 'berly'
      RETURNING ban_until, ban_permanent, ban_reason, login
    `,
    [banUntil, forever, reason, userId],
  );
  if (!result.rowCount) {
    const protectedUser = await pool.query<{ login: string }>(
      `SELECT login FROM auth_users WHERE id = $1 LIMIT 1`,
      [userId],
    );
    if (protectedUser.rowCount > 0 && isProtectedOwnerLogin(protectedUser.rows[0].login)) {
      throw new Error("Пользователь Berly защищен от блокировки.");
    }
    return null;
  }
  const ban = resolveBanView(result.rows[0]);
  await syncUserIpBanRecords(userId, ban);
  return ban;
}

export async function clearUserBanByAdmin(userIdRaw: string): Promise<UserBanView | null> {
  await ensureTables();
  const userId = String(userIdRaw ?? "").trim();
  if (!userId) {
    throw new Error("Нужен userId.");
  }
  const result = await pool.query<{
    ban_until: Date | null;
    ban_permanent: boolean | null;
    ban_reason: string | null;
  }>(
    `
      UPDATE auth_users
      SET
        ban_until = NULL,
        ban_permanent = FALSE,
        ban_reason = NULL
      WHERE id = $1
      RETURNING ban_until, ban_permanent, ban_reason
    `,
    [userId],
  );
  if (!result.rowCount) return null;
  const ban = resolveBanView(result.rows[0]);
  await syncUserIpBanRecords(userId, ban);
  return ban;
}

async function setManualBadgeActive(input: {
  userId: string;
  badgeKey: string;
  active: boolean;
}): Promise<void> {
  await pool.query(
    `
      INSERT INTO auth_user_badges (user_id, badge_key, is_active, granted_at)
      VALUES ($1, $2, $3, CASE WHEN $3 THEN NOW() ELSE NULL END)
      ON CONFLICT (user_id, badge_key)
      DO UPDATE SET
        is_active = EXCLUDED.is_active,
        granted_at = CASE
          WHEN EXCLUDED.is_active THEN COALESCE(auth_user_badges.granted_at, NOW())
          ELSE auth_user_badges.granted_at
        END
    `,
    [input.userId, input.badgeKey, input.active],
  );
}

export async function getAdminStaffRoleByUserId(
  userIdRaw: string,
): Promise<AdminStaffRole | null> {
  await ensureTables();
  const userId = String(userIdRaw ?? "").trim();
  if (!userId) return null;
  const result = await pool.query<{ admin_role: string | null }>(
    `
      SELECT admin_role
      FROM auth_users
      WHERE id = $1
      LIMIT 1
    `,
    [userId],
  );
  if (!result.rowCount) return null;
  return normalizeAdminStaffRole(result.rows[0].admin_role);
}

export async function setAdminStaffRoleByUserId(input: {
  userId: string;
  role: AdminStaffRole | null;
}): Promise<AdminStaffRole | null | undefined> {
  await ensureTables();
  const userId = String(input.userId ?? "").trim();
  if (!userId) {
    throw new Error("Нужен userId.");
  }
  const nextRole = normalizeAdminStaffRole(input.role);
  const result = await pool.query<{ admin_role: string | null }>(
    `
      UPDATE auth_users
      SET admin_role = $1
      WHERE id = $2
      RETURNING admin_role
    `,
    [nextRole, userId],
  );
  if (!result.rowCount) return undefined;

  if (nextRole === "administrator") {
    await setManualBadgeActive({ userId, badgeKey: "admin", active: true });
    await setManualBadgeActive({ userId, badgeKey: "moderator", active: true });
    await pool.query(
      `
        UPDATE auth_users
        SET selected_badge_key = COALESCE(selected_badge_key, 'admin')
        WHERE id = $1
      `,
      [userId],
    );
  } else if (nextRole === "moderator") {
    await setManualBadgeActive({ userId, badgeKey: "moderator", active: true });
    await setManualBadgeActive({ userId, badgeKey: "admin", active: false });
    await pool.query(
      `
        UPDATE auth_users
        SET selected_badge_key = COALESCE(selected_badge_key, 'moderator')
        WHERE id = $1
      `,
      [userId],
    );
  } else {
    await setManualBadgeActive({ userId, badgeKey: "moderator", active: false });
    await setManualBadgeActive({ userId, badgeKey: "admin", active: false });
  }

  return normalizeAdminStaffRole(result.rows[0].admin_role);
}

export async function updateUserModerationByAdmin(input: {
  userId: string;
  nickname?: string;
  clearAvatar?: boolean;
  clearBanner?: boolean;
}): Promise<{ id: string; nickname: string; avatar: string | null; banner: string | null } | null> {
  await ensureTables();
  const userId = String(input.userId ?? "").trim();
  if (!userId) {
    throw new Error("Нужен userId.");
  }

  const clearAvatar = !!input.clearAvatar;
  const clearBanner = !!input.clearBanner;
  const hasNickname = typeof input.nickname === "string" && input.nickname.trim().length > 0;
  if (!clearAvatar && !clearBanner && !hasNickname) {
    throw new Error("Укажите действие модерации.");
  }

  await pool.query("BEGIN");
  try {
    if (hasNickname) {
      const nickname = String(input.nickname ?? "").trim();
      if (nickname.length < 2 || nickname.length > 24) {
        throw new Error("Ник должен быть от 2 до 24 символов.");
      }
      const nicknameNormalized = normalizeNickname(nickname);
      const conflict = await pool.query<{ id: string }>(
        `
          SELECT id
          FROM auth_users
          WHERE id <> $1 AND nickname_normalized = $2
          LIMIT 1
        `,
        [userId, nicknameNormalized],
      );
      if (conflict.rowCount) {
        throw new Error("Этот ник уже занят.");
      }
      await pool.query(
        `
          UPDATE auth_users
          SET nickname = $1, nickname_normalized = $2
          WHERE id = $3
        `,
        [nickname, nicknameNormalized, userId],
      );
    }
    if (clearAvatar) {
      await pool.query(`UPDATE auth_users SET avatar = NULL WHERE id = $1`, [userId]);
    }
    if (clearBanner) {
      await pool.query(`UPDATE auth_users SET banner = NULL WHERE id = $1`, [userId]);
    }

    const result = await pool.query<{
      id: string;
      nickname: string;
      avatar: string | null;
      banner: string | null;
    }>(
      `
        SELECT id, nickname, avatar, banner
        FROM auth_users
        WHERE id = $1
        LIMIT 1
      `,
      [userId],
    );
    if (!result.rowCount) {
      await pool.query("ROLLBACK");
      return null;
    }
    await pool.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }
}

export async function recordMatchOutcome(input: {
  roomCode: string;
  verdict: string;
  expectedVerdict: string;
  matchStartedAt?: number;
  matchFinishedAt?: number;
  players: Array<{
    userId?: string;
    roleKey?: string;
    nickname?: string;
    roleTitle?: string;
  }>;
}): Promise<void> {
  await ensureTables();

  const normalizeRoleKey = (rawRoleKey: string, rawRoleTitle?: string): string => {
    const roleKey = rawRoleKey.trim();
    const compactKey = roleKey.replace(/[^a-zA-Z]/g, "").toLowerCase();
    const roleTitle = (rawRoleTitle ?? "").toLowerCase().replace(/ё/g, "е");

    const byKey: Record<string, string> = {
      plaintiff: "plaintiff",
      defendant: "defendant",
      plaintifflawyer: "plaintiffLawyer",
      defenselawyer: "defenseLawyer",
      defendantlawyer: "defenseLawyer",
      prosecutor: "prosecutor",
      judge: "judge",
      witness: "witness",
    };
    if (byKey[compactKey]) {
      return byKey[compactKey];
    }

    if (roleTitle.includes("адвокат истца")) return "plaintiffLawyer";
    if (roleTitle.includes("адвокат ответчика")) return "defenseLawyer";
    if (roleTitle.includes("прокурор")) return "prosecutor";
    if (roleTitle.includes("судья")) return "judge";
    if (roleTitle.includes("истец")) return "plaintiff";
    if (roleTitle.includes("ответчик")) return "defendant";
    if (roleTitle.includes("свидетел")) return "witness";

    return roleKey;
  };

  const isUuidLike = (value: string): boolean =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value.trim(),
    );

  const resolveUserId = async (rawUserId: string, nickname: string): Promise<string | null> => {
    const normalizedRaw = rawUserId.trim();
    if (normalizedRaw && isUuidLike(normalizedRaw)) {
      return normalizedRaw;
    }
    const normalizedNickname = nickname.trim().toLowerCase();
    if (!normalizedNickname) return null;
    const lookup = await pool.query<{ id: string }>(
      `
        SELECT id
        FROM auth_users
        WHERE nickname_normalized = $1
           OR login_normalized = $1
        LIMIT 1
      `,
      [normalizedNickname],
    );
    return lookup.rowCount ? lookup.rows[0].id : null;
  };

  const verdictLower = (input.verdict || "").toLowerCase().replace(/ё/g, "е");
  const expectedLower = (input.expectedVerdict || "").toLowerCase().replace(/ё/g, "е");
  const isNotGuilty = verdictLower.includes("не винов");
  const isJudgeCorrect = verdictLower === expectedLower;

  const roleWinMap: Record<string, boolean> = {
    judge: isJudgeCorrect,
    prosecutor: !isNotGuilty,
    plaintiff: !isNotGuilty,
    plaintiffLawyer: !isNotGuilty,
    defendant: isNotGuilty,
    defenseLawyer: isNotGuilty,
    witness: false,
  };

  const MIN_MATCH_DURATION_MS = 10 * 60 * 1000;
  const SAME_OPPONENT_WINS_LIMIT = 2;
  const safeStartedAt =
    typeof input.matchStartedAt === "number" && Number.isFinite(input.matchStartedAt)
      ? input.matchStartedAt
      : null;
  const safeFinishedAt =
    typeof input.matchFinishedAt === "number" && Number.isFinite(input.matchFinishedAt)
      ? input.matchFinishedAt
      : Date.now();
  const isShortMatch =
    safeStartedAt !== null &&
    safeFinishedAt > safeStartedAt &&
    safeFinishedAt - safeStartedAt < MIN_MATCH_DURATION_MS;

  const normalizedPlayers = await Promise.all(
    input.players.map(async (player) => {
      const nickname =
        typeof player.nickname === "string" && player.nickname.trim()
          ? player.nickname.trim()
          : "Игрок";
      const rawUserId = typeof player.userId === "string" ? player.userId : "";
      const userId = await resolveUserId(rawUserId, nickname);
      const roleKeyRaw = typeof player.roleKey === "string" ? player.roleKey.trim() : "";
      const roleKey = normalizeRoleKey(
        roleKeyRaw,
        typeof player.roleTitle === "string" ? player.roleTitle : "",
      );
      const roleTitle =
        typeof player.roleTitle === "string" && player.roleTitle.trim()
          ? player.roleTitle.trim()
          : ROLE_TITLES[roleKey] ?? "Роль";
      return {
        userId,
        nickname,
        roleKey,
        roleTitle,
      };
    }),
  );

  const matchParticipantIds = normalizedPlayers
    .map((player) => player.userId)
    .filter((value): value is string => !!value)
    .sort();
  const repeatWinCache = new Map<string, boolean>();
  const shouldBlockWinBySameOpponents = async (userId: string): Promise<boolean> => {
    const cached = repeatWinCache.get(userId);
    if (typeof cached === "boolean") return cached;
    const opponentSignature = matchParticipantIds.filter((id) => id !== userId).join(",");
    if (!opponentSignature) {
      repeatWinCache.set(userId, false);
      return false;
    }
    const historyRows = await pool.query<{ participants: unknown }>(
      `
        SELECT participants
        FROM auth_user_match_history
        WHERE user_id = $1
          AND did_win = TRUE
        ORDER BY finished_at DESC
        LIMIT 300
      `,
      [userId],
    );
    let repeatedWins = 0;
    for (const row of historyRows.rows) {
      const participants = Array.isArray(row.participants) ? row.participants : [];
      const participantIds = participants
        .map((entry) =>
          entry && typeof entry === "object" && typeof (entry as { userId?: unknown }).userId === "string"
            ? ((entry as { userId: string }).userId || "").trim()
            : "",
        )
        .filter((value) => value.length > 0)
        .sort();
      const signature = participantIds.filter((id) => id !== userId).join(",");
      if (signature === opponentSignature) {
        repeatedWins += 1;
        if (repeatedWins >= SAME_OPPONENT_WINS_LIMIT) {
          repeatWinCache.set(userId, true);
          return true;
        }
      }
    }
    repeatWinCache.set(userId, false);
    return false;
  };

  for (const player of normalizedPlayers) {
    const userId = player.userId;
    const roleKey = player.roleKey;
    if (!userId || !roleKey || roleKey === "witness") continue;
    const baseWin = roleWinMap[roleKey] ?? false;
    const repeatedWinBlocked = baseWin ? await shouldBlockWinBySameOpponents(userId) : false;
    const ignoreProgress = isShortMatch || repeatedWinBlocked;
    const didWin = baseWin && !ignoreProgress;
    await pool.query(
      `
        INSERT INTO auth_user_role_stats (user_id, role_key, matches, wins, updated_at)
        VALUES ($1, $2, 1, $3, NOW())
        ON CONFLICT (user_id, role_key)
        DO UPDATE SET
          matches = auth_user_role_stats.matches + 1,
          wins = auth_user_role_stats.wins + EXCLUDED.wins,
          updated_at = NOW()
      `,
      [userId, roleKey, didWin ? 1 : 0],
    );

    const subscriptionRow = await pool.query<{
      subscription_tier: string | null;
      subscription_start_at: Date | null;
      subscription_end_at: Date | null;
      subscription_is_lifetime: boolean | null;
      subscription_source: string | null;
      subscription_duration: string | null;
    }>(
      `
        SELECT
          subscription_tier,
          subscription_start_at,
          subscription_end_at,
          subscription_is_lifetime,
          subscription_source,
          subscription_duration
        FROM auth_users
        WHERE id = $1
        LIMIT 1
      `,
      [userId],
    );
    const canUseRating =
      subscriptionRow.rowCount > 0
        ? resolveSubscriptionView(subscriptionRow.rows[0]).capabilities.canUseRating
        : false;
    if (canUseRating) {
      const ratingDelta = ignoreProgress ? 0 : baseWin ? 1 : -1;
      await pool.query(
        `
          INSERT INTO auth_user_ranks (user_id, points, updated_at)
          VALUES ($1, GREATEST(0, $2), NOW())
          ON CONFLICT (user_id)
          DO UPDATE SET
            points = GREATEST(0, auth_user_ranks.points + EXCLUDED.points),
            updated_at = NOW()
        `,
        [userId, ratingDelta],
      );
    }

    const participants = normalizedPlayers.map((entry) => ({
      userId: entry.userId ?? undefined,
      nickname: entry.nickname,
      roleKey: entry.roleKey,
      roleTitle: entry.roleTitle,
      isSelf: entry.userId === userId,
    }));

    await pool.query(
      `
        INSERT INTO auth_user_match_history (
          id,
          user_id,
          room_code,
          verdict,
          expected_verdict,
          role_key,
          role_title,
          did_win,
          participants,
          finished_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,NOW())
      `,
      [
        crypto.randomUUID(),
        userId,
        input.roomCode,
        input.verdict,
        input.expectedVerdict,
        roleKey,
        player.roleTitle,
        didWin,
        JSON.stringify(participants),
      ],
    );
  }
}


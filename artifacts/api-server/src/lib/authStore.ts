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
  created_at: Date;
}): AuthUserPublic {
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
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await pool.query(`
        CREATE INDEX IF NOT EXISTS auth_sessions_user_id_idx
        ON auth_sessions(user_id);
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
}): Promise<{ user: AuthUserPublic; token: string }> {
  await cleanupSessions();

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
      RETURNING id, login, email, nickname, avatar, banner, bio, gender, birth_date, hide_age, selected_badge_key, preferred_role, created_at
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
    `INSERT INTO auth_sessions (token, user_id, created_at) VALUES ($1, $2, NOW())`,
    [token, userId],
  );

  return { user: toPublicUser(userResult.rows[0]), token };
}

export async function loginAccount(input: {
  loginOrEmail: string;
  password: string;
}): Promise<{ user: AuthUserPublic; token: string }> {
  await cleanupSessions();

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
    created_at: Date;
    password_salt: string;
    password_hash: string;
  }>(
    `
      SELECT id, login, email, nickname, avatar, banner, bio, gender, birth_date, hide_age, selected_badge_key, preferred_role, created_at, password_salt, password_hash
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

  const token = crypto.randomUUID();
  await pool.query(
    `INSERT INTO auth_sessions (token, user_id, created_at) VALUES ($1, $2, NOW())`,
    [token, row.id],
  );

  return { user: toPublicUser(row), token };
}

export async function getUserByToken(token: string): Promise<AuthUserPublic | null> {
  await cleanupSessions();

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
    created_at: Date;
  }>(
    `
      SELECT u.id, u.login, u.email, u.nickname, u.avatar, u.banner, u.bio, u.gender, u.birth_date, u.hide_age, u.selected_badge_key, u.preferred_role, u.created_at
      FROM auth_sessions s
      JOIN auth_users u ON u.id = s.user_id
      WHERE s.token = $1
      LIMIT 1
    `,
    [token],
  );

  if (!result.rowCount) return null;
  return toPublicUser(result.rows[0]);
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
        if (!available.has(selectedBadgeKey)) {
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
      SELECT id, login, email, nickname, avatar, banner, bio, gender, birth_date, hide_age, selected_badge_key, preferred_role, created_at
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
  }>(
    `
      SELECT s.user_id, u.email, u.password_salt, u.password_hash
      FROM auth_sessions s
      JOIN auth_users u ON u.id = s.user_id
      WHERE s.token = $1
      LIMIT 1
    `,
    [token],
  );
  if (!result.rowCount) return null;
  const row = result.rows[0];
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
  const isBerly = user.login.toLowerCase() === "berly";
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
        : rank.points >= rankDef.minPoints
          ? "Пройден"
          : `${Math.max(0, rank.points)}/${rankDef.minPoints}`,
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
): Promise<AuthUserPublicProfile | null> {
  await cleanupSessions();
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
        u.subscription_duration
      FROM auth_sessions s
      JOIN auth_users u ON u.id = s.user_id
      WHERE s.token = $1
      LIMIT 1
    `,
    [token],
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
  const activeBadgeKeys = new Set(badges.filter((badge) => badge.active).map((badge) => badge.key));
  const selectedBadgeKey =
    row.selected_badge_key && activeBadgeKeys.has(row.selected_badge_key)
      ? row.selected_badge_key
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
  const activeBadgeKeys = new Set(badges.filter((badge) => badge.active).map((badge) => badge.key));
  const selectedBadgeKey =
    row.selected_badge_key && activeBadgeKeys.has(row.selected_badge_key)
      ? row.selected_badge_key
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

export async function recordMatchOutcome(input: {
  roomCode: string;
  verdict: string;
  expectedVerdict: string;
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

  for (const player of input.players) {
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
    if (!userId || !roleKey || roleKey === "witness") continue;
    const win = roleWinMap[roleKey] ?? false;
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
      [userId, roleKey, win ? 1 : 0],
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
      await pool.query(
        `
          INSERT INTO auth_user_ranks (user_id, points, updated_at)
          VALUES ($1, $2, NOW())
          ON CONFLICT (user_id)
          DO UPDATE SET
            points = GREATEST(0, auth_user_ranks.points + EXCLUDED.points),
            updated_at = NOW()
        `,
        [userId, win ? 1 : -1],
      );
    }

    const participants = input.players.map((entry) => ({
      userId: typeof entry.userId === "string" && entry.userId.trim() ? entry.userId.trim() : undefined,
      nickname:
        typeof entry.nickname === "string" && entry.nickname.trim()
          ? entry.nickname.trim()
          : "Игрок",
      roleKey: typeof entry.roleKey === "string" ? entry.roleKey : "",
      roleTitle:
        typeof entry.roleTitle === "string" && entry.roleTitle.trim()
          ? entry.roleTitle.trim()
          : ROLE_TITLES[typeof entry.roleKey === "string" ? entry.roleKey : ""] ?? "Роль",
      isSelf: typeof entry.userId === "string" && entry.userId.trim() === userId,
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
        typeof player.roleTitle === "string" && player.roleTitle.trim()
          ? player.roleTitle.trim()
          : ROLE_TITLES[roleKey] ?? "Роль",
        win,
        JSON.stringify(participants),
      ],
    );
  }
}



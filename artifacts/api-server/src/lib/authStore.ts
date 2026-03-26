import crypto from "node:crypto";
import { pool } from "@workspace/db";

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

export interface UserBadgeView {
  key: string;
  title: string;
  description: string;
  active: boolean;
  progressCurrent?: number;
  progressTarget?: number;
  progressLabel?: string;
}

export interface UserSubscriptionView {
  tier: "none";
  label: string;
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
  stats: UserStatsSummary;
  badges: UserBadgeView[];
  selectedBadgeKey?: string;
  recentMatches: UserMatchHistoryView[];
  subscription: UserSubscriptionView;
}

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const LEGEND_BETA_045_CUTOFF_UTC = Date.parse("2026-03-27T00:00:00.000Z");

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
    description: "Выдается вручную.",
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
  if (age < 0 || age > 120) {
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

function toPublicProfile(row: {
  id: string;
  nickname: string;
  avatar: string | null;
  banner: string | null;
  bio: string | null;
  gender: string | null;
  birth_date: Date | null;
  hide_age: boolean | null;
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
      RETURNING id, login, email, nickname, avatar, banner, bio, gender, birth_date, hide_age, selected_badge_key, created_at
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
    created_at: Date;
    password_salt: string;
    password_hash: string;
  }>(
    `
      SELECT id, login, email, nickname, avatar, banner, bio, gender, birth_date, hide_age, selected_badge_key, created_at, password_salt, password_hash
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
    created_at: Date;
  }>(
    `
      SELECT u.id, u.login, u.email, u.nickname, u.avatar, u.banner, u.bio, u.gender, u.birth_date, u.hide_age, u.selected_badge_key, u.created_at
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
    await pool.query(`UPDATE auth_users SET selected_badge_key = $1 WHERE id = $2`, [
      selectedBadgeKey,
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
    created_at: Date;
  }>(
    `
      SELECT id, login, email, nickname, avatar, banner, bio, gender, birth_date, hide_age, selected_badge_key, created_at
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
  stats: UserStatsSummary;
  manualBadgeMap: Map<string, boolean>;
}): UserBadgeView[] {
  const { user, stats, manualBadgeMap } = input;
  const badges: UserBadgeView[] = [];
  const roleStatsMap = new Map(stats.roleStats.map((row) => [row.roleKey, row]));

  for (const [roleKey, meta] of Object.entries(ROLE_BADGE_META)) {
    const wins = roleStatsMap.get(roleKey)?.wins ?? 0;
    badges.push({
      key: `role_${roleKey}`,
      title: meta.title,
      description: meta.description,
      active: wins >= 50,
      progressCurrent: Math.max(0, wins),
      progressTarget: 50,
      progressLabel: `${Math.max(0, wins)}/50 побед`,
    });
  }

  badges.push({
    key: "winner",
    title: "Победитель",
    description: "Доступен при общем проценте побед 90% и выше.",
    active: stats.totalWinRate >= 90,
    progressCurrent: Math.max(0, Math.round(stats.totalWinRate)),
    progressTarget: 90,
    progressLabel: `${Math.max(0, Math.round(stats.totalWinRate))}% / 90%`,
  });

  badges.push({
    key: "legend",
    title: "Легенда",
    description: "Игрок участвовал в эпохе Beta 0.4.5.",
    active: user.created_at.getTime() <= LEGEND_BETA_045_CUTOFF_UTC,
    progressCurrent: user.created_at.getTime() <= LEGEND_BETA_045_CUTOFF_UTC ? 1 : 0,
    progressTarget: 1,
    progressLabel:
      user.created_at.getTime() <= LEGEND_BETA_045_CUTOFF_UTC ? "Получен" : "Недоступен",
  });

  for (const [key, meta] of Object.entries(MANUAL_BADGE_META)) {
    const manualActive = manualBadgeMap.get(key) ?? false;
    const implicitCreator = key === "creator" && user.login.toLowerCase() === "berly";
    badges.push({
      key,
      title: meta.title,
      description: meta.description,
      active: manualActive || implicitCreator,
      progressCurrent: manualActive || implicitCreator ? 1 : 0,
      progressTarget: 1,
      progressLabel: manualActive || implicitCreator ? "Получен" : "Выдается вручную",
    });
  }

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
    created_at: Date;
  }>(
    `
      SELECT u.id, u.login, u.nickname, u.avatar, u.banner, u.bio, u.gender, u.birth_date, u.hide_age, u.selected_badge_key, u.created_at
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
  const manualBadgeMap = await getManualBadgeMap(row.id);
  const recentMatches = await getRecentMatchHistoryByUserId(row.id);
  const base = toPublicProfile(row);
  return {
    ...base,
    stats,
    badges: buildBadgeList({
      user: {
        id: row.id,
        login: row.login,
        created_at: row.created_at,
      },
      stats,
      manualBadgeMap,
    }),
    selectedBadgeKey: row.selected_badge_key ?? undefined,
    recentMatches,
    subscription: {
      tier: "none",
      label: "Без подписки",
    },
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
    created_at: Date;
  }>(
    `
      SELECT id, login, nickname, avatar, banner, bio, gender, birth_date, hide_age, selected_badge_key, created_at
      FROM auth_users
      WHERE id = $1
      LIMIT 1
    `,
    [userId],
  );
  if (!result.rowCount) return null;
  const row = result.rows[0];
  const stats = await getRoleStatsByUserId(row.id);
  const manualBadgeMap = await getManualBadgeMap(row.id);
  const recentMatches = await getRecentMatchHistoryByUserId(row.id);
  const base = toPublicProfile(row);
  return {
    ...base,
    stats,
    badges: buildBadgeList({
      user: {
        id: row.id,
        login: row.login,
        created_at: row.created_at,
      },
      stats,
      manualBadgeMap,
    }),
    selectedBadgeKey: row.selected_badge_key ?? undefined,
    recentMatches,
    subscription: {
      tier: "none",
      label: "Без подписки",
    },
  };
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


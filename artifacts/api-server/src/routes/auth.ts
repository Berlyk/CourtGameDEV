import crypto from "node:crypto";
import { Router } from "express";
import {
  applyPromoCodeByToken,
  assignSubscriptionByUserId,
  checkPasswordRecoveryEmailExists,
  changeEmailByTokenWithCode,
  changeEmailByToken,
  changePasswordByTokenWithCode,
  changePasswordByToken,
  confirmPasswordRecoveryByCode,
  clearUserBanByAdmin,
  deletePromoCodeByAdmin,
  findUserByAdminQuery,
  getAdminStaffRoleByUserId,
  getPublicUserProfileById,
  getProfileByToken,
  getUserByToken,
  listPromoCodesByAdmin,
  loginOrRegisterWithDiscord,
  loginOrRegisterWithGoogle,
  loginAccount,
  logoutByToken,
  registerAccount,
  requestEmailChangeCodeByToken,
  requestPasswordChangeCodeByToken,
  requestPasswordRecoveryCode,
  verifyPasswordRecoveryCode,
  setAdminStaffRoleByUserId,
  setUserBanByAdmin,
  upsertPromoCodeByAdmin,
  updateUserModerationByAdmin,
  updateProfileByToken,
} from "../lib/authStore.js";
import { syncUserProfileInActiveRooms } from "../socket/index.js";
import {
  createUserCasePack,
  deleteUserCasePack,
  getUserCasePackImportPreviewByShareCode,
  getUserCasePackDetails,
  importUserCasePackByShareCode,
  isUserCasePackAlreadyAddedByShareCode,
  listUserCasePacks,
  updateUserCasePack,
} from "../lib/userCasePacksStore.js";

const authRouter = Router();
const USER_CASE_PACKS_LIMIT = 4;
const REQUIRED_FACT_ROLES_BY_MODE: Record<number, string[]> = {
  3: ["plaintiff", "defendant"],
  4: ["plaintiff", "defendant", "prosecutor"],
  5: ["plaintiff", "defendant", "prosecutor", "defenseLawyer"],
  6: ["plaintiff", "defendant", "prosecutor", "defenseLawyer", "plaintiffLawyer"],
};
const USER_PACK_ROLE_LABELS: Record<string, string> = {
  plaintiff: "Истец",
  defendant: "Ответчик",
  prosecutor: "Прокурор",
  defenseLawyer: "Адвокат ответчика",
  plaintiffLawyer: "Адвокат истца",
};

function readBearerToken(value: string | undefined): string | null {
  if (!value) return null;
  const raw = value.trim();
  if (!raw) return null;
  if (raw.toLowerCase().startsWith("bearer ")) {
    const token = raw.slice(7).trim();
    return token || null;
  }
  return raw;
}

function getRequestToken(headers: Record<string, unknown>): string | null {
  const authorization = headers["authorization"];
  if (typeof authorization === "string") {
    return readBearerToken(authorization);
  }
  const xAuth = headers["x-auth-token"];
  if (typeof xAuth === "string") {
    return readBearerToken(xAuth);
  }
  return null;
}

function canManageUserCasePacks(user: {
  subscription?: {
    tier?: string | null;
    label?: string | null;
    plan?: string | null;
    name?: string | null;
    capabilities?: { canCreatePacks?: boolean | string | number | null } | null;
  } | null;
} | null): boolean {
  if (!user) return false;
  const capability = user.subscription?.capabilities?.canCreatePacks;
  if (
    capability === true ||
    capability === 1 ||
    String(capability ?? "")
      .trim()
      .toLowerCase() === "true"
  ) {
    return true;
  }
  const variants = [
    user.subscription?.tier,
    user.subscription?.label,
    user.subscription?.plan,
    user.subscription?.name,
  ]
    .map((value) =>
      String(value ?? "")
        .trim()
        .toLowerCase()
        .replace(/ё/g, "е"),
    )
    .filter(Boolean);
  return variants.some((value) => value.includes("arbiter") || value.includes("арбитр"));
}

function validateUserPackCasesPayload(casesInput: unknown): string | null {
  if (!Array.isArray(casesInput) || casesInput.length < 1) {
    return "Добавьте хотя бы одно дело в пак.";
  }
  for (let index = 0; index < casesInput.length; index += 1) {
    const caseNumber = index + 1;
    const row = casesInput[index];
    const source =
      row && typeof row === "object" && !Array.isArray(row)
        ? (row as Record<string, unknown>)
        : {};
    const title = String(source.title ?? "").trim();
    if (!title) {
      return `Дело #${caseNumber}: заполните название дела.`;
    }
    const truth = String(source.truth ?? "").trim();
    if (!truth) {
      return `Дело #${caseNumber}: заполните поле «Истина (обоснование)».`;
    }
    const evidenceRows = Array.isArray(source.evidence)
      ? source.evidence
          .map((item) => String(item ?? "").trim())
          .filter((item) => item.length > 0)
      : [];
    if (evidenceRows.length < 3) {
      return `Дело #${caseNumber}: заполните все 3 улики.`;
    }
    const mode = Number(source.modePlayerCount);
    const requiredRoles = REQUIRED_FACT_ROLES_BY_MODE[mode] ?? REQUIRED_FACT_ROLES_BY_MODE[3];
    const factsByRole =
      source.factsByRole && typeof source.factsByRole === "object" && !Array.isArray(source.factsByRole)
        ? (source.factsByRole as Record<string, unknown>)
        : {};
    for (const role of requiredRoles) {
      const facts = Array.isArray(factsByRole[role])
        ? (factsByRole[role] as unknown[])
            .map((item) => String(item ?? "").trim())
            .filter((item) => item.length > 0)
        : [];
      if (facts.length < 1) {
        const roleLabel = USER_PACK_ROLE_LABELS[role] ?? role;
        return `Дело #${caseNumber}: для роли «${roleLabel}» нужен минимум 1 факт.`;
      }
    }
  }
  return null;
}

function secureCompare(a: string, b: string): boolean {
  const left = Buffer.from(String(a), "utf8");
  const right = Buffer.from(String(b), "utf8");
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function resolveClientIp(req: Parameters<typeof authRouter.get>[1]): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0]?.trim() ?? "";
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return String(forwarded[0] ?? "").trim();
  }
  return String(req.ip ?? "").trim();
}

const DISCORD_STATE_TTL_MS = 10 * 60 * 1000;
const FALLBACK_OAUTH_STATE_SECRET = crypto.randomBytes(32).toString("hex");
const MAINTENANCE_MODE_ENABLED = false;
const MAINTENANCE_ACCESS_HEADER = "x-maintenance-access";
const MAINTENANCE_PASSWORD =
  "~lQR[g(K&7),<.4Z+?L)*N3E!FpbVqU<uUU]cuHn+3?]wU6pCWsHIxAy)41{u,D#";
const MAINTENANCE_ACCESS_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const FALLBACK_MAINTENANCE_SECRET = crypto.randomBytes(32).toString("hex");

function toBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function normalizePublicUrl(value: string | undefined | null): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  return raw.replace(/\/+$/, "");
}

function resolvePublicAppUrl(req: Parameters<typeof authRouter.get>[1]): string {
  const fromEnv =
    normalizePublicUrl(process.env.PUBLIC_APP_URL) ??
    normalizePublicUrl(process.env.APP_PUBLIC_URL) ??
    normalizePublicUrl(process.env.FRONTEND_PUBLIC_URL);
  if (fromEnv) return fromEnv;

  const forwardedProto = req.headers["x-forwarded-proto"];
  const proto =
    typeof forwardedProto === "string" && forwardedProto.trim()
      ? forwardedProto.split(",")[0]!.trim()
      : "https";
  const forwardedHost = req.headers["x-forwarded-host"];
  const hostRaw =
    typeof forwardedHost === "string" && forwardedHost.trim()
      ? forwardedHost
      : Array.isArray(forwardedHost) && forwardedHost.length
        ? String(forwardedHost[0] ?? "")
        : String(req.headers.host ?? "");
  const host = hostRaw.trim();
  if (!host) return "https://courtgame.site";
  return `${proto}://${host}`;
}

function readDiscordConfig() {
  const clientId = String(process.env.DISCORD_CLIENT_ID ?? "").trim();
  const clientSecret = String(process.env.DISCORD_CLIENT_SECRET ?? "").trim();
  const redirectUri = String(process.env.DISCORD_REDIRECT_URI ?? "").trim();
  return { clientId, clientSecret, redirectUri };
}

function readGoogleConfig() {
  const clientId = String(process.env.GOOGLE_CLIENT_ID ?? "").trim();
  const clientSecret = String(process.env.GOOGLE_CLIENT_SECRET ?? "").trim();
  const redirectUri = String(process.env.GOOGLE_REDIRECT_URI ?? "").trim();
  return { clientId, clientSecret, redirectUri };
}

function getDiscordStateSecret(): string {
  const configured = String(
    process.env.OAUTH_STATE_SECRET ?? process.env.AUTH_EMAIL_CODE_SECRET ?? "",
  ).trim();
  if (configured) return configured;
  return FALLBACK_OAUTH_STATE_SECRET;
}

function getMaintenanceSecret(): string {
  const configured = String(
    process.env.MAINTENANCE_ACCESS_SECRET ?? process.env.OAUTH_STATE_SECRET ?? "",
  ).trim();
  return configured || FALLBACK_MAINTENANCE_SECRET;
}

function signMaintenanceAccessToken(payloadPart: string): string {
  return crypto
    .createHmac("sha256", getMaintenanceSecret())
    .update(payloadPart, "utf8")
    .digest("base64url");
}

function createMaintenanceAccessToken(): string {
  const now = Date.now();
  const payloadPart = toBase64Url(
    JSON.stringify({
      ts: now,
      exp: now + MAINTENANCE_ACCESS_TTL_MS,
      nonce: crypto.randomUUID(),
    }),
  );
  return `${payloadPart}.${signMaintenanceAccessToken(payloadPart)}`;
}

function verifyMaintenanceAccessToken(rawToken: string | undefined | null): boolean {
  const token = String(rawToken ?? "").trim();
  if (!token) return false;
  const [payloadPart, signature] = token.split(".");
  if (!payloadPart || !signature) return false;
  const expected = signMaintenanceAccessToken(payloadPart);
  const left = Buffer.from(signature, "utf8");
  const right = Buffer.from(expected, "utf8");
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) {
    return false;
  }
  try {
    const payload = JSON.parse(fromBase64Url(payloadPart));
    const expiresAt = Number(payload?.exp ?? 0);
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function getMaintenanceAccessToken(headers: Record<string, unknown>): string | null {
  const direct = headers[MAINTENANCE_ACCESS_HEADER];
  if (typeof direct === "string" && direct.trim()) {
    return direct.trim();
  }
  const fallback = headers["x-maintenance-token"];
  if (typeof fallback === "string" && fallback.trim()) {
    return fallback.trim();
  }
  return null;
}

function signDiscordState(payloadPart: string): string {
  return crypto.createHmac("sha256", getDiscordStateSecret()).update(payloadPart, "utf8").digest("base64url");
}

function createDiscordState(): string {
  const payloadPart = toBase64Url(
    JSON.stringify({
      ts: Date.now(),
      nonce: crypto.randomUUID(),
    }),
  );
  const signature = signDiscordState(payloadPart);
  return `${payloadPart}.${signature}`;
}

function verifyDiscordState(state: string): boolean {
  const [payloadPart, signature] = String(state ?? "").split(".");
  if (!payloadPart || !signature) return false;
  const expected = signDiscordState(payloadPart);
  const left = Buffer.from(signature, "utf8");
  const right = Buffer.from(expected, "utf8");
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) {
    return false;
  }
  let payload: any = null;
  try {
    payload = JSON.parse(fromBase64Url(payloadPart));
  } catch {
    return false;
  }
  const issuedAt = Number(payload?.ts ?? 0);
  if (!Number.isFinite(issuedAt) || issuedAt <= 0) return false;
  if (Date.now() - issuedAt > DISCORD_STATE_TTL_MS) return false;
  return true;
}

function redirectDiscordResult(
  req: Parameters<typeof authRouter.get>[1],
  res: Parameters<typeof authRouter.get>[2],
  payload: { token?: string; error?: string },
) {
  const target = new URL("/", resolvePublicAppUrl(req));
  const hashParams = new URLSearchParams();
  if (payload.token) {
    hashParams.set("discord_token", payload.token);
  }
  if (payload.error) {
    hashParams.set("discord_error", payload.error);
  }
  target.hash = hashParams.toString();
  return res.redirect(target.toString());
}

function redirectGoogleResult(
  req: Parameters<typeof authRouter.get>[1],
  res: Parameters<typeof authRouter.get>[2],
  payload: { token?: string; error?: string },
) {
  const target = new URL("/", resolvePublicAppUrl(req));
  const hashParams = new URLSearchParams();
  if (payload.token) {
    hashParams.set("google_token", payload.token);
  }
  if (payload.error) {
    hashParams.set("google_error", payload.error);
  }
  target.hash = hashParams.toString();
  return res.redirect(target.toString());
}

const ADMIN_GUARD_WINDOW_MS = 15 * 60 * 1000;
const ADMIN_GUARD_BLOCK_MS = 15 * 60 * 1000;
const ADMIN_GUARD_MAX_FAILS = 10;
const ADMIN_SESSION_TTL_MS = 10 * 60 * 1000;
const ADMIN_OWNER_IP_WHITELIST = ["83.243.91.208"];
const adminGuardAttempts = new Map<
  string,
  { failedCount: number; windowStartMs: number; blockUntilMs: number }
>();
const adminSessions = new Map<
  string,
  { token: string; userId: string; ip: string; userAgent: string; expiresAtMs: number }
>();

type AdminAccessRole = "owner" | "administrator" | "moderator";

function cleanupAdminState(nowMs: number) {
  for (const [ip, entry] of adminGuardAttempts.entries()) {
    if (entry.blockUntilMs > 0 && entry.blockUntilMs > nowMs) continue;
    if (nowMs - entry.windowStartMs > ADMIN_GUARD_WINDOW_MS) {
      adminGuardAttempts.delete(ip);
    }
  }
  for (const [sessionId, entry] of adminSessions.entries()) {
    if (entry.expiresAtMs <= nowMs) {
      adminSessions.delete(sessionId);
    }
  }
}

function registerAdminFailure(ip: string, nowMs: number): number {
  const normalizedIp = ip || "unknown";
  const existing = adminGuardAttempts.get(normalizedIp);
  if (!existing || nowMs - existing.windowStartMs > ADMIN_GUARD_WINDOW_MS) {
    adminGuardAttempts.set(normalizedIp, {
      failedCount: 1,
      windowStartMs: nowMs,
      blockUntilMs: 0,
    });
    return 1;
  }
  const nextFails = existing.failedCount + 1;
  const nextBlock =
    nextFails >= ADMIN_GUARD_MAX_FAILS ? nowMs + ADMIN_GUARD_BLOCK_MS : existing.blockUntilMs;
  adminGuardAttempts.set(normalizedIp, {
    failedCount: nextFails,
    windowStartMs: existing.windowStartMs,
    blockUntilMs: nextBlock,
  });
  return nextFails;
}

function clearAdminFailures(ip: string) {
  adminGuardAttempts.delete(ip || "unknown");
}

function getAdminBlockRemainingMs(ip: string, nowMs: number): number {
  const entry = adminGuardAttempts.get(ip || "unknown");
  if (!entry) return 0;
  if (entry.blockUntilMs <= nowMs) return 0;
  return entry.blockUntilMs - nowMs;
}

function readAdminSession(headers: Record<string, unknown>): string {
  const raw = headers["x-admin-session"];
  if (typeof raw === "string") return raw.trim();
  if (Array.isArray(raw)) return String(raw[0] ?? "").trim();
  return "";
}

function resolveUserAgent(headers: Record<string, unknown>): string {
  const raw = headers["user-agent"];
  if (typeof raw === "string") return raw.trim();
  if (Array.isArray(raw)) return String(raw[0] ?? "").trim();
  return "";
}

function getAdminAllowedIps(): Set<string> {
  const fromEnv = String(process.env.ADMIN_ALLOWED_IPS ?? "")
    .split(",")
    .map((ip) => ip.trim())
    .filter(Boolean);
  return new Set([...ADMIN_OWNER_IP_WHITELIST, ...fromEnv]);
}

function mintAdminSession(input: {
  token: string;
  userId: string;
  ip: string;
  userAgent: string;
}): string {
  const sessionId = crypto.randomUUID();
  adminSessions.set(sessionId, {
    token: input.token,
    userId: input.userId,
    ip: input.ip || "unknown",
    userAgent: input.userAgent,
    expiresAtMs: Date.now() + ADMIN_SESSION_TTL_MS,
  });
  return sessionId;
}

function validateAdminSession(input: {
  sessionId: string;
  token: string;
  userId: string;
  ip: string;
  userAgent: string;
}): boolean {
  const entry = adminSessions.get(input.sessionId);
  if (!entry) return false;
  const nowMs = Date.now();
  if (entry.expiresAtMs <= nowMs) {
    adminSessions.delete(input.sessionId);
    return false;
  }
  if (
    entry.token !== input.token ||
    entry.userId !== input.userId ||
    entry.ip !== (input.ip || "unknown") ||
    entry.userAgent !== input.userAgent
  ) {
    return false;
  }
  entry.expiresAtMs = nowMs + ADMIN_SESSION_TTL_MS;
  adminSessions.set(input.sessionId, entry);
  return true;
}

async function requireAdmin(
  req: Parameters<typeof authRouter.get>[1],
  res: Parameters<typeof authRouter.get>[2],
  options?: { requireSession?: boolean },
) {
  const nowMs = Date.now();
  cleanupAdminState(nowMs);
  const clientIp = resolveClientIp(req) || "unknown";
  const clientUserAgent = resolveUserAgent(req.headers as Record<string, unknown>);
  const blockRemainingMs = getAdminBlockRemainingMs(clientIp, nowMs);
  if (blockRemainingMs > 0) {
    res
      .status(429)
      .json({ message: `Слишком много попыток. Повторите через ${Math.ceil(blockRemainingMs / 1000)} сек.` });
    return null;
  }

  const token = getRequestToken(req.headers as Record<string, unknown>);
  if (!token) {
    registerAdminFailure(clientIp, nowMs);
    res.status(401).json({ message: "Не авторизован." });
    return null;
  }
  const adminUser = await getUserByToken(token, clientIp);
  if (!adminUser) {
    registerAdminFailure(clientIp, nowMs);
    res.status(403).json({ message: "Недостаточно прав." });
    return null;
  }
  const adminLogin = String(process.env.ADMIN_PANEL_LOGIN ?? "berly").trim().toLowerCase();
  const requiredAdminUserId = String(process.env.ADMIN_USER_ID ?? "").trim();
  const isOwnerByLogin = adminUser.login.trim().toLowerCase() === adminLogin;
  const isOwnerById = requiredAdminUserId ? adminUser.id === requiredAdminUserId : true;
  const isOwner = isOwnerByLogin && isOwnerById;
  if (adminUser.ban?.isBanned && !isOwner) {
    registerAdminFailure(clientIp, nowMs);
    res.status(403).json({ message: "Аккаунт заблокирован." });
    return null;
  }

  let accessRole: AdminAccessRole | null = null;
  if (isOwner) {
    accessRole = "owner";
  } else {
    const staffRole = await getAdminStaffRoleByUserId(adminUser.id);
    if (staffRole === "administrator" || staffRole === "moderator") {
      accessRole = staffRole;
    }
  }

  if (!accessRole) {
    registerAdminFailure(clientIp, nowMs);
    res.status(403).json({ message: "Недостаточно прав." });
    return null;
  }
  const requiredKey = String(process.env.ADMIN_PANEL_KEY ?? "").trim();
  if (!requiredKey) {
    registerAdminFailure(clientIp, nowMs);
    res.status(503).json({ message: "ADMIN_PANEL_KEY не настроен на сервере." });
    return null;
  }
  const providedRaw = req.headers["x-admin-key"];
  const provided =
    typeof providedRaw === "string"
      ? providedRaw.trim()
      : Array.isArray(providedRaw)
        ? String(providedRaw[0] ?? "").trim()
        : "";
  if (!provided || !secureCompare(provided, requiredKey)) {
    registerAdminFailure(clientIp, nowMs);
    res.status(403).json({ message: "Неверный ключ админ-панели." });
    return null;
  }
  const allowedIps = getAdminAllowedIps();
  if (allowedIps.size > 0) {
    if (!clientIp || !allowedIps.has(clientIp)) {
      registerAdminFailure(clientIp, nowMs);
      res.status(403).json({ message: "IP не разрешен для админ-панели." });
      return null;
    }
  }

  if (options?.requireSession) {
    const adminSession = readAdminSession(req.headers as Record<string, unknown>);
    if (
      !adminSession ||
      !validateAdminSession({
        sessionId: adminSession,
        token,
        userId: adminUser.id,
        ip: clientIp,
        userAgent: clientUserAgent,
      })
    ) {
      registerAdminFailure(clientIp, nowMs);
      res.status(403).json({ message: "Сессия админ-панели истекла. Подтвердите доступ снова." });
      return null;
    }
  }

  clearAdminFailures(clientIp);
  return { token, adminUser, clientIp, clientUserAgent, accessRole };
}

function hasAdminPermission(role: AdminAccessRole, permission: string): boolean {
  if (role === "owner") return true;
  if (permission === "find-user") return role === "administrator" || role === "moderator";
  if (permission === "moderate-profile") return role === "administrator" || role === "moderator";
  if (permission === "ban-user") return role === "administrator";
  if (permission === "manage-moderators") return role === "administrator";
  if (permission === "manage-promos") return false;
  if (permission === "manage-subscriptions") return false;
  return false;
}

authRouter.get("/auth/discord/start", async (req, res) => {
  const { clientId, redirectUri } = readDiscordConfig();
  if (!clientId || !redirectUri) {
    return redirectDiscordResult(req, res, {
      error: "Discord OAuth не настроен на сервере.",
    });
  }
  const state = createDiscordState();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "identify email",
    state,
  });
  return res.redirect(`https://discord.com/api/oauth2/authorize?${params.toString()}`);
});

authRouter.get("/auth/discord/callback", async (req, res) => {
  const { clientId, clientSecret, redirectUri } = readDiscordConfig();
  if (!clientId || !clientSecret || !redirectUri) {
    return redirectDiscordResult(req, res, {
      error: "Discord OAuth не настроен на сервере.",
    });
  }

  const code = String(req.query?.code ?? "").trim();
  const state = String(req.query?.state ?? "").trim();
  const oauthError = String(req.query?.error ?? "").trim();

  if (oauthError) {
    return redirectDiscordResult(req, res, {
      error: "Вход через Discord отменен или недоступен.",
    });
  }
  if (!state || !verifyDiscordState(state)) {
    return redirectDiscordResult(req, res, {
      error: "Не удалось подтвердить вход через Discord.",
    });
  }
  if (!code) {
    return redirectDiscordResult(req, res, {
      error: "Discord не вернул код авторизации.",
    });
  }

  try {
    const tokenParams = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    });
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: tokenParams.toString(),
    });
    if (!tokenResponse.ok) {
      throw new Error("Не удалось получить access token Discord.");
    }
    const tokenPayload: any = await tokenResponse.json().catch(() => ({}));
    const accessToken = String(tokenPayload?.access_token ?? "").trim();
    if (!accessToken) {
      throw new Error("Discord не вернул access token.");
    }

    const profileResponse = await fetch("https://discord.com/api/users/@me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!profileResponse.ok) {
      throw new Error("Не удалось получить профиль Discord.");
    }
    const discordProfile: any = await profileResponse.json().catch(() => ({}));
    const email = String(discordProfile?.email ?? "").trim();
    if (!email || !email.includes("@")) {
      throw new Error("В Discord-профиле не найдена почта.");
    }
    const username =
      String(discordProfile?.global_name ?? "").trim() ||
      String(discordProfile?.username ?? "").trim() ||
      email.split("@")[0]!;

    const { token } = await loginOrRegisterWithDiscord({
      email,
      username,
      clientIp: resolveClientIp(req),
    });
    return redirectDiscordResult(req, res, { token });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка входа через Discord.";
    return redirectDiscordResult(req, res, { error: message });
  }
});

authRouter.get("/auth/google/start", async (req, res) => {
  const { clientId, redirectUri } = readGoogleConfig();
  if (!clientId || !redirectUri) {
    return redirectGoogleResult(req, res, {
      error: "Google OAuth не настроен на сервере.",
    });
  }
  const state = createDiscordState();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

authRouter.get("/auth/google/callback", async (req, res) => {
  const { clientId, clientSecret, redirectUri } = readGoogleConfig();
  if (!clientId || !clientSecret || !redirectUri) {
    return redirectGoogleResult(req, res, {
      error: "Google OAuth не настроен на сервере.",
    });
  }

  const code = String(req.query?.code ?? "").trim();
  const state = String(req.query?.state ?? "").trim();
  const oauthError = String(req.query?.error ?? "").trim();

  if (oauthError) {
    return redirectGoogleResult(req, res, {
      error: "Вход через Google отменен или недоступен.",
    });
  }
  if (!state || !verifyDiscordState(state)) {
    return redirectGoogleResult(req, res, {
      error: "Не удалось подтвердить вход через Google.",
    });
  }
  if (!code) {
    return redirectGoogleResult(req, res, {
      error: "Google не вернул код авторизации.",
    });
  }

  try {
    const tokenParams = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    });
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: tokenParams.toString(),
    });
    if (!tokenResponse.ok) {
      throw new Error("Не удалось получить access token Google.");
    }
    const tokenPayload: any = await tokenResponse.json().catch(() => ({}));
    const accessToken = String(tokenPayload?.access_token ?? "").trim();
    if (!accessToken) {
      throw new Error("Google не вернул access token.");
    }

    const profileResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!profileResponse.ok) {
      throw new Error("Не удалось получить профиль Google.");
    }
    const googleProfile: any = await profileResponse.json().catch(() => ({}));
    const email = String(googleProfile?.email ?? "").trim();
    if (!email || !email.includes("@")) {
      throw new Error("В Google-профиле не найдена почта.");
    }
    const name =
      String(googleProfile?.name ?? "").trim() ||
      String(googleProfile?.given_name ?? "").trim() ||
      email.split("@")[0]!;

    const { token } = await loginOrRegisterWithGoogle({
      email,
      name,
      clientIp: resolveClientIp(req),
    });
    return redirectGoogleResult(req, res, { token });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка входа через Google.";
    return redirectGoogleResult(req, res, { error: message });
  }
});

authRouter.post("/auth/register", async (req, res) => {
  try {
    const login = String(req.body?.login ?? "").trim();
    const email = String(req.body?.email ?? "").trim();
    const password = String(req.body?.password ?? "");
    const confirmPassword = String(req.body?.confirmPassword ?? "");
    const acceptRules = Boolean(req.body?.acceptRules);

    if (!login || login.length < 3) {
      return res.status(400).json({ message: "Логин должен быть не короче 3 символов." });
    }
    if (!email || !email.includes("@")) {
      return res.status(400).json({ message: "Введите корректную почту." });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ message: "Пароль должен быть не короче 6 символов." });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Пароли не совпадают." });
    }
    if (!acceptRules) {
      return res
        .status(400)
        .json({ message: "Нужно принять правила сайта." });
    }

    const { user, token } = await registerAccount({
      login,
      email,
      password,
      nickname: login,
      clientIp: resolveClientIp(req),
    });
    return res.status(201).json({ user, token });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось зарегистрироваться.";
    return res.status(400).json({ message });
  }
});

authRouter.post("/auth/login", async (req, res) => {
  try {
    const loginOrEmail = String(req.body?.loginOrEmail ?? "").trim();
    const password = String(req.body?.password ?? "");
    if (!loginOrEmail || !password) {
      return res.status(400).json({ message: "Введите логин/email и пароль." });
    }

    const { user, token } = await loginAccount({
      loginOrEmail,
      password,
      clientIp: resolveClientIp(req),
    });
    return res.status(200).json({ user, token });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось выполнить вход.";
    return res.status(401).json({ message });
  }
});

authRouter.get("/auth/maintenance/status", async (req, res) => {
  if (!MAINTENANCE_MODE_ENABLED) {
    return res.json({ enabled: false, unlocked: true });
  }
  const token = getMaintenanceAccessToken(req.headers as Record<string, unknown>);
  return res.json({
    enabled: true,
    unlocked: verifyMaintenanceAccessToken(token),
  });
});

authRouter.post("/auth/maintenance/unlock", async (req, res) => {
  if (!MAINTENANCE_MODE_ENABLED) {
    return res.json({ ok: true, enabled: false, unlocked: true, token: null });
  }
  const password = String(req.body?.password ?? "");
  if (!password || !secureCompare(password, MAINTENANCE_PASSWORD)) {
    return res.status(401).json({ message: "Invalid maintenance password." });
  }
  return res.json({
    ok: true,
    enabled: true,
    unlocked: true,
    token: createMaintenanceAccessToken(),
  });
});

authRouter.get("/auth/me", async (req, res) => {
  const token = getRequestToken(req.headers as Record<string, unknown>);
  if (!token) {
    return res.status(401).json({ message: "Не авторизован." });
  }
  const user = await getUserByToken(token, resolveClientIp(req));
  if (!user) {
    return res.status(401).json({ message: "Сессия недействительна." });
  }
  return res.status(200).json({ user });
});

authRouter.get("/auth/profile", async (req, res) => {
  const token = getRequestToken(req.headers as Record<string, unknown>);
  if (!token) {
    return res.status(401).json({ message: "Не авторизован." });
  }
  const profile = await getProfileByToken(token, resolveClientIp(req));
  if (!profile) {
    return res.status(401).json({ message: "Сессия недействительна." });
  }
  return res.status(200).json({ profile });
});

authRouter.get("/auth/case-packs", async (req, res) => {
  const token = getRequestToken(req.headers as Record<string, unknown>);
  if (!token) {
    return res.status(401).json({ message: "Не авторизован." });
  }
  const user = await getUserByToken(token, resolveClientIp(req));
  if (!user) {
    return res.status(401).json({ message: "Сессия недействительна." });
  }
  try {
    const packs = await listUserCasePacks(user.id);
    return res.status(200).json({ packs });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось загрузить паки.";
    return res.status(400).json({ message });
  }
});

authRouter.post("/auth/case-packs", async (req, res) => {
  const token = getRequestToken(req.headers as Record<string, unknown>);
  if (!token) {
    return res.status(401).json({ message: "Не авторизован." });
  }
  const user = await getUserByToken(token, resolveClientIp(req));
  if (!user) {
    return res.status(401).json({ message: "Сессия недействительна." });
  }
  if (!canManageUserCasePacks(user)) {
    return res.status(403).json({
      message: "Создание пользовательских паков доступно только для подписки «Арбитр».",
    });
  }
  try {
    const existingPacks = await listUserCasePacks(user.id);
    if (existingPacks.length >= USER_CASE_PACKS_LIMIT) {
      return res.status(400).json({
        message: `Можно хранить максимум ${USER_CASE_PACKS_LIMIT} пользовательских паков. Удалите один из текущих.`,
      });
    }
    const payloadCases = Array.isArray(req.body?.cases) ? req.body.cases : [];
    const payloadValidationError = validateUserPackCasesPayload(payloadCases);
    if (payloadValidationError) {
      return res.status(400).json({ message: payloadValidationError });
    }
    const pack = await createUserCasePack(user.id, {
      title: req.body?.title,
      description: req.body?.description,
      color: req.body?.color,
      cases: payloadCases,
    });
    return res.status(200).json({ ok: true, pack });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось создать пак.";
    return res.status(400).json({ message });
  }
});

authRouter.get("/auth/case-packs/import-preview", async (req, res) => {
  try {
    const shareCode =
      typeof req.query?.shareCode === "string" ? req.query.shareCode : String(req.query?.shareCode ?? "");
    const preview = await getUserCasePackImportPreviewByShareCode(shareCode);
    let alreadyAdded = false;
    let blockReason: "none" | "no_access" | "limit" | "already_added" = "none";
    const token = getRequestToken(req.headers as Record<string, unknown>);
    if (!token) {
      blockReason = "no_access";
    } else {
      const user = await getUserByToken(token, resolveClientIp(req));
      if (!user || !canManageUserCasePacks(user)) {
        blockReason = "no_access";
      } else {
        const existingPacks = await listUserCasePacks(user.id);
        if (existingPacks.length >= USER_CASE_PACKS_LIMIT) {
          blockReason = "limit";
        }
        alreadyAdded = await isUserCasePackAlreadyAddedByShareCode(user.id, shareCode);
        if (alreadyAdded) {
          blockReason = "already_added";
        }
      }
    }
    return res.status(200).json({ ok: true, preview, alreadyAdded, blockReason });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось загрузить предпросмотр пака.";
    return res.status(400).json({ message });
  }
});

authRouter.get("/auth/case-packs/:packKey", async (req, res) => {
  const token = getRequestToken(req.headers as Record<string, unknown>);
  if (!token) {
    return res.status(401).json({ message: "Не авторизован." });
  }
  const user = await getUserByToken(token, resolveClientIp(req));
  if (!user) {
    return res.status(401).json({ message: "Сессия недействительна." });
  }
  if (!canManageUserCasePacks(user)) {
    return res.status(403).json({
      message: "Редактирование пользовательских паков доступно только для подписки «Арбитр».",
    });
  }
  try {
    const packKey = String(req.params?.packKey ?? "").trim();
    const payload = await getUserCasePackDetails(user.id, packKey);
    return res.status(200).json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось загрузить пак.";
    return res.status(400).json({ message });
  }
});

authRouter.patch("/auth/case-packs/:packKey", async (req, res) => {
  const token = getRequestToken(req.headers as Record<string, unknown>);
  if (!token) {
    return res.status(401).json({ message: "Не авторизован." });
  }
  const user = await getUserByToken(token, resolveClientIp(req));
  if (!user) {
    return res.status(401).json({ message: "Сессия недействительна." });
  }
  if (!canManageUserCasePacks(user)) {
    return res.status(403).json({
      message: "Редактирование пользовательских паков доступно только для подписки «Арбитр».",
    });
  }
  try {
    const packKey = String(req.params?.packKey ?? "").trim();
    const payloadCases = Array.isArray(req.body?.cases) ? req.body.cases : [];
    const payloadValidationError = validateUserPackCasesPayload(payloadCases);
    if (payloadValidationError) {
      return res.status(400).json({ message: payloadValidationError });
    }
    const pack = await updateUserCasePack(user.id, packKey, {
      title: req.body?.title,
      description: req.body?.description,
      color: req.body?.color,
      cases: payloadCases,
    });
    return res.status(200).json({ ok: true, pack });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось обновить пак.";
    return res.status(400).json({ message });
  }
});

authRouter.delete("/auth/case-packs/:packKey", async (req, res) => {
  const token = getRequestToken(req.headers as Record<string, unknown>);
  if (!token) {
    return res.status(401).json({ message: "Не авторизован." });
  }
  const user = await getUserByToken(token, resolveClientIp(req));
  if (!user) {
    return res.status(401).json({ message: "Сессия недействительна." });
  }
  if (!canManageUserCasePacks(user)) {
    return res.status(403).json({
      message: "Удаление пользовательских паков доступно только для подписки «Арбитр».",
    });
  }
  try {
    const packKey = String(req.params?.packKey ?? "").trim();
    await deleteUserCasePack(user.id, packKey);
    return res.status(200).json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось удалить пак.";
    return res.status(400).json({ message });
  }
});

authRouter.post("/auth/case-packs/import", async (req, res) => {
  const token = getRequestToken(req.headers as Record<string, unknown>);
  if (!token) {
    return res.status(401).json({ message: "Не авторизован." });
  }
  const user = await getUserByToken(token, resolveClientIp(req));
  if (!user) {
    return res.status(401).json({ message: "Сессия недействительна." });
  }
  if (!canManageUserCasePacks(user)) {
    return res.status(403).json({
      message: "Импорт пользовательских паков доступен только для подписки «Арбитр».",
    });
  }
  try {
    const existingPacks = await listUserCasePacks(user.id);
    if (existingPacks.length >= USER_CASE_PACKS_LIMIT) {
      return res.status(400).json({
        message: `Можно хранить максимум ${USER_CASE_PACKS_LIMIT} пользовательских паков. Удалите один из текущих.`,
      });
    }
    const shareCode = String(req.body?.shareCode ?? "").trim();
    const pack = await importUserCasePackByShareCode(user.id, shareCode);
    return res.status(200).json({ ok: true, pack });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось импортировать пак.";
    return res.status(400).json({ message });
  }
});

authRouter.post("/auth/logout", async (req, res) => {
  const token = getRequestToken(req.headers as Record<string, unknown>);
  if (token) {
    await logoutByToken(token);
  }
  return res.status(200).json({ ok: true });
});

authRouter.patch("/auth/profile", async (req, res) => {
  const token = getRequestToken(req.headers as Record<string, unknown>);
  if (!token) {
    return res.status(401).json({ message: "Не авторизован." });
  }
  try {
    const nickname =
      typeof req.body?.nickname === "string" ? req.body.nickname.slice(0, 20) : undefined;
    const avatar =
      req.body?.avatar === null || typeof req.body?.avatar === "string"
        ? req.body.avatar
        : undefined;
    const banner =
      req.body?.banner === null || typeof req.body?.banner === "string"
        ? req.body.banner
        : undefined;
    const bio =
      req.body?.bio === null || typeof req.body?.bio === "string"
        ? req.body.bio
        : undefined;
    const gender =
      req.body?.gender === null || typeof req.body?.gender === "string"
        ? req.body.gender
        : undefined;
    const birthDate =
      req.body?.birthDate === null || typeof req.body?.birthDate === "string"
        ? req.body.birthDate
        : undefined;
    const hideAge =
      typeof req.body?.hideAge === "boolean" ? req.body.hideAge : undefined;
    const selectedBadgeKey =
      req.body?.selectedBadgeKey === null || typeof req.body?.selectedBadgeKey === "string"
        ? req.body.selectedBadgeKey
        : undefined;
    const preferredRole =
      req.body?.preferredRole === null || typeof req.body?.preferredRole === "string"
        ? req.body.preferredRole
        : undefined;
    const updatedUser = await updateProfileByToken(token, {
      nickname,
      avatar,
      banner,
      bio,
      gender:
        gender === "male" || gender === "female" || gender === "other" || gender === null
          ? gender
          : undefined,
      birthDate,
      hideAge,
      selectedBadgeKey,
      preferredRole:
        preferredRole === "judge" ||
        preferredRole === "plaintiff" ||
        preferredRole === "defendant" ||
        preferredRole === "defenseLawyer" ||
        preferredRole === "prosecutor" ||
        preferredRole === "plaintiffLawyer" ||
        preferredRole === null
          ? preferredRole
          : undefined,
    });
    if (!updatedUser) {
      return res.status(401).json({ message: "Сессия недействительна." });
    }
    return res.status(200).json({ user: updatedUser });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось обновить профиль.";
    return res.status(400).json({ message });
  }
});

authRouter.patch("/auth/password", async (req, res) => {
  const token = getRequestToken(req.headers as Record<string, unknown>);
  if (!token) {
    return res.status(401).json({ message: "Не авторизован." });
  }

  try {
    const currentPassword = String(req.body?.currentPassword ?? "");
    const nextPassword = String(req.body?.nextPassword ?? "");
    if (!currentPassword || !nextPassword) {
      return res.status(400).json({ message: "Заполните обязательные поля." });
    }
    if (nextPassword.length < 8) {
      return res.status(400).json({ message: "Пароль должен быть не короче 8 символов." });
    }

    const user = await changePasswordByToken(token, currentPassword, nextPassword);
    if (!user) {
      return res.status(401).json({ message: "Сессия недействительна." });
    }

    return res.status(200).json({ user, ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось сменить пароль.";
    return res.status(400).json({ message });
  }
});

authRouter.post("/auth/password/code/request", async (req, res) => {
  const token = getRequestToken(req.headers as Record<string, unknown>);
  if (!token) {
    return res.status(401).json({ message: "Не авторизован." });
  }
  try {
    const result = await requestPasswordChangeCodeByToken(token, resolveClientIp(req));
    if (!result) {
      return res.status(401).json({ message: "Сессия недействительна." });
    }
    return res.status(200).json({
      ok: true,
      maskedEmail: result.maskedEmail,
      message: `Код отправлен на ${result.maskedEmail}.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось отправить код.";
    return res.status(400).json({ message });
  }
});

authRouter.patch("/auth/password/code/confirm", async (req, res) => {
  const token = getRequestToken(req.headers as Record<string, unknown>);
  if (!token) {
    return res.status(401).json({ message: "Не авторизован." });
  }
  try {
    const code = String(req.body?.code ?? "");
    const nextPassword = String(req.body?.nextPassword ?? "");
    if (!code || !nextPassword) {
      return res.status(400).json({ message: "Заполните обязательные поля." });
    }
    if (nextPassword.length < 8) {
      return res.status(400).json({ message: "Пароль должен быть не короче 8 символов." });
    }
    const user = await changePasswordByTokenWithCode(token, code, nextPassword);
    if (!user) {
      return res.status(401).json({ message: "Сессия недействительна." });
    }
    return res.status(200).json({ ok: true, user });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось сменить пароль.";
    return res.status(400).json({ message });
  }
});

authRouter.patch("/auth/email", async (req, res) => {
  const token = getRequestToken(req.headers as Record<string, unknown>);
  if (!token) {
    return res.status(401).json({ message: "Не авторизован." });
  }

  try {
    const currentPassword = String(req.body?.currentPassword ?? "");
    const nextEmail = String(req.body?.nextEmail ?? "").trim();
    if (!currentPassword || !nextEmail) {
      return res.status(400).json({ message: "Заполните обязательные поля." });
    }
    if (!nextEmail.includes("@")) {
      return res.status(400).json({ message: "Введите корректную почту." });
    }

    const user = await changeEmailByToken(token, currentPassword, nextEmail);
    if (!user) {
      return res.status(401).json({ message: "Сессия недействительна." });
    }
    return res.status(200).json({ user, ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось сменить почту.";
    return res.status(400).json({ message });
  }
});

authRouter.post("/auth/email/code/request", async (req, res) => {
  const token = getRequestToken(req.headers as Record<string, unknown>);
  if (!token) {
    return res.status(401).json({ message: "Не авторизован." });
  }
  try {
    const currentPassword = String(req.body?.currentPassword ?? "");
    const nextEmail = String(req.body?.nextEmail ?? "").trim();
    if (!currentPassword || !nextEmail) {
      return res.status(400).json({ message: "Заполните обязательные поля." });
    }
    if (!nextEmail.includes("@")) {
      return res.status(400).json({ message: "Введите корректную почту." });
    }
    const result = await requestEmailChangeCodeByToken(
      token,
      currentPassword,
      nextEmail,
      resolveClientIp(req),
    );
    if (!result) {
      return res.status(401).json({ message: "Сессия недействительна." });
    }
    return res.status(200).json({
      ok: true,
      maskedEmail: result.maskedEmail,
      message: `Код отправлен на ${result.maskedEmail}.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось отправить код.";
    return res.status(400).json({ message });
  }
});

authRouter.patch("/auth/email/code/confirm", async (req, res) => {
  const token = getRequestToken(req.headers as Record<string, unknown>);
  if (!token) {
    return res.status(401).json({ message: "Не авторизован." });
  }
  try {
    const nextEmail = String(req.body?.nextEmail ?? "").trim();
    const code = String(req.body?.code ?? "");
    if (!nextEmail || !code) {
      return res.status(400).json({ message: "Заполните обязательные поля." });
    }
    if (!nextEmail.includes("@")) {
      return res.status(400).json({ message: "Введите корректную почту." });
    }
    const user = await changeEmailByTokenWithCode(token, nextEmail, code);
    if (!user) {
      return res.status(401).json({ message: "Сессия недействительна." });
    }
    return res.status(200).json({ ok: true, user });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось сменить почту.";
    return res.status(400).json({ message });
  }
});

authRouter.post("/auth/password/recovery/request", async (req, res) => {
  const email = String(req.body?.email ?? "").trim();
  if (!email) {
    return res.status(400).json({ message: "Введите почту." });
  }
  if (!email.includes("@")) {
    return res.status(400).json({ message: "Введите корректную почту." });
  }
  try {
    const exists = await checkPasswordRecoveryEmailExists(email);
    if (!exists) {
      return res.status(404).json({ message: "Аккаунт с такой почтой не найден." });
    }
    await requestPasswordRecoveryCode(email, resolveClientIp(req));
    return res.status(200).json({
      ok: true,
      message: "Код отправлен на почту.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось отправить код.";
    return res.status(400).json({ message });
  }
});

authRouter.post("/auth/password/recovery/verify", async (req, res) => {
  const email = String(req.body?.email ?? "").trim();
  const code = String(req.body?.code ?? "");
  if (!email || !code) {
    return res.status(400).json({ message: "Заполните обязательные поля." });
  }
  if (!email.includes("@")) {
    return res.status(400).json({ message: "Введите корректную почту." });
  }
  try {
    await verifyPasswordRecoveryCode(email, code);
    return res.status(200).json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Код неверный или уже истек.";
    return res.status(400).json({ message });
  }
});

authRouter.post("/auth/password/recovery/confirm", async (req, res) => {
  const email = String(req.body?.email ?? "").trim();
  const code = String(req.body?.code ?? "");
  const nextPassword = String(req.body?.nextPassword ?? "");
  if (!email || !code || !nextPassword) {
    return res.status(400).json({ message: "Заполните обязательные поля." });
  }
  if (!email.includes("@")) {
    return res.status(400).json({ message: "Введите корректную почту." });
  }
  if (nextPassword.length < 8) {
    return res.status(400).json({ message: "Пароль должен быть не короче 8 символов." });
  }
  try {
    await confirmPasswordRecoveryByCode(email, code, nextPassword);
    return res.status(200).json({
      ok: true,
      message: "Пароль обновлен. Войдите с новым паролем.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось восстановить пароль.";
    return res.status(400).json({ message });
  }
});

authRouter.get("/auth/public/:id", async (req, res) => {
  const id = String(req.params?.id ?? "").trim();
  if (!id) {
    return res.status(400).json({ message: "Нужен идентификатор игрока." });
  }
  const profile = await getPublicUserProfileById(id);
  if (!profile) {
    return res.status(404).json({ message: "Профиль игрока не найден." });
  }
  return res.status(200).json({ profile });
});

authRouter.patch("/auth/promo/apply", async (req, res) => {
  const token = getRequestToken(req.headers as Record<string, unknown>);
  if (!token) {
    return res.status(401).json({ message: "Не авторизован." });
  }
  const code = String(req.body?.code ?? "").trim();
  if (!code) {
    return res.status(400).json({ message: "Введите промокод." });
  }
  try {
    const result = await applyPromoCodeByToken(token, code);
    if (!result) {
      return res.status(401).json({ message: "Сессия недействительна." });
    }
    return res.status(200).json({
      ok: true,
      message: result.message,
      subscription: result.subscription,
      rewards: result.rewards,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось применить промокод.";
    return res.status(400).json({ message });
  }
});

authRouter.get("/auth/admin/access", async (req, res) => {
  const auth = await requireAdmin(req, res);
  if (!auth) return;
  const adminSession = mintAdminSession({
    token: auth.token,
    userId: auth.adminUser.id,
    ip: auth.clientIp,
    userAgent: auth.clientUserAgent,
  });
  return res
    .status(200)
    .json({ ok: true, admin: true, userId: auth.adminUser.id, role: auth.accessRole, adminSession });
});

authRouter.patch("/auth/admin/subscription", async (req, res) => {
  const auth = await requireAdmin(req, res, { requireSession: true });
  if (!auth) return;
  if (!hasAdminPermission(auth.accessRole, "manage-subscriptions")) {
    return res.status(403).json({ message: "Недостаточно прав." });
  }

  const userId = String(req.body?.userId ?? "").trim();
  const tier = String(req.body?.tier ?? "").trim();
  if (!userId || !tier) {
    return res.status(400).json({ message: "Нужны userId и tier." });
  }

  try {
    const subscription = await assignSubscriptionByUserId({
      userId,
      tier,
      duration:
        req.body?.duration === null || typeof req.body?.duration === "string"
          ? req.body.duration
          : undefined,
      source:
        req.body?.source === null || typeof req.body?.source === "string"
          ? req.body.source
          : undefined,
      startAt:
        req.body?.startAt === null ||
        typeof req.body?.startAt === "string" ||
        typeof req.body?.startAt === "number"
          ? req.body.startAt
          : undefined,
      endAt:
        req.body?.endAt === null ||
        typeof req.body?.endAt === "string" ||
        typeof req.body?.endAt === "number"
          ? req.body.endAt
          : undefined,
    });
    if (!subscription) {
      return res.status(404).json({ message: "Пользователь не найден." });
    }
    return res.status(200).json({ ok: true, subscription });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось выдать подписку.";
    return res.status(400).json({ message });
  }
});

authRouter.patch("/auth/admin/promo", async (req, res) => {
  const auth = await requireAdmin(req, res, { requireSession: true });
  if (!auth) return;
  if (!hasAdminPermission(auth.accessRole, "manage-promos")) {
    return res.status(403).json({ message: "Недостаточно прав." });
  }

  const code = String(req.body?.code ?? "").trim();
  const promoKindRaw = String(req.body?.promoKind ?? "subscription")
    .trim()
    .toLowerCase();
  const promoKind = promoKindRaw === "badge" ? "badge" : "subscription";
  const badgeKeys = Array.isArray(req.body?.badgeKeys) ? req.body.badgeKeys : undefined;
  const badgeKey =
    req.body?.badgeKey === null || typeof req.body?.badgeKey === "string"
      ? req.body.badgeKey
      : undefined;
  const tier = String(req.body?.tier ?? "").trim();
  if (!code) {
    return res.status(400).json({ message: "Нужен code." });
  }
  if (promoKind === "subscription" && !tier) {
    return res.status(400).json({ message: "Для подписочного промокода нужен tier." });
  }
  if (promoKind === "badge" && !String(badgeKey ?? "").trim() && !(badgeKeys && badgeKeys.length > 0)) {
    return res.status(400).json({ message: "Для промокода на бейдж нужен хотя бы один badgeKey." });
  }

  try {
    const promo = await upsertPromoCodeByAdmin({
      code,
      promoKind,
      badgeKey,
      badgeKeys,
      tier: promoKind === "subscription" ? tier : "free",
      duration:
        req.body?.duration === null || typeof req.body?.duration === "string"
          ? req.body.duration
          : undefined,
      source:
        req.body?.source === null || typeof req.body?.source === "string"
          ? req.body.source
          : undefined,
      isActive: typeof req.body?.isActive === "boolean" ? req.body.isActive : true,
      maxUses:
        req.body?.maxUses === null || typeof req.body?.maxUses === "number"
          ? req.body.maxUses
          : undefined,
      startsAt:
        req.body?.startsAt === null ||
        typeof req.body?.startsAt === "string" ||
        typeof req.body?.startsAt === "number"
          ? req.body.startsAt
          : undefined,
      expiresAt:
        req.body?.expiresAt === null ||
        typeof req.body?.expiresAt === "string" ||
        typeof req.body?.expiresAt === "number"
          ? req.body.expiresAt
          : undefined,
      createdByUserId: auth.adminUser.id,
    });
    return res.status(200).json({ ok: true, promo });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось сохранить промокод.";
    return res.status(400).json({ message });
  }
});

authRouter.get("/auth/admin/promo/list", async (req, res) => {
  const auth = await requireAdmin(req, res, { requireSession: true });
  if (!auth) return;
  if (!hasAdminPermission(auth.accessRole, "manage-promos")) {
    return res.status(403).json({ message: "Недостаточно прав." });
  }
  try {
    const promos = await listPromoCodesByAdmin();
    return res.status(200).json({ ok: true, promos });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось загрузить промокоды.";
    return res.status(400).json({ message });
  }
});

authRouter.patch("/auth/admin/promo/delete", async (req, res) => {
  const auth = await requireAdmin(req, res, { requireSession: true });
  if (!auth) return;
  if (!hasAdminPermission(auth.accessRole, "manage-promos")) {
    return res.status(403).json({ message: "Недостаточно прав." });
  }
  const code = String(req.body?.code ?? "").trim();
  if (!code) {
    return res.status(400).json({ message: "Укажите промокод." });
  }
  try {
    const deleted = await deletePromoCodeByAdmin(code);
    if (!deleted) {
      return res.status(404).json({ message: "Промокод не найден." });
    }
    return res.status(200).json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось удалить промокод.";
    return res.status(400).json({ message });
  }
});

authRouter.post("/auth/admin/user/find", async (req, res) => {
  const auth = await requireAdmin(req, res, { requireSession: true });
  if (!auth) return;
  if (!hasAdminPermission(auth.accessRole, "find-user")) {
    return res.status(403).json({ message: "Недостаточно прав." });
  }
  const query = String(req.body?.query ?? "").trim();
  if (!query) {
    return res.status(400).json({ message: "Введите login, email, nickname или userId." });
  }
  try {
    const user = await findUserByAdminQuery(query);
    if (!user) {
      return res.status(404).json({ message: "Пользователь не найден." });
    }
    return res.status(200).json({ ok: true, user });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось выполнить поиск пользователя.";
    return res.status(400).json({ message });
  }
});

authRouter.patch("/auth/admin/ban", async (req, res) => {
  const auth = await requireAdmin(req, res, { requireSession: true });
  if (!auth) return;
  if (!hasAdminPermission(auth.accessRole, "ban-user")) {
    return res.status(403).json({ message: "Недостаточно прав." });
  }
  const userId = String(req.body?.userId ?? "").trim();
  if (!userId) {
    return res.status(400).json({ message: "Нужен userId." });
  }
  try {
    if (Boolean(req.body?.clear)) {
      const ban = await clearUserBanByAdmin(userId);
      if (!ban) {
        return res.status(404).json({ message: "Пользователь не найден." });
      }
      return res.status(200).json({ ok: true, ban });
    }
    if (userId === auth.adminUser.id) {
      return res.status(400).json({ message: "Нельзя заблокировать самого себя." });
    }
    const forever = Boolean(req.body?.forever);
    const daysRaw = req.body?.days;
    const days =
      typeof daysRaw === "number"
        ? daysRaw
        : typeof daysRaw === "string" && daysRaw.trim()
          ? Number(daysRaw)
          : null;
    const reason =
      req.body?.reason === null || typeof req.body?.reason === "string"
        ? req.body.reason
        : undefined;
    const ban = await setUserBanByAdmin({
      userId,
      forever,
      days,
      reason,
    });
    if (!ban) {
      return res.status(404).json({ message: "Пользователь не найден." });
    }
    return res.status(200).json({ ok: true, ban });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось обновить блокировку.";
    return res.status(400).json({ message });
  }
});

authRouter.patch("/auth/admin/staff/role", async (req, res) => {
  const auth = await requireAdmin(req, res, { requireSession: true });
  if (!auth) return;
  if (!hasAdminPermission(auth.accessRole, "manage-moderators")) {
    return res.status(403).json({ message: "Недостаточно прав." });
  }
  const userId = String(req.body?.userId ?? "").trim();
  const roleRaw = String(req.body?.role ?? "")
    .trim()
    .toLowerCase();
  const role =
    roleRaw === "administrator"
      ? "administrator"
      : roleRaw === "moderator"
        ? "moderator"
        : roleRaw === "none" || roleRaw === "remove" || !roleRaw
          ? null
          : null;
  if (!userId) {
    return res.status(400).json({ message: "Нужен userId." });
  }

  if (auth.accessRole === "administrator" && role === "administrator") {
    return res.status(403).json({ message: "Администратор не может выдавать роль администратора." });
  }
  if (auth.accessRole === "administrator") {
    const targetRole = await getAdminStaffRoleByUserId(userId);
    if (targetRole === "administrator") {
      return res.status(403).json({ message: "Администратор не может менять роль другого администратора." });
    }
  }

  try {
    const nextRole = await setAdminStaffRoleByUserId({
      userId,
      role: role as "administrator" | "moderator" | null,
    });
    if (nextRole === undefined) {
      return res.status(404).json({ message: "Пользователь не найден." });
    }
    return res.status(200).json({ ok: true, role: nextRole });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось обновить роль сотрудника.";
    return res.status(400).json({ message });
  }
});

authRouter.patch("/auth/admin/user/moderate", async (req, res) => {
  const auth = await requireAdmin(req, res, { requireSession: true });
  if (!auth) return;
  if (!hasAdminPermission(auth.accessRole, "moderate-profile")) {
    return res.status(403).json({ message: "Недостаточно прав." });
  }

  const userId = String(req.body?.userId ?? "").trim();
  if (!userId) {
    return res.status(400).json({ message: "Нужен userId." });
  }

  try {
    const user = await updateUserModerationByAdmin({
      userId,
      nickname: typeof req.body?.nickname === "string" ? req.body.nickname : undefined,
      clearAvatar: !!req.body?.clearAvatar,
      clearBanner: !!req.body?.clearBanner,
    });
    if (!user) {
      return res.status(404).json({ message: "Пользователь не найден." });
    }
    const publicProfile = await getPublicUserProfileById(user.id).catch(() => null);
    syncUserProfileInActiveRooms({
      userId: user.id,
      nickname: publicProfile?.nickname ?? user.nickname,
      avatar: publicProfile?.avatar ?? null,
      banner: publicProfile?.banner ?? null,
    });
    return res.status(200).json({ ok: true, user });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось выполнить модерацию профиля.";
    return res.status(400).json({ message });
  }
});

export default authRouter;





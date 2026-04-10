import crypto from "node:crypto";
import { Router } from "express";
import {
  applyPromoCodeByToken,
  assignSubscriptionByUserId,
  changeEmailByToken,
  changePasswordByToken,
  clearUserBanByAdmin,
  deletePromoCodeByAdmin,
  findUserByAdminQuery,
  getAdminStaffRoleByUserId,
  getPublicUserProfileById,
  getProfileByToken,
  getUserByToken,
  listPromoCodesByAdmin,
  loginAccount,
  logoutByToken,
  registerAccount,
  setAdminStaffRoleByUserId,
  setUserBanByAdmin,
  upsertPromoCodeByAdmin,
  updateUserModerationByAdmin,
  updateProfileByToken,
} from "../lib/authStore.js";

const authRouter = Router();

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
  if (requiredKey) {
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
    if (nextPassword.length < 6) {
      return res.status(400).json({ message: "Пароль должен быть не короче 6 символов." });
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
    return res.status(200).json({ ok: true, user });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось выполнить модерацию профиля.";
    return res.status(400).json({ message });
  }
});

export default authRouter;





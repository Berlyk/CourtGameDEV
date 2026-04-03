import { Router } from "express";
import {
  changeEmailByToken,
  changePasswordByToken,
  getPublicUserProfileById,
  getProfileByToken,
  getUserByToken,
  loginAccount,
  logoutByToken,
  registerAccount,
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

    const { user, token } = await loginAccount({ loginOrEmail, password });
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
  const user = await getUserByToken(token);
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
  const profile = await getProfileByToken(token);
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

export default authRouter;


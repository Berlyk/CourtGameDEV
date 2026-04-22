import crypto from "node:crypto";
import { pool } from "@workspace/db";
import { roleOrderByCount } from "./roleOrderConfig.js";

type CaseModePlayerCount = 3 | 4 | 5 | 6;
type CaseRoleKey =
  | "judge"
  | "plaintiff"
  | "defendant"
  | "prosecutor"
  | "defenseLawyer"
  | "plaintiffLawyer";

const ROLE_KEYS: CaseRoleKey[] = [
  "judge",
  "plaintiff",
  "defendant",
  "prosecutor",
  "defenseLawyer",
  "plaintiffLawyer",
];

const ROLE_TITLES: Record<CaseRoleKey, string> = {
  judge: "Судья",
  plaintiff: "Истец",
  defendant: "Ответчик",
  prosecutor: "Прокурор",
  defenseLawyer: "Адвокат ответчика",
  plaintiffLawyer: "Адвокат истца",
};

const ROLE_GOALS: Record<CaseRoleKey, string> = {
  judge:
    "Вынести максимально точный вердикт на основе представленных улик и раскрытых фактов.",
  plaintiff:
    "Доказать, что его требования обоснованы и добиться решения суда в свою пользу.",
  defendant:
    "Опровергнуть обвинения и добиться полного или частичного оправдания.",
  prosecutor:
    "Доказать виновность ответчика и убедить суд в необходимости наказания.",
  defenseLawyer:
    "Защитить ответчика, опровергнуть доводы обвинения и добиться оправдания или смягчения решения.",
  plaintiffLawyer:
    "Усилить позицию истца, доказать обоснованность требований и склонить суд к решению в его пользу.",
};

const MODE_TITLE_BY_PLAYERS: Record<CaseModePlayerCount, string> = {
  3: "Гражданский спор / Трудовой спор",
  4: "Уголовное дело",
  5: "Уголовное дело",
  6: "Суд на компанию",
};

const DEFAULT_PACK_COLOR = "#ef4444";

export interface UserCasePackCaseInput {
  modePlayerCount: CaseModePlayerCount;
  title: string;
  description: string;
  truth: string;
  evidence: string[];
  factsByRole: Partial<Record<CaseRoleKey, string[]>>;
}

export interface UserCasePackCreateInput {
  title: string;
  description: string;
  color?: string;
  cases: UserCasePackCaseInput[];
}

export interface UserCasePackInfo {
  id: string;
  key: string;
  title: string;
  description: string;
  color: string;
  shareCode: string;
  caseCount: number;
  sortOrder: number;
  isCustom: true;
  isAdult: false;
  createdAt: number;
}

export interface UserCasePackCaseDetails {
  caseKey: string;
  modePlayerCount: CaseModePlayerCount;
  title: string;
  description: string;
  truth: string;
  evidence: string[];
  factsByRole: Record<CaseRoleKey, string[]>;
  sortOrder: number;
}

export interface UserCasePackDetails {
  pack: UserCasePackInfo;
  cases: UserCasePackCaseDetails[];
}

export interface UserCasePackStoredCase {
  id: string;
  mode: string;
  title: string;
  description: string;
  truth: string;
  evidence: string[];
  roles: Record<string, { title: string; goal: string; facts: string[] }>;
}

let ensurePromise: Promise<void> | null = null;

function normalizeColor(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) {
    return raw.length === 4
      ? `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`.toLowerCase()
      : raw.toLowerCase();
  }
  return DEFAULT_PACK_COLOR;
}

function normalizeTitle(value: unknown, fallback: string): string {
  const title = String(value ?? "").trim().slice(0, 90);
  return title || fallback;
}

function normalizeDescription(value: unknown, fallback: string): string {
  const description = String(value ?? "").trim().slice(0, 700);
  return description || fallback;
}

function normalizeTruth(value: unknown): string {
  return String(value ?? "").trim().slice(0, 700) || "Истина недоступна.";
}

function normalizeModePlayerCount(value: unknown): CaseModePlayerCount {
  const numeric = Number(value);
  if (numeric === 3 || numeric === 4 || numeric === 5 || numeric === 6) {
    return numeric;
  }
  throw new Error("Режим дела должен быть 3, 4, 5 или 6 игроков.");
}

function normalizeEvidence(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? "").trim().slice(0, 220))
    .filter((item) => item.length > 0)
    .slice(0, 12);
}

function normalizeFactsByRole(
  modePlayerCount: CaseModePlayerCount,
  value: unknown,
): Record<CaseRoleKey, string[]> {
  const safeObject =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  const next: Record<CaseRoleKey, string[]> = {
    judge: [],
    plaintiff: [],
    defendant: [],
    prosecutor: [],
    defenseLawyer: [],
    plaintiffLawyer: [],
  };

  for (const roleKey of ROLE_KEYS) {
    const roleValue = safeObject[roleKey];
    const rows = Array.isArray(roleValue)
      ? roleValue
          .map((item) => String(item ?? "").trim().slice(0, 220))
          .filter((item) => item.length > 0)
      : [];
    next[roleKey] = rows;
  }

  const requiredRoles = (roleOrderByCount[modePlayerCount] ?? []).filter(
    (role) => role !== "judge",
  ) as CaseRoleKey[];

  for (const roleKey of requiredRoles) {
    if ((next[roleKey] ?? []).length < 4) {
      throw new Error(`Для роли «${ROLE_TITLES[roleKey]}» нужно минимум 4 факта.`);
    }
  }

  return next;
}

function generatePackKey(): string {
  return `custom_${crypto.randomUUID().replace(/-/g, "").slice(0, 18)}`;
}

function generateShareCode(): string {
  const raw = crypto.randomBytes(12).toString("base64url").replace(/[^a-zA-Z0-9]/g, "");
  return raw.slice(0, 16).toUpperCase();
}

function cloneFacts(value: unknown): Record<CaseRoleKey, string[]> {
  const source =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const result: Record<CaseRoleKey, string[]> = {
    judge: [],
    plaintiff: [],
    defendant: [],
    prosecutor: [],
    defenseLawyer: [],
    plaintiffLawyer: [],
  };
  for (const roleKey of ROLE_KEYS) {
    const raw = source[roleKey];
    result[roleKey] = Array.isArray(raw)
      ? raw
          .map((item) => String(item ?? "").trim())
          .filter((item) => item.length > 0)
      : [];
  }
  return result;
}

function buildRolesFromFacts(
  factsByRole: Record<CaseRoleKey, string[]>,
): Record<string, { title: string; goal: string; facts: string[] }> {
  const roles: Record<string, { title: string; goal: string; facts: string[] }> = {};
  for (const roleKey of ROLE_KEYS) {
    roles[roleKey] = {
      title: ROLE_TITLES[roleKey],
      goal: ROLE_GOALS[roleKey],
      facts: roleKey === "judge" ? [] : [...(factsByRole[roleKey] ?? [])],
    };
  }
  return roles;
}

async function ensureTablesInternal(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_case_packs (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
      key TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#ef4444',
      share_code TEXT NOT NULL UNIQUE,
      source_pack_id UUID NULL REFERENCES user_case_packs(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_case_pack_cases (
      id UUID PRIMARY KEY,
      pack_id UUID NOT NULL REFERENCES user_case_packs(id) ON DELETE CASCADE,
      case_key TEXT NOT NULL,
      mode_player_count INTEGER NOT NULL CHECK (mode_player_count IN (3,4,5,6)),
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      truth TEXT NOT NULL,
      evidence_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      facts_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      sort_order INTEGER NOT NULL DEFAULT 100,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (pack_id, case_key)
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS user_case_packs_user_idx ON user_case_packs(user_id);
    CREATE INDEX IF NOT EXISTS user_case_pack_cases_pack_idx ON user_case_pack_cases(pack_id);
    CREATE INDEX IF NOT EXISTS user_case_pack_cases_pack_mode_idx
      ON user_case_pack_cases(pack_id, mode_player_count);
  `);
}

export async function ensureUserCasePacksStorage(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = ensureTablesInternal();
  }
  return ensurePromise;
}

function mapRowToPackInfo(row: {
  id: string;
  key: string;
  title: string;
  description: string;
  color: string;
  share_code: string;
  case_count: number;
  created_at: Date | string;
}): UserCasePackInfo {
  const createdAt =
    row.created_at instanceof Date
      ? row.created_at.getTime()
      : Date.parse(String(row.created_at ?? "")) || Date.now();
  return {
    id: row.id,
    key: row.key,
    title: row.title,
    description: row.description,
    color: normalizeColor(row.color),
    shareCode: row.share_code,
    caseCount: Math.max(0, Number(row.case_count ?? 0) || 0),
    sortOrder: 1000,
    isCustom: true,
    isAdult: false,
    createdAt,
  };
}

async function fetchPackInfoById(packId: string): Promise<UserCasePackInfo> {
  const result = await pool.query<{
    id: string;
    key: string;
    title: string;
    description: string;
    color: string;
    share_code: string;
    case_count: number;
    created_at: Date;
  }>(
    `
      SELECT
        p.id,
        p.key,
        p.title,
        p.description,
        p.color,
        p.share_code,
        COUNT(c.id)::int AS case_count,
        p.created_at
      FROM user_case_packs p
      LEFT JOIN user_case_pack_cases c ON c.pack_id = p.id
      WHERE p.id = $1
      GROUP BY p.id
    `,
    [packId],
  );

  if (!result.rowCount) {
    throw new Error("Пак не найден.");
  }
  return mapRowToPackInfo(result.rows[0]);
}

export async function listUserCasePacks(userId: string): Promise<UserCasePackInfo[]> {
  await ensureUserCasePacksStorage();
  const safeUserId = String(userId ?? "").trim();
  if (!safeUserId) return [];

  const result = await pool.query<{
    id: string;
    key: string;
    title: string;
    description: string;
    color: string;
    share_code: string;
    case_count: number;
    created_at: Date;
  }>(
    `
      SELECT
        p.id,
        p.key,
        p.title,
        p.description,
        p.color,
        p.share_code,
        COUNT(c.id)::int AS case_count,
        p.created_at
      FROM user_case_packs p
      LEFT JOIN user_case_pack_cases c ON c.pack_id = p.id
      WHERE p.user_id = $1
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `,
    [safeUserId],
  );

  return result.rows.map(mapRowToPackInfo);
}

function normalizeCaseInput(
  value: unknown,
  index: number,
): {
  caseKey: string;
  modePlayerCount: CaseModePlayerCount;
  title: string;
  description: string;
  truth: string;
  evidence: string[];
  factsByRole: Record<CaseRoleKey, string[]>;
  sortOrder: number;
} {
  const source =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const modePlayerCount = normalizeModePlayerCount(source.modePlayerCount);
  const title = normalizeTitle(source.title, `Дело ${index + 1}`);
  const description = normalizeDescription(source.description, "Описание недоступно.");
  const truth = normalizeTruth(source.truth);
  const evidence = normalizeEvidence(source.evidence);
  const factsByRole = normalizeFactsByRole(modePlayerCount, source.factsByRole);
  const caseKey = `case_${modePlayerCount}_${index + 1}_${crypto.randomUUID().slice(0, 8)}`;

  return {
    caseKey,
    modePlayerCount,
    title,
    description,
    truth,
    evidence,
    factsByRole,
    sortOrder: index + 1,
  };
}

export async function createUserCasePack(
  userId: string,
  input: UserCasePackCreateInput,
): Promise<UserCasePackInfo> {
  await ensureUserCasePacksStorage();
  const safeUserId = String(userId ?? "").trim();
  if (!safeUserId) {
    throw new Error("Не удалось определить владельца пака.");
  }

  const title = normalizeTitle(input?.title, "");
  if (!title) {
    throw new Error("Введите название пака.");
  }
  const description = normalizeDescription(input?.description, "Пользовательский пак дел.");
  const color = normalizeColor(input?.color);
  const rawCases = Array.isArray(input?.cases) ? input.cases : [];
  if (rawCases.length === 0) {
    throw new Error("Добавьте хотя бы одно дело в пак.");
  }

  const normalizedCases = rawCases.map((row, index) => normalizeCaseInput(row, index));

  await pool.query("BEGIN");
  try {
    const packId = crypto.randomUUID();
    const packKey = generatePackKey();
    const shareCode = generateShareCode();

    await pool.query(
      `
        INSERT INTO user_case_packs (
          id, user_id, key, title, description, color, share_code, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      `,
      [packId, safeUserId, packKey, title, description, color, shareCode],
    );

    for (const caseRow of normalizedCases) {
      await pool.query(
        `
          INSERT INTO user_case_pack_cases (
            id,
            pack_id,
            case_key,
            mode_player_count,
            title,
            description,
            truth,
            evidence_json,
            facts_json,
            sort_order,
            created_at,
            updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, NOW(), NOW())
        `,
        [
          crypto.randomUUID(),
          packId,
          caseRow.caseKey,
          caseRow.modePlayerCount,
          caseRow.title,
          caseRow.description,
          caseRow.truth,
          JSON.stringify(caseRow.evidence),
          JSON.stringify(caseRow.factsByRole),
          caseRow.sortOrder,
        ],
      );
    }

    await pool.query("COMMIT");

    const created = await pool.query<{
      id: string;
      key: string;
      title: string;
      description: string;
      color: string;
      share_code: string;
      case_count: number;
      created_at: Date;
    }>(
      `
        SELECT
          p.id,
          p.key,
          p.title,
          p.description,
          p.color,
          p.share_code,
          COUNT(c.id)::int AS case_count,
          p.created_at
        FROM user_case_packs p
        LEFT JOIN user_case_pack_cases c ON c.pack_id = p.id
        WHERE p.id = $1
        GROUP BY p.id
      `,
      [packId],
    );

    if (!created.rowCount) {
      throw new Error("Пак создан, но не удалось получить его данные.");
    }
    return mapRowToPackInfo(created.rows[0]);
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }
}

export async function importUserCasePackByShareCode(
  userId: string,
  shareCodeInput: string,
): Promise<UserCasePackInfo> {
  await ensureUserCasePacksStorage();
  const safeUserId = String(userId ?? "").trim();
  if (!safeUserId) {
    throw new Error("Не удалось определить пользователя.");
  }
  const shareCode = String(shareCodeInput ?? "").trim().toUpperCase();
  if (!shareCode) {
    throw new Error("Введите ключ пака.");
  }

  await pool.query("BEGIN");
  try {
    const sourcePackResult = await pool.query<{
      id: string;
      user_id: string;
      title: string;
      description: string;
      color: string;
    }>(
      `
        SELECT id, user_id, title, description, color
        FROM user_case_packs
        WHERE share_code = $1
        LIMIT 1
      `,
      [shareCode],
    );
    if (!sourcePackResult.rowCount) {
      throw new Error("Пак с таким ключом не найден.");
    }
    const sourcePack = sourcePackResult.rows[0];
    if (sourcePack.user_id === safeUserId) {
      throw new Error("Этот пак уже принадлежит вам.");
    }

    const sourceCases = await pool.query<{
      case_key: string;
      mode_player_count: number;
      title: string;
      description: string;
      truth: string;
      evidence_json: unknown;
      facts_json: unknown;
      sort_order: number;
    }>(
      `
        SELECT
          case_key,
          mode_player_count,
          title,
          description,
          truth,
          evidence_json,
          facts_json,
          sort_order
        FROM user_case_pack_cases
        WHERE pack_id = $1
        ORDER BY sort_order ASC, created_at ASC
      `,
      [sourcePack.id],
    );

    const newPackId = crypto.randomUUID();
    const newPackKey = generatePackKey();
    const newShareCode = generateShareCode();

    await pool.query(
      `
        INSERT INTO user_case_packs (
          id, user_id, key, title, description, color, share_code, source_pack_id, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      `,
      [
        newPackId,
        safeUserId,
        newPackKey,
        sourcePack.title,
        sourcePack.description,
        normalizeColor(sourcePack.color),
        newShareCode,
        sourcePack.id,
      ],
    );

    for (const sourceCase of sourceCases.rows) {
      await pool.query(
        `
          INSERT INTO user_case_pack_cases (
            id,
            pack_id,
            case_key,
            mode_player_count,
            title,
            description,
            truth,
            evidence_json,
            facts_json,
            sort_order,
            created_at,
            updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, NOW(), NOW())
        `,
        [
          crypto.randomUUID(),
          newPackId,
          `${sourceCase.case_key}_${crypto.randomUUID().slice(0, 6)}`.slice(0, 120),
          normalizeModePlayerCount(sourceCase.mode_player_count),
          normalizeTitle(sourceCase.title, "Дело"),
          normalizeDescription(sourceCase.description, "Описание недоступно."),
          normalizeTruth(sourceCase.truth),
          JSON.stringify(normalizeEvidence(sourceCase.evidence_json)),
          JSON.stringify(cloneFacts(sourceCase.facts_json)),
          Math.max(1, Number(sourceCase.sort_order ?? 0) || 1),
        ],
      );
    }

    await pool.query("COMMIT");

    const created = await pool.query<{
      id: string;
      key: string;
      title: string;
      description: string;
      color: string;
      share_code: string;
      case_count: number;
      created_at: Date;
    }>(
      `
        SELECT
          p.id,
          p.key,
          p.title,
          p.description,
          p.color,
          p.share_code,
          COUNT(c.id)::int AS case_count,
          p.created_at
        FROM user_case_packs p
        LEFT JOIN user_case_pack_cases c ON c.pack_id = p.id
        WHERE p.id = $1
        GROUP BY p.id
      `,
      [newPackId],
    );

    if (!created.rowCount) {
      throw new Error("Пак импортирован, но не удалось получить его данные.");
    }
    return mapRowToPackInfo(created.rows[0]);
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }
}

export async function getUserCasePackDetails(
  userId: string,
  packKeyInput: string,
): Promise<UserCasePackDetails> {
  await ensureUserCasePacksStorage();
  const safeUserId = String(userId ?? "").trim();
  if (!safeUserId) {
    throw new Error("Не удалось определить пользователя.");
  }
  const packKey = String(packKeyInput ?? "").trim().toLowerCase();
  if (!packKey) {
    throw new Error("Ключ пака не указан.");
  }

  const packResult = await pool.query<{ id: string }>(
    `
      SELECT id
      FROM user_case_packs
      WHERE user_id = $1
        AND key = $2
      LIMIT 1
    `,
    [safeUserId, packKey],
  );
  if (!packResult.rowCount) {
    throw new Error("Пак не найден.");
  }

  const packId = packResult.rows[0].id;
  const pack = await fetchPackInfoById(packId);

  const casesResult = await pool.query<{
    case_key: string;
    mode_player_count: number;
    title: string;
    description: string;
    truth: string;
    evidence_json: unknown;
    facts_json: unknown;
    sort_order: number;
  }>(
    `
      SELECT
        case_key,
        mode_player_count,
        title,
        description,
        truth,
        evidence_json,
        facts_json,
        sort_order
      FROM user_case_pack_cases
      WHERE pack_id = $1
      ORDER BY sort_order ASC, created_at ASC
    `,
    [packId],
  );

  const cases: UserCasePackCaseDetails[] = casesResult.rows.map((row) => ({
    caseKey: String(row.case_key ?? ""),
    modePlayerCount: normalizeModePlayerCount(row.mode_player_count),
    title: normalizeTitle(row.title, "Дело"),
    description: normalizeDescription(row.description, "Описание не указано."),
    truth: normalizeTruth(row.truth),
    evidence: normalizeEvidence(row.evidence_json),
    factsByRole: cloneFacts(row.facts_json),
    sortOrder: Math.max(1, Number(row.sort_order ?? 0) || 1),
  }));

  return { pack, cases };
}

export async function updateUserCasePack(
  userId: string,
  packKeyInput: string,
  input: UserCasePackCreateInput,
): Promise<UserCasePackInfo> {
  await ensureUserCasePacksStorage();
  const safeUserId = String(userId ?? "").trim();
  if (!safeUserId) {
    throw new Error("Не удалось определить пользователя.");
  }
  const packKey = String(packKeyInput ?? "").trim().toLowerCase();
  if (!packKey) {
    throw new Error("Ключ пака не указан.");
  }

  const title = normalizeTitle(input?.title, "");
  if (!title) {
    throw new Error("Введите название пака.");
  }
  const description = normalizeDescription(input?.description, "Пользовательский пак дел.");
  const color = normalizeColor(input?.color);
  const rawCases = Array.isArray(input?.cases) ? input.cases : [];
  if (rawCases.length === 0) {
    throw new Error("Добавьте хотя бы одно дело в пак.");
  }
  const normalizedCases = rawCases.map((row, index) => normalizeCaseInput(row, index));

  await pool.query("BEGIN");
  try {
    const packResult = await pool.query<{ id: string }>(
      `
        SELECT id
        FROM user_case_packs
        WHERE user_id = $1
          AND key = $2
        LIMIT 1
      `,
      [safeUserId, packKey],
    );
    if (!packResult.rowCount) {
      throw new Error("Пак не найден.");
    }
    const packId = packResult.rows[0].id;

    await pool.query(
      `
        UPDATE user_case_packs
        SET
          title = $1,
          description = $2,
          color = $3,
          updated_at = NOW()
        WHERE id = $4
      `,
      [title, description, color, packId],
    );

    await pool.query(`DELETE FROM user_case_pack_cases WHERE pack_id = $1`, [packId]);

    for (const caseRow of normalizedCases) {
      await pool.query(
        `
          INSERT INTO user_case_pack_cases (
            id,
            pack_id,
            case_key,
            mode_player_count,
            title,
            description,
            truth,
            evidence_json,
            facts_json,
            sort_order,
            created_at,
            updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, NOW(), NOW())
        `,
        [
          crypto.randomUUID(),
          packId,
          caseRow.caseKey,
          caseRow.modePlayerCount,
          caseRow.title,
          caseRow.description,
          caseRow.truth,
          JSON.stringify(caseRow.evidence),
          JSON.stringify(caseRow.factsByRole),
          caseRow.sortOrder,
        ],
      );
    }

    await pool.query("COMMIT");
    return await fetchPackInfoById(packId);
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }
}

export async function pickUserCasePackForRoom(
  packKeyInput: string | undefined,
  modePlayerCount: number,
): Promise<UserCasePackStoredCase | null> {
  await ensureUserCasePacksStorage();

  const packKey = String(packKeyInput ?? "").trim().toLowerCase();
  const modeCount = normalizeModePlayerCount(modePlayerCount);
  if (!packKey.startsWith("custom_")) {
    return null;
  }

  const result = await pool.query<{
    case_key: string;
    title: string;
    description: string;
    truth: string;
    evidence_json: unknown;
    facts_json: unknown;
  }>(
    `
      SELECT
        c.case_key,
        c.title,
        c.description,
        c.truth,
        c.evidence_json,
        c.facts_json
      FROM user_case_pack_cases c
      JOIN user_case_packs p ON p.id = c.pack_id
      WHERE p.key = $1
        AND c.mode_player_count = $2
      ORDER BY RANDOM()
      LIMIT 1
    `,
    [packKey, modeCount],
  );

  if (!result.rowCount) return null;
  const row = result.rows[0];
  const factsByRole = cloneFacts(row.facts_json);

  return {
    id: row.case_key,
    mode: MODE_TITLE_BY_PLAYERS[modeCount],
    title: normalizeTitle(row.title, "Дело"),
    description: normalizeDescription(row.description, "Описание недоступно."),
    truth: normalizeTruth(row.truth),
    evidence: normalizeEvidence(row.evidence_json),
    roles: buildRolesFromFacts(factsByRole),
  };
}

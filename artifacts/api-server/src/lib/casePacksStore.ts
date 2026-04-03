import crypto from "node:crypto";
import { pool } from "@workspace/db";

export interface CasePackInfo {
  key: string;
  title: string;
  description: string;
  isAdult: boolean;
  sortOrder: number;
  caseCount: number;
}

export interface StoredCaseData {
  id: string;
  mode: string;
  title: string;
  description: string;
  truth: string;
  evidence: string[];
  roles: Record<string, { title: string; goal: string; facts: string[] }>;
}

type RoleKey =
  | "judge"
  | "plaintiff"
  | "defendant"
  | "prosecutor"
  | "defenseLawyer"
  | "plaintiffLawyer";

const ROLE_TITLES: Record<RoleKey, string> = {
  judge: "Судья",
  plaintiff: "Истец",
  defendant: "Ответчик",
  prosecutor: "Прокурор",
  defenseLawyer: "Адвокат ответчика",
  plaintiffLawyer: "Адвокат истца",
};

const ROLE_GOALS: Record<RoleKey, string> = {
  judge: "Вынести максимально точный вердикт на основе представленных улик и раскрытых фактов.",
  plaintiff: "Доказать, что его требования обоснованы и добиться решения суда в свою пользу.",
  defendant: "Опровергнуть обвинения и добиться полного или частичного оправдания.",
  prosecutor: "Доказать виновность ответчика и убедить суд в необходимости наказания.",
  defenseLawyer: "Защитить ответчика, опровергнуть доводы обвинения и добиться оправдания или смягчения решения.",
  plaintiffLawyer: "Усилить позицию истца, доказать обоснованность требований и склонить суд к решению в его пользу.",
};

let ensurePromise: Promise<void> | null = null;

const STATIC_PACKS_FALLBACK: CasePackInfo[] = [
  { key: "classic", title: "КЛАССИКА", description: "Базовый пак дел.", isAdult: false, sortOrder: 10, caseCount: 240 },
  { key: "medieval", title: "СРЕДНЕВЕКОВЬЕ", description: "Религия и традиции важнее доказательств.", isAdult: false, sortOrder: 20, caseCount: 120 },
  { key: "hard", title: "ОСОБО ТЯЖКИЕ", description: "Жесткие дела с серьезными последствиями.", isAdult: false, sortOrder: 30, caseCount: 102 },
  { key: "cyberpunk_2077", title: "CYBERPUNK 2077", description: "Технологии, импланты и корпорации.", isAdult: false, sortOrder: 40, caseCount: 102 },
  { key: "wild_west", title: "ДИКИЙ ЗАПАД", description: "Слабый контроль закона, где многое решается силой.", isAdult: false, sortOrder: 50, caseCount: 78 },
  { key: "the_boys", title: "The Boys", description: "Супергерои и последствия их действий.", isAdult: false, sortOrder: 60, caseCount: 84 },
  { key: "adult_18_plus", title: "18+", description: "Дела с чувствительными и спорными темами.", isAdult: true, sortOrder: 70, caseCount: 84 },
  { key: "ancient_rome", title: "ДРЕВНИЙ РИМ", description: "Статус и власть влияют на закон и решения суда.", isAdult: false, sortOrder: 80, caseCount: 84 },
];

export function normalizeCasePackKey(input?: string | null): string {
  const raw = (input ?? "").trim().toLowerCase();
  if (!raw) return "classic";
  const safe = raw.replace(/[^a-z0-9_-]/g, "");
  return safe || "classic";
}

async function ensureTablesInternal(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS case_packs (
      id UUID PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      is_adult BOOLEAN NOT NULL DEFAULT FALSE,
      sort_order INTEGER NOT NULL DEFAULT 100,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS case_pack_cases (
      id UUID PRIMARY KEY,
      pack_key TEXT NOT NULL REFERENCES case_packs(key) ON DELETE CASCADE,
      case_key TEXT NOT NULL,
      mode_player_count INTEGER NOT NULL CHECK (mode_player_count IN (3,4,5,6)),
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      truth TEXT NOT NULL,
      evidence_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      facts_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      sort_order INTEGER NOT NULL DEFAULT 100,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (pack_key, case_key)
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS case_pack_cases_pack_mode_idx
    ON case_pack_cases(pack_key, mode_player_count, active);
  `);
}

function titleFromPackKey(packKey: string): string {
  const normalized = (packKey || "classic").replace(/[_-]+/g, " ").trim();
  if (!normalized) return "CLASSIC";
  return normalized
    .split(" ")
    .filter(Boolean)
    .map((part) => part.toUpperCase())
    .join(" ");
}

async function ensurePackRowsFromCases(): Promise<void> {
  const keysResult = await pool.query<{ pack_key: string }>(`
    SELECT DISTINCT pack_key
    FROM case_pack_cases
    WHERE active = TRUE
  `);

  for (const row of keysResult.rows) {
    const key = normalizeCasePackKey(row.pack_key);
    await pool.query(
      `
        INSERT INTO case_packs (id, key, title, description, is_adult, sort_order, active, updated_at)
        VALUES ($1, $2, $3, $4, FALSE, 100, TRUE, NOW())
        ON CONFLICT (key)
        DO UPDATE SET active = TRUE, updated_at = NOW()
      `,
      [crypto.randomUUID(), key, titleFromPackKey(key), "Пак дел из базы данных."],
    );
  }
}

export async function ensureCasePacksStorage(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = ensureTablesInternal().catch((error) => {
      ensurePromise = null;
      throw error;
    });
  }
  return ensurePromise;
}

export async function ensureDefaultCasePackSeeded(): Promise<void> {
  await ensureCasePacksStorage();
  try {
    await ensurePackRowsFromCases();
  } catch {
    // Не блокируем сервер на неидеальной схеме БД.
  }
}

function buildRolesFromFacts(
  facts: Partial<Record<RoleKey, string[]>>,
): Record<string, { title: string; goal: string; facts: string[] }> {
  const result: Record<string, { title: string; goal: string; facts: string[] }> = {};
  const roleKeys = Object.keys(ROLE_TITLES) as RoleKey[];

  for (const roleKey of roleKeys) {
    const rawFacts = facts[roleKey] ?? [];
    const safeFacts = Array.isArray(rawFacts)
      ? rawFacts.filter((item): item is string => typeof item === "string")
      : [];

    result[roleKey] = {
      title: ROLE_TITLES[roleKey],
      goal: ROLE_GOALS[roleKey],
      facts: roleKey === "judge" ? [] : safeFacts,
    };
  }

  return result;
}

export async function listCasePacks(): Promise<CasePackInfo[]> {
  try {
    await ensureCasePacksStorage();
    try {
      await ensurePackRowsFromCases();
    } catch {
      // ignore
    }

    const dbResult = await pool.query<{
      key: string;
      title: string;
      description: string;
      is_adult: boolean;
      sort_order: number;
      case_count: string;
    }>(`
      SELECT
        p.key,
        p.title,
        p.description,
        p.is_adult,
        p.sort_order,
        COUNT(c.id)::text AS case_count
      FROM case_packs p
      LEFT JOIN case_pack_cases c
        ON c.pack_key = p.key
        AND c.active = TRUE
      WHERE p.active = TRUE
      GROUP BY p.key, p.title, p.description, p.is_adult, p.sort_order
      ORDER BY p.sort_order ASC, p.title ASC
    `);

    const mapped = dbResult.rows.map((row) => ({
      key: row.key,
      title: row.title,
      description: row.description,
      isAdult: !!row.is_adult,
      sortOrder: Number.isFinite(row.sort_order) ? row.sort_order : 100,
      caseCount: Math.max(0, Number(row.case_count ?? "0") || 0),
    }));

    if (mapped.length > 0) return mapped;
  } catch {
    // fallback below
  }

  return STATIC_PACKS_FALLBACK;
}

async function pickCaseFromPackDb(packKey: string, modePlayerCount: number): Promise<StoredCaseData | null> {
  await ensureCasePacksStorage();
  const safeCount = modePlayerCount as 3 | 4 | 5 | 6;
  const result = await pool.query<{
    case_key: string;
    title: string;
    description: string;
    truth: string;
    evidence_json: unknown;
    facts_json: unknown;
  }>(
    `
      SELECT case_key, title, description, truth, evidence_json, facts_json
      FROM case_pack_cases
      WHERE active = TRUE
        AND pack_key = $1
        AND mode_player_count = $2
      ORDER BY RANDOM()
      LIMIT 1
    `,
    [packKey, safeCount],
  );

  if (!result.rowCount) return null;
  const row = result.rows[0];
  const facts =
    row.facts_json && typeof row.facts_json === "object"
      ? (row.facts_json as Partial<Record<RoleKey, string[]>>)
      : {};

  return {
    id: row.case_key,
    mode: `Режим на ${safeCount}`,
    title: row.title,
    description: row.description,
    truth: row.truth,
    evidence: Array.isArray(row.evidence_json)
      ? row.evidence_json.filter((item): item is string => typeof item === "string")
      : [],
    roles: buildRolesFromFacts(facts),
  };
}

export async function pickCaseForRoom(
  packKeyInput: string | undefined,
  modePlayerCount: number,
): Promise<StoredCaseData | null> {
  const packKey = normalizeCasePackKey(packKeyInput);

  let selected = await pickCaseFromPackDb(packKey, modePlayerCount);
  if (selected) return selected;

  if (packKey !== "classic") {
    selected = await pickCaseFromPackDb("classic", modePlayerCount);
    if (selected) return selected;
  }

  return pickCaseFromPackDb("classic", 3);
}

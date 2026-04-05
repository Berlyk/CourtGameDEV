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

type ColumnNames = {
  casesEvidenceExpr: string;
  casesFactsExpr: string;
};

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
  defenseLawyer:
    "Защитить ответчика, опровергнуть доводы обвинения и добиться оправдания или смягчения решения.",
  plaintiffLawyer:
    "Усилить позицию истца, доказать обоснованность требований и склонить суд к решению в его пользу.",
};

let ensurePromise: Promise<void> | null = null;
let columnsPromise: Promise<ColumnNames> | null = null;

const STATIC_PACKS_FALLBACK: CasePackInfo[] = [
  { key: "classic", title: "КЛАССИКА", description: "Базовый пак дел.", isAdult: false, sortOrder: 10, caseCount: 240 },
  {
    key: "medieval",
    title: "СРЕДНЕВЕКОВЬЕ",
    description: "Религия и традиции важнее доказательств.",
    isAdult: false,
    sortOrder: 20,
    caseCount: 120,
  },
  {
    key: "hard",
    title: "ОСОБО ТЯЖКИЕ",
    description: "Жесткие дела с серьезными последствиями.",
    isAdult: false,
    sortOrder: 30,
    caseCount: 102,
  },
  {
    key: "cyberpunk_2077",
    title: "CYBERPUNK 2077",
    description: "Технологии, импланты и корпорации.",
    isAdult: false,
    sortOrder: 40,
    caseCount: 102,
  },
  {
    key: "wild_west",
    title: "ДИКИЙ ЗАПАД",
    description: "Слабый контроль закона, где многое решается силой.",
    isAdult: false,
    sortOrder: 50,
    caseCount: 78,
  },
  {
    key: "the_boys",
    title: "The Boys",
    description: "Супергерои и последствия их действий.",
    isAdult: false,
    sortOrder: 60,
    caseCount: 84,
  },
  {
    key: "adult_18_plus",
    title: "18+",
    description: "Дела с чувствительными и спорными темами.",
    isAdult: true,
    sortOrder: 70,
    caseCount: 84,
  },
  {
    key: "ancient_rome",
    title: "ДРЕВНИЙ РИМ",
    description: "Статус и власть влияют на закон и решения суда.",
    isAdult: false,
    sortOrder: 80,
    caseCount: 84,
  },
];

const STATIC_PACKS_BY_KEY = new Map<string, CasePackInfo>(
  STATIC_PACKS_FALLBACK.map((pack) => [pack.key, pack]),
);

function normalizePackAliasLabel(value: string | undefined | null): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function sanitizeCasePackKey(value: string | undefined | null): string {
  const raw = (value ?? "").trim().toLowerCase();
  if (!raw) return "";
  return raw
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_");
}

const KNOWN_PACK_ALIAS_MAP = new Map<string, string>();

function registerPackAlias(alias: string, targetKey: string): void {
  const normalized = normalizePackAliasLabel(alias);
  if (!normalized) return;
  KNOWN_PACK_ALIAS_MAP.set(normalized, targetKey);
}

for (const pack of STATIC_PACKS_FALLBACK) {
  registerPackAlias(pack.key, pack.key);
  registerPackAlias(pack.title, pack.key);
  registerPackAlias(pack.key.replace(/[_-]+/g, " "), pack.key);
}

registerPackAlias("классика", "classic");
registerPackAlias("средневековье", "medieval");
registerPackAlias("особо тяжкие", "hard");
registerPackAlias("особо тяжкие преступления", "hard");
registerPackAlias("cyberpunk 2077", "cyberpunk_2077");
registerPackAlias("дикий запад", "wild_west");
registerPackAlias("the boys", "the_boys");
registerPackAlias("18+", "adult_18_plus");
registerPackAlias("18 plus", "adult_18_plus");
registerPackAlias("adult 18 plus", "adult_18_plus");
registerPackAlias("древний рим", "ancient_rome");

function resolveKnownPackKey(value: string | undefined | null): string | null {
  const direct = KNOWN_PACK_ALIAS_MAP.get(normalizePackAliasLabel(value));
  if (direct) return direct;
  const safe = sanitizeCasePackKey(value);
  if (!safe) return null;
  return KNOWN_PACK_ALIAS_MAP.get(normalizePackAliasLabel(safe)) ?? null;
}

export function normalizeCasePackKey(input?: string | null): string {
  const known = resolveKnownPackKey(input);
  if (known) return known;
  const safe = sanitizeCasePackKey(input);
  return safe || "classic";
}

const CASE_PACK_KEY_FROM_ROW_SQL = `
  COALESCE(
    NULLIF(to_jsonb(c)->>'pack_key', ''),
    NULLIF(to_jsonb(c)->>'case_pack_key', ''),
    CASE
      WHEN NULLIF(to_jsonb(c)->>'case_pack_id', '') IS NOT NULL THEN COALESCE(
        NULLIF(to_jsonb(cp)->>'key', ''),
        NULLIF(to_jsonb(cp)->>'pack_key', '')
      )
      ELSE NULL
    END
  )
`;

function isUndefinedColumnError(error: unknown): boolean {
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : "";
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";
  return code === "42703" || /column\s+"?.+"?\s+does\s+not\s+exist/i.test(message);
}

async function columnExists(tableName: string, columnName: string): Promise<boolean> {
  const res = await pool.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = $1
          AND column_name = $2
      ) AS exists
    `,
    [tableName, columnName],
  );
  return !!res.rows[0]?.exists;
}

async function resolveColumns(): Promise<ColumnNames> {
  if (columnsPromise) return columnsPromise;

  columnsPromise = (async () => {
    const hasEvidenceJsonInCases = await columnExists("case_pack_cases", "evidence_json");
    const hasEvidenceInCases = await columnExists("case_pack_cases", "evidence");
    const hasFactsJsonInCases = await columnExists("case_pack_cases", "facts_json");
    const hasFactsInCases = await columnExists("case_pack_cases", "facts");

    const casesEvidenceExpr = hasEvidenceJsonInCases
      ? "evidence_json"
      : hasEvidenceInCases
        ? "to_jsonb(evidence)"
        : "'[]'::jsonb";
    const casesFactsExpr = hasFactsJsonInCases
      ? "facts_json"
      : hasFactsInCases
        ? "to_jsonb(facts)"
        : "'{}'::jsonb";

    return {
      casesEvidenceExpr,
      casesFactsExpr,
    };
  })().catch((error) => {
    columnsPromise = null;
    throw error;
  });

  return columnsPromise;
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
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'case_packs' AND column_name = 'key'
      ) THEN
        EXECUTE 'ALTER TABLE case_packs ADD COLUMN key TEXT';
      END IF;

      EXECUTE 'UPDATE case_packs cp SET key = COALESCE(cp.key, NULLIF(to_jsonb(cp)->>''pack_key'', '''')) WHERE cp.key IS NULL';
      EXECUTE 'UPDATE case_packs cp SET key = ''pack-'' || SUBSTRING(cp.id::text, 1, 8) WHERE cp.key IS NULL';

      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'case_pack_cases' AND column_name = 'case_pack_key'
      )
      AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'case_pack_cases' AND column_name = 'pack_key'
      ) THEN
        EXECUTE 'ALTER TABLE case_pack_cases ADD COLUMN pack_key TEXT';
        EXECUTE 'UPDATE case_pack_cases SET pack_key = case_pack_key WHERE pack_key IS NULL';
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'case_pack_cases' AND column_name = 'evidence_json'
      ) THEN
        EXECUTE 'ALTER TABLE case_pack_cases ADD COLUMN evidence_json JSONB NOT NULL DEFAULT ''[]''::jsonb';
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = current_schema() AND table_name = 'case_pack_cases' AND column_name = 'evidence'
        ) THEN
          EXECUTE 'UPDATE case_pack_cases SET evidence_json = COALESCE(to_jsonb(evidence), ''[]''::jsonb)';
        END IF;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'case_pack_cases' AND column_name = 'facts_json'
      ) THEN
        EXECUTE 'ALTER TABLE case_pack_cases ADD COLUMN facts_json JSONB NOT NULL DEFAULT ''{}''::jsonb';
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = current_schema() AND table_name = 'case_pack_cases' AND column_name = 'facts'
        ) THEN
          EXECUTE 'UPDATE case_pack_cases SET facts_json = COALESCE(to_jsonb(facts), ''{}''::jsonb)';
        END IF;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'case_packs' AND column_name = 'active'
      ) THEN
        EXECUTE 'ALTER TABLE case_packs ADD COLUMN active BOOLEAN NOT NULL DEFAULT TRUE';
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = current_schema() AND table_name = 'case_packs' AND column_name = 'is_active'
        ) THEN
          EXECUTE 'UPDATE case_packs SET active = COALESCE(is_active, TRUE)';
        END IF;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'case_pack_cases' AND column_name = 'active'
      ) THEN
        EXECUTE 'ALTER TABLE case_pack_cases ADD COLUMN active BOOLEAN NOT NULL DEFAULT TRUE';
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = current_schema() AND table_name = 'case_pack_cases' AND column_name = 'is_active'
        ) THEN
          EXECUTE 'UPDATE case_pack_cases SET active = COALESCE(is_active, TRUE)';
        END IF;
      END IF;
    END $$;
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'case_packs' AND column_name = 'key'
      ) THEN
        EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS case_packs_key_uidx ON case_packs(key)';
      END IF;

      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'case_pack_cases' AND column_name = 'pack_key'
      ) THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS case_pack_cases_pack_mode_idx ON case_pack_cases(pack_key, mode_player_count)';
      ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'case_pack_cases' AND column_name = 'case_pack_key'
      ) THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS case_pack_cases_case_pack_mode_idx ON case_pack_cases(case_pack_key, mode_player_count)';
      END IF;
    END $$;
  `);

  columnsPromise = null;
  await resolveColumns();
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

function resolveOfficialModeTitle(playerCount: 3 | 4 | 5 | 6): string {
  if (playerCount === 3) return "Гражданский спор / Трудовой спор";
  if (playerCount === 4) return "Уголовное дело";
  if (playerCount === 5) return "Уголовное дело";
  return "Суд на компанию";
}

async function ensurePackRowsFromCases(attempt = 0): Promise<void> {
  await resolveColumns();

  try {
    const keysResult = await pool.query<{ pack_key: string | null }>(`
      SELECT DISTINCT
        ${CASE_PACK_KEY_FROM_ROW_SQL} AS pack_key
      FROM case_pack_cases c
      LEFT JOIN case_packs cp
        ON NULLIF(to_jsonb(c)->>'case_pack_id', '') = to_jsonb(cp)->>'id'
      WHERE ${CASE_PACK_KEY_FROM_ROW_SQL} IS NOT NULL
    `);

    for (const row of keysResult.rows) {
      if (!row.pack_key) continue;
      const key = normalizeCasePackKey(row.pack_key);
      await pool.query(
        `
          INSERT INTO case_packs (id, key, title, description, is_adult, sort_order, updated_at)
          VALUES ($1, $2, $3, $4, FALSE, 100, NOW())
          ON CONFLICT (key)
          DO UPDATE SET updated_at = NOW()
        `,
        [crypto.randomUUID(), key, titleFromPackKey(key), "Пак дел из базы данных."],
      );
    }
  } catch (error) {
    if (attempt === 0 && isUndefinedColumnError(error)) {
      columnsPromise = null;
      return ensurePackRowsFromCases(1);
    }
    throw error;
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

export async function listCasePacks(attempt = 0): Promise<CasePackInfo[]> {
  const merged = new Map<string, CasePackInfo>(
    STATIC_PACKS_FALLBACK.map((pack) => [pack.key, { ...pack }]),
  );

  try {
    const dbResult = await pool.query<{
      pack_key: string;
      case_count: string;
    }>(`
      SELECT
        COALESCE(${CASE_PACK_KEY_FROM_ROW_SQL}, 'classic') AS pack_key,
        COUNT(c.*)::text AS case_count
      FROM case_pack_cases c
      LEFT JOIN case_packs cp
        ON NULLIF(to_jsonb(c)->>'case_pack_id', '') = to_jsonb(cp)->>'id'
      WHERE COALESCE(NULLIF(to_jsonb(c)->>'active', ''), 'true') <> 'false'
      GROUP BY 1
    `);

    dbResult.rows.forEach((row) => {
      const key =
        resolveKnownPackKey(row.pack_key) ||
        sanitizeCasePackKey(row.pack_key) ||
        "classic";
      const dbCount = Math.max(0, Number(row.case_count ?? "0") || 0);
      const fallbackPack = STATIC_PACKS_BY_KEY.get(key);
      const existing = merged.get(key);
      const resolvedCount = Math.max(
        dbCount,
        fallbackPack?.caseCount ?? 0,
        existing?.caseCount ?? 0,
      );

      if (existing) {
        merged.set(key, {
          ...existing,
          caseCount: resolvedCount,
        });
        return;
      }

      merged.set(key, {
        key,
        title: fallbackPack?.title ?? titleFromPackKey(key),
        description: fallbackPack?.description ?? "Пак дел из базы данных.",
        isAdult: fallbackPack?.isAdult ?? false,
        sortOrder: fallbackPack?.sortOrder ?? 200,
        caseCount: resolvedCount,
      });
    });
  } catch (error) {
    if (attempt === 0 && isUndefinedColumnError(error)) {
      columnsPromise = null;
      return listCasePacks(1);
    }
  }

  return [...merged.values()].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, "ru"),
  );
}

async function pickCaseFromPackDb(
  packKey: string,
  modePlayerCount: number,
  attempt = 0,
): Promise<StoredCaseData | null> {
  const safeCount = modePlayerCount as 3 | 4 | 5 | 6;

  try {
    const packRows = await pool.query<{
      pack_id: string | null;
      pack_key: string | null;
      pack_title: string | null;
    }>(`
      SELECT
        COALESCE(
          NULLIF(to_jsonb(cp)->>'id', ''),
          NULLIF(to_jsonb(cp)->>'pack_id', '')
        ) AS pack_id,
        COALESCE(
          NULLIF(to_jsonb(cp)->>'key', ''),
          NULLIF(to_jsonb(cp)->>'pack_key', '')
        ) AS pack_key,
        COALESCE(
          NULLIF(to_jsonb(cp)->>'title', ''),
          NULLIF(to_jsonb(cp)->>'pack_title', '')
        ) AS pack_title
      FROM case_packs cp
    `);
    const packKeyById = new Map<string, string>();
    for (const row of packRows.rows) {
      const id = (row.pack_id ?? "").trim();
      const key =
        resolveKnownPackKey(row.pack_key) ||
        resolveKnownPackKey(row.pack_title) ||
        sanitizeCasePackKey(row.pack_key) ||
        sanitizeCasePackKey(row.pack_title);
      if (id && key) {
        packKeyById.set(id, key);
      }
    }

    const result = await pool.query<{
      case_key: string;
      title: string;
      description: string;
      truth: string;
      evidence_json: unknown;
      facts_json: unknown;
      pack_key_raw: string | null;
      case_pack_key_raw: string | null;
      pack_slug_raw: string | null;
      pack_name_raw: string | null;
      case_pack_id_raw: string | null;
      pack_id_raw: string | null;
    }>(
      `
        SELECT
          COALESCE(
            NULLIF(to_jsonb(c)->>'case_key', ''),
            NULLIF(to_jsonb(c)->>'id', ''),
            'fallback-case'
          ) AS case_key,
          COALESCE(NULLIF(to_jsonb(c)->>'title', ''), 'Дело') AS title,
          COALESCE(NULLIF(to_jsonb(c)->>'description', ''), 'Описание недоступно.') AS description,
          COALESCE(NULLIF(to_jsonb(c)->>'truth', ''), 'Истина недоступна.') AS truth,
          COALESCE(
            to_jsonb(c)->'evidence_json',
            to_jsonb(c)->'evidence',
            '[]'::jsonb
          ) AS evidence_json,
          COALESCE(
            to_jsonb(c)->'facts_json',
            to_jsonb(c)->'facts',
            '{}'::jsonb
          ) AS facts_json,
          NULLIF(to_jsonb(c)->>'pack_key', '') AS pack_key_raw,
          NULLIF(to_jsonb(c)->>'case_pack_key', '') AS case_pack_key_raw,
          NULLIF(to_jsonb(c)->>'pack_slug', '') AS pack_slug_raw,
          NULLIF(to_jsonb(c)->>'pack_name', '') AS pack_name_raw,
          NULLIF(to_jsonb(c)->>'case_pack_id', '') AS case_pack_id_raw,
          NULLIF(to_jsonb(c)->>'pack_id', '') AS pack_id_raw
        FROM case_pack_cases c
        WHERE COALESCE(NULLIF(to_jsonb(c)->>'mode_player_count', ''), '0')::int = $1
          AND COALESCE(NULLIF(to_jsonb(c)->>'active', ''), 'true') <> 'false'
      `,
      [safeCount],
    );

    if (!result.rowCount) return null;

    const matchedRows = result.rows.filter((row) => {
      const keys = new Set<string>();

      const addKey = (value: string | null | undefined) => {
        const known = resolveKnownPackKey(value);
        if (known) {
          keys.add(known);
          return;
        }
        const safe = sanitizeCasePackKey(value);
        if (safe) keys.add(safe);
      };

      addKey(row.pack_key_raw);
      addKey(row.case_pack_key_raw);
      addKey(row.pack_slug_raw);
      addKey(row.pack_name_raw);

      const byCasePackId = packKeyById.get((row.case_pack_id_raw ?? "").trim());
      if (byCasePackId) keys.add(byCasePackId);
      const byPackId = packKeyById.get((row.pack_id_raw ?? "").trim());
      if (byPackId) keys.add(byPackId);

      return keys.has(packKey);
    });

    if (matchedRows.length === 0) return null;
    const row = matchedRows[Math.floor(Math.random() * matchedRows.length)];
    const facts =
      row.facts_json && typeof row.facts_json === "object"
        ? (row.facts_json as Partial<Record<RoleKey, string[]>>)
        : {};

    return {
      id: row.case_key,
      mode: resolveOfficialModeTitle(safeCount),
      title: row.title,
      description: row.description,
      truth: row.truth,
      evidence: Array.isArray(row.evidence_json)
        ? row.evidence_json.filter((item): item is string => typeof item === "string")
        : [],
      roles: buildRolesFromFacts(facts),
    };
  } catch (error) {
    if (attempt === 0 && isUndefinedColumnError(error)) {
      columnsPromise = null;
      return pickCaseFromPackDb(packKey, modePlayerCount, 1);
    }
    return null;
  }
}

async function pickAnyCaseByModeFallback(
  modePlayerCount: number,
): Promise<StoredCaseData | null> {
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
      SELECT
        COALESCE(
          NULLIF(to_jsonb(c)->>'case_key', ''),
          NULLIF(to_jsonb(c)->>'id', ''),
          'fallback-case'
        ) AS case_key,
        COALESCE(NULLIF(to_jsonb(c)->>'title', ''), 'Дело') AS title,
        COALESCE(NULLIF(to_jsonb(c)->>'description', ''), 'Описание недоступно.') AS description,
        COALESCE(NULLIF(to_jsonb(c)->>'truth', ''), 'Истина недоступна.') AS truth,
        COALESCE(
          to_jsonb(c)->'evidence_json',
          to_jsonb(c)->'evidence',
          '[]'::jsonb
        ) AS evidence_json,
        COALESCE(
          to_jsonb(c)->'facts_json',
          to_jsonb(c)->'facts',
          '{}'::jsonb
        ) AS facts_json
      FROM case_pack_cases c
      WHERE COALESCE(NULLIF(to_jsonb(c)->>'mode_player_count', ''), '0')::int = $1
      ORDER BY RANDOM()
      LIMIT 1
    `,
    [safeCount],
  );

  if (!result.rowCount) return null;
  const row = result.rows[0];
  const facts =
    row.facts_json && typeof row.facts_json === "object"
      ? (row.facts_json as Partial<Record<RoleKey, string[]>>)
      : {};

  return {
    id: row.case_key,
    mode: resolveOfficialModeTitle(safeCount),
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
  try {
    const packKey = normalizeCasePackKey(packKeyInput);

    let selected = await pickCaseFromPackDb(packKey, modePlayerCount);
    if (selected) return selected;

    if (packKey !== "classic") {
      selected = await pickCaseFromPackDb("classic", modePlayerCount);
      if (selected) return selected;
    }

    selected = await pickCaseFromPackDb("classic", 3);
    if (selected) return selected;
  } catch {
    // Переходим к безопасному fallback, чтобы матч не блокировался из-за legacy-схемы.
  }

  try {
    const fallbackByMode = await pickAnyCaseByModeFallback(modePlayerCount);
    if (fallbackByMode) return fallbackByMode;
    return await pickAnyCaseByModeFallback(3);
  } catch {
    return null;
  }
}


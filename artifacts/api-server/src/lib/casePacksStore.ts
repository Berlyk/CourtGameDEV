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
  packsKey: "key" | "pack_key";
  casesPackKey: "pack_key" | "case_pack_key";
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

export function normalizeCasePackKey(input?: string | null): string {
  const raw = (input ?? "").trim().toLowerCase();
  if (!raw) return "classic";
  const safe = raw.replace(/[^a-z0-9_-]/g, "");
  return safe || "classic";
}

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
        WHERE table_schema = ANY(current_schemas(true))
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
    const hasPackKeyInPacks = await columnExists("case_packs", "pack_key");
    const hasKeyInPacks = await columnExists("case_packs", "key");
    const hasPackKeyInCases = await columnExists("case_pack_cases", "pack_key");
    const hasCasePackKeyInCases = await columnExists("case_pack_cases", "case_pack_key");
    const hasEvidenceJsonInCases = await columnExists("case_pack_cases", "evidence_json");
    const hasEvidenceInCases = await columnExists("case_pack_cases", "evidence");
    const hasFactsJsonInCases = await columnExists("case_pack_cases", "facts_json");
    const hasFactsInCases = await columnExists("case_pack_cases", "facts");

    const packsKey: "key" | "pack_key" = hasKeyInPacks || !hasPackKeyInPacks ? "key" : "pack_key";
    const casesPackKey: "pack_key" | "case_pack_key" =
      hasPackKeyInCases || !hasCasePackKeyInCases ? "pack_key" : "case_pack_key";
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
      packsKey,
      casesPackKey,
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
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = ANY(current_schemas(true)) AND table_name = 'case_packs' AND column_name = 'pack_key'
      )
      AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = ANY(current_schemas(true)) AND table_name = 'case_packs' AND column_name = 'key'
      ) THEN
        EXECUTE 'ALTER TABLE case_packs ADD COLUMN key TEXT';
        EXECUTE 'UPDATE case_packs SET key = pack_key WHERE key IS NULL';
      END IF;

      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = ANY(current_schemas(true)) AND table_name = 'case_pack_cases' AND column_name = 'case_pack_key'
      )
      AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = ANY(current_schemas(true)) AND table_name = 'case_pack_cases' AND column_name = 'pack_key'
      ) THEN
        EXECUTE 'ALTER TABLE case_pack_cases ADD COLUMN pack_key TEXT';
        EXECUTE 'UPDATE case_pack_cases SET pack_key = case_pack_key WHERE pack_key IS NULL';
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = ANY(current_schemas(true)) AND table_name = 'case_pack_cases' AND column_name = 'evidence_json'
      ) THEN
        EXECUTE 'ALTER TABLE case_pack_cases ADD COLUMN evidence_json JSONB NOT NULL DEFAULT ''[]''::jsonb';
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = ANY(current_schemas(true)) AND table_name = 'case_pack_cases' AND column_name = 'evidence'
        ) THEN
          EXECUTE 'UPDATE case_pack_cases SET evidence_json = COALESCE(to_jsonb(evidence), ''[]''::jsonb)';
        END IF;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = ANY(current_schemas(true)) AND table_name = 'case_pack_cases' AND column_name = 'facts_json'
      ) THEN
        EXECUTE 'ALTER TABLE case_pack_cases ADD COLUMN facts_json JSONB NOT NULL DEFAULT ''{}''::jsonb';
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = ANY(current_schemas(true)) AND table_name = 'case_pack_cases' AND column_name = 'facts'
        ) THEN
          EXECUTE 'UPDATE case_pack_cases SET facts_json = COALESCE(to_jsonb(facts), ''{}''::jsonb)';
        END IF;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = ANY(current_schemas(true)) AND table_name = 'case_packs' AND column_name = 'active'
      ) THEN
        EXECUTE 'ALTER TABLE case_packs ADD COLUMN active BOOLEAN NOT NULL DEFAULT TRUE';
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = ANY(current_schemas(true)) AND table_name = 'case_packs' AND column_name = 'is_active'
        ) THEN
          EXECUTE 'UPDATE case_packs SET active = COALESCE(is_active, TRUE)';
        END IF;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = ANY(current_schemas(true)) AND table_name = 'case_pack_cases' AND column_name = 'active'
      ) THEN
        EXECUTE 'ALTER TABLE case_pack_cases ADD COLUMN active BOOLEAN NOT NULL DEFAULT TRUE';
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = ANY(current_schemas(true)) AND table_name = 'case_pack_cases' AND column_name = 'is_active'
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
        WHERE table_schema = ANY(current_schemas(true)) AND table_name = 'case_packs' AND column_name = 'key'
      ) THEN
        EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS case_packs_key_uidx ON case_packs(key)';
      ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = ANY(current_schemas(true)) AND table_name = 'case_packs' AND column_name = 'pack_key'
      ) THEN
        EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS case_packs_pack_key_uidx ON case_packs(pack_key)';
      END IF;

      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = ANY(current_schemas(true)) AND table_name = 'case_pack_cases' AND column_name = 'pack_key'
      ) THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS case_pack_cases_pack_mode_idx ON case_pack_cases(pack_key, mode_player_count)';
      ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = ANY(current_schemas(true)) AND table_name = 'case_pack_cases' AND column_name = 'case_pack_key'
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

async function ensurePackRowsFromCases(attempt = 0): Promise<void> {
  const columns = await resolveColumns();
  const insertColumns = `${columns.packsKey}, title, description, is_adult, sort_order, updated_at`;
  const insertValues = "$2, $3, $4, FALSE, 100, NOW()";
  const updateSet = "updated_at = NOW()";

  try {
    const keysResult = await pool.query<{ pack_key: string }>(`
      SELECT DISTINCT ${columns.casesPackKey} AS pack_key
      FROM case_pack_cases
      WHERE TRUE
    `);

    for (const row of keysResult.rows) {
      const key = normalizeCasePackKey(row.pack_key);
      await pool.query(
        `
          INSERT INTO case_packs (id, ${insertColumns})
          VALUES ($1, ${insertValues})
          ON CONFLICT (${columns.packsKey})
          DO UPDATE SET ${updateSet}
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
  try {
    await ensureCasePacksStorage();
    try {
      await ensurePackRowsFromCases();
    } catch {
      // ignore
    }

    const columns = await resolveColumns();
    const dbResult = await pool.query<{
      key: string;
      title: string;
      description: string;
      is_adult: boolean;
      sort_order: number;
      case_count: string;
    }>(`
      SELECT
        p.${columns.packsKey} AS key,
        p.title,
        p.description,
        p.is_adult,
        p.sort_order,
        COUNT(c.id)::text AS case_count
      FROM case_packs p
      LEFT JOIN case_pack_cases c
        ON c.${columns.casesPackKey} = p.${columns.packsKey}
      WHERE TRUE
      GROUP BY p.${columns.packsKey}, p.title, p.description, p.is_adult, p.sort_order
      ORDER BY p.sort_order ASC, p.title ASC
    `);

    const mapped = dbResult.rows.map((row) => ({
      key: normalizeCasePackKey(row.key),
      title: row.title,
      description: row.description,
      isAdult: !!row.is_adult,
      sortOrder: Number.isFinite(row.sort_order) ? row.sort_order : 100,
      caseCount: Math.max(0, Number(row.case_count ?? "0") || 0),
    }));

    if (mapped.length > 0) return mapped;
  } catch (error) {
    if (attempt === 0 && isUndefinedColumnError(error)) {
      columnsPromise = null;
      return listCasePacks(1);
    }
  }

  return STATIC_PACKS_FALLBACK;
}

async function pickCaseFromPackDb(
  packKey: string,
  modePlayerCount: number,
  attempt = 0,
): Promise<StoredCaseData | null> {
  await ensureCasePacksStorage();
  const columns = await resolveColumns();
  const safeCount = modePlayerCount as 3 | 4 | 5 | 6;

  try {
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
          case_key,
          title,
          description,
          truth,
          ${columns.casesEvidenceExpr} AS evidence_json,
          ${columns.casesFactsExpr} AS facts_json
        FROM case_pack_cases
        WHERE ${columns.casesPackKey} = $1
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
  } catch (error) {
    if (attempt === 0 && isUndefinedColumnError(error)) {
      columnsPromise = null;
      return pickCaseFromPackDb(packKey, modePlayerCount, 1);
    }
    throw error;
  }
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


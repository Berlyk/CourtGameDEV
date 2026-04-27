import crypto from "node:crypto";
import { pool } from "@workspace/db";
import {
  BACKEND_CASE_PACKS,
  type CompactCasePack,
  type CaseFactRoleKey,
} from "./casePacksImportData.js";
import { pickUserCasePackForRoom } from "./userCasePacksStore.js";

export interface CasePackInfo {
  key: string;
  title: string;
  description: string;
  isAdult: boolean;
  sortOrder: number;
  caseCount: number;
  modeCounts?: Record<3 | 4 | 5 | 6, number>;
  isCustom?: boolean;
  shareCode?: string;
  color?: string;
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

let ensurePromise: Promise<void> | null = null;

const IMPORT_PACK_KEY_MAP: Record<string, string> = {
  classic: "classic",
  template_pack_a: "medieval",
  template_pack_b: "hard",
  template_pack_c: "cyberpunk_2077",
  template_pack_d: "wild_west",
  template_pack_e: "the_boys",
  template_pack_f: "adult_18_plus",
  template_pack_g: "ancient_rome",
};

const KNOWN_PACK_ALIAS_MAP = new Map<string, string>();

function normalizePackAliasLabel(value: string | undefined | null): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\u0451/g, "\u0435")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function sanitizeCasePackKey(value: string | undefined | null): string {
  const raw = (value ?? "").trim().toLowerCase();
  if (!raw) return "";
  return raw
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_");
}

function registerPackAlias(alias: string, targetKey: string): void {
  KNOWN_PACK_ALIAS_MAP.set(normalizePackAliasLabel(alias), targetKey);
}

registerPackAlias("классика", "classic");
registerPackAlias("classic", "classic");
registerPackAlias("средневековье", "medieval");
registerPackAlias("medieval", "medieval");
registerPackAlias("особо тяжкие", "hard");
registerPackAlias("особо тяжкие преступления", "hard");
registerPackAlias("hard", "hard");
registerPackAlias("cyberpunk 2077", "cyberpunk_2077");
registerPackAlias("cyberpunk_2077", "cyberpunk_2077");
registerPackAlias("дикий запад", "wild_west");
registerPackAlias("wild west", "wild_west");
registerPackAlias("wild_west", "wild_west");
registerPackAlias("the boys", "the_boys");
registerPackAlias("the_boys", "the_boys");
registerPackAlias("18+", "adult_18_plus");
registerPackAlias("18 plus", "adult_18_plus");
registerPackAlias("adult_18_plus", "adult_18_plus");
registerPackAlias("древний рим", "ancient_rome");
registerPackAlias("ancient rome", "ancient_rome");
registerPackAlias("ancient_rome", "ancient_rome");

function resolveKnownPackKey(value: string | undefined | null): string | null {
  const byLabel = KNOWN_PACK_ALIAS_MAP.get(normalizePackAliasLabel(value));
  if (byLabel) return byLabel;
  const safe = sanitizeCasePackKey(value);
  if (!safe) return null;
  return KNOWN_PACK_ALIAS_MAP.get(normalizePackAliasLabel(safe)) ?? safe;
}

export function normalizeCasePackKey(input?: string | null): string {
  const known = resolveKnownPackKey(input);
  return known || "classic";
}

function parseBoolean(raw: string | undefined | null, fallback = false): boolean {
  const value = String(raw ?? "").trim().toLowerCase();
  if (!value) return fallback;
  if (["1", "true", "t", "yes", "y", "on"].includes(value)) return true;
  if (["0", "false", "f", "no", "n", "off"].includes(value)) return false;
  return fallback;
}

function parseNumber(raw: string | undefined | null, fallback = 0): number {
  const value = Number(raw ?? "");
  return Number.isFinite(value) ? value : fallback;
}

function buildPackTitleFromKey(key: string): string {
  const raw = key.replace(/[_-]+/g, " ").trim();
  if (!raw) return "КЛАССИКА";
  return raw
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

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function parseFactsMap(value: unknown): Partial<Record<RoleKey, string[]>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Partial<Record<RoleKey, string[]>> = {};
  const roleKeys = Object.keys(ROLE_TITLES) as RoleKey[];
  for (const roleKey of roleKeys) {
    const roleFacts = (value as Record<string, unknown>)[roleKey];
    result[roleKey] = parseStringArray(roleFacts);
  }
  return result;
}

function buildRolesFromFacts(
  facts: Partial<Record<RoleKey, string[]>>,
): Record<string, { title: string; goal: string; facts: string[] }> {
  const result: Record<string, { title: string; goal: string; facts: string[] }> = {};
  const roleKeys = Object.keys(ROLE_TITLES) as RoleKey[];
  for (const roleKey of roleKeys) {
    result[roleKey] = {
      title: ROLE_TITLES[roleKey],
      goal: ROLE_GOALS[roleKey],
      facts: roleKey === "judge" ? [] : facts[roleKey] ?? [],
    };
  }
  return result;
}

function mapImportedPackKey(pack: CompactCasePack): string {
  const rawKey = sanitizeCasePackKey(pack.key);
  const mapped = IMPORT_PACK_KEY_MAP[rawKey];
  if (mapped) return mapped;
  const fromTitle = resolveKnownPackKey(pack.title);
  if (fromTitle) return fromTitle;
  return normalizeCasePackKey(rawKey || pack.title || "classic");
}

function mapImportedFacts(
  facts: Partial<Record<CaseFactRoleKey, string[]>> | undefined,
): Partial<Record<RoleKey, string[]>> {
  const safeFacts = facts ?? {};
  return {
    plaintiff: parseStringArray(safeFacts.plaintiff),
    defendant: parseStringArray(safeFacts.defendant),
    prosecutor: parseStringArray(safeFacts.prosecutor),
    defenseLawyer: parseStringArray(safeFacts.defenseLawyer),
    plaintiffLawyer: parseStringArray(safeFacts.plaintiffLawyer),
  };
}

type CachedCasePack = {
  key: string;
  title: string;
  description: string;
  isAdult: boolean;
  sortOrder: number;
  casesByPlayers: Record<3 | 4 | 5 | 6, StoredCaseData[]>;
};

function cloneStoredCase(source: StoredCaseData): StoredCaseData {
  return JSON.parse(JSON.stringify(source)) as StoredCaseData;
}

function buildImportedPackCache(): CachedCasePack[] {
  if (!Array.isArray(BACKEND_CASE_PACKS)) return [];
  return BACKEND_CASE_PACKS.map((sourcePack) => {
    const key = mapImportedPackKey(sourcePack);
    const title = (sourcePack.title ?? "").trim().toUpperCase() || buildPackTitleFromKey(key);
    const description = (sourcePack.description ?? "").trim() || "Пак дел.";
    const sortOrder = parseNumber(String(sourcePack.sortOrder), 100);
    const isAdult = Boolean(sourcePack.isAdult);

    const casesByPlayers = {
      3: [] as StoredCaseData[],
      4: [] as StoredCaseData[],
      5: [] as StoredCaseData[],
      6: [] as StoredCaseData[],
    };

    for (const playerCount of [3, 4, 5, 6] as const) {
      const sourceCases = sourcePack.casesByPlayers?.[playerCount] ?? [];
      for (let index = 0; index < sourceCases.length; index += 1) {
        const sourceCase = sourceCases[index];
        const caseKey = sanitizeCasePackKey(sourceCase?.key) || `case_${playerCount}_${index + 1}`;
        const facts = mapImportedFacts(sourceCase?.facts);
        casesByPlayers[playerCount].push({
          id: caseKey,
          mode: resolveOfficialModeTitle(playerCount),
          title: (sourceCase?.title ?? "").trim() || "Дело",
          description: (sourceCase?.description ?? "").trim() || "Описание недоступно.",
          truth: (sourceCase?.truth ?? "").trim() || "Истина недоступна.",
          evidence: parseStringArray(sourceCase?.evidence),
          roles: buildRolesFromFacts(facts),
        });
      }
    }

    return {
      key,
      title,
      description,
      isAdult,
      sortOrder,
      casesByPlayers,
    };
  });
}

const IMPORTED_PACK_CACHE = buildImportedPackCache();

function listCasePacksFromCache(): CasePackInfo[] {
  return [...IMPORTED_PACK_CACHE]
    .map((pack) => ({
      key: pack.key,
      title: pack.title,
      description: pack.description,
      isAdult: pack.isAdult,
      sortOrder: pack.sortOrder,
      caseCount:
        pack.casesByPlayers[3].length +
        pack.casesByPlayers[4].length +
        pack.casesByPlayers[5].length +
        pack.casesByPlayers[6].length,
      modeCounts: {
        3: pack.casesByPlayers[3].length,
        4: pack.casesByPlayers[4].length,
        5: pack.casesByPlayers[5].length,
        6: pack.casesByPlayers[6].length,
      },
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, "ru"));
}

function pickCaseFromCache(packKey: string, modePlayerCount: 3 | 4 | 5 | 6): StoredCaseData | null {
  const directPack = IMPORTED_PACK_CACHE.find((pack) => pack.key === packKey);
  const fallbackPack =
    IMPORTED_PACK_CACHE.find((pack) => pack.key === "classic") ??
    IMPORTED_PACK_CACHE[0] ??
    null;
  const selectedPack = directPack ?? fallbackPack;
  if (!selectedPack) return null;
  const pool = selectedPack.casesByPlayers[modePlayerCount] ?? [];
  if (pool.length === 0) return null;
  const randomCase = pool[Math.floor(Math.random() * pool.length)];
  return cloneStoredCase(randomCase);
}

async function syncCasePacksFromImportFile(): Promise<void> {
  if (!Array.isArray(BACKEND_CASE_PACKS) || BACKEND_CASE_PACKS.length === 0) return;

  await pool.query("BEGIN");
  try {
    await pool.query(`UPDATE case_pack_cases SET active = FALSE WHERE active = TRUE`);
    await pool.query(`UPDATE case_packs SET active = FALSE WHERE active = TRUE`);

    for (const sourcePack of BACKEND_CASE_PACKS) {
      const packKey = mapImportedPackKey(sourcePack);
      const packTitle = (sourcePack.title ?? "").trim().toUpperCase() || buildPackTitleFromKey(packKey);
      const packDescription = (sourcePack.description ?? "").trim() || "Пак дел.";
      const packSortOrder = parseNumber(String(sourcePack.sortOrder), 100);
      const packIsAdult = Boolean(sourcePack.isAdult);

      const packUpsert = await pool.query<{ id: string }>(
        `
          INSERT INTO case_packs (
            id, key, title, description, is_adult, sort_order, active, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, TRUE, NOW(), NOW())
          ON CONFLICT (key) DO UPDATE
          SET
            title = EXCLUDED.title,
            description = EXCLUDED.description,
            is_adult = EXCLUDED.is_adult,
            sort_order = EXCLUDED.sort_order,
            active = TRUE,
            updated_at = NOW()
          RETURNING id
        `,
        [crypto.randomUUID(), packKey, packTitle, packDescription, packIsAdult, packSortOrder],
      );
      const packId = packUpsert.rows[0]?.id;
      if (!packId) continue;

      await pool.query(`DELETE FROM case_pack_cases WHERE case_pack_id = $1`, [packId]);

      const usedCaseKeys = new Set<string>();
      for (const playerCount of [3, 4, 5, 6] as const) {
        const cases = sourcePack.casesByPlayers?.[playerCount] ?? [];
        for (let index = 0; index < cases.length; index += 1) {
          const sourceCase = cases[index];
          const normalizedRawCaseKey = sanitizeCasePackKey(sourceCase?.key);
          let caseKey = normalizedRawCaseKey || `case_${playerCount}_${index + 1}`;
          if (usedCaseKeys.has(caseKey)) {
            caseKey = `${caseKey}_${playerCount}_${index + 1}`;
          }
          usedCaseKeys.add(caseKey);

          const title = (sourceCase?.title ?? "").trim() || "Дело";
          const description = (sourceCase?.description ?? "").trim() || "Описание недоступно.";
          const truth = (sourceCase?.truth ?? "").trim() || "Истина недоступна.";
          const evidence = parseStringArray(sourceCase?.evidence);
          const facts = mapImportedFacts(sourceCase?.facts);

          await pool.query(
            `
              INSERT INTO case_pack_cases (
                id,
                case_pack_id,
                case_key,
                mode_player_count,
                title,
                description,
                truth,
                evidence_json,
                facts_json,
                sort_order,
                active,
                created_at,
                updated_at
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, TRUE, NOW(), NOW())
            `,
            [
              crypto.randomUUID(),
              packId,
              caseKey,
              playerCount,
              title,
              description,
              truth,
              JSON.stringify(evidence),
              JSON.stringify(facts),
              index + 1,
            ],
          );
        }
      }
    }

    await pool.query("COMMIT");
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }
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

function quoteIdent(identifier: string): string {
  return `"${identifier.replace(/"/g, "\"\"")}"`;
}

async function relaxLegacyCasePackCasesConstraints(): Promise<void> {
  const canonicalColumns = new Set([
    "id",
    "case_pack_id",
    "case_key",
    "mode_player_count",
    "title",
    "description",
    "truth",
    "evidence_json",
    "facts_json",
    "sort_order",
    "active",
    "created_at",
    "updated_at",
  ]);

  const columns = await pool.query<{
    column_name: string;
    is_nullable: string;
  }>(`
    SELECT column_name, is_nullable
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'case_pack_cases'
  `);

  for (const column of columns.rows) {
    const columnName = (column.column_name ?? "").trim();
    if (!columnName) continue;
    if (canonicalColumns.has(columnName)) continue;
    if ((column.is_nullable ?? "").toUpperCase() !== "NO") continue;

    try {
      await pool.query(
        `ALTER TABLE case_pack_cases ALTER COLUMN ${quoteIdent(columnName)} DROP NOT NULL`,
      );
    } catch {
      // noop: если колонка системная/ограничение нельзя снять, просто идем дальше
    }
  }
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
      case_pack_id UUID NOT NULL REFERENCES case_packs(id) ON DELETE CASCADE,
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
      UNIQUE (case_pack_id, case_key)
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

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'case_packs' AND column_name = 'title'
      ) THEN
        EXECUTE 'ALTER TABLE case_packs ADD COLUMN title TEXT';
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'case_packs' AND column_name = 'description'
      ) THEN
        EXECUTE 'ALTER TABLE case_packs ADD COLUMN description TEXT';
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'case_packs' AND column_name = 'is_adult'
      ) THEN
        EXECUTE 'ALTER TABLE case_packs ADD COLUMN is_adult BOOLEAN NOT NULL DEFAULT FALSE';
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'case_packs' AND column_name = 'sort_order'
      ) THEN
        EXECUTE 'ALTER TABLE case_packs ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 100';
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

      EXECUTE 'UPDATE case_packs cp
               SET key = COALESCE(
                 NULLIF(cp.key, ''''),
                 NULLIF(to_jsonb(cp)->>''pack_key'', ''''),
                 NULLIF(regexp_replace(lower(to_jsonb(cp)->>''pack_title''), ''[^a-z0-9]+'', ''_'', ''g''), '''')
               )
               WHERE cp.key IS NULL OR cp.key = ''''';

      EXECUTE 'UPDATE case_packs cp
               SET key = ''pack-'' || SUBSTRING(cp.id::text, 1, 8)
               WHERE cp.key IS NULL OR cp.key = ''''';

      EXECUTE 'UPDATE case_packs cp
               SET title = COALESCE(
                 NULLIF(cp.title, ''''),
                 NULLIF(to_jsonb(cp)->>''pack_title'', ''''),
                 upper(replace(cp.key, ''_'', '' ''))
               )
               WHERE cp.title IS NULL OR cp.title = ''''';

      EXECUTE 'UPDATE case_packs cp
               SET description = COALESCE(
                 NULLIF(cp.description, ''''),
                 NULLIF(to_jsonb(cp)->>''pack_description'', ''''),
                 ''Пак дел.''
               )
               WHERE cp.description IS NULL OR cp.description = ''''';

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'case_pack_cases' AND column_name = 'case_pack_id'
      ) THEN
        EXECUTE 'ALTER TABLE case_pack_cases ADD COLUMN case_pack_id UUID';
      END IF;

      EXECUTE '
        UPDATE case_pack_cases c
        SET case_pack_id = cp.id
        FROM case_packs cp
        WHERE c.case_pack_id IS NULL
          AND (
            NULLIF(to_jsonb(c)->>''case_pack_id'', '''') = cp.id::text
            OR NULLIF(to_jsonb(c)->>''pack_id'', '''') = cp.id::text
          )';

      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'case_pack_cases' AND column_name = 'pack_id'
      ) THEN
        EXECUTE '
          UPDATE case_pack_cases
          SET case_pack_id = COALESCE(case_pack_id, pack_id)
          WHERE case_pack_id IS NULL
            AND pack_id IS NOT NULL';

        EXECUTE '
          UPDATE case_pack_cases
          SET pack_id = COALESCE(pack_id, case_pack_id)
          WHERE pack_id IS NULL
            AND case_pack_id IS NOT NULL';

        BEGIN
          EXECUTE 'ALTER TABLE case_pack_cases ALTER COLUMN pack_id DROP NOT NULL';
        EXCEPTION
          WHEN OTHERS THEN
            NULL;
        END;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'case_pack_cases' AND column_name = 'mode_player_count'
      ) THEN
        EXECUTE 'ALTER TABLE case_pack_cases ADD COLUMN mode_player_count INTEGER';
      END IF;

      EXECUTE '
        UPDATE case_pack_cases c
        SET mode_player_count = CASE
          WHEN NULLIF(to_jsonb(c)->>''mode_player_count'', '''') ~ ''^[0-9]+$'' THEN (to_jsonb(c)->>''mode_player_count'')::int
          WHEN NULLIF(to_jsonb(c)->>''player_count'', '''') ~ ''^[0-9]+$'' THEN (to_jsonb(c)->>''player_count'')::int
          ELSE mode_player_count
        END
        WHERE mode_player_count IS NULL';

      EXECUTE 'UPDATE case_pack_cases SET mode_player_count = 3 WHERE mode_player_count IS NULL';

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'case_pack_cases' AND column_name = 'evidence_json'
      ) THEN
        EXECUTE 'ALTER TABLE case_pack_cases ADD COLUMN evidence_json JSONB NOT NULL DEFAULT ''[]''::jsonb';
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'case_pack_cases' AND column_name = 'facts_json'
      ) THEN
        EXECUTE 'ALTER TABLE case_pack_cases ADD COLUMN facts_json JSONB NOT NULL DEFAULT ''{}''::jsonb';
      END IF;

      EXECUTE 'UPDATE case_pack_cases c
               SET evidence_json = COALESCE(to_jsonb(c)->''evidence_json'', to_jsonb(c)->''evidence'', ''[]''::jsonb)';

      EXECUTE 'UPDATE case_pack_cases c
               SET facts_json = COALESCE(to_jsonb(c)->''facts_json'', to_jsonb(c)->''facts'', ''{}''::jsonb)';

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

      EXECUTE '
        UPDATE case_pack_cases c
        SET active = FALSE
        WHERE NULLIF(to_jsonb(c)->>''pack_id'', '''') IS NULL
          AND (
            NULLIF(to_jsonb(c)->>''pack_key'', '''') IS NOT NULL
            OR NULLIF(to_jsonb(c)->>''case_pack_key'', '''') IS NOT NULL
          )';

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'case_pack_cases' AND column_name = 'sort_order'
      ) THEN
        EXECUTE 'ALTER TABLE case_pack_cases ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 100';
      END IF;

      EXECUTE '
        UPDATE case_pack_cases c
        SET active = FALSE
        FROM case_packs cp
        WHERE c.case_pack_id = cp.id
          AND c.active = TRUE
          AND cp.active = TRUE
          AND (
            lower(coalesce(cp.key, '''')) LIKE ''%template%''
            OR lower(coalesce(cp.title, '''')) LIKE ''%С€Р°Р±Р»РѕРЅ%''
          )';

      EXECUTE '
        UPDATE case_packs cp
        SET active = FALSE
        WHERE cp.active = TRUE
          AND (
            lower(coalesce(cp.key, '''')) LIKE ''%template%''
            OR lower(coalesce(cp.title, '''')) LIKE ''%С€Р°Р±Р»РѕРЅ%''
          )';

      EXECUTE '
        WITH legacy_classic AS (
          SELECT cp.id
          FROM case_packs cp
          JOIN case_pack_cases c ON c.case_pack_id = cp.id
          WHERE cp.active = TRUE
            AND c.active = TRUE
            AND lower(coalesce(cp.key, '''')) = ''classic''
          GROUP BY cp.id
          HAVING COUNT(*) BETWEEN 80 AND 81
        )
        UPDATE case_pack_cases c
        SET active = FALSE
        WHERE c.active = TRUE
          AND c.case_pack_id IN (SELECT id FROM legacy_classic)';
    END $$;
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS case_packs_key_uidx ON case_packs(key);
    CREATE INDEX IF NOT EXISTS case_pack_cases_mode_idx ON case_pack_cases(mode_player_count);
    CREATE INDEX IF NOT EXISTS case_pack_cases_case_pack_id_mode_idx ON case_pack_cases(case_pack_id, mode_player_count);
  `);

  await relaxLegacyCasePackCasesConstraints();
  await syncCasePacksFromImportFile();
}

export async function ensureCasePacksStorage(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = Promise.resolve();
  }
  return ensurePromise;
}

type PackRow = {
  pack_id: string | null;
  pack_key: string | null;
  pack_title: string | null;
  pack_description: string | null;
  pack_is_adult: string | null;
  pack_sort_order: string | null;
  pack_active: string | null;
};

type CaseCountRow = {
  case_pack_id: string | null;
  case_count: number;
};

type CaseLinkRow = {
  case_pack_id: string | null;
  pack_key_raw: string | null;
  case_pack_key_raw: string | null;
};

async function fetchActivePacks(): Promise<PackRow[]> {
  const result = await pool.query<PackRow>(`
    SELECT
      NULLIF(to_jsonb(cp)->>'id', '') AS pack_id,
      COALESCE(
        NULLIF(to_jsonb(cp)->>'key', ''),
        NULLIF(to_jsonb(cp)->>'pack_key', '')
      ) AS pack_key,
      COALESCE(
        NULLIF(to_jsonb(cp)->>'title', ''),
        NULLIF(to_jsonb(cp)->>'pack_title', '')
      ) AS pack_title,
      COALESCE(
        NULLIF(to_jsonb(cp)->>'description', ''),
        NULLIF(to_jsonb(cp)->>'pack_description', '')
      ) AS pack_description,
      COALESCE(NULLIF(to_jsonb(cp)->>'is_adult', ''), 'false') AS pack_is_adult,
      COALESCE(NULLIF(to_jsonb(cp)->>'sort_order', ''), '100') AS pack_sort_order,
      COALESCE(NULLIF(to_jsonb(cp)->>'active', ''), NULLIF(to_jsonb(cp)->>'is_active', ''), 'true') AS pack_active
    FROM case_packs cp
  `);

  return result.rows.filter((row) => parseBoolean(row.pack_active, true));
}

function isTemplatePack(key: string, title?: string | null): boolean {
  const source = `${key} ${title ?? ""}`.toLowerCase();
  return source.includes("template") || source.includes("\u0448\u0430\u0431\u043b\u043e\u043d");
}

export async function listCasePacks(attempt = 0): Promise<CasePackInfo[]> {
  void attempt;
  return listCasePacksFromCache();
}

async function resolvePackIdByKey(packKey: string): Promise<string | null> {
  const rows = await fetchActivePacks();
  for (const row of rows) {
    const key = normalizeCasePackKey(row.pack_key ?? row.pack_title ?? "classic");
    if (key === packKey) {
      return (row.pack_id ?? "").trim() || null;
    }
  }
  return null;
}

async function pickCaseFromPackDb(
  packKey: string,
  modePlayerCount: number,
  attempt = 0,
): Promise<StoredCaseData | null> {
  const safeCount = modePlayerCount as 3 | 4 | 5 | 6;

  try {
    await ensureCasePacksStorage();
    const packId = await resolvePackIdByKey(packKey);

    const result = await pool.query<{
      case_key: string;
      title: string;
      description: string;
      truth: string;
      evidence_json: unknown;
      facts_json: unknown;
      case_pack_id: string | null;
      pack_key_raw: string | null;
      case_pack_key_raw: string | null;
    }>(
      `
        SELECT
          COALESCE(NULLIF(to_jsonb(c)->>'case_key', ''), NULLIF(to_jsonb(c)->>'id', ''), 'fallback-case') AS case_key,
          COALESCE(NULLIF(to_jsonb(c)->>'title', ''), 'Дело') AS title,
          COALESCE(NULLIF(to_jsonb(c)->>'description', ''), 'Описание недоступно.') AS description,
          COALESCE(NULLIF(to_jsonb(c)->>'truth', ''), 'Истина недоступна.') AS truth,
          COALESCE(to_jsonb(c)->'evidence_json', to_jsonb(c)->'evidence', '[]'::jsonb) AS evidence_json,
          COALESCE(to_jsonb(c)->'facts_json', to_jsonb(c)->'facts', '{}'::jsonb) AS facts_json,
          NULLIF(to_jsonb(c)->>'case_pack_id', '') AS case_pack_id,
          NULLIF(to_jsonb(c)->>'pack_key', '') AS pack_key_raw,
          NULLIF(to_jsonb(c)->>'case_pack_key', '') AS case_pack_key_raw
        FROM case_pack_cases c
        WHERE COALESCE(NULLIF(to_jsonb(c)->>'mode_player_count', ''), '0')::int = $1
          AND COALESCE(NULLIF(to_jsonb(c)->>'active', ''), NULLIF(to_jsonb(c)->>'is_active', ''), 'true') <> 'false'
      `,
      [safeCount],
    );

    if (!result.rowCount) return null;
    const linkedRows = packId
      ? result.rows.filter((row) => (row.case_pack_id ?? "").trim() === packId)
      : [];
    const legacyRows = result.rows.filter((row) => {
      const key = normalizeCasePackKey(row.pack_key_raw ?? row.case_pack_key_raw);
      return key === packKey;
    });
    const selectedPool =
      legacyRows.length > linkedRows.length ? legacyRows : linkedRows.length > 0 ? linkedRows : legacyRows;

    if (selectedPool.length === 0) {
      return pickCaseFromCache(packKey, safeCount);
    }
    const row = selectedPool[Math.floor(Math.random() * selectedPool.length)];
    const facts = parseFactsMap(row.facts_json);

    return {
      id: row.case_key,
      mode: resolveOfficialModeTitle(safeCount),
      title: row.title,
      description: row.description,
      truth: row.truth,
      evidence: parseStringArray(row.evidence_json),
      roles: buildRolesFromFacts(facts),
    };
  } catch (error) {
    if (attempt === 0 && isUndefinedColumnError(error)) {
      ensurePromise = null;
      return pickCaseFromPackDb(packKey, modePlayerCount, 1);
    }
    console.error("pickCaseFromPackDb failed", error);
    return pickCaseFromCache(packKey, safeCount);
  }
}

export async function pickCaseForRoom(
  packKeyInput: string | undefined,
  modePlayerCount: number,
): Promise<StoredCaseData | null> {
  const rawPackKey = String(packKeyInput ?? "").trim().toLowerCase();
  if (rawPackKey.startsWith("custom_")) {
    const customCase = await pickUserCasePackForRoom(rawPackKey, modePlayerCount);
    return customCase ?? null;
  }

  const requestedKey = normalizeCasePackKey(packKeyInput);
  const packKey = isTemplatePack(requestedKey) ? "classic" : requestedKey;
  const safeCount = modePlayerCount as 3 | 4 | 5 | 6;
  return pickCaseFromPackDb(packKey, safeCount);
}


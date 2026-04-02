import crypto from "node:crypto";
import { pool } from "@workspace/db";
import {
  BACKEND_CASE_PACKS,
  type CompactCase,
  type RoleKey,
} from "./casePacks.backend.js";

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

const ROLE_TITLES: Record<RoleKey, string> = {
  judge: "Судья",
  plaintiff: "Истец",
  defendant: "Ответчик",
  prosecutor: "Прокурор",
  defenseLawyer: "Адвокат ответчика",
  plaintiffLawyer: "Адвокат истца",
};

const ROLE_GOALS: Record<RoleKey, string> = {
  judge: "Вынести максимально точный вердикт на основе представленных улик и раскрытых фактов",
  plaintiff:
    "Доказать, что его требования обоснованы и добиться решения суда в свою пользу",
  defendant: "Опровергнуть обвинения и добиться полного или частичного оправдания",
  prosecutor:
    "Доказать виновность ответчика и убедить суд в необходимости наказания",
  defenseLawyer:
    "Защитить ответчика, опровергнуть доводы обвинения и добиться оправдания или смягчения решения",
  plaintiffLawyer:
    "Усилить позицию истца, доказать обоснованность требований и склонить суд к решению в его пользу",
};

let ensurePromise: Promise<void> | null = null;

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

export async function ensureCasePacksStorage(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = ensureTablesInternal().catch((error) => {
      ensurePromise = null;
      throw error;
    });
  }
  return ensurePromise;
}

function countPackCases(pack: (typeof BACKEND_CASE_PACKS)[number]): number {
  return (pack.casesByPlayers[3]?.length ?? 0)
    + (pack.casesByPlayers[4]?.length ?? 0)
    + (pack.casesByPlayers[5]?.length ?? 0)
    + (pack.casesByPlayers[6]?.length ?? 0);
}

export async function ensureDefaultCasePackSeeded(): Promise<void> {
  await ensureCasePacksStorage();

  for (const pack of BACKEND_CASE_PACKS) {
    await pool.query(
      `
        INSERT INTO case_packs (id, key, title, description, is_adult, sort_order, active, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, TRUE, NOW())
        ON CONFLICT (key)
        DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          is_adult = EXCLUDED.is_adult,
          sort_order = EXCLUDED.sort_order,
          active = TRUE,
          updated_at = NOW()
      `,
      [
        crypto.randomUUID(),
        pack.key,
        pack.title,
        pack.description,
        !!pack.isAdult,
        pack.sortOrder,
      ],
    );

    for (const mode of [3, 4, 5, 6] as const) {
      const cases = pack.casesByPlayers[mode] ?? [];
      for (let index = 0; index < cases.length; index += 1) {
        const source = cases[index];
        await pool.query(
          `
            INSERT INTO case_pack_cases (
              id, pack_key, case_key, mode_player_count,
              title, description, truth, evidence_json, facts_json,
              sort_order, active, updated_at
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,TRUE,NOW())
            ON CONFLICT (pack_key, case_key)
            DO UPDATE SET
              mode_player_count = EXCLUDED.mode_player_count,
              title = EXCLUDED.title,
              description = EXCLUDED.description,
              truth = EXCLUDED.truth,
              evidence_json = EXCLUDED.evidence_json,
              facts_json = EXCLUDED.facts_json,
              sort_order = EXCLUDED.sort_order,
              active = TRUE,
              updated_at = NOW()
          `,
          [
            crypto.randomUUID(),
            pack.key,
            source.key,
            mode,
            source.title,
            source.description,
            source.truth,
            JSON.stringify(source.evidence ?? []),
            JSON.stringify(source.facts ?? {}),
            index + 1,
          ],
        );
      }
    }
  }
}

function buildRolesFromFacts(
  facts: Partial<Record<RoleKey, string[]>>,
): Record<string, { title: string; goal: string; facts: string[] }> {
  const result: Record<string, { title: string; goal: string; facts: string[] }> = {};
  const roleKeys = Object.keys(ROLE_TITLES) as RoleKey[];

  for (const roleKey of roleKeys) {
    if (roleKey === "judge") {
      result[roleKey] = {
        title: ROLE_TITLES[roleKey],
        goal: ROLE_GOALS[roleKey],
        facts: [],
      };
      continue;
    }

    const roleFactsRaw = facts[roleKey] ?? [];
    const roleFacts = Array.isArray(roleFactsRaw)
      ? roleFactsRaw.filter((item): item is string => typeof item === "string")
      : [];

    result[roleKey] = {
      title: ROLE_TITLES[roleKey],
      goal: ROLE_GOALS[roleKey],
      facts: roleFacts,
    };
  }

  return result;
}

function toStoredCaseData(source: CompactCase, modePlayerCount: number): StoredCaseData {
  return {
    id: source.key,
    mode: `Режим на ${modePlayerCount}`,
    title: source.title,
    description: source.description,
    truth: source.truth,
    evidence: source.evidence,
    roles: buildRolesFromFacts(source.facts),
  };
}

export async function listCasePacks(): Promise<CasePackInfo[]> {
  await ensureCasePacksStorage();

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

  if (dbResult.rows.length > 0) {
    return dbResult.rows.map((row) => ({
      key: row.key,
      title: row.title,
      description: row.description,
      isAdult: !!row.is_adult,
      sortOrder: Number.isFinite(row.sort_order) ? row.sort_order : 100,
      caseCount: Math.max(0, Number(row.case_count ?? "0") || 0),
    }));
  }

  return [...BACKEND_CASE_PACKS]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((pack) => ({
      key: pack.key,
      title: pack.title,
      description: pack.description,
      isAdult: !!pack.isAdult,
      sortOrder: pack.sortOrder,
      caseCount: countPackCases(pack),
    }));
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
  const compact: CompactCase = {
    key: row.case_key,
    title: row.title,
    description: row.description,
    truth: row.truth,
    evidence: Array.isArray(row.evidence_json)
      ? row.evidence_json.filter((item): item is string => typeof item === "string")
      : [],
    facts:
      row.facts_json && typeof row.facts_json === "object"
        ? (row.facts_json as Partial<Record<RoleKey, string[]>>)
        : {},
  };
  return toStoredCaseData(compact, safeCount);
}

function pickRandom<T>(items: T[]): T | null {
  if (!items.length) return null;
  const index = Math.floor(Math.random() * items.length);
  return items[index] ?? null;
}

function pickCaseFromPackLegacy(packKey: string, modePlayerCount: number): StoredCaseData | null {
  const pack = BACKEND_CASE_PACKS.find((p) => normalizeCasePackKey(p.key) === packKey);
  if (!pack) return null;
  const safeCount = modePlayerCount as 3 | 4 | 5 | 6;
  const list = pack.casesByPlayers[safeCount] ?? [];
  const selected = pickRandom(list);
  if (!selected) return null;
  return toStoredCaseData(selected, modePlayerCount);
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

  selected = await pickCaseFromPackDb("classic", 3);
  if (selected) return selected;

  const legacySelected = pickCaseFromPackLegacy(packKey, modePlayerCount);
  if (legacySelected) return legacySelected;
  if (packKey !== "classic") {
    const fallback = pickCaseFromPackLegacy("classic", modePlayerCount);
    if (fallback) return fallback;
  }
  return pickCaseFromPackLegacy("classic", 3);
}

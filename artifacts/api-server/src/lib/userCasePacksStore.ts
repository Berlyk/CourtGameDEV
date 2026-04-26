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
type CaseVerdictKey = "guilty" | "not_guilty" | "partial_guilty";

const ROLE_KEYS: CaseRoleKey[] = [
  "judge",
  "plaintiff",
  "defendant",
  "prosecutor",
  "defenseLawyer",
  "plaintiffLawyer",
];

const ROLE_TITLES: Record<CaseRoleKey, string> = {
  judge: "РЎСѓРґСЊСЏ",
  plaintiff: "РСЃС‚РµС†",
  defendant: "РћС‚РІРµС‚С‡РёРє",
  prosecutor: "РџСЂРѕРєСѓСЂРѕСЂ",
  defenseLawyer: "РђРґРІРѕРєР°С‚ РѕС‚РІРµС‚С‡РёРєР°",
  plaintiffLawyer: "РђРґРІРѕРєР°С‚ РёСЃС‚С†Р°",
};

const ROLE_GOALS: Record<CaseRoleKey, string> = {
  judge:
    "Р’С‹РЅРµСЃС‚Рё РјР°РєСЃРёРјР°Р»СЊРЅРѕ С‚РѕС‡РЅС‹Р№ РІРµСЂРґРёРєС‚ РЅР° РѕСЃРЅРѕРІРµ РїСЂРµРґСЃС‚Р°РІР»РµРЅРЅС‹С… СѓР»РёРє Рё СЂР°СЃРєСЂС‹С‚С‹С… С„Р°РєС‚РѕРІ.",
  plaintiff:
    "Р”РѕРєР°Р·Р°С‚СЊ, С‡С‚Рѕ РµРіРѕ С‚СЂРµР±РѕРІР°РЅРёСЏ РѕР±РѕСЃРЅРѕРІР°РЅС‹ Рё РґРѕР±РёС‚СЊСЃСЏ СЂРµС€РµРЅРёСЏ СЃСѓРґР° РІ СЃРІРѕСЋ РїРѕР»СЊР·Сѓ.",
  defendant:
    "РћРїСЂРѕРІРµСЂРіРЅСѓС‚СЊ РѕР±РІРёРЅРµРЅРёСЏ Рё РґРѕР±РёС‚СЊСЃСЏ РїРѕР»РЅРѕРіРѕ РёР»Рё С‡Р°СЃС‚РёС‡РЅРѕРіРѕ РѕРїСЂР°РІРґР°РЅРёСЏ.",
  prosecutor:
    "Р”РѕРєР°Р·Р°С‚СЊ РІРёРЅРѕРІРЅРѕСЃС‚СЊ РѕС‚РІРµС‚С‡РёРєР° Рё СѓР±РµРґРёС‚СЊ СЃСѓРґ РІ РЅРµРѕР±С…РѕРґРёРјРѕСЃС‚Рё РЅР°РєР°Р·Р°РЅРёСЏ.",
  defenseLawyer:
    "Р—Р°С‰РёС‚РёС‚СЊ РѕС‚РІРµС‚С‡РёРєР°, РѕРїСЂРѕРІРµСЂРіРЅСѓС‚СЊ РґРѕРІРѕРґС‹ РѕР±РІРёРЅРµРЅРёСЏ Рё РґРѕР±РёС‚СЊСЃСЏ РѕРїСЂР°РІРґР°РЅРёСЏ РёР»Рё СЃРјСЏРіС‡РµРЅРёСЏ СЂРµС€РµРЅРёСЏ.",
  plaintiffLawyer:
    "РЈСЃРёР»РёС‚СЊ РїРѕР·РёС†РёСЋ РёСЃС‚С†Р°, РґРѕРєР°Р·Р°С‚СЊ РѕР±РѕСЃРЅРѕРІР°РЅРЅРѕСЃС‚СЊ С‚СЂРµР±РѕРІР°РЅРёР№ Рё СЃРєР»РѕРЅРёС‚СЊ СЃСѓРґ Рє СЂРµС€РµРЅРёСЋ РІ РµРіРѕ РїРѕР»СЊР·Сѓ.",
};

const MODE_TITLE_BY_PLAYERS: Record<CaseModePlayerCount, string> = {
  3: "Р“СЂР°Р¶РґР°РЅСЃРєРёР№ СЃРїРѕСЂ / РўСЂСѓРґРѕРІРѕР№ СЃРїРѕСЂ",
  4: "РЈРіРѕР»РѕРІРЅРѕРµ РґРµР»Рѕ",
  5: "РЈРіРѕР»РѕРІРЅРѕРµ РґРµР»Рѕ",
  6: "РЎСѓРґ РЅР° РєРѕРјРїР°РЅРёСЋ",
};

const DEFAULT_PACK_COLOR = "#ef4444";
const MAX_CASES_PER_MODE = 20;
const PACK_TITLE_LIMIT = 25;
const CASE_TITLE_LIMIT = 45;
const PACK_DESCRIPTION_LIMIT = 50;
const CASE_DESCRIPTION_LIMIT = 100;
const CASE_TRUTH_LIMIT = 100;
const CASE_EVIDENCE_LIMIT = 30;
const CASE_FACT_LIMIT = 40;

export interface UserCasePackCaseInput {
  modePlayerCount: CaseModePlayerCount;
  title: string;
  description: string;
  truth: string;
  expectedVerdict?: CaseVerdictKey;
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
  creatorNickname: string;
  sourcePackId: string | null;
}

export interface UserCasePackImportPreview {
  title: string;
  description: string;
  color: string;
  shareCode: string;
  caseCount: number;
  creatorNickname: string;
}

export interface UserCasePackCaseDetails {
  caseKey: string;
  modePlayerCount: CaseModePlayerCount;
  title: string;
  description: string;
  truth: string;
  expectedVerdict: CaseVerdictKey;
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
  expectedVerdict: string;
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
  const title = String(value ?? "").trim().slice(0, CASE_TITLE_LIMIT);
  return title || fallback;
}

function normalizePackTitle(value: unknown, fallback: string): string {
  const title = String(value ?? "").trim().slice(0, PACK_TITLE_LIMIT);
  return title || fallback;
}

function sanitizeLegacyCaseText(value: unknown, field: "description" | "truth"): string {
  const safe = String(value ?? "").trim();
  if (!safe) return "";
  const normalized = safe
    .toLowerCase()
    .replace(/С‘/g, "Рµ")
    .replace(/["'`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const compact = normalized
    .replace(/[.,!?;:()[\]{}В«В»]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (field === "description") {
    if (
      compact === "РѕРїРёСЃР°РЅРёРµ РЅРµРґРѕСЃС‚СѓРїРЅРѕ" ||
      compact === "РѕРїРёСЃРЅР°РёРµ РЅРµРґРѕСЃС‚СѓРїРЅРѕ" ||
      compact === "РѕРїРёСЃР°РЅРёРµ РЅРµ СѓРєР°Р·Р°РЅРѕ" ||
      compact.startsWith("РѕРїРёСЃР°РЅРёРµ РЅРµРґРѕСЃС‚СѓРїРЅРѕ ") ||
      compact.startsWith("РѕРїРёСЃРЅР°РёРµ РЅРµРґРѕСЃС‚СѓРїРЅРѕ ") ||
      compact.startsWith("РѕРїРёСЃР°РЅРёРµ РЅРµ СѓРєР°Р·Р°РЅРѕ ")
    ) {
      return "";
    }
    return safe;
  }
  if (
    compact === "РёСЃС‚РёРЅР° РЅРµРґРѕСЃС‚СѓРїРЅР°" ||
    compact === "РёСЃС‚РёРЅР° РЅРµ СѓРєР°Р·Р°РЅР°" ||
    compact.startsWith("РёСЃС‚РёРЅР° РЅРµРґРѕСЃС‚СѓРїРЅР° ") ||
    compact.startsWith("РёСЃС‚РёРЅР° РЅРµ СѓРєР°Р·Р°РЅР° ")
  ) {
    return "";
  }
  return safe;
}

function normalizePackDescription(value: unknown, fallback = ""): string {
  const description = String(value ?? "").trim().slice(0, PACK_DESCRIPTION_LIMIT);
  return description || fallback;
}

function normalizeCaseDescription(value: unknown, fallback = ""): string {
  const description = sanitizeLegacyCaseText(value, "description").slice(0, CASE_DESCRIPTION_LIMIT);
  return description || fallback;
}

function normalizeTruthOptional(value: unknown): string {
  return sanitizeLegacyCaseText(value, "truth").slice(0, CASE_TRUTH_LIMIT);
}

function normalizeTruth(value: unknown): string {
  return sanitizeLegacyCaseText(value, "truth").slice(0, CASE_TRUTH_LIMIT);
}

function normalizeExpectedVerdict(value: unknown, truth: string): CaseVerdictKey {
  if (value === "guilty" || value === "not_guilty" || value === "partial_guilty") {
    return value;
  }
  const normalizedTruth = String(truth ?? "").toLowerCase().replace(/С‘/g, "Рµ");
  if (normalizedTruth.includes("РЅРµ РІРёРЅРѕРІ")) return "not_guilty";
  if (normalizedTruth.includes("С‡Р°СЃС‚РёС‡РЅРѕ РІРёРЅРѕРІ")) return "partial_guilty";
  return "guilty";
}

function normalizeModePlayerCount(value: unknown): CaseModePlayerCount {
  const numeric = Number(value);
  if (numeric === 3 || numeric === 4 || numeric === 5 || numeric === 6) {
    return numeric;
  }
  throw new Error("Р РµР¶РёРј РґРµР»Р° РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ 3, 4, 5 РёР»Рё 6 РёРіСЂРѕРєРѕРІ.");
}

function normalizeEvidence(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? "").trim().slice(0, CASE_EVIDENCE_LIMIT))
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
          .map((item) => String(item ?? "").trim().slice(0, CASE_FACT_LIMIT))
          .filter((item) => item.length > 0)
      : [];
    next[roleKey] = rows;
  }

  const requiredRoles = (roleOrderByCount[modePlayerCount] ?? []).filter(
    (role) => role !== "judge",
  ) as CaseRoleKey[];

  for (const roleKey of requiredRoles) {
    if ((next[roleKey] ?? []).length < 4) {
      throw new Error(`Р”Р»СЏ СЂРѕР»Рё В«${ROLE_TITLES[roleKey]}В» РЅСѓР¶РЅРѕ РјРёРЅРёРјСѓРј 4 С„Р°РєС‚Р°.`);
    }
  }

  return next;
}

function normalizeFactsByRoleForEditor(
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
    next[roleKey] = Array.isArray(roleValue)
      ? roleValue
          .map((item) => String(item ?? "").trim().slice(0, CASE_FACT_LIMIT))
          .filter((item) => item.length > 0)
          .slice(0, 4)
      : [];
  }

  const requiredRoles = (roleOrderByCount[modePlayerCount] ?? []).filter(
    (role) => role !== "judge",
  ) as CaseRoleKey[];

  for (const roleKey of requiredRoles) {
    if ((next[roleKey] ?? []).length < 1) {
      throw new Error(`Р”Р»СЏ СЂРѕР»Рё В«${ROLE_TITLES[roleKey]}В» РЅСѓР¶РµРЅ РјРёРЅРёРјСѓРј 1 С„Р°РєС‚.`);
    }
  }

  return next;
}

function validateCasesPerModeLimit(
  cases: Array<{ modePlayerCount: CaseModePlayerCount }>,
): void {
  const counts: Record<CaseModePlayerCount, number> = { 3: 0, 4: 0, 5: 0, 6: 0 };
  for (const item of cases) counts[item.modePlayerCount] += 1;
  for (const mode of [3, 4, 5, 6] as const) {
    if (counts[mode] > MAX_CASES_PER_MODE) {
      throw new Error(`Р”Р»СЏ СЂРµР¶РёРјР° ${mode} РёРіСЂРѕРєРѕРІ РјРѕР¶РЅРѕ РґРѕР±Р°РІРёС‚СЊ РјР°РєСЃРёРјСѓРј ${MAX_CASES_PER_MODE} РґРµР».`);
    }
  }
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
      original_creator_user_id UUID NULL REFERENCES auth_users(id) ON DELETE SET NULL,
      original_creator_nickname TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER TABLE user_case_packs
    ADD COLUMN IF NOT EXISTS original_creator_user_id UUID NULL REFERENCES auth_users(id) ON DELETE SET NULL;
  `);

  await pool.query(`
    ALTER TABLE user_case_packs
    ADD COLUMN IF NOT EXISTS original_creator_nickname TEXT NOT NULL DEFAULT '';
  `);

  await pool.query(`
    WITH RECURSIVE lineage AS (
      SELECT id, source_pack_id, id AS root_id
      FROM user_case_packs
      WHERE source_pack_id IS NULL
      UNION ALL
      SELECT p.id, p.source_pack_id, l.root_id
      FROM user_case_packs p
      JOIN lineage l ON p.source_pack_id = l.id
    ),
    roots AS (
      SELECT l.id AS pack_id, r.user_id AS root_user_id
      FROM lineage l
      JOIN user_case_packs r ON r.id = l.root_id
    )
    UPDATE user_case_packs p
    SET original_creator_user_id = COALESCE(p.original_creator_user_id, roots.root_user_id, p.user_id)
    FROM roots
    WHERE roots.pack_id = p.id;
  `);

  await pool.query(`
    UPDATE user_case_packs p
    SET original_creator_user_id = COALESCE(p.original_creator_user_id, p.user_id)
    WHERE p.original_creator_user_id IS NULL;
  `);

  await pool.query(`
    UPDATE user_case_packs p
    SET original_creator_nickname = COALESCE(NULLIF(TRIM(p.original_creator_nickname), ''), u.nickname, 'РРіСЂРѕРє')
    FROM auth_users u
    WHERE u.id = p.original_creator_user_id
      AND NULLIF(TRIM(p.original_creator_nickname), '') IS NULL;
  `);

  await pool.query(`
    UPDATE user_case_packs
    SET original_creator_nickname = COALESCE(NULLIF(TRIM(original_creator_nickname), ''), 'РРіСЂРѕРє')
    WHERE NULLIF(TRIM(original_creator_nickname), '') IS NULL;
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
      expected_verdict TEXT NOT NULL DEFAULT 'partial_guilty' CHECK (expected_verdict IN ('guilty','not_guilty','partial_guilty')),
      evidence_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      facts_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      sort_order INTEGER NOT NULL DEFAULT 100,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (pack_id, case_key)
    );
  `);

  await pool.query(`
    ALTER TABLE user_case_pack_cases
    ADD COLUMN IF NOT EXISTS expected_verdict TEXT NOT NULL DEFAULT 'partial_guilty';
  `);

  await pool.query(`
    UPDATE user_case_pack_cases
    SET expected_verdict = CASE
      WHEN LOWER(COALESCE(truth, '')) LIKE '%РЅРµ РІРёРЅРѕРІ%' THEN 'not_guilty'
      WHEN LOWER(COALESCE(truth, '')) LIKE '%С‡Р°СЃС‚РёС‡РЅРѕ РІРёРЅРѕРІ%' THEN 'partial_guilty'
      ELSE 'guilty'
    END
    WHERE expected_verdict IS NULL OR expected_verdict NOT IN ('guilty','not_guilty','partial_guilty');
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
  original_creator_nickname?: string | null;
  source_pack_id?: string | null;
}): UserCasePackInfo {
  const createdAt =
    row.created_at instanceof Date
      ? row.created_at.getTime()
      : Date.parse(String(row.created_at ?? "")) || Date.now();
  return {
    id: row.id,
    key: row.key,
    title: normalizePackTitle(row.title, "РџРѕР»СЊР·РѕРІР°С‚РµР»СЊСЃРєРёР№ РїР°Рє"),
    description: normalizePackDescription(row.description, "РџРѕР»СЊР·РѕРІР°С‚РµР»СЊСЃРєРёР№ РїР°Рє РґРµР»."),
    color: normalizeColor(row.color),
    shareCode: row.share_code,
    caseCount: Math.max(0, Number(row.case_count ?? 0) || 0),
    sortOrder: 1000,
    isCustom: true,
    isAdult: false,
    createdAt,
    creatorNickname: String(row.original_creator_nickname ?? "").trim() || "РРіСЂРѕРє",
    sourcePackId: row.source_pack_id ? String(row.source_pack_id) : null,
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
    original_creator_nickname: string | null;
    source_pack_id: string | null;
  }>(
    `
      SELECT
        p.id,
        p.key,
        p.title,
        p.description,
        p.color,
        p.share_code,
        p.source_pack_id,
        p.original_creator_nickname,
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
    throw new Error("РџР°Рє РЅРµ РЅР°Р№РґРµРЅ.");
  }
  return mapRowToPackInfo(result.rows[0]);
}

export async function getUserCasePackImportPreviewByShareCode(
  shareCodeInput: string,
): Promise<UserCasePackImportPreview> {
  await ensureUserCasePacksStorage();
  const shareCode = String(shareCodeInput ?? "").trim().toUpperCase();
  if (!shareCode) {
    throw new Error("Р’РІРµРґРёС‚Рµ РєР»СЋС‡ РїР°РєР°.");
  }
  const result = await pool.query<{
    title: string;
    description: string;
    color: string;
    share_code: string;
    case_count: number;
    original_creator_nickname: string | null;
  }>(
    `
      SELECT
        p.title,
        p.description,
        p.color,
        p.share_code,
        p.original_creator_nickname,
        COUNT(c.id)::int AS case_count
      FROM user_case_packs p
      LEFT JOIN user_case_pack_cases c ON c.pack_id = p.id
      WHERE p.share_code = $1
      GROUP BY p.id
      LIMIT 1
    `,
    [shareCode],
  );
  if (!result.rowCount) {
    throw new Error("РџР°Рє СЃ С‚Р°РєРёРј РєР»СЋС‡РѕРј РЅРµ РЅР°Р№РґРµРЅ.");
  }
  const row = result.rows[0];
  return {
    title: normalizePackTitle(row.title, "РџРѕР»СЊР·РѕРІР°С‚РµР»СЊСЃРєРёР№ РїР°Рє"),
    description: normalizePackDescription(row.description, "РџРѕР»СЊР·РѕРІР°С‚РµР»СЊСЃРєРёР№ РїР°Рє РґРµР»."),
    color: normalizeColor(row.color),
    shareCode: String(row.share_code ?? "").trim().toUpperCase(),
    caseCount: Math.max(0, Number(row.case_count ?? 0) || 0),
    creatorNickname: String(row.original_creator_nickname ?? "").trim() || "РРіСЂРѕРє",
  };
}

export async function isUserCasePackAlreadyAddedByShareCode(
  userId: string,
  shareCodeInput: string,
): Promise<boolean> {
  await ensureUserCasePacksStorage();
  const safeUserId = String(userId ?? "").trim();
  if (!safeUserId) return false;
  const shareCode = String(shareCodeInput ?? "").trim().toUpperCase();
  if (!shareCode) return false;

  const result = await pool.query<{ already_added: boolean }>(
    `
      WITH source AS (
        SELECT id
        FROM user_case_packs
        WHERE share_code = $1
        LIMIT 1
      )
      SELECT EXISTS(
        SELECT 1
        FROM source s
        JOIN user_case_packs p
          ON p.user_id = $2
         AND (p.id = s.id OR p.source_pack_id = s.id)
      ) AS already_added
    `,
    [shareCode, safeUserId],
  );

  return !!result.rows[0]?.already_added;
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
    original_creator_nickname: string | null;
    source_pack_id: string | null;
  }>(
    `
      SELECT
        p.id,
        p.key,
        p.title,
        p.description,
        p.color,
        p.share_code,
        p.source_pack_id,
        p.original_creator_nickname,
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
  expectedVerdict: CaseVerdictKey;
  evidence: string[];
  factsByRole: Record<CaseRoleKey, string[]>;
  sortOrder: number;
} {
  const source =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const modePlayerCount = normalizeModePlayerCount(source.modePlayerCount);
  const title = normalizeTitle(source.title, `Р”РµР»Рѕ ${index + 1}`);
  const description = normalizeCaseDescription(source.description);
  const truth = normalizeTruthOptional(source.truth);
  const expectedVerdict = normalizeExpectedVerdict(source.expectedVerdict, truth);
  const evidence = normalizeEvidence(source.evidence);
  const factsByRole = normalizeFactsByRoleForEditor(modePlayerCount, source.factsByRole);
  const caseKey = `case_${modePlayerCount}_${index + 1}_${crypto.randomUUID().slice(0, 8)}`;

  return {
    caseKey,
    modePlayerCount,
    title,
    description,
    truth,
    expectedVerdict,
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
    throw new Error("РќРµ СѓРґР°Р»РѕСЃСЊ РѕРїСЂРµРґРµР»РёС‚СЊ РІР»Р°РґРµР»СЊС†Р° РїР°РєР°.");
  }

  const title = normalizePackTitle(input?.title, "");
  if (!title) {
    throw new Error("Р’РІРµРґРёС‚Рµ РЅР°Р·РІР°РЅРёРµ РїР°РєР°.");
  }
  const description = normalizePackDescription(input?.description, "РџРѕР»СЊР·РѕРІР°С‚РµР»СЊСЃРєРёР№ РїР°Рє РґРµР».");
  const color = normalizeColor(input?.color);
  const rawCases = Array.isArray(input?.cases) ? input.cases : [];
  if (rawCases.length === 0) {
    throw new Error("Р”РѕР±Р°РІСЊС‚Рµ С…РѕС‚СЏ Р±С‹ РѕРґРЅРѕ РґРµР»Рѕ РІ РїР°Рє.");
  }

  const normalizedCases = rawCases.map((row, index) => normalizeCaseInput(row, index));
  validateCasesPerModeLimit(normalizedCases);

  await pool.query("BEGIN");
  try {
    const ownerResult = await pool.query<{ nickname: string }>(
      `
        SELECT nickname
        FROM auth_users
        WHERE id = $1
        LIMIT 1
      `,
      [safeUserId],
    );
    const ownerNickname = String(ownerResult.rows[0]?.nickname ?? "").trim() || "РРіСЂРѕРє";
    const packId = crypto.randomUUID();
    const packKey = generatePackKey();
    const shareCode = generateShareCode();

    await pool.query(
      `
        INSERT INTO user_case_packs (
          id, user_id, key, title, description, color, share_code, original_creator_user_id, original_creator_nickname, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      `,
      [packId, safeUserId, packKey, title, description, color, shareCode, safeUserId, ownerNickname],
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
            expected_verdict,
            evidence_json,
            facts_json,
            sort_order,
            created_at,
            updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11, NOW(), NOW())
        `,
        [
          crypto.randomUUID(),
          packId,
          caseRow.caseKey,
          caseRow.modePlayerCount,
          caseRow.title,
          caseRow.description,
          caseRow.truth,
          caseRow.expectedVerdict,
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
      original_creator_nickname: string | null;
      source_pack_id: string | null;
    }>(
      `
        SELECT
          p.id,
          p.key,
          p.title,
          p.description,
          p.color,
          p.share_code,
          p.source_pack_id,
          p.original_creator_nickname,
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
      throw new Error("РџР°Рє СЃРѕР·РґР°РЅ, РЅРѕ РЅРµ СѓРґР°Р»РѕСЃСЊ РїРѕР»СѓС‡РёС‚СЊ РµРіРѕ РґР°РЅРЅС‹Рµ.");
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
    throw new Error("РќРµ СѓРґР°Р»РѕСЃСЊ РѕРїСЂРµРґРµР»РёС‚СЊ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ.");
  }
  const shareCode = String(shareCodeInput ?? "").trim().toUpperCase();
  if (!shareCode) {
    throw new Error("Р’РІРµРґРёС‚Рµ РєР»СЋС‡ РїР°РєР°.");
  }

  await pool.query("BEGIN");
  try {
    const sourcePackResult = await pool.query<{
      id: string;
      user_id: string;
      title: string;
      description: string;
      color: string;
      original_creator_user_id: string | null;
      original_creator_nickname: string | null;
    }>(
      `
        SELECT id, user_id, title, description, color, original_creator_user_id, original_creator_nickname
        FROM user_case_packs
        WHERE share_code = $1
        LIMIT 1
      `,
      [shareCode],
    );
    if (!sourcePackResult.rowCount) {
      throw new Error("РџР°Рє СЃ С‚Р°РєРёРј РєР»СЋС‡РѕРј РЅРµ РЅР°Р№РґРµРЅ.");
    }
    const sourcePack = sourcePackResult.rows[0];
    const originCreatorUserId = String(
      sourcePack.original_creator_user_id ?? sourcePack.user_id ?? "",
    ).trim();
    const originCreatorNickname = String(sourcePack.original_creator_nickname ?? "").trim() || "РРіСЂРѕРє";
    if (sourcePack.user_id === safeUserId) {
      throw new Error("Р­С‚РѕС‚ РїР°Рє СѓР¶Рµ РїСЂРёРЅР°РґР»РµР¶РёС‚ РІР°Рј.");
    }

    const alreadyImportedResult = await pool.query<{ id: string }>(
      `
        SELECT id
        FROM user_case_packs
        WHERE user_id = $1
          AND (id = $2 OR source_pack_id = $2)
        LIMIT 1
      `,
      [safeUserId, sourcePack.id],
    );
    if (alreadyImportedResult.rowCount) {
      throw new Error("РџР°Рє СѓР¶Рµ РµСЃС‚СЊ РІ РІР°С€РёС… РїР°РєР°С….");
    }

    const sourceCases = await pool.query<{
      case_key: string;
      mode_player_count: number;
      title: string;
      description: string;
      truth: string;
      expected_verdict: string;
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
          expected_verdict,
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
          id, user_id, key, title, description, color, share_code, source_pack_id, original_creator_user_id, original_creator_nickname, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      `,
      [
        newPackId,
        safeUserId,
        newPackKey,
        normalizePackTitle(sourcePack.title, "РџРѕР»СЊР·РѕРІР°С‚РµР»СЊСЃРєРёР№ РїР°Рє"),
        normalizePackDescription(sourcePack.description, "РџРѕР»СЊР·РѕРІР°С‚РµР»СЊСЃРєРёР№ РїР°Рє РґРµР»."),
        normalizeColor(sourcePack.color),
        newShareCode,
        sourcePack.id,
        originCreatorUserId || null,
        originCreatorNickname,
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
            expected_verdict,
            evidence_json,
            facts_json,
            sort_order,
            created_at,
            updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11, NOW(), NOW())
        `,
        [
          crypto.randomUUID(),
          newPackId,
          `${sourceCase.case_key}_${crypto.randomUUID().slice(0, 6)}`.slice(0, 120),
          normalizeModePlayerCount(sourceCase.mode_player_count),
          normalizeTitle(sourceCase.title, "Р”РµР»Рѕ"),
          normalizeCaseDescription(sourceCase.description),
          normalizeTruth(sourceCase.truth),
          normalizeExpectedVerdict(sourceCase.expected_verdict, sourceCase.truth),
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
      original_creator_nickname: string | null;
      source_pack_id: string | null;
    }>(
      `
        SELECT
          p.id,
          p.key,
          p.title,
          p.description,
          p.color,
          p.share_code,
          p.source_pack_id,
          p.original_creator_nickname,
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
      throw new Error("РџР°Рє РёРјРїРѕСЂС‚РёСЂРѕРІР°РЅ, РЅРѕ РЅРµ СѓРґР°Р»РѕСЃСЊ РїРѕР»СѓС‡РёС‚СЊ РµРіРѕ РґР°РЅРЅС‹Рµ.");
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
    throw new Error("РќРµ СѓРґР°Р»РѕСЃСЊ РѕРїСЂРµРґРµР»РёС‚СЊ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ.");
  }
  const packKey = String(packKeyInput ?? "").trim().toLowerCase();
  if (!packKey) {
    throw new Error("РљР»СЋС‡ РїР°РєР° РЅРµ СѓРєР°Р·Р°РЅ.");
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
    throw new Error("РџР°Рє РЅРµ РЅР°Р№РґРµРЅ.");
  }

  const packId = packResult.rows[0].id;
  const pack = await fetchPackInfoById(packId);

  const casesResult = await pool.query<{
    case_key: string;
    mode_player_count: number;
    title: string;
    description: string;
    truth: string;
    expected_verdict: string;
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
        expected_verdict,
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
    title: normalizeTitle(row.title, "Р”РµР»Рѕ"),
    description: String(row.description ?? "").trim().slice(0, CASE_DESCRIPTION_LIMIT),
    truth: normalizeTruthOptional(row.truth),
    expectedVerdict: normalizeExpectedVerdict(row.expected_verdict, row.truth),
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
    throw new Error("РќРµ СѓРґР°Р»РѕСЃСЊ РѕРїСЂРµРґРµР»РёС‚СЊ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ.");
  }
  const packKey = String(packKeyInput ?? "").trim().toLowerCase();
  if (!packKey) {
    throw new Error("РљР»СЋС‡ РїР°РєР° РЅРµ СѓРєР°Р·Р°РЅ.");
  }

  const title = normalizePackTitle(input?.title, "");
  if (!title) {
    throw new Error("Р’РІРµРґРёС‚Рµ РЅР°Р·РІР°РЅРёРµ РїР°РєР°.");
  }
  const description = normalizePackDescription(input?.description, "РџРѕР»СЊР·РѕРІР°С‚РµР»СЊСЃРєРёР№ РїР°Рє РґРµР».");
  const color = normalizeColor(input?.color);
  const rawCases = Array.isArray(input?.cases) ? input.cases : [];
  if (rawCases.length === 0) {
    throw new Error("Р”РѕР±Р°РІСЊС‚Рµ С…РѕС‚СЏ Р±С‹ РѕРґРЅРѕ РґРµР»Рѕ РІ РїР°Рє.");
  }
  const normalizedCases = rawCases.map((row, index) => normalizeCaseInput(row, index));
  validateCasesPerModeLimit(normalizedCases);

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
      throw new Error("РџР°Рє РЅРµ РЅР°Р№РґРµРЅ.");
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
            expected_verdict,
            evidence_json,
            facts_json,
            sort_order,
            created_at,
            updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11, NOW(), NOW())
        `,
        [
          crypto.randomUUID(),
          packId,
          caseRow.caseKey,
          caseRow.modePlayerCount,
          caseRow.title,
          caseRow.description,
          caseRow.truth,
          caseRow.expectedVerdict,
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

export async function deleteUserCasePack(userId: string, packKeyInput: string): Promise<void> {
  await ensureUserCasePacksStorage();
  const safeUserId = String(userId ?? "").trim();
  if (!safeUserId) {
    throw new Error("РќРµ СѓРґР°Р»РѕСЃСЊ РѕРїСЂРµРґРµР»РёС‚СЊ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ.");
  }
  const packKey = String(packKeyInput ?? "").trim().toLowerCase();
  if (!packKey) {
    throw new Error("РљР»СЋС‡ РїР°РєР° РЅРµ СѓРєР°Р·Р°РЅ.");
  }
  const result = await pool.query<{ id: string }>(
    `
      DELETE FROM user_case_packs
      WHERE user_id = $1
        AND key = $2
      RETURNING id
    `,
    [safeUserId, packKey],
  );
  if (!result.rowCount) {
    throw new Error("РџР°Рє РЅРµ РЅР°Р№РґРµРЅ.");
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
    expected_verdict: string;
    evidence_json: unknown;
    facts_json: unknown;
  }>(
    `
      SELECT
        c.case_key,
        c.title,
        c.description,
        c.truth,
        c.expected_verdict,
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
  const expectedVerdict = normalizeExpectedVerdict(row.expected_verdict, row.truth);
  const expectedVerdictLabel =
    expectedVerdict === "not_guilty"
      ? "РќРµ РІРёРЅРѕРІРµРЅ"
      : expectedVerdict === "partial_guilty"
        ? "Р§Р°СЃС‚РёС‡РЅРѕ РІРёРЅРѕРІРµРЅ"
        : "Р’РёРЅРѕРІРµРЅ";

  return {
    id: row.case_key,
    mode: MODE_TITLE_BY_PLAYERS[modeCount],
    title: normalizeTitle(row.title, "Р”РµР»Рѕ"),
    description: String(row.description ?? "").trim().slice(0, CASE_DESCRIPTION_LIMIT),
    truth: normalizeTruthOptional(row.truth),
    expectedVerdict: expectedVerdictLabel,
    evidence: normalizeEvidence(row.evidence_json),
    roles: buildRolesFromFacts(factsByRole),
  };
}


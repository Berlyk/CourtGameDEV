import crypto from "node:crypto";
import { pool } from "@workspace/db";
import { TEMP_CASE_PACKS } from "./casePacks.temp.js";

/*
  ======================= КУДА ДОБАВЛЯТЬ НОВЫЕ ПАКИ И ДЕЛА =======================
  Редактируй ТОЛЬКО файл: src/lib/casePacks.temp.ts

  1) Добавь новый пак в массив TEMP_CASE_PACKS
  2) Добавь дела в casesByPlayers -> 3/4/5/6
  3) Перезапусти сервер (или деплой) — БД обновится автоматически
*/

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

let ensurePromise: Promise<void> | null = null;

async function ensureTablesInternal(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS case_packs (
      id UUID PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
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
      pack_id UUID NOT NULL REFERENCES case_packs(id) ON DELETE CASCADE,
      mode_player_count INTEGER NOT NULL CHECK (mode_player_count BETWEEN 3 AND 6),
      case_key TEXT NOT NULL,
      mode_label TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      truth TEXT NOT NULL,
      evidence TEXT[] NOT NULL DEFAULT '{}',
      roles JSONB NOT NULL,
      tags TEXT[] NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (pack_id, mode_player_count, case_key)
    );
  `);
}

export function normalizeCasePackKey(input?: string | null): string {
  const raw = (input ?? "").trim().toLowerCase();
  if (!raw) return "classic";
  const safe = raw.replace(/[^a-z0-9_-]/g, "");
  return safe || "classic";
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

  for (const pack of TEMP_CASE_PACKS) {
    const packKey = normalizeCasePackKey(pack.key);
    const insertPack = await pool.query<{ id: string }>(
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
        RETURNING id
      `,
      [
        crypto.randomUUID(),
        packKey,
        pack.title || packKey,
        pack.description || "",
        !!pack.isAdult,
        Number.isFinite(pack.sortOrder) ? pack.sortOrder : 100,
      ],
    );

    const packId = insertPack.rows[0]?.id;
    if (!packId) continue;

    for (const [countKey, list] of Object.entries(pack.casesByPlayers ?? {})) {
      const modePlayerCount = Number(countKey);
      if (!Number.isFinite(modePlayerCount) || modePlayerCount < 3 || modePlayerCount > 6) {
        continue;
      }

      for (let index = 0; index < (list as Array<any>).length; index += 1) {
        const rawCase = (list as Array<any>)[index];
        const caseKeyRaw =
          typeof rawCase?.key === "string"
            ? rawCase.key
            : typeof rawCase?.id === "string"
              ? rawCase.id
              : `${packKey}_${modePlayerCount}_${index + 1}`;
        const caseKey = caseKeyRaw.trim() || `${packKey}_${modePlayerCount}_${index + 1}`;

        const safeTitle =
          typeof rawCase?.title === "string" && rawCase.title.trim()
            ? rawCase.title.trim()
            : `Дело ${caseKey}`;
        const safeDescription =
          typeof rawCase?.description === "string" ? rawCase.description : "";
        const safeTruth = typeof rawCase?.truth === "string" ? rawCase.truth : "";
        const safeEvidence = Array.isArray(rawCase?.evidence)
          ? rawCase.evidence.filter((item: unknown): item is string => typeof item === "string")
          : [];
        const safeRoles =
          rawCase?.roles && typeof rawCase.roles === "object" ? rawCase.roles : {};
        const safeModeLabel =
          typeof rawCase?.mode === "string" ? rawCase.mode : `Режим на ${modePlayerCount}`;

        await pool.query(
          `
            INSERT INTO case_pack_cases (
              id,
              pack_id,
              mode_player_count,
              case_key,
              mode_label,
              title,
              description,
              truth,
              evidence,
              roles,
              updated_at
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,NOW())
            ON CONFLICT (pack_id, mode_player_count, case_key)
            DO UPDATE SET
              mode_label = EXCLUDED.mode_label,
              title = EXCLUDED.title,
              description = EXCLUDED.description,
              truth = EXCLUDED.truth,
              evidence = EXCLUDED.evidence,
              roles = EXCLUDED.roles,
              updated_at = NOW()
          `,
          [
            crypto.randomUUID(),
            packId,
            modePlayerCount,
            caseKey,
            safeModeLabel,
            safeTitle,
            safeDescription,
            safeTruth,
            safeEvidence,
            JSON.stringify(safeRoles),
          ],
        );
      }
    }
  }
}

export async function listCasePacks(): Promise<CasePackInfo[]> {
  await ensureCasePacksStorage();
  const result = await pool.query<{
    key: string;
    title: string;
    description: string;
    is_adult: boolean;
    sort_order: number;
    case_count: string;
  }>(
    `
      SELECT
        p.key,
        p.title,
        p.description,
        p.is_adult,
        p.sort_order,
        COUNT(c.id)::text AS case_count
      FROM case_packs p
      LEFT JOIN case_pack_cases c ON c.pack_id = p.id
      WHERE p.active = TRUE
      GROUP BY p.id
      ORDER BY p.sort_order ASC, p.created_at ASC
    `,
  );

  return result.rows.map((row) => ({
    key: row.key,
    title: row.title,
    description: row.description,
    isAdult: !!row.is_adult,
    sortOrder: row.sort_order,
    caseCount: Number(row.case_count) || 0,
  }));
}

async function pickCaseFromPackKey(
  packKey: string,
  modePlayerCount: number,
): Promise<StoredCaseData | null> {
  const result = await pool.query<{
    case_key: string;
    mode_label: string;
    title: string;
    description: string;
    truth: string;
    evidence: string[] | null;
    roles: Record<string, { title: string; goal: string; facts: string[] }>;
  }>(
    `
      SELECT
        c.case_key,
        c.mode_label,
        c.title,
        c.description,
        c.truth,
        c.evidence,
        c.roles
      FROM case_pack_cases c
      INNER JOIN case_packs p ON p.id = c.pack_id
      WHERE p.active = TRUE
        AND p.key = $1
        AND c.mode_player_count = $2
      ORDER BY RANDOM()
      LIMIT 1
    `,
    [packKey, modePlayerCount],
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    id: row.case_key,
    mode: row.mode_label || `Режим на ${modePlayerCount}`,
    title: row.title,
    description: row.description,
    truth: row.truth,
    evidence: Array.isArray(row.evidence) ? row.evidence : [],
    roles: row.roles ?? {},
  };
}

export async function pickCaseForRoom(
  packKeyInput: string | undefined,
  modePlayerCount: number,
): Promise<StoredCaseData | null> {
  await ensureCasePacksStorage();
  const packKey = normalizeCasePackKey(packKeyInput);
  const selected = await pickCaseFromPackKey(packKey, modePlayerCount);
  if (selected) return selected;

  if (packKey !== "classic") {
    const fallback = await pickCaseFromPackKey("classic", modePlayerCount);
    if (fallback) return fallback;
  }

  return pickCaseFromPackKey("classic", 3);
}

import crypto from "node:crypto";
import { pool } from "@workspace/db";
import { mechanicPool as legacyMechanicPool } from "./mechanics.backend.js";

/*
  =================== КУДА ДОБАВЛЯТЬ НОВЫЕ КАРТЫ МЕХАНИК ===================
  Карты теперь в БД, а не в gameData.ts.

  Вариант 1 (простой): добавляйте записи в таблицу `mechanic_cards`.
  Поля: key, title, description, sort_order, active.

  Вариант 2 (авто-миграция): положите карты в gameData.ts,
  и они автоматически засидятся в БД при запуске сервера.

  Пример SQL (вручную добавить 1 карту):
    INSERT INTO mechanic_cards (id, key, title, description, sort_order, active)
    VALUES (
      gen_random_uuid(),
      'my_card_1',
      'Моя карта',
      'Описание карты',
      200,
      TRUE
    );
*/

export interface MechanicCardData {
  id: string;
  name: string;
  description: string;
}

let ensurePromise: Promise<void> | null = null;

async function ensureTablesInternal(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS mechanic_cards (
      id UUID PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 100,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

export async function ensureMechanicCardsStorage(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = ensureTablesInternal().catch((error) => {
      ensurePromise = null;
      throw error;
    });
  }
  return ensurePromise;
}

function normalizeMechanicKey(input: string, fallbackIndex: number): string {
  const raw = (input || "").trim().toLowerCase();
  const safe = raw.replace(/[^a-z0-9_-]/g, "");
  return safe || `legacy_mechanic_${fallbackIndex}`;
}

export async function ensureDefaultMechanicCardsSeeded(): Promise<void> {
  await ensureMechanicCardsStorage();

  for (let index = 0; index < legacyMechanicPool.length; index += 1) {
    const card = legacyMechanicPool[index] as any;
    const title =
      typeof card?.name === "string" && card.name.trim()
        ? card.name.trim()
        : `Карта ${index + 1}`;
    const description =
      typeof card?.description === "string" && card.description.trim()
        ? card.description.trim()
        : "Описание не задано.";
    const key = normalizeMechanicKey(
      typeof card?.id === "string" ? card.id : title,
      index + 1,
    );

    await pool.query(
      `
        INSERT INTO mechanic_cards (
          id,
          key,
          title,
          description,
          sort_order,
          active,
          updated_at
        )
        VALUES ($1,$2,$3,$4,$5,TRUE,NOW())
        ON CONFLICT (key)
        DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          sort_order = EXCLUDED.sort_order,
          active = TRUE,
          updated_at = NOW()
      `,
      [crypto.randomUUID(), key, title, description, index + 1],
    );
  }
}

export async function pickMechanicCardsForRoom(
  cardCount: number,
): Promise<Array<{ name: string; description: string }>> {
  await ensureMechanicCardsStorage();
  const safeCount = Math.max(1, Math.min(10, Math.floor(cardCount || 1)));

  const result = await pool.query<{ title: string; description: string }>(
    `
      SELECT title, description
      FROM mechanic_cards
      WHERE active = TRUE
      ORDER BY RANDOM()
      LIMIT $1
    `,
    [safeCount],
  );

  if (result.rows.length > 0) {
    return result.rows.map((row) => ({
      name: row.title,
      description: row.description,
    }));
  }

  return legacyMechanicPool.slice(0, safeCount).map((item: any) => ({
    name: typeof item?.name === "string" ? item.name : "Карта",
    description:
      typeof item?.description === "string" ? item.description : "Описание не задано.",
  }));
}

import { pool } from "@workspace/db";

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

// Карты механик теперь полностью живут в БД. Ничего не сидим с backend-файлов.
export async function ensureDefaultMechanicCardsSeeded(): Promise<void> {
  await ensureMechanicCardsStorage();
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

  return result.rows.map((row) => ({
    name: row.title,
    description: row.description,
  }));
}

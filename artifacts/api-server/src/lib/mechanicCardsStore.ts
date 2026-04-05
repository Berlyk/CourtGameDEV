import { pool } from "@workspace/db";

export interface MechanicCardData {
  id: string;
  name: string;
  description: string;
}

let ensurePromise: Promise<void> | null = null;
let hasActiveColumnPromise: Promise<boolean> | null = null;

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

async function hasActiveColumn(): Promise<boolean> {
  if (!hasActiveColumnPromise) {
    hasActiveColumnPromise = columnExists("mechanic_cards", "active").catch((error) => {
      hasActiveColumnPromise = null;
      throw error;
    });
  }
  return hasActiveColumnPromise;
}

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

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = ANY(current_schemas(true)) AND table_name = 'mechanic_cards' AND column_name = 'active'
      ) THEN
        EXECUTE 'ALTER TABLE mechanic_cards ADD COLUMN active BOOLEAN NOT NULL DEFAULT TRUE';
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = ANY(current_schemas(true)) AND table_name = 'mechanic_cards' AND column_name = 'is_active'
        ) THEN
          EXECUTE 'UPDATE mechanic_cards SET active = COALESCE(is_active, TRUE)';
        END IF;
      END IF;
    END $$;
  `);

  hasActiveColumnPromise = null;
  await hasActiveColumn();
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

// Карты механик полностью хранятся в БД.
export async function ensureDefaultMechanicCardsSeeded(): Promise<void> {
  await ensureMechanicCardsStorage();
}

export async function pickMechanicCardsForRoom(
  cardCount: number,
  attempt = 0,
): Promise<Array<{ name: string; description: string }>> {
  await ensureMechanicCardsStorage();
  const safeCount = Math.max(1, Math.min(10, Math.floor(cardCount || 1)));

  try {
    const result = await pool.query<{ title: string; description: string }>(
      `
        SELECT title, description
        FROM mechanic_cards
        WHERE TRUE
        ORDER BY RANDOM()
        LIMIT $1
      `,
      [safeCount],
    );

    return result.rows.map((row) => ({
      name: row.title,
      description: row.description,
    }));
  } catch (error) {
    if (attempt === 0 && isUndefinedColumnError(error)) {
      hasActiveColumnPromise = null;
      return pickMechanicCardsForRoom(cardCount, 1);
    }
    throw error;
  }

  return [];
}

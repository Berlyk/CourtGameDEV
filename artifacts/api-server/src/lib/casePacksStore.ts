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

export function normalizeCasePackKey(input?: string | null): string {
  const raw = (input ?? "").trim().toLowerCase();
  if (!raw) return "classic";
  const safe = raw.replace(/[^a-z0-9_-]/g, "");
  return safe || "classic";
}

// Временный режим без БД: оставлено для совместимости вызовов в socket/index.ts
export async function ensureCasePacksStorage(): Promise<void> {
  return;
}

// Временный режим без БД: источник данных — src/lib/casePacks.backend.ts
export async function ensureDefaultCasePackSeeded(): Promise<void> {
  return;
}

function countPackCases(pack: (typeof BACKEND_CASE_PACKS)[number]): number {
  return (pack.casesByPlayers[3]?.length ?? 0)
    + (pack.casesByPlayers[4]?.length ?? 0)
    + (pack.casesByPlayers[5]?.length ?? 0)
    + (pack.casesByPlayers[6]?.length ?? 0);
}

export async function listCasePacks(): Promise<CasePackInfo[]> {
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

function pickRandom<T>(items: T[]): T | null {
  if (!items.length) return null;
  const index = Math.floor(Math.random() * items.length);
  return items[index] ?? null;
}

function buildRolesFromFacts(
  facts: Partial<Record<RoleKey, string[]>>,
): Record<string, { title: string; goal: string; facts: string[] }> {
  const result: Record<string, { title: string; goal: string; facts: string[] }> = {};
  const roleKeys = Object.keys(ROLE_TITLES) as RoleKey[];

  for (const roleKey of roleKeys) {
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

function pickCaseFromPack(packKey: string, modePlayerCount: number): StoredCaseData | null {
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
  const selected = pickCaseFromPack(packKey, modePlayerCount);
  if (selected) return selected;

  if (packKey !== "classic") {
    const fallback = pickCaseFromPack("classic", modePlayerCount);
    if (fallback) return fallback;
  }

  return pickCaseFromPack("classic", 3);
}

import { cases as legacyCases } from "../socket/gameData.js";

export type TempCaseRole = {
  title: string;
  goal: string;
  facts: string[];
};

export type TempCase = {
  key: string;
  title: string;
  description: string;
  truth: string;
  evidence: string[];
  roles: Record<string, TempCaseRole>;
};

export type TempCasePack = {
  key: string;
  title: string;
  description: string;
  isAdult: boolean;
  sortOrder: number;
  casesByPlayers: Record<3 | 4 | 5 | 6, TempCase[]>;
};

/*
  ==================================================================================
  ВРЕМЕННЫЙ ФАЙЛ ДЛЯ ТЕБЯ: ДОБАВЛЕНИЕ ПАКОВ И ДЕЛ БЕЗ БД
  ==================================================================================

  КУДА ДОБАВЛЯТЬ:
  1) Добавить новый пак в массив TEMP_CASE_PACKS.
  2) Внутри пака добавить дела в casesByPlayers -> 3/4/5/6.

  ВАЖНО:
  - key у пака должен быть уникальным (пример: "rome", "medieval", "adult18").
  - key у дела должен быть уникальным внутри пака.
  - 3/4/5/6 = количество игроков.

  ПРОСТОЙ ПРИМЕР:
  - Скопируй PACK_TEMPLATE и переименуй key/title.
  - Добавь свои дела по образцу.
*/

const classicCasesByPlayers: Record<3 | 4 | 5 | 6, TempCase[]> = {
  3: (legacyCases[3] ?? []) as TempCase[],
  4: (legacyCases[4] ?? []) as TempCase[],
  5: (legacyCases[5] ?? []) as TempCase[],
  6: (legacyCases[6] ?? []) as TempCase[],
};

const PACK_TEMPLATE: TempCasePack = {
  key: "my_pack_template",
  title: "МОЙ ПАК (шаблон)",
  description: "Переименуй этот пак и добавь свои дела.",
  isAdult: false,
  sortOrder: 200,
  casesByPlayers: {
    3: [
      {
        key: "my_case_3_1",
        title: "Шаблон дела на 3 игроков",
        description: "Короткое описание конфликта.",
        truth: "Кто реально прав/виновен.",
        evidence: ["Улика 1", "Улика 2"],
        roles: {
          plaintiff: {
            title: "Истец",
            goal: "Добиться решения в свою пользу.",
            facts: ["Факт истца 1", "Факт истца 2"],
          },
          defendant: {
            title: "Ответчик",
            goal: "Оспорить обвинение.",
            facts: ["Факт ответчика 1", "Факт ответчика 2"],
          },
          judge: {
            title: "Судья",
            goal: "Вынести верный вердикт.",
            facts: [],
          },
        },
      },
    ],
    4: [],
    5: [],
    6: [],
  },
};

export const TEMP_CASE_PACKS: TempCasePack[] = [
  {
    key: "classic",
    title: "КЛАССИКА",
    description: "Базовый набор дел CourtGame.",
    isAdult: false,
    sortOrder: 10,
    casesByPlayers: classicCasesByPlayers,
  },
  PACK_TEMPLATE,
];

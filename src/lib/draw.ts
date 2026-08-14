import type { AppState, Difficulty, DrawRecord, ImportIssue, ImportQuestionsResult, PoolState, Question, ThemeMode } from "./types";

export const COOLDOWN_DAYS = 5;
export const QUESTION_LIBRARY_FORMAT = "leetcode-draw/question-library";
export const QUESTION_LIBRARY_VERSION = 1;

export const EMPTY_STATE: AppState = {
  history: [],
  customQuestions: [],
  theme: "light"
};

export function todayStr(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function daysBetween(dateStr: string, refStr: string) {
  const start = new Date(`${dateStr}T00:00:00`);
  const end = new Date(`${refStr}T00:00:00`);
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

export function diffClass(diff: Difficulty) {
  if (diff === "简单") return "easy";
  if (diff === "困难") return "hard";
  return "mid";
}

export function normalizeState(value: unknown): AppState {
  if (!value || typeof value !== "object") return EMPTY_STATE;
  const candidate = value as Partial<AppState>;
  return {
    history: Array.isArray(candidate.history) ? candidate.history.filter(isDrawRecord) : [],
    customQuestions: Array.isArray(candidate.customQuestions) ? candidate.customQuestions.filter(isQuestion) : [],
    theme: isThemeMode(candidate.theme) ? candidate.theme : "light"
  };
}

export function computePool(questions: Question[], history: DrawRecord[], now = new Date()): PoolState {
  const today = todayStr(now);
  const lastById = new Map<string, DrawRecord>();

  for (const record of history) {
    const prev = lastById.get(record.id);
    if (!prev || record.ts > prev.ts) {
      lastById.set(record.id, record);
    }
  }

  const available: Question[] = [];
  const cooling: Question[] = [];

  for (const question of questions) {
    const last = lastById.get(question.id);
    if (last && daysBetween(last.date, today) < COOLDOWN_DAYS) {
      cooling.push(question);
    } else {
      available.push(question);
    }
  }

  return { available, cooling, today };
}

export function pickQuestion(available: Question[], random = Math.random): Question | null {
  if (available.length === 0) return null;
  const index = Math.floor(random() * available.length);
  return available[Math.min(index, available.length - 1)];
}

export function toRecord(question: Question, today: string, ts = Date.now()): DrawRecord {
  return {
    id: question.id,
    lc: question.lc,
    name: question.name,
    diff: question.diff,
    source: question.source,
    date: today,
    ts
  };
}

export function buildCustomQuestion(input: { lc: string; name: string; diff: Difficulty }, existing: Question[], now = Date.now()): {
  question?: Question;
  error?: string;
} {
  const lc = Number(input.lc);
  const name = input.name.trim();

  if (!Number.isInteger(lc) || lc <= 0) {
    return { error: "题号必须是正整数" };
  }

  if (name.length < 2) {
    return { error: "题目名称至少需要 2 个字符" };
  }

  if (existing.some((question) => question.lc === lc)) {
    return { error: `LC-${lc} 已在卡组中` };
  }

  const maxSeq = existing.reduce((max, question) => Math.max(max, question.seq), 0);

  return {
    question: {
      id: `custom-${lc}-${now}`,
      seq: maxSeq + 1,
      lc,
      name,
      diff: input.diff,
      source: "custom",
      createdAt: now
    }
  };
}

/**
 * Imports the documented LeetCode Draw JSON format. The canonical field is
 * `leetcodeId`, which preserves the original official LeetCode problem number.
 * The legacy `lc` field remains readable so existing exported libraries keep
 * working after the format label became more explicit.
 */
export function importQuestions(content: string, existing: Question[], now = Date.now()): ImportQuestionsResult {
  const parsed = parseImportRows(content);
  const questions: Question[] = [];
  const issues = [...parsed.issues];
  const candidates = [...existing];

  for (const [index, row] of parsed.rows.entries()) {
    const diff = normalizeImportDifficulty(row.diff);
    if (!diff) {
      issues.push({ row: row.row, message: "difficulty 必须是 简单、中等 或 困难" });
      continue;
    }

    const result = buildCustomQuestion(
      {
        lc: valueToText(row.lc),
        name: valueToText(row.name),
        diff
      },
      candidates,
      now + index
    );

    if (!result.question) {
      issues.push({ row: row.row, message: result.error ?? "题目无法导入" });
      continue;
    }

    questions.push(result.question);
    candidates.push(result.question);
  }

  return { format: parsed.format, questions, issues };
}

export function leetcodeSearchUrl(question: Pick<Question, "name" | "lc">) {
  return `https://leetcode.cn/problemset/?search=${encodeURIComponent(`${question.lc} ${question.name}`)}`;
}

function isQuestion(value: unknown): value is Question {
  if (!value || typeof value !== "object") return false;
  const question = value as Question;
  return typeof question.id === "string" &&
    Number.isInteger(question.seq) &&
    Number.isInteger(question.lc) &&
    typeof question.name === "string" &&
    isDifficulty(question.diff) &&
    (question.source === "default" || question.source === "custom");
}

function isDrawRecord(value: unknown): value is DrawRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as DrawRecord;
  return typeof record.id === "string" &&
    Number.isInteger(record.lc) &&
    typeof record.name === "string" &&
    isDifficulty(record.diff) &&
    (record.source === "default" || record.source === "custom") &&
    typeof record.date === "string" &&
    Number.isFinite(record.ts);
}

function isDifficulty(value: unknown): value is Difficulty {
  return value === "简单" || value === "中等" || value === "困难";
}

function isThemeMode(value: unknown): value is ThemeMode {
  return value === "system" || value === "light" || value === "dark";
}

type ImportRow = {
  row: number;
  lc: unknown;
  name: unknown;
  diff: unknown;
};

type ParsedImportRows = {
  format: "json";
  rows: ImportRow[];
  issues: ImportIssue[];
};

function parseImportRows(content: string): ParsedImportRows {
  const normalized = content.replace(/^\uFEFF/, "").trim();
  if (!normalized) {
    return {
      format: "json",
      rows: [],
      issues: [{ row: 0, message: "导入文件为空" }]
    };
  }

  return parseJsonRows(normalized);
}

function parseJsonRows(content: string): ParsedImportRows {
  try {
    const parsed = JSON.parse(content) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {
        format: "json",
        rows: [],
        issues: [{ row: 0, message: "文件根对象必须是 LeetCode Draw 题库对象" }]
      };
    }

    const document = parsed as { format?: unknown; version?: unknown; questions?: unknown };
    if (document.format !== QUESTION_LIBRARY_FORMAT) {
      return {
        format: "json",
        rows: [],
        issues: [{ row: 0, message: `format 必须是 ${QUESTION_LIBRARY_FORMAT}` }]
      };
    }

    if (document.version !== QUESTION_LIBRARY_VERSION) {
      return {
        format: "json",
        rows: [],
        issues: [{ row: 0, message: `version 必须是 ${QUESTION_LIBRARY_VERSION}` }]
      };
    }

    if (!Array.isArray(document.questions)) {
      return {
        format: "json",
        rows: [],
        issues: [{ row: 0, message: "questions 必须是题目数组" }]
      };
    }

    const values = document.questions;

    const rows: ImportRow[] = [];
    const issues: ImportIssue[] = [];
    values.forEach((value, index) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        issues.push({ row: index + 1, message: "每一项都需要是题目对象" });
        return;
      }
      const item = value as Record<string, unknown>;
      rows.push({
        row: index + 1,
        lc: item.leetcodeId ?? item.lc,
        name: item.name,
        diff: item.difficulty
      });
    });

    return { format: "json", rows, issues };
  } catch {
    return {
      format: "json",
      rows: [],
      issues: [{ row: 0, message: "JSON 格式无效" }]
    };
  }
}

function normalizeImportDifficulty(value: unknown): Difficulty | null {
  const difficulty = valueToText(value).trim();
  if (difficulty === "简单" || difficulty === "中等" || difficulty === "困难") return difficulty;
  return null;
}

function valueToText(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

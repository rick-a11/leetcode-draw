export type Difficulty = "简单" | "中等" | "困难";
export type QuestionSource = "default" | "custom";
export type ThemeMode = "system" | "light" | "dark";

export interface Question {
  id: string;
  seq: number;
  lc: number;
  name: string;
  diff: Difficulty;
  source: QuestionSource;
  createdAt?: number;
}

export interface DrawRecord {
  id: string;
  lc: number;
  name: string;
  diff: Difficulty;
  source: QuestionSource;
  date: string;
  ts: number;
}

export interface AppState {
  history: DrawRecord[];
  customQuestions: Question[];
  theme: ThemeMode;
}

export interface PoolState {
  available: Question[];
  cooling: Question[];
  today: string;
}

export interface ImportIssue {
  row: number;
  message: string;
}

export interface ImportQuestionsResult {
  format: "json";
  questions: Question[];
  issues: ImportIssue[];
}

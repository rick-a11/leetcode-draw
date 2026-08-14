import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  buildCustomQuestion,
  computePool,
  COOLDOWN_DAYS,
  importQuestions,
  normalizeState,
  pickQuestion,
  QUESTION_LIBRARY_FORMAT,
  QUESTION_LIBRARY_VERSION,
  toRecord
} from "./draw";
import type { Question } from "./types";

const questions: Question[] = [
  { id: "default-1", seq: 1, lc: 1, name: "两数之和", diff: "简单", source: "default" },
  { id: "default-2", seq: 2, lc: 2, name: "两数相加", diff: "中等", source: "default" }
];

describe("draw rules", () => {
  it("keeps a drawn question out of the pool for five days", () => {
    const record = toRecord(questions[0], "2026-07-01", 100);
    const pool = computePool(questions, [record], new Date("2026-07-04T12:00:00"));

    expect(pool.cooling).toHaveLength(1);
    expect(pool.cooling[0].id).toBe("default-1");
    expect(pool.available.map((question) => question.id)).toEqual(["default-2"]);
  });

  it("returns a question to the pool after the cooldown window", () => {
    const record = toRecord(questions[0], "2026-07-01", 100);
    const pool = computePool(questions, [record], new Date(`2026-07-0${COOLDOWN_DAYS + 1}T12:00:00`));

    expect(pool.cooling).toHaveLength(0);
    expect(pool.available).toHaveLength(2);
  });

  it("picks deterministically when a random function is supplied", () => {
    expect(pickQuestion(questions, () => 0.75)?.id).toBe("default-2");
  });

  it("builds a custom question after validating input", () => {
    const result = buildCustomQuestion({ lc: "347", name: "前 K 个高频元素", diff: "中等" }, questions, 42);

    expect(result.error).toBeUndefined();
    expect(result.question).toMatchObject({
      id: "custom-347-42",
      seq: 3,
      lc: 347,
      name: "前 K 个高频元素",
      diff: "中等",
      source: "custom"
    });
  });

  it("rejects duplicate LeetCode numbers", () => {
    const result = buildCustomQuestion({ lc: "1", name: "重复题目", diff: "简单" }, questions, 42);

    expect(result.error).toBe("LC-1 已在卡组中");
  });

  it("starts a new library with zero available questions", () => {
    expect(normalizeState(null)).toEqual({
      history: [],
      customQuestions: [],
      theme: "light"
    });
  });

  it("imports the documented LeetCode Draw JSON format", () => {
    const result = importQuestions(
      JSON.stringify({
        format: QUESTION_LIBRARY_FORMAT,
        version: QUESTION_LIBRARY_VERSION,
        questions: [
          { leetcodeId: 347, name: "前 K 个高频元素", difficulty: "中等" },
          { leetcodeId: 42, name: "接雨水", difficulty: "困难" }
        ]
      }),
      questions,
      100
    );

    expect(result.format).toBe("json");
    expect(result.issues).toEqual([]);
    expect(result.questions).toMatchObject([
      { lc: 347, name: "前 K 个高频元素", diff: "中等", source: "custom" },
      { lc: 42, name: "接雨水", diff: "困难", source: "custom" }
    ]);
  });

  it("ships a complete importable example with three official LeetCode numbers", async () => {
    const sample = await readFile(path.join(process.cwd(), "resources/examples/leetcode-draw-example.json"), "utf8");
    const result = importQuestions(sample, [], 125);

    expect(result.issues).toEqual([]);
    expect(result.questions).toHaveLength(3);
    expect(result.questions.map((question) => question.lc)).toEqual([1, 2, 42]);
    expect(result.questions.map((question) => question.diff)).toEqual(["简单", "中等", "困难"]);
  });

  it("keeps compatibility with the earlier lc field", () => {
    const result = importQuestions(
      JSON.stringify({
        format: QUESTION_LIBRARY_FORMAT,
        version: QUESTION_LIBRARY_VERSION,
        questions: [{ lc: 347, name: "前 K 个高频元素", difficulty: "中等" }]
      }),
      questions,
      150
    );

    expect(result.issues).toEqual([]);
    expect(result.questions[0]).toMatchObject({ lc: 347, name: "前 K 个高频元素" });
  });

  it("imports JSON and reports duplicate or invalid rows without abandoning valid rows", () => {
    const result = importQuestions(
      JSON.stringify({
        format: QUESTION_LIBRARY_FORMAT,
        version: QUESTION_LIBRARY_VERSION,
        questions: [
          { lc: 146, name: "LRU 缓存", difficulty: "中等" },
          { lc: 1, name: "两数之和", difficulty: "简单" },
          { lc: 99, name: "", difficulty: "简单" },
          { lc: 44, name: "通配符匹配", difficulty: "unknown" }
        ]
      }),
      questions,
      200
    );

    expect(result.format).toBe("json");
    expect(result.questions).toHaveLength(1);
    expect(result.questions[0]).toMatchObject({ lc: 146, diff: "中等" });
    expect(result.issues).toHaveLength(3);
    expect(result.issues.map((issue) => issue.row)).toEqual([2, 3, 4]);
  });

  it("rejects files that do not use the documented JSON envelope", () => {
    const result = importQuestions(JSON.stringify([{ lc: 1, name: "两数之和", difficulty: "简单" }]), questions, 300);

    expect(result.questions).toEqual([]);
    expect(result.issues).toEqual([{ row: 0, message: "文件根对象必须是 LeetCode Draw 题库对象" }]);
  });
});

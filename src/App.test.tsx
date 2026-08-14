import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

afterEach(() => {
  cleanup();
  localStorage.clear();
  delete window.leetcodeDraw;
  delete document.documentElement.dataset.theme;
});

describe("application shell", () => {
  it("starts with an empty library and applies every appearance choice", async () => {
    render(<App />);

    await screen.findByText("题库为空，请导入题库文件");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(screen.getByText("当前有 0 道可抽题目。", { exact: false })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "使用深色模式" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(screen.getByRole("button", { name: "使用深色模式" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "使用浅色模式" }));
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(screen.getByRole("button", { name: "使用浅色模式" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "跟随系统外观" }));
    expect(document.documentElement).not.toHaveAttribute("data-theme");
    expect(screen.getByRole("button", { name: "跟随系统外观" })).toHaveAttribute("aria-pressed", "true");
  });

  it("imports an LLM-converted JSON library and opens the categorized library", async () => {
    window.leetcodeDraw = {
      getState: vi.fn().mockResolvedValue(null),
      setState: vi.fn().mockResolvedValue(true),
      openLeetCode: vi.fn().mockResolvedValue(true),
      copyText: vi.fn().mockResolvedValue(true),
      saveExampleFile: vi.fn().mockResolvedValue(null),
      setAppearance: vi.fn().mockResolvedValue(true),
      chooseImportFile: vi.fn().mockResolvedValue({
        name: "my-library.json",
        content: JSON.stringify({
          format: "leetcode-draw/question-library",
          version: 1,
          questions: [
            { leetcodeId: 1, name: "两数之和", difficulty: "简单" },
            { leetcodeId: 2, name: "两数相加", difficulty: "中等" },
            { leetcodeId: 42, name: "接雨水", difficulty: "困难" }
          ]
        })
      })
    };

    render(<App />);
    await screen.findByText("题库为空，请导入题库文件");
    fireEvent.click(screen.getByRole("button", { name: "导入题库文件" }));

    expect(await screen.findByText("已导入 3 道题目")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "共 3 道题目" })).toBeInTheDocument();
    expect(screen.getByText("题单转换")).toBeInTheDocument();
    expect(screen.getByText("两数之和")).toBeInTheDocument();
    expect(screen.getByText("两数相加")).toBeInTheDocument();
    expect(screen.getByText("接雨水")).toBeInTheDocument();
    expect(screen.getAllByText("力扣原题")).not.toHaveLength(0);
  });

  it("synchronizes the selected appearance with the desktop icon bridge", async () => {
    const setAppearance = vi.fn().mockResolvedValue(true);
    window.leetcodeDraw = {
      getState: vi.fn().mockResolvedValue(null),
      setState: vi.fn().mockResolvedValue(true),
      openLeetCode: vi.fn().mockResolvedValue(true),
      chooseImportFile: vi.fn().mockResolvedValue(null),
      copyText: vi.fn().mockResolvedValue(true),
      saveExampleFile: vi.fn().mockResolvedValue(null),
      setAppearance
    };

    render(<App />);
    await screen.findByText("题库为空，请导入题库文件");
    await waitFor(() => expect(setAppearance).toHaveBeenCalledWith("light"));

    fireEvent.click(screen.getByRole("button", { name: "使用深色模式" }));
    await waitFor(() => expect(setAppearance).toHaveBeenLastCalledWith("dark"));
  });

  it("offers a complete three-question JSON example without asking the user to type it", async () => {
    const saveExampleFile = vi.fn().mockResolvedValue({ name: "LeetCode Draw 三题示例题库.json" });
    window.leetcodeDraw = {
      getState: vi.fn().mockResolvedValue(null),
      setState: vi.fn().mockResolvedValue(true),
      openLeetCode: vi.fn().mockResolvedValue(true),
      chooseImportFile: vi.fn().mockResolvedValue(null),
      copyText: vi.fn().mockResolvedValue(true),
      saveExampleFile,
      setAppearance: vi.fn().mockResolvedValue(true)
    };

    render(<App />);
    await screen.findByText("题库为空，请导入题库文件");
    fireEvent.click(screen.getByRole("button", { name: /我的题库/ }));
    fireEvent.click(screen.getByRole("button", { name: "下载完整三题示例 JSON" }));

    await waitFor(() => expect(saveExampleFile).toHaveBeenCalledOnce());
    expect(await screen.findByText("三题示例题库已保存为 LeetCode Draw 三题示例题库.json")).toBeInTheDocument();
    expect(screen.getByText(/"leetcodeId": 42/)).toBeInTheDocument();
  });

  it("keeps the empty library purposeful with a difficulty-archive preview", async () => {
    render(<App />);

    await screen.findByText("题库为空，请导入题库文件");
    fireEvent.click(screen.getByRole("button", { name: /我的题库/ }));

    expect(screen.getByRole("region", { name: "空题库归档预览" })).toBeInTheDocument();
    expect(screen.getByText("导入后自动归档")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "导入后的难度归档" })).toBeInTheDocument();
  });

  it("draws from a natively importable library, applies cooldown, and clears history", async () => {
    window.leetcodeDraw = {
      getState: vi.fn().mockResolvedValue(null),
      setState: vi.fn().mockResolvedValue(true),
      openLeetCode: vi.fn().mockResolvedValue(true),
      copyText: vi.fn().mockResolvedValue(true),
      saveExampleFile: vi.fn().mockResolvedValue(null),
      setAppearance: vi.fn().mockResolvedValue(true),
      chooseImportFile: vi.fn().mockResolvedValue({
        name: "leetcode-draw-example.json",
        content: JSON.stringify({
          format: "leetcode-draw/question-library",
          version: 1,
          questions: [
            { leetcodeId: 1, name: "两数之和", difficulty: "简单" },
            { leetcodeId: 2, name: "两数相加", difficulty: "中等" },
            { leetcodeId: 42, name: "接雨水", difficulty: "困难" }
          ]
        })
      })
    };

    render(<App />);
    await screen.findByText("题库为空，请导入题库文件");
    fireEvent.click(screen.getByRole("button", { name: "导入题库文件" }));
    await screen.findByText("已导入 3 道题目");

    fireEvent.click(screen.getByRole("button", { name: "抽题" }));
    fireEvent.click(screen.getByRole("button", { name: "抽一道题" }));

    expect(await screen.findByText(/已抽中力扣原题 #/)).toBeInTheDocument();
    expect(screen.getByText("冷却中")).toBeInTheDocument();
    expect(screen.getByText("33%")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "清空抽题记录" }));
    fireEvent.click(screen.getByRole("button", { name: "再次点击确认清空" }));

    expect(await screen.findByText("抽过的题目会显示在这里。")).toBeInTheDocument();
    expect(screen.getByText("0%")).toBeInTheDocument();
  });
});

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

  it("keeps the breathing empty-library treatment decorative and the card navigable", async () => {
    render(<App />);

    await screen.findByText("题库为空，请导入题库文件");
    const emptyCard = screen.getByRole("button", { name: "打开我的题库" });
    expect(emptyCard.querySelector(".empty-card-motion")).toHaveAttribute("aria-hidden", "true");

    fireEvent.click(emptyCard);
    expect(await screen.findByRole("region", { name: "空题库归档预览" })).toBeInTheDocument();
  });

  it("exposes one file import entry only in the library", async () => {
    render(<App />);

    await screen.findByText("题库为空，请导入题库文件");
    expect(
      screen.queryByRole("button", { name: /选择.*JSON|导入题库文件|导入 JSON/ })
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "前往题库" }));
    expect(
      await screen.findAllByRole("button", { name: /导入题库|选择.*JSON/ })
    ).toHaveLength(1);
  });

  it("focuses the import drawer close action when it opens", async () => {
    render(<App />);

    await screen.findByText("题库为空，请导入题库文件");
    fireEvent.click(screen.getByRole("button", { name: /^我的题库/ }));
    fireEvent.click(screen.getByRole("button", { name: "导入题库" }));

    expect(await screen.findByRole("dialog", { name: "导入题库" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "关闭导入题库" })).toHaveFocus());
  });

  it("closes the import drawer with Escape and restores trigger focus", async () => {
    render(<App />);

    await screen.findByText("题库为空，请导入题库文件");
    fireEvent.click(screen.getByRole("button", { name: /^我的题库/ }));
    const trigger = screen.getByRole("button", { name: "导入题库" });
    fireEvent.click(trigger);

    expect(await screen.findByRole("dialog", { name: "导入题库" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "导入题库" })).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("closes the import drawer from its backdrop", async () => {
    render(<App />);

    await screen.findByText("题库为空，请导入题库文件");
    fireEvent.click(screen.getByRole("button", { name: /^我的题库/ }));
    fireEvent.click(screen.getByRole("button", { name: "导入题库" }));

    expect(await screen.findByRole("dialog", { name: "导入题库" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "关闭导入题库面板" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "导入题库" })).not.toBeInTheDocument());
  });

  it("keeps keyboard focus inside the import drawer", async () => {
    render(<App />);

    await screen.findByText("题库为空，请导入题库文件");
    fireEvent.click(screen.getByRole("button", { name: /^我的题库/ }));
    fireEvent.click(screen.getByRole("button", { name: "导入题库" }));

    const closeButton = await screen.findByRole("button", { name: "关闭导入题库" });
    await waitFor(() => expect(closeButton).toHaveFocus());
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(screen.getByRole("button", { name: "下载完整三题示例 JSON" })).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(closeButton).toHaveFocus();
  });

  it("closes the drawer after a valid import and reports success in the library", async () => {
    window.leetcodeDraw = {
      getState: vi.fn().mockResolvedValue(null),
      setState: vi.fn().mockResolvedValue(true),
      openLeetCode: vi.fn().mockResolvedValue(true),
      copyText: vi.fn().mockResolvedValue(true),
      saveExampleFile: vi.fn().mockResolvedValue(null),
      setAppearance: vi.fn().mockResolvedValue(true),
      chooseImportFile: vi.fn().mockResolvedValue({
        name: "valid-library.json",
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
    fireEvent.click(screen.getByRole("button", { name: /^我的题库/ }));
    fireEvent.click(screen.getByRole("button", { name: "导入题库" }));
    fireEvent.click(screen.getByRole("button", { name: "选择 JSON 题库文件" }));

    expect(await screen.findByText("已导入 3 道题目")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "导入题库" })).not.toBeInTheDocument();
  });

  it("keeps an invalid import error inside the open drawer", async () => {
    window.leetcodeDraw = {
      getState: vi.fn().mockResolvedValue(null),
      setState: vi.fn().mockResolvedValue(true),
      openLeetCode: vi.fn().mockResolvedValue(true),
      copyText: vi.fn().mockResolvedValue(true),
      saveExampleFile: vi.fn().mockResolvedValue(null),
      setAppearance: vi.fn().mockResolvedValue(true),
      chooseImportFile: vi.fn().mockResolvedValue({
        name: "broken-library.json",
        content: "not valid JSON"
      })
    };

    render(<App />);
    await screen.findByText("题库为空，请导入题库文件");
    fireEvent.click(screen.getByRole("button", { name: /^我的题库/ }));
    fireEvent.click(screen.getByRole("button", { name: "导入题库" }));
    fireEvent.click(screen.getByRole("button", { name: "选择 JSON 题库文件" }));

    const dialog = await screen.findByRole("dialog", { name: "导入题库" });
    expect(within(dialog).getByText("没有可导入的有效题目，请检查文件格式")).toBeInTheDocument();
    expect(within(dialog).getByText("JSON 格式无效")).toBeInTheDocument();
  });

  it("marks official numbers by difficulty and summarizes the library", async () => {
    window.leetcodeDraw = {
      getState: vi.fn().mockResolvedValue(null),
      setState: vi.fn().mockResolvedValue(true),
      openLeetCode: vi.fn().mockResolvedValue(true),
      copyText: vi.fn().mockResolvedValue(true),
      saveExampleFile: vi.fn().mockResolvedValue(null),
      setAppearance: vi.fn().mockResolvedValue(true),
      chooseImportFile: vi.fn().mockResolvedValue({
        name: "difficulty-library.json",
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
    fireEvent.click(screen.getByRole("button", { name: /^我的题库/ }));
    fireEvent.click(screen.getByRole("button", { name: "导入题库" }));
    fireEvent.click(screen.getByRole("button", { name: "选择 JSON 题库文件" }));
    await screen.findByText("已导入 3 道题目");

    expect(screen.getByText("#1").closest(".question-number")).toHaveClass("easy");
    expect(screen.getByText("#2").closest(".question-number")).toHaveClass("mid");
    expect(screen.getByText("#42").closest(".question-number")).toHaveClass("hard");

    const summary = screen.getByRole("list", { name: "题库难度统计" });
    expect(within(summary).getByRole("listitem", { name: "简单 1" })).toBeInTheDocument();
    expect(within(summary).getByRole("listitem", { name: "中等 1" })).toBeInTheDocument();
    expect(within(summary).getByRole("listitem", { name: "困难 1" })).toBeInTheDocument();
  });

  it("requires confirmation before deleting one question", async () => {
    window.leetcodeDraw = {
      getState: vi.fn().mockResolvedValue(null),
      setState: vi.fn().mockResolvedValue(true),
      openLeetCode: vi.fn().mockResolvedValue(true),
      copyText: vi.fn().mockResolvedValue(true),
      saveExampleFile: vi.fn().mockResolvedValue(null),
      setAppearance: vi.fn().mockResolvedValue(true),
      chooseImportFile: vi.fn().mockResolvedValue({
        name: "deletable-library.json",
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
    fireEvent.click(screen.getByRole("button", { name: /^我的题库/ }));
    fireEvent.click(screen.getByRole("button", { name: "导入题库" }));
    fireEvent.click(screen.getByRole("button", { name: "选择 JSON 题库文件" }));
    await screen.findByText("已导入 3 道题目");

    fireEvent.click(screen.getByRole("button", { name: "删除 两数之和" }));
    expect(screen.getByText("两数之和")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "共 3 道题目" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "确认删除 两数之和" }));
    await waitFor(() => expect(screen.queryByText("两数之和")).not.toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "共 2 道题目" })).toBeInTheDocument();
  });

  it("requires confirmation before clearing the library and its draw history", async () => {
    window.leetcodeDraw = {
      getState: vi.fn().mockResolvedValue(null),
      setState: vi.fn().mockResolvedValue(true),
      openLeetCode: vi.fn().mockResolvedValue(true),
      copyText: vi.fn().mockResolvedValue(true),
      saveExampleFile: vi.fn().mockResolvedValue(null),
      setAppearance: vi.fn().mockResolvedValue(true),
      chooseImportFile: vi.fn().mockResolvedValue({
        name: "clearable-library.json",
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
    fireEvent.click(screen.getByRole("button", { name: /^我的题库/ }));
    fireEvent.click(screen.getByRole("button", { name: "导入题库" }));
    fireEvent.click(screen.getByRole("button", { name: "选择 JSON 题库文件" }));
    await screen.findByText("已导入 3 道题目");

    fireEvent.click(screen.getByRole("button", { name: "抽题" }));
    fireEvent.click(screen.getByRole("button", { name: "抽一道题" }));
    expect(await screen.findByText(/已抽中力扣原题 #/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^我的题库/ }));
    fireEvent.click(screen.getByRole("button", { name: "清空题库" }));
    expect(screen.getByRole("heading", { name: "共 3 道题目" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "确认清空题库" }));
    expect(await screen.findByRole("heading", { name: "题库暂时为空" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "清空题库" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "抽题" }));
    expect(await screen.findByText("抽过的题目会显示在这里。")).toBeInTheDocument();
    expect(screen.getByText("0%")).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("button", { name: /^我的题库/ }));
    fireEvent.click(screen.getByRole("button", { name: "导入题库" }));
    fireEvent.click(screen.getByRole("button", { name: "选择 JSON 题库文件" }));

    expect(await screen.findByText("已导入 3 道题目")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "共 3 道题目" })).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("button", { name: /^我的题库/ }));
    fireEvent.click(screen.getByRole("button", { name: "导入题库" }));
    fireEvent.click(screen.getByRole("button", { name: "下载完整三题示例 JSON" }));

    await waitFor(() => expect(saveExampleFile).toHaveBeenCalledOnce());
    expect(await screen.findByText("三题示例题库已保存为 LeetCode Draw 三题示例题库.json")).toBeInTheDocument();
    expect(screen.getByText(/"leetcodeId": 42/)).toBeInTheDocument();
  });

  it("keeps the empty library purposeful with a difficulty-archive preview", async () => {
    render(<App />);

    await screen.findByText("题库为空，请导入题库文件");
    fireEvent.click(screen.getByRole("button", { name: /^我的题库/ }));

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
    fireEvent.click(screen.getByRole("button", { name: /^我的题库/ }));
    fireEvent.click(screen.getByRole("button", { name: "导入题库" }));
    fireEvent.click(screen.getByRole("button", { name: "选择 JSON 题库文件" }));
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

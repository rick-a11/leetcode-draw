import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowClockwise,
  ArrowSquareOut,
  BookOpen,
  Cards,
  CheckCircle,
  ClipboardText,
  FileArrowUp,
  Leaf,
  MagnifyingGlass,
  Monitor,
  Mountains,
  Moon,
  Path,
  Sun,
  Trash,
  X
} from "@phosphor-icons/react";
import {
  computePool,
  diffClass,
  importQuestions,
  leetcodeSearchUrl,
  normalizeState,
  pickQuestion,
  toRecord
} from "./lib/draw";
import type {
  AppState,
  Difficulty,
  DrawRecord,
  ImportQuestionsResult,
  Question,
  ThemeMode
} from "./lib/types";

const fallbackStorage = {
  async getState() {
    const raw = localStorage.getItem("leetcode-draw-state");
    return raw ? JSON.parse(raw) : null;
  },
  async setState(value: unknown) {
    localStorage.setItem("leetcode-draw-state", JSON.stringify(value));
    return true;
  },
  async openLeetCode(url: string) {
    window.open(url, "_blank", "noopener,noreferrer");
    return true;
  }
};

const DIFFICULTIES: Difficulty[] = ["简单", "中等", "困难"];
const QUESTION_LIBRARY_EXAMPLE = `{
  "format": "leetcode-draw/question-library",
  "version": 1,
  "questions": [
    { "leetcodeId": 1, "name": "两数之和", "difficulty": "简单" },
    { "leetcodeId": 2, "name": "两数相加", "difficulty": "中等" },
    { "leetcodeId": 42, "name": "接雨水", "difficulty": "困难" }
  ]
}`;
const CONVERSION_PROMPT = `请从我提供的力扣题目网站截图或文本中提取题目，并输出一个可导入 LeetCode Draw 的 JSON 文件。

要求：
1. 每道题必须保留力扣官网的原始题号，字段名固定为 leetcodeId。
2. 只保留力扣官网题号、中文题目名称和难度。
3. 难度只能写为：简单、中等、困难。
4. 去除重复题号和无法确认的题目。
5. 只输出有效 JSON，不要 Markdown、解释、代码围栏或其他文字。
6. JSON 必须严格使用下面的结构：

${QUESTION_LIBRARY_EXAMPLE}`;

type AppView = "draw" | "library";
type LibraryFilter = "全部" | Difficulty;
type ImportReport = Pick<ImportQuestionsResult, "format" | "issues"> & {
  fileName: string;
  added: number;
};

function getBridge() {
  return window.leetcodeDraw ?? fallbackStorage;
}

export function App() {
  const [history, setHistory] = useState<DrawRecord[]>([]);
  const [customQuestions, setCustomQuestions] = useState<Question[]>([]);
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [view, setView] = useState<AppView>("draw");
  const [current, setCurrent] = useState<Question | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [status, setStatus] = useState("正在加载本地题库");
  const [ready, setReady] = useState(false);
  const [resetConfirming, setResetConfirming] = useState(false);
  const [filter, setFilter] = useState<LibraryFilter>("全部");
  const [query, setQuery] = useState("");
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const bridge = getBridge();
  const allQuestions = useMemo(
    () => [...customQuestions].sort((a, b) => a.lc - b.lc || (a.createdAt ?? 0) - (b.createdAt ?? 0)),
    [customQuestions]
  );
  const pool = useMemo(() => computePool(allQuestions, history), [allQuestions, history]);
  const uniqueDrawn = useMemo(() => new Set(history.map((record) => record.id)).size, [history]);
  const progress = allQuestions.length === 0 ? 0 : Math.round((uniqueDrawn / allQuestions.length) * 100);
  const difficultyCounts = useMemo(
    () => Object.fromEntries(DIFFICULTIES.map((difficulty) => [difficulty, allQuestions.filter((item) => item.diff === difficulty).length])) as Record<Difficulty, number>,
    [allQuestions]
  );
  const libraryGroups = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return DIFFICULTIES.map((difficulty) => ({
      difficulty,
      questions: allQuestions.filter((question) => {
        const matchesFilter = filter === "全部" || question.diff === filter;
        const matchesQuery = !normalizedQuery || `${question.lc} ${question.name}`.toLocaleLowerCase().includes(normalizedQuery);
        return matchesFilter && matchesQuery && question.diff === difficulty;
      })
    }));
  }, [allQuestions, filter, query]);

  useEffect(() => {
    let mounted = true;

    bridge.getState()
      .then((value) => {
        if (!mounted) return;
        const saved = normalizeState(value);
        setHistory(saved.history);
        setCustomQuestions(saved.customQuestions);
        setTheme(saved.theme);
        setStatus(saved.customQuestions.length === 0 ? "题库为空，请导入题库文件" : "题库已就绪");
        setReady(true);
      })
      .catch(() => {
        if (!mounted) return;
        setStatus("读取本地记录失败，已使用空题库启动");
        setReady(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const state: AppState = { history, customQuestions, theme };
    void bridge.setState(state);
  }, [customQuestions, history, ready, theme]);

  useEffect(() => {
    if (theme === "system") {
      delete document.documentElement.dataset.theme;
    } else {
      document.documentElement.dataset.theme = theme;
    }
    void window.leetcodeDraw?.setAppearance(theme);
  }, [theme]);

  useEffect(() => {
    if (!resetConfirming) return;
    const timer = window.setTimeout(() => setResetConfirming(false), 3500);
    return () => window.clearTimeout(timer);
  }, [resetConfirming]);

  function drawQuestion() {
    const pick = pickQuestion(pool.available);
    if (!pick) return;

    const reveal = () => {
      const record = toRecord(pick, pool.today);
      setCurrent(pick);
      setFlipped(true);
      setHistory((items) => [...items, record]);
      setStatus(`已抽中力扣原题 #${pick.lc}`);
    };

    if (flipped) {
      setFlipped(false);
      window.setTimeout(reveal, 220);
      return;
    }

    reveal();
  }

  function removeCustomQuestion(question: Question) {
    setCustomQuestions((items) => items.filter((item) => item.id !== question.id));
    if (current?.id === question.id) {
      setCurrent(null);
      setFlipped(false);
    }
    setStatus(`已从题库移出力扣原题 #${question.lc}`);
  }

  function clearHistory() {
    if (!resetConfirming) {
      setResetConfirming(true);
      return;
    }

    setHistory([]);
    setCurrent(null);
    setFlipped(false);
    setResetConfirming(false);
    setStatus("抽题记录已清空");
  }

  function openQuestion(question: Question) {
    void bridge.openLeetCode(leetcodeSearchUrl(question));
  }

  function showLibrary(nextFilter: LibraryFilter = "全部") {
    setFilter(nextFilter);
    setView("library");
  }

  function applyImport(fileName: string, content: string) {
    const result = importQuestions(content, allQuestions);
    if (result.questions.length > 0) {
      setCustomQuestions((items) => [...items, ...result.questions]);
    }

    setImportReport({
      fileName,
      format: result.format,
      added: result.questions.length,
      issues: result.issues
    });

    if (result.questions.length > 0) {
      setStatus(`已从 ${fileName} 导入 ${result.questions.length} 道题`);
    } else {
      setStatus("没有可导入的有效题目，请检查文件格式");
    }
    setView("library");
  }

  async function chooseImportFile() {
    const picker = window.leetcodeDraw?.chooseImportFile;
    if (!picker) {
      fileInputRef.current?.click();
      return;
    }

    const selected = await picker();
    if (!selected) return;
    if ("error" in selected && selected.error) {
      setImportReport({
        fileName: "所选文件",
        format: "json",
        added: 0,
        issues: [{ row: 0, message: selected.error }]
      });
      setStatus(selected.error);
      return;
    }

    if ("content" in selected && typeof selected.content === "string") {
      applyImport(selected.name, selected.content);
    }
  }

  async function handleBrowserFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setImportReport({
        fileName: file.name,
        format: "json",
        added: 0,
        issues: [{ row: 0, message: "导入文件不能超过 2 MB" }]
      });
      return;
    }
    applyImport(file.name, await file.text());
  }

  async function copyConversionPrompt() {
    try {
      const copyText = window.leetcodeDraw?.copyText;
      if (copyText) {
        await copyText(CONVERSION_PROMPT);
      } else {
        await navigator.clipboard.writeText(CONVERSION_PROMPT);
      }
      setStatus("已复制转换提示词，可发送给大模型");
    } catch {
      setStatus("无法访问剪贴板，请直接复制右侧格式说明");
    }
  }

  async function saveExampleLibrary() {
    try {
      const saveExampleFile = window.leetcodeDraw?.saveExampleFile;
      if (saveExampleFile) {
        const result = await saveExampleFile();
        if (!result) return;
        if ("error" in result && result.error) {
          setStatus(result.error);
          return;
        }
        if ("name" in result && result.name) {
          setStatus(`三题示例题库已保存为 ${result.name}`);
          return;
        }
      }

      const blob = new Blob([QUESTION_LIBRARY_EXAMPLE], { type: "application/json" });
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = "LeetCode Draw 三题示例题库.json";
      link.click();
      URL.revokeObjectURL(href);
      setStatus("三题示例题库已下载");
    } catch {
      setStatus("示例题库保存失败，请稍后重试");
    }
  }

  const sortedHistory = [...history].sort((a, b) => b.ts - a.ts);

  return (
    <main className="app-shell">
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />
      <section className="workspace">
        <header className="topbar liquid-glass-web-approx">
          <div className="brand-block">
            <span className="brand-mark" aria-hidden="true">
              <Cards size={24} weight="fill" />
            </span>
            <div>
              <h1>LeetCode Draw</h1>
              <p>把自己的刷题清单变成可抽取的题库</p>
            </div>
          </div>

          <nav className="view-tabs" aria-label="主导航">
            <button className={view === "draw" ? "active" : ""} type="button" onClick={() => setView("draw")}>
              <Cards size={18} weight={view === "draw" ? "fill" : "regular"} />
              抽题
            </button>
            <button className={view === "library" ? "active" : ""} type="button" onClick={() => showLibrary()}>
              <BookOpen size={18} weight={view === "library" ? "fill" : "regular"} />
              我的题库
              <span>{allQuestions.length}</span>
            </button>
          </nav>

          <div className="topbar-actions">
            <ThemeSwitcher value={theme} onChange={setTheme} />
            <div className="status-pill" title={status}>
              <CheckCircle size={17} weight="fill" />
              <span>{status}</span>
            </div>
          </div>
        </header>

        <input
          ref={fileInputRef}
          className="visually-hidden"
          type="file"
          accept=".json,application/json"
          onChange={handleBrowserFile}
        />

        {view === "draw" ? (
          <DrawView
            current={current}
            flipped={flipped}
            available={pool.available.length}
            cooling={pool.cooling.length}
            total={allQuestions.length}
            progress={progress}
            difficultyCounts={difficultyCounts}
            history={sortedHistory}
            today={pool.today}
            resetConfirming={resetConfirming}
            onDraw={drawQuestion}
            onOpenQuestion={openQuestion}
            onShowLibrary={showLibrary}
            onChooseImport={chooseImportFile}
            onClearHistory={clearHistory}
          />
        ) : (
          <LibraryView
            allQuestionCount={allQuestions.length}
            difficultyCounts={difficultyCounts}
            groups={libraryGroups}
            filter={filter}
            query={query}
            importReport={importReport}
            onChooseImport={chooseImportFile}
            onCopyPrompt={copyConversionPrompt}
            onSaveExample={saveExampleLibrary}
            onClearImportReport={() => setImportReport(null)}
            onFilterChange={setFilter}
            onQueryChange={setQuery}
            onRemoveQuestion={removeCustomQuestion}
            onOpenQuestion={openQuestion}
          />
        )}
      </section>
    </main>
  );
}

function ThemeSwitcher({ value, onChange }: { value: ThemeMode; onChange: (value: ThemeMode) => void }) {
  return (
    <div className="theme-switcher" role="group" aria-label="外观模式">
      <button className={value === "light" ? "selected" : ""} type="button" aria-label="使用浅色模式" aria-pressed={value === "light"} onClick={() => onChange("light")}>
        <Sun size={16} weight="fill" />
      </button>
      <button className={value === "system" ? "selected" : ""} type="button" aria-label="跟随系统外观" aria-pressed={value === "system"} onClick={() => onChange("system")}>
        <Monitor size={16} weight="bold" />
      </button>
      <button className={value === "dark" ? "selected" : ""} type="button" aria-label="使用深色模式" aria-pressed={value === "dark"} onClick={() => onChange("dark")}>
        <Moon size={16} weight="fill" />
      </button>
    </div>
  );
}

function DifficultyGlyph({ difficulty }: { difficulty: Difficulty }) {
  if (difficulty === "简单") return <Leaf size={18} weight="duotone" aria-hidden="true" />;
  if (difficulty === "困难") return <Mountains size={18} weight="duotone" aria-hidden="true" />;
  return <Path size={18} weight="duotone" aria-hidden="true" />;
}

function DrawView({
  current,
  flipped,
  available,
  cooling,
  total,
  progress,
  difficultyCounts,
  history,
  today,
  resetConfirming,
  onDraw,
  onOpenQuestion,
  onShowLibrary,
  onChooseImport,
  onClearHistory
}: {
  current: Question | null;
  flipped: boolean;
  available: number;
  cooling: number;
  total: number;
  progress: number;
  difficultyCounts: Record<Difficulty, number>;
  history: DrawRecord[];
  today: string;
  resetConfirming: boolean;
  onDraw: () => void;
  onOpenQuestion: (question: Question) => void;
  onShowLibrary: (filter?: LibraryFilter) => void;
  onChooseImport: () => void;
  onClearHistory: () => void;
}) {
  const emptyLibrary = total === 0;
  const unavailable = !emptyLibrary && available === 0;

  return (
    <div className="draw-layout">
      <section className="draw-panel liquid-glass-web-approx" aria-label="随机抽题">
        <div className="section-heading draw-heading">
          <div>
            <span className="section-kicker">今日抽题</span>
            <h2>{emptyLibrary ? "先建立你的题库" : unavailable ? "题目正在冷却" : "准备抽一道题"}</h2>
            <p>{emptyLibrary ? "当前有 0 道可抽题目。将题目网页截图或文本交给大模型生成题库 JSON 文件，再一次导入。" : unavailable ? "所有题目都在 5 天冷却期内。可以稍后再抽，或清空抽题记录。" : "每次抽取会让该题进入 5 天冷却期，避免短期重复。"}</p>
          </div>
          <span className="availability-chip">
            <Cards size={17} weight="fill" />
            {available} 道可抽
          </span>
        </div>

        <div className="deck-wrap">
          <div className="deck-shadow deck-shadow-one" aria-hidden="true" />
          <div className="deck-shadow deck-shadow-two" aria-hidden="true" />
          <button
            className={`draw-card ${flipped ? "flipped" : ""} ${emptyLibrary ? "empty" : ""}`}
            type="button"
            onClick={emptyLibrary ? () => onShowLibrary() : onDraw}
            disabled={unavailable}
            aria-label={emptyLibrary ? "前往题库" : "点击抽取题目"}
          >
            <span className="card-face card-back">
              <span className="card-reflection" aria-hidden="true" />
              <span className="tarot-aura" aria-hidden="true" />
              <span className="tarot-sigil" aria-hidden="true">
                <span className="tarot-ring tarot-ring-outer" />
                <span className="tarot-ring tarot-ring-middle" />
                <span className="tarot-ring tarot-ring-inner" />
                <span className="tarot-cross tarot-cross-vertical" />
                <span className="tarot-cross tarot-cross-horizontal" />
                <span className="tarot-diamond" />
                <span className="tarot-star tarot-star-top" />
                <span className="tarot-star tarot-star-right" />
                <span className="tarot-star tarot-star-bottom" />
                <span className="tarot-star tarot-star-left" />
              </span>
              {emptyLibrary ? (
                <span className="empty-card-content">
                  <BookOpen size={38} weight="duotone" />
                  <strong>题库为空</strong>
                  <small>导入第一份题库文件</small>
                </span>
              ) : (
                <span className="card-back-content">
                  <span>可抽题库</span>
                  <strong>{available}</strong>
                  <small>点击翻开下一题</small>
                </span>
              )}
            </span>
            <span className="card-face card-front">
              {current ? (
                <>
                  <span className="card-topline">
                    <span>力扣原题 #{String(current.lc).padStart(4, "0")}</span>
                    <span className={`badge ${diffClass(current.diff)}`}>{current.diff}</span>
                  </span>
                  <span className="card-title">{current.name}</span>
                  <span className="card-bottomline">再次点击可抽取下一题</span>
                </>
              ) : (
                <span className="card-title muted">等待抽题</span>
              )}
            </span>
          </button>
        </div>

        <div className="draw-actions">
          {emptyLibrary ? (
            <>
              <button className="primary-action" type="button" onClick={onChooseImport}>
                <FileArrowUp size={20} weight="bold" />
                导入题库文件
              </button>
              <button className="secondary-action" type="button" onClick={() => onShowLibrary()}>
                <BookOpen size={19} weight="bold" />
                查看导入格式
              </button>
            </>
          ) : (
            <>
              <button className="primary-action" type="button" onClick={onDraw} disabled={unavailable}>
                <Cards size={20} weight="fill" />
                {unavailable ? "暂无可抽题目" : "抽一道题"}
              </button>
              {current ? (
                <button className="secondary-action" type="button" onClick={() => onOpenQuestion(current)}>
                  <ArrowSquareOut size={19} weight="bold" />
                  在力扣打开
                </button>
              ) : (
                <button className="secondary-action" type="button" onClick={() => onShowLibrary()}>
                  <BookOpen size={19} weight="bold" />
                  查看题库
                </button>
              )}
            </>
          )}
        </div>

        <div className="metrics" aria-label="题库统计">
          <Metric label="题库总数" value={total} />
          <Metric label="冷却中" value={cooling} />
          <Metric label="已抽覆盖" value={`${progress}%`} />
        </div>
      </section>

      <aside className="draw-sidebar">
        <section className="sidebar-panel draw-library-panel liquid-glass-web-approx">
          <section className="overview-section">
            <div className="panel-heading">
              <div>
                <span className="section-kicker">题库概览</span>
                <h2>按难度浏览</h2>
              </div>
              <button className="primary-compact overview-import" type="button" onClick={onChooseImport}>
                <FileArrowUp size={17} weight="bold" />
                导入 JSON
              </button>
            </div>
            <div className="difficulty-grid">
              {DIFFICULTIES.map((difficulty) => (
                <button className={`difficulty-card ${diffClass(difficulty)}`} type="button" key={difficulty} onClick={() => onShowLibrary(difficulty)}>
                  <DifficultyGlyph difficulty={difficulty} />
                  <span>{difficulty}</span>
                  <strong>{difficultyCounts[difficulty]}</strong>
                  <small>道题</small>
                </button>
              ))}
            </div>
          </section>

          <section className="integrated-history">
            <div className="panel-heading">
              <div>
                <span className="section-kicker">最近抽取</span>
                <h2>抽题记录</h2>
              </div>
              <span className="count-label">{history.length}</span>
            </div>
            <div className="history-list">
              {history.length === 0 ? (
                <p className="empty-list">抽过的题目会显示在这里。</p>
              ) : (
                history.slice(0, 5).map((record) => <HistoryItem key={`${record.id}-${record.ts}`} record={record} today={today} />)
              )}
            </div>
            {history.length > 0 && (
              <button className={`reset-button ${resetConfirming ? "confirming" : ""}`} type="button" onClick={onClearHistory}>
                <ArrowClockwise size={16} weight="bold" />
                {resetConfirming ? "再次点击确认清空" : "清空抽题记录"}
              </button>
            )}
          </section>
        </section>
      </aside>
    </div>
  );
}

function LibraryView({
  allQuestionCount,
  difficultyCounts,
  groups,
  filter,
  query,
  importReport,
  onChooseImport,
  onCopyPrompt,
  onSaveExample,
  onClearImportReport,
  onFilterChange,
  onQueryChange,
  onRemoveQuestion,
  onOpenQuestion
}: {
  allQuestionCount: number;
  difficultyCounts: Record<Difficulty, number>;
  groups: Array<{ difficulty: Difficulty; questions: Question[] }>;
  filter: LibraryFilter;
  query: string;
  importReport: ImportReport | null;
  onChooseImport: () => void;
  onCopyPrompt: () => void;
  onSaveExample: () => void;
  onClearImportReport: () => void;
  onFilterChange: (value: LibraryFilter) => void;
  onQueryChange: (value: string) => void;
  onRemoveQuestion: (question: Question) => void;
  onOpenQuestion: (question: Question) => void;
}) {
  const matchingCount = groups.reduce((total, group) => total + group.questions.length, 0);

  return (
    <div className="library-layout">
      <section className="library-panel liquid-glass-web-approx">
        <div className="section-heading library-heading">
          <div>
            <span className="section-kicker">我的题库</span>
            <h2>{allQuestionCount === 0 ? "从第一道题开始" : `共 ${allQuestionCount} 道题目`}</h2>
            <p>按难度查看、搜索和维护你的题目；每道题都会保留力扣官网原始题号。</p>
          </div>
          <button className="primary-compact" type="button" onClick={onChooseImport}>
            <FileArrowUp size={18} weight="bold" />
            导入题库
          </button>
        </div>

        <div className="library-toolbar">
          <label className="search-field">
            <MagnifyingGlass size={19} weight="bold" />
            <input value={query} placeholder="搜索力扣题号或题目名称" onChange={(event) => onQueryChange(event.target.value)} />
          </label>
          <div className="filter-group" role="group" aria-label="按难度筛选">
            <button className={filter === "全部" ? "active" : ""} type="button" onClick={() => onFilterChange("全部")}>全部 <span>{allQuestionCount}</span></button>
            {DIFFICULTIES.map((difficulty) => (
              <button className={`${filter === difficulty ? "active" : ""} ${diffClass(difficulty)}`} type="button" key={difficulty} onClick={() => onFilterChange(difficulty)}>
                {difficulty} <span>{difficultyCounts[difficulty]}</span>
              </button>
            ))}
          </div>
        </div>

        {importReport && <ImportReportCard report={importReport} onClose={onClearImportReport} />}

        {allQuestionCount === 0 ? (
          <div className="library-empty-shell">
            <EmptyLibrary onChooseImport={onChooseImport} />
            <section className="empty-library-footer" aria-label="空题库归档预览">
              <p>导入后自动归档</p>
              <div className="empty-library-categories" role="list" aria-label="导入后的难度归档">
                {DIFFICULTIES.map((difficulty) => (
                  <span className={`empty-library-category ${diffClass(difficulty)}`} key={difficulty} role="listitem">
                    <DifficultyGlyph difficulty={difficulty} />
                    {difficulty}
                  </span>
                ))}
              </div>
            </section>
          </div>
        ) : matchingCount === 0 ? (
          <div className="no-results">
            <MagnifyingGlass size={28} weight="duotone" />
            <strong>没有找到匹配的题目</strong>
            <span>试试修改搜索内容，或切换难度筛选。</span>
          </div>
        ) : (
          <div className="question-groups">
            {groups.map(({ difficulty, questions }) => (
              <section className="question-group" key={difficulty}>
                <div className="group-heading">
                  <span className={`badge ${diffClass(difficulty)}`}>{difficulty}</span>
                  <span>{questions.length} 道</span>
                </div>
                {questions.length === 0 ? (
                  <p className="group-empty">此分类没有符合筛选条件的题目。</p>
                ) : (
                  <div className="question-list">
                    {questions.map((question) => (
                      <article className="question-row" key={question.id}>
                        <button className="question-open" type="button" onClick={() => onOpenQuestion(question)} aria-label={`在力扣中定位原题第 ${question.lc} 题：${question.name}`}>
                          <span className="question-number" aria-label={`力扣官方题号 ${question.lc}`}>
                            <small>力扣原题</small>
                            <b>#{question.lc}</b>
                          </span>
                          <strong>
                            <span className="question-name">{question.name}</span>
                            <small>LeetCode 官方题号</small>
                          </strong>
                          <ArrowSquareOut size={17} weight="bold" aria-hidden="true" />
                        </button>
                        <button className="remove-button" type="button" onClick={() => onRemoveQuestion(question)} aria-label={`从题库移出 ${question.name}`} title="移出题库">
                          <Trash size={17} weight="bold" />
                        </button>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
      </section>

      <aside className="import-panel liquid-glass-web-approx">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">题单转换</span>
            <h2>让大模型整理题库</h2>
          </div>
        </div>
        <p className="import-intro">把题目网站的截图或文本发给任意大模型。模型会按固定 JSON 格式整理力扣官网原题号、题名和难度，然后将生成的文件导入这里。</p>
        <div className="model-flow" aria-label="题库导入流程">
          <span>提供题目截图或文本</span>
          <span>让模型输出题库 JSON</span>
          <span>选择生成的 .json 文件</span>
        </div>
        <div className="conversion-actions">
          <button className="primary-action" type="button" onClick={onChooseImport}>
            <FileArrowUp size={18} weight="bold" />
            选择题库 JSON 文件
          </button>
          <button className="secondary-action" type="button" onClick={onCopyPrompt}>
            <ClipboardText size={18} weight="bold" />
            复制给大模型的提示词
          </button>
        </div>
        <section className="format-guide">
          <h3>固定文件格式</h3>
          <p><b>leetcodeId</b> 是力扣官网原始题号。文件根对象、格式标识和版本均会校验；保存为 <b>.json</b> 文件后即可导入。</p>
          <pre><code>{QUESTION_LIBRARY_EXAMPLE}</code></pre>
          <button className="example-download" type="button" onClick={onSaveExample}>
            <BookOpen size={17} weight="bold" />
            下载完整三题示例 JSON
          </button>
        </section>
      </aside>
    </div>
  );
}

function EmptyLibrary({ onChooseImport }: { onChooseImport: () => void }) {
  return (
    <div className="library-empty-state">
      <span className="empty-icon"><BookOpen size={35} weight="duotone" /></span>
      <h3>题库暂时为空</h3>
      <p>将题目截图或文本交给大模型，生成 LeetCode Draw JSON 文件后导入。导入后即可按难度分类浏览和随机抽题。</p>
      <button className="primary-compact" type="button" onClick={onChooseImport}>
        <FileArrowUp size={18} weight="bold" />
        选择 JSON 题库文件
      </button>
    </div>
  );
}

function ImportReportCard({ report, onClose }: { report: ImportReport; onClose: () => void }) {
  const issueLabel = report.issues.length === 0 ? "全部题目已通过校验" : `${report.issues.length} 行未导入`;

  return (
    <section className={`import-report ${report.added > 0 ? "success" : "warning"}`} aria-live="polite">
      <div className="report-icon"><CheckCircle size={22} weight="fill" /></div>
      <div className="report-copy">
        <strong>{report.added > 0 ? `已导入 ${report.added} 道题目` : "没有导入新题目"}</strong>
        <span>{report.fileName} · {report.format.toUpperCase()} · {issueLabel}</span>
        {report.issues.length > 0 && (
          <ul>
            {report.issues.slice(0, 3).map((issue, index) => <li key={`${issue.row}-${index}`}>{issue.row > 0 ? `第 ${issue.row} 行：` : ""}{issue.message}</li>)}
            {report.issues.length > 3 && <li>其余 {report.issues.length - 3} 个问题未展开。</li>}
          </ul>
        )}
      </div>
      <button className="icon-button" type="button" onClick={onClose} aria-label="关闭导入结果">
        <X size={18} weight="bold" />
      </button>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function HistoryItem({ record, today }: { record: DrawRecord; today: string }) {
  const diffMs = new Date(`${today}T00:00:00`).getTime() - new Date(`${record.date}T00:00:00`).getTime();
  const days = Math.round(diffMs / 86400000);
  const remain = Math.max(0, 5 - days);
  const free = remain === 0;

  return (
    <article className="history-item">
      <div>
        <strong>{record.name}</strong>
        <span>力扣原题 #{record.lc} · {record.date}</span>
      </div>
      <span className={`cooldown ${free ? "free" : ""}`}>{free ? "已解冻" : `冷却 ${remain} 天`}</span>
    </article>
  );
}

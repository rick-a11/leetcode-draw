import { useEffect, useRef } from "react";
import { BookOpen, ClipboardText, FileArrowUp, WarningCircle, X } from "@phosphor-icons/react";
import { QUESTION_LIBRARY_EXAMPLE } from "../lib/importContent";
import type { ImportReport } from "../lib/types";

type ImportDrawerProps = {
  open: boolean;
  report: ImportReport | null;
  onClose: () => void;
  onChooseImport: () => void;
  onCopyPrompt: () => void;
  onSaveExample: () => void;
};

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "summary",
  "a[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])"
].join(",");

export function ImportDrawer({
  open,
  report,
  onClose,
  onChooseImport,
  onCopyPrompt,
  onSaveExample
}: ImportDrawerProps) {
  const drawerRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab") return;
      const focusable = Array.from(
        drawerRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []
      );
      if (focusable.length === 0) return;

      const activeIndex = focusable.indexOf(document.activeElement as HTMLElement);
      const shouldWrapBackward = event.shiftKey && activeIndex <= 0;
      const shouldWrapForward = !event.shiftKey && activeIndex === focusable.length - 1;

      if (shouldWrapBackward || shouldWrapForward || activeIndex === -1) {
        event.preventDefault();
        const next = event.shiftKey ? focusable.at(-1) : focusable[0];
        next?.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="import-drawer-layer">
      <button
        className="import-drawer-backdrop"
        type="button"
        tabIndex={-1}
        aria-label="关闭导入题库面板"
        onClick={onClose}
      />
      <aside
        ref={drawerRef}
        className="import-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-drawer-title"
      >
        <header className="drawer-header">
          <div>
            <span className="section-kicker">导入入口</span>
            <h2 id="import-drawer-title">导入题库</h2>
          </div>
          <button
            ref={closeButtonRef}
            className="icon-button drawer-close"
            type="button"
            onClick={onClose}
            aria-label="关闭导入题库"
          >
            <X size={18} weight="bold" />
          </button>
        </header>

        <p className="import-intro">选择 JSON 文件，或先复制提示词交给大模型整理题单。</p>

        {report?.added === 0 && <DrawerImportError report={report} />}

        <div className="drawer-actions">
          <button className="primary-action" type="button" onClick={onChooseImport}>
            <FileArrowUp size={18} weight="bold" />
            选择 JSON 题库文件
          </button>
          <button className="secondary-action" type="button" onClick={onCopyPrompt}>
            <ClipboardText size={18} weight="bold" />
            复制给大模型的提示词
          </button>
        </div>

        <details className="format-disclosure">
          <summary>查看固定 JSON 文件格式</summary>
          <p><b>leetcodeId</b> 是力扣官网原始题号。保存为 <b>.json</b> 文件后即可导入。</p>
          <pre><code>{QUESTION_LIBRARY_EXAMPLE}</code></pre>
        </details>

        <button className="example-download" type="button" onClick={onSaveExample}>
          <BookOpen size={17} weight="bold" />
          下载完整三题示例 JSON
        </button>
      </aside>
    </div>
  );
}

function DrawerImportError({ report }: { report: ImportReport }) {
  return (
    <section className="drawer-import-report" aria-live="assertive">
      <WarningCircle size={22} weight="fill" aria-hidden="true" />
      <div>
        <strong>没有可导入的有效题目，请检查文件格式</strong>
        <span>{report.fileName} · {report.format.toUpperCase()}</span>
        {report.issues.length > 0 && (
          <ul>
            {report.issues.slice(0, 3).map((issue, index) => (
              <li key={`${issue.row}-${index}`}>
                {issue.row > 0 ? `第 ${issue.row} 行：` : ""}{issue.message}
              </li>
            ))}
            {report.issues.length > 3 && <li>其余 {report.issues.length - 3} 个问题未展开。</li>}
          </ul>
        )}
      </div>
    </section>
  );
}

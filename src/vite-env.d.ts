/// <reference types="vite/client" />

interface LeetCodeDrawBridge {
  getState: () => Promise<unknown>;
  setState: (value: unknown) => Promise<boolean>;
  openLeetCode: (url: string) => Promise<boolean>;
  chooseImportFile: () => Promise<{ name: string; content: string; error?: never } | { error: string; name?: never; content?: never } | null>;
  saveExampleFile: () => Promise<{ name: string; error?: never } | { error: string; name?: never } | null>;
  copyText: (value: string) => Promise<boolean>;
  setAppearance: (value: "system" | "light" | "dark") => Promise<boolean>;
}

interface Window {
  leetcodeDraw?: LeetCodeDrawBridge;
}

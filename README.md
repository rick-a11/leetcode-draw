# LeetCode Draw

LeetCode Draw is a local-first macOS desktop app for turning a personal practice list into a calm, randomly drawable question library. It starts with zero questions and uses a simple JSON import format instead of asking you to hand-enter a list.

The interface supports light, dark, and system appearance modes, warm liquid-glass styling, adaptive Dock icons, difficulty browsing, and a tarot-inspired draw animation.

> This is an independent study tool. It is not affiliated with or endorsed by LeetCode.

## What it does

- Starts empty: a fresh installation has **0** questions available to draw.
- Imports a question library from a validated JSON file (up to 2 MB).
- Shows your library by **简单 / 中等 / 困难**, with the original LeetCode problem number on every item.
- Searches, opens the matching LeetCode China problem page on demand, and removes individual questions.
- Randomly draws from the available pool; drawn questions enter a five-day cooldown.
- Keeps a local draw history, import report, theme preference, and custom library between launches.
- Includes a complete, safe three-question sample library (`#1`, `#2`, and `#42`).

## Privacy

Your personal question library is private by design.

- There is no account system, telemetry, cloud sync, or application server.
- Imported JSON files are read locally through the native file picker; your question list and draw history are stored only in the operating system's local application-data area.
- The app opens `leetcode.cn` only when you explicitly choose to open a question; it never sends your library or history there.
- This repository contains only a generic three-question example. Do not commit a real imported library to a fork or issue; keep private exports outside the source tree (or inside the ignored `private/` folder).

## Import a library

The intended flow is: give a practice-site screenshot or text to a large language model, ask it to produce the JSON below, save the answer as a `.json` file, and import it in LeetCode Draw. You never need to type questions into the app one by one.

```json
{
  "format": "leetcode-draw/question-library",
  "version": 1,
  "questions": [
    {
      "leetcodeId": 1,
      "name": "两数之和",
      "difficulty": "简单"
    },
    {
      "leetcodeId": 2,
      "name": "两数相加",
      "difficulty": "中等"
    },
    {
      "leetcodeId": 42,
      "name": "接雨水",
      "difficulty": "困难"
    }
  ]
}
```

`difficulty` must be `简单`, `中等`, or `困难`. The app also accepts the legacy `lc` field for existing libraries, but new files should use `leetcodeId`. A ready-to-import copy is available at [resources/examples/leetcode-draw-example.json](resources/examples/leetcode-draw-example.json).

## Develop

Requirements: macOS and Node.js 20 or later.

```bash
npm ci
npm test
npm run build
npm run electron:dev
```

Create a macOS DMG after the tests and build succeed:

```bash
npm run dist
```

The app uses Electron, React, TypeScript, Vite, and `electron-store`. The generated release, build output, dependencies, and local private-library folder are intentionally excluded from version control.

## License

[MIT](LICENSE)

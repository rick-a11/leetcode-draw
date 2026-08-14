# LeetCode Draw

LeetCode Draw is a local-first macOS desktop app that turns a personal LeetCode practice list into a calm, randomly drawable question library. A new installation starts with **zero questions**. Instead of entering questions one at a time, use any large language model to convert a screenshot or text export into one validated JSON file, then import that file into the app.

The interface combines a warm light theme, a true dark theme, and an optional system setting with a liquid-glass treatment and a tarot-inspired draw animation.

[View the light-mode app preview →](docs/images/app-overview-light.jpg)

*A fresh installation: zero questions, no draw history, and one JSON import away from a personal practice library. The empty-card light gently breathes in the app and settles to a still composition when macOS Reduce Motion is enabled.*

> LeetCode Draw is an independent study tool. It is not affiliated with or endorsed by LeetCode.

## Highlights

- **Start empty.** A fresh installation has no built-in question library and nothing available to draw.
- **Import once, not one-by-one.** Import a validated JSON library created from a practice-site screenshot or text.
- **Keep the official reference.** Every item preserves its original LeetCode problem number.
- **Browse by difficulty.** View counts and questions in 简单, 中等, and 困难 categories.
- **Draw with a cooldown.** A drawn question is held out of the pool for five days, making repeated draws more useful.
- **Review locally.** Search the library, inspect recent draws, remove an individual imported question, and open the matching LeetCode China search result when you choose to.
- **Choose your appearance.** Select Light, Dark, or System appearance; the Dock icon follows the active light or dark presentation.
- **Get useful import feedback.** Invalid or duplicate rows are reported while valid rows still import.

## Privacy by design

Your study library stays on your Mac.

- No account system, telemetry, cloud sync, analytics, or application server.
- Imported JSON is read locally through the native file picker. The library, draw history, import report, and theme setting remain in local application data.
- The app opens `leetcode.cn` only after you explicitly choose to open a question. It never sends your library or draw history there.
- This repository intentionally contains only a generic three-question sample. Do not commit a real library to a fork, issue, or pull request. Keep private exports outside the source tree or inside the ignored `private/` folder.

If you choose to give a screenshot or text list to an external model for conversion, that is a separate choice made outside LeetCode Draw. Review that service's privacy policy before sharing your material.

## Import a question library

1. Give a screenshot or text list from your practice site to a large language model.
2. Ask it to return **only** a JSON file matching the schema below. Do not ask it to add explanations or Markdown fences.
3. Save the result as a `.json` file.
4. In LeetCode Draw, choose **Import JSON** and select that file.

You can use this prompt with a model:

> Convert the supplied question list into the exact LeetCode Draw JSON format below. Preserve each official LeetCode problem number, title, and difficulty. Use only `简单`, `中等`, or `困难` for `difficulty`. Return JSON only; do not add Markdown or commentary.

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

### Format rules

- The root fields must be exactly `format: "leetcode-draw/question-library"` and `version: 1`.
- `questions` must be an array of question objects.
- Each question needs `leetcodeId`, `name`, and `difficulty`.
- `leetcodeId` is the official positive LeetCode problem number and is used to keep entries traceable.
- `difficulty` must be one of `简单`, `中等`, or `困难`.
- Files are limited to 2 MB. The legacy `lc` field remains readable for existing libraries, but new files should use `leetcodeId`.

The repository includes a safe, ready-to-import example: [resources/examples/leetcode-draw-example.json](resources/examples/leetcode-draw-example.json).

## Run locally

### Requirements

- macOS
- Node.js 20 or later

```bash
npm ci
npm test
npm run build
npm run electron:dev
```

## Package a macOS app

Create a DMG after the tests and production build pass:

```bash
npm run dist
```

The result is written to `release/LeetCode-Draw-<version>-arm64.dmg`. The local build uses an ad-hoc macOS signature so the complete bundle can be integrity-checked on the build machine. It is not an Apple Developer ID or notarized distribution; maintainers distributing builds to other people should configure their own Developer ID signing and notarization.

## Quality checks

`npm test` covers the import format, duplicate and invalid-row handling, the three-question sample, cooldown behavior, theme behavior, and the main import/draw flow. `npm run build` also checks the Electron bridge and packaged assets before a DMG is created.

## Technology

Electron, React, TypeScript, Vite, Vitest, and `electron-store`.

## License

[MIT](LICENSE)

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

Pre-scaffolding. The repo currently contains only `README.md` and has zero commits. There is no source code, no package manifest, no build/test/lint tooling, and no `.cursor/rules`, `.cursorrules`, or `.github/copilot-instructions.md`. When the first scaffolding lands (likely a WeChat Mini Program project structure under the repo root), update this file with real commands and an architecture section.

## Product goal

A WeChat Mini Program that lets pet owners book appointments at pet daycare homes — view available time slots, select services, and confirm appointments inside the WeChat client. See [README.md](README.md) for the full pitch (bilingual: English + 中文).

## Expected tech stack (per README, not yet committed)

- **Frontend (in-WeChat):** WXML for structure, WXSS for styles, JavaScript or TypeScript for logic. No DOM — components and APIs are WeChat-provided (`<view>`, `<button>`, `wx.*`).
- **Backend:** open choice — Node.js, PHP, Java, Python, or WeChat Cloud Development (serverless cloud functions written in JS). Any backend must expose JSON endpoints the Mini Program can call.
- **Tooling:** official 微信开发者工具 (WeChat Developer Tools) for develop / debug / preview / upload. Cross-platform frameworks like Uni-app (Vue) or Taro (React/Vue) are options but not committed to.

The backend choice (custom server vs. WeChat Cloud) is a foundational decision that hasn't been made yet — surface it before generating backend code.

## Notes for the first scaffolding pass

- Decide and record: TS vs JS, native Mini Program vs Uni-app/Taro, custom backend vs WeChat Cloud.
- A WeChat Mini Program project needs `app.json`, `app.js`, `app.wxss`, and a `pages/` tree at minimum — that's the signal scaffolding has started.
- Once scaffolded, replace this section with: install/build/run commands, how to open the project in WeChat Developer Tools, how to run a single test, and the page/component/service layout.

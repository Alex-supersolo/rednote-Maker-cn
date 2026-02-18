# Project Status

Last Updated: 2026-02-18

## Overview
- Project: RedNote Maker
- Goal: Convert long text into Xiaohongshu-style slides with editing and ZIP export.
- Runtime: React + Vite frontend, Express backend.

## Current Progress
- Done: DeepSeek-based generation pipeline (`DEEPSEEK_API_KEY`) wired in backend API.
- Done: Slide editing UI (add/delete slides, paragraph edits, branding controls).
- Done: Cover styles and content renderer.
- Done: ZIP export workflow with improved font/image readiness before capture.
- Done: Markdown support in content rendering:
  - headings (`#`, `##`, `###`)
  - bold/italic/bold-italic/strikethrough
  - inline code, code blocks
  - blockquote
  - ordered/unordered lists
  - links
  - horizontal rules
  - table-like markdown block rendering
- Done: Pagination robustness improvements:
  - measured pagination in browser
  - stronger safety buffer for bottom overflow
  - post-generation overflow correction pass to push trailing content to next page

## Verified
- Local build passes.
- Local run passes.
- Server deployment passed:
  - app online in PM2
  - `curl -I http://127.0.0.1:3000` => `200 OK`

## Known Notes
- Build warns about `/index.css` missing at build time (non-blocking currently).
- Keep `.env.local` on server with valid `DEEPSEEK_API_KEY`.


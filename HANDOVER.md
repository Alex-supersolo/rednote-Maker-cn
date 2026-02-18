# Handover Notes

## Product Intent
- Turn long-form text into editable Xiaohongshu slide cards.
- Keep output visually stable for preview and export.

## Key Files
- Frontend shell: `/Users/yalin/AICoder/rednote-maker/App.tsx`
- Slide renderer: `/Users/yalin/AICoder/rednote-maker/components/SlideRenderer.tsx`
- Generation + pagination: `/Users/yalin/AICoder/rednote-maker/services/geminiService.ts`
- Backend API: `/Users/yalin/AICoder/rednote-maker/server.js`

## Important Decisions
- AI provider is DeepSeek. Use `DEEPSEEK_API_KEY`.
- Export uses html-to-image + JSZip.
- Pagination uses measured layout with overflow correction.

## Common Pitfalls
- Bottom text cut-off can happen if pagination and render differ; current code includes a correction pass.
- External fonts can cause render mismatch during export; current stack favors local/system fonts.
- Server pull from GitHub may fail in CN region; mirror URL may be required.

## Fast Resume Prompt
When starting a new session, use:
- "Read `PROJECT_STATUS.md` and `HANDOVER.md`, then continue with <task>."


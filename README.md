<!--
  Minimalist Pomato README - aesthetic with badges
-->
# P🍅mato Timer

[![Framework: Vue 3](https://img.shields.io/badge/Framework-Vue%203-41B883?logo=vue&logoColor=white)](https://vuejs.org/)
[![Charting: Chart.js](https://img.shields.io/badge/Chart.js-3.9.1-FBAE17?logo=chart.js&logoColor=white)](https://www.chartjs.org/)
[![Storage: localStorage](https://img.shields.io/badge/Storage-localStorage-563D7C?logo=html5&logoColor=white)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Yet another, minimalist, elegant Pomodoro web app, no build step, just static files. Clean UI, session logging, and tiny analytics (charts) designed for fast focus sessions and easy deployment (Cloudflare Pages friendly).

## Demo

- Open `index.html` in your browser or serve the folder with a static server (see Quick Start).

## Features

- Focus timer with Work / Short Break / Long Break
- Pause / Resume merging into single activity entries
- Activity logging with per-segment timestamps and total elapsed
- Dashboard with daily and session charts (Chart.js)
- Settings modal with persistence via `localStorage`
- Minimal, responsive UI — optimized for distraction-free use

## Quick Start

Open the app locally (two options):

1) Double-click `index.html` (works in most browsers)

2) Or run a tiny static server (recommended for local testing):

```bash
# from project root
python3 -m http.server 8000
# then open http://localhost:8000
```

## Deploy

- Push this repository to GitHub and connect it to Cloudflare Pages (or Netlify). It's a static site — no build step required.
- Cloudflare Pages: choose your repo, set the build settings to "No build command" and the folder to `/`.

## Configuration

- Settings are stored in `localStorage` under the key `pomodoroSettings`.
- Activities are stored under `pomodoroActivities` (array of activity objects).

Important settings keys:
- `title` — a human label used in logs (does not change the Work tab label)
- `work`, `shortBreak`, `longBreak` — durations in minutes
- `autoStart`, `notifications`, `sound` — booleans
- `sessionsBeforeLong` — number of work sessions before a long break

## Data model (summary)

Each activity looks like:

```json
{
  "mode": "Work",
  "title": "Deep Focus",
  "start": "2025-11-27T12:00:00.000Z",
  "end": "2025-11-27T12:25:00.000Z",
  "segments": [ { "start": "...", "end": "...", "elapsed": 300 }, ... ],
  "elapsed": 1500,
  "completed": true
}
```

## File Layout

- `index.html` — main UI and modals
- `css/style.css` — styles and responsive rules
- `js/app.js` — Vue app, timer logic, persistence, charts
- `lib/` — local vendor libs (Vue, Chart.js)
- `sounds/ting.mp3` — notification sound

## Tips

- If you want titles to be visible under the timer during Work sessions, edit the `settings.title` in the Settings modal.
- Charts auto-refresh when opening the Dashboard modal.

## Contributing

Small, focused changes welcome. Open an issue or PR for feature requests (heatmap, export, or segment merging enhancements).

## License

MIT — see `LICENSE`.

---

Minimal, usable, and ready for deployment.

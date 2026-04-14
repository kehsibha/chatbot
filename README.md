# ✅ GTD

A single-user Streamlit app that operationalizes David Allen's **Getting Things
Done** methodology: capture, clarify, organize, reflect, engage.

Data lives in a local SQLite database (`gtd.db`) so it works offline and has no
external dependencies beyond Streamlit itself.

## Features

- **📥 Capture** — Frictionless quick-add. Paste multiple lines to capture in bulk.
- **🔍 Clarify** — One-at-a-time inbox processor with the 2-minute rule, new-project creation, waiting-for, someday, reference, and trash.
- **✅ Next Actions** — Filter by context (`@computer`, `@phone`, …).
- **📁 Projects** — Each project surfaces a warning if it lacks a defined next action.
- **⏳ Waiting For** — Track delegated items with follow-up dates.
- **💭 Someday / Reference** — Parking lot for later + a lightweight reference shelf.
- **🔄 Weekly Review** — Guided checklist with stale-project detection and a review log.

## Running it

```bash
pip install -r requirements.txt
streamlit run streamlit_app.py
```

The database is created automatically on first launch. To use a different path,
set the `GTD_DB_PATH` environment variable.

## Project structure

```
streamlit_app.py   # UI (tabbed Streamlit app)
gtd/db.py          # SQLite schema + data access helpers
docs/SPEC.md       # Design spec for the system
```

## Spec

See [`docs/SPEC.md`](docs/SPEC.md) for the full design spec, including the data
model, functional requirements, and MVP scope.

# Hoo's Closest Major

Upload a UVA unofficial transcript and see which College of Arts & Sciences majors and minors you're closest to finishing. Programs are ranked by credits and courses left, including prerequisites you still need before you can declare.

The transcript is read entirely in the browser with [pdf.js](https://mozilla.github.io/pdf.js/). Nothing is uploaded.

Unofficial planning tool. Not affiliated with the University of Virginia.

## How it works

| File | What it is |
| --- | --- |
| `index.html` | The page, with all styles |
| `app.js` | UI: upload, course list, ranking, details, problem reports |
| `engine.js` | Transcript parser (handles SIS's two-column PDF) and requirement matcher |
| `programs.json` | Built requirement data for 123 A&S programs (generated, don't edit by hand) |
| `courses.json` | Course titles, credits and terms offered, from [UVA Course Explorer](https://github.com/UVA-Course-Explorer) |
| `data/research/batch-*.json` | Source requirement data, one array of programs per file |
| `data/research/patches*.json` | Additive fixes, e.g. previously approved courses |
| `data/research/SCHEMA.md` | The requirement format |

## Editing requirements

1. Edit a program in `data/research/batch-*.json`, or add courses to a group in `data/research/patches.json`:
   ```json
   { "cognitive-science-ba": { "Area: Philosophy": { "addFrom": ["PHIL 3010"] } } }
   ```
2. Rebuild: `python3 scripts/merge.py`
3. Commit and push. Vercel redeploys automatically.

To refresh course titles and terms: `python3 scripts/build_courses.py 1262:Sp26 1268:Fa26 1272:Sp27`.

## Running locally

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

Tests (need Node and, for the UI test, Playwright):

```bash
npm install
node tests/parse_test.js path/to/transcript.pdf   # prints parsed courses
node tests/eval_test.js path/to/transcript.pdf    # ranks every program
node tests/ui_test.js path/to/transcript.pdf      # renders the page and screenshots it
```

## Data caveats

Requirements come from department websites. The 2026–27 Undergraduate Record could not be read automatically, so programs haven't been checked line by line against it. Programs tagged "Rough estimate" on the site (Math, Drama, Dance) are built from each department's credit structure.

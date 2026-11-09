# Program requirement schema (UVA College of Arts & Sciences)

Write ONE JSON file per batch: an array of program objects.

```json
{
  "id": "biology-ba",                 // kebab-case, unique; minors end in "-minor"
  "name": "Biology",
  "degree": "B.A.",                   // "B.A." | "B.S." | "Minor"
  "type": "major",                    // "major" | "minor"
  "department": "Biology",
  "totalCredits": 32,                 // credits the program itself requires (not counting prerequisites unless the Record counts them); null if unclear
  "sources": ["https://..."],         // pages you actually read
  "declaration": {                    // what must be done BEFORE declaring / to be admitted. omit or [] if nothing
    "requirements": [ <group>, ... ],
    "minGPA": 2.0,                    // null if none
    "notes": "e.g. application required in spring of 2nd year"
  },
  "requirements": [ <group>, ... ],   // the program's requirements, in the order the Record lists them
  "notes": "short caveats: grade minimums, max transfer/AP credits, double-count limits, things not modelled"
}
```

## Group

```json
{
  "label": "Introductory chemistry",
  "need": { "courses": 2 },           // OR { "credits": 12 } OR { "all": true }
  "from": [ "CHEM 1410|CHEM 1810", "CHEM 1420|CHEM 1820", "BIOL 3000-4999", "STAT *" ],
  "exclude": [ "BIOL 4995" ],         // optional
  "sets": [ ["CHEM 1410","CHEM 1420"], ["CHEM 1810","CHEM 1820"] ],  // optional, see below
  "children": [ <group>, ... ],       // optional nested groups (all must be satisfied)
  "note": "optional free text"
}
```

### Course patterns (strings inside `from`, `exclude`, `sets`)
- `"BIOL 2100"` exact course (SUBJECT space 4-digit number, use current UVA numbering).
- `"CHEM 1410|CHEM 1810"` equivalents: any one of them counts as this ONE slot.
- `"BIOL 3000-4999"` any course in the subject in that numeric range.
- `"BIOL 3000+"` any course numbered ≥ 3000 in the subject.
- `"BIOL *"` any course in the subject.

### `need` semantics
- `{"all": true}`: every entry in `from` must be satisfied (each `|` entry is one slot).
- `{"courses": N}`: N distinct courses matching any entry of `from`.
- `{"credits": N}`: N credit hours of courses matching `from`.
- With `sets`: the group is satisfied by completing ANY ONE of the sets entirely (use for "either sequence A or sequence B"). Leave `need` as `{"all": true}` and `from` empty.
- With `children`: the group is satisfied when every child is satisfied (use for tracks inside a requirement).

### Rules of thumb
- Encode the CURRENT (2026–2027, or the latest available) Undergraduate Record. Use catalog `catoid=72` (2026-27) on records.ureg.virginia.edu when you can find it; otherwise the newest catalog plus the department site.
- Put gateway / prerequisite courses that must be finished before declaring in `declaration.requirements`. If they ALSO count toward the major, put them in `requirements` too.
- If a requirement is "N electives from a long list", list the subjects/ranges and the explicit courses you can find. Prefer ranges like `"HIST 3000-4999"` over omitting the rule.
- Distribution requirements across sub-areas ("one course from each of areas A, B, C") → one group per area with need courses 1.
- For things that cannot be checked from a transcript (portfolio, thesis approval, language proficiency exam), add a group with `"need": {"courses": 1}` and an appropriate `from` if a course satisfies it, otherwise mention it in `notes`.
- Language majors: AP/placement often waives lower-level courses; encode the course path and say so in notes.
- Use real course numbers. Do not invent courses. If unsure, put the uncertainty in `notes`.
- For majors with concentrations, encode the base major; add concentration-only requirements to `notes` (do not create separate programs) unless the concentration is a separate degree.

## Course prerequisites (top-level, optional but wanted)
```json
"coursePrereqs": { "CHEM 2410": ["CHEM 1420|CHEM 1820"], "BIOL 3010": ["BIOL 2100", "BIOL 2200"] }
```
For the core/required courses of the program (not every elective), list each course's prerequisites as an array of slots (all slots required; `|` = alternatives). Only include what a catalog or course description actually states. This lets the site warn a student that a remaining course has an unmet prerequisite.

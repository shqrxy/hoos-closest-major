# Engineering (SEAS) program encoding notes

Use the same schema as ../SCHEMA.md with these additions:

- Add `"school": "SEAS"` to every program.
- **Majors encode the WHOLE B.S. degree**, not just the department courses, because a student comparing engineering majors needs to know everything left. Use the department's official curriculum sheet / 4-year plan / degree checklist (usually a PDF on the department site) for the current year (2026-27 or newest).
  `totalCredits` = total credits for the degree (e.g. 128).
- Standard groups to include (adjust per department's sheet; departments differ, e.g. CHEM 1410 vs CHEM 1610, required APMA 3100 vs 3110, etc.):
  - "Engineering mathematics": e.g. APMA 1090|MATH 1310, APMA 1110|MATH 1320, APMA 2120|MATH 2310, APMA 2130|MATH 3250, plus the major's probability/statistics or linear algebra course.
  - "Chemistry", "Physics": e.g. CHEM 1410|CHEM 1610 with lab CHEM 1411|CHEM 1611; PHYS 1425 + PHYS 1429, PHYS 2415 + PHYS 2419.
  - "Engineering foundations": ENGR 1010, ENGR 1020 (or whatever the current first-year course numbers are).
  - "Computing": CS 1110|CS 1111|CS 1112|CS 1113 (plus any major-specific CS).
  - "Science, Technology and Society": STS 1500 (first-year), one STS 2000-3999 course, STS 4500, STS 4600 (check current numbers).
  - "Humanities and social sciences electives": need credits N, from subject wildcards (or "* *" if any HSS course counts) — note the restriction in `note`.
  - Major core courses (exact numbers), technical electives (need credits/courses from department ranges or lists), math/science electives, and "Unrestricted electives" with `"from": ["*"]`.
- `declaration`: what a student needs to declare/enter this major. Include: (a) for SEAS first-years, the requirements to declare the major (often completing first-year courses, sometimes minimum grades/GPA, CS has its own rules); and (b) in `notes`, that students in the College must apply via internal transfer to SEAS (state the internal-transfer course/GPA requirements if you find them).
- `coursePrereqs`: for core department courses where the department or course catalog states prerequisites.
- Minors: encode as usual (just the minor's courses). Note any restriction like "only open to SEAS students" in `notes`.
- Do not invent course numbers. Uncertainty goes in notes. Add `"confidence": "low"` when you could not find a course-level source.

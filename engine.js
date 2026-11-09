/* Pathfinder engine: transcript parsing + requirement matching.
   Runs in the browser (window.Engine) and in Node (module.exports). */
(function (root) {
  'use strict';

  // ---------- Transcript parsing ----------

  const GRADE_RE = '(A\\+|A-|A|B\\+|B-|B|C\\+|C-|C|D\\+|D-|D|F|CR|NC|W|WP|WF|IN|IP|INC|NG|AU|S|U|P|TE|PT|TR|OT|AP|IB|R|Y|X)';
  const COURSE_LINE = new RegExp(
    '^([A-Z]{2,5})\\s+(\\d{3,4}[A-Z]?)\\s+(.*?)\\s+(?:' + GRADE_RE + '\\s+)?(\\d{1,2}(?:\\.\\d{1,3})?)\\s*$'
  );
  const TERM_RE = /^(\d{4})\s+(Fall|Spring|Summer|January|Winter)\b/;
  const FAILING = new Set(['F', 'NC', 'W', 'WP', 'WF', 'U', 'NG', 'AU', 'INC', 'IN']);
  const TEST_GRADES = new Set(['TE', 'AP', 'IB']);
  const TRANSFER_GRADES = new Set(['PT', 'TR', 'OT']);

  /** Turn pdf.js text content of all pages into reading-order lines, handling 2-column layouts. */
  async function pdfToLines(pdf) {
    const all = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const vp = page.getViewport({ scale: 1 });
      const tc = await page.getTextContent();
      const items = tc.items
        .filter((it) => it.str && it.str.trim())
        .map((it) => ({ s: it.str, x: it.transform[4], y: it.transform[5], w: it.width || 0 }));
      all.push(...itemsToLines(items, vp.width));
    }
    return all;
  }

  function itemsToLines(items, pageWidth) {
    // Detect a second column: subject codes (e.g. "BIOL") that start well right of the left margin.
    const isNum = (s) => /^\d{3,4}[A-Z]?$/.test(s.trim());
    const subjXs = items
      .filter((it) => {
        const s = it.s.trim();
        if (it.x <= pageWidth * 0.33) return false;
        if (/^[A-Z]{2,5}\s+\d{3,4}[A-Z]?\b/.test(s)) return true;
        if (!/^[A-Z]{2,5}$/.test(s)) return false;
        // must be followed on the same row by a course number
        return items.some((o) => o !== it && Math.abs(o.y - it.y) < 2 && o.x > it.x && o.x - it.x < 80 && isNum(o.s));
      })
      .map((it) => it.x);
    let mid = Infinity;
    if (subjXs.length >= 3) {
      // most common left edge among right-hand subject codes
      const counts = {};
      for (const x of subjXs) { const k = Math.round(x / 4) * 4; counts[k] = (counts[k] || 0) + 1; }
      const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      if (best[1] >= 3) mid = Math.min(...subjXs.filter((x) => Math.abs(x - +best[0]) < 6)) - 3;
    }
    const cols = [[], []];
    for (const it of items) cols[it.x >= mid ? 1 : 0].push(it);
    const twoCol = cols[1].length > 8 && cols[0].length > 8;
    const groups = twoCol ? cols : [items];
    const out = [];
    for (const g of groups) {
      // bucket by y (tolerance 2.5pt)
      g.sort((a, b) => b.y - a.y || a.x - b.x);
      const rows = [];
      for (const it of g) {
        const r = rows.find((r) => Math.abs(r.y - it.y) < 2.5);
        if (r) r.items.push(it);
        else rows.push({ y: it.y, items: [it] });
      }
      rows.sort((a, b) => b.y - a.y);
      for (const r of rows) {
        r.items.sort((a, b) => a.x - b.x);
        let line = '';
        let lastEnd = null;
        for (const it of r.items) {
          if (lastEnd !== null && it.x - lastEnd > 1) line += ' ';
          line += it.s;
          lastEnd = it.x + it.w;
        }
        out.push(line.replace(/\s+/g, ' ').trim());
      }
    }
    return out;
  }

  /** Parse transcript lines into course records. */
  function parseTranscript(text) {
    const lines0 = Array.isArray(text) ? text : String(text).split(/\r?\n/);
    // Split side-by-side columns in pasted text ("...  4.00    BIOL 1040 ...")
    const lines = lines0.flatMap((l) => String(l).split(/\s{3,}(?=[A-Z]{2,5}\s+\d{3,4}[A-Z]?\s)|\s{3,}(?=\d{4}\s+(?:Fall|Spring|Summer|January|Winter)\b)/));
    const courses = [];
    let term = null;
    let section = 'record';
    let student = null;
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      const line = raw.replace(/\s+/g, ' ').trim();
      if (!line) continue;
      if (/^Test Credits?\b/i.test(line)) { section = 'test'; continue; }
      if (/^Transfer Credits?\b/i.test(line)) { section = 'transfer'; continue; }
      if (/Beginning of Undergraduate Record/i.test(line)) { section = 'record'; continue; }
      const tm = line.match(TERM_RE);
      if (tm && line.length < 40) { term = tm[1] + ' ' + tm[2]; if (section !== 'test' && section !== 'transfer') section = 'record'; continue; }
      if (/^Repeated:.*Exclude/i.test(line) && courses.length) { courses[courses.length - 1].excluded = true; continue; }
      const m = line.match(COURSE_LINE);
      if (!m) continue;
      const [, subj, num, titleRaw, grade, cr] = m;
      // Guard against summary lines like "Curr Credits 17.0"
      if (/^(Curr|Cuml|Grd|GPA|Test|Transfer|Term)$/i.test(subj)) continue;
      const credits = parseFloat(cr);
      if (credits > 12) continue;
      let status;
      if (grade && TEST_GRADES.has(grade)) status = 'test';
      else if (grade && TRANSFER_GRADES.has(grade)) status = 'transfer';
      else if (section === 'test') status = 'test';
      else if (section === 'transfer') status = 'transfer';
      else if (!grade) status = 'inprogress';
      else if (FAILING.has(grade)) status = 'nocredit';
      else status = 'completed';
      courses.push({
        code: subj + ' ' + num,
        subject: subj,
        number: num,
        title: titleRaw.trim(),
        grade: grade || '',
        credits,
        term: section === 'test' ? 'Test credit' : section === 'transfer' ? 'Transfer' : term || '',
        status,
      });
    }
    // dedupe: keep the best (non-excluded, passing) instance of each course
    const byCode = new Map();
    for (const c of courses) {
      if (c.excluded) continue;
      const prev = byCode.get(c.code);
      if (!prev || rank(c) > rank(prev)) byCode.set(c.code, c);
    }
    return { courses: [...byCode.values()], raw: courses };
  }
  function rank(c) {
    return { completed: 4, test: 3, transfer: 3, inprogress: 2, nocredit: 0 }[c.status] ?? 1;
  }

  // ---------- Pattern matching ----------

  function compilePattern(p) {
    p = String(p).trim().toUpperCase().replace(/\s+/g, ' ');
    const alts = p.split('|').map((s) => s.trim()).filter(Boolean);
    const tests = alts.map((a) => {
      let m;
      if ((m = a.match(/^\* (\d{4})\+$/))) { const lo = +m[1]; return { kind: 'range', s: '*', lo, hi: 9999, f: (c) => num(c) >= lo }; }
      if (a === '*' || a === '* *') return { kind: 'subj', s: '*', f: () => true };
      if ((m = a.match(/^([A-Z]{2,5}) \*$/))) { const s = m[1]; return { kind: 'subj', s, f: (c) => c.subject === s }; }
      if ((m = a.match(/^([A-Z]{2,5}) (\d{4})\+$/))) { const s = m[1], lo = +m[2]; return { kind: 'range', s, lo, hi: 9999, f: (c) => c.subject === s && num(c) >= lo }; }
      if ((m = a.match(/^([A-Z]{2,5}) (\d{4})-(\d{4})$/))) { const s = m[1], lo = +m[2], hi = +m[3]; return { kind: 'range', s, lo, hi, f: (c) => c.subject === s && num(c) >= lo && num(c) <= hi }; }
      if ((m = a.match(/^([A-Z]{2,5}) (\d{3,4}[A-Z]?)$/))) { const code = m[1] + ' ' + m[2]; return { kind: 'exact', code, f: (c) => c.code === code }; }
      return { kind: 'unknown', f: () => false };
    });
    return {
      text: alts.join(' or '),
      raw: p,
      exactCodes: tests.filter((t) => t.kind === 'exact').map((t) => t.code),
      specific: tests.every((t) => t.kind === 'exact'),
      match: (c) => tests.some((t) => t.f(c)),
    };
  }
  function num(c) { const n = parseInt(c.number, 10); return isNaN(n) ? -1 : n; }

  // ---------- Requirement evaluation ----------

  const DEFAULT_CR = 3;

  function makeContext(courses, catalog, opts) {
    const usable = courses.filter((c) =>
      c.status !== 'nocredit' && (opts.includeInProgress || c.status !== 'inprogress'));
    return { usable, catalog: catalog || {}, opts };
  }
  function crFor(code, catalog) {
    const e = catalog[code];
    if (e && typeof e[1] === 'number' && e[1] > 0) return e[1];
    return DEFAULT_CR;
  }

  /** Evaluate one group against available (unused) courses. Mutates `used` with consumed codes. */
  function evalGroup(g, ctx, used) {
    const res = { label: g.label || 'Requirement', note: g.note || '', satisfied: false, applied: [], missing: [], remCourses: 0, remCredits: 0, children: [] };
    const avail = (pat) => ctx.usable.filter((c) => !used.has(c.code) && pat.match(c) && !isExcluded(c, g));

    if (Array.isArray(g.sets) && g.sets.length) {
      let best = null;
      for (const set of g.sets) {
        const trial = new Set(used);
        const r = evalGroup({ label: g.label, need: { all: true }, from: set, exclude: g.exclude }, ctx, trial);
        if (!best || r.remCredits < best.r.remCredits || (r.remCredits === best.r.remCredits && r.remCourses < best.r.remCourses)) best = { r, trial };
      }
      for (const c of best.trial) used.add(c);
      Object.assign(res, best.r, { label: g.label || res.label, note: g.note || '', alternatives: g.sets.length });
      return res;
    }

    if (Array.isArray(g.children) && g.children.length) {
      for (const ch of g.children) {
        const r = evalGroup(ch, ctx, used);
        res.children.push(r);
        res.remCourses += r.remCourses;
        res.remCredits += r.remCredits;
        res.applied.push(...r.applied);
      }
      // a group may have both children and its own rule
      if (!g.from || !g.from.length) { res.satisfied = res.children.every((r) => r.satisfied); return res; }
    }

    let need = g.need || { all: true };
    const pats = (g.from || []).map(compilePattern);
    if (res.children.length) {
      // Children are constraints inside this group's own count: what they applied (or still need) counts toward it.
      const inParent = res.applied.filter((c) => pats.some((p) => p.match(c)));
      const childRemC = res.children.reduce((a, r) => a + r.remCourses, 0);
      const childRemCr = res.children.reduce((a, r) => a + r.remCredits, 0);
      if (need.courses) need = { courses: Math.max(0, need.courses - inParent.length - childRemC) };
      else if (need.credits) need = { credits: Math.max(0, need.credits - inParent.reduce((a, c) => a + (c.credits || 0), 0) - childRemCr) };
      if ((need.courses === 0) || (need.credits === 0)) { res.satisfied = res.remCourses === 0; return res; }
    }

    if (need.all || (!need.courses && !need.credits)) {
      for (const p of pats) {
        const hit = avail(p)[0];
        if (hit) { used.add(hit.code); res.applied.push(hit); }
        else {
          const cr = p.exactCodes.length ? crFor(p.exactCodes[0], ctx.catalog) : DEFAULT_CR;
          res.missing.push({ text: p.text, codes: p.exactCodes, credits: cr });
          res.remCourses += 1; res.remCredits += cr;
        }
      }
    } else if (need.courses) {
      let n = need.courses;
      // specific patterns first so broad ranges don't eat specific courses unnecessarily
      const ordered = [...pats].sort((a, b) => (b.specific ? 1 : 0) - (a.specific ? 1 : 0));
      const ds = need.distinctSubjects || 0;
      if (ds) {
        // first take one course per new subject, then fill the rest
        const subj = new Set();
        for (const p of ordered) for (const c of avail(p)) {
          if (n <= 0 || subj.size >= ds) break;
          if (subj.has(c.subject)) continue;
          subj.add(c.subject); used.add(c.code); res.applied.push(c); n--;
        }
        const lackSubj = Math.max(0, ds - subj.size);
        n = Math.max(n - 0, lackSubj);
        if (lackSubj && n === lackSubj) {
          // remaining slots must come from new subjects; don't fill them with repeats
        } else {
          for (const p of ordered) for (const c of avail(p)) { if (n <= lackSubj) break; used.add(c.code); res.applied.push(c); n--; }
        }
        if (lackSubj) res.note = (res.note ? res.note + ' ' : '') + `Needs courses in ${lackSubj} more subject code${lackSubj > 1 ? 's' : ''}.`;
      } else {
        for (const p of ordered) {
          for (const c of avail(p)) { if (n <= 0) break; used.add(c.code); res.applied.push(c); n--; }
        }
      }
      if (n > 0) {
        const cr = estCredits(pats, ctx.catalog);
        res.remCourses += n; res.remCredits += n * cr;
        res.missing.push({ text: `${n} more course${n > 1 ? 's' : ''} from: ${describe(pats)}`, codes: suggest(pats, ctx, used), credits: n * cr, count: n });
      }
    } else if (need.credits) {
      let have = 0;
      const ordered = [...pats].sort((a, b) => (b.specific ? 1 : 0) - (a.specific ? 1 : 0));
      outer: for (const p of ordered) {
        for (const c of avail(p)) {
          if (have >= need.credits) break outer;
          used.add(c.code); res.applied.push(c); have += c.credits || 0;
        }
      }
      const rem = Math.max(0, need.credits - have);
      if (rem > 0) {
        const cr = estCredits(pats, ctx.catalog);
        const n = Math.ceil(rem / cr);
        res.remCredits += rem; res.remCourses += n;
        res.missing.push({ text: `${rem} more credit${rem !== 1 ? 's' : ''} from: ${describe(pats)}`, codes: suggest(pats, ctx, used), credits: rem, count: n });
      }
    }
    res.satisfied = res.remCourses === 0 && res.children.every((r) => r.satisfied);
    return res;
  }
  function isExcluded(c, g) {
    if (!g.exclude || !g.exclude.length) return false;
    return g.exclude.some((e) => compilePattern(e).match(c));
  }
  function estCredits(pats, catalog) {
    const codes = pats.flatMap((p) => p.exactCodes);
    if (!codes.length) return DEFAULT_CR;
    const vals = codes.map((c) => crFor(c, catalog));
    return Math.max(1, Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 2) / 2);
  }
  function describe(pats) {
    const t = pats.map((p) => p.text);
    if (!t.length) return 'the department’s approved list (see notes)';
    if (t.length <= 6) return t.join(', ');
    return t.slice(0, 6).join(', ') + `, +${t.length - 6} more`;
  }
  function suggest(pats, ctx, used) {
    return pats.flatMap((p) => p.exactCodes).filter((c) => !used.has(c)).slice(0, 12);
  }

  function specificity(g) {
    if (g.sets) return 3;
    if (g.children) return 2;
    const pats = (g.from || []).map(compilePattern);
    if (pats.length && pats.every((p) => p.specific)) return g.need && g.need.all ? 4 : 3;
    return 1;
  }

  function evalGroups(groups, ctx) {
    const used = new Set();
    const order = groups.map((g, i) => ({ g, i, s: specificity(g) })).sort((a, b) => b.s - a.s || a.i - b.i);
    const results = new Array(groups.length);
    for (const { g, i } of order) results[i] = evalGroup(g, ctx, used);
    return { results, used };
  }

  /** Evaluate a program for a student. */
  function evaluateProgram(prog, ctx) {
    const { results, used } = evalGroups(prog.requirements || [], ctx);
    let remCourses = results.reduce((a, r) => a + r.remCourses, 0);
    let remCredits = results.reduce((a, r) => a + r.remCredits, 0);
    const applied = results.flatMap((r) => flatApplied(r));
    const appliedCredits = applied.reduce((a, c) => a + (c.credits || 0), 0);
    const total = prog.totalCredits || null;
    if (total && total - appliedCredits > remCredits) {
      const gap = total - appliedCredits - remCredits;
      remCredits += gap;
      remCourses += Math.ceil(gap / DEFAULT_CR);
    }
    const requiredCredits = total || appliedCredits + remCredits;
    const pct = requiredCredits > 0 ? Math.min(1, Math.max(0, (requiredCredits - remCredits) / requiredCredits)) : 0;

    // Declaration prerequisites (evaluated independently: courses can overlap with the major)
    let decl = null;
    const d = prog.declaration;
    if (d && ((d.requirements && d.requirements.length) || d.minGPA || d.notes)) {
      const dr = d.requirements && d.requirements.length ? evalGroups(d.requirements, ctx).results : [];
      const missing = dr.flatMap(flatMissing);
      decl = {
        results: dr,
        ready: dr.every((r) => r.satisfied),
        remCourses: dr.reduce((a, r) => a + r.remCourses, 0),
        minGPA: d.minGPA || null,
        notes: d.notes || '',
        missing,
      };
    }

    // Prerequisite chains for remaining required courses
    const have = new Set(ctx.usable.map((c) => c.code));
    const chain = [];
    const pre = prog.coursePrereqs || {};
    const remainingExact = results.flatMap(flatMissing).flatMap((m) => (m.codes && m.codes.length && !m.count ? [m.codes[0]] : []));
    for (const code of remainingExact) {
      const slots = pre[code];
      if (!slots) continue;
      for (const slot of slots) {
        const p = compilePattern(slot);
        const ok = ctx.usable.some((c) => p.match(c));
        if (!ok) {
          // only count as hidden extra if the slot isn't itself already a remaining requirement
          const alreadyCounted = p.exactCodes.some((x) => remainingExact.includes(x));
          chain.push({ course: code, needs: p.text, extra: !alreadyCounted, codes: p.exactCodes });
        }
      }
    }
    const extraPrereqs = new Set(chain.filter((c) => c.extra).map((c) => c.needs)).size;
    const declExtra = decl ? decl.missing.filter((m) => !m.codes || !m.codes.some((x) => remainingExact.includes(x))).reduce((a, m) => a + (m.count || 1), 0) : 0;

    return {
      id: prog.id,
      prog,
      results,
      applied,
      appliedCredits,
      remCourses,
      remCredits,
      requiredCredits,
      pct,
      decl,
      chain,
      hiddenCourses: extraPrereqs + declExtra,
      effort: remCourses + extraPrereqs + declExtra,
      complete: remCourses === 0,
    };
  }
  function flatApplied(r) { return [...r.applied]; }
  function flatMissing(r) { return [...r.missing, ...(r.children || []).flatMap(flatMissing)]; }

  function evaluateAll(programs, courses, catalog, opts) {
    const ctx = makeContext(courses, catalog, Object.assign({ includeInProgress: true }, opts || {}));
    return programs.map((p) => {
      try { return evaluateProgram(p, ctx); }
      catch (e) { return { id: p.id, prog: p, error: String(e), remCourses: 99, remCredits: 999, effort: 999, pct: 0, results: [], applied: [], chain: [], hiddenCourses: 0 }; }
    });
  }

  const Engine = { pdfToLines, itemsToLines, parseTranscript, compilePattern, evaluateAll, evaluateProgram };
  if (typeof module !== 'undefined' && module.exports) module.exports = Engine;
  else root.Engine = Engine;
})(typeof window !== 'undefined' ? window : globalThis);

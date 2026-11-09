/* Hoo's Closest Major: UI */
(function () {
  'use strict';
  const E = window.Engine;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const SAMPLE = [
    // A fictional second-year student, used only as a demo.
    ['MATH 1310', 'Calculus I', 'TE', 4, 'test'], ['ECON 2010', 'Principles of Econ: Microecon', 'TE', 3, 'test'],
    ['PSYC 1010', 'Introductory Psychology', 'TE', 3, 'test'], ['ENWR 1510', 'Writing and Critical Inquiry', 'A-', 3, 'completed'],
    ['EGMT 1510', 'Engaging Aesthetics', 'A', 2, 'completed'], ['EGMT 1520', 'Empirical Engagement', 'B+', 2, 'completed'],
    ['EGMT 1530', 'Engaging Differences', 'A', 2, 'completed'], ['EGMT 1540', 'Ethical Engagement', 'A-', 2, 'completed'],
    ['ECON 2020', 'Principles of Econ: Macroecon', 'B+', 3, 'completed'], ['STAT 2120', 'Intro to Statistical Analysis', 'A', 4, 'completed'],
    ['PLAP 1010', 'Introduction to American Politics', 'A-', 3, 'completed'], ['PLIR 1010', 'Introduction to International Relations', 'B+', 3, 'completed'],
    ['SOC 1010', 'Introduction to Sociology', 'A', 3, 'completed'], ['SPAN 2010', 'Intermediate Spanish', 'B', 3, 'completed'],
    ['SPAN 2020', 'Advanced Intermediate Spanish', 'B+', 3, 'completed'], ['HIEU 2101', 'Jewish History I', 'A', 3, 'completed'],
    ['PSYC 2150', 'Introduction to Cognition', 'A-', 3, 'completed'], ['ECON 3010', 'Intermediate Microeconomics', '', 4, 'inprogress'],
    ['PLCP 1010', 'Introduction to Comparative Politics', '', 3, 'inprogress'], ['SPAN 3010', 'Grammar and Composition I', '', 3, 'inprogress'],
    ['CS 1110', 'Introduction to Programming', '', 3, 'inprogress'],
  ].map(([code, title, grade, credits, status]) => {
    const [subject, number] = code.split(' ');
    return { code, subject, number, title, grade, credits, status, term: status === 'test' ? 'Test credit' : status === 'inprogress' ? '2026 Fall' : '' };
  });

  const state = {
    programs: [], catalog: {}, courses: [], isSample: true, who: '',
    type: 'major', sort: 'effort', q: '', includeIP: true, open: new Set(), results: [],
  };
  try {
    const saved = JSON.parse(localStorage.getItem('hcm-prefs') || '{}');
    if (saved.sort) state.sort = saved.sort;
    if (saved.type) state.type = saved.type;
  } catch (e) { /* storage unavailable */ }
  function savePrefs() { try { localStorage.setItem('hcm-prefs', JSON.stringify({ sort: state.sort, type: state.type })); } catch (e) { /* ignore */ } }

  // ---------- Data loading ----------
  async function loadData() {
    const [p, c] = await Promise.all([fetch('programs.json').then((r) => r.json()), fetch('courses.json').then((r) => r.json())]);
    state.programs = p.programs || p;
    state.catalog = c;
    if (p.generated) $('#dataStamp').textContent = `Program data compiled ${p.generated}. ${state.programs.length} programs.`;
  }

  // ---------- Transcript input ----------
  const status = (msg, err) => { lastParseNote = msg || ''; const s = $('#status'); s.textContent = msg || ''; s.classList.toggle('err', !!err); };

  async function readPdf(file) {
    status('Reading ' + file.name + '…');
    try {
      const pdfjsLib = window.pdfjsLib;
      if (!pdfjsLib) throw new Error('The PDF reader did not load. Check your connection, or use Paste text.');
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      const buf = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf), isEvalSupported: false }).promise;
      const lines = await E.pdfToLines(pdf);
      const who = guessName(lines);
      useParsed(E.parseTranscript(lines), who, file.name);
    } catch (e) {
      console.error(e);
      status('Could not read that PDF: ' + (e.message || e) + ' Try Paste text instead.', true);
    }
  }
  function guessName(lines) {
    // SIS unofficial transcripts put the student's name alone on an early line
    for (const l of lines.slice(0, 80)) {
      if (/^[A-Z][a-z]+(?: [A-Z][a-zA-Z'.-]+){1,3}$/.test(l) && !/University|Record|Credits|Transfer|Honor|School|Major/.test(l)) return l;
    }
    return '';
  }
  function useParsed(parsed, who, srcName) {
    if (!parsed.courses.length) {
      status('No courses found. Make sure it is a UVA transcript, or paste the text instead.', true);
      return;
    }
    state.courses = parsed.courses;
    state.isSample = false;
    state.who = who || '';
    state.open.clear();
    const ip = parsed.courses.filter((c) => c.status === 'inprogress').length;
    status(`Found ${parsed.courses.length} courses${ip ? ` (${ip} in progress or planned)` : ''}${srcName ? ' in ' + srcName : ''}.`);
    render();
    $('#summary').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }

  function wireInput() {
    const drop = $('#drop'), file = $('#file');
    $('#pick').addEventListener('click', () => file.click());
    file.addEventListener('change', () => { const f = file.files[0]; if (f) handleFile(f); file.value = ''; });
    ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', (e) => { const f = e.dataTransfer.files[0]; if (f) handleFile(f); });
    document.addEventListener('dragover', (e) => e.preventDefault());
    document.addEventListener('drop', (e) => { e.preventDefault(); const f = e.dataTransfer && e.dataTransfer.files[0]; if (f) handleFile(f); });

    $('#pasteBtn').addEventListener('click', () => { const b = $('#pasteBox'); b.hidden = !b.hidden; if (!b.hidden) { $('#pasteText').focus(); $('#transcript').scrollIntoView({ block: 'start', behavior: 'smooth' }); } });
    $('#pasteGo').addEventListener('click', () => {
      const t = $('#pasteText').value;
      if (!t.trim()) { status('Paste your transcript text first.', true); return; }
      useParsed(E.parseTranscript(t), '', 'pasted text');
      $('#pasteBox').hidden = true;
    });
    $('#sampleBtn').addEventListener('click', () => { state.courses = SAMPLE.slice(); state.isSample = true; state.who = ''; state.open.clear(); status('Loaded the sample student.'); render(); });
    $('#clearBtn').addEventListener('click', () => { state.courses = []; state.isSample = false; state.who = ''; status('Cleared. Upload a transcript or add courses by code.'); render(); });
    $('#expandChips').addEventListener('click', (e) => { const t = $('#transcript'); t.classList.toggle('open'); e.target.textContent = t.classList.contains('open') ? 'Show less' : 'Show all'; });
    $('#ipToggle').addEventListener('change', (e) => { state.includeIP = e.target.checked; render(); });
    $('#addForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const raw = $('#addCode').value.trim().toUpperCase().replace(/\s+/g, ' ');
      const m = raw.match(/^([A-Z]{2,5})\s?(\d{4}[A-Z]?)$/);
      if (!m) { status('Type a course code like ECON 3010.', true); return; }
      const code = m[1] + ' ' + m[2];
      if (state.courses.some((c) => c.code === code)) { status(code + ' is already on your list.'); return; }
      const cat = state.catalog[code];
      state.courses.push({ code, subject: m[1], number: m[2], title: cat ? cat[0] : '', grade: '', credits: cat && cat[1] ? cat[1] : 3, status: 'completed', term: 'Added by you' });
      $('#addCode').value = '';
      status('Added ' + code + (cat ? ' (' + cat[0] + ')' : '') + '.');
      render();
    });
    $('#chips').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-rm]');
      if (!b) return;
      state.courses = state.courses.filter((c) => c.code !== b.dataset.rm);
      render();
    });
    function handleFile(f) {
      if (/\.txt$/i.test(f.name) || f.type === 'text/plain') f.text().then((t) => useParsed(E.parseTranscript(t), '', f.name));
      else readPdf(f);
    }
  }

  function wireControls() {
    document.querySelectorAll('.seg button').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.type === state.type));
      b.addEventListener('click', () => {
        state.type = b.dataset.type;
        document.querySelectorAll('.seg button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        savePrefs(); renderList();
      });
    });
    $('#sort').value = state.sort;
    $('#sort').addEventListener('change', (e) => { state.sort = e.target.value; savePrefs(); renderList(); });
    $('#q').addEventListener('input', (e) => { state.q = e.target.value.trim().toLowerCase(); renderList(); });
    $('#list').addEventListener('click', (e) => {
      const row = e.target.closest('button.row');
      if (!row) return;
      const id = row.dataset.id;
      state.open.has(id) ? state.open.delete(id) : state.open.add(id);
      renderList();
    });
  }

  // ---------- Rendering ----------
  function render() {
    renderChips();
    state.results = E.evaluateAll(state.programs, state.courses, state.catalog, { includeInProgress: state.includeIP });
    renderSummary();
    renderList();
    refreshDiag();
  }

  function renderChips() {
    const t = $('#tTitle');
    t.innerHTML = state.isSample
      ? 'Sample student <span class="sample-flag">Example data</span>'
      : esc(state.who ? state.who + "'s courses" : 'Your courses');
    const creds = state.courses.filter((c) => c.status !== 'nocredit').reduce((a, c) => a + (c.credits || 0), 0);
    t.insertAdjacentHTML('beforeend', ` <span class="who">${state.courses.length} courses · ${creds} credits</span>`);
    const sorted = [...state.courses].sort((a, b) => a.code.localeCompare(b.code, 'en', { numeric: true }));
    $('#chips').innerHTML = sorted.length
      ? sorted.map((c) => {
          const cls = c.status === 'inprogress' ? 'ip' : c.status === 'test' || c.status === 'transfer' ? 'test' : '';
          const tip = [c.title, c.grade && 'Grade ' + c.grade, c.credits + ' cr', c.term].filter(Boolean).join(' · ');
          return `<span class="chip ${cls}" title="${esc(tip)}">${esc(c.code)}<button type="button" data-rm="${esc(c.code)}" aria-label="Remove ${esc(c.code)}">×</button></span>`;
        }).join('')
      : '<span style="color:var(--muted);font-size:13.5px">No courses yet. Upload a transcript above or add courses by code.</span>';
  }

  function sortKey(r) {
    switch (state.sort) {
      case 'credits': return [r.remCredits, r.remCourses, -r.pct];
      case 'courses': return [r.remCourses, r.remCredits, -r.pct];
      case 'pct': return [-r.pct, r.remCredits];
      case 'ready': return [r.decl && !r.decl.ready ? 1 : 0, r.effort, r.remCredits];
      default: return [r.effort, r.remCredits, -r.pct];
    }
  }
  function cmp(a, b) { const sd = (a.prog.selfDesigned ? 1 : 0) - (b.prog.selfDesigned ? 1 : 0); if (sd) return sd; const ka = sortKey(a), kb = sortKey(b); for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] - kb[i]; return a.prog.name.localeCompare(b.prog.name); }
  const label = (p) => p.name + (p.type === 'minor' ? ' minor' : '');

  function renderSummary() {
    const maj = state.results.filter((r) => r.prog.type === 'major' && !r.prog.selfDesigned).sort((a, b) => a.effort - b.effort || a.remCredits - b.remCredits);
    const min = state.results.filter((r) => r.prog.type === 'minor').sort((a, b) => a.effort - b.effort || a.remCredits - b.remCredits);
    const ready = maj.filter((r) => r.decl ? r.decl.ready : true).length;
    const qw = min.filter((r) => r.remCourses <= 2).length;
    const card = (k, v, s) => `<div class="panel sum"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`;
    const m = maj[0], n = min[0];
    $('#summary').innerHTML = [
      m ? card('Closest major', esc(m.prog.name) + ` <span style="font-size:14px;color:var(--muted);font-weight:600">${esc(m.prog.degree)}</span>`, `<b>${fmt(m.remCredits)}</b> credits · <b>${m.remCourses}</b> courses left${m.hiddenCourses ? ` · +${m.hiddenCourses} prereq` : ''}`) : '',
      n ? card('Closest minor', esc(n.prog.name), `<b>${fmt(n.remCredits)}</b> credits · <b>${n.remCourses}</b> courses left`) : '',
      card('Quick wins', `${qw} minor${qw === 1 ? '' : 's'} within 2 courses`, `<b>${ready}</b> of ${maj.length} majors have no unmet declaration prerequisites`),
    ].join('');
    $('#nMaj').textContent = maj.length;
    $('#nMin').textContent = min.length;
  }

  function fmt(n) { return Number.isInteger(n) ? String(n) : n.toFixed(1); }

  function bar(r) {
    const total = Math.max(1, Math.round(r.requiredCredits / 3));
    const doneCr = Math.max(0, r.requiredCredits - r.remCredits);
    const done = Math.min(total, Math.round(doneCr / 3));
    const ipCr = r.applied.filter((c) => c.status === 'inprogress').reduce((a, c) => a + (c.credits || 0), 0);
    const ipN = Math.min(done, Math.round(ipCr / 3));
    let html = '';
    for (let i = 0; i < total; i++) html += `<i class="${i < done - ipN ? 'd' : i < done ? 'p' : ''}"></i>`;
    return html;
  }

  function declPill(r) {
    if (!r.decl) return '<span class="pill ok">No prerequisites to declare</span>';
    const parts = [];
    if (r.decl.ready) parts.push('<span class="pill ok">Prerequisites done</span>');
    else parts.push(`<span class="pill warn">${r.decl.remCourses} prerequisite course${r.decl.remCourses === 1 ? '' : 's'} before declaring</span>`);
    if (r.decl.minGPA) parts.push(`<span class="pill">GPA ≥ ${r.decl.minGPA}</span>`);
    if (/appl/i.test(r.decl.notes || '')) parts.push('<span class="pill acc">Application</span>');
    return parts.join('');
  }

  function renderList() {
    let rows = state.results.filter((r) => state.type === 'all' || r.prog.type === state.type);
    if (state.q) rows = rows.filter((r) => (r.prog.name + ' ' + r.prog.department + ' ' + r.prog.degree).toLowerCase().includes(state.q));
    rows.sort(cmp);
    if (!rows.length) { $('#list').innerHTML = '<div class="panel empty">No programs match that search.</div>'; return; }
    $('#list').innerHTML = rows.map((r, i) => {
      const p = r.prog, open = state.open.has(p.id);
      const chainN = r.chain.length;
      return `<article class="panel prog ${i < 3 ? 'top' : ''}">
        <button type="button" class="row" data-id="${esc(p.id)}" aria-expanded="${open}">
          <div class="rank">${i + 1}</div>
          <div class="name"><div class="t">${esc(p.name)}<small>${esc(p.degree)}</small></div>
            <div class="pills">${p.selfDesigned ? '<span class="pill acc">Self-designed: you build the course plan</span>' : ''}${p.confidence === 'low' ? '<span class="pill warn">Rough estimate: course list unverified</span>' : ''}${r.complete ? '<span class="pill ok">Requirements met</span>' : ''}${declPill(r)}${chainN ? `<span class="pill bad">${chainN} course prereq${chainN === 1 ? '' : 's'} missing</span>` : ''}</div></div>
          <div class="dist"><div class="bar" aria-hidden="true">${bar(r)}</div>
            <div class="cap"><span>${Math.round(r.pct * 100)}% done</span><span>${fmt(r.requiredCredits)} credits total</span></div></div>
          <div class="left"><div class="big ${r.remCredits === 0 ? 'zero' : ''}">${fmt(r.remCredits)}</div><div class="unit">credits left</div><div class="sub">${r.remCourses} course${r.remCourses === 1 ? '' : 's'}${r.hiddenCourses ? ` +${r.hiddenCourses} prereq` : ''}</div></div>
        </button>
        ${open ? detail(r) : ''}
      </article>`;
    }).join('');
  }

  function offered(code) {
    const c = state.catalog[code];
    if (!c) return '';
    const b = c[2] || '';
    const f = b[0] === '1' || b[3] === '1', s = b[1] === '1', su = b[2] === '1';
    const t = [f && 'Fall', s && 'Spring', su && 'Summer'].filter(Boolean).join('/');
    return t ? ` <em>${t}</em>` : '';
  }
  function needChips(codes) {
    if (!codes || !codes.length) return '';
    return `<div class="cc">${codes.slice(0, 10).map((c) => `<span class="need" title="${esc((state.catalog[c] || [])[0] || '')}">${esc(c)}${offered(c)}</span>`).join('')}</div>`;
  }
  function groupHtml(g) {
    const ok = g.satisfied;
    const rem = !ok ? `<span class="rem">${g.remCourses} course${g.remCourses === 1 ? '' : 's'} · ${fmt(g.remCredits)} cr left</span>` : '';
    const applied = g.applied.length ? `<div class="cc">${g.applied.map((c) => `<span title="${esc(c.title)}">${esc(c.code)}${c.status === 'inprogress' ? ' ·IP' : ''}</span>`).join('')}</div>` : '';
    const miss = g.missing.map((m) => `<div class="miss">Still need: ${esc(m.text)}</div>${m.count ? needChips(m.codes) : needChips(m.codes.length > 1 ? m.codes : [])}`).join('');
    const kids = (g.children || []).map(groupHtml).join('');
    return `<div class="grp"><div class="ic ${ok ? 'ok' : 'no'}">${ok ? '✓' : '•'}</div><div class="gl">${esc(g.label)}${rem}</div>
      <div class="gb">${applied}${miss}${g.note ? `<div class="notes">${esc(g.note)}</div>` : ''}${kids ? `<div class="groups">${kids}</div>` : ''}</div></div>`;
  }
  function detail(r) {
    const p = r.prog;
    let declHtml = '';
    if (r.decl) {
      const items = r.decl.results.map(groupHtml).join('');
      declHtml = `<div><h4>Before you can declare</h4><div class="callout ${r.decl.ready ? 'ok' : 'warn'}">
        <div><b>${r.decl.ready ? 'You have the courses needed to declare.' : 'You still need some prerequisites before declaring.'}</b>${r.decl.minGPA ? ` Minimum GPA ${r.decl.minGPA}.` : ''}</div>
        ${r.decl.notes ? `<div>${esc(r.decl.notes)}</div>` : ''}</div>${items ? `<div class="groups" style="margin-top:10px">${items}</div>` : ''}</div>`;
    }
    const chain = r.chain.length ? `<div><h4>Prerequisite chain</h4><div class="callout warn">${r.chain.map((c) => `<div><b>${esc(c.course)}</b> needs ${esc(c.needs)} first${c.extra ? ', which is an extra course' : ''}.</div>`).join('')}</div></div>` : '';
    return `<div class="detail">
      ${declHtml}
      <div><h4>Requirements</h4><div class="groups">${r.results.map(groupHtml).join('') || '<div class="notes">No structured requirements recorded.</div>'}</div></div>
      ${chain}
      ${p.notes ? `<div><h4>Notes</h4><div class="notes">${esc(p.notes)}</div></div>` : ''}
      ${p.sources && p.sources.length ? `<div class="src"><h4>Sources</h4>${p.sources.map((s) => `<div><a href="${esc(s)}" target="_blank" rel="noopener">${esc(s)}</a></div>`).join('')}</div>` : ''}
    </div>`;
  }

  // ---------- Masthead contour lines (topographic "distance" motif) ----------
  function contours() {
    const cv = $('#contours');
    if (!cv || !cv.getContext) return;
    const ctx = cv.getContext('2d');
    const draw = () => {
      const w = cv.clientWidth, h = cv.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = w * dpr; cv.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const cx = w * 0.82, cy = h * 0.35;
      for (let k = 1; k < 26; k++) {
        ctx.beginPath();
        for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.04) {
          const rr = k * 22 * (1 + 0.16 * Math.sin(3 * a + k * 0.35) + 0.08 * Math.cos(5 * a - k * 0.2));
          const x = cx + Math.cos(a) * rr * 1.35, y = cy + Math.sin(a) * rr;
          a === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.strokeStyle = k % 5 === 0 ? 'rgba(243,165,107,.45)' : 'rgba(201,205,224,.13)';
        ctx.lineWidth = k % 5 === 0 ? 1.2 : 1;
        ctx.stroke();
      }
    };
    draw();
    let t; window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(draw, 120); });
  }

  // ---------- Problem reports ----------
  const REPORT_FORM_URL = ''; // Google Form link
  function diagnostics() {
    const lines = [];
    lines.push('Hoo\'s Closest Major diagnostic');
    lines.push('Data: ' + (($('#dataStamp') || {}).textContent || '') + ' | in-progress counted: ' + state.includeIP + ' | view: ' + state.type + '/' + state.sort);
    lines.push('Source: ' + (state.isSample ? 'sample student' : 'user transcript') + ' | ' + state.courses.length + ' courses');
    lines.push('Browser: ' + navigator.userAgent);
    lines.push('Courses (code | grade | credits | status | term | title):');
    for (const c of [...state.courses].sort((a, b) => a.code.localeCompare(b.code, 'en', { numeric: true })))
      lines.push([c.code, c.grade || '-', c.credits, c.status, c.term || '-', c.title || ''].join(' | '));
    const open = [...state.open];
    if (open.length) lines.push('Expanded programs: ' + open.join(', '));
    const top = state.results.filter((r) => state.type === 'all' || r.prog.type === state.type).sort(cmp).slice(0, 5);
    lines.push('Top 5 shown: ' + top.map((r) => `${r.prog.id} (${r.remCredits}cr/${r.remCourses}c)`).join('; '));
    if (lastParseNote) lines.push('Last status: ' + lastParseNote);
    return lines.join('\n');
  }
  let lastParseNote = '';
  function refreshDiag() { const t = $('#diagText'); if (t) t.value = diagnostics(); }
  function wireReport() {
    if (REPORT_FORM_URL) { const a = $('#formLink'); a.href = REPORT_FORM_URL; a.hidden = false; $('#formPending').hidden = true; }
    $('#copyDiag').addEventListener('click', async (e) => {
      refreshDiag();
      const t = $('#diagText'), b = e.currentTarget;
      try { await navigator.clipboard.writeText(t.value); b.textContent = 'Copied. Paste it into the form.'; }
      catch (err) { t.focus(); t.select(); b.textContent = 'Press Ctrl+C / Cmd+C to copy the selected text'; }
      setTimeout(() => { b.textContent = 'Copy diagnostic info'; }, 4000);
    });
  }

  // ---------- Boot ----------
  async function boot() {
    contours();
    wireInput();
    wireControls();
    wireReport();
    state.courses = SAMPLE.slice();
    try { await loadData(); }
    catch (e) { status('Could not load program data. Refresh the page to try again.', true); console.error(e); }
    render();
  }
  boot();
})();

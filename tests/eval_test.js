const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
const E = require('../engine.js');
const fs=require('fs');
(async () => {
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(process.argv[2])) }).promise;
  const r = E.parseTranscript(await E.pdfToLines(pdf));
  const P = JSON.parse(fs.readFileSync('../programs.json')).programs;
  const C = JSON.parse(fs.readFileSync('../courses.json'));
  const res = E.evaluateAll(P, r.courses, C, {includeInProgress:true}).sort((a,b)=>a.effort-b.effort||a.remCredits-b.remCredits);
  for (const x of res) console.log((x.error?'ERR ':'')+x.prog.type.padEnd(6), x.prog.name.slice(0,34).padEnd(35), x.prog.degree.padEnd(6), 'cr', String(x.remCredits).padEnd(5), 'co', String(x.remCourses).padEnd(3), 'eff', x.effort, 'decl', x.decl? (x.decl.ready?'ready':'need'+x.decl.remCourses):'-', 'chain', x.chain.length, x.error||'');
  const bio = res.find(x=>x.id==='biology-bs'); console.log(JSON.stringify(bio.results.map(g=>({l:g.label,s:g.satisfied,a:g.applied.map(c=>c.code),m:g.missing.map(m=>m.text)})),null,1));
})();

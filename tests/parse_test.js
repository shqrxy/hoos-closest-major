const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
const E = require('../engine.js');
(async () => {
  const data = new Uint8Array(require('fs').readFileSync(process.argv[2]));
  const pdf = await pdfjs.getDocument({ data }).promise;
  const lines = await E.pdfToLines(pdf);
  if (process.argv[3]) console.log(lines.join('\n'));
  const r = E.parseTranscript(lines);
  for (const c of r.courses) console.log(c.code.padEnd(11), c.status.padEnd(10), c.grade.padEnd(3), c.credits, c.term, '|', c.title);
  console.log(r.courses.length, 'unique of', r.raw.length);
})();

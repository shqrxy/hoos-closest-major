// Counts transcripts checked on the site. GET returns the total; POST adds one.
// Storage: Upstash Redis over its REST API. Connect Upstash to the Vercel project
// (Storage tab) and it sets KV_REST_API_URL / KV_REST_API_TOKEN for you.
const KEY = 'hcm:transcripts';

function creds() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

async function redis(c, cmd) {
  const r = await fetch(c.url, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + c.token, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  if (!r.ok) throw new Error('redis ' + r.status);
  return (await r.json()).result;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const c = creds();
  if (!c) return res.status(503).json({ error: 'counter not configured' });
  try {
    if (req.method === 'POST') {
      // One count per IP per minute, so a reload loop can't run the number up.
      const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
      const fresh = await redis(c, ['SET', 'hcm:rl:' + ip, '1', 'NX', 'EX', '60']);
      const count = fresh ? await redis(c, ['INCR', KEY]) : Number(await redis(c, ['GET', KEY])) || 0;
      return res.status(200).json({ count: Number(count) });
    }
    if (req.method === 'GET') {
      return res.status(200).json({ count: Number(await redis(c, ['GET', KEY])) || 0 });
    }
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    return res.status(502).json({ error: 'counter unavailable' });
  }
};

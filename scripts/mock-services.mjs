// Local stand-ins for DigitalOcean Serverless Inference (chat + embeddings),
// SerpApi, Backboard, ElevenLabs and DigitalOcean Spaces. They let every Panga
// code path run end to end without real keys. Development only.
//
//   npm run mock:services      # port 4010
//   npm run dev:mock           # Panga on port 3100, pointed at these mocks

import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import http from 'node:http';

const PORT = Number(process.env.MOCK_PORT ?? 4010);
const EXPECTED_MODEL = 'gemma-4-31B-it';
const sample = JSON.parse(readFileSync(new URL('../src/lib/sample-deal.json', import.meta.url), 'utf8'));
const log = (...args) => console.log(new Date().toISOString().slice(11, 19), ...args);
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

const textOf = (m) => (typeof m?.content === 'string' ? m.content : Array.isArray(m?.content) ? m.content.map((p) => p?.text ?? '').join(' ') : '');

// ---------------------------------------------------------------- the "model"

const SAMPLE_EXTRACTION = {
  summary: 'An online clothing store for a small Pune label, live before the Diwali sale.',
  offered_price: { amount: 15000, currency: 'INR', source: 'S1', quote: 'Our budget is ₹15,000' },
  requirements: [
    { title: 'Store setup and theme', category: 'build', detail: 'A clean, modern online store with catalogue, cart and checkout.', quotes: [{ source: 'S1', text: 'a simple online store for my clothing brand' }], hidden: false, inferred: false, suggested_hours: 12 },
    { title: 'Mobile layouts', category: 'design', detail: 'Every page must work well on phones, where most customers shop.', quotes: [{ source: 'S1', text: 'Most customers will buy from phone' }, { source: 'S1', text: 'fully responsive on all devices' }], hidden: true, inferred: false, suggested_hours: 6 },
    { title: 'Payment gateway (UPI and cards)', category: 'integration', detail: 'Set up and test UPI and card payments.', quotes: [{ source: 'S2', text: 'UPI and cards both should work' }], hidden: true, inferred: false, suggested_hours: 4 },
    { title: 'Product migration (about 200)', category: 'content', detail: 'Move around 200 products from Instagram onto the store.', quotes: [{ source: 'S2', text: 'we have around 200 products on Instagram' }], hidden: true, inferred: false, suggested_hours: 13 },
    { title: 'Adding product photos', category: 'content', detail: "Upload and attach the photos the client's team sends.", quotes: [{ source: 'S2', text: 'my team will send photos, you can add them with the products' }], hidden: true, inferred: false, suggested_hours: 5 },
    { title: 'Post-launch changes', category: 'support', detail: 'Ongoing small changes such as sale banners, with no stated limit.', quotes: [{ source: 'S2', text: 'small changes later also, like banners for every sale' }], hidden: true, inferred: false, suggested_hours: 4 },
    { title: 'Hosting and domain setup', category: 'other', detail: 'Connect a domain and hosting. Not mentioned by the client.', quotes: [], hidden: true, inferred: true, suggested_hours: 2 },
  ],
  questions: [
    { text: 'Who uploads the 200 products, and are prices, sizes and descriptions ready in a sheet?', requirement: 3 },
    { text: 'How many photos per product, and do they need editing or cropping?', requirement: 4 },
    { text: 'How many rounds of changes after launch are included, and for how long?', requirement: 5 },
    { text: 'Which payment gateway account will be used, and who pays its fees?', requirement: 2 },
    { text: 'What is the exact launch date for the Diwali sale?', requirement: null },
  ],
};

let brokeJsonOnce = process.env.MOCK_BREAK_JSON_ONCE !== '1';

function extraction(prompt) {
  const sources = [...prompt.matchAll(/<source id="(S\d+)"[^>]*>\n([\s\S]*?)\n<\/source>/g)].map((m) => ({ id: m[1], text: m[2] }));
  if (sources.some((s) => s.text.includes('Saanjh Studio'))) return SAMPLE_EXTRACTION;
  const requirements = sources.map((s, i) => {
    const first = (s.text.split(/(?<=[.!?\n])\s+/)[0] ?? s.text).trim().split(/\s+/).slice(0, 12).join(' ').replace(/[.!?,;:]+$/, '');
    return { title: i === 0 ? 'Main build' : `Request in ${s.id}`, category: 'build', detail: 'Mock analysis: the first request in this source.', quotes: [{ source: s.id, text: first }], hidden: false, inferred: false, suggested_hours: 8 };
  });
  return { summary: 'Mock analysis from the local test server.', offered_price: null, requirements, questions: [{ text: 'What is the deadline?', requirement: null }] };
}

function clientLine(system, messages) {
  const plan = [...system.matchAll(/^\d+\. \[(R\d+|PRICE)\] ([^:]+):/gm)].map((m) => ({ tag: m[1], title: m[2].trim() }));
  const budget = system.match(/Budget you offered: (.+)/)?.[1] ?? 'the budget';
  const hinglish = system.includes('mixing Hindi and English');
  const asked = messages.filter((m) => m.role === 'assistant').length;
  if (asked >= plan.length) return `[-] ${hinglish ? 'Theek hai.' : 'Okay.'} Send me your quote and I will check with my team.`;
  const p = plan[asked];
  if (p.tag === 'PRICE') return `[PRICE] Honestly, ${budget} is all we have. ${hinglish ? 'Thoda adjust kar lo na?' : 'Can you make it work for that?'}`;
  const hello = asked === 0 ? 'Hi! Thanks for calling. ' : '';
  return `[${p.tag}] ${hello}${p.title} is included in the price, right? ${hinglish ? 'Wo toh basic hai na.' : 'I assumed that was basic.'}`;
}

function replay(prompt) {
  const commitments = [];
  for (const [, turn, said] of prompt.matchAll(/^\[(T\d+)\] FREELANCER: (.+)$/gm)) {
    const sentence = said.split(/(?<=[.!?])\s+/).find((s) => /(haan|yes|sure|fine|okay|\bok\b|will do|kar denge|ho jayega|no problem|included|free)/i.test(s));
    if (!sentence) continue;
    commitments.push({
      turn,
      quote: sentence.replace(/[.!?]+$/, ''),
      kind: /free|discount|₹|\d+k\b/i.test(sentence) ? 'price' : 'ambiguous',
      requirement: null,
      suggestion: 'Put a limit on it: say exactly what is included and what costs extra.',
    });
  }
  return { commitments };
}

function research() {
  return 'This kind of work usually means exporting the existing catalogue, cleaning titles, prices and sizes, and uploading images in bulk [1]. Photo editing and product variants such as sizes are what make it take longer [2].';
}

function reply(prompt) {
  const amounts = [...prompt.matchAll(/₹[\d,]+/g)].map((m) => m[0]);
  const hinglish = prompt.includes('Friendly Hinglish');
  if (prompt.includes('WALKING AWAY')) {
    return hinglish
      ? 'Hi! Details share karne ke liye thank you. Honestly, jo sab aapne bataya hai wo is budget mein possible nahi hoga, aur main aadha kaam deliver nahi karna chahta. Agar baad mein ek chhota version banana ho, toh zaroor batana. Diwali sale ke liye all the best!'
      : "Hi! Thank you for sharing the details. I've gone through everything, and the budget doesn't cover the work you described, so I'll pass on this one rather than cut corners. If you'd like to start with something smaller later, I'd be happy to talk. All the best for the Diwali sale!";
  }
  if (prompt.includes('CHANGING THE DEAL')) {
    return `Hi! Thanks for the details. I've put together two options:\n\n1. Within your budget of ${amounts[0] ?? 'your budget'}: the store on a ready theme, mobile layouts and one round of changes. Your team adds the products using a template I'll share.\n2. The full scope at ${amounts[amounts.length - 1] ?? 'the full price'}: everything above, plus all 200 products with photos, UPI and card payments set up and tested, and two rounds of changes.\n\nWhich works better for you? Also, who will prepare the product details and photos?`;
  }
  return `Hi! Thanks for the details. I can take this on for ${amounts[0] ?? 'the quoted price'} for the full scope: store setup, mobile layouts, payments, all products and photos added, and two rounds of changes. To start, I'll need the product list and photos. Shall we go ahead?`;
}

function respond(messages) {
  const system = messages.filter((m) => m.role === 'system').map(textOf).join('\n');
  const users = messages.filter((m) => m.role === 'user').map(textOf);
  const first = users[0] ?? '';
  if (system.includes('role-playing a prospective client')) return clientLine(system, messages);
  if (first.includes('<sources>')) {
    if (!brokeJsonOnce) {
      brokeJsonOnce = true;
      return '{"summary": "broken", "requirements": [ {"title": "x" ';
    }
    return JSON.stringify(extraction(first));
  }
  if (first.includes('<transcript>')) return JSON.stringify(replay(first));
  if (first.includes('Search results:')) return research();
  if (first.includes('Draft a reply to the client')) return reply(first);
  return 'OK';
}

async function chat(req, res, body) {
  if (!(req.headers.authorization ?? '').startsWith('Bearer ')) return json(res, 401, { error: { message: 'Missing key' } });
  if (req.headers.authorization === 'Bearer bad-key') return json(res, 401, { error: { message: 'Invalid key' } });
  const { model, messages = [], stream } = JSON.parse(body.toString() || '{}');
  log(`chat model=${model}${model === EXPECTED_MODEL ? '' : ' (UNEXPECTED)'} stream=${Boolean(stream)} messages=${messages.length} roles=${messages.map((m) => m.role[0]).join('')}`);
  const content = respond(messages);
  await delay(250);
  const created = Math.floor(Date.now() / 1000);
  if (!stream) {
    return json(res, 200, {
      id: 'chatcmpl-mock',
      object: 'chat.completion',
      created,
      model,
      choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 120, completion_tokens: 60, total_tokens: 180 },
    });
  }
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  const chunk = (delta, finish = null, extra = {}) =>
    res.write(`data: ${JSON.stringify({ id: 'chatcmpl-mock', object: 'chat.completion.chunk', created, model, choices: [{ index: 0, delta, finish_reason: finish }], ...extra })}\n\n`);
  chunk({ role: 'assistant', content: '' });
  for (const piece of content.match(/.{1,16}/gs) ?? [content]) {
    chunk({ content: piece });
    await delay(10);
  }
  chunk({}, 'stop', { usage: { prompt_tokens: 120, completion_tokens: 60, total_tokens: 180 } });
  res.write('data: [DONE]\n\n');
  res.end();
}

function embedOne(text) {
  const v = new Array(64).fill(0);
  for (const w of String(text).toLowerCase().match(/[a-z0-9]{3,}/g) ?? []) {
    let h = 0;
    for (const ch of w) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    v[h % 64] += 1;
  }
  const n = Math.hypot(...v) || 1;
  return v.map((x) => x / n);
}

// ---------------------------------------------------------------- other services

const assistants = new Map(); // id -> [{ id, content, metadata, created_at }]
const objects = new Map(); // spaces key -> { type, body }

async function backboard(req, res, path, body) {
  if (!req.headers['x-api-key']) return json(res, 401, { detail: 'Missing X-API-Key' });
  if (req.method === 'POST' && path === '/assistants') {
    const id = randomUUID();
    assistants.set(id, []);
    log('backboard: created assistant', id);
    return json(res, 200, { assistant_id: id, name: JSON.parse(body.toString()).name, created_at: new Date().toISOString() });
  }
  const m = path.match(/^\/assistants\/([^/]+)\/memories(?:\/(search|[^/]+))?$/);
  if (!m) return json(res, 404, { detail: 'Not found' });
  const list = assistants.get(m[1]) ?? assistants.set(m[1], []).get(m[1]);
  if (req.method === 'GET' && !m[2]) return json(res, 200, { memories: list, total_count: list.length, page: 1, page_size: 100, total_pages: 1 });
  if (req.method === 'POST' && !m[2]) {
    const { content, metadata } = JSON.parse(body.toString());
    list.push({ id: `mem_${randomUUID().slice(0, 8)}`, content, metadata: metadata ?? {}, created_at: new Date().toISOString() });
    log('backboard: memory added:', content.slice(0, 70));
    return json(res, 201, {});
  }
  if (req.method === 'POST' && m[2] === 'search') {
    const { query, limit = 5 } = JSON.parse(body.toString());
    const words = new Set(String(query).toLowerCase().split(/\W+/).filter((w) => w.length > 3));
    const hits = list
      .map((x) => ({ ...x, score: x.content.toLowerCase().split(/\W+/).filter((w) => words.has(w)).length / 10 }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    return json(res, 200, { memories: hits, total_count: hits.length });
  }
  if (req.method === 'DELETE' && m[2]) {
    const i = list.findIndex((x) => x.id === decodeURIComponent(m[2]));
    if (i >= 0) list.splice(i, 1);
    res.writeHead(204).end();
    return;
  }
  return json(res, 405, { detail: 'Method not allowed' });
}

async function elevenlabs(req, res, path, body) {
  if (!req.headers['xi-api-key']) return json(res, 401, { detail: 'Missing xi-api-key' });
  if (path === '/v1/convai/secrets' && req.method === 'POST') {
    const { type, name, value } = JSON.parse(body.toString());
    if (type !== 'new' || !name || !value) return json(res, 422, { detail: 'type, name and value are required' });
    log('elevenlabs: secret stored', name);
    return json(res, 200, { type: 'stored', secret_id: `sec_${randomUUID().slice(0, 8)}`, name });
  }
  if (path === '/v1/convai/agents/create' && req.method === 'POST') {
    const agent = JSON.parse(body.toString());
    const llm = agent.conversation_config?.agent?.prompt;
    log('elevenlabs: agent created, llm =', llm?.llm, '->', llm?.custom_llm?.url, 'secret', llm?.custom_llm?.api_key?.secret_id);
    return json(res, 200, { agent_id: `agent_${randomUUID().slice(0, 8)}` });
  }
  if (path.startsWith('/v1/convai/agents/') && req.method === 'PATCH') {
    log('elevenlabs: agent updated', path.split('/').pop());
    return json(res, 200, {});
  }
  if (path.startsWith('/v1/convai/conversation/get-signed-url')) {
    return json(res, 200, { signed_url: 'wss://example.invalid/v1/convai/conversation?mock=1' });
  }
  if (path === '/v1/speech-to-text' && req.method === 'POST') {
    return json(res, 200, {
      text: 'Hi, Saanjh Studio here. Can you also add a size chart page? And we need it live in one week, na.',
      language_code: 'en',
    });
  }
  return json(res, 404, { detail: 'Not found' });
}

async function spaces(req, res, path, body) {
  const key = decodeURIComponent(path.slice(1));
  if (req.method === 'PUT') {
    if (!String(req.headers.authorization ?? '').startsWith('AWS4-HMAC-SHA256')) return json(res, 403, { error: 'unsigned' });
    objects.set(key, { type: req.headers['content-type'] ?? 'application/octet-stream', body });
    log('spaces: stored', key, `${body.length} bytes`);
    res.writeHead(200).end();
    return;
  }
  if (req.method === 'GET') {
    const o = objects.get(key);
    if (!o) return json(res, 404, { error: 'NoSuchKey' });
    res.writeHead(200, { 'Content-Type': o.type });
    res.end(o.body);
    return;
  }
  if (req.method === 'DELETE') {
    objects.delete(key);
    res.writeHead(204).end();
    return;
  }
  return json(res, 405, { error: 'Method not allowed' });
}

// ---------------------------------------------------------------- router

http
  .createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    const path = url.pathname;
    const body = await readBody(req);
    try {
      if (path === '/v1/models') return json(res, 200, { object: 'list', data: [{ id: EXPECTED_MODEL, object: 'model' }, { id: 'mock-embedding', object: 'model' }] });
      if (path === '/v1/chat/completions' && req.method === 'POST') return await chat(req, res, body);
      if (path === '/v1/embeddings' && req.method === 'POST') {
        const { input } = JSON.parse(body.toString());
        const inputs = Array.isArray(input) ? input : [input];
        return json(res, 200, { object: 'list', data: inputs.map((t, i) => ({ object: 'embedding', index: i, embedding: embedOne(t) })) });
      }
      if (path === '/search.json') {
        log('serpapi:', url.searchParams.get('q'));
        if (!url.searchParams.get('api_key')) return json(res, 401, { error: 'Missing api_key' });
        return json(res, 200, {
          organic_results: [
            { title: 'How to migrate products to a new online store (mock)', link: 'https://example.com/migrate-products', snippet: 'Export the catalogue, clean it up, then bulk upload with images.' },
            { title: 'Product photo checklist for small shops (mock)', link: 'https://example.com/photo-checklist', snippet: 'Cropping, backgrounds and variants take the most time.' },
            { title: 'Pricing website maintenance (mock)', link: 'https://example.com/maintenance', snippet: 'Agree a monthly hour cap for small changes.' },
          ],
        });
      }
      if (path.startsWith('/backboard')) return await backboard(req, res, path.slice('/backboard'.length), body);
      if (path.startsWith('/elevenlabs')) return await elevenlabs(req, res, path.slice('/elevenlabs'.length), body);
      if (path.startsWith('/spaces')) return await spaces(req, res, path.slice('/spaces'.length), body);
      return json(res, 404, { error: `No mock for ${req.method} ${path}` });
    } catch (err) {
      log('mock error', err);
      return json(res, 500, { error: String(err) });
    }
  })
  .listen(PORT, '127.0.0.1', () => log(`Panga mock services on http://127.0.0.1:${PORT}`));

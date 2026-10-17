// Checks the voice path's streaming against the real model: Mastra stream ->
// TagStripper -> spoken text, as the ElevenLabs endpoint does it.
//   npx tsx scripts/check-stream.ts

import { TagStripper } from '../src/lib/rehearsal';
import { streamText } from '../src/server/llm';

const persona = `You are role-playing a prospective client on a call with a freelancer. Keep replies under 40 words.
Start every reply with the tag of the point you are pressing, like [R4], or [PRICE] for the budget, or [-] when none.
Work you expect: [R4] Product migration: "we have around 200 products on Instagram"`;

async function main(): Promise<void> {
  try {
    process.loadEnvFile('.env.local');
  } catch {
    // use the environment as it is
  }
  const started = Date.now();
  let first = 0;
  let spoken = '';
  const stripper = new TagStripper(new Set(['R4']));
  const stream = await streamText(
    'clientSimulator',
    [
      { role: 'user', content: '(The call has just connected. Speak first.)' },
      { role: 'assistant', content: '[R4] Hi! The 200 products are included, right?' },
      { role: 'user', content: 'Haan, upload kar denge.' },
    ],
    { instructions: persona, temperature: 0.8, maxTokens: 160 },
  );
  for await (const chunk of stream) {
    const out = stripper.feed(chunk);
    if (out && !first) first = Date.now() - started;
    spoken += out;
  }
  spoken += stripper.flush();
  console.log(`first spoken text after ${first} ms, done after ${Date.now() - started} ms`);
  console.log('tag:', stripper.requirementId, '| tag leaked into speech:', /\[(R\d+|PRICE|-)\]/.test(spoken));
  console.log('spoken:', spoken.trim());
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

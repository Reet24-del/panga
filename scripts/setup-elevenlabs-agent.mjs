// Creates (or updates) the ElevenLabs agent used for voice rehearsals.
//
// The agent's language model is Panga's own endpoint (/api/sim/v1), so what
// the simulated client says comes from Gemma on DigitalOcean, grounded in
// each deal's brief. ElevenLabs only handles speech in and out.
//
// Needs, in .env.local or the environment:
//   ELEVENLABS_API_KEY   your ElevenLabs API key
//   PANGA_PUBLIC_URL     the https URL where Panga is deployed
//   PANGA_SIM_SECRET     the same secret the Panga server has
// Optional: ELEVENLABS_AGENT_ID (to update an existing agent), ELEVENLABS_VOICE_ID.
//
//   npm run setup:voice

try {
  process.loadEnvFile('.env.local');
} catch {
  // No .env.local: use the environment as it is.
}

const key = process.env.ELEVENLABS_API_KEY?.trim();
const base = (process.env.ELEVENLABS_BASE_URL?.trim() || 'https://api.elevenlabs.io').replace(/\/$/, '');
const publicUrl = process.env.PANGA_PUBLIC_URL?.trim().replace(/\/$/, '');
const simSecret = process.env.PANGA_SIM_SECRET?.trim();
const existing = process.env.ELEVENLABS_AGENT_ID?.trim();
const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim();

const missing = [!key && 'ELEVENLABS_API_KEY', !publicUrl && 'PANGA_PUBLIC_URL', !simSecret && 'PANGA_SIM_SECRET'].filter(Boolean);
if (missing.length) {
  console.error(`Missing ${missing.join(', ')}. Add them to .env.local and run again.`);
  process.exit(1);
}
if (!/^https:\/\//.test(publicUrl) && !process.env.ELEVENLABS_BASE_URL) {
  console.error('PANGA_PUBLIC_URL must be an https URL that ElevenLabs can reach (your App Platform URL).');
  process.exit(1);
}

async function call(method, path, body) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} failed with ${res.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : {};
}

const secret = await call('POST', '/v1/convai/secrets', { type: 'new', name: `panga-sim-secret-${Date.now()}`, value: simSecret });
console.log('Stored the simulated-client secret in ElevenLabs.');

const agent = {
  name: 'Panga client simulator',
  conversation_config: {
    agent: {
      first_message: 'Hello? Am I speaking with the developer?',
      language: 'en',
      prompt: {
        prompt: 'You are a simulated client in a Panga rehearsal call. PANGA_CALL:{{panga_call}}',
        llm: 'custom-llm',
        custom_llm: {
          url: `${publicUrl}/api/sim/v1`,
          model_id: 'panga-client',
          api_key: { secret_id: secret.secret_id },
          api_type: 'chat_completions',
        },
      },
    },
    ...(voiceId ? { tts: { voice_id: voiceId } } : {}),
  },
  platform_settings: {
    overrides: {
      conversation_config_override: { agent: { first_message: true, language: true } },
      custom_llm_extra_body: true,
    },
    auth: { enable_auth: true },
  },
};

if (existing) {
  await call('PATCH', `/v1/convai/agents/${existing}`, agent);
  console.log(`Updated agent ${existing}.`);
} else {
  const created = await call('POST', '/v1/convai/agents/create', agent);
  console.log(`Created agent ${created.agent_id}.`);
  console.log(`\nAdd this to .env.local and to App Platform's environment variables:\n  ELEVENLABS_AGENT_ID=${created.agent_id}`);
}
console.log(`The agent asks ${publicUrl}/api/sim/v1/chat/completions what the client says.`);

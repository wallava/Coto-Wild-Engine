/**
 * Smoke spike de la API de Anthropic — Round 0.5 Fase 5.
 *
 * Standalone Node ESM. NO depende del build del juego. NO toca localStorage.
 *
 * Lee API key de:
 *   1. ANTHROPIC_API_KEY env var.
 *   2. --key <value> argumento CLI.
 *
 * Tests ejecutados:
 *   1. Streaming básico con haiku-4-5: pide 1 palabra, imprime tokens.
 *   2. 401: API key inválida → debe responder 401.
 *   3. Prompt caching: dos llamadas con mismo system block grande.
 *      Verifica cacheCreationTokens > 0 en primera, cacheReadTokens > 0 en segunda.
 *
 * Uso:
 *   ANTHROPIC_API_KEY=sk-ant-... node scripts/llm-smoke.mjs
 *   node scripts/llm-smoke.mjs --key sk-ant-...
 *
 * Salida: prints estructurados + exit 0 si pasa, exit 1 si falla.
 */

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
const MODEL_API_ID = 'claude-haiku-4-5-20251001';

// ── Args ─────────────────────────────────────────────────────────────

function getApiKey() {
  const fromEnv = process.env.ANTHROPIC_API_KEY;
  if (fromEnv && fromEnv.trim() !== '') return fromEnv.trim();
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--key' && argv[i + 1]) return argv[i + 1];
  }
  console.error('❌ No API key. Pasá ANTHROPIC_API_KEY env var o --key <value>.');
  process.exit(1);
}

const API_KEY = getApiKey();

// Helper: NUNCA imprimir API key en logs.
function safeKey() {
  if (!API_KEY) return '<missing>';
  return API_KEY.slice(0, 8) + '...' + API_KEY.slice(-4);
}

console.log(`[smoke] usando API key ${safeKey()} (mascarada)`);
console.log(`[smoke] modelo: ${MODEL_API_ID}`);
console.log('');

// ── Test 1: streaming básico ─────────────────────────────────────────

async function test1Streaming() {
  console.log('─── Test 1: streaming básico ───');
  const t0 = Date.now();

  const body = {
    model: MODEL_API_ID,
    max_tokens: 50,
    system: [{ type: 'text', text: 'Respondé con UNA SOLA palabra.' }],
    messages: [{ role: 'user', content: 'Saludá.' }],
    stream: true,
  };

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'anthropic-version': API_VERSION,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.error(`❌ HTTP ${res.status}: ${await res.text()}`);
    return false;
  }

  console.log(`[smoke] HTTP ${res.status} OK, leyendo stream...`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let firstTokenMs = null;
  let usage = null;
  let textOutput = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (payload === '' || payload === '[DONE]') continue;
      try {
        const ev = JSON.parse(payload);
        if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') {
          if (firstTokenMs === null) {
            firstTokenMs = Date.now() - t0;
            console.log(`[smoke] primer token en ${firstTokenMs}ms`);
          }
          textOutput += ev.delta.text;
          process.stdout.write(ev.delta.text);
        }
        if (ev.type === 'message_delta' && ev.usage) {
          usage = { ...(usage ?? {}), output_tokens: ev.usage.output_tokens };
        }
        if (ev.type === 'message_start' && ev.message?.usage) {
          usage = { ...(usage ?? {}), ...ev.message.usage };
        }
      } catch (e) {
        // ignore parse errors en líneas no-JSON
      }
    }
  }

  console.log('');
  console.log(`[smoke] texto: "${textOutput.trim()}"`);
  console.log(`[smoke] usage:`, usage);
  console.log(`[smoke] ✅ Test 1 OK`);
  console.log('');
  return true;
}

// ── Test 2: 401 con key inválida ─────────────────────────────────────

async function test2InvalidKey() {
  console.log('─── Test 2: API key inválida → 401 ───');
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': 'sk-ant-invalid-key-for-testing',
      'anthropic-version': API_VERSION,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL_API_ID,
      max_tokens: 5,
      messages: [{ role: 'user', content: 'hi' }],
    }),
  });
  if (res.status === 401) {
    console.log(`[smoke] HTTP 401 esperado ✅`);
    console.log('');
    return true;
  }
  console.error(`❌ esperaba 401, recibí ${res.status}`);
  return false;
}

// ── Test 3: prompt caching ───────────────────────────────────────────

const LARGE_SYSTEM = `Sos un asistente de prueba para validar el sistema de prompt caching de Anthropic.

Características:
- Tu personalidad es muy estable y nunca cambia.
- Respondés siempre con la palabra exacta "ok".
- Sos paciente y siempre sigues las instrucciones.

`.repeat(200);   // ~ 5000+ tokens (suficiente > 4096 mínimo Haiku)

async function callWithCachedSystem() {
  const body = {
    model: MODEL_API_ID,
    max_tokens: 10,
    system: [{
      type: 'text',
      text: LARGE_SYSTEM,
      cache_control: { type: 'ephemeral' },
    }],
    messages: [{ role: 'user', content: 'Respondé con la palabra ok.' }],
  };

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'anthropic-version': API_VERSION,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.error(`❌ HTTP ${res.status}: ${await res.text()}`);
    return null;
  }
  const data = await res.json();
  return data.usage;
}

async function test3PromptCaching() {
  console.log('─── Test 3: prompt caching ───');
  console.log('[smoke] llamada 1 (cache write)...');
  const usage1 = await callWithCachedSystem();
  if (!usage1) return false;
  console.log('[smoke] usage 1:', usage1);

  console.log('[smoke] llamada 2 (cache hit esperado)...');
  const usage2 = await callWithCachedSystem();
  if (!usage2) return false;
  console.log('[smoke] usage 2:', usage2);

  const cacheCreation1 = usage1.cache_creation_input_tokens ?? 0;
  const cacheRead2 = usage2.cache_read_input_tokens ?? 0;

  console.log('');
  console.log(`[smoke] cache_creation_input_tokens (call 1): ${cacheCreation1}`);
  console.log(`[smoke] cache_read_input_tokens (call 2): ${cacheRead2}`);

  if (cacheCreation1 > 0 && cacheRead2 > 0) {
    console.log('[smoke] ✅ Test 3 OK — prompt caching funciona');
    console.log('');
    return true;
  }
  console.error('❌ caching no funcionó como esperado');
  return false;
}

// ── Run ──────────────────────────────────────────────────────────────

async function main() {
  let allOk = true;
  try {
    if (!(await test1Streaming())) allOk = false;
  } catch (e) {
    console.error('❌ Test 1 crashed:', e.message);
    allOk = false;
  }
  try {
    if (!(await test2InvalidKey())) allOk = false;
  } catch (e) {
    console.error('❌ Test 2 crashed:', e.message);
    allOk = false;
  }
  try {
    if (!(await test3PromptCaching())) allOk = false;
  } catch (e) {
    console.error('❌ Test 3 crashed:', e.message);
    allOk = false;
  }

  if (allOk) {
    console.log('🎉 Todos los smoke tests pasaron.');
    process.exit(0);
  } else {
    console.log('💥 Algún test falló.');
    process.exit(1);
  }
}

main();

/**
 * LLM-agnostic inference service — ONE function for the whole app.
 *
 * Every chat message, orchestrator call or agent action goes through
 * `generateText`, which routes to the right wire protocol based on the
 * provider configured in Settings. Supported protocols:
 *   - 'google'             → Gemini REST API (generativelanguage.googleapis.com)
 *   - 'openai-compatible'  → OpenAI, and any local runtime (Ollama, LMLite, vLLM)
 *   - 'anthropic'          → Anthropic Messages API
 *
 * SECURITY: keys are supplied by the user at runtime, kept in localStorage on
 * the user's device only, and sent exclusively to the chosen provider over
 * HTTPS. Nothing is proxied through third parties. Without a key the service
 * degrades to a deterministic local simulation so the whole OS stays usable
 * offline (and in demos).
 */
import type { LLMProvider } from '@/core/types';

export interface GenerateRequest {
  provider: LLMProvider;
  model: string;
  system?: string;
  prompt: string;
}

export interface GenerateResult {
  text: string;
  simulated: boolean;
}

/** Deterministic offline fallback used when no API key is configured.
 *  It must NEVER echo the system prompt back to the user (that reads as a
 *  broken agent); it only acknowledges the request, briefly. */
function simulate(req: GenerateRequest): GenerateResult {
  const excerpt = req.prompt.slice(0, 120) + (req.prompt.length > 120 ? '…' : '');
  return {
    simulated: true,
    text: `Bien reçu : « ${excerpt} ».\n(simulation locale · ${req.model} — ajoutez une clé API dans les Réglages pour une réponse générée.)`,
  };
}

async function callGoogle(req: GenerateRequest): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(req.model)}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': req.provider.apiKey },
    body: JSON.stringify({
      ...(req.system ? { systemInstruction: { parts: [{ text: req.system }] } } : {}),
      contents: [{ role: 'user', parts: [{ text: req.prompt }] }],
    }),
  });
  if (!res.ok) throw new Error(`Google API ${res.status}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

async function callOpenAICompatible(req: GenerateRequest): Promise<string> {
  const base = req.provider.baseUrl?.replace(/\/$/, '') || 'https://api.openai.com/v1';
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(req.provider.apiKey ? { Authorization: `Bearer ${req.provider.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: req.model,
      messages: [
        ...(req.system ? [{ role: 'system', content: req.system }] : []),
        { role: 'user', content: req.prompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI-compatible API ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

async function callAnthropic(req: GenerateRequest): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': req.provider.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: req.model,
      max_tokens: 1024,
      ...(req.system ? { system: req.system } : {}),
      messages: [{ role: 'user', content: req.prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}`);
  const data = await res.json();
  return data.content?.[0]?.text ?? '';
}

/** Single entry point of the inference layer (SSOT). */
export async function generateText(req: GenerateRequest): Promise<GenerateResult> {
  const isLocal = req.provider.protocol === 'openai-compatible' && !!req.provider.baseUrl;
  if (!req.provider.apiKey && !isLocal) return simulate(req);

  try {
    switch (req.provider.protocol) {
      case 'google':
        return { text: await callGoogle(req), simulated: false };
      case 'openai-compatible':
        return { text: await callOpenAICompatible(req), simulated: false };
      case 'anthropic':
        return { text: await callAnthropic(req), simulated: false };
    }
  } catch (err) {
    // Graceful degradation: never crash the OS on a provider outage.
    console.error('LLM call failed, falling back to simulation:', err);
    return simulate(req);
  }
}

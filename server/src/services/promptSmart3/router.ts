import { ProviderConfig } from './providerTypes';
import { callOpenAICompatible } from './openaiClient';

interface RouteResult {
  content: string;
  provider: string;
  latencyMs: number;
}

const MAX_RETRIES = 5;

export async function routeRequest(
  _providers: ProviderConfig[],
  messages: Array<{ role: string; content: string }>,
  selectFn: (tried: Set<string>) => { config: ProviderConfig; name: string } | null,
  reportSuccess: (name: string) => void,
  reportFailure: (name: string) => void,
): Promise<RouteResult> {
  const tried = new Set<string>();
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const selected = selectFn(tried);
    if (!selected) {
      console.warn(`[PromptSmart3] No provider selected on attempt ${attempt + 1}`);
      break;
    }
    if (tried.has(selected.name)) {
      continue;
    }
    tried.add(selected.name);

    const start = Date.now();
    try {
      console.log(`[PromptSmart3] Attempt ${attempt + 1}: using provider "${selected.name}"`);
      const content = await callOpenAICompatible(
        selected.config,
        messages as Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
      );
      const latencyMs = Date.now() - start;
      reportSuccess(selected.name);
      return { content, provider: selected.name, latencyMs };
    } catch (err: unknown) {
      console.error(`[PromptSmart3] Provider "${selected.name}" failed (${Date.now() - start}ms):`, (err instanceof Error ? err.message : String(err)));
      reportFailure(selected.name);
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError || new Error('No available providers');
}

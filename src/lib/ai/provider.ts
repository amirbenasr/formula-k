import { createDeepSeek } from '@ai-sdk/deepseek'
import type { LanguageModel } from 'ai'

/**
 * DeepSeek model used by the admin assistant.
 *
 * `deepseek-flash` is an unversioned alias that currently serves DeepSeek V4.1
 * Flash. The provider package also accepts the versioned ids (`deepseek-v4-flash`,
 * `deepseek-v4-pro`). Override with AI_MODEL.
 */
export const AI_MODEL_ID = process.env.AI_MODEL || 'deepseek-flash'

/**
 * The DeepSeek SDK would read DEEPSEEK_API_KEY on its own, but it only throws
 * (an opaque LoadAPIKeyError) at call time. We resolve it eagerly so a missing
 * key surfaces as a clear message in the chat instead of a 500 from the agent loop.
 */
export function getDeepSeekApiKey(): string {
  const key = process.env.DEEPSEEK_API_KEY

  if (!key) {
    throw new Error(
      'DEEPSEEK_API_KEY is not set. Add it to .env to enable the admin AI assistant.',
    )
  }

  return key
}

/**
 * The cheapest model we can call, for mechanical rewriting rather than reasoning
 * (see `competitorPrices/enhanceQuery.ts`).
 *
 * Deliberately a separate variable from `AI_MODEL`: pointing the admin assistant
 * at a pro model should not also make every price lookup expensive. `deepseek-flash`
 * is the cheapest alias the provider offers today.
 */
export const CHEAP_MODEL_ID = process.env.AI_CHEAP_MODEL || 'deepseek-flash'

export function getChatModel(): LanguageModel {
  return createDeepSeek({ apiKey: getDeepSeekApiKey() })(AI_MODEL_ID)
}

export function getCheapModel(): LanguageModel {
  return createDeepSeek({ apiKey: getDeepSeekApiKey() })(CHEAP_MODEL_ID)
}

/**
 * Whether the DeepSeek key is configured at all.
 *
 * Callers that treat the model as an optional improvement — rather than the
 * whole point of the request — check this first so a missing key silently
 * degrades instead of throwing.
 */
export const hasDeepSeekApiKey = (): boolean => Boolean(process.env.DEEPSEEK_API_KEY?.trim())

/**
 * DeepSeek V4-generation models (which includes the `deepseek-flash` alias)
 * enable "thinking" by default. Inside a tool-calling loop that is harmful:
 *
 *  - it silently disables temperature and topP (the API ignores them), and
 *  - it bills reasoning tokens on every single turn.
 *
 * Verified against @ai-sdk/deepseek source: the message converter emits
 * `reasoning_content: reasoning ?? ""` for V4 model ids, which satisfies
 * DeepSeek's requirement that every assistant turn carry the field. So
 * round-tripping is already safe either way; disabling thinking just keeps the
 * loop cheap and predictable. Set AI_THINKING=enabled to opt back in.
 */
/**
 * DeepSeek reads its options from `providerOptions.deepseek`. The return type is
 * left inferred: `ProviderOptions` is not re-exported from `ai`'s root and
 * `@ai-sdk/provider-utils` is only a transitive dependency under pnpm's strict
 * layout, so the object is structurally compatible rather than nominally typed.
 */
export function thinkingProviderOptions(
  override?: 'disabled' | 'enabled',
) {
  const type = override ?? (process.env.AI_THINKING === 'enabled' ? 'enabled' : 'disabled')

  return { deepseek: { thinking: { type } } }
}

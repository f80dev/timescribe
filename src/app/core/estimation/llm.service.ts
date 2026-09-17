import { Injectable } from '@angular/core';
import OpenAI from 'openai';
import { z } from 'zod';
import { AppSettings } from '../models/settings.model';
import {
  LlmEstimationRequest,
  LlmEstimationResponse,
  buildEstimationPrompt,
  PROMPT_VERSION,
} from './prompts/estimate-duration';

/**
 * Schéma Zod pour la validation runtime de la réponse LLM.
 * Conforme au contrat `LlmEstimationResponse` (§5.4 du CDC).
 *
 * Toute réponse non conforme est rejetée → retry possible côté orchestrateur.
 */
const ResponseSchema = z.object({
  durationMinutes: z.number().int().positive(),
  confidence: z.number().min(0).max(1),
  rationale: z.string().min(1),
  similarTaskIds: z.array(z.string()).optional(),
});

/**
 * Factory injectable pour le client OpenAI. Permet de mocker dans les tests.
 */
export interface OpenAIClientFactory {
  create(apiKey: string, baseURL: string): unknown;
}

export const DEFAULT_OPENAI_FACTORY: OpenAIClientFactory = {
  create(apiKey, baseURL) {
    return new OpenAI({ apiKey, baseURL });
  },
};

/**
 * Service LLM MiniMax M3 (cf §5.4 + ADR-002 du CDC).
 *
 * Utilise le SDK `openai` avec `baseURL` surchargé → endpoint MiniMax.
 * Impose `response_format: { type: 'json_object' }` (PAS json_schema, cf ADR-002).
 * Valide la réponse via Zod (réponse conforme ou throw).
 *
 * Le `thinking: { type: 'adaptive' }` est envoyé si le provider le supporte
 * (paramètre standard OpenAI-compatible).
 */
@Injectable({ providedIn: 'root' })
export class LlmService {
  private readonly factory: OpenAIClientFactory = DEFAULT_OPENAI_FACTORY;

  /** Override la factory (utilisé par les tests). */
  setFactory(factory: OpenAIClientFactory): void {
    (this as unknown as { factory: OpenAIClientFactory }).factory = factory;
  }

  /**
   * Estime la durée d'une tâche. Retourne un objet typé conforme au schéma,
   * ou throw si la réponse est invalide / erreur API.
   */
  async estimateDuration(
    request: LlmEstimationRequest,
    settings: AppSettings,
    apiKey: string,
  ): Promise<LlmEstimationResponse> {
    const client = this.factory.create(apiKey, settings.llmBaseUrl) as {
      chat: { completions: { create: (p: unknown) => Promise<unknown> } };
    };
    const prompt = buildEstimationPrompt(request);
    const payload = {
      model: settings.llmModel,
      messages: [
        { role: 'system' as const, content: prompt.system },
        { role: 'user' as const, content: prompt.user },
      ],
      response_format: { type: 'json_object' as const },
      thinking: { type: 'adaptive' as const },
      temperature: settings.temperature,
      max_completion_tokens: settings.maxCompletionTokens,
    };
    let response: unknown;
    try {
      response = await client.chat.completions.create(payload);
    } catch (e) {
      throw this.mapApiError(e);
    }
    const content = this.extractContent(response);
    return this.parseAndValidate(content);
  }

  /** Extrait le contenu textuel du premier choice de la réponse OpenAI. */
  private extractContent(response: unknown): string {
    const r = response as {
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    const raw = r?.choices?.[0]?.message?.content;
    if (typeof raw === 'string') return raw;
    if (Array.isArray(raw)) {
      // Format OpenAI multi-part : on concatène les parties texte
      return raw
        .map((p) => (typeof p === 'object' && p && 'text' in p ? String((p as { text?: string }).text ?? '') : ''))
        .join('');
    }
    throw new Error('Réponse LLM vide ou mal formée.');
  }

  /** Parse le contenu et valide via Zod. */
  private parseAndValidate(content: string): LlmEstimationResponse {
    let json: unknown;
    try {
      json = JSON.parse(content);
    } catch {
      throw new Error('LLM response is not valid JSON');
    }
    const parsed = ResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new Error(`LLM response does not match schema: ${parsed.error.message}`);
    }
    return parsed.data;
  }

  /** Mappe les erreurs API vers des exceptions explicites. */
  private mapApiError(e: unknown): Error {
    const err = e as { status?: number; message?: string };
    const status = err?.status;
    const msg = err?.message ?? 'Erreur LLM inconnue';
    if (status === 401) return new Error(`LLM 401 Unauthorized — vérifie la clé API. ${msg}`);
    if (status === 429) return new Error(`LLM 429 Rate limit — réessaie plus tard. ${msg}`);
    if (status && status >= 500) return new Error(`LLM ${status} Server error — réessaie. ${msg}`);
    return new Error(`LLM error: ${msg}`);
  }
}

/** Expose la version du prompt pour traçabilité. */
export const CURRENT_PROMPT_VERSION = PROMPT_VERSION;
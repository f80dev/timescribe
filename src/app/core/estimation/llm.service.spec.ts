import { TestBed } from '@angular/core/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { LlmService, OpenAIClientFactory } from './llm.service';
import { LlmEstimationRequest } from './prompts/estimate-duration';
import { AppSettings } from '../models/settings.model';

interface OpenAIMock {
  chat: {
    completions: {
      create: ReturnType<typeof vi.fn>;
    };
  };
}

function makeOpenAIMock(): OpenAIMock {
  return {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  durationMinutes: 45,
                  confidence: 0.78,
                  rationale: 'Basé sur tâches similaires dans le corpus.',
                  similarTaskIds: ['hist-1', 'hist-2'],
                }),
              },
            },
          ],
        }),
      },
    },
  };
}

function factoryFor(openai: OpenAIMock): OpenAIClientFactory {
  return { create: () => openai };
}

const SETTINGS: AppSettings = {
  llmProvider: 'minimax',
  llmModel: 'MiniMax-M3',
  llmBaseUrl: 'https://api.minimax.io/v1',
  manualFallbackThreshold: 5,
  corpusMaxChars: 100_000,
  historicalMaxTasks: 50,
  temperature: 0.2,
  maxCompletionTokens: 1024,
  theme: 'light',
};

function makeRequest(overrides: Partial<LlmEstimationRequest> = {}): LlmEstimationRequest {
  return {
    taskTitle: 'Préparer réunion Q3',
    corpusText: 'extrait du corpus documentaire',
    historicalTasks: [],
    ...overrides,
  };
}

describe('LlmService', () => {
  let openai: OpenAIMock;
  let svc: LlmService;

  beforeEach(() => {
    openai = makeOpenAIMock();
    TestBed.configureTestingModule({});
    svc = TestBed.inject(LlmService);
    svc.setFactory(factoryFor(openai));
  });

  it('estimateDuration() envoie un payload conforme à la spec §5.4', async () => {
    await svc.estimateDuration(makeRequest(), SETTINGS, 'fake-api-key');
    expect(openai.chat.completions.create).toHaveBeenCalledTimes(1);
    const payload = openai.chat.completions.create.mock.calls[0][0];
    expect(payload.model).toBe('MiniMax-M3');
    expect(payload.response_format).toEqual({ type: 'json_object' });
    expect(payload.thinking).toEqual({ type: 'adaptive' });
    expect(payload.temperature).toBe(0.2);
    expect(payload.max_completion_tokens).toBe(1024);
    expect(payload.messages.length).toBeGreaterThanOrEqual(2);
    expect(payload.messages[0].role).toBe('system');
    expect(payload.messages[1].role).toBe('user');
  });

  it('GARDE-FOU §13/ADR-002 : response_format est json_object, JAMAIS json_schema', async () => {
    await svc.estimateDuration(makeRequest(), SETTINGS, 'fake-key');
    for (const call of openai.chat.completions.create.mock.calls) {
      const p = call[0];
      expect(p.response_format.type).toBe('json_object');
      expect(p.response_format).not.toHaveProperty('schema');
      expect(p.response_format.type).not.toBe('json_schema');
    }
  });

  it('parse la réponse JSON strict et retourne un objet typé', async () => {
    const result = await svc.estimateDuration(makeRequest(), SETTINGS, 'fake-key');
    expect(result.durationMinutes).toBe(45);
    expect(result.confidence).toBe(0.78);
    expect(result.rationale).toContain('corpus');
    expect(result.similarTaskIds).toEqual(['hist-1', 'hist-2']);
  });

  it('rejette les réponses qui ne sont pas du JSON valide', async () => {
    openai.chat.completions.create.mockResolvedValueOnce({
      choices: [{ message: { content: 'pas du json du tout' } }],
    });
    await expect(
      svc.estimateDuration(makeRequest(), SETTINGS, 'fake-key'),
    ).rejects.toThrow();
  });

  it('rejette les réponses JSON qui ne respectent pas le schéma', async () => {
    openai.chat.completions.create.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({ durationMinutes: -5 }) } }],
    });
    await expect(
      svc.estimateDuration(makeRequest(), SETTINGS, 'fake-key'),
    ).rejects.toThrow();
  });

  it('mappe erreur 401 vers une exception claire', async () => {
    openai.chat.completions.create.mockRejectedValueOnce({
      status: 401,
      message: 'Invalid API key',
    });
    await expect(
      svc.estimateDuration(makeRequest(), SETTINGS, 'wrong-key'),
    ).rejects.toThrow(/401|auth/i);
  });

  it('mappe erreur 429 vers une exception de rate limit', async () => {
    openai.chat.completions.create.mockRejectedValueOnce({
      status: 429,
      message: 'Rate limit',
    });
    await expect(
      svc.estimateDuration(makeRequest(), SETTINGS, 'fake-key'),
    ).rejects.toThrow(/429|rate/i);
  });

  it('la base URL est surchargeable via settings.llmBaseUrl', async () => {
    const custom = { ...SETTINGS, llmBaseUrl: 'https://example.com/v1' };
    await svc.estimateDuration(makeRequest(), custom, 'fake-key');
    expect(openai.chat.completions.create).toHaveBeenCalledTimes(1);
  });
});
import { TestBed } from '@angular/core/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { EstimatorService } from './estimator.service';
import { DexieService } from '../storage/dexie.service';
import { LlmService } from './llm.service';
import { LlmEstimationResponse } from './prompts/estimate-duration';
import { GoogleTask, TaskEstimate } from '../models/task.model';
import { AppSettings } from '../models/settings.model';

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

function task(id: string, overrides: Partial<GoogleTask> = {}): GoogleTask {
  return {
    id,
    title: `Task ${id}`,
    status: 'needsAction',
    position: '0',
    taskListId: '@default',
    updated: new Date(),
    ...overrides,
  };
}

function estimate(overrides: Partial<TaskEstimate> = {}): TaskEstimate {
  return {
    taskId: 't1',
    durationMinutes: 30,
    confidence: 0.5,
    source: 'manual',
    estimatedAt: new Date(),
    ...overrides,
  };
}

interface FakeDexie {
  // Tables (utilisées par DexieService)
  tasks: { toArray: ReturnType<typeof vi.fn>; put: ReturnType<typeof vi.fn> };
  estimates: { get: ReturnType<typeof vi.fn>; put: ReturnType<typeof vi.fn>; where: ReturnType<typeof vi.fn>; toArray: ReturnType<typeof vi.fn> };
  // Méthodes du service DexieService utilisées par EstimatorService
  getEstimate: ReturnType<typeof vi.fn>;
  getAllEstimates: ReturnType<typeof vi.fn>;
  countManualEstimates: ReturnType<typeof vi.fn>;
  upsertEstimate: ReturnType<typeof vi.fn>;
}

function makeFakeDexie(): FakeDexie {
  return {
    tasks: {
      toArray: vi.fn().mockResolvedValue([]),
      put: vi.fn().mockResolvedValue(undefined),
    },
    estimates: {
      get: vi.fn().mockResolvedValue(undefined),
      put: vi.fn().mockResolvedValue(undefined),
      where: vi.fn().mockReturnValue({
        equals: () => ({ toArray: async () => [] }),
      }),
      toArray: vi.fn().mockResolvedValue([]),
    },
    getEstimate: vi.fn().mockResolvedValue(undefined),
    getAllEstimates: vi.fn().mockResolvedValue([]),
    countManualEstimates: vi.fn().mockResolvedValue(0),
    upsertEstimate: vi.fn().mockResolvedValue(undefined),
  };
}

describe('EstimatorService', () => {
  let fakeDexie: FakeDexie;
  let svc: EstimatorService;
  let llmEstimate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fakeDexie = makeFakeDexie();
    llmEstimate = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: DexieService, useValue: fakeDexie },
        {
          provide: LlmService,
          useValue: { estimateDuration: llmEstimate },
        },
      ],
    });
    svc = TestBed.inject(EstimatorService);
  });

  it('sous le seuil de tâches évaluées manuellement → fallback source=none', async () => {
    fakeDexie.countManualEstimates.mockResolvedValueOnce(2); // < 5
    const result = await svc.estimateTask(task('t1'), SETTINGS, 'corpus', 'api-key');
    expect(result.source).toBe('none');
    expect(result.durationMinutes).toBe(0);
    expect(llmEstimate).not.toHaveBeenCalled();
  });

  it('au-dessus du seuil → appel LLM + estimate retourné', async () => {
    fakeDexie.countManualEstimates.mockResolvedValueOnce(5); // >= seuil
    const hist = Array.from({ length: 5 }, (_, i) => ({
      taskId: `h${i}`,
      durationMinutes: 30 + i * 10,
      confidence: 0.5,
      source: 'manual' as const,
      estimatedAt: new Date(),
    }));
    fakeDexie.getAllEstimates.mockResolvedValueOnce(hist);
    const llmResp: LlmEstimationResponse = {
      durationMinutes: 45,
      confidence: 0.8,
      rationale: 'OK',
    };
    llmEstimate.mockResolvedValueOnce(llmResp);
    const result = await svc.estimateTask(task('t1'), SETTINGS, 'corpus', 'api-key');
    expect(result.source).toBe('llm');
    expect(result.durationMinutes).toBe(45);
    expect(result.confidence).toBe(0.8);
    expect(llmEstimate).toHaveBeenCalledTimes(1);
  });

  it('override manuel (estimate avec overriddenBy=manual) est prioritaire', async () => {
    fakeDexie.getEstimate.mockResolvedValueOnce(
      estimate({ durationMinutes: 120, source: 'llm', overriddenBy: 'manual', overriddenAt: new Date() }),
    );
    const result = await svc.estimateTask(task('t1'), SETTINGS, 'corpus', 'api-key');
    expect(result.source).toBe('manual');
    expect(result.durationMinutes).toBe(120);
    expect(llmEstimate).not.toHaveBeenCalled();
  });

  it('persiste l\'estimate dans Dexie après appel LLM', async () => {
    fakeDexie.countManualEstimates.mockResolvedValueOnce(5);
    const hist = Array.from({ length: 5 }, (_, i) => ({
      taskId: `h${i}`,
      durationMinutes: 30 + i * 10,
      confidence: 0.5,
      source: 'manual' as const,
      estimatedAt: new Date(),
    }));
    fakeDexie.getAllEstimates.mockResolvedValueOnce(hist);
    llmEstimate.mockResolvedValueOnce({
      durationMinutes: 60,
      confidence: 0.7,
      rationale: 'OK',
    });
    await svc.estimateTask(task('t1'), SETTINGS, 'corpus', 'api-key');
    expect(fakeDexie.upsertEstimate).toHaveBeenCalledTimes(1);
    const saved = fakeDexie.upsertEstimate.mock.calls[0][0];
    expect(saved.taskId).toBe('t1');
    expect(saved.durationMinutes).toBe(60);
    expect(saved.source).toBe('llm');
  });
});
import { Injectable, inject } from '@angular/core';
import { DexieService } from '../storage/dexie.service';
import { LlmService } from './llm.service';
import { LlmEstimationRequest } from './prompts/estimate-duration';
import { GoogleTask, TaskEstimate, EstimationSource } from '../models/task.model';
import { AppSettings } from '../models/settings.model';

/**
 * Orchestrateur d'estimation (cf §F4 du CDC + ADR-004).
 *
 * Pipeline :
 * 1. Si une estimation existe avec `overriddenBy: 'manual'` → retourne tel quel
 *    (l'utilisateur a forcé la valeur, on n'appelle pas le LLM).
 * 2. Sinon, compte les tâches évaluées manuellement. Si < `manualFallbackThreshold`
 *    (ADR-004, défaut 5) → fallback `source: 'none'`, pas d'appel LLM.
 * 3. Sinon, construit la requête (historique + corpus), appelle le LLM,
 *    persiste l'estimate dans Dexie, le retourne.
 */
@Injectable({ providedIn: 'root' })
export class EstimatorService {
  private readonly dexie = inject(DexieService);
  private readonly llm = inject(LlmService);

  async estimateTask(
    task: GoogleTask,
    settings: AppSettings,
    corpusText: string,
    apiKey: string,
  ): Promise<TaskEstimate> {
    // 1. Override manuel ?
    const existing = await this.dexie.getEstimate(task.id);
    if (existing && existing.overriddenBy === 'manual') {
      // L'utilisateur a forcé la valeur : la source finale est 'manual'
      // même si l'estimate originel venait du LLM.
      return { ...existing, source: 'manual' as EstimationSource };
    }
    // 2. Seuil de confiance : nombre de tâches évaluées manuellement
    const manualCount = await this.dexie.countManualEstimates();
    if (manualCount < settings.manualFallbackThreshold) {
      return this.fallbackEstimate(task.id);
    }
    // 3. Appel LLM
    const historical = (await this.dexie.getAllEstimates())
      .filter((e) => e.source === 'manual')
      .slice(0, settings.historicalMaxTasks)
      .map((e) => ({
        id: e.taskId,
        title: '', // titre non disponible ici, gardé pour schéma prompt
        durationMinutes: e.durationMinutes,
        source: 'manual' as const,
      }));
    const req: LlmEstimationRequest = {
      taskTitle: task.title,
      taskNotes: task.notes,
      corpusText,
      historicalTasks: historical,
    };
    try {
      const llmResp = await this.llm.estimateDuration(req, settings, apiKey);
      const estimate: TaskEstimate = {
        taskId: task.id,
        durationMinutes: llmResp.durationMinutes,
        confidence: llmResp.confidence,
        source: 'llm',
        rationale: llmResp.rationale,
        similarTaskIds: llmResp.similarTaskIds,
        estimatedAt: new Date(),
      };
      await this.dexie.upsertEstimate(estimate);
      return estimate;
    } catch (e) {
      // En cas d'erreur LLM (réseau, schema, etc.), on retombe sur fallback.
      return this.fallbackEstimate(task.id, e instanceof Error ? e.message : String(e));
    }
  }

  /** Estimateur fallback — source=none, durée 0, sans appel LLM. */
  private fallbackEstimate(taskId: string, _reason?: string): TaskEstimate {
    return {
      taskId,
      durationMinutes: 0,
      confidence: 0,
      source: 'none' as EstimationSource,
      estimatedAt: new Date(),
    };
  }
}
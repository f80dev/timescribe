// src/app/core/models/task.model.ts
// Implémenté tel quel depuis docs/cahier-des-charges.md §6.1

export type TaskStatus = 'needsAction' | 'completed';
export type EstimationSource = 'manual' | 'llm' | 'inherited' | 'none';

export interface TaskEstimate {
  taskId: string;
  durationMinutes: number;          // durée totale
  confidence: number;               // 0..1
  source: EstimationSource;
  rationale?: string;               // explication LLM (markdown)
  corpusRefs?: string[];            // IDs fichiers Drive utilisés
  similarTaskIds?: string[];        // tâches historiques similaires
  estimatedAt: Date;
  overriddenAt?: Date;
  overriddenBy?: 'manual';
}

export interface GoogleTask {
  id: string;
  title: string;
  notes?: string;
  status: TaskStatus;
  due?: Date;
  completed?: Date;
  parent?: string;
  position: string;
  taskListId: string;
  updated: Date;
  estimate?: TaskEstimate;          // jointure locale
}
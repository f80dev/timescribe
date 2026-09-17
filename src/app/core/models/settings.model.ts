// src/app/core/models/settings.model.ts
// Implémenté tel quel depuis docs/cahier-des-charges.md §6.1

export interface AppSettings {
  llmProvider: 'minimax';
  llmModel: 'MiniMax-M3';
  llmBaseUrl: string;               // défaut : 'https://api.minimax.io/v1'
  manualFallbackThreshold: number;  // nb minimum de tâches évaluées pour activer LLM (défaut : 5)
  corpusMaxChars: number;           // budget tokens corpus (défaut : 100_000)
  historicalMaxTasks: number;       // nb max de tâches historiques envoyées au LLM (défaut : 50)
  temperature: number;              // défaut : 0.2
  maxCompletionTokens: number;      // défaut : 1024
  theme: 'light' | 'dark' | 'system';
}

/** Settings par défaut — utilisés en bootstrap et au reset. */
export const DEFAULT_SETTINGS: AppSettings = {
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
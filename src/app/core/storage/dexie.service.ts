import { Injectable, inject } from '@angular/core';
import Dexie, { Table } from 'dexie';
import { GoogleTask, TaskEstimate } from '../models/task.model';
import { CorpusDoc, CorpusConfig } from '../models/corpus.model';
import { AppSettings, DEFAULT_SETTINGS } from '../models/settings.model';

/**
 * Wrapper Dexie (cf §6.2 du CDC).
 *
 * Schéma v1 :
 * - tasks : id, taskListId, status, due, updated
 * - estimates : taskId, source, estimatedAt
 * - corpusDocs : driveFileId, name, fetchedAt, contentHash
 * - corpusConfig : singleton (id = 'singleton')
 * - settings : singleton (id = 'singleton')
 * - importBatches : id, createdAt, type
 */
export class TimeScribeDB extends Dexie {
  tasks!: Table<GoogleTask, string>;
  estimates!: Table<TaskEstimate, string>;
  corpusDocs!: Table<CorpusDoc, string>;
  corpusConfig!: Table<CorpusConfig & { id: string }, string>;
  settings!: Table<AppSettings & { id: string }, string>;
  importBatches!: Table<{ id: string; createdAt: Date; type: 'csv' | 'calendar'; count: number }, string>;

  constructor() {
    super('TimeScribeDB');
    this.version(1).stores({
      tasks: 'id, taskListId, status, due, updated',
      estimates: 'taskId, source, estimatedAt',
      corpusDocs: 'driveFileId, name, fetchedAt, contentHash',
      corpusConfig: 'id',
      settings: 'id',
      importBatches: 'id, createdAt, type',
    });
  }
}

const SINGLETON_ID = 'singleton';

/**
 * Service de persistance locale.
 *
 * Toutes les méthodes sont async (IndexedDB). L'instance `db` est injectable
 * (utile pour mocker dans les tests).
 */
@Injectable({ providedIn: 'root' })
export class DexieService {
  private readonly db = inject(TimeScribeDB);

  // ---------- Tasks ----------

  async upsertTask(task: GoogleTask): Promise<void> {
    await this.db.tasks.put(task);
  }

  async upsertTasks(tasks: GoogleTask[]): Promise<void> {
    await this.db.tasks.bulkPut(tasks);
  }

  async getAllTasks(): Promise<GoogleTask[]> {
    return this.db.tasks.toArray();
  }

  async getTasksByList(taskListId: string): Promise<GoogleTask[]> {
    return this.db.tasks.where('taskListId').equals(taskListId).toArray();
  }

  async deleteTask(taskId: string): Promise<void> {
    await this.db.tasks.delete(taskId);
  }

  // ---------- Estimates ----------

  async upsertEstimate(estimate: TaskEstimate): Promise<void> {
    await this.db.estimates.put(estimate);
  }

  async getEstimate(taskId: string): Promise<TaskEstimate | undefined> {
    return this.db.estimates.get(taskId);
  }

  async getAllEstimates(): Promise<TaskEstimate[]> {
    return this.db.estimates.toArray();
  }

  async countManualEstimates(): Promise<number> {
    const all = await this.db.estimates.where('source').equals('manual').toArray();
    return all.length;
  }

  // ---------- Corpus docs ----------

  /**
   * Insère ou met à jour un doc. Si un doc avec même driveFileId existe déjà
   * ET même contentHash, on SKIP l'écriture (pas de retrait inutile).
   */
  async upsertCorpusDoc(doc: CorpusDoc): Promise<void> {
    const existing = await this.db.corpusDocs.get(doc.driveFileId);
    if (existing && existing.contentHash === doc.contentHash) {
      return;
    }
    await this.db.corpusDocs.put(doc);
  }

  async getAllCorpusDocs(): Promise<CorpusDoc[]> {
    return this.db.corpusDocs.toArray();
  }

  // ---------- Corpus config (singleton) ----------

  async saveCorpusConfig(cfg: CorpusConfig): Promise<void> {
    await this.db.corpusConfig.put({ ...cfg, id: SINGLETON_ID });
  }

  async getCorpusConfig(): Promise<CorpusConfig | undefined> {
    const row = await this.db.corpusConfig.get(SINGLETON_ID);
    if (!row) return undefined;
    const { id: _id, ...cfg } = row;
    return cfg as CorpusConfig;
  }

  // ---------- Settings (singleton) ----------

  async saveSettings(settings: AppSettings): Promise<void> {
    await this.db.settings.put({ ...settings, id: SINGLETON_ID });
  }

  async getSettings(): Promise<AppSettings> {
    const row = await this.db.settings.get(SINGLETON_ID);
    if (!row) return DEFAULT_SETTINGS;
    const { id: _id, ...settings } = row;
    return settings as AppSettings;
  }

  // ---------- Maintenance ----------

  async clearAll(): Promise<void> {
    await Promise.all([
      this.db.tasks.clear(),
      this.db.estimates.clear(),
      this.db.corpusDocs.clear(),
      this.db.corpusConfig.clear(),
      this.db.settings.clear(),
      this.db.importBatches.clear(),
    ]);
  }
}
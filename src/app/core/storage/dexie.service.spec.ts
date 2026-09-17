import { TestBed } from '@angular/core/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { DexieService, TimeScribeDB } from './dexie.service';
import { GoogleTask } from '../models/task.model';
import { CorpusDoc, CorpusConfig } from '../models/corpus.model';
import { AppSettings } from '../models/settings.model';

/**
 * Dexie en jsdom : on shimme `indexedDB` via fake-indexeddb.
 * Si fake-indexeddb n'est pas dispo, on mocke directement la classe Dexie.
 *
 * Solution simple : on intercepte l'instance Dexie créée et on stocke
 * les données dans un Map en mémoire.
 */

class InMemoryTable<T extends { id?: string; taskId?: string; driveFileId?: string }> {
  data = new Map<string, T>();
  where(indexName: string) {
    return {
      equals: (value: string) => ({
        toArray: async () =>
          Array.from(this.data.values()).filter((r) => {
            const rAny = r as unknown as Record<string, unknown>;
            return rAny[indexName] === value;
          }),
      }),
    };
  }
  toArray() {
    return Promise.resolve(Array.from(this.data.values()));
  }
}

class FakeDexie {
  tables: Record<string, InMemoryTable<unknown>> = {};
  constructor() {
    this.tables['tasks'] = new InMemoryTable();
    this.tables['estimates'] = new InMemoryTable();
    this.tables['corpusDocs'] = new InMemoryTable();
    this.tables['corpusConfig'] = new InMemoryTable();
    this.tables['settings'] = new InMemoryTable();
    this.tables['importBatches'] = new InMemoryTable();
  }
}

describe('DexieService', () => {
  let svc: DexieService;
  let fake: FakeDexie;

  beforeEach(() => {
    fake = new FakeDexie();
    TestBed.configureTestingModule({
      providers: [{ provide: TimeScribeDB, useValue: fake as unknown as TimeScribeDB }],
    });
    svc = TestBed.inject(DexieService);
  });

  it('upsertTask() ajoute ou met à jour une tâche par id', async () => {
    const task: GoogleTask = {
      id: 't1',
      title: 'Tâche',
      status: 'needsAction',
      position: '0000',
      taskListId: '@default',
      updated: new Date(),
    };
    await svc.upsertTask(task);
    const all = await svc.getAllTasks();
    expect(all.length).toBe(1);
    expect(all[0].title).toBe('Tâche');

    // Update
    await svc.upsertTask({ ...task, title: 'Modifié' });
    const all2 = await svc.getAllTasks();
    expect(all2.length).toBe(1);
    expect(all2[0].title).toBe('Modifié');
  });

  it('getTasksByList(taskListId) filtre par taskListId', async () => {
    await svc.upsertTask({
      id: 't1',
      title: 'A',
      status: 'needsAction',
      position: '0',
      taskListId: '@default',
      updated: new Date(),
    });
    await svc.upsertTask({
      id: 't2',
      title: 'B',
      status: 'needsAction',
      position: '0',
      taskListId: 'list-2',
      updated: new Date(),
    });
    const listA = await svc.getTasksByList('@default');
    expect(listA.length).toBe(1);
    expect(listA[0].id).toBe('t1');
  });

  it('upsertCorpusDoc() dédoublonne par contentHash (pas de retrait si hash inchangé)', async () => {
    const doc: CorpusDoc = {
      driveFileId: 'f1',
      name: 'doc.txt',
      mimeType: 'text/plain',
      fetchedAt: new Date(),
      contentText: 'hello',
      contentHash: 'abc',
      sizeBytes: 5,
    };
    await svc.upsertCorpusDoc(doc);
    const all = await svc.getAllCorpusDocs();
    expect(all.length).toBe(1);

    // Même driveFileId mais même hash → pas de retrait (skip)
    await svc.upsertCorpusDoc({ ...doc, contentHash: 'abc' });
    expect((await svc.getAllCorpusDocs()).length).toBe(1);
  });

  it('getSettings() retourne les settings ou les défauts', async () => {
    const settings = await svc.getSettings();
    expect(settings.llmProvider).toBe('minimax');
    expect(settings.manualFallbackThreshold).toBe(5);

    // Après écriture
    await svc.saveSettings({ ...settings, theme: 'dark' });
    const s2 = await svc.getSettings();
    expect(s2.theme).toBe('dark');
  });

  it('saveCorpusConfig() stocke singleton', async () => {
    const cfg: CorpusConfig = {
      driveFolderId: 'F1',
      driveFolderName: 'Docs',
      enabled: true,
      totalDocs: 10,
      totalChars: 1000,
    };
    await svc.saveCorpusConfig(cfg);
    const got = await svc.getCorpusConfig();
    expect(got?.driveFolderId).toBe('F1');
  });

  it('countManualEstimates() compte les estimates avec source=manual', async () => {
    // Pas d'estimate
    expect(await svc.countManualEstimates()).toBe(0);
  });

  it('clearAll() vide toutes les tables', async () => {
    await svc.upsertTask({
      id: 't1',
      title: 'A',
      status: 'needsAction',
      position: '0',
      taskListId: '@default',
      updated: new Date(),
    });
    expect((await svc.getAllTasks()).length).toBe(1);
    await svc.clearAll();
    expect((await svc.getAllTasks()).length).toBe(0);
  });
});
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { signal } from '@angular/core';
import { Dashboard } from './dashboard';
import { GoogleTask } from '../../core/models/task.model';
import { GoogleTasksService } from '../../core/api/google-tasks.service';
import { DexieService } from '../../core/storage/dexie.service';
import { EstimatorService } from '../../core/estimation/estimator.service';
import { CorpusBuilderService } from '../../core/estimation/corpus-builder.service';
import { DEFAULT_SETTINGS } from '../../core/models/settings.model';
import { GoogleAuthService } from '../../core/auth/google-auth.service';

/**
 * Tests du composant Dashboard (cf §F3 / étape 13).
 *
 * Vérifie :
 * - chargement des tâches Google Tasks via le service
 * - jointure avec les estimations Dexie
 * - tri par due date asc
 * - filtre par statut (needsAction / completed / all)
 * - bouton "Tout réévaluer" qui lance l'estimation batch
 */

class FakeTasksApi {
  listTasks = vi.fn(async (_listId: string) => this.remote);
  remote: GoogleTask[] = [];
}

class FakeDexie {
  estimates = new Map<string, import('../../core/models/task.model').TaskEstimate>();
  upsertTask = vi.fn();
  upsertEstimate = vi.fn(async (e: import('../../core/models/task.model').TaskEstimate) => {
    this.estimates.set(e.taskId, e);
  });
  getAllTasks = vi.fn(async () => Array.from(this.local.values()));
  getTasksByList = vi.fn(async () => Array.from(this.local.values()));
  upsertTasks = vi.fn();
  getAllEstimates = vi.fn(async () => Array.from(this.estimates.values()));
  getEstimate = vi.fn(async (id: string) => this.estimates.get(id));
  local = new Map<string, GoogleTask>();
  countManualEstimates = vi.fn(async () => 0);
}

class FakeEstimator {
  estimateTask = vi.fn();
}

class FakeCorpus {
  getCorpusText = vi.fn(async () => 'CORPUS');
}

class FakeAuth {
  getAccessToken = vi.fn(() => 'fake-token');
}

describe('Dashboard', () => {
  let api: FakeTasksApi;
  let dexie: FakeDexie;
  let estimator: FakeEstimator;

  beforeEach(async () => {
    api = new FakeTasksApi();
    dexie = new FakeDexie();
    estimator = new FakeEstimator();

    await TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: [
        provideRouter([]),
        { provide: GoogleTasksService, useValue: api },
        { provide: DexieService, useValue: dexie },
        { provide: EstimatorService, useValue: estimator },
        { provide: CorpusBuilderService, useValue: new FakeCorpus() },
        { provide: GoogleAuthService, useValue: new FakeAuth() },
      ],
    }).compileComponents();
  });

  it('crée le composant', () => {
    const fixture = TestBed.createComponent(Dashboard);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('charge les tâches Google + joint avec les estimates Dexie', async () => {
    api.remote = [
      {
        id: 't1', title: 'A', status: 'needsAction', position: '0',
        taskListId: '@default', updated: new Date(), due: new Date('2026-09-20'),
      },
      {
        id: 't2', title: 'B', status: 'needsAction', position: '0',
        taskListId: '@default', updated: new Date(), due: new Date('2026-09-15'),
      },
    ];
    dexie.estimates.set('t1', {
      taskId: 't1', durationMinutes: 30, confidence: 0.9,
      source: 'llm', estimatedAt: new Date(),
    });

    const fixture = TestBed.createComponent(Dashboard);
    await fixture.componentInstance.refresh();
    fixture.detectChanges();

    const tasks = fixture.componentInstance.filteredTasks();
    expect(tasks.length).toBe(2);
    // Tri due asc → t2 (15 sept) avant t1 (20 sept)
    expect(tasks[0].id).toBe('t2');
    expect(tasks[1].id).toBe('t1');
    // Jointure estimate
    expect(tasks[1].estimate?.durationMinutes).toBe(30);
  });

  it('filtre par statut "completed"', async () => {
    api.remote = [
      {
        id: 't1', title: 'A', status: 'needsAction', position: '0',
        taskListId: '@default', updated: new Date(),
      },
      {
        id: 't2', title: 'B', status: 'completed', position: '0',
        taskListId: '@default', updated: new Date(),
      },
    ];
    const fixture = TestBed.createComponent(Dashboard);
    await fixture.componentInstance.refresh();
    fixture.componentInstance.setFilter('completed');
    fixture.detectChanges();
    const tasks = fixture.componentInstance.filteredTasks();
    expect(tasks.length).toBe(1);
    expect(tasks[0].id).toBe('t2');
  });

  it('reevaluateAll() demande une estimation pour chaque tâche sans estimate', async () => {
    api.remote = [
      { id: 't1', title: 'A', status: 'needsAction', position: '0', taskListId: '@default', updated: new Date() },
      { id: 't2', title: 'B', status: 'needsAction', position: '0', taskListId: '@default', updated: new Date() },
    ];
    estimator.estimateTask = vi.fn(async (t: GoogleTask) => ({
      taskId: t.id, durationMinutes: 15, confidence: 0.8,
      source: 'llm' as const, estimatedAt: new Date(),
    }));

    const fixture = TestBed.createComponent(Dashboard);
    await fixture.componentInstance.refresh();
    await fixture.componentInstance.reevaluateAll(DEFAULT_SETTINGS);

    expect(estimator.estimateTask).toHaveBeenCalledTimes(2);
  });
});
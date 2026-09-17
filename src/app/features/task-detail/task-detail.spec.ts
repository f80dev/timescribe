import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { signal } from '@angular/core';
import { convertToParamMap } from '@angular/router';
import { TaskDetail } from './task-detail';
import { GoogleTask, TaskEstimate } from '../../core/models/task.model';
import { DexieService } from '../../core/storage/dexie.service';
import { GoogleTasksService } from '../../core/api/google-tasks.service';
import { EstimatorService } from '../../core/estimation/estimator.service';
import { CorpusBuilderService } from '../../core/estimation/corpus-builder.service';
import { GoogleAuthService } from '../../core/auth/google-auth.service';
import { AppSettings, DEFAULT_SETTINGS } from '../../core/models/settings.model';

/**
 * Tests du composant TaskDetail (cf §F5 / étape 14).
 *
 * Vérifie :
 * - chargement de la tâche par ID depuis l'URL
 * - affichage de l'estimation existante
 * - override manuel via `applyOverride()` écrit dans Dexie
 * - bouton "Relancer l'estimation LLM" via `reevaluate()`
 */

class FakeDexie {
  tasks = new Map<string, GoogleTask>();
  estimates = new Map<string, TaskEstimate>();
  upsertTask = vi.fn();
  upsertEstimate = vi.fn(async (e: TaskEstimate) => {
    this.estimates.set(e.taskId, e);
  });
  getEstimate = vi.fn(async (id: string) => this.estimates.get(id));
  getAllEstimates = vi.fn(async () => Array.from(this.estimates.values()));
  countManualEstimates = vi.fn(async () => 0);
  getSettings = vi.fn(async () => DEFAULT_SETTINGS);
  getAllTasks = vi.fn(async () => Array.from(this.tasks.values()));
  getTasksByList = vi.fn(async () => Array.from(this.tasks.values()));
  upsertTasks = vi.fn();
}

class FakeTasksApi {
  patchTask = vi.fn(async (_list: string, _id: string, p: Partial<GoogleTask>) => ({
    id: _id, title: '', status: 'needsAction' as const, position: '0',
    taskListId: _list, updated: new Date(), ...p,
  }));
  getTask = vi.fn(); // non utilisé ici, on injecte via Dexie
}

class FakeEstimator {
  estimateTask = vi.fn(async (t: GoogleTask) => ({
    taskId: t.id, durationMinutes: 60, confidence: 0.85,
    source: 'llm' as const, estimatedAt: new Date(),
  }));
}

class FakeCorpus {
  getCorpusText = vi.fn(async () => 'corpus');
}

class FakeAuth {
  accessToken = () => 'fake-token';
}

describe('TaskDetail', () => {
  let dexie: FakeDexie;
  let api: FakeTasksApi;

  beforeEach(async () => {
    dexie = new FakeDexie();
    api = new FakeTasksApi();
    const t: GoogleTask = {
      id: 't1',
      title: 'Préparer la réunion',
      status: 'needsAction',
      position: '0',
      taskListId: '@default',
      updated: new Date(),
      due: new Date('2026-09-25'),
      estimate: {
        taskId: 't1', durationMinutes: 30, confidence: 0.9,
        source: 'llm', estimatedAt: new Date(),
        rationale: 'Car 30min estimés par historique similaire',
        similarTaskIds: ['t0', 't2'],
      },
    };
    dexie.tasks.set('t1', t);
    dexie.estimates.set('t1', t.estimate!);

    await TestBed.configureTestingModule({
      imports: [TaskDetail],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap({ id: 't1' }) },
            paramMap: signal(convertToParamMap({ id: 't1' })),
          },
        },
        { provide: DexieService, useValue: dexie },
        { provide: GoogleTasksService, useValue: api },
        { provide: EstimatorService, useValue: new FakeEstimator() },
        { provide: CorpusBuilderService, useValue: new FakeCorpus() },
        { provide: GoogleAuthService, useValue: new FakeAuth() },
      ],
    }).compileComponents();
  });

  it('crée le composant', () => {
    const fixture = TestBed.createComponent(TaskDetail);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('charge la tâche par ID', async () => {
    const fixture = TestBed.createComponent(TaskDetail);
    await fixture.componentInstance.loadFromRoute();
    fixture.detectChanges();
    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html).toContain('Préparer la réunion');
    expect(html).toMatch(/30/);
  });

  it('applyOverride() persiste source=manual avec overriddenAt', async () => {
    const fixture = TestBed.createComponent(TaskDetail);
    await fixture.componentInstance.loadFromRoute();
    await fixture.componentInstance.applyOverride(120);
    expect(dexie.upsertEstimate).toHaveBeenCalled();
    const last = dexie.upsertEstimate.mock.calls.at(-1)![0] as TaskEstimate;
    expect(last.source).toBe('manual');
    expect(last.overriddenBy).toBe('manual');
    expect(last.durationMinutes).toBe(120);
    expect(last.overriddenAt).toBeInstanceOf(Date);
  });

  it('reevaluate() appelle EstimatorService et écrase l\'estimation manuelle après confirmation', async () => {
    const fixture = TestBed.createComponent(TaskDetail);
    await fixture.componentInstance.loadFromRoute();
    fixture.componentInstance.overrideConfirmed.set(true);
    await fixture.componentInstance.reevaluate(DEFAULT_SETTINGS);
    expect(dexie.upsertEstimate).toHaveBeenCalled();
    const last = dexie.upsertEstimate.mock.calls.at(-1)![0] as TaskEstimate;
    expect(last.source).toBe('llm');
  });

  it('reevaluate() sans confirmation ne lance PAS l\'estimation', async () => {
    const fixture = TestBed.createComponent(TaskDetail);
    await fixture.componentInstance.loadFromRoute();
    fixture.componentInstance.overrideConfirmed.set(false);
    dexie.upsertEstimate.mockClear();
    await fixture.componentInstance.reevaluate(DEFAULT_SETTINGS);
    expect(dexie.upsertEstimate).not.toHaveBeenCalled();
  });
});
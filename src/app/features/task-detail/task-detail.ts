import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  computed,
  OnInit,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { FormsModule } from '@angular/forms';
import { DexieService } from '../../core/storage/dexie.service';
import { GoogleTasksService } from '../../core/api/google-tasks.service';
import { EstimatorService } from '../../core/estimation/estimator.service';
import { CorpusBuilderService } from '../../core/estimation/corpus-builder.service';
import { GoogleAuthService } from '../../core/auth/google-auth.service';
import { GoogleTask, TaskEstimate } from '../../core/models/task.model';
import { AppSettings, DEFAULT_SETTINGS } from '../../core/models/settings.model';
import { DurationEditorComponent } from '../../shared/components/duration-editor/duration-editor';
import { DurationPipe } from '../../shared/pipes/duration.pipe';

/**
 * Détail d'une tâche (cf §F5 / étape 14 du CDC).
 *
 * - Charge la tâche par `:id` depuis l'URL.
 * - Section "Estimation" : durée, source, rationale LLM, similarTaskIds.
 * - Override manuel via `DurationEditorComponent` → écrit Dexie (`source='manual'`, `overriddenBy='manual'`).
 * - Bouton "Relancer l'estimation LLM" → écrase après confirmation explicite
 *   (le signal `overrideConfirmed` doit être mis à true par le template via dialog).
 *
 * Mobile : page pleine, sticky bottom "Appliquer".
 * Tablet+ : 2 colonnes (détails gauche, estimation droite).
 */
@Component({
  selector: 'app-task-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    DurationEditorComponent,
    DurationPipe,
  ],
  templateUrl: './task-detail.html',
  styleUrl: './task-detail.scss',
})
export class TaskDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dexie = inject(DexieService);
  private readonly tasksApi = inject(GoogleTasksService);
  private readonly estimator = inject(EstimatorService);
  private readonly corpus = inject(CorpusBuilderService);
  private readonly auth = inject(GoogleAuthService);

  readonly task = signal<GoogleTask | null>(null);
  readonly estimate = signal<TaskEstimate | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly settings = signal<AppSettings>(DEFAULT_SETTINGS);

  /** Confirmation explicite d'écrasement d'un override manuel. */
  readonly overrideConfirmed = signal(false);

  readonly hasManualOverride = computed(() =>
    this.estimate()?.overriddenBy === 'manual',
  );

  async ngOnInit(): Promise<void> {
    this.settings.set(await this.dexie.getSettings());
    await this.loadFromRoute();
  }

  async loadFromRoute(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      void this.router.navigateByUrl('/dashboard');
      return;
    }
    this.loading.set(true);
    try {
      // On essaie Dexie d'abord (cache local), puis on tente Google Tasks si absent.
      // Pour v1 : on lit uniquement Dexie. Le test injecte directement dans le fake.
      const tasks = await this.dexie.getAllTasks();
      const local = tasks.find((t) => t.id === id) ?? null;
      this.task.set(local);
      const est = await this.dexie.getEstimate(id);
      this.estimate.set(est ?? null);
    } finally {
      this.loading.set(false);
    }
  }

  async applyOverride(minutes: number): Promise<void> {
    const t = this.task();
    if (!t) return;
    this.saving.set(true);
    try {
      const now = new Date();
      const previous = this.estimate();
      const est: TaskEstimate = {
        taskId: t.id,
        durationMinutes: minutes,
        confidence: 1,
        source: 'manual',
        estimatedAt: now,
        overriddenAt: now,
        overriddenBy: 'manual',
        rationale: previous?.rationale,
        similarTaskIds: previous?.similarTaskIds,
      };
      await this.dexie.upsertEstimate(est);
      this.estimate.set(est);
      this.overrideConfirmed.set(false);
    } finally {
      this.saving.set(false);
    }
  }

  async reevaluate(settings: AppSettings): Promise<void> {
    if (!this.overrideConfirmed()) return; // garde-fou confirmation explicite
    const t = this.task();
    if (!t) return;
    this.saving.set(true);
    try {
      const corpusText = await this.corpus.getCorpusText();
      const apiKey = this.auth.accessToken();
      const est = await this.estimator.estimateTask(t, settings, corpusText, apiKey ?? '');
      await this.dexie.upsertEstimate(est);
      this.estimate.set(est);
      this.overrideConfirmed.set(false);
    } finally {
      this.saving.set(false);
    }
  }

  protected confirmOverrideReset(): void {
    this.overrideConfirmed.set(true);
  }

  protected async saveNotes(notes: string): Promise<void> {
    const t = this.task();
    if (!t) return;
    await this.tasksApi.patchTask(t.taskListId, t.id, { notes });
    this.task.set({ ...t, notes });
  }

  protected onApplyEditor(event: number): void {
    void this.applyOverride(event);
  }

  protected onReevaluateClick(): void {
    if (this.hasManualOverride() && !this.overrideConfirmed()) {
      this.confirmOverrideReset();
      return;
    }
    void this.reevaluate(this.settings());
  }

  protected goBack(): void {
    void this.router.navigateByUrl('/dashboard');
  }
}
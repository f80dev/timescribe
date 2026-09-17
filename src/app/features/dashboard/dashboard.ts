import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  computed,
  OnInit,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { FormsModule } from '@angular/forms';
import { GoogleTasksService } from '../../core/api/google-tasks.service';
import { DexieService } from '../../core/storage/dexie.service';
import { EstimatorService } from '../../core/estimation/estimator.service';
import { CorpusBuilderService } from '../../core/estimation/corpus-builder.service';
import { GoogleAuthService } from '../../core/auth/google-auth.service';
import { GoogleTask } from '../../core/models/task.model';
import { AppSettings, DEFAULT_SETTINGS } from '../../core/models/settings.model';
import { TaskCardComponent } from '../../shared/components/task-card/task-card';
import { BreakpointService } from '../../core/pwa/breakpoint.service';

export type StatusFilter = 'all' | 'needsAction' | 'completed';

/**
 * Tableau de bord des tâches (cf §F3 / étape 13 du CDC).
 *
 * - Liste les tâches `@default` Google Tasks + joint avec les estimates Dexie.
 * - Tri par due date asc.
 * - Filtre par statut (all / needsAction / completed).
 * - Bouton "Tout réévaluer" : lance l'estimation batch via `EstimatorService`.
 * - FAB visible sur mobile/tablet pour "Tout réévaluer".
 * - Layout responsive : 1 col mobile, 2 tablet, 3 desktop.
 */
@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    TaskCardComponent,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {
  private readonly tasksApi = inject(GoogleTasksService);
  private readonly dexie = inject(DexieService);
  private readonly estimator = inject(EstimatorService);
  private readonly corpus = inject(CorpusBuilderService);
  private readonly auth = inject(GoogleAuthService);
  protected readonly bp = inject(BreakpointService);

  readonly tasks = signal<GoogleTask[]>([]);
  readonly loading = signal(false);
  readonly reevaluating = signal(false);
  readonly filter = signal<StatusFilter>('needsAction');
  readonly settings = signal<AppSettings>(DEFAULT_SETTINGS);

  readonly filteredTasks = computed<GoogleTask[]>(() => {
    const status = this.filter();
    const all = this.tasks();
    const filtered = status === 'all' ? all : all.filter((t) => t.status === status);
    return [...filtered].sort((a, b) => {
      const ad = a.due?.getTime() ?? Number.POSITIVE_INFINITY;
      const bd = b.due?.getTime() ?? Number.POSITIVE_INFINITY;
      return ad - bd;
    });
  });

  readonly tasksNeedingEstimate = computed<GoogleTask[]>(() =>
    this.filteredTasks().filter((t) => !t.estimate || t.estimate.source === 'none'),
  );

  async ngOnInit(): Promise<void> {
    this.settings.set(await this.dexie.getSettings());
    await this.refresh();
  }

  async refresh(): Promise<void> {
    this.loading.set(true);
    try {
      const remote = await this.tasksApi.listTasks('@default');
      const allEstimates = await this.dexie.getAllEstimates();
      const estMap = new Map(allEstimates.map((e) => [e.taskId, e]));
      const joined = remote.map((t) => ({ ...t, estimate: estMap.get(t.id) }));
      this.tasks.set(joined);
    } finally {
      this.loading.set(false);
    }
  }

  setFilter(status: StatusFilter): void {
    this.filter.set(status);
  }

  async reevaluateAll(settings: AppSettings): Promise<void> {
    const targets = this.tasksNeedingEstimate();
    if (targets.length === 0) return;
    this.reevaluating.set(true);
    try {
      const corpusText = await this.corpus.getCorpusText();
      const apiKey = this.auth.accessToken(); // placeholder ; vrai flow à l'étape 14
      for (const t of targets) {
        const est = await this.estimator.estimateTask(t, settings, corpusText, apiKey ?? '');
        await this.dexie.upsertEstimate(est);
      }
      await this.refresh();
    } finally {
      this.reevaluating.set(false);
    }
  }

  protected onReevaluateClick(): void {
    void this.reevaluateAll(this.settings());
  }

  protected isFabVisible(): boolean {
    return this.bp.isMobile() || this.bp.isTablet();
  }
}
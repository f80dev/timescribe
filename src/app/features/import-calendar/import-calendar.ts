import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  computed,
  OnInit,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDividerModule } from '@angular/material/divider';
import { Router } from '@angular/router';
import { GoogleCalendarService } from '../../core/api/google-calendar.service';
import { GoogleTasksService } from '../../core/api/google-tasks.service';
import { DexieService } from '../../core/storage/dexie.service';
import { CalendarEventCandidate } from '../../core/models/import.model';
import { DurationPipe } from '../../shared/pipes/duration.pipe';
import { BreakpointService } from '../../core/pwa/breakpoint.service';

interface EventRow extends CalendarEventCandidate {
  durationMinutes: number;
}

/**
 * Import d'événements Calendar → Google Tasks (cf §F7 / étape 16 du CDC).
 *
 * - Plage par défaut : 30 derniers jours (modifiable via champs date).
 * - Max 250 événements (capacité API).
 * - Sélection par checkbox → "Créer les tâches" :
 *   - title = event.summary
 *   - notes = event.description (≤ 4000 chars) + lien calendar
 *   - estimate.source = 'manual', durationMinutes = event.end - event.start
 *   - throttle 1 req/s (géré par GoogleTasksService.insertTask).
 *
 * Mobile : cards empilées. Tablet+ : grille.
 */
@Component({
  selector: 'app-import-calendar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatCheckboxModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatInputModule,
    MatDividerModule,
    DurationPipe,
  ],
  templateUrl: './import-calendar.html',
  styleUrl: './import-calendar.scss',
})
export class ImportCalendar implements OnInit {
  private readonly calendar = inject(GoogleCalendarService);
  private readonly tasksApi = inject(GoogleTasksService);
  private readonly dexie = inject(DexieService);
  private readonly router = inject(Router);
  protected readonly bp = inject(BreakpointService);

  readonly events = signal<EventRow[]>([]);
  readonly selected = signal<Set<string>>(new Set());
  readonly loading = signal(false);
  readonly creating = signal(false);
  readonly error = signal<string | null>(null);

  // Plage par défaut : 30 derniers jours
  readonly fromDate = signal(this.isoDate(this.daysAgo(30)));
  readonly toDate = signal(this.isoDate(new Date()));

  readonly selectedCount = computed(() => this.selected().size);

  async ngOnInit(): Promise<void> {
    await this.refresh();
  }

  async refresh(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const from = new Date(this.fromDate());
      const to = new Date(this.toDate());
      const page = await this.calendar.listEvents(from, to, undefined, 'primary', 250);
      const rows: EventRow[] = page.events.map((e) => ({
        ...e,
        durationMinutes: this.calendar.computeEventDurationMinutes(e),
      }));
      this.events.set(rows);
      this.selected.set(new Set());
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.loading.set(false);
    }
  }

  toggleSelection(eventId: string): void {
    const set = new Set(this.selected());
    if (set.has(eventId)) set.delete(eventId);
    else set.add(eventId);
    this.selected.set(set);
  }

  isSelected(eventId: string): boolean {
    return this.selected().has(eventId);
  }

  async createTasks(): Promise<void> {
    const ids = Array.from(this.selected());
    if (ids.length === 0) return;
    this.creating.set(true);
    try {
      for (const id of ids) {
        const e = this.events().find((x) => x.eventId === id);
        if (!e) continue;
        const created = await this.tasksApi.insertTask('@default', {
          title: e.title,
          notes: [
            e.description ? e.description.slice(0, 4000) : '',
            '',
            `— Importé de Google Calendar (eventId: ${e.eventId})`,
          ].join('\n').trim(),
          due: e.start,
        });
        // Persistance de l'estimation manuelle dans Dexie
        await this.dexie.upsertEstimate({
          taskId: created.id,
          durationMinutes: e.durationMinutes,
          confidence: 1,
          source: 'manual',
          estimatedAt: new Date(),
        });
      }
      // Redirection vers le dashboard après import
      void this.router.navigateByUrl('/dashboard');
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.creating.set(false);
    }
  }

  // ---------- Helpers ----------

  private daysAgo(n: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
  }

  private isoDate(d: Date): string {
    return d.toISOString().slice(0, 10);
  }
}
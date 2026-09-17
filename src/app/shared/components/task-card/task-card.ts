import { ChangeDetectionStrategy, Component, input, computed } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { RouterLink } from '@angular/router';
import { GoogleTask } from '../../../core/models/task.model';
import { DurationPipe } from '../../pipes/duration.pipe';

/**
 * Carte d'affichage d'une tâche Google (cf §F10 / étape 13).
 *
 * Affiche : titre, due date, badge durée, badge source d'estimation.
 * Clic / Enter → navigation vers `/task/:id`.
 */
@Component({
  selector: 'app-task-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, MatCardModule, MatIconModule, MatChipsModule, RouterLink, DurationPipe],
  template: `
    <mat-card
      appearance="outlined"
      class="task-card"
      [routerLink]="['/task', task().id]"
      [attr.aria-label]="'Tâche : ' + task().title"
      tabindex="0"
    >
      <mat-card-header>
        <mat-card-title>{{ task().title }}</mat-card-title>
        @if (task().due) {
          <mat-card-subtitle>
            <mat-icon class="due-icon">event</mat-icon>
            <time [dateTime]="task().due!.toISOString()">{{ task().due | date: 'shortDate' }}</time>
          </mat-card-subtitle>
        }
      </mat-card-header>

      <mat-card-content>
        <div class="badges">
          <mat-chip-set>
            <mat-chip [class]="'source-' + (task().estimate?.source ?? 'none')">
              <mat-icon matChipAvatar>{{ sourceIcon() }}</mat-icon>
              {{ sourceLabel() }}
            </mat-chip>
            <mat-chip class="duration">
              <mat-icon matChipAvatar>schedule</mat-icon>
              {{ (task().estimate?.durationMinutes ?? 0) | duration }}
            </mat-chip>
          </mat-chip-set>
        </div>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    :host { display: block; }
    .task-card {
      cursor: pointer;
      transition: transform 120ms ease;
    }
    .task-card:hover {
      transform: translateY(-2px);
    }
    .due-icon {
      vertical-align: middle;
      margin-right: 4px;
      font-size: 1rem;
      height: 1rem;
      width: 1rem;
    }
    .badges {
      margin-top: 8px;
    }
    mat-chip.source-llm { background: #e3f2fd; }
    mat-chip.source-manual { background: #fff3e0; }
    mat-chip.source-none { background: #f5f5f5; }
    mat-chip.source-inherited { background: #e8f5e9; }
  `],
})
export class TaskCardComponent {
  readonly task = input.required<GoogleTask>();

  protected readonly sourceIcon = computed(() => {
    switch (this.task().estimate?.source) {
      case 'manual': return 'person';
      case 'llm': return 'auto_awesome';
      case 'inherited': return 'history';
      default: return 'help_outline';
    }
  });

  protected readonly sourceLabel = computed(() => {
    switch (this.task().estimate?.source) {
      case 'manual': return 'Manuel';
      case 'llm': return 'LLM';
      case 'inherited': return 'Hérité';
      default: return 'À estimer';
    }
  });
}
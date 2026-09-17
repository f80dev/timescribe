import { ChangeDetectionStrategy, Component, input, output, computed, signal, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

/**
 * Éditeur de durée HH:MM (cf §F10 / étape 14).
 *
 * - Entrée : `valueMinutes` (signal input)
 * - Sortie : `apply` event quand l'utilisateur clique "Appliquer" (en minutes)
 *
 * Saisie : minutes entières (`input type="number" min="0" step="5"`).
 * Plus rapide à saisir sur mobile qu'un time picker HH:MM (cf §F10).
 */
@Component({
  selector: 'app-duration-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  template: `
    <div class="editor">
      <mat-form-field appearance="outline" class="minutes-field">
        <mat-label>Durée (minutes)</mat-label>
        <input
          matInput
          type="number"
          min="0"
          step="5"
          [ngModel]="minutes()"
          (ngModelChange)="minutes.set(+$event)"
          aria-label="Durée en minutes"
        />
        <mat-hint>{{ formatted() }}</mat-hint>
      </mat-form-field>

      <button
        mat="filled"
        color="primary"
        class="apply"
        (click)="apply.emit(minutes())"
        [disabled]="minutes() < 0"
      >
        <span>Appliquer</span>
      </button>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .editor {
      display: flex;
      flex-direction: column;
      gap: 12px;
      align-items: stretch;
    }
    @media (min-width: 600px) {
      .editor {
        flex-direction: row;
        align-items: flex-start;
      }
      .minutes-field {
        flex: 1 1 auto;
      }
      .apply {
        align-self: center;
      }
    }
  `],
})
export class DurationEditorComponent {
  readonly valueMinutes = input<number>(0);
  readonly apply = output<number>();

  // État interne modifiable (copie de l'input)
  readonly minutes = signal(0);

  constructor() {
    // Synchroniser le signal interne quand l'input change
    effect(() => this.minutes.set(this.valueMinutes()));
  }

  protected readonly formatted = computed(() => {
    const m = this.minutes();
    if (m <= 0) return '—';
    const h = Math.floor(m / 60);
    const rest = m % 60;
    if (h === 0) return `${m}min`;
    if (rest === 0) return `${h}h`;
    return `${h}h ${rest}min`;
  });
}
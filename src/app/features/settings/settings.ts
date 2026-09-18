import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  OnInit,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatSelectModule } from '@angular/material/select';
import { DexieService } from '../../core/storage/dexie.service';
import { AppSettings, DEFAULT_SETTINGS } from '../../core/models/settings.model';

/**
 * Écran de paramètres (cf §17 / étape 17).
 *
 * v1 : chargement + édition + sauvegarde des settings Dexie (singleton).
 * Le chiffrement AES-GCM/PBKDF2 de la clé API MiniMax (ADR-001) est prévu
 * via un service dédié dans une itération ultérieure — voir ADR-013.
 *
 * Champs exposés :
 * - llmBaseUrl (string)
 * - manualFallbackThreshold (number, 1..50)
 * - corpusMaxChars (number, ≥ 1000)
 * - historicalMaxTasks (number, 5..200)
 * - temperature (number, 0..1)
 * - maxCompletionTokens (number, 256..4096)
 * - theme ('light' | 'dark' | 'system')
 */
@Component({
  selector: 'app-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatDividerModule,
  ],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class Settings implements OnInit {
  private readonly dexie = inject(DexieService);

  readonly settings = signal<AppSettings>({ ...DEFAULT_SETTINGS });
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly error = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const s = await this.dexie.getSettings();
      this.settings.set(s);
    } finally {
      this.loading.set(false);
    }
  }

  /** Mutation typée d'un champ. Ne persiste pas — appeler `save()` ensuite. */
  updateField<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    this.settings.set({ ...this.settings(), [key]: value });
    this.saved.set(false);
  }

  async save(): Promise<void> {
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.dexie.saveSettings(this.settings());
      this.saved.set(true);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.saving.set(false);
    }
  }
}
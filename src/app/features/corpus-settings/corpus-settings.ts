import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { CorpusBuilderService } from '../../core/estimation/corpus-builder.service';
import { CorpusConfig } from '../../core/models/corpus.model';
import { CorpusPicker } from '../../shared/components/corpus-picker/corpus-picker';

/**
 * Écran de gestion du corpus documentaire (cf §F2 / étape 10 du CDC).
 *
 * - Affiche la config courante (dossier, nb docs, dernière sync).
 * - Permet de changer de dossier via `CorpusPicker` (saisie ID v1 — ADR-011).
 * - Bouton "Resynchroniser" plein largeur sur mobile (cf §F2.5).
 */
@Component({
  selector: 'app-corpus-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    CorpusPicker,
  ],
  templateUrl: './corpus-settings.html',
  styleUrl: './corpus-settings.scss',
})
export class CorpusSettings implements OnInit {
  private readonly builder = inject(CorpusBuilderService);

  readonly config = signal<CorpusConfig | undefined>(undefined);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    const cfg = await this.builder.getCorpusConfig();
    this.config.set(cfg);
  }

  /** Appelé par CorpusPicker après saisie du folderId + folderName. */
  async resync(folderId: string, folderName: string): Promise<void> {
    this.error.set(null);
    this.loading.set(true);
    try {
      const cfg = await this.builder.syncCorpus(folderId, folderName, {
        // settings par défaut ; la page Settings permet de les overrider
        llmProvider: 'minimax',
        llmModel: 'MiniMax-M3',
        llmBaseUrl: 'https://api.minimax.io/v1',
        manualFallbackThreshold: 5,
        corpusMaxChars: 100_000,
        historicalMaxTasks: 50,
        temperature: 0.2,
        maxCompletionTokens: 1024,
        theme: 'light',
      });
      this.config.set(cfg);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.loading.set(false);
    }
  }

  protected formatDate(d: Date | undefined): string {
    if (!d) return '—';
    return d.toLocaleString();
  }
}
import { ChangeDetectionStrategy, Component, EventEmitter, Output, signal } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';

/**
 * Sélecteur de dossier Drive (cf §F2 / étape 10).
 *
 * v1 : champ texte pour saisir l'ID du dossier Drive (extrait depuis
 * l'URL `drive.google.com/drive/folders/<ID>`) + bouton "Choisir".
 *
 * NOTE — divergence ADR-011 : le CDC mentionne Google Drive Picker
 * (API externe nécessitant `developerKey` + balise `<script>`). Pour
 * rester offline-first et éviter une dépendance script tierce, v1
 * accepte l'ID en saisie manuelle. Une migration vers Picker est
 * prévue v2 (cf `docs/decisions.md`).
 *
 * Émet `folderSelected` quand l'utilisateur valide.
 */
@Component({
  selector: 'app-corpus-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './corpus-picker.html',
  styleUrl: './corpus-picker.scss',
})
export class CorpusPicker {
  /** ID du dossier en cours de saisie. */
  protected readonly folderId = signal('');
  /** Nom lisible en cours de saisie (optionnel, valeur par défaut = ID). */
  protected readonly folderName = signal('');

  @Output() readonly folderSelected = new EventEmitter<{
    folderId: string;
    folderName: string;
  }>();

  protected onSelect(): void {
    const id = this.folderId().trim();
    if (!id) return;
    const name = this.folderName().trim() || id;
    this.folderSelected.emit({ folderId: id, folderName: name });
  }
}
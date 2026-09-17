import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-corpus-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Corpus documentaire</h1>
    <p>Sélection du répertoire Google Drive (à brancher à l'étape 10/16).</p>
  `,
})
export class CorpusSettings {}
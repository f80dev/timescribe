import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-import-csv',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Import</h1>
    <p>Import CSV / Calendar (à brancher aux étapes 9/15 et 8/15).</p>
  `,
})
export class ImportCsv {}
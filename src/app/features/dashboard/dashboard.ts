import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Tâches</h1>
    <p>Dashboard — liste des tâches Google Tasks (à brancher à l'étape 13/14).</p>
  `,
})
export class Dashboard {}
import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Paramètres</h1>
    <p>Settings — provider LLM, seuil estimation, passphrase vault (étape 17).</p>
  `,
})
export class Settings {}
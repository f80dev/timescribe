import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Connexion Google</h1>
    <p>OAuth Google (à brancher à l'étape 6).</p>
  `,
})
export class Login {}
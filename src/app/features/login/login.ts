import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { GoogleAuthService } from '../../core/auth/google-auth.service';

/**
 * Écran de connexion OAuth Google (cf §F1 du CDC).
 *
 * Affiche :
 * - Un bouton « Se connecter avec Google » qui déclenche `GoogleAuthService.signIn()`.
 * - Un état de chargement pendant le flow OAuth.
 * - Un message d'erreur en cas d'échec.
 *
 * Après login, redirige vers `returnUrl` (query param) ou `/dashboard`.
 */
@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatCardModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  protected readonly auth = inject(GoogleAuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  async onSignIn(): Promise<void> {
    this.error.set(null);
    this.loading.set(true);
    try {
      await this.auth.signIn();
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/dashboard';
      await this.router.navigateByUrl(returnUrl);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.loading.set(false);
    }
  }
}
import { Injectable, signal, DestroyRef, inject } from '@angular/core';
import { Subject } from 'rxjs';
import {
  GoogleAuthConfig,
  GoogleSdk,
  GoogleTokenResponse,
  Gapi,
  TokenClient,
} from './google-auth.types';
import { GOOGLE_SCOPES } from './google-auth.types';

/**
 * Service d'authentification OAuth Google (cf §5.1 du CDC).
 *
 * Architecture :
 * - PKCE flow via Google Identity Services (`google.accounts.oauth2.initTokenClient`).
 * - Token d'accès stocké UNIQUEMENT en mémoire (variable du service) — JAMAIS
 *   dans `localStorage` / `sessionStorage` (cf §11 sécurité + §13 garde-fous).
 * - Le refresh est géré par Google (re-login à chaque refresh de page acceptable v1).
 *
 * Le service expose deux signaux (`isAuthenticated()`, `accessToken()`) et
 * un observable `events$` pour permettre à l'UI de réagir aux changements.
 */
@Injectable({ providedIn: 'root' })
export class GoogleAuthService {
  private readonly destroyRef = inject(DestroyRef);
  private clientId = '';

  /** Token d'accès courant (en mémoire uniquement). */
  readonly accessToken = signal<string | null>(null);
  /** Date d'expiration du token (en mémoire uniquement). */
  readonly accessTokenExpiresAt = signal<number | null>(null);
  /** État d'authentification dérivé. */
  readonly isAuthenticated = signal(false);

  /** Événements émis (login, logout, erreur) pour les subscribers. */
  readonly events$ = new Subject<AuthEvent>();

  private gapiClient: Gapi | null = null;
  private tokenClient: TokenClient | null = null;

  /** Initialise le service avec la config (à appeler depuis APP_INITIALIZER). */
  init(config: GoogleAuthConfig): void {
    this.clientId = config.clientId;
  }

  /** Charge dynamiquement les SDK gapi + GIS (idempotent). */
  async ensureSdksLoaded(): Promise<void> {
    // GIS est chargé via <script> dans index.html (cf gapi-loader.service.ts).
    // On attend juste qu'il soit disponible.
    if (typeof window === 'undefined') {
      throw new Error('GoogleAuthService requires a browser environment');
    }
    // Si le SDK n'est pas chargé, on injecte le script à la volée.
    if (!window.google) {
      await loadGisScript();
    }
    if (!window.gapi) {
      await loadGapiScript();
    }
    if (!window.gapi || !window.google) {
      throw new Error('Google SDK failed to load');
    }
    this.gapiClient = window.gapi;
  }

  /** Déclenche le flow OAuth. Résout avec le token d'accès. */
  signIn(): Promise<string> {
    return new Promise(async (resolve, reject) => {
      try {
        await this.ensureSdksLoaded();
        const gis = window.google!;
        const gapi = this.gapiClient!;
        const scope = (this.clientId ? GOOGLE_SCOPES : []).join(' ');
        this.tokenClient = gis.accounts.oauth2.initTokenClient({
          client_id: this.clientId,
          scope,
          callback: (response: GoogleTokenResponse) => {
            if (response.error || !response.access_token) {
              const err = new Error(`OAuth error: ${response.error ?? 'no_token'}`);
              this.events$.next({ type: 'error', error: err });
              reject(err);
              return;
            }
            this.setAccessToken(response.access_token, response.expires_in);
            // Branche le token sur gapi pour les appels REST
            gapi.client.setToken({ access_token: response.access_token });
            this.events$.next({ type: 'login', expiresAt: Date.now() + response.expires_in * 1000 });
            resolve(response.access_token);
          },
          error_callback: (err: unknown) => {
            const e = err instanceof Error ? err : new Error(String(err));
            this.events$.next({ type: 'error', error: e });
            reject(e);
          },
        });
        this.tokenClient.requestAccessToken({ prompt: '' });
      } catch (e) {
        reject(e);
      }
    });
  }

  /** Révoque le token et purge l'état mémoire. */
  async signOut(): Promise<void> {
    const token = this.accessToken();
    this.clearToken();
    this.events$.next({ type: 'logout' });
    if (token && window.google?.accounts.oauth2.revoke) {
      await new Promise<void>((resolve) => {
        window.google!.accounts.oauth2.revoke(token, () => resolve());
      });
    }
  }

  /** Définit le token d'accès manuellement (utilisé au restore depuis mémoire). */
  setAccessToken(token: string, expiresInSec: number): void {
    this.accessToken.set(token);
    this.accessTokenExpiresAt.set(Date.now() + expiresInSec * 1000);
    this.isAuthenticated.set(true);
    if (this.gapiClient) {
      this.gapiClient.client.setToken({ access_token: token });
    }
  }

  /** Vide le token en mémoire. Ne touche jamais au stockage persistant. */
  private clearToken(): void {
    this.accessToken.set(null);
    this.accessTokenExpiresAt.set(null);
    this.isAuthenticated.set(false);
    if (this.gapiClient) {
      this.gapiClient.client.setToken(null);
    }
  }
}

export type AuthEvent =
  | { type: 'login'; expiresAt: number }
  | { type: 'logout' }
  | { type: 'error'; error: Error };

// --- Helpers de chargement des SDK ---------------------------------------

const GIS_SCRIPT_ID = 'google-identity-services';
const GAPI_SCRIPT_ID = 'google-apis';

function loadGisScript(): Promise<void> {
  return loadScript(
    GIS_SCRIPT_ID,
    'https://accounts.google.com/gsi/client',
  );
}

function loadGapiScript(): Promise<void> {
  return loadScript(
    GAPI_SCRIPT_ID,
    'https://apis.google.com/js/api.js',
  );
}

function loadScript(id: string, src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById(id)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}
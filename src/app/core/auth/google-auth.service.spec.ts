import { TestBed } from '@angular/core/testing';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GoogleAuthService } from './google-auth.service';
import { GOOGLE_SCOPES } from './google-auth.types';

interface MockTokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

interface MockTokenClient {
  requestAccessToken: ReturnType<typeof vi.fn>;
  callback: ((response: MockTokenResponse & { error?: string }) => void) | null;
}

interface GapiMock {
  client: { setToken: ReturnType<typeof vi.fn>; init: ReturnType<typeof vi.fn> };
  load: ReturnType<typeof vi.fn>;
}

interface GisMock {
  accounts: {
    oauth2: {
      initTokenClient: ReturnType<typeof vi.fn>;
      revoke: ReturnType<typeof vi.fn>;
    };
  };
}

/**
 * Pose les globals `window.gapi` et `window.google` mockés avant l'inject du service.
 * Le service appelle `initTokenClient()` puis expose `signIn()` qui appelle `requestAccessToken()`.
 */
function installGlobals(opts: { failRequest?: boolean } = {}): {
  tokenClient: MockTokenClient;
  gapi: GapiMock;
  gis: GisMock;
} {
  const tokenClient: MockTokenClient = {
    requestAccessToken: vi.fn(),
    callback: null,
  };
  const gapi: GapiMock = {
    client: {
      setToken: vi.fn(),
      init: vi.fn().mockResolvedValue(undefined),
    },
    load: vi.fn().mockImplementation(
      (_name: string, opts: { callback: () => void; onerror: (e: unknown) => void }) => {
        opts.callback();
      },
    ),
  };
  const gis: GisMock = {
    accounts: {
      oauth2: {
        initTokenClient: vi.fn().mockImplementation((cfg: any) => {
          tokenClient.callback = cfg.callback;
          if (opts.failRequest) {
            // Simule une erreur émise via callback
            tokenClient.requestAccessToken.mockImplementation(() => {
              tokenClient.callback!({ access_token: '', error: 'access_denied' } as any);
            });
          } else {
            tokenClient.requestAccessToken.mockImplementation(() => {
              tokenClient.callback!({
                access_token: 'fake-access-token',
                expires_in: 3600,
                scope: GOOGLE_SCOPES.join(' '),
                token_type: 'Bearer',
              });
            });
          }
          return tokenClient;
        }),
        revoke: vi.fn().mockImplementation(
          (token: string, done: () => void) => {
            expect(token).toBeTruthy();
            done();
          },
        ),
      },
    },
  };
  (window as any).gapi = gapi;
  (window as any).google = gis;
  return { tokenClient, gapi, gis };
}

describe('GoogleAuthService', () => {
  let savedLocalStorage: Record<string, string> = {};
  let savedSessionStorage: Record<string, string> = {};

  beforeEach(() => {
    savedLocalStorage = { ...localStorage };
    savedSessionStorage = { ...sessionStorage };
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    // Restaure le storage natif (clear() avant chaque test)
    for (const k of Object.keys(localStorage)) localStorage.removeItem(k);
    for (const k of Object.keys(sessionStorage)) sessionStorage.removeItem(k);
    Object.entries(savedLocalStorage).forEach(([k, v]) => localStorage.setItem(k, v));
    Object.entries(savedSessionStorage).forEach(([k, v]) => sessionStorage.setItem(k, v));
    delete (window as any).gapi;
    delete (window as any).google;
  });

  it('démarre non authentifié', () => {
    installGlobals();
    const svc = TestBed.inject(GoogleAuthService);
    expect(svc.isAuthenticated()).toBe(false);
    expect(svc.accessToken()).toBeNull();
  });

  it('GOOGLE_SCOPES contient les 4 scopes Google + openid/email/profile', () => {
    expect(GOOGLE_SCOPES).toContain('https://www.googleapis.com/auth/tasks');
    expect(GOOGLE_SCOPES).toContain('https://www.googleapis.com/auth/drive.readonly');
    expect(GOOGLE_SCOPES).toContain('https://www.googleapis.com/auth/calendar.readonly');
    expect(GOOGLE_SCOPES).toContain('openid');
    expect(GOOGLE_SCOPES).toContain('email');
    expect(GOOGLE_SCOPES).toContain('profile');
    // Garde-fou §13 : PAS de scope Gmail
    expect(GOOGLE_SCOPES.find((s: string) => s.includes('gmail'))).toBeUndefined();
  });

  it('signIn() appelle initTokenClient + requestAccessToken, stocke le token en mémoire', async () => {
    const { tokenClient, gis, gapi } = installGlobals();
    const svc = TestBed.inject(GoogleAuthService);
    await svc.signIn();
    expect(gis.accounts.oauth2.initTokenClient).toHaveBeenCalledTimes(1);
    expect(tokenClient.requestAccessToken).toHaveBeenCalledTimes(1);
    expect(gapi.client.setToken).toHaveBeenCalledWith({ access_token: 'fake-access-token' });
    expect(svc.isAuthenticated()).toBe(true);
    expect(svc.accessToken()).toBe('fake-access-token');
  });

  it('GARDE-FOU §11 : token JAMAIS écrit dans localStorage ni sessionStorage', async () => {
    installGlobals();
    const svc = TestBed.inject(GoogleAuthService);
    await svc.signIn();
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)!;
      expect(localStorage.getItem(key)).not.toContain('fake-access-token');
    }
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i)!;
      expect(sessionStorage.getItem(key)).not.toContain('fake-access-token');
    }
    // Le token reste uniquement en mémoire
    expect(svc.accessToken()).toBe('fake-access-token');
  });

  it('signIn() rejette quand le callback retourne une erreur', async () => {
    installGlobals({ failRequest: true });
    const svc = TestBed.inject(GoogleAuthService);
    await expect(svc.signIn()).rejects.toThrow();
    expect(svc.isAuthenticated()).toBe(false);
    expect(svc.accessToken()).toBeNull();
  });

  it('signOut() appelle revoke + purge le token en mémoire', async () => {
    const { gis } = installGlobals();
    const svc = TestBed.inject(GoogleAuthService);
    await svc.signIn();
    expect(svc.isAuthenticated()).toBe(true);
    await svc.signOut();
    expect(gis.accounts.oauth2.revoke).toHaveBeenCalledTimes(1);
    expect(svc.isAuthenticated()).toBe(false);
    expect(svc.accessToken()).toBeNull();
  });

  it('setAccessToken() permet de restaurer un token connu (cas du refresh)', () => {
    installGlobals();
    const svc = TestBed.inject(GoogleAuthService);
    svc.setAccessToken('restored-token', 3600);
    expect(svc.accessToken()).toBe('restored-token');
    expect(svc.isAuthenticated()).toBe(true);
  });
});

/**
 * Cas de charge des SDK distants (GIS + gapi) — bug « Google SDK failed to load ».
 *
 * Un `<script>` laissé dans le DOM après un échec (`onerror`) ou un `onload` sans
 * global (bloqué par extension / réponse vide) ne doit PAS faire court-circuiter
 * les tentatives suivantes : il faut réellement réinjecter le script.
 */
describe('GoogleAuthService — chargement des SDK distants', () => {
  type Behavior = 'error' | 'success' | 'silent';

  /** Simule le chargement des <script> SDK injectés dans document.head. */
  function mockScriptLoading(behaviors: Behavior[]): void {
    let injections = 0;
    const realAppend = document.head.appendChild.bind(document.head);
    vi.spyOn(document.head, 'appendChild').mockImplementation((node: any) => {
      const isSdkScript =
        node instanceof HTMLScriptElement &&
        (node.src.includes('accounts.google.com') || node.src.includes('apis.google.com'));
      if (!isSdkScript) {
        return realAppend(node);
      }
      // L'élément est RÉELLEMENT ajouté : il reste en DOM après un échec (comme en prod).
      const result = realAppend(node);
      const behavior = behaviors[injections] ?? 'error';
      injections++;
      queueMicrotask(() => {
        if (behavior === 'error') {
          node.onerror?.(new Event('error'));
          return;
        }
        if (behavior === 'success') {
          const globalName = node.src.includes('accounts.google.com') ? 'google' : 'gapi';
          (window as any)[globalName] = (window as any)[globalName] ?? {};
        }
        // 'silent' : onload SANS définir le global (script exécuté à vide)
        node.onload?.(new Event('load'));
      });
      return result;
    });
  }

  function countSdkInjections(): number {
    const calls = (document.head.appendChild as any).mock?.calls ?? [];
    return calls.filter(
      (c: any[]) =>
        c[0] instanceof HTMLScriptElement &&
        (c[0].src.includes('accounts.google.com') || c[0].src.includes('apis.google.com')),
    ).length;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({});
    document.getElementById('google-identity-services')?.remove();
    document.getElementById('google-apis')?.remove();
    delete (window as any).gapi;
    delete (window as any).google;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.getElementById('google-identity-services')?.remove();
    document.getElementById('google-apis')?.remove();
    delete (window as any).gapi;
    delete (window as any).google;
  });

  it('réessaie réellement après un échec de chargement (élément stale en DOM)', async () => {
    // 1ʳᵉ tentative : GIS échoue en réseau. 2ᵉ tentative : tout charge normalement.
    mockScriptLoading(['error', 'success', 'success']);
    const svc = TestBed.inject(GoogleAuthService);

    await expect(svc.ensureSdksLoaded()).rejects.toThrow('Failed to load script');

    // La 2ᵉ tentative doit RÉINJECTER les scripts (pas de court-circuit sur l'élément stale)
    await expect(svc.ensureSdksLoaded()).resolves.toBeUndefined();
    expect(countSdkInjections()).toBe(3); // 1 (échec) + GIS + gapi (succès)
  });

  it('un onload sans global (script exécuté à vide) rejette et permet un retry', async () => {
    // 1ʳᵉ tentative : les scripts « se chargent » mais aucun global n'apparaît.
    mockScriptLoading(['silent', 'success', 'success']);
    const svc = TestBed.inject(GoogleAuthService);

    await expect(svc.ensureSdksLoaded()).rejects.toThrow();

    await expect(svc.ensureSdksLoaded()).resolves.toBeUndefined();
    expect(countSdkInjections()).toBe(3); // GIS (exécuté à vide, rejeté) + GIS + gapi (succès)
  });

  it('ne recharge pas les SDK déjà chargés (idempotence)', async () => {
    const gis = document.createElement('script');
    gis.id = 'google-identity-services';
    document.head.appendChild(gis);
    const gapi = document.createElement('script');
    gapi.id = 'google-apis';
    document.head.appendChild(gapi);
    (window as any).google = {};
    (window as any).gapi = {};

    mockScriptLoading([]);
    const svc = TestBed.inject(GoogleAuthService);
    await expect(svc.ensureSdksLoaded()).resolves.toBeUndefined();
    expect(countSdkInjections()).toBe(0);
  });
});
/**
 * Scopes OAuth demandés à Google (cf §5.2 du CDC).
 *
 * IMPORTANT — Do NOT list §13 :
 *   - PAS de scope Gmail (import e-mails via CSV uniquement).
 *   - PAS de scope `tasks` (read+write) sans consentement explicite.
 *
 * Les scopes `openid`, `email`, `profile` permettent d'identifier
 * l'utilisateur connecté (avatar / email dans la toolbar).
 */
export const GOOGLE_SCOPES: readonly string[] = [
  'https://www.googleapis.com/auth/tasks',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
  'openid',
  'email',
  'profile',
] as const;

/** Client ID OAuth Google. Configuré via Angular environment. */
export interface GoogleAuthConfig {
  clientId: string;
  /** Scopes à demander (override possible pour tests). */
  scopes?: readonly string[];
}

// --- Types minimaux pour les SDK Google (GIS + gapi) --------------------

export interface GapiClient {
  setToken(token: { access_token: string } | null): void;
  init(config: { discoveryDocs?: string[]; scope?: string }): Promise<void>;
  tasks: GapiTasksNamespace;
  drive?: GapiDriveNamespace;
}

export interface GapiTasksNamespace {
  tasklists: {
    list(params: Record<string, unknown>): Promise<{ result: { items?: unknown[] } }>;
  };
  tasks: {
    list(params: { tasklist: string }): Promise<{ result: { items?: unknown[] } }>;
    insert(params: { tasklist: string; resource: unknown }): Promise<{ result: unknown }>;
    patch(params: { tasklist: string; task: string; resource: unknown }): Promise<{ result: unknown }>;
    delete(params: { tasklist: string; task: string }): Promise<unknown>;
  };
}

export interface GapiDriveNamespace {
  files: {
    list(params: Record<string, unknown>): Promise<{
      result: { files?: GapiDriveFile[]; nextPageToken?: string };
    }>;
    get(params: { fileId: string; alt?: string }): Promise<{
      body?: string;
      result?: GapiDriveFile;
    }>;
  };
}

export interface GapiDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
}

export interface Gapi {
  load(name: 'client', cb: () => void): Promise<void>;
  client: GapiClient;
}

export interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  error?: string;
}

export interface TokenClient {
  requestAccessToken(opts?: { prompt?: '' | 'consent' | 'select_account' }): void;
}

export interface GisOAuth2 {
  initTokenClient(config: {
    client_id: string;
    scope: string;
    callback: (response: GoogleTokenResponse) => void;
    error_callback?: (err: unknown) => void;
  }): TokenClient;
  revoke(accessToken: string, done?: () => void): void;
}

export interface GisAccounts {
  oauth2: GisOAuth2;
}

export interface GoogleSdk {
  accounts: GisAccounts;
}

/** Helper typé pour accéder au SDK Google côté navigateur. */
declare global {
  interface Window {
    gapi?: Gapi;
    google?: GoogleSdk;
  }
}
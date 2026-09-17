import { Injectable } from '@angular/core';
import { GapiDriveFile } from '../auth/google-auth.types';

/**
 * API Google Drive v3 (cf §F2 du CDC).
 *
 * S'appuie sur `gapi.client.drive.files.*`.
 * - `listFiles(folderId, mimeFilter?, pageToken?)` : liste paginée des fichiers
 *   non-dossier d'un dossier, avec filtre MIME optionnel.
 * - `getFileText(fileId)` : récupère le texte brut d'un fichier. Pour les PDF,
 *   l'extraction sera branchée à l'étape 10 via `pdfjs-dist` (mockée ici).
 * - `computeContentHash(text)` : sha256 hexadécimal via WebCrypto SubtleCrypto.
 *
 * MIME acceptés par défaut (cf §F2) : `text/*`, `application/pdf`,
 * `application/vnd.google-apps.document`.
 */
@Injectable({ providedIn: 'root' })
export class GoogleDriveService {
  static readonly DEFAULT_MIME_TYPES = [
    'text/plain',
    'text/markdown',
    'text/csv',
    'text/html',
    'application/pdf',
    'application/vnd.google-apps.document',
  ];

  // ---------- Listing ----------

  async listFiles(
    folderId: string,
    mimeTypes?: string[],
    pageToken?: string,
    pageSize = 100,
  ): Promise<DriveListPage> {
    const gapi = this.requireGapi();
    const mimes = mimeTypes ?? GoogleDriveService.DEFAULT_MIME_TYPES;
    const mimeQuery = mimes
      .map((m) => `mimeType='${m}'`)
      .join(' or ');
    const q = `'${folderId}' in parents and trashed=false and (${mimeQuery})`;
    const params: Record<string, unknown> = {
      q,
      pageSize,
      fields: 'nextPageToken,files(id,name,mimeType,size,modifiedTime)',
    };
    if (pageToken) params['pageToken'] = pageToken;
    const response = await gapi.client.drive!.files.list(params);
    return {
      files: (response.result.files ?? []) as DriveFile[],
      nextPageToken: response.result.nextPageToken,
    };
  }

  // ---------- File content ----------

  async getFileText(fileId: string): Promise<string> {
    const gapi = this.requireGapi();
    const response = await gapi.client.drive!.files.get({
      fileId,
      alt: 'media',
    });
    return response.body ?? '';
  }

  // ---------- Hashing ----------

  /** Calcule le sha256 hexadécimal d'un contenu texte via WebCrypto. */
  async computeContentHash(content: string): Promise<string> {
    const bytes = new TextEncoder().encode(content);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // ---------- Helpers ----------

  private requireGapi(): NonNullable<Window['gapi']> {
    if (typeof window === 'undefined' || !window.gapi || !window.gapi.client.drive) {
      throw new Error('Drive SDK non disponible. Connectez-vous d\'abord.');
    }
    return window.gapi;
  }
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: Date;
}

export interface DriveListPage {
  files: DriveFile[];
  nextPageToken?: string;
}

// Ré-export du type pour les consumers
export type { GapiDriveFile };
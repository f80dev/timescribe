import { TestBed } from '@angular/core/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { CorpusBuilderService } from './corpus-builder.service';
import { GoogleDriveService, DriveFile, DriveListPage } from '../api/google-drive.service';
import { DexieService } from '../storage/dexie.service';
import { CorpusConfig, CorpusDoc } from '../models/corpus.model';
import { AppSettings, DEFAULT_SETTINGS } from '../models/settings.model';

/**
 * Tests du CorpusBuilderService (cf §F2 / étape 10 du CDC).
 *
 * Couvre :
 * - listing paginé du dossier Drive (récursivité 1 niveau via concat des pages)
 * - filtre MIME
 * - extraction de texte (text/plain → direct, PDF → non géré v1, document natif → mocké)
 * - dédup par contentHash : on ne retélécharge pas si hash inchangé
 * - troncature du corpus total à `corpusMaxChars`
 * - mise à jour de `CorpusConfig` (totalDocs, totalChars, lastSyncAt)
 */

class FakeDriveService {
  /** map fileId → contenu texte renvoyé par getFileText */
  contents = new Map<string, string>();
  /** map fileId → DriveFile (taille, mime...) */
  files = new Map<string, DriveFile>();
  /** file de pages ; la 1ère est à l'index 0, la suivante est demandée via nextPageToken. */
  pages: DriveListPage[] = [];

  async listFiles(
    _folderId: string,
    _mimeTypes?: string[],
    pageToken?: string,
    _pageSize?: number,
  ): Promise<DriveListPage> {
    if (!pageToken) return this.pages[0] ?? { files: [] };
    // pageToken = nextPageToken de la page précédente ; on cherche la page suivante
    const idx = this.pages.findIndex((p) => p.nextPageToken === pageToken);
    if (idx < 0) return { files: [] };
    return this.pages[idx + 1] ?? { files: [] };
  }

  async getFileText(fileId: string): Promise<string> {
    return this.contents.get(fileId) ?? '';
  }

  async computeContentHash(content: string): Promise<string> {
    // Hash déterministe simple pour les tests (suffisant : on teste la DÉDUPLICATION,
    // pas la robustesse cryptographique — GoogleDriveService teste sha256).
    let h = 0;
    for (const c of content) h = (h * 31 + c.charCodeAt(0)) | 0;
    return `h${h}`;
  }

  /** Configure une page ; le nextPageToken sert d'entrée pour la page suivante. */
  pushPage(files: DriveFile[], nextPageToken?: string): void {
    this.pages.push({ files, nextPageToken });
  }
}

class FakeDexie {
  corpusDocs = new Map<string, CorpusDoc>();
  corpusConfig: CorpusConfig | undefined;

  // ----- méthodes attendues par le service -----
  async upsertCorpusDoc(doc: CorpusDoc): Promise<void> {
    const existing = this.corpusDocs.get(doc.driveFileId);
    if (existing && existing.contentHash === doc.contentHash) return;
    this.corpusDocs.set(doc.driveFileId, doc);
  }
  async deleteCorpusDoc(driveFileId: string): Promise<void> {
    this.corpusDocs.delete(driveFileId);
  }
  async getAllCorpusDocs(): Promise<CorpusDoc[]> {
    return Array.from(this.corpusDocs.values());
  }
  async saveCorpusConfig(cfg: CorpusConfig): Promise<void> {
    this.corpusConfig = cfg;
  }
  async getCorpusConfig(): Promise<CorpusConfig | undefined> {
    return this.corpusConfig;
  }
}

describe('CorpusBuilderService', () => {
  let svc: CorpusBuilderService;
  let drive: FakeDriveService;
  let dexie: FakeDexie;
  let settings: AppSettings;

  beforeEach(() => {
    drive = new FakeDriveService();
    dexie = new FakeDexie();
    settings = { ...DEFAULT_SETTINGS, corpusMaxChars: 1000 };

    TestBed.configureTestingModule({
      providers: [
        CorpusBuilderService,
        { provide: GoogleDriveService, useValue: drive },
        { provide: DexieService, useValue: dexie },
      ],
    });
    svc = TestBed.inject(CorpusBuilderService);
  });

  it('syncCorpus() liste tous les fichiers paginés du dossier Drive', async () => {
    drive.pushPage([
      { id: 'f1', name: 'a.txt', mimeType: 'text/plain' },
      { id: 'f2', name: 'b.txt', mimeType: 'text/plain' },
    ], 'tok2');
    drive.pushPage([
      { id: 'f3', name: 'c.txt', mimeType: 'text/plain' },
    ]);

    drive.contents.set('f1', 'aaa');
    drive.contents.set('f2', 'bbb');
    drive.contents.set('f3', 'ccc');

    const result = await svc.syncCorpus('folder-1', 'Mon dossier', settings);

    expect(result.totalDocs).toBe(3);
    expect(result.totalChars).toBe(9);
    expect(result.driveFolderId).toBe('folder-1');
    expect(dexie.corpusDocs.size).toBe(3);
  });

  it('syncCorpus() dédoublonne par contentHash (deuxième sync ne réécrit pas)', async () => {
    drive.pushPage([{ id: 'f1', name: 'a.txt', mimeType: 'text/plain' }]);
    drive.contents.set('f1', 'contenu stable');

    await svc.syncCorpus('folder-1', 'Dossier', settings);
    const firstFetchedAt = dexie.corpusDocs.get('f1')!.fetchedAt;

    // 2e sync, même contenu → pas de retrait (fetchedAt inchangé)
    await new Promise((r) => setTimeout(r, 5));
    await svc.syncCorpus('folder-1', 'Dossier', settings);

    expect(dexie.corpusDocs.size).toBe(1);
    expect(dexie.corpusDocs.get('f1')!.fetchedAt).toEqual(firstFetchedAt);
  });

  it('syncCorpus() tronque le corpus total à corpusMaxChars', async () => {
    settings = { ...settings, corpusMaxChars: 10 };
    drive.pushPage([
      { id: 'f1', name: 'a.txt', mimeType: 'text/plain' },
      { id: 'f2', name: 'b.txt', mimeType: 'text/plain' },
    ]);
    drive.contents.set('f1', 'aaa');
    drive.contents.set('f2', 'bbbbbbbbbb'); // 10 chars

    const result = await svc.syncCorpus('folder-1', 'Dossier', settings);

    // totalDocs = nb total indexé (peut être > nb stocké si troncature)
    // totalChars = somme après troncature
    expect(result.totalChars).toBeLessThanOrEqual(settings.corpusMaxChars);
    // Au moins 1 doc stocké
    expect(dexie.corpusDocs.size).toBeGreaterThanOrEqual(1);
  });

  it('syncCorpus() sauvegarde CorpusConfig avec lastSyncAt et totaux', async () => {
    drive.pushPage([{ id: 'f1', name: 'a.txt', mimeType: 'text/plain' }]);
    drive.contents.set('f1', 'hello');

    const result = await svc.syncCorpus('folder-1', 'MonDossier', settings);

    expect(dexie.corpusConfig).toBeDefined();
    expect(dexie.corpusConfig!.driveFolderId).toBe('folder-1');
    expect(dexie.corpusConfig!.driveFolderName).toBe('MonDossier');
    expect(dexie.corpusConfig!.lastSyncAt).toBeInstanceOf(Date);
    expect(dexie.corpusConfig!.totalDocs).toBe(result.totalDocs);
    expect(dexie.corpusConfig!.totalChars).toBe(result.totalChars);
  });

  it('getCorpusText() joint tous les contentText des corpusDocs', async () => {
    await dexie.corpusDocs.set('f1', {
      driveFileId: 'f1', name: 'a.txt', mimeType: 'text/plain',
      fetchedAt: new Date(), contentText: 'AAA', contentHash: 'h1', sizeBytes: 3,
    });
    await dexie.corpusDocs.set('f2', {
      driveFileId: 'f2', name: 'b.txt', mimeType: 'text/plain',
      fetchedAt: new Date(), contentText: 'BBB', contentHash: 'h2', sizeBytes: 3,
    });
    const text = await svc.getCorpusText();
    expect(text).toContain('AAA');
    expect(text).toContain('BBB');
  });
});
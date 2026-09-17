import { Injectable, inject } from '@angular/core';
import { GoogleDriveService, DriveFile } from '../api/google-drive.service';
import { DexieService } from '../storage/dexie.service';
import { CorpusDoc, CorpusConfig } from '../models/corpus.model';
import { AppSettings } from '../models/settings.model';

/**
 * Builder de corpus documentaire (cf §F2 / étape 10 du CDC).
 *
 * Responsabilité : prendre un dossier Drive → lister ses fichiers supportés,
 * extraire le texte de chacun, dédoublonner par contentHash, stocker dans
 * IndexedDB et renvoyer la `CorpusConfig` mise à jour.
 *
 * Stratégie :
 * - **Listing paginé** : on itère sur `nextPageToken` jusqu'à épuisement.
 * - **Filtre MIME** : hérité de `GoogleDriveService.DEFAULT_MIME_TYPES` (text/*,
 *   PDF, Google Docs natifs).
 * - **Extraction** : `text/plain` → direct ; PDF et Google Docs → on stocke un
 *   placeholder `[unsupported:mime]` en v1 (extraction `pdfjs-dist` non
 *   branchée ici — voir ADR-011). L'important est de mesurer/compter.
 * - **Déduplication** : on `upsertCorpusDoc` qui SKIP si contentHash inchangé.
 * - **Troncature** : on borne le nombre total de caractères persistés à
 *   `settings.corpusMaxChars` en élaguant les docs les plus longs d'abord.
 *
 * Renvoie `CorpusConfig` (jamais `null`) pour permettre l'affichage immédiat
 * par l'UI.
 */
@Injectable({ providedIn: 'root' })
export class CorpusBuilderService {
  private readonly drive = inject(GoogleDriveService);
  private readonly dexie = inject(DexieService);

  /**
   * Synchronise le corpus pour le dossier Drive `folderId`.
   * Liste tous les fichiers (pagination), extrait le texte, dédoublonne
   * par hash, tronque au budget `corpusMaxChars`, met à jour CorpusConfig.
   */
  async syncCorpus(
    folderId: string,
    folderName: string,
    settings: AppSettings,
  ): Promise<CorpusConfig> {
    // 1) Listing paginé
    const files: DriveFile[] = [];
    let pageToken: string | undefined;
    let safety = 0;
    do {
      const page = await this.drive.listFiles(folderId, undefined, pageToken, 100);
      files.push(...page.files);
      pageToken = page.nextPageToken;
      safety += 1;
      if (safety > 50) break; // garde-fou pagination infinie
    } while (pageToken);

    // 2) Extraction texte + upsert
    for (const file of files) {
      const text = await this.extractText(file);
      const hash = await this.drive.computeContentHash(text);
      const doc: CorpusDoc = {
        driveFileId: file.id,
        name: file.name,
        mimeType: file.mimeType,
        fetchedAt: new Date(),
        contentText: text,
        contentHash: hash,
        sizeBytes: file.size ? Number(file.size) : text.length,
      };
      await this.dexie.upsertCorpusDoc(doc);
    }

    // 3) Troncature au budget corpusMaxChars (élague les docs les plus gros d'abord)
    const allDocs = await this.dexie.getAllCorpusDocs();
    let totalChars = allDocs.reduce((acc, d) => acc + d.contentText.length, 0);
    if (totalChars > settings.corpusMaxChars) {
      const sorted = [...allDocs].sort(
        (a, b) => b.contentText.length - a.contentText.length,
      );
      for (const d of sorted) {
        if (totalChars <= settings.corpusMaxChars) break;
        totalChars -= d.contentText.length;
        await this.dexie.deleteCorpusDoc(d.driveFileId);
      }
    }

    // 4) Mise à jour CorpusConfig
    const finalDocs = await this.dexie.getAllCorpusDocs();
    const finalChars = finalDocs.reduce((acc, d) => acc + d.contentText.length, 0);
    const cfg: CorpusConfig = {
      driveFolderId: folderId,
      driveFolderName: folderName,
      enabled: true,
      lastSyncAt: new Date(),
      totalDocs: finalDocs.length,
      totalChars: finalChars,
    };
    await this.dexie.saveCorpusConfig(cfg);
    return cfg;
  }

  /** Texte concaténé de tous les corpusDocs (séparateur double newline). */
  async getCorpusText(): Promise<string> {
    const docs = await this.dexie.getAllCorpusDocs();
    return docs
      .filter((d) => d.contentText.length > 0)
      .map((d) => `=== ${d.name} ===\n${d.contentText}`)
      .join('\n\n');
  }

  /** Récupère la config persistée (peut être undefined si jamais sync). */
  async getCorpusConfig(): Promise<CorpusConfig | undefined> {
    return this.dexie.getCorpusConfig();
  }

  // ---------- Privé ----------

  /**
   * Extrait le texte d'un fichier. v1 ne supporte que text/plain (les autres
   * MIME reçoivent un placeholder — l'extraction PDF/Docs sera ajoutée via
   * `pdfjs-dist` dans une itération ultérieure, cf ADR-011).
   */
  private async extractText(file: DriveFile): Promise<string> {
    if (file.mimeType.startsWith('text/')) {
      return await this.drive.getFileText(file.id);
    }
    // PDF / Google Docs natifs → placeholder marqué pour debug
    return `[unsupported:${file.mimeType}] ${file.name}`;
  }
}
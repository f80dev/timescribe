// src/app/core/models/corpus.model.ts
// Implémenté tel quel depuis docs/cahier-des-charges.md §6.1

export interface CorpusDoc {
  driveFileId: string;
  name: string;
  mimeType: string;
  fetchedAt: Date;
  contentText: string;              // extrait texte brut
  contentHash: string;              // sha256 pour invalidation
  sizeBytes: number;
}

export interface CorpusConfig {
  driveFolderId: string;
  driveFolderName: string;
  enabled: boolean;
  lastSyncAt?: Date;
  totalDocs: number;
  totalChars: number;
}
import { TestBed } from '@angular/core/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { signal } from '@angular/core';
import { CorpusSettings } from './corpus-settings';
import { CorpusBuilderService } from '../../core/estimation/corpus-builder.service';
import { CorpusConfig } from '../../core/models/corpus.model';
import { AppSettings, DEFAULT_SETTINGS } from '../../core/models/settings.model';

/**
 * Tests du composant CorpusSettings (cf §F2 / étape 10 du CDC).
 *
 * Vérifie :
 * - chargement de la config existante au init
 * - bouton "Resynchroniser" qui appelle syncCorpus
 * - affichage des totaux (nb docs, taille, lastSyncAt)
 */

class FakeCorpusBuilder {
  lastSyncArgs: { folderId: string; folderName: string } | null = null;
  syncResult = {
    driveFolderId: 'folder-1',
    driveFolderName: 'MonDossier',
    enabled: true,
    lastSyncAt: new Date('2026-09-17T10:00:00Z'),
    totalDocs: 12,
    totalChars: 3456,
  };
  corpusConfigSignal = signal<CorpusConfig | undefined>({
    driveFolderId: 'old-folder',
    driveFolderName: 'Ancien',
    enabled: true,
    lastSyncAt: new Date('2026-09-01T08:00:00Z'),
    totalDocs: 3,
    totalChars: 100,
  });

  syncCorpus = vi.fn(async (folderId: string, folderName: string) => {
    this.lastSyncArgs = { folderId, folderName };
    this.corpusConfigSignal.set(this.syncResult);
    return this.syncResult;
  });
  getCorpusConfig = vi.fn(async () => this.corpusConfigSignal());
  getCorpusText = vi.fn(async () => '');
}

describe('CorpusSettings', () => {
  let component: CorpusSettings;
  let builder: FakeCorpusBuilder;

  beforeEach(async () => {
    builder = new FakeCorpusBuilder();
    await TestBed.configureTestingModule({
      imports: [CorpusSettings],
      providers: [
        { provide: CorpusBuilderService, useValue: builder },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(CorpusSettings);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('se crée sans erreur', () => {
    expect(component).toBeTruthy();
  });

  it('expose un état loading et config depuis le builder', () => {
    expect(component.config()).toBeDefined();
    expect(component.config()!.driveFolderId).toBe('old-folder');
    expect(component.loading()).toBe(false);
  });

  it('resync() avec folderId + folderName déclenche syncCorpus', async () => {
    await component.resync('folder-2', 'Nouveau dossier');
    expect(builder.syncCorpus).toHaveBeenCalled();
    expect(builder.lastSyncArgs).toEqual({ folderId: 'folder-2', folderName: 'Nouveau dossier' });
    expect(component.loading()).toBe(false);
  });

  it('resync() met loading=true pendant l\'appel et false après', async () => {
    let loadingDuringCall = false;
    builder.syncCorpus = vi.fn(async () => {
      loadingDuringCall = component.loading();
      return builder.syncResult;
    });
    await component.resync('folder-3', 'Autre');
    expect(loadingDuringCall).toBe(true);
    expect(component.loading()).toBe(false);
  });
});
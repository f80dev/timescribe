import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { signal } from '@angular/core';
import { Settings } from './settings';
import { DexieService } from '../../core/storage/dexie.service';
import { AppSettings, DEFAULT_SETTINGS } from '../../core/models/settings.model';

/**
 * Tests du composant Settings (cf §17 / étape 17).
 *
 * Vérifie :
 * - chargement des settings existants (ou défauts)
 * - sauvegarde des settings modifiés via Dexie
 * - exposition des champs llmBaseUrl, manualFallbackThreshold, corpusMaxChars
 */

class FakeDexie {
  current: AppSettings = { ...DEFAULT_SETTINGS };
  getSettings = vi.fn(async () => ({ ...this.current }));
  saveSettings = vi.fn(async (s: AppSettings) => {
    this.current = { ...s };
  });
}

describe('Settings', () => {
  let dexie: FakeDexie;

  beforeEach(async () => {
    dexie = new FakeDexie();
    await TestBed.configureTestingModule({
      imports: [Settings],
      providers: [
        provideRouter([]),
        { provide: DexieService, useValue: dexie },
      ],
    }).compileComponents();
  });

  it('crée le composant', () => {
    const fixture = TestBed.createComponent(Settings);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('charge les settings au init (defauts si vide)', async () => {
    const fixture = TestBed.createComponent(Settings);
    await fixture.componentInstance.load();
    const s = fixture.componentInstance.settings();
    expect(s.llmProvider).toBe('minimax');
    expect(s.llmModel).toBe('MiniMax-M3');
    expect(s.manualFallbackThreshold).toBe(5);
  });

  it('save() persiste les settings via Dexie', async () => {
    const fixture = TestBed.createComponent(Settings);
    await fixture.componentInstance.load();
    fixture.componentInstance.updateField('manualFallbackThreshold', 10);
    await fixture.componentInstance.save();
    expect(dexie.saveSettings).toHaveBeenCalled();
    expect(dexie.current.manualFallbackThreshold).toBe(10);
  });

  it('updateField() mute le signal sans déclencher de sauvegarde', async () => {
    const fixture = TestBed.createComponent(Settings);
    await fixture.componentInstance.load();
    dexie.saveSettings.mockClear();
    fixture.componentInstance.updateField('corpusMaxChars', 200_000);
    expect(dexie.saveSettings).not.toHaveBeenCalled();
    expect(fixture.componentInstance.settings().corpusMaxChars).toBe(200_000);
  });
});
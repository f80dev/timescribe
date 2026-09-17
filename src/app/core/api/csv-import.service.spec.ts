import { TestBed } from '@angular/core/testing';
import { vi, describe, it, expect } from 'vitest';
import { CsvImportService } from './csv-import.service';

describe('CsvImportService', () => {
  it('parse() convertit un CSV Gmail valide en CsvEmailRow[]', async () => {
    const svc = TestBed.inject(CsvImportService);
    const csv = [
      'subject,sender,receivedAt,threadId,bodyPreview',
      '"Réunion budget Q3","alice@example.com","2025-09-12T10:00:00Z","thread_abc","Ordre du jour: ..."',
      '"Stand-up","bob@example.com","2025-09-13T09:00:00Z","thread_def",""',
    ].join('\n');
    const result = await svc.parse(csv);
    expect(result.rows.length).toBe(2);
    expect(result.rows[0].subject).toBe('Réunion budget Q3');
    expect(result.rows[0].sender).toBe('alice@example.com');
    expect(result.rows[0].receivedAt).toBeInstanceOf(Date);
    expect(result.rows[0].receivedAt.toISOString()).toBe('2025-09-12T10:00:00.000Z');
    expect(result.rows[0].threadId).toBe('thread_abc');
    expect(result.rows[0].bodyPreview).toBe('Ordre du jour: ...');
    expect(result.warnings.length).toBe(0);
  });

  it('parse() ignore les lignes invalides et ajoute un warning', async () => {
    const svc = TestBed.inject(CsvImportService);
    const csv = [
      'subject,sender,receivedAt,threadId,bodyPreview',
      '"Valide","alice@example.com","2025-09-12T10:00:00Z","t1",""',
      '"Manque sender","","2025-09-12T10:00:00Z","t2",""',  // sender vide
      '"Date invalide","bob@example.com","not-a-date","t3",""',
      '","alice@example.com","2025-09-12T10:00:00Z","t4",""',  // subject vide
      '"Valide 2","alice@example.com","2025-09-12T10:00:00Z","t5",""',
    ].join('\n');
    const result = await svc.parse(csv);
    expect(result.rows.length).toBe(2);
    expect(result.warnings.length).toBe(3);
    expect(result.warnings.some((w) => w.includes('sender'))).toBe(true);
    expect(result.warnings.some((w) => w.includes('date'))).toBe(true);
    expect(result.warnings.some((w) => w.includes('subject'))).toBe(true);
  });

  it('suggestDurationMinutes() heuristique : titre < 30 chars → 15 min', () => {
    const svc = TestBed.inject(CsvImportService);
    expect(svc.suggestDurationMinutes('Court')).toBe(15);
  });

  it('suggestDurationMinutes() : titre entre 30 et 60 chars → 30 min', () => {
    const svc = TestBed.inject(CsvImportService);
    const title = 'a'.repeat(40);
    expect(svc.suggestDurationMinutes(title)).toBe(30);
  });

  it('suggestDurationMinutes() : titre > 60 chars → 60 min', () => {
    const svc = TestBed.inject(CsvImportService);
    const title = 'a'.repeat(80);
    expect(svc.suggestDurationMinutes(title)).toBe(60);
  });

  it('parse() retourne un warning si pas de header', async () => {
    const svc = TestBed.inject(CsvImportService);
    const csv = '"foo","bar","2025-09-12T10:00:00Z","t1",""'; // pas de header
    const result = await svc.parse(csv);
    expect(result.rows.length).toBe(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('toTaskInsertPayload() construit le payload Google Tasks', () => {
    const svc = TestBed.inject(CsvImportService);
    const row = {
      subject: 'Sujet',
      sender: 'a@b.com',
      receivedAt: new Date('2025-09-12T10:00:00Z'),
      threadId: 't1',
      bodyPreview: 'Corps',
    };
    const payload = svc.toTaskInsertPayload(row, 30);
    expect(payload.title).toBe('Sujet');
    expect(payload.notes).toContain("Importé de l'e-mail de a@b.com");
    expect(payload.notes).toContain('Corps');
    expect(payload.due).toBeInstanceOf(Date);
    expect(payload.suggestedDurationMin).toBe(30);
  });
});
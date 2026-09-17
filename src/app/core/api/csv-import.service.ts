import { Injectable } from '@angular/core';
import Papa from 'papaparse';
import { CsvEmailRow } from '../models/import.model';

export interface CsvParseResult {
  rows: CsvEmailRow[];
  warnings: string[];
}

export interface CsvTaskPayload {
  title: string;
  notes: string;
  due: Date;
  suggestedDurationMin: number;
}

/**
 * Import CSV Gmail (cf §6.5 + §F6 du CDC).
 *
 * Format attendu : header row obligatoire, colonnes subject/sender/receivedAt/
 * threadId/bodyPreview. `receivedAt` en ISO 8601 UTC.
 *
 * Comportement :
 * - Lignes invalides (subject ou sender vide, receivedAt non-ISO) : ignorées
 *   + warning collecté.
 * - `suggestDurationMinutes(title)` : heuristique simple (longueur du titre).
 * - `toTaskInsertPayload(row, duration)` : mappe vers le payload d'insertion
 *   Google Tasks (title, notes, due = receivedAt + 24h).
 */
@Injectable({ providedIn: 'root' })
export class CsvImportService {
  static readonly REQUIRED_COLUMNS = ['subject', 'sender', 'receivedat'] as const;

  /** Parse un CSV Gmail. */
  async parse(csvText: string): Promise<CsvParseResult> {
    const warnings: string[] = [];
    const parsed = Papa.parse<Record<string, string>>(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
    });
    if (!parsed.meta.fields || parsed.meta.fields.length === 0) {
      return {
        rows: [],
        warnings: ['CSV sans ligne d\'en-tête — vérifiez le format.'],
      };
    }
    const headerFieldsLower = parsed.meta.fields.map((f) => f.trim().toLowerCase());
    for (const required of CsvImportService.REQUIRED_COLUMNS) {
      if (!headerFieldsLower.includes(required)) {
        warnings.push(`Colonne obligatoire manquante : ${required}`);
      }
    }
    const rows: CsvEmailRow[] = [];
    for (let idx = 0; idx < parsed.data.length; idx++) {
      const raw = parsed.data[idx];
      const lineNo = idx + 2; // header = ligne 1
      const subject = (raw['subject'] ?? '').trim();
      const sender = (raw['sender'] ?? '').trim();
      const receivedAtStr = (raw['receivedAt'] ?? '').trim();
      const threadId = (raw['threadId'] ?? '').trim() || undefined;
      const bodyPreview = (raw['bodyPreview'] ?? '').trim() || undefined;
      if (!subject) {
        warnings.push(`Ligne ${lineNo} ignorée : subject vide.`);
        continue;
      }
      if (!sender) {
        warnings.push(`Ligne ${lineNo} ignorée : sender vide.`);
        continue;
      }
      const receivedAt = new Date(receivedAtStr);
      if (Number.isNaN(receivedAt.getTime())) {
        warnings.push(`Ligne ${lineNo} ignorée : receivedAt invalide ('${receivedAtStr}').`);
        continue;
      }
      rows.push({ subject, sender, receivedAt, threadId, bodyPreview });
    }
    return { rows, warnings };
  }

  /** Heuristique de durée suggérée à partir du titre. */
  suggestDurationMinutes(title: string): 15 | 30 | 60 {
    const len = title.trim().length;
    if (len < 30) return 15;
    if (len < 60) return 30;
    return 60;
  }

  /** Construit le payload pour `GoogleTasksService.insertTask`. */
  toTaskInsertPayload(row: CsvEmailRow, durationMinutes: number): CsvTaskPayload {
    const notes = [
      `Importé de l'e-mail de ${row.sender} le ${row.receivedAt.toISOString()}`,
      '',
      row.bodyPreview ?? '',
    ].join('\n');
    const due = new Date(row.receivedAt.getTime() + 24 * 60 * 60 * 1000);
    return {
      title: row.subject,
      notes,
      due,
      suggestedDurationMin: durationMinutes,
    };
  }
}
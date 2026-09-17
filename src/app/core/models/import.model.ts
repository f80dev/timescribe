// src/app/core/models/import.model.ts
// Implémenté tel quel depuis docs/cahier-des-charges.md §6.1

export interface CsvEmailRow {
  subject: string;
  sender: string;
  receivedAt: Date;
  threadId?: string;
  bodyPreview?: string;             // optionnel, < 500 chars
  suggestedDurationMin?: number;
}

export interface CalendarEventCandidate {
  eventId: string;
  title: string;
  start: Date;
  end: Date;
  attendees: string[];
  description?: string;
}
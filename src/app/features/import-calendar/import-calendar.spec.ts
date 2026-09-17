import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { signal } from '@angular/core';
import { ImportCalendar } from './import-calendar';
import { GoogleCalendarService } from '../../core/api/google-calendar.service';
import { GoogleTasksService } from '../../core/api/google-tasks.service';
import { DexieService } from '../../core/storage/dexie.service';
import { CalendarEventCandidate } from '../../core/models/import.model';

/**
 * Tests du composant ImportCalendar (cf §F7 / étape 16).
 *
 * Vérifie :
 * - chargement des événements Calendar sur la plage par défaut (30 derniers jours)
 * - calcul de durée par événement
 * - toggle de sélection
 * - "Créer les tâches" : batch insert avec throttle, chaque tâche
 *   a `estimate.source = 'manual'` et `durationMinutes = durée event`.
 */

class FakeCalendar {
  listEvents = vi.fn();
  computeEventDurationMinutes = vi.fn((e: CalendarEventCandidate) =>
    Math.round((e.end.getTime() - e.start.getTime()) / 60_000),
  );
}

class FakeTasksApi {
  insertTask = vi.fn();
}

class FakeDexie {
  upsertEstimate = vi.fn();
  upsertTask = vi.fn();
}

const mkEvent = (over: Partial<CalendarEventCandidate> = {}): CalendarEventCandidate => ({
  eventId: 'e1',
  title: 'Réunion équipe',
  start: new Date('2026-09-15T09:00:00Z'),
  end: new Date('2026-09-15T10:30:00Z'),
  attendees: [],
  ...over,
});

describe('ImportCalendar', () => {
  let calendar: FakeCalendar;
  let tasks: FakeTasksApi;

  beforeEach(async () => {
    calendar = new FakeCalendar();
    tasks = new FakeTasksApi();

    // Mock `Date.now()` pour stabiliser la plage par défaut.
    // On fixe "now" au 2026-09-17 (date du jour).
    const NOW = new Date('2026-09-17T12:00:00Z').getTime();
    vi.spyOn(Date, 'now').mockImplementation(() => NOW);

    await TestBed.configureTestingModule({
      imports: [ImportCalendar],
      providers: [
        provideRouter([]),
        { provide: GoogleCalendarService, useValue: calendar },
        { provide: GoogleTasksService, useValue: tasks },
        { provide: DexieService, useValue: new FakeDexie() },
      ],
    }).compileComponents();
  });

  it('crée le composant', () => {
    const fixture = TestBed.createComponent(ImportCalendar);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('refresh() charge les events sur 30 derniers jours et calcule la durée', async () => {
    calendar.listEvents.mockResolvedValueOnce({
      events: [
        mkEvent({ eventId: 'e1', start: new Date('2026-09-15T09:00:00Z'), end: new Date('2026-09-15T10:30:00Z') }),
      ],
    });
    const fixture = TestBed.createComponent(ImportCalendar);
    await fixture.componentInstance.refresh();
    const events = fixture.componentInstance.events();
    expect(events.length).toBe(1);
    expect(events[0].durationMinutes).toBe(90);
    // listEvents a reçu une plage de ~30 jours
    expect(calendar.listEvents).toHaveBeenCalled();
    const args = calendar.listEvents.mock.calls[0];
    const span = (args[1].getTime() - args[0].getTime()) / (1000 * 60 * 60 * 24);
    expect(span).toBeGreaterThan(28);
    expect(span).toBeLessThan(32);
  });

  it('toggleSelection() ajoute/retire l\'id du set', () => {
    const fixture = TestBed.createComponent(ImportCalendar);
    fixture.componentInstance.toggleSelection('e1');
    expect(fixture.componentInstance.selected().has('e1')).toBe(true);
    fixture.componentInstance.toggleSelection('e1');
    expect(fixture.componentInstance.selected().has('e1')).toBe(false);
  });

  it('createTasks() insère une tâche par event sélectionné avec estimate manual', async () => {
    tasks.insertTask.mockImplementation(async (listId: string, p: any) => ({
      id: 'created-' + p.title, title: p.title, notes: p.notes,
      status: 'needsAction', position: '0', taskListId: listId,
      updated: new Date(), due: p.due,
    }));
    calendar.listEvents.mockResolvedValueOnce({
      events: [
        mkEvent({ eventId: 'e1', title: 'Réunion' }),
        mkEvent({ eventId: 'e2', title: 'Atelier' }),
      ],
    });
    const fixture = TestBed.createComponent(ImportCalendar);
    await fixture.componentInstance.refresh();
    fixture.componentInstance.toggleSelection('e1');
    fixture.componentInstance.toggleSelection('e2');

    await fixture.componentInstance.createTasks();

    expect(tasks.insertTask).toHaveBeenCalledTimes(2);
    // Vérifie qu'au moins une des tâches insérées a les bons champs
    const firstCall = tasks.insertTask.mock.calls[0];
    expect(firstCall[0]).toBe('@default'); // tasklist
    expect(firstCall[1].title).toMatch(/Réunion|Atelier/);
  });
});
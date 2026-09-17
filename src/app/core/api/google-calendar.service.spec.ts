import { TestBed } from '@angular/core/testing';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GoogleCalendarService } from './google-calendar.service';

interface GapiCalendarMock {
  events: {
    list: ReturnType<typeof vi.fn>;
  };
}

function installCalendarMock(): GapiCalendarMock {
  const cal: GapiCalendarMock = {
    events: {
      list: vi.fn().mockResolvedValue({
        result: {
          items: [
            {
              id: 'evt-1',
              summary: 'Réunion projet',
              description: 'Décisions roadmap',
              start: { dateTime: '2026-09-10T10:00:00Z' },
              end: { dateTime: '2026-09-10T11:30:00Z' },
              attendees: [{ email: 'alice@example.com' }, { email: 'bob@example.com' }],
            },
            {
              id: 'evt-2',
              summary: 'Stand-up',
              start: { dateTime: '2026-09-11T09:00:00Z' },
              end: { dateTime: '2026-09-11T09:15:00Z' },
              attendees: [],
            },
          ],
          nextPageToken: 'tok-2',
        },
      }),
    },
  };
  const gapi = { client: { calendar: cal } };
  (window as any).gapi = gapi;
  return cal;
}

describe('GoogleCalendarService', () => {
  let cal: GapiCalendarMock;

  beforeEach(() => {
    cal = installCalendarMock();
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    delete (window as any).gapi;
  });

  it('listEvents() appelle events.list avec timeMin/timeMax + calendarId', async () => {
    const svc = TestBed.inject(GoogleCalendarService);
    const start = new Date('2026-09-01T00:00:00Z');
    const end = new Date('2026-09-30T00:00:00Z');
    await svc.listEvents(start, end);
    expect(cal.events.list).toHaveBeenCalledWith(
      expect.objectContaining({
        calendarId: 'primary',
        timeMin: start.toISOString(),
        timeMax: end.toISOString(),
      }),
    );
  });

  it('listEvents() mappe les events vers CalendarEventCandidate avec dates en Date', async () => {
    const svc = TestBed.inject(GoogleCalendarService);
    const events = await svc.listEvents(new Date(), new Date());
    expect(events.length).toBe(2);
    expect(events[0].eventId).toBe('evt-1');
    expect(events[0].title).toBe('Réunion projet');
    expect(events[0].start).toBeInstanceOf(Date);
    expect(events[0].end).toBeInstanceOf(Date);
    expect(events[0].attendees).toEqual(['alice@example.com', 'bob@example.com']);
    expect(events[1].description).toBeUndefined();
  });

  it('listEvents() retourne nextPageToken pour pagination', async () => {
    const svc = TestBed.inject(GoogleCalendarService);
    const page = await svc.listEvents(new Date(), new Date());
    expect(page.nextPageToken).toBe('tok-2');
  });

  it('listEvents() passe pageToken si fourni', async () => {
    const svc = TestBed.inject(GoogleCalendarService);
    await svc.listEvents(new Date(), new Date(), 'prev-tok');
    expect(cal.events.list).toHaveBeenCalledWith(
      expect.objectContaining({ pageToken: 'prev-tok' }),
    );
  });

  it('computeEventDurationMinutes() retourne la durée en minutes', () => {
    const svc = TestBed.inject(GoogleCalendarService);
    const start = new Date('2026-09-10T10:00:00Z');
    const end = new Date('2026-09-10T11:30:00Z');
    expect(svc.computeEventDurationMinutes({ eventId: 'x', title: '', start, end, attendees: [] })).toBe(90);
    // événement de 15 min
    const e2 = { eventId: 'y', title: '', start: new Date('2026-09-10T09:00:00Z'), end: new Date('2026-09-10T09:15:00Z'), attendees: [] };
    expect(svc.computeEventDurationMinutes(e2)).toBe(15);
  });
});
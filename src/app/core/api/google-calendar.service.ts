import { Injectable } from '@angular/core';
import { CalendarEventCandidate } from '../models/import.model';
import { GapiCalendarEvent } from '../auth/google-auth.types';

/**
 * API Google Calendar v3 (cf §F7 du CDC).
 *
 * S'appuie sur `gapi.client.calendar.events.list` (scope calendar.readonly).
 * - `listEvents(timeMin, timeMax, pageToken?)` : événements sur la plage,
 *   calendrier par défaut `primary`.
 * - `computeEventDurationMinutes(evt)` : durée (end - start) en minutes.
 */
@Injectable({ providedIn: 'root' })
export class GoogleCalendarService {
  /** Liste les événements sur une plage de dates, calendrier "primary". */
  async listEvents(
    timeMin: Date,
    timeMax: Date,
    pageToken?: string,
    calendarId = 'primary',
    maxResults = 250,
  ): Promise<CalendarListPage> {
    const gapi = this.requireGapi();
    const params: Record<string, unknown> = {
      calendarId,
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      maxResults,
      singleEvents: true,
      orderBy: 'startTime',
    };
    if (pageToken) params['pageToken'] = pageToken;
    const response = await gapi.client.calendar!.events.list(params);
    const events = (response.result.items ?? []) as GapiCalendarEvent[];
    return {
      events: events.map((e) => this.mapGapiEvent(e)),
      nextPageToken: response.result.nextPageToken,
    };
  }

  /** Durée d'un événement en minutes (entier). */
  computeEventDurationMinutes(evt: CalendarEventCandidate): number {
    return Math.round((evt.end.getTime() - evt.start.getTime()) / 60_000);
  }

  // ---------- Helpers ----------

  private mapGapiEvent(e: GapiCalendarEvent): CalendarEventCandidate {
    const startStr = e.start?.dateTime ?? e.start?.date;
    const endStr = e.end?.dateTime ?? e.end?.date;
    const start = startStr ? new Date(startStr) : new Date();
    const end = endStr ? new Date(endStr) : new Date();
    return {
      eventId: e.id,
      title: e.summary ?? '(sans titre)',
      start,
      end,
      attendees: (e.attendees ?? [])
        .map((a) => a.email)
        .filter((email): email is string => typeof email === 'string'),
      description: e.description,
    };
  }

  private requireGapi(): NonNullable<Window['gapi']> {
    if (typeof window === 'undefined' || !window.gapi || !window.gapi.client.calendar) {
      throw new Error('Calendar SDK non disponible. Connectez-vous d\'abord.');
    }
    return window.gapi;
  }
}

export interface CalendarListPage {
  events: CalendarEventCandidate[];
  nextPageToken?: string;
}
import { Pipe, PipeTransform } from '@angular/core';

/**
 * Pipe `duration` (cf §F3 du CDC).
 *
 * Formate une durée en minutes en libellé lisible :
 * - 0 / null / undefined → "—"
 * - < 60 → "Xmin"
 * - 60..1439 → "Hh MMmin" (les minutes 0 sont omises : 60 → "1h", 90 → "1h 30min")
 * - ≥ 1440 → "Xh" arrondi
 */
@Pipe({ name: 'duration' })
export class DurationPipe implements PipeTransform {
  transform(minutes: number | null | undefined): string {
    if (minutes === null || minutes === undefined || minutes <= 0) {
      return '—';
    }
    if (minutes < 60) {
      return `${minutes}min`;
    }
    const totalHours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (totalHours >= 24) {
      return `${Math.round(minutes / 60)}h`;
    }
    if (remainingMinutes === 0) {
      return `${totalHours}h`;
    }
    return `${totalHours}h ${remainingMinutes}min`;
  }
}
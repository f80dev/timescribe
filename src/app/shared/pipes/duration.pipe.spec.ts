import { DurationPipe } from './duration.pipe';

/**
 * Tests du pipe `duration` (cf §F3 du CDC).
 *
 * Formats acceptés en entrée : nombre de minutes (number).
 * Sortie :
 * - 0 → "—"
 * - < 60 → "Xmin"
 * - 60..1439 → "Hh MMmin"
 * - ≥ 1440 → "Hh" (heures pleines)
 */

describe('DurationPipe', () => {
  const pipe = new DurationPipe();

  it('transforme 0 en tiret (estimation absente)', () => {
    expect(pipe.transform(0)).toBe('—');
  });

  it('transforme les minutes < 60 en "Xmin"', () => {
    expect(pipe.transform(15)).toBe('15min');
    expect(pipe.transform(45)).toBe('45min');
    expect(pipe.transform(59)).toBe('59min');
  });

  it('transforme 60..1439 en "Hh MMmin" (1h30 → 1h 30min)', () => {
    expect(pipe.transform(60)).toBe('1h');
    expect(pipe.transform(90)).toBe('1h 30min');
    expect(pipe.transform(125)).toBe('2h 5min');
  });

  it('transforme ≥ 1440 en heures seules arrondies', () => {
    expect(pipe.transform(1440)).toBe('24h');
    expect(pipe.transform(1500)).toBe('25h');
  });

  it('gère null/undefined comme "—"', () => {
    expect(pipe.transform(null as unknown as number)).toBe('—');
    expect(pipe.transform(undefined as unknown as number)).toBe('—');
  });
});
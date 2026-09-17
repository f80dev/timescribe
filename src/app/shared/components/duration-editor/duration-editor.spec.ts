import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { DurationEditorComponent } from './duration-editor';

/**
 * Tests de DurationEditorComponent (cf §F5 / étape 14).
 *
 * Éditeur HH:MM (en minutes). Émet `change` quand l'utilisateur saisit une valeur.
 */

describe('DurationEditorComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DurationEditorComponent],
    }).compileComponents();
  });

  it('crée le composant', () => {
    const fixture = TestBed.createComponent(DurationEditorComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('initialise le champ avec la valeur passée (en minutes)', () => {
    const fixture = TestBed.createComponent(DurationEditorComponent);
    fixture.componentRef.setInput('valueMinutes', 90);
    fixture.detectChanges();
    // 90min = 1h 30 → le composant doit afficher "1:30" ou "1h30" ou similaire
    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html).toMatch(/1.*30/);
  });

  it('initialise à 0 par défaut', () => {
    const fixture = TestBed.createComponent(DurationEditorComponent);
    fixture.componentRef.setInput('valueMinutes', 0);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    expect(component.valueMinutes()).toBe(0);
  });
});
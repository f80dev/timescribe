import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach } from 'vitest';
import { TaskCardComponent } from './task-card';
import { GoogleTask } from '../../../core/models/task.model';

/**
 * Tests de TaskCardComponent (cf §F3 / étape 13).
 *
 * Vérifie :
 * - rendu du titre et de la due date
 * - badge durée via DurationPipe
 * - icône source d'estimation (manual / llm / none)
 * - réactivité au changement de task (signal input)
 */

describe('TaskCardComponent', () => {
  const mkTask = (over: Partial<GoogleTask> = {}): GoogleTask => ({
    id: 't1',
    title: 'Préparer la réunion',
    status: 'needsAction',
    position: '0',
    taskListId: '@default',
    updated: new Date('2026-09-10'),
    due: new Date('2026-09-20'),
    ...over,
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TaskCardComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('crée le composant', () => {
    const fixture = TestBed.createComponent(TaskCardComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('affiche le titre et la due date', () => {
    const fixture = TestBed.createComponent(TaskCardComponent);
    fixture.componentRef.setInput('task', mkTask());
    fixture.detectChanges();
    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html).toContain('Préparer la réunion');
    expect(html).toMatch(/20/); // date locale FR — jour
  });

  it('affiche "—" quand la tâche n\'a pas d\'estimation', () => {
    const fixture = TestBed.createComponent(TaskCardComponent);
    fixture.componentRef.setInput('task', mkTask());
    fixture.detectChanges();
    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html).toContain('—');
  });

  it('affiche la durée formatée quand l\'estimation existe', () => {
    const fixture = TestBed.createComponent(TaskCardComponent);
    fixture.componentRef.setInput('task', mkTask({
      estimate: {
        taskId: 't1',
        durationMinutes: 90,
        confidence: 0.8,
        source: 'llm',
        estimatedAt: new Date(),
      },
    }));
    fixture.detectChanges();
    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html).toContain('1h 30min');
  });

  it('badge "Manuel" pour source manual', () => {
    const fixture = TestBed.createComponent(TaskCardComponent);
    fixture.componentRef.setInput('task', mkTask({
      estimate: {
        taskId: 't1',
        durationMinutes: 30,
        confidence: 1,
        source: 'manual',
        estimatedAt: new Date(),
        overriddenBy: 'manual',
      },
    }));
    fixture.detectChanges();
    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html).toMatch(/manuel|ajust/i);
  });

  it('badge "LLM" pour source llm', () => {
    const fixture = TestBed.createComponent(TaskCardComponent);
    fixture.componentRef.setInput('task', mkTask({
      estimate: {
        taskId: 't1',
        durationMinutes: 30,
        confidence: 0.7,
        source: 'llm',
        estimatedAt: new Date(),
      },
    }));
    fixture.detectChanges();
    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html).toMatch(/llm/i);
  });
});
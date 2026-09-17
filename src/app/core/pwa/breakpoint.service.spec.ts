import { TestBed } from '@angular/core/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BreakpointObserver } from '@angular/cdk/layout';
import { BreakpointService } from './breakpoint.service';

/**
 * BreakpointService expose 3 signaux (mobile/tablet/desktop) mis à jour
 * par les émissions du `BreakpointObserver.observe()`.
 *
 * On intercepte `observe()` via un mock qui simule une émission immédiate
 * d'un `BreakpointState`. C'est ce que retourne l'API CDK en vrai.
 */
describe('BreakpointService', () => {
  let isMatched: ReturnType<typeof vi.fn>;
  let subscribeHandler: ((state: { breakpoints: Record<string, boolean> }) => void) | null;
  let observeMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    isMatched = vi.fn().mockReturnValue(false);
    subscribeHandler = null;
    observeMock = vi.fn().mockImplementation(() => ({
      pipe: () => ({
        subscribe: (handler: any) => {
          subscribeHandler = handler;
          return { closed: false };
        },
      }),
    }));

    TestBed.configureTestingModule({
      providers: [
        { provide: BreakpointObserver, useValue: { isMatched, observe: observeMock } },
        BreakpointService,
      ],
    });
  });

  function emit(breakpoints: Record<string, boolean>): void {
    subscribeHandler!({ breakpoints });
  }

  it('expose les signaux isMobile / isTablet / isDesktop', () => {
    const svc = TestBed.inject(BreakpointService);
    expect(svc.isMobile).toBeTypeOf('function');
    expect(svc.isTablet).toBeTypeOf('function');
    expect(svc.isDesktop).toBeTypeOf('function');
    // Default = desktop (avant première émission)
    expect(svc.isDesktop()).toBe(true);
  });

  it('isMobile = true après émission mobile', () => {
    const svc = TestBed.inject(BreakpointService);
    emit({
      '(max-width: 599.98px)': true,
      '(min-width: 600px) and (max-width: 959.98px)': false,
      '(min-width: 960px)': false,
    });
    expect(svc.isMobile()).toBe(true);
    expect(svc.isTablet()).toBe(false);
    expect(svc.isDesktop()).toBe(false);
  });

  it('isTablet = true après émission tablet', () => {
    const svc = TestBed.inject(BreakpointService);
    emit({
      '(max-width: 599.98px)': false,
      '(min-width: 600px) and (max-width: 959.98px)': true,
      '(min-width: 960px)': false,
    });
    expect(svc.isMobile()).toBe(false);
    expect(svc.isTablet()).toBe(true);
    expect(svc.isDesktop()).toBe(false);
  });

  it('isDesktop = true après émission desktop', () => {
    const svc = TestBed.inject(BreakpointService);
    emit({
      '(max-width: 599.98px)': false,
      '(min-width: 600px) and (max-width: 959.98px)': false,
      '(min-width: 960px)': true,
    });
    expect(svc.isMobile()).toBe(false);
    expect(svc.isTablet()).toBe(false);
    expect(svc.isDesktop()).toBe(true);
  });

  it('observe() est appelé avec un tableau de 3 queries Material', () => {
    TestBed.inject(BreakpointService);
    const queries = observeMock.mock.calls[0][0] as string[];
    expect(Array.isArray(queries)).toBe(true);
    expect(queries.length).toBe(3);
    expect(queries.some((q: string) => q.includes('599.98px'))).toBe(true);
    expect(queries.some((q: string) => q.includes('959.98px'))).toBe(true);
    expect(queries.some((q: string) => q.includes('960px'))).toBe(true);
  });
});
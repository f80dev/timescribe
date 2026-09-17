import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BreakpointService } from './breakpoint.service';

interface ObserverMock {
  isMatched: ReturnType<typeof vi.fn>;
  observe: ReturnType<typeof vi.fn>;
}

function makeObserver(): ObserverMock {
  const isMatched = vi.fn().mockReturnValue(false);
  const observe = vi.fn().mockImplementation(() => ({ subscribe: () => ({}) }));
  return { isMatched, observe };
}

describe('BreakpointService', () => {
  let mockObserver: ObserverMock;

  beforeEach(() => {
    mockObserver = makeObserver();
    TestBed.configureTestingModule({
      providers: [
        { provide: (globalThis as any).ngDevMode ?? Object, useValue: {} },
      ],
    });
  });

  it('exposes isMobile / isTablet / isDesktop as signals', () => {
    // Le service doit exposer ces trois signaux. Tant qu'il n'existe pas, ce test échoue.
    const svc = TestBed.runInInjectionContext(() => new (BreakpointService as any)(mockObserver));
    expect(svc).toBeDefined();
    expect(typeof svc.isMobile).toBe('function');
    expect(typeof svc.isTablet).toBe('function');
    expect(typeof svc.isDesktop).toBe('function');
  });

  it('isMobile is true when current viewport <= 599px', () => {
    mockObserver.isMatched.mockImplementation((q: string) => q.includes('599.98px'));
    const svc = TestBed.runInInjectionContext(() => new (BreakpointService as any)(mockObserver));
    expect(svc.isMobile()).toBe(true);
    expect(svc.isTablet()).toBe(false);
    expect(svc.isDesktop()).toBe(false);
  });

  it('isTablet is true when viewport is in 600-959px range', () => {
    mockObserver.isMatched.mockImplementation((q: string) => q.includes('959.98px'));
    const svc = TestBed.runInInjectionContext(() => new (BreakpointService as any)(mockObserver));
    expect(svc.isMobile()).toBe(false);
    expect(svc.isTablet()).toBe(true);
    expect(svc.isDesktop()).toBe(false);
  });

  it('isDesktop is true when viewport >= 960px', () => {
    mockObserver.isMatched.mockImplementation((q: string) => q.includes('960px'));
    const svc = TestBed.runInInjectionContext(() => new (BreakpointService as any)(mockObserver));
    expect(svc.isMobile()).toBe(false);
    expect(svc.isTablet()).toBe(false);
    expect(svc.isDesktop()).toBe(true);
  });

  it('observe() est appelé avec les 3 queries Material au démarrage', () => {
    TestBed.runInInjectionContext(() => new (BreakpointService as any)(mockObserver));
    const queries = mockObserver.observe.mock.calls.map((c: any[]) => c[0]);
    expect(queries.length).toBeGreaterThanOrEqual(3);
    expect(queries.some((q: string) => q.includes('599.98px'))).toBe(true);
    expect(queries.some((q: string) => q.includes('959.98px'))).toBe(true);
    expect(queries.some((q: string) => q.includes('960px'))).toBe(true);
  });
});
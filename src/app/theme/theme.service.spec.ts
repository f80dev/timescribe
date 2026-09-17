import { TestBed } from '@angular/core/testing';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  let matchMediaListeners: Array<(e: MediaQueryListEvent) => void> = [];
  let matchMediaValue = false;
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    matchMediaListeners = [];
    matchMediaValue = false;
    originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: matchMediaValue,
      media: query,
      addEventListener: (_t: string, h: any) => matchMediaListeners.push(h),
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
      onchange: null,
    })) as any;
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('default theme = light quand pas de préférence stockée', () => {
    const svc = TestBed.inject(ThemeService);
    expect(svc.current()).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('loadPreference() lit localStorage', () => {
    localStorage.setItem('timescribe:theme', 'dark');
    const svc = TestBed.inject(ThemeService);
    svc.loadPreference();
    expect(svc.current()).toBe('dark');
  });

  it('set() met à jour current, data-theme, et localStorage', () => {
    const svc = TestBed.inject(ThemeService);
    svc.set('dark');
    expect(svc.current()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('timescribe:theme')).toBe('dark');
  });

  it('set("system") suit les changements de prefers-color-scheme', () => {
    matchMediaValue = true; // prefers dark
    const svc = TestBed.inject(ThemeService);
    svc.set('system');
    expect(svc.current()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    // Simule un changement système (passage en light)
    matchMediaValue = false;
    matchMediaListeners.forEach((l) => l({ matches: false } as MediaQueryListEvent));
    expect(svc.current()).toBe('light');
  });

  it('toggle() alterne light ↔ dark', () => {
    const svc = TestBed.inject(ThemeService);
    expect(svc.current()).toBe('light');
    svc.toggle();
    expect(svc.current()).toBe('dark');
    svc.toggle();
    expect(svc.current()).toBe('light');
  });
});
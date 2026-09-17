import { TestBed } from '@angular/core/testing';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { OnlineStatusService } from './online-status.service';

describe('OnlineStatusService', () => {
  let events: Record<string, ((e: Event) => void)[]> = {};
  let originalAdd: typeof window.addEventListener;
  let originalRemove: typeof window.removeEventListener;
  let originalOnLine: boolean;

  beforeEach(() => {
    events = {};
    originalAdd = window.addEventListener;
    originalRemove = window.removeEventListener;
    originalOnLine = navigator.onLine;
    window.addEventListener = ((type: string, handler: any) => {
      (events[type] ||= []).push(handler);
    }) as any;
    window.removeEventListener = (() => {}) as any;
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    window.addEventListener = originalAdd;
    window.removeEventListener = originalRemove;
    Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true });
  });

  function fire(type: string) {
    for (const h of events[type] || []) h(new Event(type));
  }

  it('isOnline reflète navigator.onLine au démarrage', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    const svc = TestBed.inject(OnlineStatusService);
    expect(svc.isOnline()).toBe(true);
  });

  it('isOnline passe à false sur événement offline', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    const svc = TestBed.inject(OnlineStatusService);
    expect(svc.isOnline()).toBe(true);
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    fire('offline');
    expect(svc.isOnline()).toBe(false);
  });

  it('isOnline repasse à true sur événement online', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    const svc = TestBed.inject(OnlineStatusService);
    expect(svc.isOnline()).toBe(false);
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    fire('online');
    expect(svc.isOnline()).toBe(true);
  });

  it('écoute les événements online et offline', () => {
    TestBed.inject(OnlineStatusService);
    expect(events['online']).toBeDefined();
    expect(events['offline']).toBeDefined();
  });
});
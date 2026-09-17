import { TestBed } from '@angular/core/testing';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { InstallPromptService } from './install-prompt.service';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

function makeBeforeInstallPromptEvent(): BeforeInstallPromptEvent {
  const ev = new Event('beforeinstallprompt') as BeforeInstallPromptEvent;
  ev.prompt = vi.fn().mockResolvedValue(undefined);
  ev.userChoice = Promise.resolve({ outcome: 'accepted', platform: 'web' });
  return ev;
}

describe('InstallPromptService', () => {
  let events: { type: string; handler: (e: Event) => void }[] = [];
  let originalAdd: typeof window.addEventListener;
  let originalRemove: typeof window.removeEventListener;

  beforeEach(() => {
    events = [];
    originalAdd = window.addEventListener;
    originalRemove = window.removeEventListener;
    window.addEventListener = ((type: string, handler: any) => {
      events.push({ type, handler });
    }) as any;
    window.removeEventListener = (() => {}) as any;
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    window.addEventListener = originalAdd;
    window.removeEventListener = originalRemove;
  });

  it('écoute beforeinstallprompt au démarrage', () => {
    TestBed.inject(InstallPromptService);
    expect(events.some((e) => e.type === 'beforeinstallprompt')).toBe(true);
  });

  it('promptAvailable passe à true après un événement beforeinstallprompt', () => {
    const svc = TestBed.inject(InstallPromptService);
    expect(svc.promptAvailable()).toBe(false);
    const ev = makeBeforeInstallPromptEvent();
    events.find((e) => e.type === 'beforeinstallprompt')!.handler(ev);
    expect(svc.promptAvailable()).toBe(true);
  });

  it('promptAvailable passe à false après appinstalled', () => {
    const svc = TestBed.inject(InstallPromptService);
    events.find((e) => e.type === 'beforeinstallprompt')!.handler(makeBeforeInstallPromptEvent());
    expect(svc.promptAvailable()).toBe(true);
    events.find((e) => e.type === 'appinstalled')!.handler(new Event('appinstalled'));
    expect(svc.promptAvailable()).toBe(false);
  });

  it('triggerInstall() appelle prompt() et résout le userChoice', async () => {
    const svc = TestBed.inject(InstallPromptService);
    const ev = makeBeforeInstallPromptEvent();
    events.find((e) => e.type === 'beforeinstallprompt')!.handler(ev);
    const outcome = await svc.triggerInstall();
    expect(outcome).toBe('accepted');
    expect(ev.prompt).toHaveBeenCalledTimes(1);
  });
});
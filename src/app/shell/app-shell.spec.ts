import { vi, describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { AppShell } from './app-shell';
import { BreakpointService } from '../core/pwa/breakpoint.service';
import { OnlineStatusService } from '../core/pwa/online-status.service';
import { InstallPromptService } from '../core/pwa/install-prompt.service';

class FakeBreakpoint {
  isMobile = signal(false);
  isTablet = signal(false);
  isDesktop = signal(true);
  toggleMobile(v: boolean) {
    this.isMobile.set(v);
    this.isDesktop.set(!v);
  }
}

class FakeOnline {
  isOnline = signal(true);
}

class FakeInstall {
  promptAvailable = signal(false);
  triggerInstall = vi.fn().mockResolvedValue('accepted');
}

describe('AppShell', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppShell],
      providers: [
        provideRouter([]),
        { provide: BreakpointService, useClass: FakeBreakpoint },
        { provide: OnlineStatusService, useClass: FakeOnline },
        { provide: InstallPromptService, useClass: FakeInstall },
      ],
    }).compileComponents();
  });

  it('crée le composant', () => {
    const fixture = TestBed.createComponent(AppShell);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('affiche la toolbar et le router-outlet sur desktop', () => {
    const bp = TestBed.inject(BreakpointService) as unknown as FakeBreakpoint;
    bp.toggleMobile(false);
    const fixture = TestBed.createComponent(AppShell);
    fixture.detectChanges();
    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(html).toContain('toolbar');
    expect(html).toContain('router-outlet');
  });

  it('affiche le bottom-nav UNIQUEMENT sur mobile', () => {
    const bp = TestBed.inject(BreakpointService) as unknown as FakeBreakpoint;
    bp.toggleMobile(true);
    const fixture = TestBed.createComponent(AppShell);
    fixture.detectChanges();
    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(html).toContain('bottom-nav');

    bp.toggleMobile(false);
    fixture.detectChanges();
    const html2 = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(html2).not.toContain('bottom-nav');
  });

  it('affiche un bandeau offline quand navigator.onLine = false', () => {
    const online = TestBed.inject(OnlineStatusService) as unknown as FakeOnline;
    online.isOnline.set(false);
    const fixture = TestBed.createComponent(AppShell);
    fixture.detectChanges();
    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(html).toMatch(/hors[\s-]?ligne/i);
  });
});
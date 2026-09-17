import { Injectable, inject, signal, DestroyRef } from '@angular/core';
import { BreakpointObserver, BreakpointState } from '@angular/cdk/layout';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

/**
 * Service de détection de breakpoints responsive (cf §4bis du CDC).
 * 3 zones : mobile (≤ 599px), tablet (600-959px), desktop (≥ 960px).
 *
 * Expose 3 signals + un signal "current" pour simplifier le template shell.
 */
@Injectable({ providedIn: 'root' })
export class BreakpointService {
  private readonly bp = inject(BreakpointObserver);
  private readonly destroyRef = inject(DestroyRef);

  // Requêtes alignées Angular Material (XSmall/Small/Medium/Large/ExtraLarge)
  // On utilise des max-width pour distinguer mobile/tablet/desktop.
  private readonly mobileQuery = '(max-width: 599.98px)';
  private readonly tabletQuery = '(min-width: 600px) and (max-width: 959.98px)';
  private readonly desktopQuery = '(min-width: 960px)';

  readonly isMobile = signal(false);
  readonly isTablet = signal(false);
  readonly isDesktop = signal(true);

  constructor() {
    this.bp
      .observe([this.mobileQuery, this.tabletQuery, this.desktopQuery])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((state: BreakpointState) => {
        this.isMobile.set(state.breakpoints[this.mobileQuery] ?? false);
        this.isTablet.set(state.breakpoints[this.tabletQuery] ?? false);
        this.isDesktop.set(state.breakpoints[this.desktopQuery] ?? false);
      });
  }
}
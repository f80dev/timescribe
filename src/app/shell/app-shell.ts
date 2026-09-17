import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { BreakpointService } from '../core/pwa/breakpoint.service';
import { OnlineStatusService } from '../core/pwa/online-status.service';
import { BottomNav } from './bottom-nav/bottom-nav';

/**
 * Layout principal (cf §F9 du CDC).
 *
 * - Toolbar fixe en haut (toutes tailles).
 * - Sidenav `mode="side"` permanent sur desktop (≥ 960px) et tablet (≥ 768px).
 * - Sidenav `mode="over"` mobile (≤ 599px), fermé par défaut, ouvert via hamburger.
 * - Bottom-nav 3 onglets AFFICHÉ UNIQUEMENT sur mobile (≤ 599px), caché ≥ 600px.
 * - Bandeau offline si `OnlineStatusService.isOnline() === false`.
 *
 * Le FAB n'est PAS rendu ici — il appartient à chaque écran liste
 * (cf §F9 « FAB rendu comme sibling du toolbar, pas enfant »).
 */
@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    BottomNav,
  ],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
})
export class AppShell {
  protected readonly bp = inject(BreakpointService);
  protected readonly online = inject(OnlineStatusService);
  protected readonly drawerOpened = signal(false);

  protected readonly sidenavMode = computed<'side' | 'over'>(() =>
    this.bp.isDesktop() || this.bp.isTablet() ? 'side' : 'over',
  );

  protected readonly showBottomNav = computed(() => this.bp.isMobile());

  protected closeIfOver(): void {
    if (this.sidenavMode() === 'over') {
      this.drawerOpened.set(false);
    }
  }
}
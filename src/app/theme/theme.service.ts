import { Injectable, signal, DestroyRef, inject } from '@angular/core';

export type ThemeChoice = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'timescribe:theme';
const DATA_ATTR = 'data-theme';

/**
 * Service de gestion du thème (cf §3 conventions « Theming » du CDC).
 *
 * Trois modes :
 * - `light` : force le thème clair
 * - `dark` : force le thème sombre
 * - `system` : suit `prefers-color-scheme`
 *
 * Le thème résolu est exposé via `current()` et appliqué via l'attribut
 * `data-theme` sur `<html>` (cf §4bis tokens). La persistance est en
 * localStorage (clé `timescribe:theme`).
 *
 * Note : ce service gère la PRÉFÉRENCE. Les tokens Material sont chargés
 * par `styles.scss` (mixin `mat.theme()`) et la CSS `[_shared.scss]`
 * applique les couleurs via `var(--mat-sys-*)`.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly destroyRef = inject(DestroyRef);

  /** Préférence utilisateur (peut être 'system'). */
  readonly preference = signal<ThemeChoice>('light');
  /** Thème résolu effectivement appliqué. */
  readonly current = signal<ResolvedTheme>('light');

  private systemDark = false;
  private systemListener: ((e: MediaQueryListEvent) => void) | null = null;

  constructor() {
    this.loadPreference();
  }

  /** Lit la préférence depuis localStorage et applique. */
  loadPreference(): void {
    if (typeof localStorage === 'undefined') return;
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeChoice | null;
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      this.preference.set(stored);
      this.applyPreference(stored);
    } else {
      this.applyPreference('light');
    }
  }

  /** Change la préférence et applique. */
  set(theme: ThemeChoice): void {
    this.preference.set(theme);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, theme);
    }
    this.applyPreference(theme);
  }

  /** Bascule light ↔ dark (raccourci pour la toolbar). */
  toggle(): void {
    this.set(this.current() === 'dark' ? 'light' : 'dark');
  }

  private applyPreference(theme: ThemeChoice): void {
    this.detachSystemListener();
    if (theme === 'system') {
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      this.systemDark = mql.matches;
      this.systemListener = (e: MediaQueryListEvent) => {
        this.systemDark = e.matches;
        this.applyToDom();
      };
      mql.addEventListener('change', this.systemListener);
      this.destroyRef.onDestroy(() => this.detachSystemListener());
    }
    this.applyToDom();
  }

  private detachSystemListener(): void {
    if (this.systemListener && typeof window !== 'undefined' && window.matchMedia) {
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      mql.removeEventListener('change', this.systemListener);
    }
    this.systemListener = null;
  }

  private applyToDom(): void {
    const pref = this.preference();
    const resolved: ResolvedTheme =
      pref === 'system' ? (this.systemDark ? 'dark' : 'light') : pref;
    this.current.set(resolved);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute(DATA_ATTR, resolved);
      document.documentElement.style.colorScheme = resolved;
    }
  }
}
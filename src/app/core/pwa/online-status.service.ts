import { Injectable, signal, DestroyRef, inject } from '@angular/core';

/**
 * État de connectivité réseau. Le service écoute `online` / `offline` sur `window`
 * et expose un signal `isOnline()`. Cf §5.5 — déclenche le bandeau snack-bar
 * "hors ligne" + désactive l'estimation LLM.
 */
@Injectable({ providedIn: 'root' })
export class OnlineStatusService {
  private readonly destroyRef = inject(DestroyRef);
  readonly isOnline = signal(this.readNavigatorOnline());

  constructor() {
    const onlineHandler = () => this.isOnline.set(true);
    const offlineHandler = () => this.isOnline.set(false);
    window.addEventListener('online', onlineHandler);
    window.addEventListener('offline', offlineHandler);
    this.destroyRef.onDestroy(() => {
      window.removeEventListener('online', onlineHandler);
      window.removeEventListener('offline', offlineHandler);
    });
  }

  private readNavigatorOnline(): boolean {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  }
}
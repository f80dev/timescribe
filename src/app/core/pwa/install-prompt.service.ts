import { Injectable, signal, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject } from 'rxjs';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export type InstallResult = 'accepted' | 'dismissed' | 'unavailable';

/**
 * Gère le prompt d'installation PWA (cf §5.5 du CDC).
 *
 * - `beforeinstallprompt` : événement Chromium qui nous permet de différer l'invite.
 * - `appinstalled` : événement émis une fois l'app installée (ferme le prompt).
 *
 * Note iOS : Safari ne déclenche pas `beforeinstallprompt`. L'UI doit afficher
 * des instructions manuelles (cf F9 / §5.5).
 */
@Injectable({ providedIn: 'root' })
export class InstallPromptService {
  private readonly destroyRef = inject(DestroyRef);
  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  /** Signal indiquant qu'un prompt est disponible et peut être déclenché. */
  readonly promptAvailable = signal(false);

  constructor() {
    const handler = (e: Event) => {
      e.preventDefault();
      this.deferredPrompt = e as BeforeInstallPromptEvent;
      this.promptAvailable.set(true);
    };
    const installedHandler = () => {
      this.deferredPrompt = null;
      this.promptAvailable.set(false);
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', installedHandler);
    this.destroyRef.onDestroy(() => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    });
  }

  /** Déclenche la demande d'installation. Résout avec le choix utilisateur. */
  async triggerInstall(): Promise<InstallResult> {
    if (!this.deferredPrompt) return 'unavailable';
    const prompt = this.deferredPrompt.prompt;
    const userChoice = this.deferredPrompt.userChoice;
    // On peut consommer l'événement maintenant (Chromium n'envoie qu'un prompt par event).
    this.deferredPrompt = null;
    this.promptAvailable.set(false);
    await prompt();
    const choice = await userChoice;
    return choice.outcome;
  }
}
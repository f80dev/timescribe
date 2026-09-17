# AGENTS.md — TimeScribe

> **Cahier des charges exécutable** destiné à un agent IA autonome (opencode, claude-code, codex).
> L'agent lit ce fichier une seule fois et livre l'application complète sans autre consigne.
>
> **Cible : webapp utilisable sur ordinateur ET sur smartphone.** Toute l'UI est responsive mobile-first ; aucune fonctionnalité desktop-only. Voir §4bis pour la matrice de breakpoints et §F1/F3/F5/F6/F7 pour les adaptations spécifiques par écran.

---

## 0. Mission

Construire **TimeScribe**, une webapp Angular 22 + Angular Material qui se connecte à **Google Tasks** et **Google Drive** d'un utilisateur (OAuth explicite) pour :

1. **Évaluer automatiquement la charge de travail** (durée estimée) de chaque tâche Google Tasks — y compris terminées — en s'appuyant sur :
   - L'historique des tâches **déjà évaluées manuellement** (vérité terrain).
   - Un **corpus documentaire** stocké dans un répertoire Google Drive choisi par l'utilisateur (notes internes, comptes-rendus, specs, fiches de poste, bases de connaissances métier, etc.).
   - Un **LLM** (Minimax M3 via API OpenAI-compatible) qui croise les deux sources.
2. **Importer en bloc** des tâches déjà réalisées à partir de :
   - Un export CSV d'e-mails (format défini en §6.5).
   - Une sélection d'événements Google Calendar.
3. Permettre un **ajustement manuel** de la durée estimée sur chaque tâche (override toujours gagnant).
4. Permettre d'**ajouter / changer le répertoire documentaire** utilisé comme contexte d'évaluation à tout moment.

**Métrique de succès v1 :** pour 100 tâches actives, ≥ 70 % obtiennent une estimation LLM sans fallback manuel, l'écart médian entre estimation LLM et ajustement manuel final est ≤ 30 %.

---

> **Note implémentation v1 :** L'application est déployée sur **Cloudflare Pages** (et non GitHub Pages comme suggéré dans le cahier des charges initial). Le `baseHref` et le déploiement sont adaptés à Cloudflare Pages via `@cloudflare/workers-types` et un script `pages.yml`. La matrice de tests et le bundle restent identiques.
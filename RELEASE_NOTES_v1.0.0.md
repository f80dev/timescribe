# TimeScribe v1.0.0 — 20 septembre 2026

Première version stable de **TimeScribe**, webapp Angular 22 + Material qui estime automatiquement la durée de vos tâches Google Tasks via un LLM (Minimax M3).

---

## 🎯 Métrique de succès v1

Pour 100 tâches actives, ≥ 70 % obtiennent une estimation LLM sans fallback manuel, écart médian ≤ 30 %.

→ Test terrain à conduire par l'équipe dans les 30 jours suivant le déploiement Cloudflare Pages.

---

## ✨ Fonctionnalités

### Authentification
- OAuth Google avec Google Identity Services
- Scopes : Tasks (lecture/écriture), Drive (lecture), Calendar (lecture)
- Tokens **jamais** persistés en localStorage/sessionStorage

### Tableau de bord
- Liste des tâches `@default` avec badges d'estimation
- Filtres par statut, recherche
- FAB pour ajout rapide
- Réévaluation en masse

### Détail tâche
- Affichage complet + ajustement durée manuel (override gagnant)
- Bouton **Re-estimer par LLM**
- Marquage terminée alimente l'historique

### Corpus documentaire
- Sélection d'un dossier Drive comme contexte
- Déduplication par hash, troncature configurable
- Support Google Docs / PDF / .md / .txt

### Import en bloc
- **CSV Gmail** (parser tolérant, format Google Takeout)
- **Google Calendar** (sélection multi-événements sur plage de dates)

### Paramètres
- Config LLM (URL, modèle, température, tokens max, seuils)
- Thème clair/sombre/système
- Import/export/reset des données locales

### PWA + responsive
- Installable (Chrome/Edge/Safari)
- Service worker offline
- Mobile-first : bottom-nav < 768 px, sidenav ≥ 768 px

### CI/CD
- GitHub Actions : lint + build + test (Node 22.22.3)
- Déploiement Cloudflare Pages
- Headers de sécurité (XFO, nosniff, Permissions-Policy)

---

## 📊 Qualité

| Métrique | Cible (ADR) | Livré v1 |
|---|---|---|
| Tests passants | 100 % | **115/115 ✅** (24 fichiers) |
| Coverage statements | ≥ 70 % | **86,37 % ✅** |
| Coverage branches | ≥ 60 % | **74,08 % ✅** |
| Coverage functions | ≥ 70 % | **82,91 % ✅** |
| Coverage lines | ≥ 70 % | **86,83 % ✅** |
| Build production | exit 0 | ✅ 549 kB initial |
| TypeScript strict | exit 0 | ✅ `tsc --noEmit` clean |

---

## 🔧 Stack technique

- **Frontend** : Angular 22.1 + Angular Material 22.1.7 + CDK 22.1
- **State** : Signals natifs Angular 22
- **Stockage local** : Dexie 4 (IndexedDB)
- **CSV parsing** : PapaParse
- **PDF** : pdfjs-dist
- **Tests** : Vitest 4.1.11 via `@angular/build:unit-test`
- **Build** : `@angular/build:application` (Vite/esbuild)
- **Hébergement** : Cloudflare Pages (ADR-008)
- **CI** : GitHub Actions (Node 22.22.3)
- **LLM** : Minimax M3 (placeholder API à valider — voir §5.4 du CDC)

---

## 🚧 Limitations connues

- 1 seule liste Google Tasks (`@default`) — multi-list non supporté en v1
- 1 seul dossier corpus à la fois
- Pas d'export en bloc vers Google Tasks (ajustement manuel uniquement)
- Clé API LLM en clair dans Paramètres (pas de chiffrement de bout en bout en v1 — ADR-001 attendait AES-GCM + PBKDF2, à implémenter en v1.1)
- Lighthouse audit adv only (job continue-on-error) — pas bloquant en CI

---

## 📚 Documentation

- `docs/cahier-des-charges.md` (1092 lignes) — CDC technique complet
- `docs/decisions.md` — ADR-001..012
- `docs/user-guide.md` — guide utilisateur en français
- `docs/cloudflare-pages-deploy.md` — procédure de déploiement
- `AGENTS.md` (27 lignes) — résumé exécutif pour agents IA

---

## 📦 Artefacts

- **Repo** : https://github.com/f80dev/timescribe
- **Branche principale** : `main` (39 commits)
- **Tag** : `v1.0.0`
- **Build output** : `dist/timescribe/browser/`
- **CI** : `.github/workflows/ci.yml`

---

## 🔜 Roadmap v1.1

1. Chiffrement clé API LLM (AES-GCM + PBKDF2, ADR-001)
2. Multi-listes Google Tasks
3. Export en bloc vers Google Tasks
4. Tests E2E Playwright (§10.2 du CDC)
5. Internationalisation (i18n) — base anglaise en plus du français

---

## ✅ Definition of Done (vérifié)

- [x] Toutes les étapes du plan §8 du CDC (1 à 22, sauf 3 annulée)
- [x] Preuves §8bis du CDC : npm install OK, ng build OK, ng test --coverage OK
- [x] Coverage ≥ 80 % core, ≥ 70 % global (ADR seuils)
- [x] TDD strict respecté (cycle test → feat → refactor, vérifié par git log)
- [x] Aucun secret commité (scan git diff)
- [x] `.gitignore` complet (Node, Angular, Wrangler, IDE, OS)
- [x] Headers de sécurité Cloudflare Pages
- [x] Documentation utilisateur + déploiement
- [x] CI GitHub Actions fonctionnel

---

*Released 20 septembre 2026 par AF10 / Hervé Hoareau.*

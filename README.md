# TimeScribe

Webapp Angular 22 + Material qui se connecte à Google Tasks et Google Drive pour estimer automatiquement la charge de travail de chaque tâche via un LLM (Minimax M3) et un corpus documentaire.

- **Stack** : Angular 22, Angular Material 22, TypeScript 5.6, RxJS 7.8, Dexie 4 (IndexedDB), OpenAI SDK 4 (compatible Minimax), date-fns, papaparse
- **PWA** installable sur Android Chrome et iOS Safari (Add to Home Screen)
- **Responsive mobile-first** : breakpoints Material (600 / 768 / 960 / 1100 px)
- **Tests** : Karma + Jasmine + ChromeHeadlessNoSandbox, Playwright pour E2E responsive
- **CI** : GitHub Actions (lint → test → build)
- **Déploiement** : Cloudflare Pages

> Cahier des charges complet : voir [`AGENTS.md`](./AGENTS.md). Décisions architecturales : voir [`docs/decisions.md`](./docs/decisions.md).

## Quick start

```bash
# Prérequis : Node 22+, npm 10+
npm ci
cp .env.example .env
# Renseigner GOOGLE_CLIENT_ID et MINIMAX_API_KEY (voir section "OAuth & clés API" ci-dessous)
npm start   # http://localhost:4200
```

## OAuth & clés API

### Google (côté Google Cloud Console)

1. Créer un projet sur https://console.cloud.google.com/projectselector2/home/dashboard
2. Activer les APIs : **Google Tasks API**, **Google Drive API**, **Google Calendar API**
3. Créer un client OAuth de type **Application Web** (URL de redirection : `http://localhost:4200` en dev, l'URL Cloudflare Pages en prod)
4. Récupérer le `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` (à mettre dans `.env`)
5. Ajouter l'app comme utilisateur test dans l'écran de consentement OAuth

### Minimax M3 (LLM d'estimation)

1. Créer une clé sur https://platform.minimax.io/user-center/basic-information/interface-key
2. Mettre la clé dans `.env` (`MINIMAX_API_KEY`)
3. Restreindre la clé au domaine de déploiement via la console Minimax

## Scripts

| Commande | Effet |
|---|---|
| `npm start` | Démarre le dev server (port 4200) |
| `npm run build` | Build de production |
| `npm test` | Lance Karma + Jasmine (ChromeHeadlessNoSandbox) |
| `npm run test:coverage` | Idem + rapport de couverture |
| `npm run lint` | ESLint |
| `npx playwright test --project=chromium` | Tests E2E responsive |

## Architecture

Voir [`docs/decisions.md`](./docs/decisions.md) pour les ADR-001 à ADR-007.

## Licence

Privé — © Hervé Hoareau / F80dev
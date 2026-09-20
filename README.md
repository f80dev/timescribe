# TimeScribe

Webapp Angular 22 + Material qui se connecte à Google Tasks et Google Drive pour estimer automatiquement la charge de travail de chaque tâche via un LLM (Minimax M3) et un corpus documentaire.

- **Stack** : Angular 22, Angular Material 22, TypeScript 5.6, RxJS 7.8, Dexie 4 (IndexedDB), OpenAI SDK 4 (compatible Minimax), date-fns, papaparse
- **PWA** installable sur Android Chrome et iOS Safari (Add to Home Screen)
- **Responsive mobile-first** : breakpoints Material (600 / 768 / 960 / 1100 px)
- **Tests** : Vitest 4 (via `@angular/build:unit-test`), jsdom, Playwright pour E2E responsive
- **Gestionnaire de paquets** : **Yarn 4** (Berry, via Corepack) — voir section dédiée
- **CI** : GitHub Actions (lint → test → build)
- **Déploiement** : Cloudflare Pages

> Cahier des charges complet : voir [`AGENTS.md`](./AGENTS.md). Décisions architecturales : voir [`docs/decisions.md`](./docs/decisions.md). Guide utilisateur : voir [`docs/user-guide.md`](./docs/user-guide.md).

## Quick start

```bash
# Prérequis : Node >= 22.22.3, Corepack activé
corepack enable
yarn install
cp .env.example .env
# Renseigner GOOGLE_CLIENT_ID et MINIMAX_API_KEY (voir section "OAuth & clés API" ci-dessous)
yarn start   # http://localhost:4200
```

## Gestionnaire de paquets

**Yarn 4 (Berry)** est le gestionnaire officiel du projet (via [Corepack](https://nodejs.org/api/corepack.html)). Le `packageManager` est verrouillé dans `package.json` :

```json
"packageManager": "yarn@4.5.3+..."
```

### Commandes principales

| Yarn | Effet |
|---|---|
| `yarn install` | Installe les dépendances |
| `yarn install --immutable` | CI / vérifie que `yarn.lock` est synchronisé |
| `yarn add <pkg>` | Ajoute une dépendance |
| `yarn add -D <pkg>` | Ajoute une dépendance de dev |
| `yarn remove <pkg>` | Supprime une dépendance |
| `yarn build` | Build de production (`dist/timescribe/browser/`) |
| `yarn start` | Dev server sur `http://localhost:4200` |
| `yarn test` | Lance Vitest (mode watch) |
| `yarn ng test --watch=false --coverage` | Tests + couverture en CI |
| `yarn tsc --noEmit -p tsconfig.app.json` | Lint TypeScript strict |

### Pourquoi Yarn 4 (et pas npm) ?

- **Lockfile v8** plus rapide à parser que `package-lock.json`
- **`nodeLinker: node-modules`** : conserve le même layout que npm (`node_modules/`), donc Angular CLI, esbuild, Vitest marchent sans config spéciale
- **Corepack** : pas besoin d'installer Yarn globalement, Node le gère
- **`yarn install --immutable`** : la CI peut refuser un `yarn.lock` désynchronisé (sécurité)

### Si tu reviens d'un clone frais

```bash
corepack enable          # active Corepack si pas déjà fait
yarn install             # installe tout (lit package.json + yarn.lock)
yarn start               # dev server
```

### Si tu reviens de npm

```bash
rm -rf node_modules package-lock.json
corepack enable
yarn install             # génère un yarn.lock
```

> ⚠️ Le projet **ne supporte plus npm en standard**. `package-lock.json` a été supprimé du repo. Si tu as un ancien `package-lock.json` local, supprime-le avant le premier `yarn install`.

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
| `yarn start` | Démarre le dev server (port 4200) |
| `yarn build` | Build de production |
| `yarn test` | Lance Vitest (mode watch par défaut) |
| `yarn ng test --coverage --watch=false` | Tests + rapport de couverture (mode CI) |
| `yarn tsc --noEmit -p tsconfig.app.json` | Vérif types stricte |
| `npx playwright test --project=chromium` | Tests E2E responsive |

## Architecture

Voir [`docs/decisions.md`](./docs/decisions.md) pour les ADR-001 à ADR-012.

## Licence

Privé — © Hervé Hoareau / F80dev
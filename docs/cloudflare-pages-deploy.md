# TimeScribe — déploiement Cloudflare Pages

Hébergement : **Cloudflare Pages** (cf. ADR-008).

## Prérequis

- Compte Cloudflare (https://dash.cloudflare.com/sign-up)
- Projet déjà pushé sur GitHub : https://github.com/f80dev/timescribe
- Wrangler CLI en local pour tests :
  ```bash
  npm install -g wrangler
  wrangler login
  ```

## Configuration du projet Cloudflare Pages

1. **Dashboard Cloudflare** → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**
2. Sélectionner le repo `f80dev/timescribe`, branche `main`
3. **Build settings** :
   - Framework preset : **None** (Angular n'est pas listé)
   - Build command : `npm install --legacy-peer-deps && npm run build`
   - Build output directory : `dist/timescribe/browser`
   - Root directory : *(vide)*
   - Node version : `22` (Cloudflare prend 22.x par défaut)
4. **Environment variables** (Production + Preview) :
   - Aucune obligatoire pour le moment. Les éventuelles clés (Minimax M3, OAuth client id) seront injectées au moment de l'implémentation de l'étape 11 (déjà faite → placeholder API non testé, voir §5.4 du CDC).
5. **Save and Deploy** → attendre ~3-5 min pour le premier build

## Routing SPA

Le fichier `public/_redirects` contient déjà :
```
/*    /index.html   200
```
Cloudflare Pages applique automatiquement ces règles. Toute URL non résolue (ex : `/dashboard/abc`) tombe sur `index.html` qui gère le routeur Angular.

## Headers de sécurité

Définis dans `wrangler.toml`. Cloudflare Pages applique ces headers automatiquement en production. Headers actifs :
- `X-Frame-Options: DENY` (anti-clickjacking)
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: geolocation=(), microphone=(), camera=()` (TimeScribe n'en a pas besoin)

## PWA / Service worker

- `ngsw-config.json` est activé en build production (cf. `angular.json`)
- `ngsw-worker.js` est servi depuis `/` (Angular l'ajoute automatiquement)
- Cache `no-cache` pour `ngsw-worker.js` et `ngsw.json` (sinon le SW est stale)

## Tester en local avant push

```bash
export PATH=/home/hhoareau/.local/node-v22.22.3-linux-x64/bin:$PATH
npm run build
wrangler pages dev dist/timescribe/browser
# Ouvre http://localhost:8788
```

## Domaines custom

À configurer dans le dashboard Cloudflare Pages → **Custom domains** une fois le déploiement validé.

## Rollback

Dashboard Cloudflare Pages → **Deployments** → choisir un déploiement précédent → **Rollback to this deploy**.

## Limitations connues

- Cloudflare Pages = **build statique**. Pas de SSR ni d'API serverless. Compatible avec TimeScribe (100 % client-side).
- Limite de taille : 25 000 fichiers par déploiement. Pas un problème pour une SPA Angular.
- Builds concurrents : 1 à la fois sur le plan gratuit, suffisant pour un repo solo.

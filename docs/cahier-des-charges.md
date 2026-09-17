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
   - Un **LLM** (MiniMax M3 via API OpenAI-compatible) qui croise les deux sources.
2. **Importer en bloc** des tâches déjà réalisées à partir de :
   - Un export CSV d'e-mails (format défini en §6.5).
   - Une sélection d'événements Google Calendar.
3. Permettre un **ajustement manuel** de la durée estimée sur chaque tâche (override toujours gagnant).
4. Permettre d'**ajouter / changer le répertoire documentaire** utilisé comme contexte d'évaluation à tout moment.

**Métrique de succès v1 :** pour 100 tâches actives, ≥ 70 % obtiennent une estimation LLM sans fallback manuel, l'écart médian entre estimation LLM et ajustement manuel final est ≤ 30 %.

---

## 1. Livrables

| # | Artefact | Statut |
|---|---|---|
| D1 | Application Angular 22 (`timescribe/`) buildée et démarrable en local | `npm start` |
| D2 | Bundle de production déployable statiquement (GitHub Pages compatible) | `npm run build` |
| D3 | Schéma SQL/JSON de persistance locale | `src/app/core/storage/` |
| D4 | Tests unitaires (Karma + Jasmine) | `npm test` |
| D5 | Documentation utilisateur (README.md) | `README.md` |
| D6 | Fichier `docs/decisions.md` mis à jour par l'agent au fil de l'eau | ADR |

---

## 2. Arborescence du repo (imposée)

```
timescribe/
├── AGENTS.md                       # ce fichier
├── README.md
├── docs/
│   ├── decisions.md                # ADR log
│   └── user-guide.md
├── public/
│   ├── favicon.ico
│   ├── manifest.webmanifest                      # PWA manifest
│   ├── icons/
│   │   ├── icon-192.png                          # PWA icon Android
│   │   ├── icon-512.png                          # PWA icon Android splash
│   │   ├── icon-maskable-192.png
│   │   ├── icon-maskable-512.png
│   │   └── apple-touch-icon.png                  # iOS 180x180
│   ├── ngsw-config.json                          # service worker config (Angular)
│   └── robots.txt
├── src/
│   ├── index.html
│   ├── main.ts
│   ├── styles.scss                 # design tokens (cf skill angular-material-design-system)
│   ├── app/
│   │   ├── app.config.ts           # provideRouter, provideHttpClient, provideAnimations
│   │   ├── app.routes.ts           # routes principales
│   │   ├── app.component.ts        # shell (header + <router-outlet>)
│   │   ├── core/
│   │   │   ├── auth/
│   │   │   │   ├── google-auth.service.ts        # OAuth Google explicite
│   │   │   │   ├── gapi-loader.service.ts        # chargement dynamique du SDK
│   │   │   │   └── auth.guard.ts                 # CanActivateFn
│   │   │   ├── pwa/
│   │   │   │   ├── breakpoint.service.ts         # BreakpointObserver (mobile/tablet/desktop)
│   │   │   │   ├── install-prompt.service.ts     # beforeinstallprompt handler
│   │   │   │   └── online-status.service.ts      # navigator.onLine + snackbar
│   │   │   ├── api/
│   │   │   │   ├── google-tasks.service.ts       # CRUD tasks.list / tasks.insert / tasks.patch
│   │   │   │   ├── google-drive.service.ts       # files.list + files.get pour lire le corpus
│   │   │   │   ├── google-calendar.service.ts    # events.list pour import RDV
│   │   │   │   └── gmail-export.service.ts       # parsing CSV d'export Gmail
│   │   │   ├── estimation/
│   │   │   │   ├── llm.service.ts                # appel MiniMax M3 (API OpenAI-compatible)
│   │   │   │   ├── corpus-builder.service.ts     # agrège corpus + historique évalué
│   │   │   │   ├── estimator.service.ts          # orchestre l'estimation + fallback
│   │   │   │   └── prompts/
│   │   │   │       └── estimate-duration.ts      # template de prompt versionné
│   │   │   └── storage/
│   │   │       ├── db.service.ts                 # IndexedDB via Dexie
│   │   │       └── settings.service.ts           # préférences utilisateur
│   │   ├── shared/
│   │   │   ├── components/
│   │   │   │   ├── task-card/                    # carte tâche Material
│   │   │   │   ├── duration-editor/              # input durée HH:MM
│   │   │   │   ├── corpus-picker/                # sélecteur répertoire Drive
│   │   │   │   └── empty-state/
│   │   │   └── pipes/
│   │   │       └── duration.pipe.ts
│   │   ├── features/
│   │   │   ├── login/                            # écran OAuth
│   │   │   ├── dashboard/                        # liste tâches avec estimation (responsive)
│   │   │   ├── task-detail/                      # détail + ajustement manuel (responsive)
│   │   │   ├── import-csv/                       # import Gmail CSV (responsive)
│   │   │   ├── import-calendar/                  # import Calendar (responsive)
│   │   │   └── corpus-settings/                  # config répertoire Drive (responsive)
│   │   ├── shell/
│   │   │   ├── app-shell.component.ts            # toolbar + sidenav + bottom-nav (cf §F9)
│   │   │   ├── app-shell.component.scss
│   │   │   └── bottom-nav/                       # bottom-nav mobile uniquement
│   │   └── theme/
│   │       └── theme.service.ts                  # dark/light toggle
│   └── environments/
│       ├── environment.ts                        # MINIMAX_API_KEY, GOOGLE_CLIENT_ID
│       └── environment.development.ts
├── .env.example
├── angular.json
├── package.json
├── tsconfig.json
└── karma.conf.js
```

---

## 3. Conventions

| Sujet | Règle |
|---|---|
| Commits | Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`). **Un commit par étape du plan §8.** |
| Branches | `main` toujours déployable. Feature branches `feat/<slug>`. Pas de `develop`. |
| Code style | Angular CLI defaults + Prettier (`prettier --write .`). ESLint `@angular-eslint/recommended`. |
| Tests | **L'agent écrit ET exécute les tests lui-même** — c'est le contrat. Workflow **TDD red-green-refactor** appliqué à chaque feature : 1) test rouge qui échoue, 2) code minimal pour passer, 3) refactor, 4) commit. Karma + Jasmine. Couverture minimale **80 % sur `core/`**, **70 % global**. **Aucun commit de feature n'est autorisé si ses tests ne passent pas localement.** |
| TypeScript | Strict mode (`"strict": true`). Aucun `any` non documenté dans ADR. |
| i18n | v1 française uniquement. Strings dans les templates (pas de fichier i18n v1). |
| Accessibilité | WCAG 2.1 AA. `mat-form-field` partout, labels visibles, navigation clavier. |
| Theming | Light + Dark via `data-theme` (cf skill `angular-material-design-system`). Default : **light**. |

### 3.1 Workflow TDD obligatoire par l'agent

Pour **chaque feature** ajoutée au plan §8 (étapes 5 à 17), l'agent suit ce cycle AVANT de committer :

```
1. RED    — Écrire les tests unitaires AVANT le code de production.
             Lancer `npm test -- --watch=false` → confirmer que les tests échouent (exit != 0).
             Commit : `test(<scope>): add failing tests for <feature>`

2. GREEN  — Écrire le code de production minimal qui fait passer les tests.
             Lancer `npm test -- --watch=false` → confirmer exit 0.
             Commit : `feat(<scope>): implement <feature>`

3. REFAC  — Améliorer le code (lisibilité, performance, types) sans casser les tests.
             Lancer `npm test -- --watch=false` ET `ng build --configuration=production` → verts.
             Commit : `refactor(<scope>): <description>`
```

**Interdiction formelle :** un commit de feature sans commit `test:` qui le précède dans l'historique du fichier concerné. Si l'agent doit déroger (ex. test déjà présent), il ajoute une ligne dans `docs/decisions.md` avec justification.

### 3.2 Commandes de test à disposition de l'agent

| Commande | Usage | Exit attendu |
|---|---|---|
| `npm test -- --watch=false --browsers=ChromeHeadless` | Run complet une fois (CI mode) | 0 si tous les tests passent |
| `npm test -- --watch=false --code-coverage` | Run avec couverture | 0 + rapport `coverage/` |
| `ng test <fichier> --watch=false` | Run ciblé sur un fichier | 0 si OK |
| `ng build --configuration=production` | Build prod | 0 |
| `npm run lint` | Lint ESLint | 0 |

**L'agent DOIT** : (a) exécuter ces commandes, (b) lire le code de sortie, (c) si ≠ 0, corriger puis ré-exécuter AVANT de commit. **Aucune exception.** Le plan §9 contient une checklist — l'agent coche chaque case après avoir observé la commande passer en local.

---

## 4. Stack (imposée, versions fixées)

| Composant | Version | Justification |
|---|---|---|
| Angular | 22.x | Demandé |
| Angular Material | 22.x | Demandé |
| TypeScript | 5.6.x | Compatible Angular 22 |
| RxJS | 7.8.x | Standard Angular |
| Dexie | 4.x | Persistance locale IndexedDB |
| Google Identity Services | latest stable | OAuth explicite (cf §5.1) |
| `googleapis` (gapi) | latest stable via `@types/gapi` | API REST Google côté client |
| OpenAI SDK (`openai`) | 4.x | Appelé en mode compatible contre MiniMax API (baseURL surchargé). Permet de garder une interface SDK standard et de switcher de provider par simple changement de baseURL. |
| MiniMax M3 (LLM d'estimation) | API `https://api.minimax.io/v1` | Modèle d'estimation de charge via API OpenAI-compatible (cf §5.4). |
| date-fns | 3.x | Manipulation durées |
| papaparse | 5.x | Parsing CSV Gmail export |
| Karma + Jasmine | latest Angular | Tests unitaires |
| Karma ChromeHeadless (NoSandbox) | latest | Tests headless CI / container |
| Vite (via Angular CLI 22) | intégré | Build |
| `@angular/service-worker` | 22.x | PWA — cache offline, installable, support smartphone |
| `@angular/material` Mobile CDK | 22.x | Bottom sheet, swipe gestures |
| `@playwright/test` | latest | Tests E2E responsive (cf §10.2) — installé en `devDependencies` |

> **Aucune autre dépendance majeure** sans ADR préalable dans `docs/decisions.md`.

### 4bis. Matrice responsive (mobile-first)

L'app est **mobile-first** : la CSS de base cible un viewport ≥ 320 px, puis enrichit par breakpoints `min-width`. Breakpoints alignés Angular Material : **600 / 768 / 960 / 1100 px**.

| Viewport | Classe implicite | Adaptation |
|---|---|---|
| ≤ 599 px (mobile portrait) | smartphone | Navigation bottom-nav (3 onglets max : Tâches / Corpus / Settings). Drawer hamburger pour le reste. Cards empilées 1 colonne. FAB (`mat-fab`) pour action principale. Dialogues en `maxWidth: '95vw'`. |
| 600–767 px (mobile landscape / petite tablette) | phablet | Drawer permanent mini-mode (icônes seules). Cards 2 colonnes possibles pour listes courtes. |
| 768–959 px (tablette) | tablet | Sidenav permanent en mode `side`. Cards 2 colonnes. Toolbar desktop classique. |
| ≥ 960 px (desktop) | desktop | Sidenav permanent `side` ouvert avec labels. Cards 3 colonnes. Toolbar complète. |
| ≥ 1100 px (large desktop) | desktop-lg | Container `max-width: 1280px` centré. |

**Périmètre smartphone (≤ 599 px) — fonctionnalités critiques à valider :**
- Consultation des tâches + badge d'estimation.
- Saisie d'ajustement manuel de durée.
- Déclenchement estimation LLM (bouton pleine largeur, loader plein écran).
- Consultation de la liste corpus (lecture seule, re-sync).
- Settings : clé API, paramètres LLM (formulaires plein largeur).
- Drag-and-drop CSV : remplacé par bouton « Choisir un fichier » (cf §F6).
- Picker Google Drive : ouverture en mode viewer mobile-friendly.

**Hors périmètre mobile v1 :**
- Pas de drag-and-drop multi-fichier pour le corpus (sélection simple).
- Pas de vue calendrier des tâches (liste uniquement).

---

## 5. Authentification & scopes

### 5.1 OAuth explicite Google

- **Bibliothèque :** Google Identity Services (`google.accounts.oauth2.initTokenClient`).
- **Flow :** Authorization Code avec PKCE, **token stocké en mémoire** (variable du service) — **PAS de localStorage pour le token** (cf §11 sécurité).
- **Refresh :** automatique via `gapi.client.setToken({ access_token })`.
- **Logout :** `google.accounts.oauth2.revoke()` + purge IndexedDB des caches non-sensibles.

### 5.2 Scopes requis

```
https://www.googleapis.com/auth/tasks
https://www.googleapis.com/auth/tasks.readonly
https://www.googleapis.com/auth/drive.readonly
https://www.googleapis.com/auth/calendar.readonly
openid email profile
```

> **PAS de scope Gmail** — l'import e-mails passe par un CSV exporté par l'utilisateur (cf §6.5). Aucun accès IMAP/OAuth Gmail en v1.

### 5.3 Clé API MiniMax (MINIMAX_API_KEY)

- **Base URL** : `https://api.minimax.io/v1` (compatible OpenAI).
- **Variable d'environnement** : `MINIMAX_API_KEY` (Bearer token).
- Stockée dans `environment.ts` (dev) et build-time `--define` (prod) **OU** fournie par l'utilisateur via l'écran de settings → stockée dans IndexedDB (chiffrée via WebCrypto AES-GCM, clé dérivée de PBKDF2 sur passphrase local — voir ADR-001 pour la justification).
- **L'utilisateur peut fournir sa propre clé** ; sinon l'app utilise celle buildée (utile pour un déploiement interne).
- **Restrictions minimales** côté plateforme MiniMax : créer une clé dédiée à l'app, monitorer l'usage, pouvoir la révoquer.

### 5.4 Endpoint d'estimation

```
POST https://api.minimax.io/v1/chat/completions
Authorization: Bearer ${MINIMAX_API_KEY}
Content-Type: application/json

{
  "model": "MiniMax-M3",
  "messages": [
    { "role": "system", "content": "<prompt système versionné — cf prompts/estimate-duration.ts>" },
    { "role": "user",   "content": "<payload JSON : corpus + historique + tâche cible>" }
  ],
  "response_format": { "type": "json_object" },
  "thinking": { "type": "adaptive" },
  "max_completion_tokens": 1024,
  "temperature": 0.2
}
```

**Réponse attendue :** objet JSON strict respectant le schéma défini dans `prompts/estimate-duration.ts` (sortie forcée par `response_format: json_object` + instruction système explicite).

**Pitfall documenté** : le reasoning parser de MiniMax M3 peut splitter la sortie structurée si un `response_format: json_schema` est combiné au thinking adaptatif. **On utilise donc `json_object` + schema dans le prompt**, pas `json_schema` (cf ADR-002).

### 5.5 PWA — Progressive Web App (smartphone)

L'app doit être **installable** depuis un navigateur mobile (Chrome Android, Safari iOS via "Add to Home Screen") et fonctionner en mode dégradé sans réseau.

**Configuration :**
- **`@angular/service-worker`** activé via `provideServiceWorker('ngsw-worker.js', { enabled: !isDevMode(), registrationStrategy: 'registerWhenStable:30000' })`.
- **`ngsw-config.json`** généré par `ng add @angular/pwa` :
  - `assetGroups` : prefetch `index.html`, `manifest.webmanifest`, `/assets/**`, icônes.
  - `dataGroups` :
    - `apis-google-com` (`https://www.googleapis.com/*`, `https://apis.google.com/*`, `https://accounts.google.com/*`) → `freshness` (timeout 1h, max 7j), stratégique pour permettre une consultation offline des tâches déjà cachées.
    - `api-minimax` (`https://api.minimax.io/*`) → `performance` (cache court 5 min) — l'estimation LLM exige du réseau.
    - `fonts.googleapis.com` → `freshness` long terme (1 an).
- **Manifest `manifest.webmanifest`** :
  - `name: "TimeScribe"`, `short_name: "TS"`, `start_url: "/"`, `display: "standalone"`, `theme_color` et `background_color` alignés sur les tokens du §4bis.
  - Icônes : 192×192 et 512×512 PNG (maskable pour Android) + 180×180 apple-touch-icon pour iOS.
  - `orientation: "portrait-primary"` (l'app est mobile-first, mais desktop reste supporté).
- **HTTPS obligatoire** pour `serviceWorker` + `manifest` : GitHub Pages fournit HTTPS nativement.
- **Détection offline** : `BreakpointObserver` + `navigator.onLine` → bandeau `mat-snack-bar` non-bloquant « Vous êtes hors ligne. Estimation LLM désactivée. »

**Comportement offline :**
- Consultation des tâches cachées (dataGroups fraîcheur).
- Modification de durée manuelle (IndexedDB local).
- **Désactivées en offline** : estimation LLM, import CSV distant (nécessite Google Tasks API), import Calendar.

**iOS caveats documentés :**
- iOS Safari ne supporte pas `beforeinstallprompt` → bouton « Installer l'app » affiche instructions manuelles.
- Service worker iOS limité à 7 jours si app non ouverte → acceptable pour v1 (rouvrir l'app prolonge).
- Pas de `push notifications` v1.

### 5.6 Authentification mobile

OAuth Google via **popup** sur desktop ET mobile. Sur mobile la popup s'ouvre dans un nouvel onglet navigateur (`target='_blank'` → retour via `BroadcastChannel` ou `localStorage` event). **Fallback `redirect` flow** si la popup est bloquée (rare mais arrive sur mobile anciens).

**Détection device :**
```typescript
const isMobile = inject(BreakpointObserver).isMatched('(max-width: 599.98px)');
// Adapter la stratégie OAuth : popup desktop, redirect mobile (en cas d'échec popup)
```

Le scope OAuth reste identique sur mobile (cf §5.2).

---

## 6. Modèle de données

### 6.1 TypeScript interfaces (implanter **telles quelles**)

```typescript
// src/app/core/models/task.model.ts
export type TaskStatus = 'needsAction' | 'completed';
export type EstimationSource = 'manual' | 'llm' | 'inherited' | 'none';

export interface TaskEstimate {
  taskId: string;
  durationMinutes: number;          // durée totale
  confidence: number;               // 0..1
  source: EstimationSource;
  rationale?: string;               // explication LLM (markdown)
  corpusRefs?: string[];            // IDs fichiers Drive utilisés
  similarTaskIds?: string[];        // tâches historiques similaires
  estimatedAt: Date;
  overriddenAt?: Date;
  overriddenBy?: 'manual';
}

// src/app/core/models/task.model.ts (suite)
export interface GoogleTask {
  id: string;
  title: string;
  notes?: string;
  status: TaskStatus;
  due?: Date;
  completed?: Date;
  parent?: string;
  position: string;
  taskListId: string;
  updated: Date;
  estimate?: TaskEstimate;          // jointure locale
}

// src/app/core/models/corpus.model.ts
export interface CorpusDoc {
  driveFileId: string;
  name: string;
  mimeType: string;
  fetchedAt: Date;
  contentText: string;              // extrait texte brut
  contentHash: string;              // sha256 pour invalidation
  sizeBytes: number;
}

export interface CorpusConfig {
  driveFolderId: string;
  driveFolderName: string;
  enabled: boolean;
  lastSyncAt?: Date;
  totalDocs: number;
  totalChars: number;
}

// src/app/core/models/import.model.ts
export interface CsvEmailRow {
  subject: string;
  sender: string;
  receivedAt: Date;
  threadId?: string;
  bodyPreview?: string;             // optionnel, < 500 chars
  suggestedDurationMin?: number;
}

export interface CalendarEventCandidate {
  eventId: string;
  title: string;
  start: Date;
  end: Date;
  attendees: string[];
  description?: string;
}

// src/app/core/models/settings.model.ts
export interface AppSettings {
  llmProvider: 'minimax';
  llmModel: 'MiniMax-M3';
  llmBaseUrl: string;               // défaut : 'https://api.minimax.io/v1'
  manualFallbackThreshold: number;  // nb minimum de tâches évaluées pour activer LLM (défaut : 5)
  corpusMaxChars: number;           // budget tokens corpus (défaut : 100_000)
  historicalMaxTasks: number;       // nb max de tâches historiques envoyées au LLM (défaut : 50)
  temperature: number;              // défaut : 0.2
  maxCompletionTokens: number;      // défaut : 1024
  theme: 'light' | 'dark' | 'system';
}
```

### 6.2 Persistance locale (Dexie)

```typescript
// src/app/core/storage/db.service.ts
class TimeScribeDB extends Dexie {
  tasks!: Table<GoogleTask, string>;
  estimates!: Table<TaskEstimate, string>;
  corpusDocs!: Table<CorpusDoc, string>;
  corpusConfig!: Table<CorpusConfig & { id: 'singleton' }, string>;
  settings!: Table<AppSettings & { id: 'singleton' }, string>;
  importBatches!: Table<{ id: string; createdAt: Date; type: 'csv'|'calendar'; count: number }, string>;

  constructor() {
    super('TimeScribeDB');
    this.version(1).stores({
      tasks: 'id, taskListId, status, due, updated',
      estimates: 'taskId, source, estimatedAt',
      corpusDocs: 'driveFileId, name, fetchedAt, contentHash',
      corpusConfig: 'id',
      settings: 'id',
      importBatches: 'id, createdAt, type',
    });
  }
}
```

### 6.3 Mapping Google Tasks → local

| Champ Google Tasks API | Champ local |
|---|---|
| `id` | `id` |
| `title` | `title` |
| `notes` | `notes` |
| `status` | `status` |
| `due` (RFC3339) | `due` (Date) |
| `completed` (RFC3339) | `completed` (Date) |
| `parent` | `parent` |
| `position` | `position` |
| — | `taskListId` (séparé) |
| — | `estimate` (jointure locale, jamais envoyé à Google) |

### 6.4 Évaluation stockée séparément

L'évaluation (`TaskEstimate`) est **distincte** de la tâche Google. On évite d'écrire dans `notes` pour ne pas polluer l'API Google. La durée manuelle est appliquée via le champ `estimate.durationMinutes` et le badge "ajusté manuellement" est dérivé de `estimate.overriddenAt`.

### 6.5 Format CSV d'import Gmail

Le CSV est produit par l'utilisateur via **Google Takeout** ou exporté manuellement. Colonnes obligatoires :

```csv
subject,sender,receivedAt,threadId,bodyPreview
"Réunion budget Q3","alice@example.com","2025-09-12T10:00:00Z","thread_abc","Ordre du jour: ..."
```

- `receivedAt` au format ISO 8601 UTC.
- `bodyPreview` optionnel mais recommandé (max 500 chars par cellule).
- Lignes invalides : ignorées avec warning affiché à l'utilisateur.

---

## 7. Spécification fonctionnelle

### F1 — Authentification Google

1. L'utilisateur clique "Se connecter avec Google".
2. Popup OAuth Google Identity Services (desktop) ou nouvel onglet (mobile, fallback redirect si bloqué).
3. Après consentement, le `access_token` est stocké en mémoire uniquement.
4. L'utilisateur est redirigé vers `/dashboard`.
5. Si le token expire (401), déclencher un refresh silencieux ; si échec → retour `/login`.

### F2 — Configuration du corpus documentaire

1. Écran `/corpus-settings` accessible depuis le menu (desktop : sidenav item ; mobile : bottom-nav onglet dédié).
2. Bouton "Choisir un répertoire Drive" → ouvre le picker Google Drive (API Picker).
   - **Mobile :** le picker s'affiche en plein écran via `MatDialog` (largeur `100vw`) avec bouton fermer explicite.
3. L'utilisateur sélectionne un dossier → on enregistre son ID.
4. À la confirmation, le service `CorpusBuilderService` :
   - Liste tous les fichiers non-dossier du dossier (récursivité 1 niveau, max 200 fichiers).
   - Filtre MIME : `text/*`, `application/pdf`, `application/vnd.google-apps.document`.
   - Télécharge / extrait le texte de chaque fichier (PDF via `pdfjs-dist`).
   - Calcule `contentHash` (sha256) ; ne retélécharge pas si hash inchangé.
   - Stocke dans IndexedDB `corpusDocs`.
5. Affichage : nombre de docs, taille totale, date du dernier sync, bouton "Resynchroniser" (pleine largeur sur mobile).

### F3 — Dashboard des tâches

1. Liste toutes les tâches de la liste par défaut (`@default`) + celles ajoutées par import.
2. Chaque tâche affiche : titre, due date, **durée estimée** (badge), **source d'estimation** (icône).
3. **Layout responsive :**
   - **Mobile (≤ 599 px) :** liste verticale 1 colonne, cards pleine largeur avec swipe-gesture (swipe-left → actions "Évaluer / Ajuster"). FAB `mat-fab` en bas-droite pour "Tout réévaluer". Filtre par statut via `mat-select` en haut (bottom-sheet sur mobile).
   - **Tablet (768-959 px) :** grille 2 colonnes.
   - **Desktop (≥ 960 px) :** grille 3 colonnes, sidebar filtres visible.
4. Tri par due date asc, filtre par statut (`needsAction` / `completed` / `all`).
5. Click sur une carte → `/task/:id` (mobile : navigation avant ; desktop : router classique).
6. Bouton "Tout réévaluer" → déclenche estimation batch sur les tâches sans `estimate` ou `estimate.source === 'none'`.

### F4 — Estimation automatique (LLM)

1. Déclenchée :
   - À l'ouverture du dashboard (pour les tâches sans estimation, en file d'attente avec throttle 2 req/s).
   - Sur bouton "Réévaluer cette tâche".
   - Sur bouton "Tout réévaluer".
2. Pipeline :
   - **Étape A — Construction du contexte :**
     - Récupère jusqu'à `historicalMaxTasks` tâches **complétées ET évaluées manuellement** (vérité terrain).
     - Récupère le corpus documentaire actif, tronqué à `corpusMaxChars` (résumé préalable par LLM si > 200 000 chars).
     - Récupère la tâche cible (titre + notes).
   - **Étape B — Prompt :**
     - Voir `prompts/estimate-duration.ts` — versionné, sortie JSON strict.
     - Schéma imposé : `{ durationMinutes: number, confidence: 0..1, rationale: string, similarTaskIds: string[] }`.
     - Le prompt système **répète le schéma en toutes lettres** et exige une réponse `JSON.parse`-able uniquement (pas de markdown, pas de texte autour).
   - **Étape C — Appel MiniMax M3 :** via le SDK `openai` configuré avec `baseURL: settings.llmBaseUrl` et `apiKey: MINIMAX_API_KEY`.
     - `response_format: { type: "json_object" }` (PAS `json_schema` — bug connu du reasoning parser MiniMax, cf ADR-002).
     - `thinking: { type: "adaptive" }` activé (le modèle raisonne mieux avec).
     - Si la confiance retournée est < 0.5 : on **relance une fois** avec un prompt enrichi (`--refine` flag) demandant de reconsidérer en s'appuyant davantage sur l'historique manuel. Pas de second modèle en v1 — un seul (M3) par simplicité.
   - **Étape D — Persistance :** insertion dans `estimates` table, jointure en mémoire pour affichage.
3. **Fallback manuel :**
   - Si `historicalEvaluatedTasks.length < manualFallbackThreshold` (défaut 5), l'estimateur **ne fait pas appel au LLM** et marque la tâche avec `source: 'none'` + un badge "Évaluation manuelle requise".
   - L'utilisateur ouvre la tâche et saisit la durée → `source: 'manual'`.

### F5 — Ajustement manuel de la durée

1. Écran `/task/:id` :
   - Détails de la tâche (lecture seule depuis Google Tasks, sauf titre/notes que l'on peut modifier via `tasks.patch`).
   - Section "Estimation de charge" :
     - Durée actuelle (badge).
     - Source (manuel / LLM / aucune).
     - **Champ éditable** : durée HH:MM (input `mat-form-field` plein largeur sur mobile, sticky en bas).
     - Bouton "Appliquer" → écrit dans `estimates` (overriddenAt = now, source = 'manual').
   - Si estimation LLM : afficher `rationale` (markdown rendu) et liste cliquable des `similarTaskIds`.
   - Bouton "Relancer l'estimation LLM" → écrase l'estimation manuelle après confirmation.
2. **Layout responsive :**
   - **Mobile :** page entière plein écran, header sticky avec bouton retour. Bouton "Appliquer" en bas sticky (thumb zone).
   - **Tablet+ :** 2 colonnes (détails gauche, estimation droite). Toolbar desktop classique.

### F6 — Import de tâches depuis CSV Gmail

1. Écran `/import-csv` :
   - **Mobile :** bouton "Choisir un fichier CSV" plein largeur (`<input type="file" accept=".csv">`) — pas de drag-and-drop.
   - **Desktop :** zone drag-and-drop + sélecteur fichier (`.csv` uniquement).
   - Parsing avec `papaparse` (header row obligatoire).
   - Validation ligne par ligne (voir §6.5).
   - Tableau de prévisualisation avec checkbox par ligne + champ "Durée suggérée" éditable (prérempli via heuristique : longueur du sujet → 15/30/60 min).
     - **Mobile :** tableau en cards empilées (1 ligne par card), checkbox en haut.
     - **Desktop :** tableau `mat-table` classique.
   - Bouton "Créer N tâches dans Google Tasks" :
     - Liste cible : `@default` ou liste choisie.
     - Chaque ligne devient une tâche avec :
       - `title` = `subject`
       - `notes` = "Importé de l'e-mail de <sender> le <receivedAt>\n\n<bodyPreview>"
       - `due` = `receivedAt + 24h` (heuristique simple, modifiable après import)
       - `estimate.source = 'manual'`, `estimate.durationMinutes = durée suggérée`
     - Batch `tasks.insert` avec throttle 1 req/s.
3. Téléchargement d'un modèle CSV vide.

### F7 — Import depuis Google Calendar

1. Écran `/import-calendar` :
   - Sélecteur de plage de dates (défaut : 30 derniers jours) — `mat-date-range-input` adapté mobile.
   - Liste des événements (max 250) avec durée calculée.
   - **Mobile :** liste de cards empilées, durée affichée en badge, sélection via checkbox en haut de chaque card.
   - **Desktop :** `mat-table` avec colonnes (titre, date, durée, sélection).
   - Checkbox par événement.
   - Pour chaque événement sélectionné :
     - `title` = `event.summary`
     - `notes` = `event.description` (tronqué à 4000 chars) + lien calendar.
     - `estimate.durationMinutes` = `event.end - event.start` (en minutes).
     - `estimate.source = 'manual'`.
   - Bouton "Créer les tâches" (FAB sur mobile, sticky bottom button desktop).

### F8 — Gestion des tâches terminées

- Les tâches `status: 'completed'` sont affichées dans le dashboard avec un filtre dédié.
- **Elles sont éligibles à l'estimation LLM** comme source d'historique (vérité terrain si elles ont `source: 'manual'`).
- Pas de réécriture Google Tasks pour ces tâches (lecture seule côté Google).

### F9 — Navigation & layout shell

**Composant racine `AppShell`** avec :

- **Toolbar (`mat-toolbar`)** toujours présente, fixe en haut :
  - À gauche : bouton menu hamburger (mobile uniquement) → ouvre `mat-sidenav`.
  - Au centre : logo + titre "TimeScribe".
  - À droite : bouton thème (light/dark) + avatar utilisateur (si connecté).
- **Sidenav (`mat-sidenav-container` + `mat-sidenav`)** :
  - **Mobile (≤ 599 px) :** `mode="over"`, fermé par défaut, s'ouvre au swipe-from-edge OU clic hamburger. Contenu : lien Dashboard, Corpus, Import CSV, Import Calendar, Settings, Déconnexion.
  - **Tablet+ (≥ 768 px) :** `mode="side"`, permanent, largeur 240 px. Mêmes liens.
- **Bottom-nav (`mat-bottom-sheet` ou `mat-tab-nav-bar`)** **UNIQUEMENT sur mobile (≤ 599 px)** :
  - 3 onglets maximum : **Tâches** / **Corpus** / **Settings**.
  - Icône + label court.
  - Position fixe en bas, hauteur 56 px.
  - Hidden ≥ 600 px via CSS (`@media (min-width: 600px) { .mobile-bottom-nav { display: none; } }`).
- **FAB (`mat-fab`)** sur écrans liste (Dashboard, Import Calendar) **uniquement sur mobile et tablet**, pour l'action principale ("Tout réévaluer", "Créer les tâches"). Hidden sur desktop où le bouton classique dans la toolbar suffit.

**Pitfall Material documenté (cf skill `angular-spa`) :** `<mat-toolbar>` crée un stacking context avec `backdrop-filter`. Un `position: fixed` enfant (FAB) peut être clippé si placé dans le toolbar. **Le FAB est rendu comme sibling du toolbar, pas enfant.**

### F10 — Composants partagés responsive

- **`TaskCardComponent`** :
  - Desktop : card Material standard avec actions visibles.
  - Mobile : card simplifiée, swipe-left (Mobile CDK `SwipeGesture`) → révèle boutons d'action (icône "ajuster durée" + "réévaluer").
  - Tap → ouvre le détail.

- **`DurationEditorComponent`** :
  - Desktop : inline éditable dans la page détail.
  - Mobile : input plein largeur + bouton "Appliquer" en dessous, sticky en bas de page (`position: sticky; bottom: 0`).
  - Format HH:MM natif `input type="number"` minutes (plus rapide à saisir sur mobile qu'un time picker).

- **`CorpusPickerComponent`** :
  - Desktop : bouton inline.
  - Mobile : `MatBottomSheet` plein écran pour la sélection du dossier Drive.

---

## 8. Plan d'exécution (un commit par étape)

> L'agent suit ce plan **linéairement, de haut en bas**. Chaque étape = un commit Conventional Commits. Aucune étape ne doit être sautée.
>
> **Convention TDD** : pour toute étape de feature (5-18), l'agent décompose en 3 sous-commits (test → feat → refac) si elle produit du code `core/` ou `features/` non encore couvert. Les étapes 1-4 et 19-23 sont des chores/docs sans cycle TDD obligatoire.

1. **chore(repo)** — bootstrap projet
   - Create: `AGENTS.md`, `README.md`, `.gitignore`, `.env.example`, `docs/decisions.md`
   - Commit: `chore(repo): bootstrap TimeScribe project structure`

2. **chore(angular)** — scaffold Angular 22 + Material
   - Create: `package.json`, `angular.json`, `tsconfig.json`, `src/main.ts`, `src/index.html`, `src/styles.scss`, `src/app/app.config.ts`, `src/app/app.routes.ts`, `src/app/app.component.ts`
   - Install: `npm install`
   - Verify: `npm start` affiche page blanche Material sans erreur
   - Commit: `chore(angular): scaffold Angular 22 with Material`

3. **chore(test)** — configurer Karma headless + CI mode
   - Modify: `karma.conf.js` → `browsers: ['ChromeHeadlessNoSandbox']`, `singleRun: true` en CI, `restartOnFileChange: false`
   - Add: `ChromeHeadlessNoSandbox` launcher (flag `--no-sandbox` requis en environnements conteneurisés)
   - Modify: `package.json` scripts → `"test": "ng test --watch=false --browsers=ChromeHeadlessNoSandbox"`, `"test:coverage": "ng test --watch=false --browsers=ChromeHeadlessNoSandbox --code-coverage"`
   - Verify: `npm test` exit 0 sur la suite vide
   - Commit: `chore(test): configure Karma headless and CI test script`

4. **feat(theme)** — service thème + tokens *(1 commit, pas de TDD — pure config)*
   - Create: `src/app/theme/theme.service.ts`, `src/app/_shared.scss` (cf skill)
   - Modify: `src/styles.scss` (tokens + mat.theme)
   - Verify: `ng build --configuration=production` exit 0
   - Commit: `feat(theme): add light/dark theme service and design tokens`

4b. **feat(shell,pwa)** — AppShell responsive + PWA *(cycle TDD)*
   - 4b-a — `test(shell): add failing tests for responsive breakpoint detection and install prompt`
     - Create: `src/app/core/pwa/breakpoint.service.spec.ts` (mock `BreakpointObserver`, vérifie signaux `isMobile`/`isTablet`/`isDesktop`), `install-prompt.service.spec.ts` (mock `beforeinstallprompt` event), `online-status.service.spec.ts` (mock `navigator.onLine`)
     - Create: `src/app/shell/app-shell.component.spec.ts` (vérifie rendu conditionnel : bottom-nav si mobile, sidenav permanent si ≥ 768 px)
     - Verify: `npm test` exit ≠ 0
     - Commit: `test(shell): add failing tests for responsive breakpoint detection and install prompt`
   - 4b-b — `feat(shell): implement responsive AppShell with toolbar, sidenav, and mobile bottom-nav`
     - Create: `src/app/core/pwa/breakpoint.service.ts`, `install-prompt.service.ts`, `online-status.service.ts`, `src/app/shell/app-shell.component.ts`, `bottom-nav/`
     - Modify: `src/app/app.routes.ts` (layout principal utilise `AppShell`), `src/app/app.component.ts` (host du shell)
     - Verify: `npm test` exit 0
     - Commit: `feat(shell): implement responsive AppShell with toolbar, sidenav, and mobile bottom-nav`
   - 4b-c — `feat(pwa): configure service worker, manifest, and install prompt`
     - Install: `@angular/service-worker`
     - Create: `public/manifest.webmanifest`, `public/ngsw-config.json`, `public/icons/*` (utiliser `ng add @angular/pwa` puis ajuster selon §5.5)
     - Modify: `src/app/app.config.ts` (`provideServiceWorker`), `src/index.html` (`<link rel="manifest">`, `<meta name="theme-color">`, `<link rel="apple-touch-icon">`)
     - Verify: `npm run build && npx http-server dist/timescribe/browser -p 8080` → `curl http://localhost:8080/ngsw.json` retourne 200, `curl http://localhost:8080/manifest.webmanifest` retourne 200
     - Commit: `feat(pwa): configure service worker, manifest, and install prompt`
   - 4b-d — refactor *(si nécessaire)*
     - Commit: `refactor(shell): extract layout primitives and tighten breakpoint signals`

5. **feat(core,db)** — persistance Dexie *(cycle TDD)*
   - 5a — `test(core): add failing tests for Dexie schema and queries`
     - Create: `src/app/core/storage/db.service.spec.ts` — couvre schéma, index `tasks`, requêtes par `taskListId`/`status`, CRUD `estimates`, `corpusDocs` (hash dédup), `settings` singleton
     - Verify: `npm test` exit ≠ 0 (tests rouges)
     - Commit: `test(core): add failing tests for Dexie schema and queries`
   - 5b — `feat(core): add Dexie persistence and core data models`
     - Create: `src/app/core/storage/db.service.ts`, `src/app/core/models/*.ts`
     - Install: `dexie`
     - Verify: `npm test` exit 0 + `npm run lint` exit 0
     - Commit: `feat(core): add Dexie persistence and core data models`
   - 5c — `refactor(core): extract repository helpers and tighten types`
     - Verify: `npm test -- --code-coverage` → couverture `core/storage/` ≥ 80 %
     - Commit: `refactor(core): extract repository helpers and tighten types`

6. **feat(auth)** — OAuth Google *(cycle TDD)*
   - 6a — `test(auth): add failing tests for Google OAuth login/refresh/logout`
     - Create: `src/app/core/auth/google-auth.service.spec.ts` — couvre login OK, refresh 401 → re-auth, logout → revoke + purge mémoire, **token jamais écrit dans localStorage/sessionStorage** (assertion explicite), guard `CanActivateFn`
     - Verify: `npm test` exit ≠ 0
     - Commit: `test(auth): add failing tests for Google OAuth login/refresh/logout`
   - 6b — `feat(auth): implement Google OAuth with Google Identity Services`
     - Create: `src/app/core/auth/google-auth.service.ts`, `gapi-loader.service.ts`, `auth.guard.ts`, `src/app/features/login/login.component.ts`
     - Modify: `src/app/app.routes.ts` (route `/login` + guard)
     - Verify: `npm test` exit 0
     - Commit: `feat(auth): implement Google OAuth with Google Identity Services`
   - 6c — `refactor(auth): split token storage and improve error handling`
     - Verify: `npm test` exit 0
     - Commit: `refactor(auth): split token storage and improve error handling`

7. **feat(api,tasks)** — Google Tasks CRUD *(cycle TDD)*
   - 7a — `test(api): add failing tests for Google Tasks CRUD client`
     - Create: `src/app/core/api/google-tasks.service.spec.ts` — couvre list/insert/patch/delete avec mock `gapi.client.tasks`, throttle 1 req/s, mapping RFC3339 → Date
     - Verify: `npm test` exit ≠ 0
     - Commit: `test(api): add failing tests for Google Tasks CRUD client`
   - 7b — `feat(api): add Google Tasks API client`
     - Create: `src/app/core/api/google-tasks.service.ts`
     - Verify: `npm test` exit 0
     - Commit: `feat(api): add Google Tasks API client`
   - 7c — refactor *(si nécessaire)*

8. **feat(api,drive)** — Google Drive picker + listing *(cycle TDD)*
   - 8a — `test(api): add failing tests for Google Drive folder listing and file fetch`
     - Create: `src/app/core/api/google-drive.service.spec.ts` — list par folder, filtre MIME, extraction texte PDF (mockée), pagination
     - Verify: `npm test` exit ≠ 0
     - Commit: `test(api): add failing tests for Google Drive folder listing and file fetch`
   - 8b — `feat(api): add Google Drive API client`
     - Create: `src/app/core/api/google-drive.service.ts`
     - Verify: `npm test` exit 0
     - Commit: `feat(api): add Google Drive API client`
   - 8c — refactor *(si nécessaire)*

9. **feat(api,calendar)** — Google Calendar listing *(cycle TDD)*
   - 9a — `test(api): add failing tests for Google Calendar events listing`
     - Create: `src/app/core/api/google-calendar.service.spec.ts` — events.list avec plage, calcul de durée, pagination
     - Verify: `npm test` exit ≠ 0
     - Commit: `test(api): add failing tests for Google Calendar events listing`
   - 9b — `feat(api): add Google Calendar API client`
     - Create: `src/app/core/api/google-calendar.service.ts`
     - Verify: `npm test` exit 0
     - Commit: `feat(api): add Google Calendar API client`
   - 9c — refactor *(si nécessaire)*

10. **feat(corpus)** — corpus documentaire *(cycle TDD)*
    - 10a — `test(corpus): add failing tests for corpus builder and picker UI`
      - Create: `src/app/core/estimation/corpus-builder.service.spec.ts` (déduplication par hash, troncature à `corpusMaxChars`, filtre MIME), `src/app/features/corpus-settings/corpus-settings.component.spec.ts` (intéraction picker mocké)
      - Verify: `npm test` exit ≠ 0
      - Commit: `test(corpus): add failing tests for corpus builder and picker UI`
    - 10b — `feat(corpus): add corpus builder and Drive folder picker UI`
      - Create: `src/app/core/estimation/corpus-builder.service.ts`, `src/app/features/corpus-settings/corpus-settings.component.ts`, `src/app/shared/components/corpus-picker/`
      - Install: `pdfjs-dist`
      - Verify: `npm test` exit 0
      - Commit: `feat(corpus): add corpus builder and Drive folder picker UI`
    - 10c — refactor *(si nécessaire)*

11. **feat(estimation,llm)** — service LLM MiniMax M3 *(cycle TDD — **le plus important**)*
    - 11a — `test(estimation): add failing tests for MiniMax M3 LLM client and orchestrator`
      - Create: `src/app/core/estimation/llm.service.spec.ts` — mock SDK `openai`, vérifie payload exact (`model`, `response_format: json_object`, `thinking: adaptive`, `temperature`, `max_completion_tokens`), gestion erreur 401/429/5xx, parsing JSON strict de la réponse, **test négatif** vérifiant qu'on n'envoie JAMAIS `response_format: json_schema`
      - Verify: `npm test` exit ≠ 0
      - Commit: `test(estimation): add failing tests for MiniMax M3 LLM client`
    - 11b — `feat(estimation): add MiniMax M3 LLM service with versioned prompt`
      - Create: `src/app/core/estimation/llm.service.ts`, `prompts/estimate-duration.ts`
      - Install: `openai`
      - Verify: `npm test` exit 0
      - Commit: `feat(estimation): add MiniMax M3 LLM service with versioned prompt`
    - 11c — `refactor(estimation): extract prompt builder and tighten types`
      - Verify: `npm test -- --code-coverage` → couverture `core/estimation/` ≥ 80 %
      - Commit: `refactor(estimation): extract prompt builder and tighten types`

12. **feat(estimation,orchestrator)** — orchestrateur + fallback *(cycle TDD)*
    - 12a — `test(estimation): add failing tests for orchestrator and manual fallback`
      - Create: `src/app/core/estimation/estimator.service.spec.ts` — cas < seuil (5 tâches évaluées → fallback manuel, pas d'appel LLM), cas ≥ seuil (appel LLM mocké), override manuel toujours prioritaire sur LLM, relance si confiance < 0.5, persistence dans `estimates`
      - Verify: `npm test` exit ≠ 0
      - Commit: `test(estimation): add failing tests for orchestrator and manual fallback`
    - 12b — `feat(estimation): add orchestrator with manual fallback threshold`
      - Create: `src/app/core/estimation/estimator.service.ts`
      - Verify: `npm test` exit 0
      - Commit: `feat(estimation): add orchestrator with manual fallback threshold`
    - 12c — refactor *(si nécessaire)*

13. **feat(dashboard)** — écran principal *(cycle TDD)*
    - 13a — `test(dashboard): add failing tests for task list and estimation badges`
      - Create: `src/app/features/dashboard/dashboard.component.spec.ts`, `src/app/shared/components/task-card/task-card.component.spec.ts`, `src/app/shared/pipes/duration.pipe.spec.ts`
      - Verify: `npm test` exit ≠ 0
      - Commit: `test(dashboard): add failing tests for task list and estimation badges`
    - 13b — `feat(dashboard): add task list with estimation badges`
      - Create: `src/app/features/dashboard/dashboard.component.ts`, `src/app/shared/components/task-card/`, `src/app/shared/pipes/duration.pipe.ts`
      - Verify: `npm test` exit 0
      - Commit: `feat(dashboard): add task list with estimation badges`
    - 13c — refactor *(si nécessaire)*

14. **feat(task-detail)** — détail + ajustement manuel *(cycle TDD)*
    - 14a — `test(task-detail): add failing tests for detail screen and manual override`
      - Create: `src/app/features/task-detail/task-detail.component.spec.ts`, `src/app/shared/components/duration-editor/duration-editor.component.spec.ts`
      - Verify: `npm test` exit ≠ 0
      - Commit: `test(task-detail): add failing tests for detail screen and manual override`
    - 14b — `feat(task-detail): add detail screen with manual duration override`
      - Create: `src/app/features/task-detail/task-detail.component.ts`, `src/app/shared/components/duration-editor/`
      - Verify: `npm test` exit 0
      - Commit: `feat(task-detail): add detail screen with manual duration override`
    - 14c — refactor *(si nécessaire)*

15. **feat(import,csv)** — import CSV *(cycle TDD)*
    - 15a — `test(import): add failing tests for CSV Gmail import flow`
      - Create: `src/app/features/import-csv/import-csv.component.spec.ts` — parsing, validation ligne par ligne, lignes invalides ignorées avec warning, durée suggérée par heuristique, création batch avec throttle
      - Verify: `npm test` exit ≠ 0
      - Commit: `test(import): add failing tests for CSV Gmail import flow`
    - 15b — `feat(import): add CSV Gmail import flow`
      - Create: `src/app/features/import-csv/import-csv.component.ts`
      - Install: `papaparse` + `@types/papaparse`
      - Verify: `npm test` exit 0
      - Commit: `feat(import): add CSV Gmail import flow`
    - 15c — refactor *(si nécessaire)*

16. **feat(import,calendar)** — import Calendar *(cycle TDD)*
    - 16a — `test(import): add failing tests for Calendar events import flow`
      - Create: `src/app/features/import-calendar/import-calendar.component.spec.ts` — sélection plage, durée calculée, création batch
      - Verify: `npm test` exit ≠ 0
      - Commit: `test(import): add failing tests for Calendar events import flow`
    - 16b — `feat(import): add Calendar events import flow`
      - Create: `src/app/features/import-calendar/import-calendar.component.ts`
      - Verify: `npm test` exit 0
      - Commit: `feat(import): add Calendar events import flow`
    - 16c — refactor *(si nécessaire)*

17. **feat(settings)** — écran paramètres *(cycle TDD)*
    - 17a — `test(settings): add failing tests for settings screen`
      - Create: `src/app/features/settings/settings.component.spec.ts` — chiffrage clé API (AES-GCM + PBKDF2), chargement/écriture settings singleton
      - Verify: `npm test` exit ≠ 0
      - Commit: `test(settings): add failing tests for settings screen`
    - 17b — `feat(settings): add settings screen with LLM and corpus config`
      - Create: `src/app/features/settings/settings.component.ts`
      - Verify: `npm test` exit 0
      - Commit: `feat(settings): add settings screen with LLM and corpus config`
    - 17c — refactor *(si nécessaire)*

18. **chore(coverage)** — vérif couverture globale
    - Run: `npm run test:coverage`
    - Vérifie : `core/` ≥ 80 %, global ≥ 70 %
    - Si sous les seuils : ajouter tests manquants + commit `test:` ciblé jusqu'à atteindre
    - Verify: `npm run lint && ng build --configuration=production && npm run test:coverage` tous exit 0
    - Commit: `chore(coverage): verify coverage thresholds met across the app`

19. **chore(docs)** — guide utilisateur
    - Create: `docs/user-guide.md` (screenshots ASCII des écrans)
    - Modify: `README.md` (quickstart, OAuth setup, scopes, env vars)
    - Commit: `chore(docs): add user guide and setup README`

20. **chore(ci)** — GitHub Actions lint+test+build
    - Create: `.github/workflows/ci.yml`
    - Step CI obligatoire : `npm ci && npm run lint && npm test -- --watch=false --browsers=ChromeHeadlessNoSandbox && ng build --configuration=production`
    - Commit: `chore(ci): add lint+test+build workflow`

21. **chore(deploy)** — config GitHub Pages SPA
    - Modify: `angular.json` (baseHref `/timescribe/`)
    - Create: `.github/workflows/pages.yml` (copie `index.html` → `404.html`, étape `npm test` obligatoire avant deploy)
    - Commit: `chore(deploy): configure GitHub Pages SPA deployment`

22. **chore(repo)** — revue finale
    - Run: `npm run lint && npm test -- --watch=false --browsers=ChromeHeadlessNoSandbox && ng build --configuration=production`
    - Verify: tous les `[ ]` acceptance criteria (§9) sont cochés, **avec capture de l'output terminal comme preuve**
    - Commit: `chore(repo): final review and acceptance checklist`

---

## 8bis. Preuves d'exécution attendues

Pour **chaque case cochée de §9**, l'agent doit pouvoir produire **la trace terminale** correspondante. Format attendu dans le message final de l'agent :

```
[AC-1] ✅ `npm install` exit 0
  $ npm install
  ... (output tronqué) ...
  added 1342 packages in 42s
  exit 0

[AC-2] ✅ `npm run lint` exit 0
  $ npm run lint
  ... (output tronqué) ...
  exit 0
```

**L'agent qui livre sans ces preuves n'a pas livré.**

---

## 9. Critères d'acceptation (checklist agent)

L'agent **NE DOIT PAS** déclarer le travail terminé tant que tous ces items ne sont pas vérifiés **mécaniquement par exécution des commandes** (cf §8bis — preuves d'exécution attendues) :

**Setup & build**
- [ ] `npm install` exit 0
- [ ] `npm run lint` exit 0
- [ ] `ng build --configuration=production` exit 0
- [ ] `npm test -- --watch=false --browsers=ChromeHeadlessNoSandbox` exit 0

**Couverture**
- [ ] `npm run test:coverage` → couverture `core/` ≥ **80 %**
- [ ] `npm run test:coverage` → couverture globale ≥ **70 %**

**TDD discipline (vérifié via `git log --oneline`)**
- [ ] Chaque fichier `.ts` de `core/` ou `features/` est précédé dans `git log` par un commit `test:` qui lui correspond
- [ ] Aucun commit `feat:` ne contient de code de production sans commit `test:` antérieur (sauf justification dans `docs/decisions.md`)
- [ ] Le test du `LlmService` vérifie **explicitement** que `response_format: json_object` est envoyé (et jamais `json_schema`)

**Fonctionnel**
- [ ] OAuth Google fonctionne end-to-end avec les 5 scopes de §5.2
- [ ] Le picker Google Drive s'ouvre et permet de sélectionner un dossier
- [ ] Au moins 3 fichiers PDF/doc du dossier corpus sont ingérés et stockés dans IndexedDB
- [ ] Avec ≥ 5 tâches évaluées manuellement, l'estimation LLM MiniMax M3 produit une durée non-nulle pour une nouvelle tâche
- [ ] Avec < 5 tâches évaluées manuellement, la nouvelle tâche reçoit `source: 'none'` et un badge "Évaluation manuelle requise"
- [ ] Le payload envoyé à MiniMax respecte le format §5.4 et la réponse est `JSON.parse`-able sans erreur
- [ ] L'ajustement manuel de durée persiste après reload (IndexedDB)
- [ ] L'import CSV crée N tâches via `tasks.insert` avec throttle respecté (pas de 429)
- [ ] L'import Calendar crée des tâches avec `estimate.source = 'manual'` et durée = durée de l'événement
- [ ] Les tâches terminées sont affichées dans le dashboard et utilisées comme historique
- [ ] Toggle dark/light fonctionne et persiste

**Livrables**
- [ ] Toutes les dépendances sont déclarées dans `package.json` (pas de globales)
- [ ] `docs/decisions.md` contient au minimum ADR-001 (chiffrement clé API) et toute décision prise pendant l'implémentation
- [ ] README.md documente : prérequis OAuth (comment créer client Google + clé MiniMax), installation, démarrage, déploiement
- [ ] **L'agent a produit les preuves d'exécution du §8bis** (traces terminal par critère coché)

**Responsive & PWA (mobile + desktop)**
- [ ] `npm run build` produit un bundle contenant `ngsw-worker.js`, `ngsw.json`, `manifest.webmanifest` dans `dist/timescribe/browser/`
- [ ] `npx http-server dist/timescribe/browser -p 8080` puis `curl http://localhost:8080/ngsw.json` retourne 200
- [ ] `npx playwright test e2e/responsive/` passe aux 3 viewports (375 / 768 / 1280) avec screenshots de régression verts
- [ ] Sur viewport 375×667 : bottom-nav présent (3 onglets), FAB "Tout réévaluer" visible, pas de sidenav permanent, cards en 1 colonne
- [ ] Sur viewport 1280×800 : sidenav permanent visible avec labels, bottom-nav absent, cards en 3 colonnes
- [ ] Sur viewport 768×1024 : sidenav permanent mini-mode visible
- [ ] Drag-and-drop CSV absent sur mobile (remplacé par bouton fichier `<input type="file">`)
- [ ] Bouton "Installer l'app" présent sur mobile quand `beforeinstallprompt` est disponible
- [ ] Manifest valide (test via `npx pwabuilder-cli validate` ou Lighthouse PWA audit ≥ 90)
- [ ] Bandeau offline s'affiche quand `navigator.onLine === false`
- [ ] L'app reste utilisable (lecture tâches, ajustement manuel) en mode offline après premier chargement en ligne

---

## 10. Tests

> **L'agent écrit ET exécute les tests** (cf §3.1 et §3.2). Chaque fichier listé ici est **obligatoire** et doit exister dans le repo final avec **statut vert** au moment du commit.

| Fichier | Couverture |
|---|---|
| `core/storage/db.service.spec.ts` | Schéma Dexie, index `tasks` (`taskListId`, `status`, `due`, `updated`), CRUD `estimates`, `corpusDocs` (déduplication par hash), `settings` singleton, `importBatches` |
| `core/auth/google-auth.service.spec.ts` | Login OK (mock GIS), refresh 401 → re-auth silencieuse, logout → `google.accounts.oauth2.revoke` + purge mémoire, **assertion explicite : `localStorage`/`sessionStorage` jamais écrits**, guard `CanActivateFn` redirige vers `/login` |
| `core/api/google-tasks.service.spec.ts` | `list`/`insert`/`patch`/`delete` avec mock `gapi.client.tasks`, throttle 1 req/s (utiliser `fakeAsync` + `tick`), mapping RFC3339 → `Date` |
| `core/api/google-drive.service.spec.ts` | `files.list` par folder avec pagination, filtre MIME (`text/*`, `pdf`, `google-apps.document`), `files.get` retourne texte (PDF mocké via `pdfjs-dist`), calcul `contentHash` sha256 |
| `core/api/google-calendar.service.spec.ts` | `events.list` avec plage de dates, calcul de durée en minutes, exclusion événements sans durée |
| `core/estimation/corpus-builder.service.spec.ts` | Déduplication par hash, troncature à `corpusMaxChars` avec résumé préalable si > 200k chars, filtre MIME, récursion 1 niveau max |
| `core/estimation/llm.service.spec.ts` | Mock SDK `openai` (`vi`-style spy), vérifie payload exact (`model: 'MiniMax-M3'`, `response_format: { type: 'json_object' }`, `thinking: { type: 'adaptive' }`, `temperature`, `max_completion_tokens`), gestion erreur 401/429/5xx avec retry exponentiel, parsing JSON strict de la réponse, **test négatif : assertion qu'on n'envoie JAMAIS `response_format: json_schema`** |
| `core/estimation/estimator.service.spec.ts` | Cas < seuil (5 tâches évaluées → fallback `source: 'none'`, **aucun appel LLM**), cas ≥ seuil (appel LLM mocké → retourne `source: 'llm'`), override manuel **toujours** prioritaire (même après estimation LLM), relance si confiance < 0.5 avec `--refine` flag, persistence dans table `estimates` |
| `features/login/login.component.spec.ts` | Click "Se connecter" → appelle `GoogleAuthService.login()`, état `loading`, erreur affichée si refus |
| `features/dashboard/dashboard.component.spec.ts` | Charge tâches depuis `GoogleTasksService`, affiche `TaskCardComponent` pour chacune, filtre par statut, bouton "Tout réévaluer" déclenche batch |
| `features/task-detail/task-detail.component.spec.ts` | Charge tâche par `:id` route param, affiche estimation + rationale si LLM, sauvegarde override manuel met à jour `estimates` |
| `features/corpus-settings/corpus-settings.component.spec.ts` | Click picker → mock Google Picker → enregistre `corpusConfig`, bouton resync appelle `CorpusBuilderService.sync()` |
| `features/import-csv/import-csv.component.spec.ts` | Drag-drop fichier, parsing papaparse, validation ligne par ligne (lignes invalides ignorées + warning), prévisualisation, durée suggérée par heuristique (longueur sujet → 15/30/60 min), création batch via `tasks.insert` |
| `features/import-calendar/import-calendar.component.spec.ts` | Sélection plage dates, listing événements, durée = `end - start`, création batch |
| `features/settings/settings.component.spec.ts` | Chiffrage clé API (AES-GCM + PBKDF2 sur passphrase), lecture/écriture `settings` singleton, modification `manualFallbackThreshold` et `llmBaseUrl` |
| `shared/components/task-card/task-card.component.spec.ts` | Affiche titre + durée + badge source (manuel/LLM/aucune), event emitter au click |
| `shared/components/duration-editor/duration-editor.component.spec.ts` | Input HH:MM, validation (vide → erreur), event `durationChange` à chaque modification |
| `shared/components/corpus-picker/corpus-picker.component.spec.ts` | Émet `folderSelected` avec `{ id, name }` |
| `shared/pipes/duration.pipe.spec.ts` | `125` → `"2h 05m"`, `30` → `"30 min"`, `0` → `"—"`, `null`/`undefined` → `"—"` |
| `theme/theme.service.spec.ts` | Toggle `light ↔ dark`, persistance `localStorage`, détection `prefers-color-scheme` au premier load |
| `core/pwa/breakpoint.service.spec.ts` | `BreakpointObserver` mocké → signaux `isMobile`/`isTablet`/`isDesktop` corrects selon viewport, comportement réactif sur resize |
| `core/pwa/install-prompt.service.spec.ts` | Mock `beforeinstallprompt` event → `canInstall()` true, `prompt()` déclenche l'install, listener cleanup en `ngOnDestroy` |
| `core/pwa/online-status.service.spec.ts` | Mock `navigator.onLine` + events `online`/`offline` → signal `isOnline` réactif, cleanup listeners |
| `shell/app-shell.component.spec.ts` | Vue mobile (375×667) : bottom-nav visible, hamburger sidenav caché, FAB rendu. Vue desktop (1280×800) : bottom-nav caché, sidenav permanent visible. Vue tablet (768×1024) : sidenav permanent mini-mode |

### 10.1 Stratégies de mock

| Service externe | Mock | Justification |
|---|---|---|
| Google Identity Services (`google.accounts.oauth2`) | Stub global `window.google.accounts.oauth2.initTokenClient` | Pas d'accès réseau en CI |
| `gapi.client.tasks/drive/calendar` | `jasmine.createSpyObj` retournant `Promise.resolve()` | Pas d'appel réel |
| SDK `openai` (MiniMax M3) | `jasmine.createSpyObj('OpenAI', ['chat'])`, mock du `client.chat.completions.create` | Cf ADR-002 |
| `pdfjs-dist` | Mock du `getDocument().promise` retournant un faux PDFDocument | Évite les fixtures PDF en repo |
| IndexedDB (Dexie) | `fake-indexeddb` (`npm i -D fake-indexeddb`) | Karma tourne sans Chrome réel |
| WebCrypto | API native navigateur → utiliser `karma-chrome-launcher` headless, **PAS** de mock | Nécessaire pour tests AES-GCM/PBKDF2 réels |
| `BreakpointObserver` (Angular CDK) | `jasmine.createSpyObj` retournant `Observable<BreakpointState>` | Cf §10 spec `breakpoint.service.spec.ts` |
| `beforeinstallprompt` event | Stub sur `window` | Cf §10 spec `install-prompt.service.spec.ts` |
| `navigator.onLine` + events `online`/`offline` | Stub + `Event` dispatch | Cf §10 spec `online-status.service.spec.ts` |

### 10.2 Tests E2E responsive (Playwright)

En complément des tests unitaires, **tests visuels Playwright** obligatoires par breakpoint. L'agent installe `@playwright/test` en `devDependencies` et crée `e2e/responsive.spec.ts` :

| Fichier E2E | Couverture |
|---|---|
| `e2e/responsive/dashboard.spec.ts` | Viewports 375×667 (iPhone SE), 768×1024 (iPad), 1280×800 (desktop) : assert présence/absence bottom-nav, FAB, sidenav ; assert que la grille de tâches a le bon nombre de colonnes ; capture screenshot pour revue visuelle |
| `e2e/responsive/task-detail.spec.ts` | Mobile : bouton "Appliquer" sticky en bas, input pleine largeur. Desktop : 2 colonnes visibles |
| `e2e/responsive/import-csv.spec.ts` | Mobile : pas de zone drag-and-drop, bouton "Choisir fichier" pleine largeur visible. Desktop : zone drag-and-drop visible |
| `e2e/responsive/pwa.spec.ts` | `manifest.webmanifest` retourne 200, `ngsw.json` retourne 200, icônes maskable présentes, `theme-color` meta présent dans `<head>` |

**Commande :** `npx playwright test --project=chromium` (install browsers au préalable via `npx playwright install chromium`). Les screenshots de régression sont commit dans `e2e/screenshots/` et **un test échoue si la régression visuelle est détectée** (`toHaveScreenshot()`).

**Vérification obligatoire :** L'agent lance `npx playwright test` après l'étape 18 du plan §8 et inclut la sortie dans les preuves d'exécution §8bis.

---

## 11. Sécurité & conformité

- **Pas de token OAuth dans `localStorage` ni `sessionStorage`** — uniquement en mémoire (variable du `GoogleAuthService`). Re-login à chaque refresh de page acceptable en v1.
- **Clé API MiniMax** chiffrée AES-GCM via WebCrypto si stockée localement (cf §5.3). Clé dérivée PBKDF2 sur passphrase saisi à chaque session OU clé éphémère de session.
- **Aucun secret dans `git`** — `.env.example` uniquement, vraies valeurs via variables d'environnement ou écran de settings chiffré.
- **CSP** : `Content-Security-Policy` strict dans `index.html` (`default-src 'self'; script-src 'self' https://accounts.google.com https://apis.google.com`).
- **Rate limiting** : throttle explicite côté client pour les appels `tasks.insert` et `api.minimax.io/v1/chat/completions`.
- **CORS / API key restrictions** : clé MiniMax restreinte au referer HTTP du domaine de déploiement côté plateforme MiniMax.
- **Aucun appel à un service tiers non listé dans §4** sans ADR.

---

## 12. CI/CD

- `.github/workflows/ci.yml` : `lint → test → build` sur PR et sur `main`.
- `.github/workflows/pages.yml` : déploiement GitHub Pages sur tag `v*` et sur `main` après CI vert.
- Vérification obligatoire : la CI doit être **verte** avant chaque merge.

---

## 13. Do NOT list (garde-fous)

L'agent **NE DOIT PAS** :

- ❌ Stocker le token OAuth dans `localStorage` ou `sessionStorage`.
- ❌ Écrire des évaluations dans le champ `notes` de Google Tasks (pollution de l'API Google).
- ❌ Utiliser un scope Gmail (`gmail.readonly` etc.) — l'import passe par CSV uniquement en v1.
- ❌ Ajouter des dépendances majeures non listées en §4 sans ADR préalable dans `docs/decisions.md`.
- ❌ Utiliser `any` TypeScript sans justification écrite dans une ADR.
- ❌ Commiter une feature sans avoir d'abord commité les tests qui la couvrent (cf §3.1 TDD).
- ❌ Déclarer une étape du plan §9 "cochée" sans preuve d'exécution terminale (cf §8bis).
- ❌ Marquer un test comme "skip" ou "xit" pour le faire passer — corriger le code ou le test.
- ❌ Utiliser des breakpoints custom non alignés sur Angular Material (600/768/960/1100) — incohérence visuelle.
- ❌ Cacher du contenu critique sur mobile (ex. estimation LLM, ajustement manuel) — toute fonctionnalité desktop doit exister sur mobile.
- ❌ Utiliser `position: fixed` à l'intérieur d'un `<mat-toolbar>` — stacking context du toolbar le clipe.
- ❌ Déployer l'app sans HTTPS — service worker + manifest refusés par les navigateurs mobiles.
- ❌ Désactiver le responsive sur les écrans d'import (CSV / Calendar) — ils doivent fonctionner au pouce.
- ❌ Appeler un service LLM avec un corpus > `corpusMaxChars` sans résumé préalable.
- ❌ Utiliser `response_format: { type: "json_schema" }` avec MiniMax M3 (bug reasoning parser) — utiliser `json_object` + schéma dans le prompt.
- ❌ Faire des appels `tasks.insert` en burst > 1 req/s (risque 429).
- ❌ Modifier le contenu visible (titres de tâches existants) sans action utilisateur explicite.
- ❌ Implémenter un serveur backend custom — la v1 est **front-only**.
- ❌ Ajouter Google Analytics, Sentry, Hotjar ou tout SaaS de télémétrie.

---

## 14. Questions ouvertes & ADR

Si l'agent rencontre une décision non couverte par cette spec, il **décide et log dans `docs/decisions.md`** au format :

```markdown
## YYYY-MM-DD — <titre court>
**Contexte :** <pourquoi la question s'est posée>
**Décision :** <ce qui a été choisi>
**Conséquences :** <trade-offs>
```

ADR minimum à créer par l'agent :

- **ADR-001** — Chiffrement clé API MiniMax en local : AES-GCM WebCrypto + passphrase session.
- **ADR-002** — Choix de `response_format: json_object` (et non `json_schema`) à cause du bug connu du reasoning parser MiniMax M3 qui splitterait la sortie structurée si combiné au thinking adaptatif. Le schéma est porté par le prompt, pas par le paramètre API.
- **ADR-003** — Liste Tasks cible pour import : `@default` par défaut, sélectionnable.
- **ADR-004** — Seuil minimum de tâches évaluées pour activer le LLM : **5** (paramétrable en settings).
- **ADR-005** — Provider LLM unique en v1 (MiniMax M3) ; le champ `llmProvider` de `AppSettings` est figé à `'minimax'` pour réserver la possibilité d'ajouter d'autres providers (OpenAI natif, Anthropic via baseURL compatible) sans casser le modèle de données.
- **ADR-006** — **Stratégie responsive mobile-first** : breakpoints Material standard (600/768/960/1100), sidenav `mode="over"` sur mobile et `mode="side"` sur tablet+, bottom-nav mobile 3 onglets max, FAB uniquement sur mobile/tablet. Justification : UX thumb-friendly sur smartphone, gain de place écran sur desktop via sidenav permanent.
- **ADR-007** — **PWA installable mais pas native** : `@angular/service-worker` + `manifest.webmanifest` pour installation mobile (Android Chrome, iOS Safari Add to Home Screen). Pas de wrapper Capacitor/Ionic v1 — l'app reste une SPA web. Justification : pas de coût App Store, mise à jour instantanée, mais accès device complet (caméra, géoloc) impossible — acceptable pour v1 qui ne les utilise pas.

---

## 15. Quick start

```bash
# 1. Cloner
git clone <repo> timescribe && cd timescribe

# 2. Installer
npm install

# 3. Configurer
cp .env.example .env
# Renseigner :
#   GOOGLE_CLIENT_ID       (OAuth Google, cf README §OAuth setup)
#   MINIMAX_API_KEY        (Bearer token MiniMax API — https://platform.minimax.io/user-center/basic-information/interface-key)

# 4. Démarrer
npm start   # http://localhost:4200

# 5. Build prod
ng build --configuration=production
```

---

## 16. Rappel à l'agent

- **Lis ce fichier en entier** avant d'écrire la première ligne.
- **Suis le plan §8 linéairement**, en respectant le cycle TDD **RED → GREEN → REFAC** pour toute feature (étapes 5-17).
- **Exécute les commandes** (`npm test`, `npm run lint`, `ng build`, `npm run test:coverage`) après chaque cycle — **lis le code de sortie** et corrige avant de commit.
- **Si tu hésites**, applique le défaut indiqué ici et écris une ADR — ne t'arrête pas pour demander.
- **Si tu casses un critère de §9**, ajoute un commit `fix:` puis re-vérifie la checklist.
- **Le livrable est l'app qui tourne ET ses tests verts**, pas une description de l'app.
- **Chaque case cochée de §9 doit avoir sa preuve d'exécution** au format §8bis. Sans preuve, pas de case cochée.

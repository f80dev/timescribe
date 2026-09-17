# Decisions — TimeScribe

ADR (Architecture Decision Records) du projet TimeScribe. Chaque décision suit le format :
**Contexte / Décision / Conséquences**.

---

## ADR-001 — Chiffrement de la clé API Minimax en local

**Contexte :** La clé `MINIMAX_API_KEY` est sensible et doit pouvoir être stockée localement pour que l'utilisateur n'ait pas à la ressaisir à chaque session. Le stockage brut dans IndexedDB la rendrait lisible par n'importe quel script tiers chargé dans la page.

**Décision :** Chiffrement AES-GCM (WebCrypto) avec clé dérivée via PBKDF2 (100 000 itérations, SHA-256, sel aléatoire de 16 octets) sur une passphrase saisie par l'utilisateur à chaque session. IV unique de 12 octets par chiffrement.

**Conséquences :**
- ✅ La clé n'est jamais en clair dans IndexedDB.
- ✅ Même si l'utilisateur perd son appareil, sans la passphrase la clé est indéchiffrable.
- ⚠️ UX : l'utilisateur doit saisir la passphrase au démarrage. Acceptable car saisie ponctuelle + session longue.
- ⚠️ Si l'utilisateur oublie sa passphrase, il doit régénérer une clé Minimax. C'est explicité dans l'écran de settings.

---

## ADR-002 — `response_format: json_object` (et non `json_schema`)

**Contexte :** Le cahier des charges impose un schéma JSON strict pour la sortie du LLM Minimax M3 (`{ durationMinutes, confidence, rationale, similarTaskIds }`). Deux options d'API : `response_format: { type: "json_object" }` (contrainte faible) ou `response_format: { type: "json_schema", schema: {...} }` (contrainte forte).

**Décision :** Utiliser `json_object`. Le schéma est porté par le prompt (répété en toutes lettres dans le system prompt avec instruction explicite : « réponse `JSON.parse`-able uniquement, pas de markdown, pas de texte autour »).

**Conséquences :**
- ✅ Évite le bug connu du reasoning parser de Minimax M3 qui splitterait la sortie structurée si `json_schema` est combiné au `thinking: adaptive`.
- ⚠️ Le contrat de sortie n'est pas garanti par l'API mais par le prompt. Le service LLM valide le schéma via Zod (ou équivalent) et rejette les réponses mal formées avec retry.

---

## ADR-003 — Liste Tasks cible pour import

**Contexte :** À l'import CSV / Calendar, où créer les tâches ?

**Décision :** Liste `@default` par défaut. L'utilisateur peut sélectionner une autre liste dans l'écran d'import.

**Conséquences :**
- ✅ Comportement attendu (90 % des cas).
- ⚠️ Nécessite un dropdown `mat-select` peuplé par `tasks.tasklists.list`. Coût : 1 appel API au chargement de l'écran.

---

## ADR-004 — Seuil minimum de tâches évaluées pour activer le LLM

**Contexte :** Combien de tâches évaluées manuellement faut-il avant de faire confiance au LLM ?

**Décision :** Seuil par défaut à **5** (paramétrable en settings, champ `manualFallbackThreshold`). Sous le seuil, l'estimateur marque `source: 'none'` et affiche un badge « Évaluation manuelle requise ».

**Conséquences :**
- ✅ Bootstrap froid sans historique : pas d'estimation fantaisiste.
- ✅ Comportement paramétrable : un utilisateur avancé peut baisser le seuil.

---

## ADR-005 — Provider LLM unique en v1 (Minimax M3)

**Contexte :** Le champ `llmProvider` de `AppSettings` est-il figé à `'minimax'` ou ouvert à d'autres providers ?

**Décision :** Figé à `'minimax'` en v1. Le champ reste dans le modèle de données pour permettre l'ajout futur d'OpenAI natif, Anthropic via baseURL compatible, etc., sans casser le schéma.

**Conséquences :**
- ✅ Surface API minimale.
- ✅ Migration future facilitée par la présence du champ.

---

## ADR-006 — Stratégie responsive mobile-first

**Contexte :** Quelle matrice de breakpoints et quels patterns de navigation adopter ?

**Décision :** Breakpoints Material standard (600 / 768 / 960 / 1100 px). Sidenav `mode="over"` sur mobile (≤ 599 px) et `mode="side"` sur tablet+ (≥ 768 px). Bottom-nav 3 onglets max **uniquement sur mobile** (Tasks / Corpus / Settings). FAB uniquement sur mobile/tablet.

**Conséquences :**
- ✅ UX thumb-friendly sur smartphone.
- ✅ Gain de place écran sur desktop via sidenav permanent.
- ⚠️ Le bottom-nav duplique partiellement la sidenav sur tablet — c'est intentionnel (le bottom-nav disparaît ≥ 600 px via CSS).

---

## ADR-007 — PWA installable mais pas native

**Contexte :** Faut-il un wrapper natif (Capacitor / Ionic) ou une PWA ?

**Décision :** PWA installable via `@angular/service-worker` + `manifest.webmanifest`. Pas de wrapper Capacitor/Ionic en v1.

**Conséquences :**
- ✅ Pas de coût App Store, mise à jour instantanée.
- ✅ Compatible Cloudflare Pages (HTTPS automatique, push via Git).
- ⚠️ Accès device (caméra, géoloc, push notifications natives) impossible — acceptable pour v1 qui ne les utilise pas.

---

## ADR-008 — Déploiement sur Cloudflare Pages (et non GitHub Pages)

**Contexte :** Le cahier des charges initial mentionne GitHub Pages. Choix révisé.

**Décision :** Cloudflare Pages. Le projet utilise `wrangler pages deploy dist/timescribe/browser` (ou l'intégration Cloudflare Git). `baseHref` reste `/` (Cloudflare sert l'app à la racine du domaine).

**Conséquences :**
- ✅ HTTPS automatique, déploiement continu depuis Git.
- ✅ CDN global (faible latence partout).
- ⚠️ SPA routing : il faut un `_redirects` fichier avec `/* /index.html 200` (équivalent du `404.html` GitHub Pages).
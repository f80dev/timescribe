# Guide utilisateur — TimeScribe

> **Évaluez automatiquement la durée de vos tâches Google Tasks grâce à votre historique et à un LLM.**

TimeScribe est une webapp Angular 22 + Material qui se connecte à **Google Tasks**, **Google Drive** et **Google Calendar** pour estimer la durée de vos tâches en croisant votre historique d'évaluations manuelles et un corpus documentaire.

---

## 1. Premiers pas

### 1.1. Connexion

1. Ouvrez TimeScribe dans votre navigateur (l'URL vous a été communiquée par votre équipe).
2. Cliquez sur **Se connecter avec Google**.
3. Choisissez le compte Google qui contient vos tâches.
4. Acceptez les autorisations demandées :
   - **Google Tasks** : lire et modifier vos listes de tâches
   - **Google Drive** : lire les fichiers dans les dossiers que vous sélectionnerez comme corpus
   - **Google Calendar** : lire vos événements (pour l'import)

> ⚠️ Vos jetons OAuth ne sont jamais sauvegardés sur un serveur ni dans le navigateur de manière persistante. Ils restent en mémoire jusqu'à fermeture de l'onglet.

### 1.2. Premier lancement

À la première connexion, TimeScribe vous demande :
- Le **dossier Google Drive** à utiliser comme corpus documentaire (facultatif mais fortement recommandé)
- Le **nombre minimum de tâches évaluées manuellement** avant que le LLM puisse estimer (par défaut : 5)

---

## 2. Écran principal — Tableau de bord

Le tableau de bord liste les tâches de votre liste Google Tasks par défaut (`@default`). Pour chaque tâche, vous voyez :

| Élément | Signification |
|---|---|
| **Titre** | Titre de la tâche |
| **Statut** | À faire / Terminée |
| **Durée estimée** | Badge calculé par le LLM ou ajusté manuellement |
| **Source** | 🤖 LLM / ✍️ Manuel (si vous avez forcé une valeur) |

### 2.1. Filtrer

- Par statut : sélecteur en haut du tableau
- Tri : par date de modification (défaut), par durée estimée

### 2.2. Réévaluer en masse

Bouton **Tout réévaluer** en haut à droite → le LLM re-estime toutes les tâches affichées.

### 2.3. Ajouter une tâche

Bouton **+** flottant (FAB) → formulaire rapide titre + durée manuelle.

---

## 3. Détail d'une tâche

Cliquez sur une tâche pour ouvrir son détail. Vous pouvez :

### 3.1. Ajuster la durée manuellement

- Champ **Durée** (en minutes)
- Cet ajustement est **toujours gagnant** : il écrase l'estimation LLM
- Pour relancer le LLM : bouton **Re-estimer par LLM** à côté du champ

### 3.2. Marquer comme terminée

Cochez la case **Terminée** — la tâche passe en gris dans le tableau et alimente votre historique d'évaluations pour les futures estimations.

---

## 4. Corpus documentaire

Le corpus est un dossier Google Drive contenant des documents (PDF, .txt, .md, .gdoc) que TimeScribe utilise comme contexte métier pour le LLM.

### 4.1. Configurer le corpus

1. Menu **Corpus** (sidebar ou bottom-nav)
2. Cliquez **Choisir un dossier Drive**
3. Naviguez dans vos dossiers Drive et sélectionnez celui qui contient vos notes internes, comptes-rendus, specs, fiches de poste, etc.
4. Le corpus est reconstruit automatiquement (déduplication par hash, troncature à 50 000 caractères par défaut)

### 4.2. Quels fichiers sont indexés ?

- ✅ Google Docs, .txt, .md, .markdown
- ✅ PDF (texte extrait)
- ❌ Images, vidéos, fichiers binaires
- ❌ Fichiers > 50 000 caractères (tronqués, signalés dans la config)

### 4.3. Désactiver temporairement

Vous pouvez désactiver le corpus sans le supprimer : bouton **Désactiver** dans l'écran Corpus → les estimations LLM utiliseront uniquement votre historique.

---

## 5. Import en bloc

### 5.1. Importer depuis Gmail (CSV)

1. Allez sur [Google Takeout](https://takeout.google.com) → ne cochez que **Mail** → format **CSV** (pas MBOX)
2. Extrayez l'archive, prenez le fichier `All mail.csv` (ou `Inbox.csv`)
3. Menu **Import** → onglet **CSV Gmail** → uploadez le fichier
4. TimeScribe parse le CSV et crée une tâche par ligne (titre = objet, durée = vide, à vous de compléter)

> Format CSV attendu (colonnes au minimum) : `Subject`, `Date`, `From`, `To`, `Body`. Le parser est tolérant aux colonnes manquantes.

### 5.2. Importer depuis Google Calendar

1. Menu **Import** → onglet **Calendar**
2. Choisissez la plage de dates (ex : 1 mois en arrière)
3. Cochez les événements à transformer en tâches
4. TimeScribe crée une tâche par événement, avec une durée estimée = durée de l'événement

---

## 6. Paramètres

Menu **Paramètres** → 4 sections :

### 6.1. LLM

- **Base URL** : URL de l'API LLM (par défaut `https://api.minimax.io/v1`)
- **Modèle** : nom du modèle (par défaut `MiniMax-M3`)
- **Température** : 0 = déterministe, 1 = créatif (défaut 0.3)
- **Max tokens** : taille max de la réponse (défaut 500)
- **Seuil minimum de tâches évaluées** : nombre minimum d'évaluations manuelles avant d'activer le LLM (défaut 5, recommandé entre 3 et 10)
- **Budget corpus** : nombre max de caractères envoyés au LLM (défaut 50 000)
- **Historique max** : nombre max de tâches historiques envoyées comme exemples au LLM (défaut 20)

### 6.2. Apparence

- **Thème** : clair / sombre / système
- **Densité** : compacte / standard / spacious

### 6.3. Données

- **Exporter** : télécharge une sauvegarde locale de vos estimations manuelles (JSON)
- **Importer** : restaure une sauvegarde
- **Tout effacer** : supprime estimations + corpus local (les tâches Google Tasks ne sont **pas** touchées)

### 6.4. Compte

- **Se déconnecter** : revoke le token OAuth et purge la mémoire
- **Reconnecter** : force un nouveau flow OAuth

---

## 7. Mobile vs Desktop

TimeScribe est **responsive mobile-first**. La matrice :

| Écran | Desktop (≥ 1024 px) | Tablette (768-1023 px) | Mobile (< 768 px) |
|---|---|---|---|
| Navigation | Sidenav permanente à gauche | Sidenav réduite | Bottom-nav (barre en bas) |
| Tableau de bord | Tableau 3 colonnes | Tableau 2 colonnes | Cards empilées |
| Détail tâche | Split view | Scroll unique | Scroll unique |
| Import | Drag-drop + sélecteur fichier | Drag-drop + sélecteur fichier | Sélecteur fichier uniquement |

---

## 8. PWA / Installation

TimeScribe est installable comme application native (PWA) :

- **Chrome / Edge** : barre d'adresse → icône **Installer**
- **Safari iOS** : partage → **Sur l'écran d'accueil**
- **Android** : menu navigateur → **Ajouter à l'écran d'accueil**

Une fois installée :
- Fonctionne **hors ligne** (consultation du tableau, modifications reportées au retour en ligne)
- Pas d'icône navigateur
- Lance comme une app native

---

## 9. Confidentialité

- **Aucun serveur tiers** : TimeScribe est 100 % client-side (déployé sur Cloudflare Pages, hébergement statique)
- **Vos jetons OAuth** restent en mémoire, jamais écrits sur disque ni dans le cloud
- **Vos tâches Google Tasks** ne sont jamais lues par un tiers : seul le LLM reçoit le strict nécessaire (titre + durée historique + extrait corpus)
- **Stockage local** (IndexedDB via Dexie) : estimations manuelles, corpus, paramètres — sur votre appareil, jamais sync vers un serveur

> ⚠️ Le LLM (Minimax M3) reçoit à chaque estimation : le titre de la tâche, le contexte corpus pertinent, et ~5-20 exemples historiques. **Ne mettez pas de secrets dans vos titres de tâches.**

---

## 10. Dépannage

### La connexion Google échoue

- Vérifiez que vous êtes connecté au bon compte Google (celui avec vos tâches)
- Videz le cache navigateur → réessayez
- Si l'erreur persiste, vérifiez la console DevTools (F12) et notez le message

### Le LLM ne propose pas d'estimation

- Vérifiez que vous avez au moins **N tâches évaluées manuellement** (N = seuil configuré)
- Vérifiez que la **clé API / Base URL** est correcte dans Paramètres → LLM
- Allez dans Paramètres → LLM → bouton **Tester la connexion** : doit retourner "OK"

### L'estimation semble incohérente

- Augmentez le **budget corpus** (max 200 000 caractères) dans Paramètres
- Vérifiez que vos titres de tâches sont explicites (le LLM n'a pas d'autre contexte)
- Marquez manuellement la "bonne" valeur → vos futures estimations s'amélioreront

### Erreur "Quota dépassé"

- Le LLM a un rate limit. Réessayez dans 60 secondes.
- Réduisez le **nombre de réévaluations simultanées** (ne cliquez pas "Tout réévaluer" sur 500 tâches d'un coup)

---

## 11. Raccourcis clavier

| Touche | Action |
|---|---|
| `Ctrl/Cmd + K` | Recherche rapide de tâche |
| `Esc` | Fermer le détail d'une tâche |
| `Entrée` (sur une tâche) | Ouvrir le détail |
| `Ctrl/Cmd + S` (sur le détail) | Sauver l'ajustement manuel |

---

## 12. Limites connues (v1)

- 1 seule liste Google Tasks (`@default`) est supportée — pas de multi-list
- 1 seul dossier corpus à la fois
- Le LLM n'est pas testé sur les tâches très longues (titre > 500 caractères) — tronqué automatiquement
- Pas d'export vers Google Tasks (vous pouvez ajuster la durée manuellement mais pas la pousser en bloc)

---

## 13. Support

- **Documentation technique** : `docs/cahier-des-charges.md` (côté technique)
- **Code source** : https://github.com/f80dev/timescribe
- **Issues** : https://github.com/f80dev/timescribe/issues

---

*TimeScribe v1.0 — septembre 2026*

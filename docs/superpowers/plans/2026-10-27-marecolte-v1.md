# Ma récolte v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PWA hors ligne pour iPhone qui enregistre des groupes de plants et leurs récoltes (en pièces), avec bilan annuel et sauvegarde JSON / export CSV.

**Architecture:** Toute la logique métier est dans un module pur `domain.js` (sans DOM ni stockage), testé avec `node --test`. `app.js` gère le DOM, les onglets et la persistance (un seul objet JSON dans `localStorage`). Un service worker met les fichiers statiques en cache pour le hors ligne.

**Tech Stack:** HTML/CSS/JS (modules ES) sans dépendance, Node ≥ 20 uniquement pour les tests (`node --test`), GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-10-27-marecolte-design.md`

## Global Constraints

- Aucune dépendance npm, aucun framework, aucune étape de build. Seul `package.json` autorisé : `{ "type": "module", "private": true }`.
- Tous les textes visibles en français.
- Unité de récolte unique : la pièce, entier ≥ 1.
- Dates stockées en chaîne `AAAA-MM-JJ` en **heure locale**, jamais via `toISOString()`.
- Clé de stockage : `localStorage["marecolte"]`, format `State` (voir Task 1), `version: 1`.
- Le site doit fonctionner servi depuis un sous-chemin (`https://<user>.github.io/marecolte/`) : tous les chemins sont relatifs (`./`).
- Cible : Safari iOS 18 ; écran de 375 px de large (SE 2ᵉ gén.), cibles tactiles ≥ 44 px.

## Review Focus

1. **Restaurer un mauvais fichier** (autre JSON, fichier tronqué, récolte vers un groupe inexistant) : les données existantes doivent rester intactes et un message d'erreur s'affiche. → test `parseBackup rejette…` (Task 3) + restauration seulement après validation (Task 6).
2. **Saisie de pièces invalide** (vide, 0, négatif, `2.5`, texte) : refus avec message, rien n'est enregistré. → tests `addRecolte refuse…` (Task 1).
3. **Note contenant `;`, `"`, retour à la ligne ou accents dans l'export CSV** : le fichier s'ouvre correctement dans Excel / Numbers. → test `toCsv échappe…` (Task 3).
4. **« Aujourd'hui » autour de minuit** : une récolte saisie à 0 h 30 doit porter la date du jour local, pas celle de la veille en UTC. → test `today utilise l'heure locale` (Task 3).
5. **Mise à jour de l'app déjà installée** : après un déploiement, l'iPhone doit recevoir la nouvelle version au lancement suivant (ou au deuxième) au lieu de garder indéfiniment l'ancienne en cache. → constante `CACHE` versionnée dans `sw.js` et vérification manuelle (Task 7).

---

## File Structure

| Fichier | Rôle |
|---|---|
| `package.json` | `{ "type": "module", "private": true }`, pour que Node charge les modules ES |
| `domain.js` | Logique pure : modèle, validation, bilan, CSV, sauvegarde |
| `tests/domain.test.js` | Tests `node:test` de `domain.js` |
| `index.html` | Coquille : 3 sections d'onglet, barre d'onglets, `<dialog>` de saisie |
| `style.css` | Styles mobiles |
| `app.js` | DOM, navigation, persistance `localStorage`, téléchargements |
| `sw.js` | Service worker cache-first |
| `manifest.webmanifest`, `icon.svg`, `icon-180.png`, `icon-512.png` | Installation PWA |
| `README.md` | Lancer en local, tester, déployer, installer sur l'iPhone |

Lancer les tests : `node --test tests/`
Servir en local : `python3 -m http.server 8000`, puis ouvrir `http://localhost:8000/`

---

### Task 1: Modèle et opérations sur les groupes et les récoltes

**Files:**
- Create: `package.json`, `domain.js`, `tests/domain.test.js`

**Interfaces:**
- Produces (types JSDoc dans `domain.js`) :
  - `Groupe = { id: string, produit: string, variete: string, nbPlants: number, datePlantation: string, note: string, termine: boolean }`
  - `Recolte = { id: string, groupeId: string, date: string, pieces: number, note: string }`
  - `State = { version: 1, groupes: Groupe[], recoltes: Recolte[] }`
  - `emptyState(): State`
  - `addGroupe(state, { produit, variete?, nbPlants, datePlantation, note? }): Groupe`, qui ajoute à `state.groupes` (mutation) et retourne le groupe ; `termine: false`.
  - `updateGroupe(state, id, champs): Groupe` (champs partiels, y compris `termine`)
  - `deleteGroupe(state, id): void`, qui lève `Error("Ce groupe a des récoltes : supprimez-les d'abord.")` si des récoltes le référencent.
  - `addRecolte(state, { groupeId, date, pieces, note? }): Recolte`
  - `updateRecolte(state, id, champs): Recolte`
  - `deleteRecolte(state, id): void`
  - Les erreurs de validation sont des `Error` dont le message est affichable tel quel.
- Validation (même règle en ajout et en modification) :
  - `produit` trimé non vide → sinon `"Le produit est obligatoire."`
  - `nbPlants` entier ≥ 1 → sinon `"Le nombre de plants doit être un entier positif."`
  - `pieces` entier ≥ 1 → sinon `"Le nombre de pièces doit être un entier positif."`
  - `date` / `datePlantation` au format `AAAA-MM-JJ` et date réelle → sinon `"Date invalide."`
  - `groupeId` existant → sinon `"Groupe inconnu."`
  - Les champs texte sont trimés ; les nombres reçus en chaîne (venant d'un `<input>`) sont convertis avec `Number()`.
  - Ids via `crypto.randomUUID()`.

- [ ] **Step 1: Write the failing tests** dans `tests/domain.test.js` (`import { test } from 'node:test'; import assert from 'node:assert/strict';`) :
  - `addGroupe crée un groupe actif` : `addGroupe(s, {produit:' Tomate ', variete:'Cœur de bœuf', nbPlants:'6', datePlantation:'2026-05-12'})` → `produit === 'Tomate'`, `nbPlants === 6`, `termine === false`, `note === ''`, `s.groupes.length === 1`.
  - `addGroupe refuse un produit vide` : `assert.throws(() => addGroupe(s, {produit:'  ', nbPlants:1, datePlantation:'2026-05-12'}), /produit est obligatoire/)`.
  - `addGroupe refuse nbPlants invalide` : pour `0`, `-1`, `1.5`, `''`, `'abc'` → throws `/entier positif/`.
  - `addRecolte refuse des pièces invalides` : pour `0`, `-3`, `2.5`, `''`, `'abc'` → throws `/pièces doit être un entier positif/` et `s.recoltes.length === 0`.
  - `addRecolte refuse une date invalide` : `'2026-02-30'`, `'27/10/2026'`, `''` → throws `/Date invalide/`.
  - `addRecolte refuse un groupe inconnu` → throws `/Groupe inconnu/`.
  - `updateGroupe marque terminé` : `updateGroupe(s, g.id, {termine:true}).termine === true`, les autres champs sont inchangés.
  - `updateRecolte valide les champs` : `updateRecolte(s, r.id, {pieces:0})` throws et la récolte garde ses pièces d'origine.
  - `deleteGroupe refuse si récoltes` → throws `/a des récoltes/` ; après `deleteRecolte`, `deleteGroupe` réussit et `s.groupes.length === 0`.

- [ ] **Step 2: Run** `node --test tests/` → FAIL (module `../domain.js` introuvable).
- [ ] **Step 3: Create** `package.json` (contenu exact des Global Constraints), puis implémenter les fonctions ci-dessus dans `domain.js`. Une fonction de validation partagée par `add*` et `update*` : on valide la fusion `{...existant, ...champs}` avant de l'appliquer, pour qu'une modification invalide ne laisse rien à moitié modifié.
- [ ] **Step 4: Run** `node --test tests/` → tous PASS.
- [ ] **Step 5: Commit** `git add package.json domain.js tests/domain.test.js && git commit -m "feat: modèle groupes et récoltes"`

---

### Task 2: Requêtes (groupes actifs, années, bilan, liste)

**Files:**
- Modify: `domain.js`, `tests/domain.test.js`

**Interfaces:**
- Consumes: `State`, `Groupe`, `Recolte` (Task 1)
- Produces:
  - `libelle(groupe): string` → `"Tomate – Cœur de bœuf"`, ou `"Tomate"` sans variété
  - `groupesActifs(state): Groupe[]`, groupes non terminés triés par `libelle` (`localeCompare(…, 'fr')`)
  - `annees(state): number[]`, années distinctes des **dates de récolte**, décroissantes
  - `bilan(state, annee): { groupe: Groupe, total: number, parPlant: number, premiere: string, derniere: string }[]`, uniquement les groupes ayant ≥ 1 récolte dont la date est dans `annee`, triés par `libelle` ; `parPlant = Math.round(total / nbPlants * 10) / 10`
  - `recoltesDe(state, annee): Recolte[]`, récoltes de l'année triées par date décroissante

- [ ] **Step 1: Write the failing tests** :
  - `groupesActifs exclut les terminés et trie` : groupes « Tomate », « Courgette », « Ail » (terminé) → libellés `['Courgette', 'Tomate']`.
  - `annees suit la date de récolte` : un groupe planté le `2026-05-10` avec des récoltes le `2026-11-02` et le `2027-01-15` → `[2027, 2026]`.
  - `bilan compte par année de récolte` : même jeu ; `bilan(s, 2026)` → un élément avec `total` égal aux pièces de 2026 seulement ; `bilan(s, 2027)` → idem pour 2027 ; groupe à 6 plants et 20 pièces → `parPlant === 3.3` ; `premiere` / `derniere` corrects avec deux récoltes la même année.
  - `bilan ignore les groupes sans récolte dans l'année` → longueur 0 pour une année sans récolte.
  - `recoltesDe trie par date décroissante`.
- [ ] **Step 2: Run** `node --test tests/` → FAIL (exports manquants).
- [ ] **Step 3: Implement** les 5 fonctions dans `domain.js`. L'année d'une récolte est `Number(date.slice(0, 4))`.
- [ ] **Step 4: Run** `node --test tests/` → PASS.
- [ ] **Step 5: Commit** `git commit -am "feat: bilan annuel et requêtes"`

---

### Task 3: Date du jour, export CSV, sauvegarde JSON

**Files:**
- Modify: `domain.js`, `tests/domain.test.js`

**Interfaces:**
- Consumes: `State`, `libelle` (Tasks 1-2)
- Produces:
  - `today(now = new Date()): string` → `AAAA-MM-JJ` construit avec `getFullYear/getMonth/getDate` (heure locale)
  - `toCsv(state): string`
  - `toBackup(state): string` → `JSON.stringify(state, null, 2)`
  - `parseBackup(text): State`, qui lève `Error("Fichier de sauvegarde invalide : <raison>")` si le JSON n'est pas parsable, si `version !== 1`, si `groupes` ou `recoltes` n'est pas un tableau, si un élément ne passe pas la validation de la Task 1, ou si une récolte référence un `groupeId` absent.
- Format CSV (exact) :
  - BOM `﻿` en tête, séparateur `;`, fin de ligne `\r\n` (attendu par Excel en français)
  - en-tête : `date;produit;variete;pieces;nb_plants;date_plantation;note`
  - une ligne par récolte, triée par date croissante ; `note` = note de la récolte
  - un champ contenant `;`, `"`, `\r` ou `\n` est entouré de `"` avec les `"` doublés

- [ ] **Step 1: Write the failing tests** :
  - `today utilise l'heure locale` : `today(new Date(2026, 9, 28, 0, 30)) === '2026-10-28'` et `today(new Date(2026, 0, 5, 23, 59)) === '2026-01-05'`.
  - `toCsv produit en-tête et lignes` : une récolte → `csv.startsWith('﻿date;produit;variete;pieces;nb_plants;date_plantation;note\r\n')` et contient `2026-07-01;Tomate;Cœur de bœuf;12;6;2026-05-12;`.
  - `toCsv échappe les champs` : note `Bol "plein"; serre\nsud` → le champ vaut `"Bol ""plein""; serre\nsud"`.
  - `toBackup puis parseBackup restitue l'état` : `assert.deepEqual(parseBackup(toBackup(s)), s)`.
  - `parseBackup rejette les fichiers invalides` : `'pas du json'`, `'{}'`, `'{"version":2,"groupes":[],"recoltes":[]}'`, une récolte avec `pieces: 0`, une récolte avec un `groupeId` inconnu → chacun throws `/Fichier de sauvegarde invalide/`.
- [ ] **Step 2: Run** `node --test tests/` → FAIL.
- [ ] **Step 3: Implement** les 4 fonctions. `parseBackup` réutilise la validation de la Task 1 sur chaque élément.
- [ ] **Step 4: Run** `node --test tests/` → PASS.
- [ ] **Step 5: Commit** `git commit -am "feat: date locale, export CSV, sauvegarde JSON"`

---

### Task 4: Coquille de l'app et onglet Groupes

**Files:**
- Create: `index.html`, `style.css`, `app.js`

**Interfaces:**
- Consumes: toutes les fonctions de `domain.js`
- Produces (dans `app.js`, utilisés par les Tasks 5-6) :
  - `state: State`, chargé au démarrage par `load()`
  - `load(): State` : `parseBackup(localStorage.marecolte)` si présent, sinon `emptyState()`. En cas d'erreur de lecture, **ne pas écraser** la clé : afficher l'erreur et démarrer avec un état vide en mode lecture seule (`saveDisabled = true`).
  - `save(): boolean` : `localStorage.marecolte = toBackup(state)` dans un try/catch ; en cas d'échec, `alert("Enregistrement impossible : " + e.message)` et retour `false`.
  - `render()` : redessine l'onglet courant
  - `showTab(nom: 'recolter' | 'historique' | 'groupes')`
  - Chaque action utilisateur suit le même schéma : appel `domain.js` dans un try/catch (message d'erreur affiché dans le formulaire, formulaire laissé ouvert), puis `save()`, puis `render()`.
- `index.html` : `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`, `<html lang="fr">`, trois `<section data-tab>`, une `<nav>` de 3 boutons en bas, `<script type="module" src="./app.js">`.
- Onglet Groupes :
  - section « En cours » (groupes actifs) et section « Terminés » repliée (`<details>`)
  - bouton « + Nouveau groupe » qui ouvre un `<dialog>` avec produit, variété, nombre de plants, date de plantation (`<input type="date">`, défaut `today()`), note
  - un appui sur un groupe ouvre le même dialog en modification, avec les boutons « Terminer » / « Réactiver » et « Supprimer » (après `confirm`)
  - autocomplétion de `produit` via `<datalist>` alimentée par les produits déjà saisis (évite « Tomate » / « tomates »)

- [ ] **Step 1: Implement** `index.html`, `style.css` et `app.js` (chargement, sauvegarde, navigation, onglet Groupes). Les onglets Récolter et Historique affichent provisoirement « À venir ».
- [ ] **Step 2: Verify manually** avec `python3 -m http.server 8000`, dans le navigateur en vue mobile 375 px :
  - créer « Tomate / Cœur de bœuf / 6 / 12-05-2026 », recharger la page → le groupe est toujours là
  - nombre de plants à 0 → message « Le nombre de plants doit être un entier positif. », dialog toujours ouvert
  - terminer le groupe → il passe dans « Terminés » ; le réactiver
  - le supprimer (sans récolte) → confirmation, puis il disparaît
- [ ] **Step 3: Run** `node --test tests/` → PASS (pas de régression).
- [ ] **Step 4: Commit** `git add index.html style.css app.js && git commit -m "feat: coquille de l'app et onglet Groupes"`

---

### Task 5: Onglets Récolter et Historique

**Files:**
- Modify: `index.html`, `style.css`, `app.js`

**Interfaces:**
- Consumes: `groupesActifs`, `addRecolte`, `updateRecolte`, `deleteRecolte`, `annees`, `bilan`, `recoltesDe`, `libelle`, `today` ; `state`, `save`, `render` (Task 4)

- Récolter (onglet affiché au lancement) :
  - un gros bouton par groupe actif (`libelle`, puis le nombre de plants en petit)
  - aucun groupe actif → message « Aucun groupe en cours. Créez-en un dans l'onglet Groupes. »
  - un appui ouvre un `<dialog>` : titre = libellé, pièces (`<input type="number" inputmode="numeric" min="1" step="1">`, focus automatique), date (défaut `today()`), note, bouton « Enregistrer » ; après succès, fermer et afficher brièvement « ✓ 12 pièces enregistrées »
- Historique :
  - `<select>` des `annees(state)`, l'année la plus récente par défaut ; aucune récolte → « Aucune récolte enregistrée. »
  - tableau du bilan : Produit, Plants, Pièces, Pièces/plant, 1ʳᵉ, Dernière (dates au format `JJ/MM`)
  - en dessous, la liste `recoltesDe` (`JJ/MM — libellé — N pièces — note`) ; un appui ouvre le dialog de récolte en modification, avec un bouton « Supprimer » (après `confirm("Supprimer cette récolte ?")`)
  - le dialog de modification permet de changer de groupe (`<select>` de **tous** les groupes, terminés compris)

- [ ] **Step 1: Implement** les deux onglets.
- [ ] **Step 2: Verify manually** (navigateur, 375 px) :
  - saisir 12 pièces sur Tomate → toast, puis l'Historique 2026 montre Pièces 12 et Pièces/plant 2
  - pièces vides ou `2.5` → message d'erreur, dialog ouvert, rien d'enregistré
  - récolte datée du 15/01/2027 → l'année 2027 apparaît dans le `<select>` avec son propre bilan
  - modifier puis supprimer une récolte → le bilan se met à jour
  - tenter de supprimer le groupe Tomate (onglet Groupes) → message « Ce groupe a des récoltes… »
- [ ] **Step 3: Run** `node --test tests/` → PASS.
- [ ] **Step 4: Commit** `git commit -am "feat: onglets Récolter et Historique"`

---

### Task 6: Menu Données (sauvegarder, restaurer, exporter CSV)

**Files:**
- Modify: `index.html`, `app.js`

**Interfaces:**
- Consumes: `toBackup`, `parseBackup`, `toCsv`, `today` ; `state`, `save`, `render`
- Produces: `download(nomFichier: string, contenu: string, type: string): void` : `Blob` + `URL.createObjectURL` + `<a download>` cliqué par programme. Sur iOS, Safari propose alors d'enregistrer dans Fichiers.

- Dans l'onglet Groupes, un `<details>` « Données » avec trois boutons :
  - « Sauvegarder » → `marecolte-AAAA-MM-JJ.json` (`application/json`)
  - « Exporter CSV » → `marecolte-AAAA-MM-JJ.csv` (`text/csv;charset=utf-8`)
  - « Restaurer… » → `<input type="file" accept=".json,application/json">`, `file.text()`, `parseBackup` ; si erreur → `alert(message)` et **état inchangé** ; sinon `confirm("Remplacer toutes les données actuelles (N groupes, M récoltes) par celles du fichier (N' groupes, M' récoltes) ?")`, puis remplacement de `state`, `save()`, `render()`
  - sous les boutons, un rappel : « Supprimer l'app de l'écran d'accueil efface toutes les données. Sauvegardez régulièrement. »

- [ ] **Step 1: Implement** le menu.
- [ ] **Step 2: Verify manually** :
  - Sauvegarder, tout supprimer à la main, Restaurer le fichier → données revenues à l'identique
  - Restaurer un fichier `.json` quelconque (par exemple `package.json`) → message « Fichier de sauvegarde invalide… », données intactes
  - Exporter CSV, puis l'ouvrir dans un tableur (LibreOffice ou Numbers) → colonnes séparées, accents corrects
- [ ] **Step 3: Commit** `git commit -am "feat: sauvegarde, restauration et export CSV"`

---

### Task 7: PWA hors ligne, déploiement et installation

**Files:**
- Create: `sw.js`, `manifest.webmanifest`, `icon.svg`, `icon-180.png`, `icon-512.png`, `README.md`
- Modify: `index.html`, `app.js`

**Interfaces:**
- `sw.js` :
  - `const CACHE = 'marecolte-v1'` ; **à incrémenter à chaque déploiement** (le README le rappelle)
  - `install` : met en cache `./`, `./index.html`, `./style.css`, `./app.js`, `./domain.js`, `./manifest.webmanifest`, `./icon-180.png`, `./icon-512.png`, puis `skipWaiting()`
  - `activate` : supprime les caches dont le nom ≠ `CACHE`, puis `clients.claim()`
  - `fetch` : cache d'abord, réseau en repli
- `app.js` : `navigator.serviceWorker?.register('./sw.js')`
- `index.html` : `<link rel="manifest" href="./manifest.webmanifest">`, `<link rel="apple-touch-icon" href="./icon-180.png">`, `<meta name="apple-mobile-web-app-title" content="Ma récolte">`, `<meta name="theme-color" content="#3a7d44">`
- `manifest.webmanifest` : `name: "Ma récolte"`, `short_name: "Récolte"`, `start_url: "./"`, `scope: "./"`, `display: "standalone"`, `lang: "fr"`, icônes 180 et 512.
- Icônes : `icon.svg` simple (motif feuille ou panier sur fond `#3a7d44`), rendue en PNG 180 × 180 et 512 × 512 avec Chromium headless (skill `playwright-cli`, capture d'une page qui affiche le SVG à la bonne taille). ImageMagick n'est pas installé sur le Dell.
- `README.md` : tests (`node --test tests/`), serveur local, déploiement (incrémenter `CACHE`, puis push), activation de GitHub Pages (*Settings › Pages › Deploy from branch › main / root*), installation sur l'iPhone (ouvrir l'URL dans Safari › Partager › Sur l'écran d'accueil), avertissement sur la sauvegarde.

- [ ] **Step 1: Implement** les fichiers ci-dessus.
- [ ] **Step 2: Verify locally** : Chrome DevTools › Application → manifest valide, service worker actif ; cocher *Offline*, recharger → l'app s'affiche et une saisie fonctionne.
- [ ] **Step 3: Commit** `git add -A && git commit -m "feat: PWA hors ligne et README"`
- [ ] **Step 4: Publish (action de l'utilisateur, à confirmer avant)** : créer le dépôt public `marecolte` sur GitHub (`gh repo create marecolte --public --source . --push`), puis activer Pages comme décrit dans le README.
- [ ] **Step 5: Verify on iPhone** :
  - installer depuis Safari, ouvrir depuis l'icône → plein écran, sans barre Safari
  - mode Avion, puis relancer l'app → elle fonctionne et les saisies sont conservées
  - changement mineur + `CACHE = 'marecolte-v2'` + push ; relancer l'app deux fois → nouvelle version visible
  - Sauvegarder → le fichier arrive dans l'app Fichiers

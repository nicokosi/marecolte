// Logique métier pure : aucune dépendance au DOM ni au stockage.

/**
 * @typedef {{ id: string, produit: string, variete: string, nbPlants: number, datePlantation: string, note: string, termine: boolean }} Groupe
 * @typedef {{ id: string, groupeId: string, date: string, pieces: number, note: string }} Recolte
 * @typedef {{ version: 1, groupes: Groupe[], recoltes: Recolte[] }} State
 */

/** @returns {State} */
export function emptyState() {
  return { version: 1, groupes: [], recoltes: [] };
}

function texte(v) {
  return String(v ?? '').trim();
}

function entierPositif(v, message) {
  const n = typeof v === 'string' && v.trim() === '' ? NaN : Number(v);
  if (!Number.isInteger(n) || n < 1) throw new Error(message);
  return n;
}

function dateValide(v) {
  const s = texte(v);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  const d = m && new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (!d || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) throw new Error('Date invalide.');
  return s;
}

/** Valide et normalise un groupe complet ; lève une Error au message affichable. */
export function normaliserGroupe(g) {
  const produit = texte(g.produit);
  if (!produit) throw new Error('Le produit est obligatoire.');
  return {
    id: g.id,
    produit,
    variete: texte(g.variete),
    nbPlants: entierPositif(g.nbPlants, 'Le nombre de plants doit être un entier positif.'),
    datePlantation: dateValide(g.datePlantation),
    note: texte(g.note),
    termine: Boolean(g.termine),
  };
}

/** Valide et normalise une récolte complète par rapport aux groupes de `state`. */
export function normaliserRecolte(state, r) {
  if (!state.groupes.some((g) => g.id === r.groupeId)) throw new Error('Groupe inconnu.');
  return {
    id: r.id,
    groupeId: r.groupeId,
    date: dateValide(r.date),
    pieces: entierPositif(r.pieces, 'Le nombre de pièces doit être un entier positif.'),
    note: texte(r.note),
  };
}

function trouver(liste, id) {
  const i = liste.findIndex((x) => x.id === id);
  if (i < 0) throw new Error('Élément introuvable.');
  return i;
}

/** @returns {Groupe} */
export function addGroupe(state, champs) {
  const g = normaliserGroupe({ ...champs, id: crypto.randomUUID(), termine: false });
  state.groupes.push(g);
  return g;
}

/** @returns {Groupe} */
export function updateGroupe(state, id, champs) {
  const i = trouver(state.groupes, id);
  const g = normaliserGroupe({ ...state.groupes[i], ...champs, id });
  state.groupes[i] = g;
  return g;
}

export function deleteGroupe(state, id) {
  const i = trouver(state.groupes, id);
  if (state.recoltes.some((r) => r.groupeId === id)) {
    throw new Error("Ce groupe a des récoltes : supprimez-les d'abord.");
  }
  state.groupes.splice(i, 1);
}

/** @returns {Recolte} */
export function addRecolte(state, champs) {
  const r = normaliserRecolte(state, { ...champs, id: crypto.randomUUID() });
  state.recoltes.push(r);
  return r;
}

/** @returns {Recolte} */
export function updateRecolte(state, id, champs) {
  const i = trouver(state.recoltes, id);
  const r = normaliserRecolte(state, { ...state.recoltes[i], ...champs, id });
  state.recoltes[i] = r;
  return r;
}

export function deleteRecolte(state, id) {
  state.recoltes.splice(trouver(state.recoltes, id), 1);
}

/** "Tomate – Cœur de bœuf", ou "Tomate" sans variété. */
export function libelle(groupe) {
  return groupe.variete ? `${groupe.produit} – ${groupe.variete}` : groupe.produit;
}

const parLibelle = (a, b) => libelle(a).localeCompare(libelle(b), 'fr');

/** @returns {Groupe[]} */
export function groupesActifs(state) {
  return state.groupes.filter((g) => !g.termine).sort(parLibelle);
}

const anneeDe = (r) => Number(r.date.slice(0, 4));

/** Années de récolte distinctes, de la plus récente à la plus ancienne. */
export function annees(state) {
  return [...new Set(state.recoltes.map(anneeDe))].sort((a, b) => b - a);
}

/** @returns {Recolte[]} récoltes de l'année, de la plus récente à la plus ancienne */
export function recoltesDe(state, annee) {
  return state.recoltes.filter((r) => anneeDe(r) === annee).sort((a, b) => b.date.localeCompare(a.date));
}

/** Bilan par groupe des récoltes datées de `annee`. */
export function bilan(state, annee) {
  const recoltes = recoltesDe(state, annee);
  return state.groupes
    .map((groupe) => {
      const dates = recoltes.filter((r) => r.groupeId === groupe.id);
      if (!dates.length) return null;
      const total = dates.reduce((n, r) => n + r.pieces, 0);
      return {
        groupe,
        total,
        parPlant: Math.round((total / groupe.nbPlants) * 10) / 10,
        premiere: dates.at(-1).date,
        derniere: dates[0].date,
      };
    })
    .filter(Boolean)
    .sort((a, b) => parLibelle(a.groupe, b.groupe));
}

/** Date du jour AAAA-MM-JJ en heure locale (toISOString donnerait la date UTC). */
export function today(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

function champCsv(v) {
  const s = String(v);
  return /[;"\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

/** CSV pour tableur français : BOM, séparateur ";", fins de ligne CRLF, une ligne par récolte. */
export function toCsv(state) {
  const groupes = new Map(state.groupes.map((g) => [g.id, g]));
  const lignes = [...state.recoltes]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => {
      const g = groupes.get(r.groupeId);
      return [r.date, g.produit, g.variete, r.pieces, g.nbPlants, g.datePlantation, r.note];
    });
  const entete = ['date', 'produit', 'variete', 'pieces', 'nb_plants', 'date_plantation', 'note'];
  return '﻿' + [entete, ...lignes].map((l) => l.map(champCsv).join(';') + '\r\n').join('');
}

export function toBackup(state) {
  return JSON.stringify(state, null, 2);
}

/** Lit et valide une sauvegarde ; lève une Error sans rien modifier si le fichier est invalide. */
export function parseBackup(text) {
  try {
    const data = JSON.parse(text);
    if (data?.version !== 1) throw new Error('version non reconnue');
    if (!Array.isArray(data.groupes) || !Array.isArray(data.recoltes)) throw new Error('structure inattendue');
    const state = emptyState();
    for (const g of data.groupes) {
      if (typeof g?.id !== 'string' || !g.id) throw new Error('identifiant de groupe manquant');
      state.groupes.push(normaliserGroupe(g));
    }
    for (const r of data.recoltes) {
      if (typeof r?.id !== 'string' || !r.id) throw new Error('identifiant de récolte manquant');
      state.recoltes.push(normaliserRecolte(state, r));
    }
    return state;
  } catch (e) {
    throw new Error(`Fichier de sauvegarde invalide : ${e.message}`);
  }
}

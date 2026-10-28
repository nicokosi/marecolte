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

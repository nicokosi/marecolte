import {
  emptyState, addGroupe, updateGroupe, deleteGroupe,
  addRecolte, updateRecolte, deleteRecolte,
  libelle, groupesActifs, annees, bilan, recoltesDe,
  today, toCsv, toBackup, parseBackup,
} from './domain.js';

const CLE = 'marecolte';
const $ = (sel) => document.querySelector(sel);

let saveDisabled = false;
let state = load();
let onglet = 'recolter';
let anneeChoisie = null;

function load() {
  try {
    const brut = localStorage.getItem(CLE);
    return brut === null ? emptyState() : parseBackup(brut);
  } catch (e) {
    // Ne jamais écraser des données qu'on n'a pas su relire : on bloque l'enregistrement.
    saveDisabled = true;
    alert(`Données illisibles, aucune modification ne sera enregistrée.\n${e.message}`);
    return emptyState();
  }
}

function save() {
  if (saveDisabled) {
    alert('Enregistrement désactivé : les données stockées sont illisibles.');
    return false;
  }
  try {
    localStorage.setItem(CLE, toBackup(state));
    return true;
  } catch (e) {
    alert(`Enregistrement impossible : ${e.message}`);
    return false;
  }
}

/** Exécute une action métier ; affiche l'erreur dans le formulaire et annule tout si l'enregistrement échoue. */
function agir(form, action) {
  const erreur = form?.querySelector('.erreur');
  try {
    action();
  } catch (e) {
    if (erreur) erreur.textContent = e.message;
    else alert(e.message);
    return false;
  }
  if (!save()) {
    state = load();
    render();
    return false;
  }
  render();
  return true;
}

function el(tag, props = {}, ...enfants) {
  const n = Object.assign(document.createElement(tag), props);
  n.append(...enfants.filter((e) => e !== null && e !== undefined));
  return n;
}

const jjmm = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const jjmmaaaa = (d) => `${jjmm(d)}/${d.slice(0, 4)}`;

function toast(message) {
  const t = $('#toast');
  t.textContent = message;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, 2000);
}

// --- Navigation ---

function showTab(nom) {
  onglet = nom;
  for (const s of document.querySelectorAll('[data-tab]')) s.hidden = s.dataset.tab !== nom;
  for (const b of document.querySelectorAll('[data-go]')) {
    if (b.dataset.go === nom) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  }
  render();
  scrollTo(0, 0);
}

for (const b of document.querySelectorAll('[data-go]')) b.onclick = () => showTab(b.dataset.go);

function render() {
  if (onglet === 'recolter') renderRecolter();
  if (onglet === 'historique') renderHistorique();
  if (onglet === 'groupes') renderGroupes();
}

// --- Récolter ---

function renderRecolter() {
  const groupes = groupesActifs(state);
  $('#liste-recolter').replaceChildren(
    ...(groupes.length
      ? groupes.map((g) => el('button', { type: 'button', onclick: () => ouvrirRecolte({ groupeId: g.id }) },
        libelle(g), el('small', { textContent: `${g.nbPlants} plant${g.nbPlants > 1 ? 's' : ''}` })))
      : [el('p', { className: 'vide', textContent: 'Aucun groupe en cours. Créez-en un dans l\'onglet Groupes.' })]),
  );
}

const dlgRecolte = $('#dlg-recolte');

/** Ouvre la saisie : `{ groupeId }` pour une nouvelle récolte, une Recolte existante pour la modifier. */
function ouvrirRecolte(recolte) {
  const f = dlgRecolte.querySelector('form');
  const modif = Boolean(recolte.id);
  const groupe = state.groupes.find((g) => g.id === recolte.groupeId);
  f.reset();
  f.querySelector('.erreur').textContent = '';
  f.querySelector('.titre').textContent = modif ? 'Modifier la récolte' : libelle(groupe);
  for (const n of f.querySelectorAll('.si-modif')) n.hidden = !modif;
  f.groupeId.replaceChildren(...[...state.groupes]
    .sort((a, b) => libelle(a).localeCompare(libelle(b), 'fr'))
    .map((g) => el('option', { value: g.id, textContent: libelle(g) + (g.termine ? ' (terminé)' : '') })));
  f.groupeId.value = recolte.groupeId;
  f.pieces.value = recolte.pieces ?? '';
  f.date.value = recolte.date ?? today();
  f.note.value = recolte.note ?? '';

  f.onsubmit = (ev) => {
    ev.preventDefault();
    const champs = { groupeId: f.groupeId.value, pieces: f.pieces.value, date: f.date.value, note: f.note.value };
    if (agir(f, () => (modif ? updateRecolte(state, recolte.id, champs) : addRecolte(state, champs)))) {
      dlgRecolte.close();
      toast(modif ? '✓ Récolte modifiée' : `✓ ${champs.pieces} pièce${champs.pieces > 1 ? 's' : ''} enregistrée${champs.pieces > 1 ? 's' : ''}`);
    }
  };
  f.querySelector('[data-action=supprimer]').onclick = () => {
    if (confirm('Supprimer cette récolte ?') && agir(f, () => deleteRecolte(state, recolte.id))) dlgRecolte.close();
  };
  f.querySelector('[data-action=annuler]').onclick = () => dlgRecolte.close();
  dlgRecolte.showModal();
  if (!modif) f.pieces.focus();
}

// --- Historique ---

function renderHistorique() {
  const liste = annees(state);
  const zone = $('#historique');
  if (!liste.length) {
    zone.replaceChildren(el('p', { className: 'vide', textContent: 'Aucune récolte enregistrée.' }));
    return;
  }
  if (!liste.includes(anneeChoisie)) anneeChoisie = liste[0];

  const choix = el('select', { onchange: () => { anneeChoisie = Number(choix.value); renderHistorique(); } },
    ...liste.map((a) => el('option', { value: a, textContent: a })));
  choix.value = anneeChoisie;

  const entete = el('tr', {}, ...['Produit', 'Plants', 'Pièces', '/plant', '1ʳᵉ', 'Dern.'].map((t) => el('th', { textContent: t })));
  const lignes = bilan(state, anneeChoisie).map((b) => el('tr', {},
    ...[libelle(b.groupe), b.groupe.nbPlants, b.total, String(b.parPlant).replace('.', ','), jjmm(b.premiere), jjmm(b.derniere)]
      .map((t) => el('td', { textContent: t }))));

  const groupes = new Map(state.groupes.map((g) => [g.id, g]));
  const detail = recoltesDe(state, anneeChoisie).map((r) => el('li', {},
    el('button', { type: 'button', onclick: () => ouvrirRecolte(r) },
      `${jjmm(r.date)} — ${libelle(groupes.get(r.groupeId))} — ${r.pieces} pièce${r.pieces > 1 ? 's' : ''}`,
      r.note ? el('small', { textContent: r.note }) : null)));

  zone.replaceChildren(
    el('label', {}, 'Année', choix),
    el('h2', { textContent: 'Bilan' }),
    el('div', { className: 'tableau' }, el('table', {}, el('thead', {}, entete), el('tbody', {}, ...lignes))),
    el('h2', { textContent: 'Détail' }),
    el('ul', { className: 'liste' }, ...detail),
  );
}

// --- Groupes ---

function boutonGroupe(g) {
  return el('li', {}, el('button', { type: 'button', onclick: () => ouvrirGroupe(g) },
    libelle(g),
    el('small', { textContent: `${g.nbPlants} plant${g.nbPlants > 1 ? 's' : ''} · planté le ${jjmmaaaa(g.datePlantation)}${g.note ? ` · ${g.note}` : ''}` })));
}

function renderGroupes() {
  const tries = [...state.groupes].sort((a, b) => libelle(a).localeCompare(libelle(b), 'fr'));
  const actifs = tries.filter((g) => !g.termine);
  const termines = tries.filter((g) => g.termine);
  $('#groupes-actifs').replaceChildren(...(actifs.length
    ? actifs.map(boutonGroupe)
    : [el('li', { className: 'vide', textContent: 'Aucun groupe en cours.' })]));
  $('#groupes-termines').replaceChildren(...termines.map(boutonGroupe));
  $('#groupes-termines').parentElement.hidden = !termines.length;
}

const dlgGroupe = $('#dlg-groupe');

/** Ouvre le formulaire de groupe : sans argument pour en créer un, avec un Groupe pour le modifier. */
function ouvrirGroupe(groupe) {
  const f = dlgGroupe.querySelector('form');
  const modif = Boolean(groupe);
  f.reset();
  f.querySelector('.erreur').textContent = '';
  f.querySelector('.titre').textContent = modif ? 'Modifier le groupe' : 'Nouveau groupe';
  for (const n of f.querySelectorAll('.si-modif')) n.hidden = !modif;
  $('#produits').replaceChildren(...[...new Set(state.groupes.map((g) => g.produit))]
    .map((p) => el('option', { value: p })));
  f.produit.value = groupe?.produit ?? '';
  f.variete.value = groupe?.variete ?? '';
  f.nbPlants.value = groupe?.nbPlants ?? '';
  f.datePlantation.value = groupe?.datePlantation ?? today();
  f.note.value = groupe?.note ?? '';

  const terminer = f.querySelector('[data-action=terminer]');
  terminer.textContent = groupe?.termine ? 'Réactiver' : 'Terminer';
  terminer.onclick = () => {
    if (agir(f, () => updateGroupe(state, groupe.id, { termine: !groupe.termine }))) dlgGroupe.close();
  };
  f.querySelector('[data-action=supprimer]').onclick = () => {
    if (confirm(`Supprimer le groupe « ${libelle(groupe)} » ?`) && agir(f, () => deleteGroupe(state, groupe.id))) dlgGroupe.close();
  };
  f.querySelector('[data-action=annuler]').onclick = () => dlgGroupe.close();
  f.onsubmit = (ev) => {
    ev.preventDefault();
    const champs = {
      produit: f.produit.value, variete: f.variete.value, nbPlants: f.nbPlants.value,
      datePlantation: f.datePlantation.value, note: f.note.value,
    };
    if (agir(f, () => (modif ? updateGroupe(state, groupe.id, champs) : addGroupe(state, champs)))) dlgGroupe.close();
  };
  dlgGroupe.showModal();
}

$('#nouveau-groupe').onclick = () => ouvrirGroupe();

// --- Données ---

/** Partage le fichier (feuille de partage iOS, fiable en mode écran d'accueil), sinon téléchargement classique. */
async function download(nomFichier, contenu, type) {
  const fichier = new File([contenu], nomFichier, { type });
  if (navigator.canShare?.({ files: [fichier] })) {
    try {
      await navigator.share({ files: [fichier] });
    } catch (e) {
      if (e.name !== 'AbortError') alert(`Partage impossible : ${e.message}`);
    }
    return;
  }
  const a = el('a', { href: URL.createObjectURL(fichier), download: nomFichier });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

$('#sauvegarder').onclick = () => download(`marecolte-${today()}.json`, toBackup(state), 'application/json');
$('#exporter').onclick = () => download(`marecolte-${today()}.csv`, toCsv(state), 'text/csv;charset=utf-8');
$('#restaurer').onclick = () => $('#fichier').click();

$('#fichier').onchange = async (ev) => {
  const fichier = ev.target.files[0];
  ev.target.value = '';
  if (!fichier) return;
  let nouveau;
  try {
    nouveau = parseBackup(await fichier.text());
  } catch (e) {
    alert(e.message);
    return;
  }
  const n = (s) => `${s.groupes.length} groupes, ${s.recoltes.length} récoltes`;
  if (!confirm(`Remplacer toutes les données actuelles (${n(state)}) par celles du fichier (${n(nouveau)}) ?`)) return;
  saveDisabled = false;
  const ancien = state;
  state = nouveau;
  if (save()) {
    render();
    toast('✓ Données restaurées');
  } else {
    state = ancien;
  }
};

showTab('recolter');

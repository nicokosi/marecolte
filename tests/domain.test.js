import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyState, addGroupe, updateGroupe, deleteGroupe,
  addRecolte, updateRecolte, deleteRecolte,
} from '../domain.js';

const tomate = { produit: 'Tomate', nbPlants: 6, datePlantation: '2026-05-12' };

function avecGroupe() {
  const s = emptyState();
  const g = addGroupe(s, tomate);
  return { s, g };
}

test('addGroupe crée un groupe actif', () => {
  const s = emptyState();
  const g = addGroupe(s, { produit: ' Tomate ', variete: 'Cœur de bœuf', nbPlants: '6', datePlantation: '2026-05-12' });
  assert.equal(g.produit, 'Tomate');
  assert.equal(g.variete, 'Cœur de bœuf');
  assert.equal(g.nbPlants, 6);
  assert.equal(g.termine, false);
  assert.equal(g.note, '');
  assert.equal(s.groupes.length, 1);
});

test('addGroupe refuse un produit vide', () => {
  const s = emptyState();
  assert.throws(() => addGroupe(s, { ...tomate, produit: '  ' }), /produit est obligatoire/);
  assert.equal(s.groupes.length, 0);
});

test('addGroupe refuse nbPlants invalide', () => {
  for (const nbPlants of [0, -1, 1.5, '', 'abc']) {
    assert.throws(() => addGroupe(emptyState(), { ...tomate, nbPlants }), /entier positif/, String(nbPlants));
  }
});

test('addRecolte refuse des pièces invalides', () => {
  const { s, g } = avecGroupe();
  for (const pieces of [0, -3, 2.5, '', 'abc']) {
    assert.throws(() => addRecolte(s, { groupeId: g.id, date: '2026-07-01', pieces }),
      /pièces doit être un entier positif/, String(pieces));
  }
  assert.equal(s.recoltes.length, 0);
});

test('addRecolte refuse une date invalide', () => {
  const { s, g } = avecGroupe();
  for (const date of ['2026-02-30', '27/10/2026', '']) {
    assert.throws(() => addRecolte(s, { groupeId: g.id, date, pieces: 3 }), /Date invalide/, date);
  }
});

test('addRecolte refuse un groupe inconnu', () => {
  const { s } = avecGroupe();
  assert.throws(() => addRecolte(s, { groupeId: 'nope', date: '2026-07-01', pieces: 3 }), /Groupe inconnu/);
});

test('updateGroupe marque terminé', () => {
  const { s, g } = avecGroupe();
  const maj = updateGroupe(s, g.id, { termine: true });
  assert.equal(maj.termine, true);
  assert.equal(maj.produit, 'Tomate');
  assert.equal(maj.nbPlants, 6);
  assert.equal(s.groupes[0].termine, true);
});

test('updateRecolte valide les champs', () => {
  const { s, g } = avecGroupe();
  const r = addRecolte(s, { groupeId: g.id, date: '2026-07-01', pieces: '12', note: ' serre ' });
  assert.equal(r.pieces, 12);
  assert.equal(r.note, 'serre');
  assert.throws(() => updateRecolte(s, r.id, { pieces: 0 }), /entier positif/);
  assert.equal(s.recoltes[0].pieces, 12);
  assert.equal(updateRecolte(s, r.id, { pieces: 15 }).pieces, 15);
});

test('deleteGroupe refuse si récoltes', () => {
  const { s, g } = avecGroupe();
  const r = addRecolte(s, { groupeId: g.id, date: '2026-07-01', pieces: 3 });
  assert.throws(() => deleteGroupe(s, g.id), /a des récoltes/);
  deleteRecolte(s, r.id);
  deleteGroupe(s, g.id);
  assert.equal(s.groupes.length, 0);
  assert.equal(s.recoltes.length, 0);
});

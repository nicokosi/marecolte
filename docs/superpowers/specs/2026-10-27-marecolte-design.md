# Ma récolte : spécification v1

Application personnelle pour historiser les récoltes du potager, sur iPhone (iOS 18, Safari).

## Choix techniques

- PWA ajoutée à l'écran d'accueil via Safari (« Partager › Sur l'écran d'accueil »).
- HTML/CSS/JavaScript sans framework, sans npm, sans étape de build.
- Hébergement GitHub Pages, dépôt public. Le code est public, les données restent sur l'iPhone.
- Fonctionne hors ligne (service worker).
- Données stockées localement dans l'app. Supprimer l'icône efface les données : la sauvegarde manuelle est la seule protection.
- Interface uniquement en français.

## Données

**Groupe de plants** (saisi au printemps, ou à tout moment) :
produit, variété (facultative), nombre de plants, date de plantation, note (facultative), statut actif / terminé.

- Un groupe reste proposé à la récolte tant qu'il n'est pas marqué « terminé ».
  Un arbre ou des vivaces = un groupe jamais terminé.
- Un groupe peut être modifié.
- La suppression d'un groupe ayant des récoltes est refusée.

**Récolte** :
date (aujourd'hui par défaut, modifiable), groupe, nombre de pièces (seule unité), note (facultative).

- Modifiable ; supprimable après confirmation.
- Plusieurs récoltes le même jour pour un même groupe = saisies séparées.

## Écrans (3 onglets)

1. **Récolter** (accueil) : liste des groupes actifs ; un appui ouvre la saisie (pièces, date, note).
2. **Historique** : choix de l'année de récolte, puis
   - bilan par groupe : nombre de plants, total de pièces, pièces par plant, première et dernière récolte ;
   - liste détaillée des récoltes de l'année, pour modifier / supprimer.
   Une récolte compte dans l'année de **sa date de récolte**, pas dans celle de la plantation.
3. **Groupes** : création, modification, passage en terminé, suppression ; menu **Données** :
   - Sauvegarder : fichier JSON complet ;
   - Restaurer : depuis ce fichier JSON (remplace tout, après confirmation) ;
   - Exporter CSV : une ligne par récolte avec les infos du groupe, pour un tableur.

## Hors périmètre v1

Graphiques, photos, unités autres que la pièce, synchronisation / iCloud, partage, import CSV, emplacement structuré (va dans la note).

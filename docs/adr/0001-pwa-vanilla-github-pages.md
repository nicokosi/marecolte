# 1. Application web installable (PWA) en JavaScript sans build, hébergée sur GitHub Pages

- Statut : accepté
- Date : 2026-10-28

## Contexte

Application personnelle pour historiser les récoltes du potager sur un iPhone SE (2ᵉ génération) sous iOS 18.
Machines disponibles : un MacBook Pro personnel (macOS 15, Xcode) et un PC Ubuntu.

Contraintes exprimées :

- obtenir un outil qui marche, l'apprentissage du développement iOS n'est pas un objectif ;
- l'app ne doit pas cesser de fonctionner faute de réinstallation régulière ;
- aucun budget (pas d'abonnement annuel) ;
- aucun besoin de widgets, notifications, Siri ou synchronisation iCloud ;
- données sur l'iPhone uniquement, avec sauvegarde manuelle ;
- fonctionnement sans réseau au jardin.

## Décision

- **PWA** ajoutée à l'écran d'accueil depuis Safari.
- **HTML / CSS / JavaScript (modules ES) sans framework, sans npm, sans étape de build.**
  Node n'est utilisé que pour lancer les tests (`node --test`).
- **Hébergement GitHub Pages**, dépôt public. Seul le code est public, les données restent sur l'iPhone.
- **Stockage local** : un objet JSON dans `localStorage`.
- **Hors ligne** : service worker avec un cache versionné.
- **Sauvegarde** : fichier JSON exporté et restaurable, plus un export CSV pour tableur.

## Options écartées

| Option | Raison du rejet |
|---|---|
| App native SwiftUI + Apple ID gratuit | Signature valable 7 jours : l'app ne démarre plus sans réinstallation hebdomadaire depuis le Mac. Mac indispensable pour tout changement. |
| App native + Apple Developer Program | 99 €/an, injustifié pour un outil personnel sans publication. |
| App native re-signée par AltStore / SideStore | Installation plus complexe, dépend d'un outil tiers et du renouvellement automatique tous les 7 jours. |
| Framework web (React, Vue…) avec npm et bundler | Inutile pour 3 écrans. Ajoute une chaîne de build, des dépendances à maintenir et une étape entre le code et le site. |
| IndexedDB | API plus lourde ; le volume de données d'un potager (quelques milliers de récoltes au plus) tient largement dans `localStorage`. |
| Dépôt privé sur Cloudflare Pages / Netlify | Fonctionne, mais un compte de plus à gérer. Le code n'a rien de confidentiel. |
| Synchronisation (iCloud, serveur) | Non demandée ; nécessiterait un serveur ou un compte développeur payant. |
| Import CSV | Un CSV modifié dans un tableur peut casser le format. La restauration passe par le JSON, sans ambiguïté. |

## Conséquences

- Aucun Mac nécessaire : développement possible sur Ubuntu comme sur macOS.
- Une mise à jour se déploie par un simple `git push`. Il faut incrémenter `CACHE` dans `sw.js` à chaque déploiement, sinon l'iPhone garde l'ancienne version.
- **Supprimer l'icône de l'écran d'accueil efface les données.** La sauvegarde JSON manuelle est la seule protection.
- Les fonctions natives (widgets, Siri, iCloud) restent inaccessibles. Si elles deviennent nécessaires, il faudra réécrire l'app en natif ; la logique métier (`domain.js`) servira de spécification.

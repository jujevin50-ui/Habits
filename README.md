# Habits

Prototype de PWA personnelle pour les habitudes et les tâches, en français.

## Lancer localement

Avec Node.js installé :

```sh
npm run dev
```

Ouvrir http://127.0.0.1:5173.

## Vercel

Importer le dépôt GitHub dans Vercel. Choisir le preset « Other », sans commande de build, et le répertoire de sortie `public` (également déclaré dans `vercel.json`).

## État de cette version

Le code comprend la gestion locale des habitudes et des tâches, les grilles, les statistiques, les archives et l'export/import JSON. Les données sont enregistrées dans le navigateur ; aucune synchronisation cloud ni authentification n'est implémentée. Un dépôt privé ne rend pas automatiquement le site Vercel privé.

Cette version est un prototype, pas une version finale testée sur iPhone.

Les notifications ne sont pas opérationnelles : le client prévoit `/api/push`, mais le serveur et la planification restent à implémenter. Les dépendances web-push et Redis déclarées dans package.json sont prévues pour cette suite. Le script `check` référence aussi le futur fichier `api/push.js` encore absent.

Les icônes PNG référencées dans le manifeste restent à produire (le SVG source est fourni). Leur absence peut empêcher l'installation et la mise en cache hors ligne. L'installation PWA et le service worker doivent donc être finalisés avant utilisation quotidienne.

Il n'y a pas de widgets iOS natifs. Cette application est indépendante de HabitKit et ne constitue pas une reproduction complète de toutes ses fonctions.

Avant toute modification importante, exporter les données depuis les réglages de l'application.

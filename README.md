# Habits

Prototype de PWA personnelle pour les habitudes et les tâches, en français.

## Tâches

Deux vues : dossiers (avec sous-dossiers et balayage horizontal) et échéances (toutes les tâches triées, avec leur dossier indiqué). Les tâches sans date viennent en dernier ; les tâches terminées sont repliées. Le choix de vue et les dossiers sont conservés sur l’appareil et inclus dans les exports JSON. Les anciennes tâches apparaissent dans « Sans dossier ». Supprimer un dossier déplace ses tâches et ses sous-dossiers vers son parent, sans les supprimer.

## Rappels des tâches et historique des habitudes

Dans une tâche, renseigner le champ **Rappel** (date et heure), puis enregistrer. Effacer ce champ pour supprimer le rappel. Activer les notifications dans les réglages de chaque appareil destinataire. Le serveur utilise le même déclenchement `/api/cron` et les mêmes clés que les habitudes : aucun paramètre Vercel ni tâche cron supplémentaire à créer.

Pour les appareils associés, le planificateur lit les tâches partagées directement dans Redis. Créer, terminer ou supprimer une tâche sur le PC met donc à jour les rappels du téléphone sans devoir le laisser ouvert, une fois la modification synchronisée. Après cette mise à jour, ouvrir une fois l’app sur l’appareil destinataire pour actualiser son inscription. Sans association, les rappels sont ceux enregistrés depuis cet appareil. Les rappels sont enregistrés en UTC et affichés à l’heure locale. Une tâche terminée ou supprimée ne déclenche pas de nouvel envoi. Une tâche quotidienne recréée conserve son rappel, décalé au lendemain. Un retard du planificateur de moins de cinq minutes est rattrapé ; les appels multiples ne renvoient pas le même rappel. Toucher la notification ouvre les tâches.

Pour corriger une habitude à une date précise, toucher son nom ou une case de la grille, choisir **Jour**, modifier la valeur ou la note et enregistrer. Les autres journées restent inchangées. Le sélecteur accepte les dates à partir de 2000, y compris avant la création de l’habitude. Enregistrer une date antérieure étend le début de son historique, sans effacer les autres jours. Les dates futures peuvent aussi être renseignées depuis ce sélecteur. Modifier l’habitude elle-même reste une action distincte.

## Synchroniser les habitudes et tâches entre PC et téléphone

Les deux appareils doivent ouvrir le même domaine de production Vercel.

1. Sur le premier appareil : Réglages → Appareils → Associer un appareil.
2. Sur le second : Réglages → Appareils → Saisir un code, puis entrer le code affiché sur le premier.

Le code est utilisable une seule fois pendant dix minutes. L’association est conservée dans le navigateur : aucun mot de passe quotidien ni variable Vercel supplémentaire n’est nécessaire. La fonction `api/tasks.js` utilise les mêmes variables Upstash REST que les notifications. Les habitudes, leurs historiques et notes, les dossiers et les tâches sont stockés dans Redis pour cet espace associé. Les préférences d’affichage restent propres à chaque appareil. Les appareils déjà associés pour les tâches conservent leur liaison et transmettent aussi leurs habitudes après ouverture de cette version. Une copie locale avant cette migration est conservée dans `habits-before-full-sync`.

Les habitudes et tâches existantes des deux appareils sont réunies par identifiant. Pour une habitude déjà partagée, les dates présentes dans un seul historique sont conservées ; les valeurs distantes sont conservées pour les journées déjà présentes lors de la première association. Pour un identifiant déjà présent dans l’espace partagé, la version distante est conservée lors de la première association ; une copie des données locales avant association est conservée dans le navigateur (`habits-tasks-before-link`). Exporter une sauvegarde avant de relier des appareils ayant des copies divergentes d’une même tâche.

Les changements sont envoyés après enregistrement. L’app récupère les mises à jour à son ouverture, au retour de la connexion et toutes les quinze secondes lorsqu’elle est visible. Les modifications hors ligne sont conservées et envoyées ensuite. Les modifications de champs différents sont fusionnées ; les historiques des habitudes sont fusionnés par journée, pour préserver des corrections faites sur des dates différentes. Pour le même champ ou la même journée, le dernier envoi accepté l’emporte. Une tâche supprimée n’est pas recréée par la mise à jour d’un appareil resté hors ligne. Les exports JSON contiennent les habitudes, tâches et dossiers, pas l’identifiant secret d’association. « Dissocier cet appareil » garde sa copie locale et arrête ses échanges.

## Lancer localement

Avec Node.js installé :

```sh
npm run dev
```

Ouvrir http://127.0.0.1:5173.

## Vercel

Importer le dépôt GitHub dans Vercel. Choisir le preset « Other », sans commande de build, et le répertoire de sortie `public` (également déclaré dans `vercel.json`).

## État de cette version

Le code comprend la gestion locale des habitudes et des tâches, les grilles, les statistiques, les archives et l'export/import JSON. Les données restent disponibles dans le navigateur. Les tâches et dossiers peuvent aussi être synchronisés via Redis entre les appareils associés ; les habitudes et leurs historiques sont aussi synchronisés entre les appareils associés. Il n’y a pas de compte utilisateur. Un dépôt privé ne rend pas automatiquement le site Vercel privé.

Cette version est un prototype, pas une version finale testée sur iPhone.

Les notifications Web Push sont prises en charge par les fonctions Vercel `api/push.js` et `api/cron.js`. Leur activation demande les variables serveur et le planificateur décrits ci-dessous. Les icônes PNG sont fournies. La réception réelle sur iPhone reste à vérifier après configuration en production.

Il n'y a pas de widgets iOS natifs. Cette application est indépendante de HabitKit et ne constitue pas une reproduction complète de toutes ses fonctions.

Avant toute modification importante, exporter les données depuis les réglages de l'application.

## Configurer les notifications dans Vercel

Cette configuration est destinée à une application personnelle. Aucun code personnel n’est demandé : le navigateur utilise automatiquement son abonnement pour gérer ses propres rappels. Le site permet les inscriptions aux notifications à ses visiteurs (20 appareils maximum) ; ce n’est pas un système de comptes utilisateurs.

Installer les dépendances avec Node.js 24 et `npm ci`. Générer une paire VAPID avec `npm run vapid:generate` sur une machine de confiance. Conserver la même paire ensuite : changer les clés nécessite de réabonner les appareils. Ne pas partager ni committer les valeurs secrètes.

Dans Vercel → Settings → Environment Variables, ajouter pour **Production** :

| Variable | Valeur |
| --- | --- |
| `UPSTASH_REDIS_REST_URL` | URL REST de la base Upstash |
| `UPSTASH_REDIS_REST_TOKEN` | Jeton REST avec accès en écriture |
| `VAPID_PUBLIC_KEY` | `Public Key` de la commande de génération |
| `VAPID_PRIVATE_KEY` | `Private Key` de la même commande, à garder secrète |
| `VAPID_SUBJECT` | `mailto:` suivi de ton adresse de contact réelle |
| `CRON_SECRET` | Autre secret aléatoire d'au moins 32 caractères, réservé au planificateur |

Redéployer après modification des variables. `public` reste le répertoire de sortie ; Vercel déploie aussi les fonctions du dossier racine `api`. Le serveur local `npm run dev` sert uniquement les fichiers statiques, pas les fonctions Vercel.

### Déclencher les rappels chaque minute

Créer une tâche sur **cron-job.org** (ou un planificateur HTTPS équivalent) :

- URL : `https://TON-DOMAINE-VERCEL/api/cron`.
- Fréquence : toutes les minutes.
- Méthode : GET.
- En-tête HTTP personnalisé : `Authorization`, avec la valeur `Bearer ` suivie de ton `CRON_SECRET`.
- Garder l'URL et les secrets hors des dépôts et des captures publiques. Ne pas placer le secret dans l'URL.

Aucune tâche Vercel Cron n'est ajoutée automatiquement : le forfait Hobby limite les tâches à une exécution par jour, insuffisante pour les rappels à la minute. Le planificateur doit pouvoir joindre le site ; une protection d'accès Vercel peut bloquer ses appels.

L'endpoint répond avec les nombres `sent` et `failed`. Sans rappel dû, `{"sent":0,"failed":0}` est attendu. Les rappels utilisent l'heure locale et les jours de chaque appareil. Les appels en double sont filtrés ; les abonnements expirés sont supprimés. Le déclenchement doit avoir lieu pendant la minute prévue : aucun rattrapage n'est effectué après une interruption du planificateur. L'heure de réception dépend aussi du réseau et du système du téléphone.

### Activer et vérifier sur le téléphone

1. Sur iPhone (iOS 16.4 minimum), installer le site avec Safari → Partager → Sur l'écran d'accueil, puis ouvrir son icône.
2. Dans Réglages, cliquer sur Activer les notifications et accepter l’autorisation, sans saisir de code.
3. Cliquer sur Tester : une notification doit arriver sur cet appareil. Attendre 30 secondes entre deux tests.
4. Créer une habitude prévue aujourd'hui avec un rappel quelques minutes plus tard, puis vérifier l'exécution du planificateur et la réception avec l'application fermée.

Les modifications et les validations du jour se synchronisent lorsque l’application est ouverte et connectée, y compris après réouverture. Les rappels déjà synchronisés continuent côté serveur sans laisser l'application ouverte. Le planning de notifications utilise les noms, jours, heures et validations. Sur les appareils associés, les habitudes complètes, leurs notes et leurs historiques sont aussi enregistrés dans l’espace de synchronisation Redis. Chaque appareil a son propre planning de rappels d’habitudes. Le serveur consulte aussi les habitudes partagées pour tenir compte des validations et archives faites depuis un autre appareil. Désactiver supprime l'abonnement de l'appareil courant dans Redis. Maximum : 20 appareils.

## Vérifications de développement

`npm run check` contrôle la syntaxe. `npm test` exécute les tests du serveur avec Redis et l'envoi push simulés : accès, validation, fuseaux horaires, dédoublonnage, expiration, reprises et désactivation. Les tests de synchronisation couvrent aussi l’association, l’isolation des espaces, la fusion de modifications et les suppressions hors ligne avec Redis simulé. Ces tests ne remplacent pas un essai avec les identifiants réels en production.

La variable Vercel `APP_ACCESS_TOKEN` des anciennes versions n’est plus utilisée et peut être supprimée. `CRON_SECRET` reste nécessaire uniquement pour protéger le planificateur.

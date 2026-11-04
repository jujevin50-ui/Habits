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

Les modifications et les validations du jour se synchronisent lorsque l’application est ouverte et connectée, y compris après réouverture. Les rappels déjà synchronisés continuent côté serveur sans laisser l'application ouverte. Seuls les noms, jours, heures et dates de validation du jour sont transmis ; les notes et l'historique restent locaux. Chaque appareil a son propre planning ; les données ne sont pas synchronisées entre appareils. Désactiver supprime l'abonnement de l'appareil courant dans Redis. Maximum : 20 appareils.

## Vérifications de développement

`npm run check` contrôle la syntaxe. `npm test` exécute les tests du serveur avec Redis et l'envoi push simulés : accès, validation, fuseaux horaires, dédoublonnage, expiration, reprises et désactivation. Ces tests ne remplacent pas un essai avec les identifiants réels en production.

La variable Vercel `APP_ACCESS_TOKEN` des anciennes versions n’est plus utilisée et peut être supprimée. `CRON_SECRET` reste nécessaire uniquement pour protéger le planificateur.

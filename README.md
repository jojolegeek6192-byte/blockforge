# BlockForge — Boutique de ressources Roblox Studio

Site complet pour vendre/distribuer des ressources (`.rbxm` / `.rbxmx`) pour
Roblox Studio : authentification, achat (simulé pour l'instant), évaluations
en étoiles, téléchargement automatique, et un dashboard vendeur complet.

## Stack technique

- **Backend** : Node.js + Express
- **Base de données** : fichier JSON maison (`server/db/data.json`), aucune
  dépendance native — donc aucun problème de compilation lors d'un
  `npm install` sur n'importe quelle machine.
- **Frontend** : HTML / CSS / JavaScript vanilla (aucun framework, aucune
  étape de build). Animation 3D d'accueil avec [Three.js](https://threejs.org)
  (chargé depuis un CDN).
- **Auth** : email + mot de passe, sessions via JWT stocké dans un cookie
  `httpOnly`.

Aucun vrai moyen de paiement n'est branché pour l'instant : l'achat est
**simulé** (voir la section *Paiement* plus bas) pour que tu puisses tester
tout le parcours (achat → déverrouillage → téléchargement automatique) sans
avoir besoin de créer un compte Stripe ou autre dans l'immédiat.

## Installation

```bash
git clone <url-de-ton-repo>
cd roblox-assets-store
npm install
```

Copie ensuite le fichier d'exemple et remplis tes propres valeurs :

```bash
cp .env.example .env
```

Variables à renseigner dans `.env` :

| Variable | Description |
|---|---|
| `PORT` | Port d'écoute du serveur (3000 par défaut) |
| `JWT_SECRET` | Chaîne aléatoire longue, utilisée pour signer les sessions. Génère-la avec `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `OWNER_EMAIL` / `OWNER_PASSWORD` / `OWNER_NAME` | Identifiants du compte propriétaire (toi), créés par le script de seed |
| `NODE_ENV` | `development` en local, `production` en ligne (active le cookie sécurisé HTTPS) |

Crée ensuite ton compte propriétaire :

```bash
npm run seed
```

Puis démarre le serveur :

```bash
npm start
```

Le site est accessible sur `http://localhost:3000`. Connecte-toi avec les
identifiants `OWNER_EMAIL` / `OWNER_PASSWORD` que tu as choisis : un onglet
**Dashboard** apparaît alors dans le menu, réservé à ton compte.

## Fonctionnalités

- **Catalogue public** avec recherche, filtre gratuit/payant et tri.
- **Fiche ressource** avec description, prix, note moyenne, avis (étoiles
  1 à 5), et bouton d'achat ou de téléchargement selon le cas.
- **Téléchargement automatique** :
  - Ressource gratuite → bouton de téléchargement direct, sans compte requis.
  - Ressource payante → après l'achat (simulé), le téléchargement du fichier
    se déclenche automatiquement dans le navigateur.
- **Dashboard vendeur** (réservé au compte propriétaire) :
  - Statistiques globales (ventes, revenu, téléchargements, utilisateurs…)
  - Gestion des ressources : création, édition, suppression, upload de
    fichier `.rbxm`/`.rbxmx` + miniature optionnelle, publication/brouillon.
  - Historique des ventes.
  - Liste des utilisateurs inscrits.
- **Sécurité** : seul le compte marqué `isOwner` peut accéder aux routes de
  gestion (`/api/assets` en écriture, `/api/dashboard/*`). Le fichier d'une
  ressource payante n'est jamais accessible sans achat préalable vérifié
  côté serveur (le fichier `.rbxm` n'est jamais servi en statique).

## Paiement : état actuel et comment brancher Stripe plus tard

Pour l'instant, l'achat d'une ressource payante (`POST /api/purchases/:assetId`)
enregistre directement une vente "simulée" sans aucun encaissement réel — utile
pour démontrer/tester tout le parcours avant de te lancer dans une vraie
intégration de paiement.

Le code est volontairement organisé pour qu'on puisse y brancher Stripe (ou
un autre prestataire) sans tout réécrire :

1. Dans `server/routes/purchaseRoutes.js`, remplacer l'appel direct à
   `createPurchase(...)` par la création d'une session de paiement
   (`stripe.checkout.sessions.create`, par exemple).
2. Ajouter une route webhook qui, une fois le paiement confirmé par le
   prestataire, appelle `createPurchase(...)` (définie dans
   `server/db/models.js`) — c'est cette fonction qui déverrouille le
   téléchargement.
3. Aucune autre partie de l'app n'a besoin d'être modifiée : le reste du
   système (téléchargement protégé, dashboard, historique des ventes) repose
   déjà uniquement sur l'existence d'une ligne dans la table `purchases`.

## Structure du projet

```
roblox-assets-store/
├── server/
│   ├── index.js              # point d'entree du serveur
│   ├── db/
│   │   ├── jsonDatabase.js    # moteur de stockage JSON (lecture/ecriture fichier)
│   │   ├── models.js          # toutes les operations CRUD (users, assets, reviews, purchases)
│   │   ├── seed.js            # creation du compte proprietaire
│   │   └── data.json          # genere automatiquement, ignore par git
│   ├── middleware/auth.js     # JWT, cookies, requireAuth / requireOwner
│   ├── routes/                # routes Express (auth, assets, purchases, reviews, dashboard)
│   └── uploads/                # fichiers .rbxm/.rbxmx et miniatures (ignores par git)
└── public/
    ├── index.html             # page unique (SPA), templates HTML par "page"
    ├── css/style.css
    └── js/
        ├── api.js             # wrapper fetch
        ├── auth.js            # etat de session cote client
        ├── hero3d.js          # animation 3D Three.js de la page d'accueil
        ├── components.js      # rendu de composants (cartes, etoiles, toasts)
        ├── dashboard.js       # logique du dashboard vendeur
        ├── router.js          # routeur SPA base sur le hash de l'URL
        └── app.js             # definition des pages et initialisation
```

## Limites connues (à garder en tête)

- La base de données est un simple fichier JSON : parfaite pour démarrer et
  pour un usage à échelle raisonnable, mais pas pensée pour un trafic massif
  ou de la haute concurrence en écriture. Migrer vers une vraie base
  (PostgreSQL, SQLite avec un driver compatible, etc.) sera facile le jour où
  le besoin se présente, car toutes les requêtes passent par `models.js`.
- Le paiement est simulé (voir plus haut).
- Les fichiers `.rbxm`/`.rbxmx` sont stockés directement sur le disque du
  serveur. Si tu héberges sur une plateforme avec un système de fichiers
  éphémère (certains hébergeurs gratuits), pense à brancher un stockage
  externe (S3 ou équivalent) pour ne pas perdre les fichiers à chaque
  redéploiement.

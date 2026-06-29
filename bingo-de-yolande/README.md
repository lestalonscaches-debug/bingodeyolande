# Bingo de Yolande 🎉

Application de bingo en direct (75 numéros, style B-I-N-G-O) pensée pour
animer une grande salle : l'animateur tire les boules physiquement et
clique sur le numéro correspondant ; les participants suivent le tirage
en direct sur leur téléphone via un QR code, et peuvent annoncer
« BINGO ! » d'un tap.

100% open source, aucune dépendance à un service tiers payant. Un seul
petit serveur Node.js fait tout le travail.

## Fonctionnalités

- Panneau animateur protégé par un code d'accès, avec grille 1-75 cliquable.
- Écran public accessible sans code, synchronisé en temps réel (WebSocket).
- File d'annonces « BINGO ! » à valider ou rejeter, une à la fois.
- Célébration collective (son + confettis) sur tous les écrans publics
  à la validation d'un bingo.
- Sons 100% générés en code (Web Audio API), aucun fichier audio à charger.
- QR code généré automatiquement, pointant vers l'écran public.
- État de la partie sauvegardé sur disque (`state.json`) : un redémarrage
  du serveur ne perd pas la partie en cours.

## Installation

Il faut [Node.js](https://nodejs.org/) (version 18 ou plus récente).

```bash
npm install
npm start
```

Le serveur démarre sur `http://localhost:3000` par défaut.

- Panneau animateur : ouvrez `http://localhost:3000/` et cliquez sur
  « Je suis l'animateur », puis entrez le code (voir ci-dessous).
- Écran public : ouvrez `http://localhost:3000/?view=public`, ou scannez
  le QR code affiché dans le panneau animateur.

## Code d'accès animateur

Par défaut : `yolandemorue`

Pour le changer, définissez la variable d'environnement
`BINGO_ACCESS_CODE` **et** mettez à jour la constante `ACCESS_CODE` en
haut du fichier `public/app.js` (le code est vérifié à la fois côté
serveur pour la sécurité, et côté client pour l'affichage de l'écran
animateur) :

```bash
BINGO_ACCESS_CODE="votre-code" npm start
```

## Héberger pour un vrai évènement (accessible depuis les téléphones du public)

En local (`localhost`), seul votre propre ordinateur peut accéder à
l'application. Pour que 200 personnes puissent scanner le QR code avec
leur téléphone, il faut héberger le serveur sur une adresse accessible
depuis internet. Quelques options gratuites ou très peu chères :

- **[Render](https://render.com)** : connectez votre dépôt Git, Render
  détecte `npm start` automatiquement. Offre gratuite suffisante pour
  un usage ponctuel (le service peut s'endormir après inactivité,
  réveillez-le quelques minutes avant l'évènement).
- **[Railway](https://railway.app)** : similaire à Render, déploiement
  en quelques clics depuis un dépôt Git.
- **[Fly.io](https://fly.io)** : un peu plus technique, mais machines
  gratuites disponibles et bonnes performances.
- **Une machine que vous possédez déjà** (ordinateur portable connecté
  au Wi-Fi de la salle, Raspberry Pi, etc.) : dans ce cas, assurez-vous
  que les téléphones du public sont sur le **même réseau Wi-Fi**, et
  utilisez l'adresse IP locale de la machine (ex: `192.168.1.42:3000`)
  au lieu de `localhost`. Le QR code généré utilisera automatiquement
  l'adresse depuis laquelle la page animateur a été ouverte — pensez
  donc à ouvrir le panneau animateur via cette adresse IP, pas via
  `localhost`.

## Structure du projet

```
bingo-opensource/
├── server.js          # Serveur Node.js (Express + WebSocket)
├── package.json
├── public/
│   ├── index.html      # Les deux vues (animateur + public) dans une seule page
│   └── app.js           # Toute la logique front-end (sons, rendu, WebSocket)
└── state.json          # Généré automatiquement, contient la partie en cours
```

## Licence

MIT — libre de réutiliser, modifier, et redistribuer.

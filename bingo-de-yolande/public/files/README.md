# Vos photos personnalisées

Déposez vos images directement dans ce dossier (`public/images/`), sur
GitHub, en respectant **exactement ces noms de fichiers**. L'application
les détecte automatiquement — aucune modification de code nécessaire.

## Fichiers reconnus

| Nom du fichier              | Où il apparaît                                      | Format conseillé      |
|------------------------------|------------------------------------------------------|------------------------|
| `yolande.jpg`                | Photo ronde, en haut de chaque écran, près du titre  | Carrée, ex. 300×300px |
| `logo.png`                   | Logo, en haut de chaque écran, près du titre         | PNG avec fond transparent si possible |
| `fond.jpg`                   | Image de fond plein écran, derrière tout le contenu  | Grand format, ex. 1600×1200px ou plus |
| `celebration-1.jpg` à `celebration-10.jpg` | Photos tirées au hasard à chaque BINGO validé | Carrée ou portrait, ex. 600×600px |

Vous n'êtes pas obligé de fournir tous les fichiers. Ceux qui sont absents
sont simplement ignorés — l'application affiche le design par défaut à la
place, sans erreur ni image cassée.

Pour les photos de célébration, vous pouvez en mettre autant que vous
voulez de 1 à 10 (`celebration-1.jpg`, `celebration-2.jpg`, etc.) — pas
besoin d'utiliser les dix, juste continuez la numérotation à partir de 1
sans trou.

## Comment les ajouter sur GitHub

1. Allez dans le dossier `public/images/` de votre dépôt GitHub
2. Cliquez sur **"Add file"** → **"Upload files"**
3. Glissez-déposez vos photos (en les ayant renommées avec les noms
   exacts ci-dessus au préalable, sur votre ordinateur)
4. **Commit changes**
5. Sur Render : **Manual Deploy** → **Deploy latest commit**

## Conseil pour la lisibilité

L'image de fond (`fond.jpg`) s'affiche derrière un voile sombre semi-
transparent pour que le texte et les numéros restent lisibles par-dessus.
Si votre photo est déjà assez sombre ou très chargée visuellement, le
résultat sera plus net en choisissant une image avec des zones plus
unies ou plus sombres.

# Wearsense II — MVP sans connexion

Application locale de gestion de garde-robe, outfits et collections.

## Lancement

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
docker compose up -d
npm install
npm run install:all
npm run dev
```

Ouvrez l'URL indiquée par Vite, généralement `http://localhost:5173`.

L'application s'ouvre directement, sans compte ni authentification.

## Variables serveur

```env
PORT=5050
MONGODB_URI=mongodb://127.0.0.1:27017/wearsense
CLIENT_URL=http://localhost:5173
```

Si Vite démarre sur `5174`, remplacez `CLIENT_URL` par `http://localhost:5174`, puis relancez le serveur.

## Ajout d’images et détourage

Dans **Garde-robe → Ajouter** :

- glissez-déposez une image JPG, PNG ou WebP ;
- prévisualisez-la avant l’enregistrement ;
- cliquez sur **Détourer le fond** pour créer un PNG transparent directement dans le navigateur ;
- gardez l’originale, remplacez-la ou retirez-la avant validation.

Les images sont stockées localement dans `server/uploads` et ne sont pas envoyées vers un service externe. Le premier détourage télécharge le modèle nécessaire dans le navigateur.

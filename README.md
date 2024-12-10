# Générateur d'Histoires pour Enfants

## Guide de Déploiement sur Render.com

1. Créez un nouveau compte sur Render.com si ce n'est pas déjà fait
2. Connectez votre dépôt GitHub à Render
3. Créez un nouveau Web Service
4. Configurez le service :
   - Name: histoire-generator (ou le nom de votre choix)
   - Environment: Node
   - Build Command: `npm install`
   - Start Command: `node server.js`
   - Plan: Free

## Configuration des Variables d'Environnement

Dans les paramètres de votre service Render, ajoutez la variable d'environnement suivante :
- Key: `REPLICATE_API_TOKEN`
- Value: Votre token API Replicate

## Configuration du Frontend

Une fois le service déployé, mettez à jour l'URL de l'API dans le fichier `script.js` :
```javascript
const response = await fetch('https://votre-service-render.onrender.com/generate-story', {
```

## Obtenir votre Token Replicate

1. Connectez-vous à votre compte Replicate
2. Allez dans vos paramètres API
3. Copiez votre token API
4. Collez-le dans les variables d'environnement de Render

## Test Local

1. Installez les dépendances : `npm install`
2. Créez un fichier `.env` avec votre token Replicate
3. Démarrez le serveur : `node server.js`
4. Ouvrez `index.html` dans votre navigateur

## Notes Importantes

- Le modèle Llama-2 utilisé est optimisé pour la génération d'histoires pour enfants
- Les requêtes sont limitées selon votre plan Replicate
- Le déploiement initial peut prendre quelques minutes
- Les variables d'environnement doivent être configurées avant le déploiement

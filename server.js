require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fetch = require('node-fetch');

const app = express();

// Configuration CORS pour accepter toutes les origines
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'Origin']
}));

app.use(express.json());
app.use(express.static(__dirname));

// Route pour servir l'application
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Configuration Replicate
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
// Utilisation d'un modèle de test simple
const REPLICATE_MODEL_VERSION = "replicate/hello-world:5c7d5dc6dd8bf75c1acaa8565735e7986bc5b66206b55cca93cb72c9bf15ccaa";

async function generateWithReplicate(prompt) {
    try {
        console.log('Generating with Replicate...');
        console.log('Using token:', REPLICATE_API_TOKEN ? 'Token présent' : 'Token manquant');
        
        // Test simple de l'API Replicate
        const response = await fetch("https://api.replicate.com/v1/predictions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Token ${REPLICATE_API_TOKEN}`
            },
            body: JSON.stringify({
                version: REPLICATE_MODEL_VERSION,
                input: { text: prompt }
            })
        });

        const responseText = await response.text();
        console.log('Replicate API response:', responseText);

        if (!response.ok) {
            throw new Error(`Replicate API error: ${response.status} - ${responseText}`);
        }

        const prediction = JSON.parse(responseText);
        console.log('Prediction started:', prediction.id);
        let result = await waitForResult(prediction.id);
        
        // Générer une histoire simple en attendant que nous résolvions le problème d'accès aux modèles
        return `Histoire générée pour ${prompt}\n\nCeci est une histoire de test pendant que nous configurons l'accès à l'IA. Nous travaillons à résoudre le problème d'accès aux modèles plus avancés.`;
    } catch (error) {
        console.error('Error in generateWithReplicate:', error);
        throw error;
    }
}

async function waitForResult(predictionId) {
    console.log('Waiting for result...');
    while (true) {
        try {
            const response = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
                headers: {
                    "Authorization": `Token ${REPLICATE_API_TOKEN}`
                }
            });

            const responseText = await response.text();
            console.log('Check status response:', responseText);

            if (!response.ok) {
                throw new Error(`Error checking prediction status: ${response.status} - ${responseText}`);
            }

            const prediction = JSON.parse(responseText);
            console.log('Prediction status:', prediction.status);
            
            if (prediction.status === "succeeded") {
                return prediction;
            } else if (prediction.status === "failed") {
                throw new Error("La génération a échoué");
            }

            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
            console.error('Error in waitForResult:', error);
            throw error;
        }
    }
}

// Route de test pour vérifier le token
app.get('/test-token', async (req, res) => {
    try {
        const response = await fetch("https://api.replicate.com/v1/models", {
            headers: {
                "Authorization": `Token ${REPLICATE_API_TOKEN}`
            }
        });
        const data = await response.json();
        res.json({ status: 'success', data });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.post('/generate-story', async (req, res) => {
    try {
        console.log('Received request for story generation');
        console.log('Request body:', req.body);
        
        const { headline, subheadline, mainText, style } = req.body;

        if (!headline || !subheadline || !mainText || !style) {
            throw new Error('Données manquantes dans la requête');
        }

        const prompt = `${mainText} - Style: ${style}`;

        console.log('Generating story with prompt:', prompt);
        const story = await generateWithReplicate(prompt);
        console.log('Story generated successfully:', story);
        res.json({ story: story });
    } catch (error) {
        console.error('Error in generate-story endpoint:', error);
        res.status(500).json({ 
            error: 'Erreur lors de la génération de l\'histoire',
            details: error.message
        });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
    console.log(`Environnement: ${process.env.NODE_ENV}`);
    console.log(`Token Replicate configuré: ${REPLICATE_API_TOKEN ? 'Oui' : 'Non'}`);
});

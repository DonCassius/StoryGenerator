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
// Utilisation d'un modèle français plus accessible
const REPLICATE_MODEL_VERSION = "mistralai/mistral-7b-instruct-v0.1:83b6a56e7c828e667f21fd596c338fd4f0039b46bcfa18d973e8e70e455fda70";

async function generateWithReplicate(prompt) {
    try {
        console.log('Generating with Replicate...');
        console.log('Using token:', REPLICATE_API_TOKEN ? 'Token présent' : 'Token manquant');
        
        const response = await fetch("https://api.replicate.com/v1/predictions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Token ${REPLICATE_API_TOKEN}`
            },
            body: JSON.stringify({
                version: REPLICATE_MODEL_VERSION,
                input: {
                    prompt: `[INST]${prompt}[/INST]`,
                    temperature: 0.7,
                    top_p: 0.9,
                    max_new_tokens: 500,
                    presence_penalty: 1
                }
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
        return result.output;
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

app.post('/generate-story', async (req, res) => {
    try {
        console.log('Received request for story generation');
        console.log('Request body:', req.body);
        
        const { headline, subheadline, mainText, style } = req.body;

        if (!headline || !subheadline || !mainText || !style) {
            throw new Error('Données manquantes dans la requête');
        }

        const prompt = `Tu es un auteur spécialisé dans les histoires pour enfants. 
        Crée une histoire courte et captivante dans le style ${style} avec ces éléments:

        Titre: ${headline}
        Sous-titre: ${subheadline}
        Informations sur l'enfant: ${mainText}

        Instructions:
        - L'histoire doit être en français
        - Elle doit être adaptée aux enfants
        - Le style doit être ${style}
        - L'enfant doit être le héros de l'histoire
        - Utilise les informations fournies pour personnaliser l'histoire
        - L'histoire doit être positive et engageante
        - Longueur: environ 4-5 phrases

        Génère uniquement l'histoire, sans autre commentaire.`;

        console.log('Generating story with prompt:', prompt);
        const story = await generateWithReplicate(prompt);
        console.log('Story generated successfully:', story);
        res.json({ story: Array.isArray(story) ? story.join('') : story });
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

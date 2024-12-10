require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fetch = require('node-fetch');

const app = express();

// Configuration CORS plus permissive pour le développement
app.use(cors({
    origin: '*', // Permet toutes les origines
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.static(__dirname));

// Route pour servir l'application
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Configuration Replicate
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
const REPLICATE_MODEL_VERSION = "meta/llama-2-70b-chat:02e509c789964a7ea8736978a43525956ef40397be9033abf9fd2badfe68c9e3";

async function generateWithReplicate(prompt) {
    console.log('Generating with Replicate...');
    const response = await fetch("https://api.replicate.com/v1/predictions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Token ${REPLICATE_API_TOKEN}`
        },
        body: JSON.stringify({
            version: REPLICATE_MODEL_VERSION,
            input: {
                prompt: prompt,
                max_tokens: 500,
                temperature: 0.7,
                top_p: 0.9,
                system_prompt: "Tu es un auteur spécialisé dans les histoires pour enfants, expert en création d'histoires personnalisées, captivantes et adaptées à leur âge."
            }
        })
    });

    if (!response.ok) {
        console.error('Replicate API error:', await response.text());
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const prediction = await response.json();
    console.log('Prediction started:', prediction.id);
    let result = await waitForResult(prediction.id);
    return result.output;
}

async function waitForResult(predictionId) {
    console.log('Waiting for result...');
    while (true) {
        const response = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
            headers: {
                "Authorization": `Token ${REPLICATE_API_TOKEN}`
            }
        });

        if (!response.ok) {
            console.error('Error checking prediction status:', await response.text());
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const prediction = await response.json();
        console.log('Prediction status:', prediction.status);
        
        if (prediction.status === "succeeded") {
            return prediction;
        } else if (prediction.status === "failed") {
            throw new Error("La génération a échoué");
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}

app.post('/generate-story', async (req, res) => {
    try {
        console.log('Received request for story generation');
        const { headline, subheadline, mainText, style } = req.body;

        const prompt = `Crée une histoire courte et captivante dans le style ${style} avec ces éléments:

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

        Histoire:`;

        console.log('Generating story with prompt:', prompt);
        const story = await generateWithReplicate(prompt);
        console.log('Story generated successfully');
        res.json({ story: story.join('') });
    } catch (error) {
        console.error('Error generating story:', error);
        res.status(500).json({ error: 'Erreur lors de la génération de l\'histoire' });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
    console.log(`Environnement: ${process.env.NODE_ENV}`);
    console.log(`Token Replicate configuré: ${REPLICATE_API_TOKEN ? 'Oui' : 'Non'}`);
});

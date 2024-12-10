require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fetch = require('node-fetch');

const app = express();

// Configuration CORS
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'Origin']
}));

app.use(express.json());
app.use(express.static(__dirname));

// Configuration Hugging Face
const HUGGINGFACE_API_TOKEN = process.env.HUGGINGFACE_API_TOKEN;
const MODEL_URL = "https://api-inference.huggingface.co/models/bigscience/bloom";

async function generateStory(prompt) {
    try {
        console.log('Generating story with Hugging Face...');
        const response = await fetch(MODEL_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${HUGGINGFACE_API_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                inputs: prompt,
                parameters: {
                    max_length: 500,
                    temperature: 0.7,
                    top_p: 0.9,
                    do_sample: true,
                    return_full_text: false
                }
            })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Hugging Face API error: ${response.status} - ${error}`);
        }

        const result = await response.json();
        console.log('Generation result:', result);

        // Extraire uniquement l'histoire générée
        const fullText = result[0].generated_text;
        const storyStart = fullText.indexOf('Histoire:');
        if (storyStart !== -1) {
            return fullText.substring(storyStart + 9).trim();
        }
        return fullText.trim();
    } catch (error) {
        console.error('Error in generateStory:', error);
        throw error;
    }
}

// Route pour servir l'application
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/generate-story', async (req, res) => {
    try {
        console.log('Received request for story generation');
        console.log('Request body:', req.body);
        
        const { headline, subheadline, mainText, style } = req.body;

        if (!headline || !subheadline || !mainText || !style) {
            throw new Error('Données manquantes dans la requête');
        }

        const prompt = `Génère une histoire courte pour enfant avec ces éléments:

        Titre: ${headline}
        Sous-titre: ${subheadline}
        Informations sur l'enfant: ${mainText}
        Style: ${style}

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
        const story = await generateStory(prompt);
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
    console.log(`Token Hugging Face configuré: ${HUGGINGFACE_API_TOKEN ? 'Oui' : 'Non'}`);
});

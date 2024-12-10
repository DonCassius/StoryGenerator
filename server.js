require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fetch = require('node-fetch');

const app = express();

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'Origin']
}));

app.use(express.json());
app.use(express.static(__dirname));

const HUGGINGFACE_API_TOKEN = process.env.HUGGINGFACE_API_TOKEN;
const MODEL_URL = "https://api-inference.huggingface.co/models/bigscience/bloom";

async function generateStoryPart(prompt, isChoice = false) {
    try {
        console.log('Generating story part...');
        const response = await fetch(MODEL_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${HUGGINGFACE_API_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                inputs: prompt,
                parameters: {
                    max_length: isChoice ? 200 : 1000,
                    temperature: 0.8,
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
        return result[0].generated_text.trim();
    } catch (error) {
        console.error('Error in generateStoryPart:', error);
        throw error;
    }
}

async function generateFullStory(mainInfo) {
    // Générer l'introduction
    const introPrompt = `Écris une introduction captivante pour une histoire interactive pour enfant.
    Informations sur l'enfant: ${mainInfo}
    L'histoire doit être en français, positive et adaptée aux enfants.
    Écris environ 500 mots pour planter le décor et présenter la situation initiale.
    Ne propose pas encore de choix.`;

    const intro = await generateStoryPart(introPrompt);

    // Générer les premiers choix
    const choicesPrompt = `En te basant sur cette introduction:
    "${intro}"
    Propose 3 choix différents pour la suite de l'histoire.
    Chaque choix doit être une phrase courte et intrigante.
    Format: 
    1) Premier choix
    2) Deuxième choix
    3) Troisième choix`;

    const choices = await generateStoryPart(choicesPrompt, true);

    return {
        currentPart: intro,
        choices: choices.split('\n').filter(choice => choice.trim().match(/^\d\)/)),
        history: [intro]
    };
}

async function generateNextPart(previousPart, choiceMade) {
    const prompt = `Continue cette partie de l'histoire:
    "${previousPart}"
    
    L'enfant a choisi: "${choiceMade}"
    
    Génère la suite de l'histoire (environ 500 mots) puis propose 3 nouveaux choix.
    L'histoire doit rester cohérente et adaptée aux enfants.
    Termine par:
    
    Que décides-tu ?
    1) Premier choix
    2) Deuxième choix
    3) Troisième choix`;

    const nextPart = await generateStoryPart(prompt);
    const parts = nextPart.split('Que décides-tu ?');
    
    return {
        story: parts[0].trim(),
        choices: parts[1] ? parts[1].split('\n').filter(choice => choice.trim().match(/^\d\)/)) : []
    };
}

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/generate-story', async (req, res) => {
    try {
        const { headline, subheadline, mainText, style } = req.body;

        if (!headline || !subheadline || !mainText || !style) {
            throw new Error('Données manquantes dans la requête');
        }

        const story = await generateFullStory(mainText);
        res.json(story);
    } catch (error) {
        console.error('Error in generate-story endpoint:', error);
        res.status(500).json({ 
            error: 'Erreur lors de la génération de l\'histoire',
            details: error.message
        });
    }
});

app.post('/continue-story', async (req, res) => {
    try {
        const { previousPart, choiceMade } = req.body;

        if (!previousPart || !choiceMade) {
            throw new Error('Données manquantes pour continuer l\'histoire');
        }

        const nextPart = await generateNextPart(previousPart, choiceMade);
        res.json(nextPart);
    } catch (error) {
        console.error('Error in continue-story endpoint:', error);
        res.status(500).json({ 
            error: 'Erreur lors de la génération de la suite de l\'histoire',
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

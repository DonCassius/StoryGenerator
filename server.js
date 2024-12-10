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

async function generateStoryPart(prompt) {
    try {
        const response = await fetch(MODEL_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${HUGGINGFACE_API_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                inputs: prompt,
                parameters: {
                    max_length: 2000,
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

async function generateCompleteStory(mainInfo, style) {
    // Générer l'introduction
    const introPrompt = `Écris l'introduction d'une histoire interactive pour enfant.
    Informations sur l'enfant: ${mainInfo}
    Style: ${style}
    
    Format attendu:
    Introduction
    [Un paragraphe qui présente l'enfant et le contexte de l'histoire]

    1. Le début de l'aventure
    [Un paragraphe qui décrit la situation initiale et présente un premier choix]

    Que fais-tu ?
    Option A : [Premier choix possible]
    Option B : [Deuxième choix possible]`;

    const intro = await generateStoryPart(introPrompt);

    // Générer les suites pour chaque choix
    const choixAPrompt = `Continue l'histoire après le choix A.
    Contexte: ${mainInfo}
    Style: ${style}
    
    Format attendu:
    2A. [Titre de la suite]
    [Un paragraphe qui décrit ce qui se passe après avoir choisi l'option A]
    
    Un nouveau choix se présente :
    Option A1 : [Premier nouveau choix]
    Option A2 : [Deuxième nouveau choix]`;

    const choixA = await generateStoryPart(choixAPrompt);

    const choixBPrompt = `Continue l'histoire après le choix B.
    Contexte: ${mainInfo}
    Style: ${style}
    
    Format attendu:
    2B. [Titre de la suite]
    [Un paragraphe qui décrit ce qui se passe après avoir choisi l'option B]
    
    Un nouveau choix se présente :
    Option B1 : [Premier nouveau choix]
    Option B2 : [Deuxième nouveau choix]`;

    const choixB = await generateStoryPart(choixBPrompt);

    // Générer les fins
    const finsPrompts = [
        `3A1. [Titre de la fin]
        [Un paragraphe qui conclut l'histoire après avoir choisi l'option A1]
        
        Fin : [Une conclusion positive]`,
        
        `3A2. [Titre de la fin]
        [Un paragraphe qui conclut l'histoire après avoir choisi l'option A2]
        
        Fin : [Une conclusion positive]`,
        
        `3B1. [Titre de la fin]
        [Un paragraphe qui conclut l'histoire après avoir choisi l'option B1]
        
        Fin : [Une conclusion positive]`,
        
        `3B2. [Titre de la fin]
        [Un paragraphe qui conclut l'histoire après avoir choisi l'option B2]
        
        Fin : [Une conclusion positive]`
    ];

    const fins = await Promise.all(finsPrompts.map(prompt => 
        generateStoryPart(`Continue l'histoire.
        Contexte: ${mainInfo}
        Style: ${style}
        
        ${prompt}`)
    ));

    // Assembler l'histoire complète
    return `${intro}\n\n${choixA}\n\n${choixB}\n\n${fins.join('\n\n')}`;
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

        const story = await generateCompleteStory(mainText, style);
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

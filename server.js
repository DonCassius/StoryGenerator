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
// Utilisation de l'endpoint d'inférence
const MODEL_URL = "https://api-inference.huggingface.co/pipeline/text-generation/bigscience/bloomz-1b7";

async function generateStoryPart(prompt) {
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
                    max_new_tokens: 500,
                    temperature: 0.9,
                    top_p: 0.95,
                    do_sample: true,
                    return_full_text: false,
                    stop: ["###"]
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
    try {
        // Générer l'introduction
        const introPrompt = `Tu es un auteur de livres pour enfants. Écris une histoire interactive.

        Informations sur l'enfant : ${mainInfo}
        Style de l'histoire : ${style}

        Écris une introduction qui présente le personnage (3-4 phrases maximum).
        ###`;

        const intro = await generateStoryPart(introPrompt);

        // Générer la première page
        const page1Prompt = `Continue cette histoire :
        "${intro}"

        Décris la première situation et propose deux choix.
        Termine par :
        
        Que décides-tu ?
        - Option A : [choix 1]
        - Option B : [choix 2]
        ###`;

        const page1 = await generateStoryPart(page1Prompt);

        // Générer les suites
        const page2APrompt = `Voici la suite après le choix A.
        Décris ce qui se passe et propose deux nouveaux choix.
        Termine par :
        
        Que fais-tu ?
        - Option A1 : [choix 1]
        - Option A2 : [choix 2]
        ###`;

        const page2A = await generateStoryPart(page2APrompt);

        const page2BPrompt = `Voici la suite après le choix B.
        Décris ce qui se passe et propose deux nouveaux choix.
        Termine par :
        
        Que fais-tu ?
        - Option B1 : [choix 1]
        - Option B2 : [choix 2]
        ###`;

        const page2B = await generateStoryPart(page2BPrompt);

        // Générer les fins
        const endings = await Promise.all([
            generateStoryPart(`Écris la fin de l'histoire après le choix A1.
            Une fin positive et satisfaisante.
            Termine par "FIN"
            ###`),
            generateStoryPart(`Écris la fin de l'histoire après le choix A2.
            Une fin positive et satisfaisante.
            Termine par "FIN"
            ###`),
            generateStoryPart(`Écris la fin de l'histoire après le choix B1.
            Une fin positive et satisfaisante.
            Termine par "FIN"
            ###`),
            generateStoryPart(`Écris la fin de l'histoire après le choix B2.
            Une fin positive et satisfaisante.
            Termine par "FIN"
            ###`)
        ]);

        // Assembler l'histoire
        return `Introduction\n${intro}\n\nPage 1\n${page1}\n\nPage 2A\n${page2A}\n\nPage 2B\n${page2B}\n\nPage 3A1\n${endings[0]}\n\nPage 3A2\n${endings[1]}\n\nPage 3B1\n${endings[2]}\n\nPage 3B2\n${endings[3]}`;
    } catch (error) {
        console.error('Error generating story:', error);
        throw error;
    }
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

        console.log('Generating story with:', { mainText, style });
        const story = await generateCompleteStory(mainText, style);
        console.log('Story generated successfully');
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

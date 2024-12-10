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

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

async function generateStoryPart(prompt) {
    try {
        console.log('Generating story part...');
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-2',
                max_tokens: 1000,
                messages: [{
                    role: 'user',
                    content: prompt
                }],
                temperature: 0.9
            })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Anthropic API error: ${response.status} - ${error}`);
        }

        const result = await response.json();
        return result.content[0].text.trim();
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
        L'histoire doit être en français, positive et adaptée aux enfants.`;

        const intro = await generateStoryPart(introPrompt);

        // Générer la première page
        const page1Prompt = `Continue cette histoire :
        "${intro}"

        Décris la première situation et propose deux choix.
        Termine par :
        
        Que décides-tu ?
        - Option A : [premier choix]
        - Option B : [deuxième choix]`;

        const page1 = await generateStoryPart(page1Prompt);

        // Générer les suites
        const page2APrompt = `Voici la suite après le choix A.
        Décris ce qui se passe et propose deux nouveaux choix.
        Termine par :
        
        Que fais-tu ?
        - Option A1 : [premier choix]
        - Option A2 : [deuxième choix]`;

        const page2A = await generateStoryPart(page2APrompt);

        const page2BPrompt = `Voici la suite après le choix B.
        Décris ce qui se passe et propose deux nouveaux choix.
        Termine par :
        
        Que fais-tu ?
        - Option B1 : [premier choix]
        - Option B2 : [deuxième choix]`;

        const page2B = await generateStoryPart(page2BPrompt);

        // Générer les fins
        const endings = await Promise.all([
            generateStoryPart(`Écris la fin de l'histoire après le choix A1.
            Une fin positive et satisfaisante.
            Termine par "FIN"`),
            generateStoryPart(`Écris la fin de l'histoire après le choix A2.
            Une fin positive et satisfaisante.
            Termine par "FIN"`),
            generateStoryPart(`Écris la fin de l'histoire après le choix B1.
            Une fin positive et satisfaisante.
            Termine par "FIN"`),
            generateStoryPart(`Écris la fin de l'histoire après le choix B2.
            Une fin positive et satisfaisante.
            Termine par "FIN"`)
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
    console.log(`Anthropic API Key configurée: ${ANTHROPIC_API_KEY ? 'Oui' : 'Non'}`);
});

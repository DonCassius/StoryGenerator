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

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function generateStoryPartWithRetry(systemPrompt, userPrompt, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            console.log(`Attempt ${i + 1} of ${maxRetries}`);
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01',
                    'Authorization': `Bearer ${ANTHROPIC_API_KEY}`  // Correction du format de l'en-tête d'authentification
                },
                body: JSON.stringify({
                    model: 'claude-2.1',
                    max_tokens: 500,
                    system: systemPrompt,
                    messages: [
                        {
                            role: 'user',
                            content: userPrompt
                        }
                    ],
                    temperature: 0.7
                })
            });

            if (response.status === 529) {
                console.log('Service overloaded, retrying after delay...');
                await sleep(2000 * (i + 1));
                continue;
            }

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Anthropic API error: ${response.status} - ${error}`);
            }

            const result = await response.json();
            return result.content[0].text.trim();
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            console.log(`Attempt failed, retrying... Error: ${error.message}`);
            await sleep(2000 * (i + 1));
        }
    }
}

function extractChoices(text, pattern) {
    try {
        const match = text.match(pattern);
        if (match && match.length >= 3) {
            return [match[1].trim(), match[2].trim()];
        }
        return ['continuer l\'aventure', 'prendre une autre direction'];
    } catch (error) {
        console.error('Error extracting choices:', error);
        return ['continuer l\'aventure', 'prendre une autre direction'];
    }
}

async function generateCompleteStory(mainInfo, style) {
    try {
        // Extraire le nom et les activités
        const nameMatch = mainInfo.match(/(\w+)/);
        const name = nameMatch ? nameMatch[1] : 'l\'enfant';

        const systemPrompt = `Tu es un auteur de livres pour enfants qui crée des histoires interactives en français.
        - Utilise toujours le prénom ${name} comme personnage principal
        - Reste cohérent avec les informations fournies sur l'enfant
        - Adapte le style et le ton pour les enfants
        - Ne répète pas les instructions dans la sortie
        - Écris directement l'histoire sans métacommentaires`;

        // Générer l'introduction
        const introPrompt = `Écris une introduction courte (3 phrases maximum) pour une histoire ${style}.
        Informations sur l'enfant : ${mainInfo}
        L'histoire doit parler de ${name} et inclure ses activités préférées.`;

        const intro = await generateStoryPartWithRetry(systemPrompt, introPrompt);
        if (!intro) throw new Error('Failed to generate introduction');
        await sleep(1000);

        // Générer la première page
        const page1Prompt = `Continue cette histoire :
        "${intro}"
        
        Décris la première situation (2-3 phrases) impliquant ${name} puis propose deux choix.
        Termine exactement comme ceci :
        
        Que décides-tu ?
        Option A : [premier choix pour ${name}]
        Option B : [deuxième choix pour ${name}]`;

        const page1 = await generateStoryPartWithRetry(systemPrompt, page1Prompt);
        if (!page1) throw new Error('Failed to generate page 1');
        await sleep(1000);

        // Extraire les choix de la page 1
        const [choiceA, choiceB] = extractChoices(page1, /Option A : (.*)\nOption B : (.*)/s);

        // Générer les suites
        const page2APrompt = `${name} a choisi : ${choiceA}
        
        Continue l'histoire (2-3 phrases) puis propose deux nouveaux choix.
        Termine exactement comme ceci :
        
        Que fais-tu ?
        Option A1 : [premier choix pour ${name}]
        Option A2 : [deuxième choix pour ${name}]`;

        const page2A = await generateStoryPartWithRetry(systemPrompt, page2APrompt);
        if (!page2A) throw new Error('Failed to generate page 2A');
        await sleep(1000);

        const page2BPrompt = `${name} a choisi : ${choiceB}
        
        Continue l'histoire (2-3 phrases) puis propose deux nouveaux choix.
        Termine exactement comme ceci :
        
        Que fais-tu ?
        Option B1 : [premier choix pour ${name}]
        Option B2 : [deuxième choix pour ${name}]`;

        const page2B = await generateStoryPartWithRetry(systemPrompt, page2BPrompt);
        if (!page2B) throw new Error('Failed to generate page 2B');
        await sleep(1000);

        // Extraire les choix finaux
        const [choiceA1, choiceA2] = extractChoices(page2A, /Option A1 : (.*)\nOption A2 : (.*)/s);
        const [choiceB1, choiceB2] = extractChoices(page2B, /Option B1 : (.*)\nOption B2 : (.*)/s);

        // Générer les fins
        const endingPrompts = [
            `${name} a choisi : ${choiceA1}
            Écris une fin positive (2-3 phrases) qui conclut bien l'histoire.
            Termine par "FIN"`,

            `${name} a choisi : ${choiceA2}
            Écris une fin positive (2-3 phrases) qui conclut bien l'histoire.
            Termine par "FIN"`,

            `${name} a choisi : ${choiceB1}
            Écris une fin positive (2-3 phrases) qui conclut bien l'histoire.
            Termine par "FIN"`,

            `${name} a choisi : ${choiceB2}
            Écris une fin positive (2-3 phrases) qui conclut bien l'histoire.
            Termine par "FIN"`
        ];

        const endings = [];
        for (const prompt of endingPrompts) {
            const ending = await generateStoryPartWithRetry(systemPrompt, prompt);
            if (!ending) throw new Error('Failed to generate ending');
            endings.push(ending);
            await sleep(1000);
        }

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

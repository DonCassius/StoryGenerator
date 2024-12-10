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
                    'x-api-key': ANTHROPIC_API_KEY,
                    'anthropic-version': '2023-06-01'
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

async function generateCompleteStory(mainInfo, style) {
    try {
        const baseContext = {
            childInfo: mainInfo,
            style: style,
            story: {}
        };

        const systemPrompt = `Tu es un auteur de livres pour enfants qui crée des histoires interactives en français.
        - Écris directement le contenu sans phrases d'introduction
        - Reste cohérent avec l'histoire en cours
        - Adapte le style et le ton pour les enfants
        - Ne répète pas les instructions dans la sortie`;

        // Générer l'introduction
        const introPrompt = `Écris l'introduction d'une histoire ${style} pour un enfant.
        Informations : ${mainInfo}
        Maximum 3 phrases.`;

        baseContext.story.intro = await generateStoryPartWithRetry(systemPrompt, introPrompt);
        await sleep(1000);

        // Générer la première page
        const page1Prompt = `Contexte : ${baseContext.story.intro}
        
        Continue l'histoire avec la première situation.
        Termine par deux choix clairs.
        Format exact :
        [texte de la situation]
        
        Que décides-tu ?
        Option A : [choix 1]
        Option B : [choix 2]`;

        baseContext.story.page1 = await generateStoryPartWithRetry(systemPrompt, page1Prompt);
        await sleep(1000);

        // Extraire les choix de la page 1
        const choicesMatch = baseContext.story.page1.match(/Option A : (.*)\nOption B : (.*)/s);
        const [choiceA, choiceB] = choicesMatch ? [choicesMatch[1], choicesMatch[2]] : ['', ''];

        // Générer les suites
        const page2APrompt = `Histoire jusqu'ici :
        ${baseContext.story.intro}
        ${baseContext.story.page1}
        
        Le personnage choisit : ${choiceA}
        Continue l'histoire et propose deux nouveaux choix.
        Format exact :
        [texte de la suite]
        
        Que fais-tu ?
        Option A1 : [choix 1]
        Option A2 : [choix 2]`;

        baseContext.story.page2A = await generateStoryPartWithRetry(systemPrompt, page2APrompt);
        await sleep(1000);

        const page2BPrompt = `Histoire jusqu'ici :
        ${baseContext.story.intro}
        ${baseContext.story.page1}
        
        Le personnage choisit : ${choiceB}
        Continue l'histoire et propose deux nouveaux choix.
        Format exact :
        [texte de la suite]
        
        Que fais-tu ?
        Option B1 : [choix 1]
        Option B2 : [choix 2]`;

        baseContext.story.page2B = await generateStoryPartWithRetry(systemPrompt, page2BPrompt);
        await sleep(1000);

        // Extraire tous les choix finaux
        const choices2AMatch = baseContext.story.page2A.match(/Option A1 : (.*)\nOption A2 : (.*)/s);
        const choices2BMatch = baseContext.story.page2B.match(/Option B1 : (.*)\nOption B2 : (.*)/s);
        const [choiceA1, choiceA2] = choices2AMatch ? [choices2AMatch[1], choices2AMatch[2]] : ['', ''];
        const [choiceB1, choiceB2] = choices2BMatch ? [choices2BMatch[1], choices2BMatch[2]] : ['', ''];

        // Générer les fins
        const endings = await Promise.all([
            generateStoryPartWithRetry(
                systemPrompt,
                `Histoire jusqu'ici :
                ${baseContext.story.intro}
                ${baseContext.story.page1}
                ${baseContext.story.page2A}
                
                Le personnage choisit : ${choiceA1}
                Écris une fin positive en 2-3 phrases.
                Termine par "FIN"`
            ),
            generateStoryPartWithRetry(
                systemPrompt,
                `Histoire jusqu'ici :
                ${baseContext.story.intro}
                ${baseContext.story.page1}
                ${baseContext.story.page2A}
                
                Le personnage choisit : ${choiceA2}
                Écris une fin positive en 2-3 phrases.
                Termine par "FIN"`
            ),
            generateStoryPartWithRetry(
                systemPrompt,
                `Histoire jusqu'ici :
                ${baseContext.story.intro}
                ${baseContext.story.page1}
                ${baseContext.story.page2B}
                
                Le personnage choisit : ${choiceB1}
                Écris une fin positive en 2-3 phrases.
                Termine par "FIN"`
            ),
            generateStoryPartWithRetry(
                systemPrompt,
                `Histoire jusqu'ici :
                ${baseContext.story.intro}
                ${baseContext.story.page1}
                ${baseContext.story.page2B}
                
                Le personnage choisit : ${choiceB2}
                Écris une fin positive en 2-3 phrases.
                Termine par "FIN"`
            )
        ]);

        // Assembler l'histoire
        return `Introduction\n${baseContext.story.intro}\n\nPage 1\n${baseContext.story.page1}\n\nPage 2A\n${baseContext.story.page2A}\n\nPage 2B\n${baseContext.story.page2B}\n\nPage 3A1\n${endings[0]}\n\nPage 3A2\n${endings[1]}\n\nPage 3B1\n${endings[2]}\n\nPage 3B2\n${endings[3]}`;
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

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

async function generateStoryPartWithRetry(prompt, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            console.log(`Attempt ${i + 1} of ${maxRetries}`);
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01',
                    'x-api-key': ANTHROPIC_API_KEY
                },
                body: JSON.stringify({
                    model: 'claude-2.1',
                    max_tokens: 1000,
                    messages: [{
                        role: 'user',
                        content: prompt
                    }],
                    system: `Tu es un auteur talentueux et créatif spécialisé dans la rédaction de livres pour enfants. Tu écris des histoires interactives et immersives qui captivent les jeunes lecteurs, tout en les enrichissant sur le plan émotionnel et intellectuel. Voici tes objectifs pour chaque histoire :
                    - Parle à la 3ème personne. 
                    - Utilise toujours le prénom de l'enfant ${name} comme personnage principal et reste cohérent avec les informations fournies sur l'enfant. Fais en sorte que ${name} soit un héros courageux, curieux ou ingénieux, adapté à son univers.
                    - Crée une intrigue unique et pleine de rebondissements. Évite les clichés et introduis des éléments surprenants ou magiques qui stimulent l'imagination.
                    - Intègre des messages subtils ou des leçons importantes adaptées aux enfants, comme la persévérance, l'amitié, le courage ou l'empathie, sans être moralisateur.
                    - Fais vivre une palette d'émotions à travers des défis excitants et des résolutions satisfaisantes. Les enfants doivent ressentir de l'enthousiasme, de la curiosité et une sensation d'accomplissement.
                    - Utilise un langage simple mais riche, avec des descriptions colorées, des dialogues vivants et un rythme narratif entraînant. Assure-toi que le ton reste accessible et amusant pour les enfants.
                    - Implique l'enfant${name} dans des choix ou des interactions imaginaires qui le/la font évoluer dans l'histoire et renforcent l'identification.
                    - Écris une histoire captivante et immersive sans répéter ces consignes dans la sortie.`
                })
            });

            if (response.status === 529) {
                console.log('Service overloaded, retrying after delay...');
                await sleep(2000 * (i + 1));
                continue;
            }

            if (!response.ok) {
                const error = await response.text();
                console.error('API Error Response:', error);
                throw new Error(`Anthropic API error: ${response.status} - ${error}`);
            }

            const result = await response.json();
            if (!result.content || !result.content[0] || !result.content[0].text) {
                console.error('Unexpected API response format:', result);
                throw new Error('Invalid API response format');
            }
            return result.content[0].text.trim();
        } catch (error) {
            console.error(`Attempt ${i + 1} failed:`, error);
            if (i === maxRetries - 1) throw error;
            await sleep(2000 * (i + 1));
        }
    }
    throw new Error('All retry attempts failed');
}

function extractChoices(text, pattern) {
    try {
        const match = text.match(pattern);
        if (match && match.length >= 3) {
            return [match[1].trim(), match[2].trim()];
        }
        console.log('No choices found in text:', text);
        return ['continuer l\'aventure', 'prendre une autre direction'];
    } catch (error) {
        console.error('Error extracting choices:', error);
        return ['continuer l\'aventure', 'prendre une autre direction'];
    }
}

async function generateCompleteStory(mainInfo, style) {
    try {
        // Extraire le nom
        const nameMatch = mainInfo.match(/(\w+)/);
        const childName = nameMatch ? nameMatch[1] : 'l\'enfant';
        console.log('Extracted name:', childName);

        // Générer l'introduction
        console.log('Generating introduction...');
        const introPrompt = `Écris une introduction longue (15) phrases) pour une histoire ${style} avec ces informations : ${mainInfo}
        L'histoire doit parler de ${childName} et ses activités.`;

        const intro = await generateStoryPartWithRetry(introPrompt);
        console.log('Introduction generated successfully');
        await sleep(1000);

        // Générer la première page
        console.log('Generating page 1...');
        const page1Prompt = `Voici le début d'une histoire pour ${childName} :
        "${intro}"
        
        Continue l'histoire (20-30 phrases) puis propose deux choix exactement comme ceci :
        
        Que décides-tu ?
        Option A : [choix 1]
        Option B : [choix 2]`;

        const page1 = await generateStoryPartWithRetry(page1Prompt);
        console.log('Page 1 generated successfully');
        await sleep(1000);

        // Extraire les choix
        const [choiceA, choiceB] = extractChoices(page1, /Option A : (.*)\nOption B : (.*)/s);
        console.log('Extracted choices:', { choiceA, choiceB });

        // Générer les suites
        console.log('Generating page 2A...');
        const page2APrompt = `${childName} choisit : ${choiceA}
        
        Continue l'histoire (20-30 phrases) puis propose deux choix exactement comme ceci :
        
        Que fais-tu ?
        Option A1 : [choix 1]
        Option A2 : [choix 2]`;

        const page2A = await generateStoryPartWithRetry(page2APrompt);
        console.log('Page 2A generated successfully');
        await sleep(1000);

        console.log('Generating page 2B...');
        const page2BPrompt = `${childName} choisit : ${choiceB}
        
        Continue l'histoire (20-30 phrases) puis propose deux choix exactement comme ceci :
        
        Que fais-tu ?
        Option B1 : [choix 1]
        Option B2 : [choix 2]`;

        const page2B = await generateStoryPartWithRetry(page2BPrompt);
        console.log('Page 2B generated successfully');
        await sleep(1000);

        // Extraire les choix finaux
        const [choiceA1, choiceA2] = extractChoices(page2A, /Option A1 : (.*)\nOption A2 : (.*)/s);
        const [choiceB1, choiceB2] = extractChoices(page2B, /Option B1 : (.*)\nOption B2 : (.*)/s);

        // Générer les fins
        console.log('Generating endings...');
        const endingPrompts = [
            `${childName} choisit : ${choiceA1}
            Écris une fin positive en 20-30 phrases.
            Termine par "FIN"`,

            `${childName} choisit : ${choiceA2}
            Écris une fin positive en 20-30 phrases.
            Termine par "FIN"`,

            `${childName} choisit : ${choiceB1}
            Écris une fin positive en 20-30 phrases.
            Termine par "FIN"`,

            `${childName} choisit : ${choiceB2}
            Écris une fin positive en 20-30 phrases.
            Termine par "FIN"`
        ];

        const endings = [];
        for (const prompt of endingPrompts) {
            const ending = await generateStoryPartWithRetry(prompt);
            endings.push(ending);
            await sleep(1000);
        }
        console.log('All endings generated successfully');

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

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
const MODEL_URL = "https://api-inference.huggingface.co/models/tiiuae/falcon-7b-instruct";

function cleanGeneratedText(text) {
    // Supprimer les parties du prompt qui pourraient apparaître dans la sortie
    text = text.replace(/Format attendu :/g, '');
    text = text.replace(/Format :/g, '');
    text = text.replace(/Contexte :/g, '');
    text = text.replace(/Style :/g, '');
    text = text.replace(/Instructions :/g, '');
    
    // Nettoyer les options mal formatées
    text = text.replace(/Option [A-Z][0-9]+ : \[.*?\]/g, '');
    text = text.replace(/\[Nouveau choix [0-9]+\]/g, '');
    
    // Supprimer les lignes vides multiples
    text = text.replace(/\n\s*\n/g, '\n\n');
    
    return text.trim();
}

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
                inputs: `<|system|>Tu es un auteur de livres pour enfants spécialisé dans les histoires interactives. Génère uniquement le texte demandé, sans inclure d'instructions ou de notes.</s>
                <|user|>${prompt}</s>
                <|assistant|>`,
                parameters: {
                    max_new_tokens: 800,
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
        return cleanGeneratedText(result[0].generated_text);
    } catch (error) {
        console.error('Error in generateStoryPart:', error);
        throw error;
    }
}

async function generateCompleteStory(mainInfo, style) {
    // Extraire le nom et l'activité
    const [name, ...details] = mainInfo.split(' ');
    
    // Générer l'introduction
    const introPrompt = `Écris l'introduction d'une histoire pour enfant.
    Le héros s'appelle ${name} et ${details.join(' ')}.
    L'histoire doit être du style ${style}.
    
    Écris uniquement l'introduction (environ 3 phrases) qui présente le personnage et le contexte.`;

    const intro = await generateStoryPart(introPrompt);

    // Générer la première page avec les choix
    const page1Prompt = `Continue cette histoire :
    "${intro}"
    
    Écris la première situation (Page 1) et propose deux choix :
    - Décris la situation en 2-3 phrases
    - Termine par "Que décides-tu ?"
    - Propose deux choix clairs commençant par "Option A :" et "Option B :"`;

    const page1 = await generateStoryPart(page1Prompt);

    // Générer les suites pour chaque choix
    const page2APrompt = `Voici le début de l'histoire :
    "${intro}
    ${page1}"
    
    Continue l'histoire après le choix A (Page 2A) :
    - Décris ce qui se passe en 2-3 phrases
    - Termine par "Que fais-tu ?"
    - Propose deux nouveaux choix commençant par "Option A1 :" et "Option A2 :"`;

    const page2A = await generateStoryPart(page2APrompt);

    const page2BPrompt = `Voici le début de l'histoire :
    "${intro}
    ${page1}"
    
    Continue l'histoire après le choix B (Page 2B) :
    - Décris ce qui se passe en 2-3 phrases
    - Termine par "Que fais-tu ?"
    - Propose deux nouveaux choix commençant par "Option B1 :" et "Option B2 :"`;

    const page2B = await generateStoryPart(page2BPrompt);

    // Générer les fins
    const endings = await Promise.all([
        generateStoryPart(`Écris la fin de l'histoire (Page 3A1) après le choix A1. Termine par "FIN".`),
        generateStoryPart(`Écris la fin de l'histoire (Page 3A2) après le choix A2. Termine par "FIN".`),
        generateStoryPart(`Écris la fin de l'histoire (Page 3B1) après le choix B1. Termine par "FIN".`),
        generateStoryPart(`Écris la fin de l'histoire (Page 3B2) après le choix B2. Termine par "FIN".`)
    ]);

    // Assembler l'histoire complète
    return `Introduction\n${intro}\n\nPage 1\n${page1}\n\nPage 2A\n${page2A}\n\nPage 2B\n${page2B}\n\nPage 3A1\n${endings[0]}\n\nPage 3A2\n${endings[1]}\n\nPage 3B1\n${endings[2]}\n\nPage 3B2\n${endings[3]}`;
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

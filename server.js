require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { OpenAI } = require('openai');

const app = express();

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'Origin']
}));

app.use(express.json());
app.use(express.static(__dirname));

// Configuration OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

async function generateStoryPart(prompt) {
    try {
        console.log('Generating story part...');
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: "Tu es un auteur de livres pour enfants spécialisé dans les histoires interactives de type 'livre dont vous êtes le héros'. Tu écris en français de manière claire et adaptée aux enfants."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            temperature: 0.9,
            max_tokens: 500
        });

        return completion.choices[0].message.content.trim();
    } catch (error) {
        console.error('Error in generateStoryPart:', error);
        throw error;
    }
}

async function generateCompleteStory(mainInfo, style) {
    try {
        // Générer l'introduction
        const introPrompt = `Écris une introduction pour une histoire interactive.
        Informations sur l'enfant : ${mainInfo}
        Style de l'histoire : ${style}

        L'introduction doit :
        - Présenter le personnage principal
        - Décrire le contexte
        - Être courte (3-4 phrases)
        - Être adaptée aux enfants`;

        const intro = await generateStoryPart(introPrompt);

        // Générer la première page
        const page1Prompt = `Continue cette histoire :
        "${intro}"

        Pour la Page 1 :
        - Décris la première situation
        - Termine par "Que décides-tu ?"
        - Propose deux choix clairs :
          * Option A : [premier choix]
          * Option B : [deuxième choix]`;

        const page1 = await generateStoryPart(page1Prompt);

        // Générer les suites
        const page2APrompt = `Voici la suite après le choix A.
        - Décris ce qui se passe
        - Termine par "Que fais-tu ?"
        - Propose deux nouveaux choix :
          * Option A1 : [premier choix]
          * Option A2 : [deuxième choix]`;

        const page2A = await generateStoryPart(page2APrompt);

        const page2BPrompt = `Voici la suite après le choix B.
        - Décris ce qui se passe
        - Termine par "Que fais-tu ?"
        - Propose deux nouveaux choix :
          * Option B1 : [premier choix]
          * Option B2 : [deuxième choix]`;

        const page2B = await generateStoryPart(page2BPrompt);

        // Générer les fins
        const endings = await Promise.all([
            generateStoryPart(`Écris la fin de l'histoire après le choix A1.
            - Une fin positive et satisfaisante
            - Environ 3-4 phrases
            - Termine par "FIN"`),
            generateStoryPart(`Écris la fin de l'histoire après le choix A2.
            - Une fin positive et satisfaisante
            - Environ 3-4 phrases
            - Termine par "FIN"`),
            generateStoryPart(`Écris la fin de l'histoire après le choix B1.
            - Une fin positive et satisfaisante
            - Environ 3-4 phrases
            - Termine par "FIN"`),
            generateStoryPart(`Écris la fin de l'histoire après le choix B2.
            - Une fin positive et satisfaisante
            - Environ 3-4 phrases
            - Termine par "FIN"`)
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
    console.log(`OpenAI API Key configurée: ${process.env.OPENAI_API_KEY ? 'Oui' : 'Non'}`);
});

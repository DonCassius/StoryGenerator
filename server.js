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
// Utilisation d'un modèle français plus adapté
const MODEL_URL = "https://api-inference.huggingface.co/models/tiiuae/falcon-7b-instruct";

async function generateStoryPart(prompt) {
    try {
        console.log('Generating story part with prompt:', prompt);
        const response = await fetch(MODEL_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${HUGGINGFACE_API_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                inputs: prompt,
                parameters: {
                    max_new_tokens: 1000,
                    temperature: 0.9,
                    top_p: 0.95,
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
        console.log('Generated text:', result);
        return result[0].generated_text.trim();
    } catch (error) {
        console.error('Error in generateStoryPart:', error);
        throw error;
    }
}

async function generateCompleteStory(mainInfo, style) {
    // Générer l'introduction
    const introPrompt = `Tu es un auteur de livres pour enfants. Écris une histoire interactive de type "livre dont vous êtes le héros" avec ces informations :
    Enfant : ${mainInfo}
    Style : ${style}

    Instructions :
    1. Commence par une introduction qui présente l'enfant et le contexte
    2. Continue avec la première situation et propose 2 choix
    3. L'histoire doit être en français, positive et adaptée aux enfants
    4. Utilise un style narratif engageant
    5. Format attendu :

    Introduction
    [Texte d'introduction]

    Page 1
    [Texte de la première situation]

    Que décides-tu ?
    Option A : [Premier choix]
    Option B : [Deuxième choix]`;

    const intro = await generateStoryPart(introPrompt);

    // Générer les suites pour chaque choix
    const choixAPrompt = `Continue l'histoire après le choix A.
    Contexte : ${mainInfo}
    Style : ${style}

    Format attendu :
    Page 2A
    [Texte de ce qui se passe après le choix A]

    Que fais-tu maintenant ?
    Option A1 : [Nouveau choix 1]
    Option A2 : [Nouveau choix 2]`;

    const choixA = await generateStoryPart(choixAPrompt);

    const choixBPrompt = `Continue l'histoire après le choix B.
    Contexte : ${mainInfo}
    Style : ${style}

    Format attendu :
    Page 2B
    [Texte de ce qui se passe après le choix B]

    Que fais-tu maintenant ?
    Option B1 : [Nouveau choix 1]
    Option B2 : [Nouveau choix 2]`;

    const choixB = await generateStoryPart(choixBPrompt);

    // Générer les fins
    const finPrompts = [
        `Écris la fin de l'histoire après le choix A1.
        Format :
        Page 3A1
        [Texte de la fin]
        FIN`,

        `Écris la fin de l'histoire après le choix A2.
        Format :
        Page 3A2
        [Texte de la fin]
        FIN`,

        `Écris la fin de l'histoire après le choix B1.
        Format :
        Page 3B1
        [Texte de la fin]
        FIN`,

        `Écris la fin de l'histoire après le choix B2.
        Format :
        Page 3B2
        [Texte de la fin]
        FIN`
    ];

    const fins = await Promise.all(finPrompts.map(prompt => 
        generateStoryPart(`${prompt}
        Contexte : ${mainInfo}
        Style : ${style}`)
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

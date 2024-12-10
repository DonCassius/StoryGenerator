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
    // Générer l'introduction (Page 1)
    const introPrompt = `Écris le début d'une histoire pour enfant de type "livre dont vous êtes le héros" (environ 500 mots).
    Informations sur l'enfant: ${mainInfo}
    Style: ${style}
    
    Instructions:
    - L'histoire doit être en français
    - Elle doit être adaptée aux enfants
    - À la fin du texte, propose 2 choix
    - Pour chaque choix, indique "Si vous choisissez [choix], allez à la page X"
    - Numérote les pages à partir de 1
    
    Format:
    Page 1
    [Texte de l'histoire...]
    
    Que décides-tu ?
    - Si tu choisis [option 1], va à la page 2
    - Si tu choisis [option 2], va à la page 3`;

    const intro = await generateStoryPart(introPrompt);

    // Générer les pages suivantes
    const page2Prompt = `Continue l'histoire pour la page 2 (environ 500 mots).
    Contexte: ${mainInfo}
    Style: ${style}
    
    Instructions:
    - Continue l'histoire de manière cohérente
    - À la fin, propose 2 nouveaux choix
    - Pour chaque choix, indique la page à laquelle aller
    
    Format:
    Page 2
    [Texte de l'histoire...]
    
    Que décides-tu ?
    - Si tu choisis [option 1], va à la page 4
    - Si tu choisis [option 2], va à la page 5`;

    const page2 = await generateStoryPart(page2Prompt);

    const page3Prompt = `Continue l'histoire pour la page 3 (environ 500 mots).
    Contexte: ${mainInfo}
    Style: ${style}
    
    Instructions:
    - Continue l'histoire de manière cohérente
    - À la fin, propose 2 nouveaux choix
    - Pour chaque choix, indique la page à laquelle aller
    
    Format:
    Page 3
    [Texte de l'histoire...]
    
    Que décides-tu ?
    - Si tu choisis [option 1], va à la page 6
    - Si tu choisis [option 2], va à la page 7`;

    const page3 = await generateStoryPart(page3Prompt);

    // Générer les fins possibles
    const endings = await Promise.all([4, 5, 6, 7].map(async pageNum => {
        const endingPrompt = `Écris la fin de l'histoire pour la page ${pageNum} (environ 500 mots).
        Contexte: ${mainInfo}
        Style: ${style}
        
        Instructions:
        - Termine l'histoire de manière satisfaisante
        - Pas de choix à la fin, c'est une conclusion
        
        Format:
        Page ${pageNum}
        [Texte de la fin de l'histoire...]
        
        FIN`;

        return generateStoryPart(endingPrompt);
    }));

    // Assembler toute l'histoire
    const completeStory = `${intro}\n\n${page2}\n\n${page3}\n\n${endings.join('\n\n')}`;
    return completeStory;
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

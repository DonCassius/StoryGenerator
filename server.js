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

async function generateStorySection(prompt) {
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
                    max_length: 1000,
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
        console.error('Error in generateStorySection:', error);
        throw error;
    }
}

async function generateFullStory(mainInfo, style) {
    try {
        // Générer l'introduction (Section 1)
        const introPrompt = `Écris le début d'une histoire interactive pour enfant (environ 500 mots).
        Informations sur l'enfant: ${mainInfo}
        Style: ${style}
        L'histoire doit être en français, positive et adaptée aux enfants.
        À la fin, propose 2 ou 3 choix pour continuer l'histoire.`;

        const intro = await generateStorySection(introPrompt);

        // Générer les choix pour l'introduction
        const choicesPrompt = `Pour cette introduction:
        "${intro}"
        Propose 2 ou 3 choix différents pour la suite de l'histoire.
        Format:
        1) Premier choix
        2) Deuxième choix
        3) Troisième choix (optionnel)`;

        const choicesText = await generateStorySection(choicesPrompt);
        const choices = choicesText.split('\n')
            .filter(line => line.match(/^\d\)/))
            .map((choice, index) => ({
                text: choice.replace(/^\d\)\s*/, ''),
                goto: String(index + 2)
            }));

        // Générer les sections suivantes
        const sections = {
            '1': {
                text: intro,
                choices: choices
            }
        };

        // Générer 2-3 sections pour chaque choix
        for (const choice of choices) {
            const sectionPrompt = `Continue l'histoire en suivant ce choix: "${choice.text}"
            L'enfant: ${mainInfo}
            Style: ${style}
            Écris environ 500 mots et propose 2 nouveaux choix à la fin.`;

            const sectionText = await generateStorySection(sectionPrompt);
            const sectionChoicesPrompt = `Pour cette partie de l'histoire:
            "${sectionText}"
            Propose 2 choix différents pour la suite.`;

            const sectionChoicesText = await generateStorySection(sectionChoicesPrompt);
            const sectionChoices = sectionChoicesText.split('\n')
                .filter(line => line.match(/^\d\)/))
                .map((choiceText, index) => ({
                    text: choiceText.replace(/^\d\)\s*/, ''),
                    goto: String(parseInt(choice.goto) * 10 + index + 1)
                }));

            sections[choice.goto] = {
                text: sectionText,
                choices: sectionChoices
            };
        }

        return sections;
    } catch (error) {
        console.error('Error generating story:', error);
        throw error;
    }
}

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/story', (req, res) => {
    res.sendFile(path.join(__dirname, 'story.html'));
});

app.post('/generate-story', async (req, res) => {
    try {
        const { headline, subheadline, mainText, style } = req.body;

        if (!headline || !subheadline || !mainText || !style) {
            throw new Error('Données manquantes dans la requête');
        }

        const sections = await generateFullStory(mainText, style);
        
        const storyData = {
            title: headline,
            subtitle: subheadline,
            sections: sections
        };

        res.json(storyData);
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

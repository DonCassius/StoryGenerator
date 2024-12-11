require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fetch = require('node-fetch');
const PDFDocument = require('pdfkit');

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
                    system: "Tu es un auteur talentueux et créatif spécialisé dans la rédaction de livres pour enfants. Tu écris des histoires interactives et immersives qui captivent les jeunes lecteurs, tout en les enrichissant sur le plan émotionnel et intellectuel. Voici tes objectifs pour chaque histoire : - Parle à la 3ème personne et au PRÉSENT. - Utilise toujours le prénom de l'enfant comme personnage principal et reste cohérent avec les informations fournies sur l'enfant. Fais en sorte que ${name} soit un héros courageux, curieux ou ingénieux, adapté à son univers. - Crée une intrigue unique et pleine de rebondissements. Évite les clichés et introduis des éléments surprenants ou magiques qui stimulent l'imagination. - Intègre des messages subtils ou des leçons importantes adaptées aux enfants, comme la persévérance, l'amitié, le courage ou l'empathie, sans être moralisateur. - Fais vivre une palette d'émotions à travers des défis excitants et des résolutions satisfaisantes. Les enfants doivent ressentir de l'enthousiasme, de la curiosité et une sensation d'accomplissement. - Utilise un langage simple mais riche, avec des descriptions colorées, des dialogues vivants et un rythme narratif entraînant. Assure-toi que le ton reste accessible et amusant pour les enfants. - Implique l'enfant dans des choix ou des interactions imaginaires qui le/la font évoluer dans l'histoire et renforcent l'identification. - Écris une histoire captivante et immersive sans répéter ces consignes dans la sortie ou me demander mon avis sur ce que tu viens de générer."
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

function extractName(text) {
    try {
        // Recherche le motif "s'appelle X" ou "m'appelle X"
        const nameMatch = text.match(/(?:s'appelle|m'appelle)\s+(\w+)/i);
        if (nameMatch && nameMatch[1]) {
            console.log('Nom extrait:', nameMatch[1]);
            return nameMatch[1];
        }
        
        // Si pas trouvé, cherche le premier mot après "Mon enfant" ou "Je"
        const altMatch = text.match(/(?:Mon enfant|Je)\s+(\w+)/i);
        if (altMatch && altMatch[1]) {
            console.log('Nom alternatif extrait:', altMatch[1]);
            return altMatch[1];
        }

        console.log('Aucun nom trouvé, utilisation de valeur par défaut');
        return 'l\'enfant';
    } catch (error) {
        console.error('Erreur lors de l\'extraction du nom:', error);
        return 'l\'enfant';
    }
}

async function generateCompleteStory(mainInfo, style) {
    try {
        // Extraire le nom avec la nouvelle fonction
        const name = extractName(mainInfo);
        console.log('Nom extrait pour l\'histoire:', name);

        // Générer l'introduction
        console.log('Generating introduction...');
        const introPrompt = `Écris une introduction longue (15 phrases) pour une histoire ${style} avec ces informations : ${mainInfo}
        L'histoire doit parler de ${name} et ses activités.`;

        const intro = await generateStoryPartWithRetry(introPrompt);
        console.log('Introduction generated successfully');
        await sleep(1000);

        // Générer la première page
        console.log('Generating page 1...');
        const page1Prompt = `Voici le début d'une histoire pour ${name} :
        "${intro}"
        
        Continue l'histoire (2-3 phrases) puis propose deux choix exactement comme ceci :
        
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
        const page2APrompt = `${name} choisit : ${choiceA}
        
        Continue l'histoire (2-3 phrases) puis propose deux choix exactement comme ceci :
        
        Que fais-tu ?
        Option A1 : [choix 1]
        Option A2 : [choix 2]`;

        const page2A = await generateStoryPartWithRetry(page2APrompt);
        console.log('Page 2A generated successfully');
        await sleep(1000);

        console.log('Generating page 2B...');
        const page2BPrompt = `${name} choisit : ${choiceB}
        
        Continue l'histoire (2-3 phrases) puis propose deux choix exactement comme ceci :
        
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
            `${name} choisit : ${choiceA1}
            Écris une fin positive en 2-3 phrases.
            Termine par "FIN"`,

            `${name} choisit : ${choiceA2}
            Écris une fin positive en 2-3 phrases.
            Termine par "FIN"`,

            `${name} choisit : ${choiceB1}
            Écris une fin positive en 2-3 phrases.
            Termine par "FIN"`,

            `${name} choisit : ${choiceB2}
            Écris une fin positive en 2-3 phrases.
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

// Fonction pour générer le PDF
async function generatePDF(story) {
    const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        bufferPages: true
    });

    // Configurer les styles
    const fonts = {
        title: {
            size: 24,
            font: 'Helvetica-Bold'
        },
        subtitle: {
            size: 20,
            font: 'Helvetica-Bold'
        },
        normal: {
            size: 14,
            font: 'Helvetica',
            lineGap: 8
        },
        option: {
            size: 14,
            font: 'Helvetica-Oblique'
        }
    };

    // Fonction pour nettoyer le texte des phrases de transition
    function cleanText(text) {
        return text
            .replace(/Voici (?:une |la |)(?:introduction|suite).*?:/g, '')
            .replace(/Voici le début.*?:/g, '')
            .replace(/Voici la suite.*?:/g, '')
            .trim();
    }
    
    // Fonction helper pour ajouter du texte
    function addText(text, options = {}) {
        const defaultOptions = {
            width: 495,
            align: 'right',
            lineGap: 8,
            continued: false
        };
        doc.text(cleanText(text), { ...defaultOptions, ...options });
    }

    // Fonction helper pour ajouter un titre
    function addTitle(text) {
        doc.font(fonts.title.font)
           .fontSize(fonts.title.size)
           .text(text.toUpperCase(), {
               align: 'center'
           })
           .moveDown(2);
    }

    // Fonction helper pour ajouter un sous-titre
    function addSubtitle(text) {
        doc.font(fonts.subtitle.font)
           .fontSize(fonts.subtitle.size)
           .text(text, {
               align: 'center'
           })
           .moveDown(1);
    }

    // Fonction helper pour ajouter une option
    function addOption(text) {
        doc.font(fonts.option.font)
           .fontSize(fonts.option.size)
           .text(text, {
               indent: 20,
               width: 475,
               align: 'right'
           })
           .moveDown(0.5);
    }

    // Ajouter une page de couverture
    addTitle("Histoire Interactive\nPersonnalisée");
    doc.moveDown(2);

    // Traiter chaque section de l'histoire
    const sections = story.split('\n\n');
    for (const section of sections) {
        const [title, ...content] = section.split('\n');
        
        // Ajouter un saut de page si nécessaire
        if (doc.y > 700) {
            doc.addPage();
        }

        // Ajouter le titre de section
        doc.moveDown(1);
        addSubtitle(title);

        // Traiter le contenu
        const text = content.join('\n');
        
        // Si c'est une section avec des options
        if (text.includes('Option')) {
            const parts = text.split(/Option [A-Z][12]? :/g);
            
            // Ajouter le texte principal
            const mainText = cleanText(parts[0]);
            if (mainText) {
                doc.font(fonts.normal.font)
                   .fontSize(fonts.normal.size)
                   .text(mainText, {
                       align: 'right',
                       lineGap: 8
                   })
                   .moveDown(1);
            }

            // Ajouter les options
            const options = text.match(/Option [A-Z][12]? : .*/g) || [];
            options.forEach(option => {
                addOption(option);
            });
            doc.moveDown(0.5);
        } else {
            // Ajouter le texte normal
            const cleanedText = cleanText(text);
            if (cleanedText) {
                doc.font(fonts.normal.font)
                   .fontSize(fonts.normal.size)
                   .text(cleanedText, {
                       align: 'right',
                       lineGap: 8
                   })
                   .moveDown(1);
            }
        }
    }

    // Ajouter les numéros de page
    let pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
        doc.switchToPage(i);
        
        // Ajouter un pied de page
        doc.font('Helvetica')
           .fontSize(10)
           .text(
               `Page ${i + 1} sur ${pages.count}`,
               50,
               doc.page.height - 50,
               {
                   align: 'center',
                   width: doc.page.width - 100
               }
           );
    }

    return doc;
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

// Nouvel endpoint pour générer le PDF
app.post('/generate-pdf', async (req, res) => {
    try {
        const { story } = req.body;
        if (!story) {
            throw new Error('Histoire manquante dans la requête');
        }

        console.log('Generating PDF...');
        const doc = await generatePDF(story);

        // Configurer les headers pour le téléchargement
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=histoire-personnalisee.pdf');

        // Streamer le PDF vers le client
        doc.pipe(res);
        doc.end();

        console.log('PDF generated and sent successfully');
    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).json({
            error: 'Erreur lors de la génération du PDF',
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

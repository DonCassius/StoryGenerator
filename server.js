/* [Garder tout le code jusqu'à la fonction generatePDF] */

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

    // Fonction pour créer un titre personnalisé
    function createCustomTitle(story) {
        const nameMatch = story.match(/(?:s'appelle|m'appelle)\s+(\w+)/i);
        const name = nameMatch ? nameMatch[1] : '';
        
        const introMatch = story.match(/Introduction\n(.*?)(?=\n\n)/s);
        const intro = introMatch ? introMatch[1] : '';
        
        const keywords = ['dragon', 'magie', 'aventure', 'quête', 'mystère', 'trésor', 'forêt', 'château', 'espace'];
        let theme = keywords.find(k => intro.toLowerCase().includes(k)) || 'aventure';
        
        return name ? `La Grande ${theme.charAt(0).toUpperCase() + theme.slice(1)}\nde ${name}` : "Une Histoire\nExtraordinaire";
    }
    
    // Fonction helper pour ajouter du texte
    function addText(text, options = {}) {
        const defaultOptions = {
            width: 495,
            align: 'left',
            lineGap: 8,
            continued: false
        };
        doc.text(cleanText(text), { ...defaultOptions, ...options });
    }

    // Fonction helper pour ajouter un titre
    function addTitle(text) {
        doc.font(fonts.title.font)
           .fontSize(fonts.title.size)
           .text(text, {
               align: 'center'
           })
           .moveDown(2);
    }

    // Fonction helper pour ajouter un sous-titre
    function addSubtitle(text) {
        // Remplacer "Page" par "Chapitre"
        text = text.replace(/^Page /, 'Chapitre ');
        doc.font(fonts.normal.font)
           .fontSize(fonts.normal.size)
           .text(text, {
               align: 'center'
           })
           .moveDown(1);
    }

    // Fonction helper pour ajouter une question
    function addQuestion(text) {
        doc.font(fonts.normal.font)
           .fontSize(fonts.normal.size)
           .text(text, {
               align: 'left'
           })
           .moveDown(0.5);
    }

    // Fonction helper pour ajouter une option
    function addOption(text) {
        doc.font(fonts.option.font)
           .fontSize(fonts.option.size)
           .text(text, {
               indent: 20,
               width: 475,
               align: 'left'
           })
           .moveDown(0.5);
    }

    // Ajouter une page de couverture avec titre personnalisé
    const customTitle = createCustomTitle(story);
    addTitle(customTitle);
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
                       align: 'left',
                       lineGap: 8
                   })
                   .moveDown(1);
            }

            // Ajouter la question "Que décides-tu ?" ou "Que fais-tu ?"
            const questionMatch = text.match(/Que (?:décides-tu|fais-tu) \?/);
            if (questionMatch) {
                addQuestion(questionMatch[0]);
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
                       align: 'left',
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

/* [Garder tout le reste du code] */

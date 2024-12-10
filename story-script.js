document.addEventListener('DOMContentLoaded', () => {
    const storyTitle = document.getElementById('story-title');
    const storySubtitle = document.getElementById('story-subtitle');
    const currentSection = document.getElementById('current-section');
    const choicesContainer = document.getElementById('choices');
    const restartBtn = document.getElementById('restart-btn');
    const backBtn = document.getElementById('back-btn');

    let storyData = null;
    let currentSectionId = '1';

    // Nettoyer le texte des caractères spéciaux
    function cleanText(text) {
        return text
            .replace(/["""]/g, '"')
            .replace(/['']/g, "'")
            .replace(/\n\s*\n/g, '\n')
            .trim();
    }

    // Récupérer l'histoire depuis le localStorage
    function loadStory() {
        const story = localStorage.getItem('generatedStory');
        if (story) {
            try {
                storyData = JSON.parse(story);
                storyTitle.textContent = cleanText(storyData.title);
                storySubtitle.textContent = cleanText(storyData.subtitle);
                displaySection(currentSectionId);
            } catch (error) {
                console.error('Erreur lors du chargement de l\'histoire:', error);
                alert('Erreur lors du chargement de l\'histoire. Retour à l\'accueil...');
                window.location.href = 'index.html';
            }
        } else {
            window.location.href = 'index.html';
        }
    }

    // Afficher une section spécifique de l'histoire
    function displaySection(sectionId) {
        const section = storyData.sections[sectionId];
        if (!section) {
            console.error('Section non trouvée:', sectionId);
            return;
        }

        // Afficher le texte de la section
        currentSection.innerHTML = `
            <div class="section-number">Page ${sectionId}</div>
            ${cleanText(section.text)}
        `;

        // Afficher les choix si disponibles
        choicesContainer.innerHTML = '';
        if (section.choices && section.choices.length > 0) {
            section.choices.forEach(choice => {
                const button = document.createElement('button');
                button.className = 'choice-button';
                button.textContent = cleanText(choice.text);
                button.addEventListener('click', () => {
                    displaySection(choice.goto);
                    // Faire défiler vers le haut en douceur
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                });
                choicesContainer.appendChild(button);
            });
        }

        // Sauvegarder la position actuelle
        currentSectionId = sectionId;
        localStorage.setItem('currentSection', sectionId);
    }

    // Gestionnaire pour le bouton Recommencer
    restartBtn.addEventListener('click', () => {
        if (confirm('Voulez-vous vraiment recommencer l\'histoire depuis le début ?')) {
            currentSectionId = '1';
            displaySection('1');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });

    // Gestionnaire pour le bouton Retour
    backBtn.addEventListener('click', () => {
        if (confirm('Voulez-vous vraiment retourner à l\'accueil ? Votre progression sera perdue.')) {
            localStorage.removeItem('generatedStory');
            localStorage.removeItem('currentSection');
            window.location.href = 'index.html';
        }
    });

    // Charger l'histoire au chargement de la page
    loadStory();

    // Gérer la touche Échap pour retourner à l'accueil
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            backBtn.click();
        }
    });
});

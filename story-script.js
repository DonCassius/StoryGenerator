document.addEventListener('DOMContentLoaded', () => {
    const storyTitle = document.getElementById('story-title');
    const storySubtitle = document.getElementById('story-subtitle');
    const currentSection = document.getElementById('current-section');
    const choicesContainer = document.getElementById('choices');
    const restartBtn = document.getElementById('restart-btn');
    const backBtn = document.getElementById('back-btn');

    let storyData = null;
    let currentSectionId = '1';

    // Récupérer l'histoire depuis le localStorage
    function loadStory() {
        const story = localStorage.getItem('generatedStory');
        if (story) {
            storyData = JSON.parse(story);
            storyTitle.textContent = storyData.title;
            storySubtitle.textContent = storyData.subtitle;
            displaySection(currentSectionId);
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
            ${section.text}
        `;

        // Afficher les choix si disponibles
        choicesContainer.innerHTML = '';
        if (section.choices && section.choices.length > 0) {
            section.choices.forEach(choice => {
                const button = document.createElement('button');
                button.className = 'choice-button';
                button.textContent = choice.text;
                button.addEventListener('click', () => displaySection(choice.goto));
                choicesContainer.appendChild(button);
            });
        }

        // Sauvegarder la position actuelle
        currentSectionId = sectionId;
        localStorage.setItem('currentSection', sectionId);

        // Faire défiler vers le haut
        window.scrollTo(0, 0);
    }

    // Gestionnaire pour le bouton Recommencer
    restartBtn.addEventListener('click', () => {
        currentSectionId = '1';
        displaySection('1');
    });

    // Gestionnaire pour le bouton Retour
    backBtn.addEventListener('click', () => {
        window.location.href = 'index.html';
    });

    // Charger l'histoire au chargement de la page
    loadStory();
});

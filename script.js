document.addEventListener('DOMContentLoaded', () => {
    const headline = document.getElementById('headline');
    const subheadline = document.getElementById('subheadline');
    const userInput = document.getElementById('userInput');
    const generateBtn = document.getElementById('generateBtn');
    const storyOutput = document.getElementById('storyOutput');
    const progressContainer = document.querySelector('.progress-container');
    const progressBar = document.querySelector('.progress');
    const progressText = document.querySelector('.progress-text');
    const styleCheckboxes = document.querySelectorAll('input[name="style"]');

    let currentStory = {
        parts: [],
        currentIndex: 0
    };

    // Fonction pour afficher l'histoire et les choix
    function displayStoryAndChoices(storyText, choices) {
        const choicesHtml = choices && choices.length > 0 
            ? `
                <div class="choices-container">
                    <h3>Que décides-tu ?</h3>
                    ${choices.map((choice, index) => `
                        <button class="choice-btn" data-choice="${choice}">
                            ${choice}
                        </button>
                    `).join('')}
                </div>
            `
            : '';

        storyOutput.innerHTML = `
            <div class="story-text">${storyText}</div>
            ${choicesHtml}
        `;

        // Ajouter les événements aux boutons de choix
        const choiceButtons = storyOutput.querySelectorAll('.choice-btn');
        choiceButtons.forEach(button => {
            button.addEventListener('click', () => handleChoice(button.dataset.choice));
        });

        storyOutput.classList.add('visible');
    }

    // Gérer le choix de l'utilisateur
    async function handleChoice(choice) {
        try {
            // Désactiver tous les boutons pendant le chargement
            const buttons = storyOutput.querySelectorAll('.choice-btn');
            buttons.forEach(btn => btn.disabled = true);

            // Démarrer l'animation de chargement
            progressContainer.style.display = 'block';
            let progress = 0;
            const progressInterval = setInterval(() => {
                progress += Math.random() * 15;
                if (progress > 95) progress = 95;
                progressBar.style.width = `${progress}%`;
                progressText.textContent = `${Math.round(progress)}%`;
            }, 200);

            const response = await fetch(`${window.location.origin}/continue-story`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    previousPart: currentStory.parts[currentStory.currentIndex],
                    choiceMade: choice
                })
            });

            if (!response.ok) {
                throw new Error('Erreur lors de la génération de la suite de l\'histoire');
            }

            const data = await response.json();
            
            // Ajouter la nouvelle partie à l'histoire
            currentStory.parts.push(data.story);
            currentStory.currentIndex++;

            // Afficher la nouvelle partie et les choix
            displayStoryAndChoices(data.story, data.choices);

            // Réinitialiser l'interface
            clearInterval(progressInterval);
            progressContainer.style.display = 'none';
            progressBar.style.width = '0%';
            progressText.textContent = '0%';

        } catch (error) {
            console.error('Erreur:', error);
            alert('Une erreur est survenue lors de la génération de la suite de l\'histoire');
        }
    }

    generateBtn.addEventListener('click', async () => {
        const headlineText = headline.value.trim();
        const subheadlineText = subheadline.value.trim();
        const mainText = userInput.value.trim();
        const selectedStyle = Array.from(styleCheckboxes).find(cb => cb.checked)?.value || '';
        
        if (!headlineText || !subheadlineText || !mainText) {
            alert('Veuillez remplir tous les champs pour générer une histoire.');
            return;
        }

        if (!selectedStyle) {
            alert('Veuillez sélectionner un style d\'histoire.');
            return;
        }

        // Désactiver le bouton et afficher la barre de progression
        generateBtn.disabled = true;
        progressContainer.style.display = 'block';
        storyOutput.classList.remove('visible');

        let progress = 0;
        const progressInterval = setInterval(() => {
            progress += Math.random() * 15;
            if (progress > 95) progress = 95;
            progressBar.style.width = `${progress}%`;
            progressText.textContent = `${Math.round(progress)}%`;
        }, 200);

        try {
            const response = await fetch(`${window.location.origin}/generate-story`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    headline: headlineText,
                    subheadline: subheadlineText,
                    mainText: mainText,
                    style: selectedStyle
                })
            });

            if (!response.ok) {
                throw new Error('Erreur lors de la génération de l\'histoire');
            }

            const data = await response.json();
            
            // Initialiser l'histoire
            currentStory = {
                parts: [data.currentPart],
                currentIndex: 0
            };

            // Afficher l'histoire et les choix
            displayStoryAndChoices(data.currentPart, data.choices);

            // Réinitialiser l'interface
            clearInterval(progressInterval);
            progressContainer.style.display = 'none';
            generateBtn.disabled = false;
            progressBar.style.width = '0%';
            progressText.textContent = '0%';

        } catch (error) {
            console.error('Erreur:', error);
            alert('Une erreur est survenue lors de la génération de l\'histoire');
            
            // Réinitialiser l'interface
            clearInterval(progressInterval);
            progressContainer.style.display = 'none';
            generateBtn.disabled = false;
            progressBar.style.width = '0%';
            progressText.textContent = '0%';
        }
    });
});

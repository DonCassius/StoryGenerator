document.addEventListener('DOMContentLoaded', () => {
    // Configuration de l'API - URL exacte de votre service Render
    const API_URL = 'https://storygenerator-syqp.onrender.com';  // URL fixe du service

    const headline = document.getElementById('headline');
    const subheadline = document.getElementById('subheadline');
    const userInput = document.getElementById('userInput');
    const generateBtn = document.getElementById('generateBtn');
    const storyOutput = document.getElementById('storyOutput');
    const progressContainer = document.querySelector('.progress-container');
    const progressBar = document.querySelector('.progress');
    const progressText = document.querySelector('.progress-text');
    const styleCheckboxes = document.querySelectorAll('input[name="style"]');
    const faqItems = document.querySelectorAll('.faq-item');

    // Fonction pour ajuster automatiquement la hauteur des textareas
    function autoResize(element) {
        element.style.height = 'auto';
        element.style.height = element.scrollHeight + 'px';
    }

    // Appliquer autoResize aux headlines
    [headline, subheadline].forEach(element => {
        autoResize(element);
        element.addEventListener('input', () => autoResize(element));
    });

    // Gérer la sélection unique des styles
    styleCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                styleCheckboxes.forEach(cb => {
                    if (cb !== e.target) cb.checked = false;
                });
            }
        });
    });

    // Gérer les FAQ
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        question.addEventListener('click', () => {
            faqItems.forEach(otherItem => {
                if (otherItem !== item) otherItem.classList.remove('active');
            });
            item.classList.toggle('active');
        });
    });

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

        // Démarrer l'animation de génération
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
            console.log('Envoi de la requête à:', `${API_URL}/generate-story`);
            
            const response = await fetch(`${API_URL}/generate-story`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    headline: headlineText,
                    subheadline: subheadlineText,
                    mainText: mainText,
                    style: selectedStyle
                })
            });

            console.log('Statut de la réponse:', response.status);
            const responseText = await response.text();
            console.log('Réponse brute:', responseText);

            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status} - ${responseText}`);
            }

            const data = JSON.parse(responseText);
            console.log('Données parsées:', data);
            
            // Compléter la progression
            progress = 100;
            progressBar.style.width = '100%';
            progressText.textContent = '100%';
            
            // Afficher l'histoire
            setTimeout(() => {
                storyOutput.innerHTML = data.story;
                storyOutput.classList.add('visible');
                
                // Réinitialiser l'interface
                clearInterval(progressInterval);
                progressContainer.style.display = 'none';
                generateBtn.disabled = false;
                progressBar.style.width = '0%';
                progressText.textContent = '0%';
            }, 500);

        } catch (error) {
            console.error('Erreur détaillée:', error);
            alert('Une erreur est survenue lors de la génération de l\'histoire. Consultez la console pour plus de détails.');
            
            // Réinitialiser l'interface
            clearInterval(progressInterval);
            progressContainer.style.display = 'none';
            generateBtn.disabled = false;
            progressBar.style.width = '0%';
            progressText.textContent = '0%';
        }
    });
});

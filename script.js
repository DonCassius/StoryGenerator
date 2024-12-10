document.addEventListener('DOMContentLoaded', () => {
    const userInput = document.getElementById('userInput');
    const generateBtn = document.getElementById('generateBtn');
    const storyOutput = document.getElementById('storyOutput');
    const progressContainer = document.querySelector('.progress-container');
    const progressBar = document.querySelector('.progress');
    const progressText = document.querySelector('.progress-text');
    const styleCheckboxes = document.querySelectorAll('input[name="style"]');
    const faqItems = document.querySelectorAll('.faq-item');

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
        const mainText = userInput.value.trim();
        const selectedStyle = Array.from(styleCheckboxes).find(cb => cb.checked)?.value || '';
        
        if (!mainText) {
            alert('Veuillez entrer des informations sur votre enfant.');
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
            const response = await fetch(`${window.location.origin}/generate-story`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    headline: document.getElementById('headline').textContent,
                    subheadline: document.getElementById('subheadline').textContent,
                    mainText: mainText,
                    style: selectedStyle
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Erreur serveur:', errorText);
                throw new Error(`Erreur lors de la génération de l'histoire: ${errorText}`);
            }

            const data = await response.json();
            
            // Compléter la progression
            progress = 100;
            progressBar.style.width = '100%';
            progressText.textContent = '100%';
            
            // Afficher l'histoire et le bouton d'export
            setTimeout(() => {
                storyOutput.innerHTML = `${data.story}
                <div style="text-align: center; margin-top: 20px;">
                    <button class="export-btn" onclick="alert('La fonctionnalité d\'export PDF sera bientôt disponible')">
                        Exporter en PDF
                    </button>
                </div>`;
                storyOutput.classList.add('visible');
                
                // Réinitialiser l'interface
                clearInterval(progressInterval);
                progressContainer.style.display = 'none';
                generateBtn.disabled = false;
                progressBar.style.width = '0%';
                progressText.textContent = '0%';

                // Faire défiler jusqu'à l'histoire
                storyOutput.scrollIntoView({ behavior: 'smooth' });
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

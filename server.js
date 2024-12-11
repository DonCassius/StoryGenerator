/* [Garder tout le code jusqu'à la dernière ligne] */

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
    console.log(`Environnement: ${process.env.NODE_ENV}`);
    console.log(`Anthropic API Key configurée: ${ANTHROPIC_API_KEY ? 'Oui' : 'Non'}`);
});

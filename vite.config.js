import { defineConfig } from 'vite';

export default defineConfig(({ command }) => {
    const config = {
        // Base configuration
    };

    if (command === 'build') {
        // When building for production, set the base to your repository name
        // This ensures assets are loaded correctly on GitHub Pages
        // Replace 'block_castle_defense_game' with your actual repository name
        config.base = '/block_castle_defense_game/';
    }

    return config;
});
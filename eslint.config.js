const js = require('@eslint/js');

module.exports = [
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                console: 'readonly',
                document: 'readonly',
                window: 'readonly',
                requestAnimationFrame: 'readonly',
                setTimeout: 'readonly',
                performance: 'readonly',
                Date: 'readonly'
            }
        },
        rules: {
            ...js.configs.recommended.rules,
            'no-unused-vars': 'warn',
            'no-console': 'off',
            'prefer-const': 'error',
            'no-var': 'error',
            'eqeqeq': 'error',
            'no-trailing-spaces': 'error'
        }
    }
];
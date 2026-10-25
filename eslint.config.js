const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
    {
        ignores: ['node_modules/**', 'logs/**', 'data/**']
    },
    js.configs.recommended,
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: { ...globals.node }
        },
        rules: {
            'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true, caughtErrors: 'none' }],
            'no-empty': ['error', { allowEmptyCatch: true }],
            eqeqeq: ['error', 'smart']
        }
    },
    {
        files: ['cloudflare-worker/**/*.js'],
        languageOptions: {
            sourceType: 'module',
            globals: { ...globals.serviceworker }
        }
    },
    {
        files: ['docs/app.js', 'public/app.js'],
        languageOptions: {
            sourceType: 'script',
            globals: { ...globals.browser, marked: 'readonly', hljs: 'readonly', katex: 'readonly', EasyMDE: 'readonly' }
        }
    }
];

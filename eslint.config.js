import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'node_modules', 'scripts'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Firestore-Daten kommen ungetypt herein; punktuelle Casts sind gewollt.
      '@typescript-eslint/no-explicit-any': 'warn',

      /*
       * Zwei Muster in dieser App setzen State aus einem Effect heraus:
       *
       *  1. Dialogformulare übernehmen ihre Startwerte beim Öffnen aus den
       *     Props (`useEffect(..., [open, item])`).
       *  2. Firestore-Hooks setzen beim Abmelden einer Subscription den
       *     lokalen Zustand zurück.
       *
       * Beides läuft genau einmal pro Öffnen bzw. pro Wechsel und erzeugt
       * keine Render-Schleife. Die Regel bleibt als Hinweis aktiv, damit neue
       * Fälle auffallen, blockiert aber den Build nicht.
       */
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
)

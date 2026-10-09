import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import hooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  { ignores: ['node_modules/**', 'out/**', 'release/**', '.cache/**', 'test-results/**', 'playwright-report/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    rules: { '@typescript-eslint/no-explicit-any': 'error', 'max-lines': ['error', { max: 280, skipBlankLines: true, skipComments: true }] },
  },
  { files: ['src/renderer/**/*.tsx'], plugins: { 'react-hooks': hooks }, rules: {
    'react-hooks/rules-of-hooks': 'error', 'react-hooks/exhaustive-deps': 'error',
  } },
  { files: ['src/renderer/**/*.{ts,tsx}', 'src/shared/**/*.ts'], rules: {
    'no-restricted-imports': ['error', { patterns: ['node:*', 'electron', '**/desktop/**'] }],
  } },
  { files: ['src/shared/**/*.ts'], rules: {
    'no-restricted-imports': ['error', { patterns: ['node:*', 'electron', 'react', 'bpmn-js*', '**/renderer/**', '**/desktop/**'] }],
  } },
);

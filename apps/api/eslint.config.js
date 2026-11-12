// ESLint flat config for the API — security guard rails (T59, T60, T151, T248, T42, T2139).
import tseslint from 'typescript-eslint';

export default tseslint.config(...tseslint.configs.recommended, {
  files: ['api/**/*.ts', 'src/**/*.ts'],
  rules: {
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-restricted-properties': [
      'error',
      { object: 'Math', property: 'random', message: 'Use node:crypto (randomInt/randomBytes) for anything security-relevant (T151).' },
    ],
    'no-restricted-imports': [
      'error',
      {
        paths: [
          { name: 'crypto-js', message: 'Use node:crypto only (T59).' },
          { name: 'md5', message: 'MD5 is forbidden (T60).' },
          { name: 'sha1', message: 'SHA-1 is forbidden (T60).' },
        ],
      },
    ],
    'no-restricted-syntax': [
      'error',
      { selector: "CallExpression[callee.name='require'][arguments.0.type!='Literal']", message: 'No dynamic require (T42).' },
      { selector: "ImportExpression[source.type!='Literal']", message: 'No dynamic import built from data (T42).' },
      {
        selector: "CallExpression[callee.property.name='select'][arguments.0.value='*']",
        message: "No select('*') — use the COLUMNS allow-lists from @acme-iot/shared (T2139).",
      },
      {
        selector: "Literal[value=/\\b(md5|sha1|des-|rc4|-ecb)\\b/i]",
        message: 'Weak algorithm literal (T60).',
      },
    ],
  },
});

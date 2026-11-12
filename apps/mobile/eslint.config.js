// ESLint flat config for the Expo app.
// Security rules: no dynamic code (T279/T37), no raw HTML rendering (T36), no hardware identifiers (T161/T165),
// no server-only modules or service-role secrets in the client bundle (T248), no Math.random for
// security values (T151), no console output in shipped code (T49).
const expoConfig = require('eslint-config-expo/flat');

const SERVER_ONLY_PATTERNS = [
  { group: ['**/apps/api/**', '@acme-iot/api', '@acme-iot/api/**'], message: 'Server code must not be bundled into the app (T248).' },
  { group: ['**/supabaseAdmin', '**/lib/supabase', '**/api/src/**'], message: 'Server-side Supabase clients are server-only (T248).' },
];

module.exports = [
  ...expoConfig,
  {
    rules: {
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
      'react/no-danger': 'error',
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use expo-crypto / crypto.getRandomValues for random values (T151).' },
        { object: 'document', property: 'write', message: 'Unsafe DOM sink (T37).' },
        { object: 'document', property: 'writeln', message: 'Unsafe DOM sink (T37).' },
      ],
      'no-restricted-syntax': [
        'error',
        { selector: "MemberExpression[property.name='innerHTML']", message: 'Unsafe DOM sink (T36/T37).' },
        { selector: "MemberExpression[property.name='outerHTML']", message: 'Unsafe DOM sink (T36/T37).' },
        {
          selector: "MemberExpression[object.object.name='process'][object.property.name='env'][property.name=/SERVICE_ROLE|SECRET|PRIVATE_KEY/]",
          message: 'Server secrets must never be referenced by the app (T248/T76).',
        },
        { selector: "Literal[value=/SUPABASE_SERVICE_ROLE_KEY|FIRMWARE_SIGNING_PRIVATE_KEY|DEVICE_SIM_SHARED_SECRET/]", message: 'Server secret name in client code (T248).' },
        { selector: "CallExpression[callee.name='setTimeout'][arguments.0.type='Literal']", message: 'Implied eval (T279).' },
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'expo-application', message: 'Do not read hardware/installation identifiers (T161/T165).' },
            { name: 'expo-location', message: 'The app must not request location (T5637).' },
            { name: 'react-native-webview', message: 'No WebViews / remote JS (T279).' },
          ],
          patterns: SERVER_ONLY_PATTERNS,
        },
      ],
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
];

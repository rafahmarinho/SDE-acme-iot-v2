/**
 * Expo config plugin: Android manifest hardening.
 *
 * - T5645/T5646/T5657/T273: every <service>, <receiver> and <provider> is forced to exported="false".
 *   The prebuild fails if a dependency adds an exported component with an intent-filter that is not
 *   on the reviewed allow-list (so no Binder/Messenger/Intent entry point reaches other apps).
 * - T270: allowBackup/fullBackupContent disabled, no legacy external storage.
 * - T146: usesCleartextTraffic="false".
 */
const { withAndroidManifest } = require('expo/config-plugins');

// Components reviewed and allowed to keep an intent-filter (they are system-only entry points).
// Add here only after review; keep exported=false unless the platform requires otherwise.
const REVIEWED_COMPONENTS = new Set([
  // expo-updates / expo-modules core use no exported components at the time of writing.
]);

function hardenComponents(list, kind) {
  if (!Array.isArray(list)) return;
  for (const component of list) {
    const attrs = component.$ ?? (component.$ = {});
    const name = attrs['android:name'] ?? '<unnamed>';
    const hasIntentFilter = Array.isArray(component['intent-filter']) && component['intent-filter'].length > 0;
    if (hasIntentFilter && !REVIEWED_COMPONENTS.has(name)) {
      throw new Error(
        `[withAndroidHardening] ${kind} ${name} declares an intent-filter. ` +
          'Review it (T5645/T5646/T273) and add it to REVIEWED_COMPONENTS if it is required.',
      );
    }
    attrs['android:exported'] = 'false';
  }
}

module.exports = function withAndroidHardening(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    const app = manifest.application?.[0];
    if (!app) return cfg;

    app.$['android:allowBackup'] = 'false';
    app.$['android:fullBackupContent'] = 'false';
    app.$['android:usesCleartextTraffic'] = 'false';
    delete app.$['android:requestLegacyExternalStorage'];

    hardenComponents(app.service, 'service');
    hardenComponents(app.receiver, 'receiver');
    hardenComponents(app.provider, 'provider');

    // Only the launcher activity may be exported; secondary activities are internal.
    for (const activity of app.activity ?? []) {
      const filters = activity['intent-filter'] ?? [];
      const isLauncher = filters.some((f) =>
        (f.category ?? []).some((c) => c.$?.['android:name'] === 'android.intent.category.LAUNCHER'),
      );
      if (!isLauncher) activity.$['android:exported'] = 'false';
    }
    return cfg;
  });
};

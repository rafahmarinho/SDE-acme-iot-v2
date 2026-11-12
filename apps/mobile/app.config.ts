import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * ACME IoT Expo configuration (iOS, Android, Web).
 *
 * Security posture enforced here:
 * - T146/T21: no cleartext traffic (Android) and no ATS exceptions (iOS).
 * - T270/T2133/T5634/T5635: backups disabled, iOS Data Protection, no iCloud/CloudKit.
 * - T273/T5637: minimal permissions; location and storage permissions blocked.
 * - T5645/T5646/T5657: hardening plugin forces exported=false on all non-launcher components.
 * - T170: single custom scheme + verified https app links for the auth (password reset) redirect only.
 * - T279: OTA updates only from an https URL with code signing.
 */

function httpsUrl(name: string, fallback: string): URL {
  const raw = process.env[name] ?? fallback;
  const url = new URL(raw);
  if (url.protocol !== 'https:') {
    throw new Error(`${name} must be an https:// URL (got ${url.protocol})`);
  }
  return url;
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const webUrl = httpsUrl('EXPO_PUBLIC_WEB_URL', 'https://acme-iot.example.com');
  const updatesUrl = httpsUrl('EXPO_UPDATES_URL', 'https://u.expo.dev/00000000-0000-0000-0000-000000000000');

  return {
    ...config,
    name: 'ACME IoT',
    slug: 'acme-iot',
    scheme: 'acmeiot',
    version: '0.1.0',
    orientation: 'default',
    userInterfaceStyle: 'light',
    platforms: ['ios', 'android', 'web'],
    runtimeVersion: { policy: 'appVersion' },
    updates: {
      url: updatesUrl.toString(),
      enabled: true,
      checkAutomatically: 'ON_LOAD',
      // Updates must be signed with the private key matching this certificate (T279).
      codeSigningCertificate: './certs/certificate.pem',
      codeSigningMetadata: { keyid: 'main', alg: 'rsa-v1_5-sha256' },
    },
    ios: {
      bundleIdentifier: 'com.acme.iot',
      supportsTablet: true,
      usesIcloudStorage: false, // T5634/T5635: Supabase is the only sync backend
      associatedDomains: [`applinks:${webUrl.host}`],
      entitlements: {
        // T2133: files are encrypted and unavailable while the device is locked
        'com.apple.developer.default-data-protection': 'NSFileProtectionComplete',
      },
      infoPlist: {
        NSAppTransportSecurity: { NSAllowsArbitraryLoads: false }, // T146
        NSCameraUsageDescription: 'The camera is used only to scan device QR codes during registration.',
        NSFaceIDUsageDescription: 'Face ID can be used to unlock ACME IoT and confirm sensitive actions.',
        ITSAppUsesNonExemptEncryption: false,
      },
      privacyManifests: {
        NSPrivacyTracking: false,
        NSPrivacyTrackingDomains: [],
        NSPrivacyCollectedDataTypes: [],
        NSPrivacyAccessedAPITypes: [],
      },
    },
    android: {
      package: 'com.acme.iot',
      allowBackup: false, // T270: tokens/cache never land in adb/cloud backups
      permissions: ['android.permission.CAMERA', 'android.permission.USE_BIOMETRIC'],
      blockedPermissions: [
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
        'android.permission.READ_MEDIA_IMAGES',
        'android.permission.SYSTEM_ALERT_WINDOW',
        'android.permission.ACCESS_FINE_LOCATION',
        'android.permission.ACCESS_COARSE_LOCATION',
        'android.permission.ACCESS_BACKGROUND_LOCATION',
        'android.permission.READ_PHONE_STATE',
        'android.permission.RECORD_AUDIO',
      ],
      intentFilters: [
        {
          // T170: only the password-reset path is accepted as a verified App Link
          action: 'VIEW',
          autoVerify: true,
          data: [{ scheme: 'https', host: webUrl.host, pathPrefix: '/reset-password' }],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    },
    web: {
      bundler: 'metro',
      output: 'single',
    },
    plugins: [
      'expo-router',
      ['expo-secure-store', { faceIDPermission: 'Face ID can be used to unlock ACME IoT.' }],
      ['expo-camera', { cameraPermission: 'The camera is used only to scan device QR codes.', recordAudioAndroid: false }],
      ['expo-local-authentication', { faceIDPermission: 'Face ID can be used to unlock ACME IoT.' }],
      ['expo-build-properties', { android: { usesCleartextTraffic: false } }],
      './plugins/withAndroidHardening',
    ],
    experiments: { typedRoutes: true },
    extra: { webUrl: webUrl.origin },
  };
};

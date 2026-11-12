/**
 * Optional biometric unlock (T5633).
 * Biometrics release a Keychain/Keystore item protected with access control (requireAuthentication),
 * instead of a JavaScript boolean — a hooked `authenticateAsync()` returning true does not unlock anything.
 * Server authentication stays Supabase email/password; biometrics only gate local re-unlock and
 * confirmation of sensitive actions (firmware rollout/rollback, role changes, data reset, account deletion).
 * Passcode fallback is allowed by the OS prompt; the feature can be turned off in Settings.
 * Not available on web.
 */
import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { UserFacingError } from '@/lib/errors';
import { getSecret, setSecret } from './secureStorage';

const GATED_KEY = 'acme.biometric.gate';
const ENABLED_KEY = 'biometric.enabled';

const GATED_OPTIONS: SecureStore.SecureStoreOptions = {
  requireAuthentication: true,
  keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
};

export async function biometricAvailable(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
}

export async function isBiometricEnabled(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  return (await getSecret(ENABLED_KEY)) === '1';
}

export async function enableBiometric(): Promise<void> {
  if (!(await biometricAvailable())) throw new UserFacingError('Biometrics are not set up on this device.');
  const secret = Crypto.randomUUID();
  await SecureStore.setItemAsync(GATED_KEY, secret, {
    ...GATED_OPTIONS,
    authenticationPrompt: 'Confirm to enable biometric unlock',
  });
  await setSecret(ENABLED_KEY, '1');
}

export async function disableBiometric(): Promise<void> {
  await SecureStore.deleteItemAsync(GATED_KEY, GATED_OPTIONS).catch(() => undefined);
  await setSecret(ENABLED_KEY, '0');
}

/** Releases the access-controlled Keychain item; throws if the user cancels or biometrics changed. */
async function releaseGate(prompt: string): Promise<void> {
  try {
    const value = await SecureStore.getItemAsync(GATED_KEY, { ...GATED_OPTIONS, authenticationPrompt: prompt });
    if (!value) throw new Error('missing');
  } catch {
    throw new UserFacingError('Authentication was cancelled or failed.');
  }
}

export async function unlockApp(): Promise<void> {
  await releaseGate('Unlock ACME IoT');
}

/** Extra confirmation for sensitive actions when biometric unlock is enabled. Server still authorizes. */
export async function confirmSensitiveAction(reason: string): Promise<void> {
  if (await isBiometricEnabled()) await releaseGate(reason);
}

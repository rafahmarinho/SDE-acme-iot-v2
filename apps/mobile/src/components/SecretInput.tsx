/**
 * Inputs for sensitive values (T316): passwords, manual device codes, integration tokens.
 * Autocorrect, spell-check, capitalization and keyboard learning are disabled so values never end up in
 * keyboard caches or shared dictionaries. Password managers keep working through autoComplete hints.
 */
import { Platform, type TextInputProps } from 'react-native';

import { Field } from './ui';

type Props = Omit<TextInputProps, 'secureTextEntry' | 'autoCorrect' | 'spellCheck'> & {
  label: string;
  error?: string | null;
  kind: 'current-password' | 'new-password' | 'code';
};

export function SecretInput({ kind, ...props }: Props) {
  const password = kind !== 'code';
  return (
    <Field
      {...props}
      secureTextEntry={password}
      autoCorrect={false}
      spellCheck={false}
      autoCapitalize={kind === 'code' ? 'characters' : 'none'}
      autoComplete={kind === 'current-password' ? 'current-password' : kind === 'new-password' ? 'new-password' : 'off'}
      textContentType={kind === 'current-password' ? 'password' : kind === 'new-password' ? 'newPassword' : 'oneTimeCode'}
      importantForAutofill={kind === 'code' ? 'no' : 'yes'}
      keyboardType={kind === 'code' && Platform.OS === 'android' ? 'visible-password' : 'default'}
      contextMenuHidden={kind === 'code'}
      maxLength={kind === 'code' ? 14 : 128}
    />
  );
}

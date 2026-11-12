/**
 * Basic UI building blocks. All user/device-provided strings are rendered as React Native <Text>
 * children, which are escaped on every platform (T36). No raw HTML rendering exists in the app.
 */
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, font, radius, space } from '@/theme';

export function Screen({ title, children, scroll = true }: { title?: string; children: ReactNode; scroll?: boolean }) {
  const body = (
    <View style={s.body}>
      {title ? <Text style={s.title}>{title}</Text> : null}
      {children}
    </View>
  );
  return <SafeAreaView style={s.safe}>{scroll ? <ScrollView keyboardShouldPersistTaps="handled">{body}</ScrollView> : body}</SafeAreaView>;
}

export function Card({ children }: { children: ReactNode }) {
  return <View style={s.card}>{children}</View>;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  busy,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  busy?: boolean;
}) {
  const bg = variant === 'primary' ? colors.primary : variant === 'danger' ? colors.danger : colors.primarySoft;
  const fg = variant === 'secondary' ? colors.primary : '#fff';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [s.button, { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 }]}
    >
      {busy ? <ActivityIndicator color={fg} /> : <Text style={[s.buttonText, { color: fg }]}>{label}</Text>}
    </Pressable>
  );
}

export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string | null }) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <TextInput placeholderTextColor={colors.muted} style={[s.input, error ? s.inputError : null]} {...props} />
      {error ? <Text style={s.error}>{error}</Text> : null}
    </View>
  );
}

export function Message({ kind = 'info', text }: { kind?: 'info' | 'error' | 'success'; text: string | null }) {
  if (!text) return null;
  const color = kind === 'error' ? colors.danger : kind === 'success' ? colors.success : colors.muted;
  return <Text style={[s.message, { color }]}>{text}</Text>;
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={s.center}>
      <ActivityIndicator color={colors.primary} />
      <Text style={s.muted}>{label}</Text>
    </View>
  );
}

export function Empty({ text }: { text: string }) {
  return <Text style={[s.muted, { textAlign: 'center', marginTop: space.xl }]}>{text}</Text>;
}

/** Search highlight without HTML (T36): splits the string and styles the match as nested <Text>. */
export function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  const i = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (i < 0) return <Text style={s.itemTitle}>{text}</Text>;
  return (
    <Text style={s.itemTitle}>
      {text.slice(0, i)}
      <Text style={{ backgroundColor: colors.primarySoft, color: colors.primary }}>{text.slice(i, i + q.length)}</Text>
      {text.slice(i + q.length)}
    </Text>
  );
}

export const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  body: { padding: space.lg, gap: space.md },
  title: { fontSize: font.xl, fontWeight: '700', color: colors.text, marginBottom: space.sm },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.lg, gap: space.sm },
  button: { minHeight: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg },
  buttonText: { fontSize: font.md, fontWeight: '600' },
  field: { gap: space.xs },
  label: { fontSize: font.sm, color: colors.muted, fontWeight: '600' },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: space.md, fontSize: font.md, color: colors.text, backgroundColor: '#fff' },
  inputError: { borderColor: colors.danger },
  error: { color: colors.danger, fontSize: font.sm },
  message: { fontSize: font.sm },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.sm, padding: space.xl },
  muted: { color: colors.muted, fontSize: font.sm },
  itemTitle: { color: colors.text, fontSize: font.md, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
});

---
name: t316-prevent-keyboard-cache-leaks
description: Disable autocorrect/learning on password and secret inputs (login, device manual codes, integration keys) in the React Native app.
---

# T316: Prevent unauthorized access to information through keyboard caches and shared dictionaries

**Category:** CODE_FIX
**SD Elements:** [T316](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/development/34-T316/)
**Priority:** 7

**Spec Context:**
> "...login por e-mail e senha..." (...email and password login...)
> Source: specs/PRD.md, L5-7
> "Permita cadastrar dispositivos por QR code ou código manual..." (Allow registering devices by QR code or manual code...)
> Source: specs/PRD.md, L27-29

**What the spec implies (naive approach):**
Plain `<TextInput>` for password, device claim code and integration API keys, so keyboards learn and suggest these values.

**Secure Implementation Pattern:**
```tsx
// apps/mobile/src/components/SecretInput.tsx
export function SecretInput(props: TextInputProps) {
  return (
    <TextInput
      {...props}
      secureTextEntry
      autoCorrect={false}
      autoCapitalize="none"
      spellCheck={false}
      keyboardType={Platform.OS === 'android' ? 'visible-password' : 'default'}
      importantForAutofill="no"
      contextMenuHidden
    />
  );
}
// Device manual code: autoCorrect={false} autoComplete="off" spellCheck={false}
```

**Implementation Guidance:**
- Use `SecretInput` for passwords, manual device codes, integration tokens.
- For login password keep `autoComplete="password"` (password managers OK) but disable autocorrect/learning.
- Never log input values.

**Success Criteria:**
- [ ] All sensitive inputs disable autocorrect/spellcheck
- [ ] No sensitive values appear in keyboard suggestions after use

**Status:** Pending

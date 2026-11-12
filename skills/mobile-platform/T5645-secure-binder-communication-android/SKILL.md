---
name: t5645-secure-binder-communication-android
description: The ACME IoT Expo app should expose no Binder/AIDL interfaces; if a native module adds one, keep it private, enforce signature permissions and caller UID checks, and validate all input.
---

# T5645: Implement secure Binder communication (Android)

**Category:** CODE_FIX
**SD Elements:** [T5645](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/development/34-T5645/)
**Priority:** 10

**Spec Context:**
> "React Native com Expo ... para Android, iOS e web" (React Native with Expo ... for Android, iOS and web) — Source: specs/PRD.md, lines 17-19
> "pause as atualizações em segundo plano" (pause updates in the background) — Source: specs/PRD.md, line 51

Background behaviour and native modules (QR scanner, 3D view, notifications) are where Binder services could appear.

**What the spec implies (naive approach):**
Implement background device polling or notification handling with a custom bound service exposed via AIDL so
"other parts of the app" can use it — exported by default to other apps.

**Secure Implementation Pattern:**
```xml
<!-- Only if a custom native module truly needs a bound service (added via config plugin) -->
<permission android:name="com.acme.iot.permission.BIND_INTERNAL" android:protectionLevel="signature" />
<service android:name=".DeviceSyncService" android:exported="false"
         android:permission="com.acme.iot.permission.BIND_INTERNAL" />
```
```kotlin
override fun onTransact(code: Int, data: Parcel, reply: Parcel?, flags: Int): Boolean {
  if (Binder.getCallingUid() != Process.myUid()) throw SecurityException("caller not allowed")
  return super.onTransact(code, data, reply, flags)
}
```

**Implementation Guidance:**
- Default: no AIDL/bound services; the PRD requires pausing updates in background, so no background service is needed.
- Review third-party Expo/RN modules for exported services in the merged manifest.
- If unavoidable: `exported=false`, signature-level permission, caller UID/package check, validate every parcel field, rate-limit calls, no sensitive data across process boundaries.

**Success Criteria:**
- [ ] No AIDL/Binder interfaces exposed to other apps in the built APK
- [ ] Any bound service is unexported and signature-protected
- [ ] Merged manifest reviewed as part of release checklist

**Status:** Pending

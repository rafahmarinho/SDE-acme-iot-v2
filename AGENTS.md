<!-- SDE-SECURITY-HARDENING-START -->
## Security Hardening Execution Contract

Every feature described in `specs/PRD.md` MUST be implemented following the countermeasure recipes below.
Open the linked `SKILL.md` before writing code for the related feature, implement the *Secure Implementation
Pattern*, tick its *Success Criteria*, and set its **Status** to `Implemented` (CODE_FIX) or keep `Documented` (INFRA).

## Project Overview
| Property | Value |
|----------|-------|
| Application | acme-iot-v2 |
| SD Elements Project | [ACME IoT v2](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/) |
| Project ID | 34 |
| Risk Policy | On-Boarding Policy (ID 1) |
| Total Countermeasures | 84 (75 file-tracked + 9 PROCESS note-only) |
| Source | Spec files (specs/PRD.md) |
| Stack | Expo + Expo Router + TypeScript (iOS/Android/Web), TypeScript API on Vercel, Supabase (Postgres, Auth, Storage, Realtime), pnpm |

## Countermeasure Summary by Category

| Category | Count | Description |
|----------|-------|-------------|
| CODE_FIX | 71 | Secure implementation needed in application code |
| INFRA | 4 | External infrastructure (Vercel platform, IdP, hosting region) |
| **FILE-TRACKED TOTAL** | **75** | Countermeasures with local skill files |

> **PROCESS countermeasures (9) are noted in SD Elements only, not tracked locally:** T544, T744, T754, T755, T1386, T2128, T2348, CT1, CT2.

## Skill Files

| Domain | Countermeasures |
|--------|----------------|
| authentication | 10 |
| authorization | 8 |
| web-security | 7 |
| crypto-secrets | 8 |
| api-security | 7 |
| database | 5 |
| messaging | 2 |
| release-hardening | 2 |
| mobile-data-storage | 7 |
| mobile-platform | 9 |
| device-firmware | 5 |
| privacy | 5 |

### authentication
| ID | Title | Skill File | Priority | Category | Status |
|----|-------|-----------|----------|----------|--------|
| T2 | Secure the password reset mechanism | [SKILL.md](./skills/authentication/T2-secure-password-reset/SKILL.md) | 9 | CODE_FIX | Applied |
| T20 | Generate unique session IDs and reset old IDs after authentication | [SKILL.md](./skills/authentication/T20-unique-session-ids-reset-after-auth/SKILL.md) | 9 | CODE_FIX | Applied |
| T69 | Strong password requirements for server-to-server system accounts | [SKILL.md](./skills/authentication/T69-strong-secrets-for-system-accounts/SKILL.md) | 8 | CODE_FIX | Applied |
| T70 | Implement account lockout or authentication throttling for system accounts | [SKILL.md](./skills/authentication/T70-throttle-system-account-auth/SKILL.md) | 8 | CODE_FIX | Applied |
| T143 | Apply minimum password standards for mobile environments | [SKILL.md](./skills/authentication/T143-minimum-password-standards-mobile/SKILL.md) | 7 | CODE_FIX | Applied |
| T164 | Clear session information from client upon logout | [SKILL.md](./skills/authentication/T164-clear-client-session-on-logout/SKILL.md) | 7 | CODE_FIX | Applied |
| T316 | Prevent unauthorized access through keyboard caches and shared dictionaries | [SKILL.md](./skills/authentication/T316-prevent-keyboard-cache-leaks/SKILL.md) | 7 | CODE_FIX | Applied |
| T1539 | Clear browser data on user logout | [SKILL.md](./skills/authentication/T1539-clear-browser-data-on-logout/SKILL.md) | 8 | CODE_FIX | Applied |
| T5633 | Implement best practices for Biometric authentication (iOS) | [SKILL.md](./skills/authentication/T5633-biometric-auth-best-practices-ios/SKILL.md) | 7 | CODE_FIX | Applied |
| T1918 | Integrate with SSO | [SKILL.md](./skills/authentication/T1918-integrate-with-sso/SKILL.md) | 9 | INFRA | Documented |

### authorization
| ID | Title | Skill File | Priority | Category | Status |
|----|-------|-----------|----------|----------|--------|
| T17 | Do not only rely on client-side authorization | [SKILL.md](./skills/authorization/T17-no-client-side-only-authorization/SKILL.md) | 8 | CODE_FIX | Applied |
| T19 | Restrict Application's Access to Database | [SKILL.md](./skills/authorization/T19-restrict-app-database-access/SKILL.md) | 8 | CODE_FIX | Applied |
| T145 | Avoid client-side authorization for mobile clients | [SKILL.md](./skills/authorization/T145-no-client-side-authz-mobile/SKILL.md) | 8 | CODE_FIX | Applied |
| T338 | Control access to resources through user authentication and authorization | [SKILL.md](./skills/authorization/T338-access-control-authn-authz/SKILL.md) | 7 | CODE_FIX | Applied |
| T378 | Authorize every request for data objects | [SKILL.md](./skills/authorization/T378-authorize-every-data-object-request/SKILL.md) | 8 | CODE_FIX | Applied |
| T50 | Use indirect object reference maps if accessing files | [SKILL.md](./skills/authorization/T50-indirect-object-refs-for-files/SKILL.md) | 8 | CODE_FIX | Applied |
| T2598 | Implement query-level access control | [SKILL.md](./skills/authorization/T2598-query-level-access-control/SKILL.md) | 8 | CODE_FIX | Applied |
| T214 | Protect confidential files on operating system or server | [SKILL.md](./skills/authorization/T214-protect-confidential-server-files/SKILL.md) | 9 | CODE_FIX | Applied |

### web-security
| ID | Title | Skill File | Priority | Category | Status |
|----|-------|-----------|----------|----------|--------|
| T29 | Use anti-Cross-Site Request Forgery (CSRF) tokens | [SKILL.md](./skills/web-security/T29-anti-csrf-tokens/SKILL.md) | 7 | CODE_FIX | Applied |
| T36 | Escape untrusted data in HTML, HTML attributes, CSS, and JavaScript | [SKILL.md](./skills/web-security/T36-escape-untrusted-output/SKILL.md) | 8 | CODE_FIX | Applied |
| T37 | Avoid DOM-based Cross-Site Scripting (XSS) | [SKILL.md](./skills/web-security/T37-avoid-dom-based-xss/SKILL.md) | 8 | CODE_FIX | Applied |
| T42 | Avoid relying on untrusted data for server-side selection | [SKILL.md](./skills/web-security/T42-no-untrusted-server-side-selection/SKILL.md) | 10 | CODE_FIX | Applied |
| T66 | Prevent web pages from being loaded inside iFrame | [SKILL.md](./skills/web-security/T66-prevent-framing/SKILL.md) | 7 | CODE_FIX | Applied |
| T166 | Protect against JSON hijacking | [SKILL.md](./skills/web-security/T166-protect-against-json-hijacking/SKILL.md) | 7 | CODE_FIX | Applied |
| T257 | Secure cross origin resource sharing (CORS) | [SKILL.md](./skills/web-security/T257-secure-cors/SKILL.md) | 8 | CODE_FIX | Applied |

### crypto-secrets
| ID | Title | Skill File | Priority | Category | Status |
|----|-------|-----------|----------|----------|--------|
| T21 | Ensure all data in transit is encrypted using a secure TLS channel | [SKILL.md](./skills/crypto-secrets/T21-encrypt-data-in-transit-with-tls/SKILL.md) | 8 | CODE_FIX | Applied |
| T59 | Use standard libraries for cryptography | [SKILL.md](./skills/crypto-secrets/T59-use-standard-crypto-libraries/SKILL.md) | 8 | CODE_FIX | Applied |
| T60 | Use correct and approved cryptographic algorithms, parameters, and key lengths | [SKILL.md](./skills/crypto-secrets/T60-approved-crypto-algorithms-and-key-lengths/SKILL.md) | 8 | CODE_FIX | Applied |
| T76 | Do not hardcode passwords | [SKILL.md](./skills/crypto-secrets/T76-do-not-hardcode-passwords/SKILL.md) | 10 | CODE_FIX | Applied |
| T146 | Use encryption for network communications in mobile environments | [SKILL.md](./skills/crypto-secrets/T146-encrypt-mobile-network-communications/SKILL.md) | 8 | CODE_FIX | Applied |
| T151 | Use cryptographically secure random numbers | [SKILL.md](./skills/crypto-secrets/T151-cryptographically-secure-random-numbers/SKILL.md) | 7 | CODE_FIX | Applied |
| T156 | Validate certificate and its chain of trust properly | [SKILL.md](./skills/crypto-secrets/T156-validate-certificate-chain-of-trust/SKILL.md) | 7 | CODE_FIX | Applied |
| T248 | Protect secret keys and passwords in the application | [SKILL.md](./skills/crypto-secrets/T248-protect-secret-keys-and-passwords/SKILL.md) | 8 | CODE_FIX | Applied |

### api-security
| ID | Title | Skill File | Priority | Category | Status |
|----|-------|-----------|----------|----------|--------|
| T536 | Restrict the size of incoming messages in services | [SKILL.md](./skills/api-security/T536-restrict-size-of-incoming-messages/SKILL.md) | 8 | CODE_FIX | Applied |
| T558 | Authenticate all other components before any network communication with them | [SKILL.md](./skills/api-security/T558-authenticate-components-before-communication/SKILL.md) | 9 | CODE_FIX | Applied |
| T1362 | Perform message throttling in Web APIs | [SKILL.md](./skills/api-security/T1362-perform-message-throttling-in-web-apis/SKILL.md) | 8 | CODE_FIX | Applied |
| T1365 | Mitigate Server Side Request Forgery | [SKILL.md](./skills/api-security/T1365-mitigate-server-side-request-forgery/SKILL.md) | 8 | CODE_FIX | Applied |
| T2139 | Prevent information exposure through APIs | [SKILL.md](./skills/api-security/T2139-prevent-information-exposure-through-apis/SKILL.md) | 7 | CODE_FIX | Applied |
| T35 | Fine-tune HTTP server settings | [SKILL.md](./skills/api-security/T35-fine-tune-http-server-settings/SKILL.md) | 9 | INFRA | Applied |
| T374 | Offload HTTP request handling to dedicated modules | [SKILL.md](./skills/api-security/T374-offload-http-request-handling/SKILL.md) | 7 | INFRA | Documented |

### database
| ID | Title | Skill File | Priority | Category | Status |
|----|-------|-----------|----------|----------|--------|
| T38 | Bind variables in SQL statements | [SKILL.md](./skills/database/T38-bind-variables-in-sql-statements/SKILL.md) | 10 | CODE_FIX | Applied |
| T349 | Protect audit information and logs against unauthorized access | [SKILL.md](./skills/database/T349-protect-audit-information-and-logs/SKILL.md) | 7 | CODE_FIX | Applied |
| T2599 | Protect against connection string parameter pollution | [SKILL.md](./skills/database/T2599-connection-string-parameter-pollution/SKILL.md) | 9 | CODE_FIX | Applied |
| T2600 | Control the result set size returned by a query | [SKILL.md](./skills/database/T2600-control-query-result-set-size/SKILL.md) | 7 | CODE_FIX | Applied |
| T2602 | Log typical database and server activities and related metadata | [SKILL.md](./skills/database/T2602-log-database-and-server-activities/SKILL.md) | 8 | CODE_FIX | Applied |

### messaging
| ID | Title | Skill File | Priority | Category | Status |
|----|-------|-----------|----------|----------|--------|
| T1144 | Prevent Server-Side Template Injection (SSTI) | [SKILL.md](./skills/messaging/T1144-prevent-server-side-template-injection/SKILL.md) | 8 | CODE_FIX | Applied |
| T2157 | Secure email and messaging in web applications | [SKILL.md](./skills/messaging/T2157-secure-email-and-messaging/SKILL.md) | 7 | CODE_FIX | Applied |

### release-hardening
| ID | Title | Skill File | Priority | Category | Status |
|----|-------|-----------|----------|----------|--------|
| T49 | Disable and remove debug capabilities and code/data, and prepare application for release | [SKILL.md](./skills/release-hardening/T49-remove-debug-code-and-prepare-release/SKILL.md) | 7 | CODE_FIX | Applied |
| T186 | Use recommended settings and the latest patches for third party libraries and software | [SKILL.md](./skills/release-hardening/T186-patch-third-party-libraries/SKILL.md) | 10 | CODE_FIX | Applied |

### mobile-data-storage
| ID | Title | Skill File | Priority | Category | Status |
|----|-------|-----------|----------|----------|--------|
| T148 | Avoid caching confidential data on client | [SKILL.md](./skills/mobile-data-storage/T148-avoid-caching-confidential-data-on-client/SKILL.md) | 7 | CODE_FIX | Applied |
| T270 | Follow best practices for storing application data on Android devices | [SKILL.md](./skills/mobile-data-storage/T270-android-app-data-storage-best-practices/SKILL.md) | 7 | CODE_FIX | Applied |
| T295 | Avoid storing unencrypted confidential data without access control mechanisms | [SKILL.md](./skills/mobile-data-storage/T295-no-unencrypted-confidential-data-storage/SKILL.md) | 7 | CODE_FIX | Applied |
| T1468 | Encrypt sensitive data at rest in the browser | [SKILL.md](./skills/mobile-data-storage/T1468-encrypt-sensitive-data-at-rest-in-browser/SKILL.md) | 9 | CODE_FIX | Applied |
| T2133 | Protect the security of data in iOS | [SKILL.md](./skills/mobile-data-storage/T2133-protect-the-security-of-data-in-ios/SKILL.md) | 8 | CODE_FIX | Applied |
| T5634 | Securely integrate iCloud storage into iOS applications (iOS) | [SKILL.md](./skills/mobile-data-storage/T5634-securely-integrate-icloud-storage-ios/SKILL.md) | 9 | CODE_FIX | Applied |
| T5635 | Follow best practices for handling CloudKit Storage (iOS) | [SKILL.md](./skills/mobile-data-storage/T5635-cloudkit-storage-best-practices-ios/SKILL.md) | 9 | CODE_FIX | Applied |

### mobile-platform
| ID | Title | Skill File | Priority | Category | Status |
|----|-------|-----------|----------|----------|--------|
| T160 | Avoid relying on jailbreak or root detection as a strong security measure | [SKILL.md](./skills/mobile-platform/T160-dont-rely-on-jailbreak-root-detection/SKILL.md) | 7 | CODE_FIX | Applied |
| T161 | Treat unique device IDs as personal information | [SKILL.md](./skills/mobile-platform/T161-treat-unique-device-ids-as-personal-info/SKILL.md) | 8 | CODE_FIX | Applied |
| T165 | Do not rely on Unique Device ID values in security controls | [SKILL.md](./skills/mobile-platform/T165-dont-rely-on-udid-in-security-controls/SKILL.md) | 9 | CODE_FIX | Applied |
| T170 | Secure IPC endpoints used in clients | [SKILL.md](./skills/mobile-platform/T170-secure-ipc-endpoints-used-in-clients/SKILL.md) | 7 | CODE_FIX | Applied |
| T273 | Avoid permission re-delegation by considering caller's permissions | [SKILL.md](./skills/mobile-platform/T273-avoid-permission-re-delegation/SKILL.md) | 8 | CODE_FIX | Applied |
| T5637 | Implement best practices for handling location data (iOS) | [SKILL.md](./skills/mobile-platform/T5637-handle-location-data-securely-ios/SKILL.md) | 7 | CODE_FIX | Applied |
| T5645 | Implement secure Binder communication (Android) | [SKILL.md](./skills/mobile-platform/T5645-secure-binder-communication-android/SKILL.md) | 10 | CODE_FIX | Applied |
| T5646 | Implement secure services (Android) | [SKILL.md](./skills/mobile-platform/T5646-implement-secure-services-android/SKILL.md) | 10 | CODE_FIX | Applied |
| T5657 | Validate Incoming Messenger Messages (Android) | [SKILL.md](./skills/mobile-platform/T5657-validate-incoming-messenger-messages/SKILL.md) | 8 | CODE_FIX | Applied |

### device-firmware
| ID | Title | Skill File | Priority | Category | Status |
|----|-------|-----------|----------|----------|--------|
| T197 | Validate the signature of all remote code/updates (client side) | [SKILL.md](./skills/device-firmware/T197-validate-signature-of-remote-updates-client/SKILL.md) | 9 | CODE_FIX | Applied |
| T279 | Avoid dynamically loading any code without proper security considerations | [SKILL.md](./skills/device-firmware/T279-secure-dynamic-code-loading/SKILL.md) | 8 | CODE_FIX | Applied |
| T573 | Prevent UDDI/ebXML spoofing (device registry/discovery) | [SKILL.md](./skills/device-firmware/T573-prevent-registry-discovery-spoofing/SKILL.md) | 8 | CODE_FIX | Applied |
| T585 | Do not expose sensitive information in the update binaries sent to devices | [SKILL.md](./skills/device-firmware/T585-no-sensitive-info-in-update-binaries/SKILL.md) | 7 | CODE_FIX | Applied |
| T2486 | Encrypt and sign all remote code/updates (server side) | [SKILL.md](./skills/device-firmware/T2486-encrypt-and-sign-remote-updates-server/SKILL.md) | 9 | CODE_FIX | Applied |

### privacy
| ID | Title | Skill File | Priority | Category | Status |
|----|-------|-----------|----------|----------|--------|
| T178 | Obtain consent from users prior to collecting personal information | [SKILL.md](./skills/privacy/T178-obtain-consent-before-collecting-pi/SKILL.md) | 10 | CODE_FIX | Applied |
| T604 | Implement a consent withdrawal mechanism | [SKILL.md](./skills/privacy/T604-implement-consent-withdrawal-mechanism/SKILL.md) | 10 | CODE_FIX | Applied |
| T742 | Implement technical measures to ensure the accuracy of personal information | [SKILL.md](./skills/privacy/T742-ensure-accuracy-of-personal-information/SKILL.md) | 7 | CODE_FIX | Applied |
| T5660 | Implement secure data control options for users (Android) | [SKILL.md](./skills/privacy/T5660-secure-data-control-options-for-users/SKILL.md) | 7 | CODE_FIX | Applied |
| T2170 | Ensure personal information meets data localization requirements | [SKILL.md](./skills/privacy/T2170-meet-data-localization-requirements/SKILL.md) | 9 | INFRA | Documented |

## Completion Requirements

**ALL 75 file-tracked countermeasures must be addressed. No exceptions.**

## Progress Tracking

| Domain | Total | Implemented | Documented | Remaining |
|--------|-------|-------------|------------|-----------|
| authentication | 10 | 9 | 1 | 0 |
| authorization | 8 | 8 | 0 | 0 |
| web-security | 7 | 7 | 0 | 0 |
| crypto-secrets | 8 | 8 | 0 | 0 |
| api-security | 7 | 6 | 1 | 0 |
| database | 5 | 5 | 0 | 0 |
| messaging | 2 | 2 | 0 | 0 |
| release-hardening | 2 | 2 | 0 | 0 |
| mobile-data-storage | 7 | 7 | 0 | 0 |
| mobile-platform | 9 | 9 | 0 | 0 |
| device-firmware | 5 | 5 | 0 | 0 |
| privacy | 5 | 4 | 1 | 0 |
| **TOTAL** | **75** | **72** | **3** | **0** |

**Remaining MUST reach 0 before completion.**

## Verification Checklist

- [x] All 71 CODE_FIX countermeasures have secure implementations
- [x] INFRA: T35 applied (vercel.json + route() limits); T374, T1918, T2170 documented with justification
- [x] Total addressed = 75
<!-- SDE-SECURITY-HARDENING-END -->

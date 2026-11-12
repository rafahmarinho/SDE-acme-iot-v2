---
name: t5637-handle-location-data-securely-ios
description: ACME IoT does not need device GPS - navigation is by organization/building/room; do not request location permissions, and treat building addresses and occupancy-by-room as location-sensitive data.
---

# T5637: Implement best practices for handling location data (iOS)

**Category:** CODE_FIX
**SD Elements:** [T5637](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/development/34-T5637/)
**Priority:** 7

**Spec Context:**
> "navegação por organização, prédio e sala" (navigation by organization, building and room) — Source: specs/PRD.md, lines 21-23
> "sensores de temperatura, umidade e ocupação" (temperature, humidity and occupancy sensors) — Source: specs/PRD.md, line 27

Location in this app is logical (building/room), and occupancy sensors reveal where people are.

**What the spec implies (naive approach):**
Request "Always" location to auto-select the nearest building, or expose occupancy-by-room history to all roles.

**Secure Implementation Pattern:**
```json
// apps/mobile/app.json - no location usage strings or background location mode
{ "expo": { "ios": { "infoPlist": {} }, "android": { "blockedPermissions": [
  "android.permission.ACCESS_FINE_LOCATION", "android.permission.ACCESS_COARSE_LOCATION",
  "android.permission.ACCESS_BACKGROUND_LOCATION" ] } } }
```
```sql
-- Occupancy history: aggregate for viewers, raw for admins only
create policy occupancy_read on readings for select using (
  type <> 'occupancy' or has_org_role(org_id, array['owner','admin'])
);
```

**Implementation Guidance:**
- Do not add expo-location; building selection is manual.
- If location is ever needed: `NSLocationWhenInUseUsageDescription` only, request at point of use, reduced accuracy, never store raw coordinates longer than needed.
- Treat building addresses and room-level occupancy as sensitive: role-restricted, aggregated where possible, retention limits.
- Ensure some dependency doesn't add location permissions (check generated Info.plist/manifest).

**Success Criteria:**
- [x] Built app requests no location permission
- [ ] Raw occupancy history restricted to owner/admin
- [x] Info.plist has no location usage keys

**Status:** Applied

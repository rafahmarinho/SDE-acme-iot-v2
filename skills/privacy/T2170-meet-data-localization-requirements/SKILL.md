---
name: t2170-meet-data-localization-requirements
description: INFRA - ACME IoT data localization depends on the Supabase project region and Vercel function regions; select and document hosting regions that satisfy applicable localization laws.
---

### Task T2170: Ensure that personal information processed by the application meets data localization requirements (NON-CODE)

**Category:** INFRA
**SD Elements:** [T2170](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-iot-v2/acme-iot-v2/tasks/phase/requirements/34-T2170/)
**Priority:** 9

**Guidance:** Identify which personal information is subject to localization laws, research requirements per country,
select hosting providers/regions that meet them, assess cross-border transfers, keep records of transfers, and decide
whether local replication is sufficient or the only copy must stay in-jurisdiction.

**Why Not Code-Fixable:**
- Searched specs: specs/PRD.md lines 5-7 ("Supabase para PostgreSQL ... arquivos e atualizações em tempo real"), lines 47-49 ("As versões web e mobile devem compartilhar o mesmo projeto Supabase"), lines 57-59 ("publicar a versão web e a API na Vercel").
- Found: all personal data (users, team members, occupancy readings, files) is stored in one Supabase project and processed by Vercel functions.
- Missing: the PRD names no jurisdictions, customer countries or regulatory scope; region choice is a hosting configuration, not application code.
- Conclusion: INFRA — compliance is achieved by choosing the Supabase project region, Vercel function region(s) and storage location, plus legal assessment.

**Recommended Action:**
- Platform/infra owner, with the privacy officer: determine target jurisdictions (e.g., LGPD/Brazil, GDPR/EU).
- Create the Supabase project in the required region; pin Vercel functions to the same region (`"regions"` in `vercel.json`).
- Document sub-processors (Supabase, Vercel, email provider) and any cross-border transfers; record in the data processing register.
- Re-assess when onboarding customers in new jurisdictions.

**Status:** Documented

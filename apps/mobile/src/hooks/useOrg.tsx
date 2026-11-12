/**
 * Active organization + the caller's role in it, read from `memberships` (RLS: own rows only).
 * The role is used for UI adaptation only (T145); the server re-derives it on every request.
 * The selected org id is kept in SecureStore on native (T295) and in memory on web.
 */
import { useQuery } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { parseRole, type Role } from '@/lib/permissions';
import { isUuid } from '@/lib/safeRoutes';
import { realtime } from '@/services/realtime';
import { getSecret, setSecret } from '@/services/secureStorage';
import { supabase } from '@/services/supabase';

type Membership = { orgId: string; orgName: string; role: Role };
type OrgCtx = { memberships: Membership[]; active: Membership | null; select: (orgId: string) => void; loading: boolean };

const Ctx = createContext<OrgCtx>({ memberships: [], active: null, select: () => undefined, loading: true });

export function OrgProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ['memberships', userId],
    queryFn: async (): Promise<Membership[]> => {
      const { data, error } = await supabase
        .from('memberships')
        .select('org_id, role, organizations(name)')
        .eq('user_id', userId);
      if (error) throw error;
      return (data ?? []).flatMap((m) => {
        const role = parseRole(m.role);
        const org = Array.isArray(m.organizations) ? m.organizations[0] : m.organizations;
        return role && isUuid(m.org_id) ? [{ orgId: m.org_id, orgName: String(org?.name ?? 'Organization'), role }] : [];
      });
    },
  });

  useEffect(() => {
    if (Platform.OS !== 'web') void getSecret('activeOrg').then((v) => v && setActiveId(v));
  }, []);

  const memberships = q.data ?? [];
  const active = memberships.find((m) => m.orgId === activeId) ?? memberships[0] ?? null;

  useEffect(() => {
    realtime.setOrganization(active?.orgId ?? null);
  }, [active?.orgId]);

  const select = (orgId: string) => {
    if (!memberships.some((m) => m.orgId === orgId)) return;
    setActiveId(orgId);
    if (Platform.OS !== 'web') void setSecret('activeOrg', orgId);
  };

  return <Ctx.Provider value={{ memberships, active, select, loading: q.isLoading }}>{children}</Ctx.Provider>;
}

export const useOrg = () => useContext(Ctx);

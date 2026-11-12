/**
 * Web logout landing page. This path is served with `Clear-Site-Data: "cache", "cookies", "storage"`
 * (apps/mobile/vercel.json), so the browser wipes everything for this origin (T1539).
 * Native builds never reach this route (session.ts navigates to /login directly).
 */
import { Redirect, useLocalSearchParams } from 'expo-router';

const REASONS = new Set(['user', 'expired', 'invalid', 'deleted']);

export default function LogoutLanding() {
  const { reason } = useLocalSearchParams<{ reason?: string }>();
  const safeReason = reason && REASONS.has(reason) ? reason : 'user';
  return <Redirect href={{ pathname: '/login', params: { reason: safeReason } }} />;
}

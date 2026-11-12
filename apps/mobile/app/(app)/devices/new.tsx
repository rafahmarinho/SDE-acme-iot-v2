/**
 * Register a device by QR code or manual code (PRD L27-29).
 * - T37/T170: the QR payload is parsed with a strict schema; it is never opened as a URL or executed.
 *   Scanning only pre-fills the form; registration needs an explicit tap.
 * - T165: the code is a random single-use claim code (hashed server-side, claim_device RPC via the API);
 *   serial numbers are never used as credentials. T161: no serials are shown or collected.
 * - T316: the manual code input disables autocorrect/keyboard learning.
 * - T145: the button is shown only to owner/admin, but the API enforces `device.register`.
 */
import { registrationCode } from '@acme-iot/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { z } from 'zod';

import { SecretInput } from '@/components/SecretInput';
import { Button, Card, Empty, Field, Message, Screen, s } from '@/components/ui';
import { useOrg } from '@/hooks/useOrg';
import { toUserMessage } from '@/lib/errors';
import { uiCan } from '@/lib/permissions';
import { api } from '@/services/api';
import { supabase } from '@/services/supabase';
import { colors, space } from '@/theme';

const QrPayload = z.union([
  z.object({ v: z.literal(1), code: registrationCode }).strict(),
  registrationCode,
]);

function parseQr(raw: string): string | null {
  if (raw.length > 200) return null;
  let candidate: unknown = raw;
  if (raw.trim().startsWith('{')) {
    try {
      candidate = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  const parsed = QrPayload.safeParse(candidate);
  if (!parsed.success) return null;
  return typeof parsed.data === 'string' ? parsed.data : parsed.data.code;
}

export default function RegisterDevice() {
  const qc = useQueryClient();
  const { active } = useOrg();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rooms = useQuery({
    queryKey: ['rooms', active?.orgId],
    enabled: !!active,
    queryFn: async () => {
      const { data, error: e } = await supabase.from('rooms').select('id, name').eq('org_id', active!.orgId).order('name').limit(100);
      if (e) throw e;
      return data ?? [];
    },
  });

  if (!active) return <Empty text="Select an organization first." />;
  if (!uiCan(active.role, 'device.register')) return <Empty text="Only owners and administrators can register devices." />;

  const codeOk = registrationCode.safeParse(code).success;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ data: { id: string } }>('/api/devices', { orgId: active.orgId, roomId, code: code.trim().toUpperCase(), name: name.trim() });
      setCode('');
      await qc.invalidateQueries({ queryKey: ['devices', active.orgId] });
      router.replace({ pathname: '/devices/[id]', params: { id: res.data.id } });
    } catch (e) {
      setError(toUserMessage(e, 'This code is invalid, expired or already used.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Register a device">
      <Card>
        {scanning && permission?.granted ? (
          <View style={{ height: 260, borderRadius: 12, overflow: 'hidden' }}>
            <CameraView
              style={{ flex: 1 }}
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={({ data }) => {
                const parsed = parseQr(data);
                setScanning(false);
                if (parsed) setCode(parsed);
                else setError('This QR code is not an ACME IoT device code.');
              }}
            />
          </View>
        ) : (
          <Button
            label="Scan QR code"
            variant="secondary"
            onPress={async () => {
              setError(null);
              const p = permission?.granted ? permission : await requestPermission();
              if (p.granted) setScanning(true);
              else setError('Camera access was denied. Enter the code manually.');
            }}
          />
        )}
        <SecretInput
          kind="code"
          label="Device code (e.g. K7QM-2HXP-9ZRA)"
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase())}
          error={code && !codeOk ? 'Use the 12-character code printed on the device.' : null}
        />
        <Field label="Device name" value={name} onChangeText={setName} maxLength={120} autoCorrect={false} />
        <Text style={s.label}>Room</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {(rooms.data ?? []).map((r) => (
            <Pressable
              key={r.id}
              onPress={() => setRoomId(r.id)}
              style={{ padding: space.sm, borderRadius: 8, backgroundColor: roomId === r.id ? colors.primary : colors.primarySoft }}
            >
              <Text style={{ color: roomId === r.id ? '#fff' : colors.primary }}>{r.name}</Text>
            </Pressable>
          ))}
        </View>
        <Message kind="error" text={error} />
        <Button label="Register device" onPress={() => void submit()} busy={busy} disabled={!codeOk || !name.trim() || !roomId} />
      </Card>
    </Screen>
  );
}

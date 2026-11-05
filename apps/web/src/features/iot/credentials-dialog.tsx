'use client';
import { Check, Copy, KeyRound } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Notice } from '@/components/ui/feedback';
import { API_URL } from '@/lib/api';

export interface Credentials {
  mqttUsername: string;
  secret: string;
}

function CopyRow({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  const [done, setDone] = React.useState(false);
  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="flex items-start gap-2 rounded-md border bg-background/60 p-2">
        <code className={`min-w-0 flex-1 whitespace-pre-wrap break-all text-xs ${mono ? 'font-mono' : ''}`}>{value}</code>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-7 shrink-0"
          aria-label={`Copiar ${label}`}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setDone(true);
              setTimeout(() => setDone(false), 1500);
            } catch {
              /* sem acesso à área de transferência */
            }
          }}
        >
          {done ? <Check className="text-primary" /> : <Copy />}
        </Button>
      </div>
    </div>
  );
}

/** Credenciais mostradas UMA única vez (o servidor só guarda o hash do segredo). */
export function CredentialsDialog({ creds, onClose }: { creds: Credentials | null; onClose: () => void }) {
  if (!creds) return null;
  const base = `agrogenius/${creds.mqttUsername}`;
  const curl = `curl -X POST ${API_URL}/iot/ingest \\
  -H "Content-Type: application/json" \\
  -H "x-device-user: ${creds.mqttUsername}" \\
  -H "x-device-secret: ${creds.secret}" \\
  -d '{"r": {"sm1": 32.5, "water": 1}}'`;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Credenciais do dispositivo" description="Guarda estes dados agora: o segredo não volta a ser mostrado." className="max-w-xl">
        <div className="space-y-3">
          <Notice tone="warn" className="flex gap-2">
            <KeyRound className="size-4 shrink-0 text-warning" />O segredo funciona como uma palavra-passe do dispositivo. Se o perderes, usa “Rodar segredo” e atualiza o firmware.
          </Notice>
          <CopyRow label="Utilizador (MQTT / x-device-user)" value={creds.mqttUsername} />
          <CopyRow label="Segredo (MQTT password / x-device-secret)" value={creds.secret} />
          <CopyRow
            label="Tópicos MQTT"
            value={`${base}/telemetry   ← dispositivo publica leituras\n${base}/status      ← online/offline (LWT)\n${base}/ack         ← confirmação de comandos\n${base}/event       ← eventos (ex.: rega bloqueada)\n${base}/cmd         → comandos validados\n${base}/config      → regras locais (retained)`}
          />
          <CopyRow label="Teste rápido por HTTP (sem broker MQTT)" value={curl} />
          <p className="text-xs text-muted-foreground">
            No firmware de referência (firmware/esp32/smart-irrigation) preenche DEVICE_USER e DEVICE_SECRET. Sensores enviam-se pela chave (ex.: <code>sm1</code>), atuadores respondem pela chave (ex.: <code>v1</code>).
          </p>
          <div className="flex justify-end">
            <Button onClick={onClose}>Já guardei as credenciais</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

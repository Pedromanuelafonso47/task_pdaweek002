'use client';
import { useQuery } from '@tanstack/react-query';
import { Activity, Cpu, History, MapPinned, Plus, Radio, Workflow } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, Notice, PageLoader } from '@/components/ui/feedback';
import { PageHeader, Stat } from '@/components/ui/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CommandsTable } from '@/features/iot/commands-table';
import { DeviceCard, sensorState } from '@/features/iot/device-card';
import { useDevices, useIotRealtime } from '@/features/iot/hooks';
import { RegisterDeviceDialog } from '@/features/iot/register-device-dialog';
import { RulesPanel } from '@/features/iot/rules-panel';
import { api } from '@/lib/api';
import { useFarm } from '@/lib/farm-context';
import type { Field } from '@/lib/types';

export default function IotPage() {
  const { farm, farmId, isLoading: farmsLoading } = useFarm();
  const devices = useDevices(farmId);
  const fields = useQuery({ queryKey: ['fields', farmId], queryFn: () => api<Field[]>(`/farms/${farmId}/fields`), enabled: !!farmId });
  const [registering, setRegistering] = React.useState(false);
  useIotRealtime(farmId);

  if (farmsLoading) return <PageLoader />;
  if (!farmId || !farm) {
    return (
      <EmptyState
        icon={MapPinned}
        title="Sem propriedade ativa"
        description="Regista uma propriedade para começar a ligar sensores e controlar a irrigação."
        action={
          <Button asChild>
            <Link href="/farms/new">Registar propriedade</Link>
          </Button>
        }
      />
    );
  }

  const list = devices.data ?? [];
  const online = list.filter((d) => d.status === 'ONLINE').length;
  const sensors = list.flatMap((d) => d.sensors);
  const alerts = sensors.filter((s) => ['low', 'high'].includes(sensorState(s))).length;
  const activeActuators = list.flatMap((d) => d.actuators).filter((a) => a.isOn).length;

  return (
    <div>
      <PageHeader
        eyebrow="AgroControl"
        title="IoT Command Center"
        description={`Sensores, atuadores e automação de ${farm.name}. Cada comando é validado por regras de segurança no servidor e no firmware.`}
        actions={
          <Button onClick={() => setRegistering(true)}>
            <Plus /> Registar dispositivo
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Dispositivos" value={list.length} sub={`${online} online`} icon={Cpu} />
        <Stat label="Sensores" value={sensors.length} sub={`${sensors.filter((s) => s.last).length} com leituras`} icon={Activity} />
        <Stat label="Fora dos limites" value={alerts} sub="última leitura de cada sensor" icon={Radio} />
        <Stat label="Atuadores ligados" value={activeActuators} icon={Workflow} />
      </div>

      <Tabs defaultValue="devices">
        <TabsList className="mb-4">
          <TabsTrigger value="devices">
            <Cpu /> Dispositivos
          </TabsTrigger>
          <TabsTrigger value="rules">
            <Workflow /> Regras
          </TabsTrigger>
          <TabsTrigger value="history">
            <History /> Histórico de comandos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="devices">
          {devices.isLoading ? (
            <PageLoader />
          ) : devices.error ? (
            <ErrorState error={devices.error} retry={() => devices.refetch()} />
          ) : !list.length ? (
            <EmptyState
              icon={Cpu}
              title="Nenhum dispositivo registado"
              description="Regista um ESP32 para receber leituras de humidade do solo, nível de água ou clima. Vê na AgroTech Lab os projetos recomendados e o firmware de referência."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button onClick={() => setRegistering(true)}>
                    <Plus /> Registar dispositivo
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href="/lab">Ver projetos</Link>
                  </Button>
                </div>
              }
            />
          ) : (
            <>
              {list.some((d) => d.status === 'PENDING') && (
                <Notice className="mb-4">
                  Dispositivos “A aguardar ligação” ainda não enviaram dados. Configura as credenciais no firmware; o estado muda para online na primeira telemetria.
                </Notice>
              )}
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {list.map((d) => (
                  <DeviceCard key={d.id} device={d} />
                ))}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="rules">
          <RulesPanel farmId={farmId} devices={list} />
        </TabsContent>

        <TabsContent value="history">
          <CommandsTable farmId={farmId} />
        </TabsContent>
      </Tabs>

      <RegisterDeviceDialog farmId={farmId} fields={fields.data ?? []} open={registering} onOpenChange={setRegistering} />
    </div>
  );
}

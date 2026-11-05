# Notificações

## Implementado

Canal **in-app** (base de dados + WebSocket em tempo real + toast):

| Tipo | Quando |
|---|---|
| `LOW_MOISTURE` | humidade do solo abaixo do `minThreshold` do sensor |
| `HIGH_TEMP` | temperatura acima do `maxThreshold` |
| `LOW_RESERVOIR` | nível de água abaixo do mínimo |
| `SENSOR_OFFLINE` | dispositivo sem comunicação há > 15 min |
| `IRRIGATION_FAILURE` | dispositivo recusou um comando, ou proteção contra funcionamento a seco bloqueou a rega |
| `NEW_RECOMMENDATION` | o motor gerou/atualizou recomendações |
| `THRESHOLD` | outros sensores fora dos limites |
| `HARVEST_SOON` | colheita prevista nos próximos 7 dias (lembrete semanal por plantação) |
| `MAINTENANCE` | lembrete mensal das tarefas de manutenção de cada projeto IoT concluído |

Notificações repetidas para o mesmo sensor são agrupadas (janela de 60 min). Os lembretes periódicos correm
de hora a hora em processo (`SchedulerService`); com várias instâncias da API, devem passar para uma fila com
bloqueio (BullMQ + Redis).

## Preparado (requer credenciais externas)

SMS, email e WhatsApp: implementar `NotificationChannel` (`apps/api/src/modules/notifications/notifications.service.ts`)
e registá-lo em `channels`. Fornecedores sugeridos para Angola: Twilio / Africa's Talking (SMS),
WhatsApp Business Cloud API, Resend ou SES (email). Cada canal deve respeitar as preferências do utilizador
(a acrescentar ao modelo `User`).

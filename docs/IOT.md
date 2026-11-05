# AgroControl — Integração IoT

## Modelo de segurança

| Camada | Proteção |
|---|---|
| Credenciais | Cada dispositivo tem `mqttUsername` + segredo aleatório de 192 bits. O segredo só é mostrado **uma vez** ao registar; em BD fica apenas o hash SHA-256. Pode ser rodado em AgroControl. |
| Broker | ACL por tópico: o dispositivo só publica em `agrogenius/{user}/telemetry|status|ack|event` e só subscreve `.../cmd|config` (webhooks `/api/iot/mqtt/auth` e `/api/iot/mqtt/acl`). |
| Servidor | Todos os comandos passam por `validateCommand()` (`apps/api/src/modules/iot/safety.ts`): dispositivo online, modo manual para ligar manualmente, duração obrigatória ≤ máximo do atuador, limite de frequência, proteção contra funcionamento a seco. Comandos recusados ficam registados com a razão. |
| Firmware | Limite absoluto de 1 h por ativação, intervalo mínimo entre regas, boia de nível que impede a bomba de arrancar/continuar sem água, arranque com todas as saídas DESLIGADAS. |
| Desligar | Desligar (`OFF`) nunca é bloqueado. |

## Quem decide: firmware ou servidor?

`Device.localRules`:

- **true (recomendado)** — o firmware decide localmente com os limites recebidos em `.../config` (retained) e guardados em NVS. Funciona sem internet. O servidor monitoriza e alerta.
- **false** — o servidor avalia as regras a cada leitura e envia comandos. Útil para dispositivos simples sem lógica própria.

Nunca os dois ao mesmo tempo, para não haver dois "cérebros" a comandar a mesma bomba.

## Contrato de mensagens

Base: `agrogenius/{mqttUsername}/`

| Tópico | Sentido | Payload |
|---|---|---|
| `telemetry` | disp. → plataforma | `{"ts": 1730800000, "r": {"sm1": 31.5, "water": 1}, "a": {"v1": false}}` — `r` = leituras por chave do sensor; `a` = estado dos atuadores; `ts` em segundos UTC (opcional) |
| `status` | disp. → plataforma | `online` / `offline` (retained; LWT = `offline`) |
| `ack` | disp. → plataforma | `{"cmdId": "...", "ok": true, "reason": ""}` |
| `event` | disp. → plataforma | `{"type": "DRY_RUN_BLOCKED", "zone": 0, "reason": "..."}` |
| `cmd` | plataforma → disp. | `{"cmdId": "...", "actuator": "v1", "action": "ON", "durationSec": 600}` |
| `config` | plataforma → disp. | `{"mode": "AUTO", "zones": [{"sensor": "sm1", "valve": "v1", "start": 30, "stop": 45, "maxSec": 900, "cooldownSec": 1800}]}` (retained) |

### Alternativa HTTP (sem broker)

Cabeçalhos `x-device-user` e `x-device-secret`:

- `POST /api/iot/ingest` — mesmo corpo que `telemetry`
- `GET /api/iot/device/commands` — comandos pendentes (expiram ao fim de 2 min)
- `POST /api/iot/device/ack` — confirmação
- `GET /api/iot/device/config` — configuração

## Leituras em atraso

O firmware guarda leituras num buffer circular enquanto não há ligação e envia-as depois, com o `ts` original.
A plataforma aceita até 7 dias de atraso; leituras com mais de 15 min **não** disparam alertas nem automações
(evita reagir a condições passadas).

## Ligar o broker

### Desenvolvimento (Mosquitto)
`docker compose up -d mqtt` e define `MQTT_URL=mqtt://localhost:1883` + `MQTT_USERNAME/MQTT_PASSWORD` de um utilizador de serviço
(cria-o com `mosquitto_passwd` em `infra/mosquitto/passwd`).

### Produção (EMQX recomendado)
1. Autenticação HTTP → `POST https://API/api/iot/mqtt/auth` com corpo `{"username": "${username}", "password": "${password}"}`; resposta `{"result":"allow"|"deny"}`.
2. Autorização HTTP → `POST https://API/api/iot/mqtt/acl` com `{"username","topic","action"}`.
3. TLS na porta 8883; no firmware usar `WiFiClientSecure` com o certificado da CA.
4. A API liga-se como utilizador de serviço com permissão em `agrogenius/#`.

> **Depende de configuração externa:** broker MQTT, certificados TLS e hardware físico. Sem broker, tudo funciona por HTTP.

## Firmware de referência

`firmware/esp32/smart-irrigation/smart-irrigation.ino` (Arduino core 3.x, bibliotecas PubSubClient e ArduinoJson 7).

1. Regista o dispositivo em AgroControl com sensores `sm1..sm4`, `water` e válvulas `v1..v4`.
2. Copia `mqttUsername` e segredo para `DEVICE_USER`/`DEVICE_SECRET`; define Wi-Fi e `MQTT_HOST`.
3. Calibra `ADC_DRY`/`ADC_WET` por sensor (ar = seco, água = saturado).
4. Carrega o firmware, confirma o estado "Online" e testa cada válvula com um comando manual de 60 s em modo manual.

## Simulador

Sem hardware: `npm run iot:simulate -w @agrogenius/api -- --user dev_xxx --secret yyy`
(leituras **sintéticas**; escreve `w` + Enter para simular falta de água).

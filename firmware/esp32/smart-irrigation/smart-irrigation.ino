/*
 * AGROGENIUS — Irrigação inteligente multi-zona (ESP32, Arduino core 3.x)
 *
 * - Decide LOCALMENTE quando regar (funciona sem internet).
 * - Limites por zona recebidos da plataforma e guardados em NVS (sobrevivem a reinícios).
 * - Segurança: tempo máximo por rega, intervalo mínimo entre regas, proteção contra
 *   funcionamento a seco (boia no poço/reservatório), arranque sempre com tudo DESLIGADO.
 * - Leituras guardadas em buffer quando offline e enviadas quando a ligação volta.
 *
 * Bibliotecas: PubSubClient (Nick O'Leary), ArduinoJson 7.x
 * Contrato MQTT: ver docs/IOT.md
 */
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <time.h>

// ───────── Configuração (preencher com os dados do registo na plataforma) ─────────
const char* WIFI_SSID     = "A_TUA_REDE";
const char* WIFI_PASS     = "A_TUA_PALAVRA_PASSE";
const char* MQTT_HOST     = "mqtt.exemplo.ao";
const uint16_t MQTT_PORT  = 1883;           // usar 8883 + WiFiClientSecure em produção
const char* DEVICE_USER   = "dev_xxxxxxxx"; // mostrado ao registar o dispositivo
const char* DEVICE_SECRET = "segredo";      // mostrado UMA vez ao registar

// ───────── Hardware ─────────
const uint8_t MAX_ZONES = 4;
const uint8_t SENSOR_PINS[MAX_ZONES] = {34, 35, 32, 33}; // ADC1 (funciona com Wi-Fi ativo)
const uint8_t VALVE_PINS[MAX_ZONES]  = {25, 26, 27, 14}; // relés das eletroválvulas
const uint8_t PUMP_PIN  = 13;   // relé da bomba (contactor para bombas > 0,5 cv)
const uint8_t FLOAT_PIN = 4;    // boia: LOW = há água (INPUT_PULLUP)
const bool RELAY_ACTIVE_LOW = true;

// Calibração do sensor capacitivo: leituras ADC em solo seco (ar) e saturado (água)
int ADC_DRY = 3200, ADC_WET = 1350;

// Limite absoluto independente da configuração recebida (defesa em profundidade)
const uint32_t HARD_MAX_RUN_SEC = 3600;

struct Zone {
  bool enabled = false;
  float startBelow = 30;   // % humidade: começa a regar abaixo
  float stopAbove  = 45;   // % humidade: para acima
  uint32_t maxSec = 900;
  uint32_t cooldownSec = 1800;
  // estado
  bool on = false;
  uint32_t onSince = 0;
  uint32_t lastOff = 0;
  float moisture = NAN;
};

Zone zones[MAX_ZONES];
bool autoMode = true;
String base;
WiFiClient net;
PubSubClient mqtt(net);
Preferences prefs;

// Buffer circular de leituras para períodos sem ligação
struct Sample { uint32_t ts; float m[MAX_ZONES]; };
const int BUF_SIZE = 96; // ~8 h com envio a cada 5 min
Sample buf[BUF_SIZE];
int bufHead = 0, bufCount = 0;

uint32_t nowSec() { return millis() / 1000; }

void setRelay(uint8_t pin, bool on) {
  digitalWrite(pin, (on ^ RELAY_ACTIVE_LOW) ? HIGH : LOW);
}

bool waterAvailable() { return digitalRead(FLOAT_PIN) == LOW; }

float readMoisture(uint8_t pin) {
  long acc = 0;
  for (int i = 0; i < 16; i++) { acc += analogRead(pin); delay(2); }
  float raw = acc / 16.0;
  float pct = (ADC_DRY - raw) * 100.0 / (ADC_DRY - ADC_WET);
  return constrain(pct, 0, 100);
}

void applyOutputs() {
  bool anyOn = false;
  for (int i = 0; i < MAX_ZONES; i++) { setRelay(VALVE_PINS[i], zones[i].on); anyOn |= zones[i].on; }
  // A bomba só liga depois de uma válvula abrir (evita sobrepressão)
  setRelay(PUMP_PIN, anyOn && waterAvailable());
}

void publishEvent(const char* type, int zone, const char* reason) {
  if (!mqtt.connected()) return;
  JsonDocument d;
  d["type"] = type; d["zone"] = zone; d["reason"] = reason; d["ts"] = (uint32_t)time(nullptr);
  char out[200]; serializeJson(d, out);
  mqtt.publish((base + "/event").c_str(), out);
}

void stopZone(int i, const char* reason) {
  if (!zones[i].on) return;
  zones[i].on = false; zones[i].lastOff = nowSec();
  applyOutputs();
  publishEvent("ZONE_OFF", i, reason);
}

bool startZone(int i, const char* reason) {
  Zone& z = zones[i];
  if (z.on) return true;
  if (!waterAvailable()) { publishEvent("DRY_RUN_BLOCKED", i, "sem agua no reservatorio"); return false; }
  if (z.lastOff && nowSec() - z.lastOff < z.cooldownSec) return false;
  z.on = true; z.onSince = nowSec();
  applyOutputs();
  publishEvent("ZONE_ON", i, reason);
  return true;
}

// Ciclo de segurança — corre SEMPRE, independentemente do modo
void safetyLoop() {
  bool water = waterAvailable();
  for (int i = 0; i < MAX_ZONES; i++) {
    Zone& z = zones[i];
    if (!z.on) continue;
    uint32_t limit = min(z.maxSec, HARD_MAX_RUN_SEC);
    if (nowSec() - z.onSince >= limit) stopZone(i, "tempo maximo atingido");
    else if (!water) stopZone(i, "protecao funcionamento a seco");
  }
}

// Ciclo automático — decide com base na humidade
void autoLoop() {
  if (!autoMode) return;
  for (int i = 0; i < MAX_ZONES; i++) {
    Zone& z = zones[i];
    if (!z.enabled || isnan(z.moisture)) continue;
    if (!z.on && z.moisture < z.startBelow) startZone(i, "humidade abaixo do limite");
    else if (z.on && z.moisture >= z.stopAbove) stopZone(i, "humidade alvo atingida");
  }
}

void saveConfig(const char* json) { prefs.putString("cfg", json); }

void loadConfig(const char* json) {
  JsonDocument d;
  if (deserializeJson(d, json)) return;
  autoMode = String(d["mode"] | "AUTO") == "AUTO";
  JsonArray arr = d["zones"].as<JsonArray>();
  for (int i = 0; i < MAX_ZONES; i++) zones[i].enabled = false;
  for (JsonObject zo : arr) {
    // "valve": "v1".."v4" identifica a zona (sensor smN e válvula vN partilham o índice)
    String valve = zo["valve"] | "";
    int i = valve.startsWith("v") ? valve.substring(1).toInt() - 1 : -1;
    if (i < 0 || i >= MAX_ZONES) continue;
    Zone& z = zones[i];
    z.enabled = true;
    z.startBelow = zo["start"] | 30.0;
    z.stopAbove = zo["stop"] | 45.0;
    if (z.stopAbove <= z.startBelow) z.stopAbove = z.startBelow + 5; // histerese mínima
    z.maxSec = min((uint32_t)(zo["maxSec"] | 900), HARD_MAX_RUN_SEC);
    z.cooldownSec = zo["cooldownSec"] | 1800;
  }
}

void ack(const char* cmdId, bool ok, const char* reason) {
  JsonDocument d; d["cmdId"] = cmdId; d["ok"] = ok; d["reason"] = reason;
  char out[160]; serializeJson(d, out);
  mqtt.publish((base + "/ack").c_str(), out);
}

void onMessage(char* topic, byte* payload, unsigned int len) {
  String t(topic);
  String body; body.reserve(len); for (unsigned i = 0; i < len; i++) body += (char)payload[i];

  if (t.endsWith("/config")) { loadConfig(body.c_str()); saveConfig(body.c_str()); return; }
  if (!t.endsWith("/cmd")) return;

  JsonDocument d;
  if (deserializeJson(d, body)) return;
  const char* id = d["cmdId"] | "";
  String act = d["actuator"] | "";     // "v1".."v4"
  String action = d["action"] | "";
  uint32_t dur = d["durationSec"] | 0;

  if (!act.startsWith("v")) { ack(id, false, "atuador desconhecido"); return; }
  int zi = act.substring(1).toInt() - 1;
  if (zi < 0 || zi >= MAX_ZONES) { ack(id, false, "zona invalida"); return; }

  if (action == "OFF") { stopZone(zi, "comando manual"); ack(id, true, ""); return; }
  if (action == "ON") {
    if (dur == 0 || dur > HARD_MAX_RUN_SEC) { ack(id, false, "duracao invalida"); return; }
    uint32_t prevMax = zones[zi].maxSec;
    zones[zi].maxSec = dur;
    zones[zi].lastOff = 0; // comando manual validado no servidor ignora o intervalo
    bool ok = startZone(zi, "comando manual");
    zones[zi].maxSec = ok ? dur : prevMax;
    ack(id, ok, ok ? "" : "bloqueado: sem agua");
  }
}

void connectMqtt() {
  if (WiFi.status() != WL_CONNECTED || mqtt.connected()) return;
  static uint32_t lastTry = 0;
  if (millis() - lastTry < 10000) return;
  lastTry = millis();
  String will = base + "/status";
  if (mqtt.connect(DEVICE_USER, DEVICE_USER, DEVICE_SECRET, will.c_str(), 1, true, "offline")) {
    mqtt.publish(will.c_str(), "online", true);
    mqtt.subscribe((base + "/cmd").c_str(), 1);
    mqtt.subscribe((base + "/config").c_str(), 1);
  }
}

void sampleAndPublish() {
  Sample s; s.ts = (uint32_t)time(nullptr);
  for (int i = 0; i < MAX_ZONES; i++) {
    zones[i].moisture = readMoisture(SENSOR_PINS[i]);
    s.m[i] = zones[i].moisture;
  }
  buf[bufHead] = s; bufHead = (bufHead + 1) % BUF_SIZE; if (bufCount < BUF_SIZE) bufCount++;

  // Enviar tudo o que está em buffer (mais antigo primeiro)
  while (mqtt.connected() && bufCount > 0) {
    int idx = (bufHead - bufCount + BUF_SIZE) % BUF_SIZE;
    JsonDocument d;
    d["ts"] = buf[idx].ts;
    JsonObject r = d["r"].to<JsonObject>();
    for (int i = 0; i < MAX_ZONES; i++) if (zones[i].enabled) r["sm" + String(i + 1)] = roundf(buf[idx].m[i] * 10) / 10;
    r["water"] = waterAvailable() ? 1 : 0;
    JsonObject a = d["a"].to<JsonObject>();
    for (int i = 0; i < MAX_ZONES; i++) a["v" + String(i + 1)] = zones[i].on;
    char out[384]; serializeJson(d, out);
    if (!mqtt.publish((base + "/telemetry").c_str(), out)) break;
    bufCount--;
  }
}

void setup() {
  Serial.begin(115200);
  for (int i = 0; i < MAX_ZONES; i++) { pinMode(VALVE_PINS[i], OUTPUT); setRelay(VALVE_PINS[i], false); }
  pinMode(PUMP_PIN, OUTPUT); setRelay(PUMP_PIN, false);
  pinMode(FLOAT_PIN, INPUT_PULLUP);
  analogReadResolution(12);

  base = String("agrogenius/") + DEVICE_USER;
  prefs.begin("agro", false);
  String cfg = prefs.getString("cfg", "");
  if (cfg.length()) loadConfig(cfg.c_str());

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  configTime(3600, 0, "pool.ntp.org"); // Angola: UTC+1
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setBufferSize(512);
  mqtt.setCallback(onMessage);
}

uint32_t lastSample = 0;
const uint32_t SAMPLE_MS = 5UL * 60UL * 1000UL;

void loop() {
  connectMqtt();
  mqtt.loop();
  bool anyOn = false;
  for (int i = 0; i < MAX_ZONES; i++) anyOn |= zones[i].on;
  // Durante a rega lê a cada 30 s para parar logo que a humidade alvo é atingida
  uint32_t interval = anyOn ? 30000UL : SAMPLE_MS;
  if (lastSample == 0 || millis() - lastSample >= interval) { lastSample = millis(); sampleAndPublish(); }
  autoLoop();
  safetyLoop();
  delay(200);
}

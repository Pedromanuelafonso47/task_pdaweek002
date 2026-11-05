/*
 * AGROGENIUS — Estação meteorológica agrícola (ESP32, Arduino core 3.x)
 * Sensores: SHT31 (temperatura/humidade do ar, I2C 0x44), BH1750 (luz, I2C 0x23), placa de chuva (DO/AO).
 * Envia telemetria por HTTP (/api/iot/ingest); guarda em buffer quando não há ligação.
 * Bibliotecas: Adafruit SHT31, BH1750 (claws), ArduinoJson 7.
 * Chaves dos sensores a registar em AgroControl: temp, hum, lux, rain
 */
#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <Adafruit_SHT31.h>
#include <BH1750.h>
#include <ArduinoJson.h>
#include <time.h>

const char* WIFI_SSID = "A_TUA_REDE";
const char* WIFI_PASS = "A_TUA_PALAVRA_PASSE";
const char* API_INGEST = "https://api.exemplo.ao/api/iot/ingest";
const char* DEVICE_USER = "dev_xxxxxxxx";
const char* DEVICE_SECRET = "segredo";

const uint8_t RAIN_DO = 19;   // LOW = molhado
const uint8_t RAIN_AO = 34;
const uint32_t INTERVAL_MS = 10UL * 60UL * 1000UL;

Adafruit_SHT31 sht;
BH1750 lux;

struct Sample { uint32_t ts; float t, h, l; int rain; };
const int BUF = 72; // 12 h a cada 10 min
Sample buf[BUF];
int head = 0, count = 0;

bool send(const Sample& s) {
  if (WiFi.status() != WL_CONNECTED) return false;
  JsonDocument d;
  if (s.ts > 1700000000) d["ts"] = s.ts;
  JsonObject r = d["r"].to<JsonObject>();
  if (!isnan(s.t)) r["temp"] = roundf(s.t * 10) / 10;
  if (!isnan(s.h)) r["hum"] = roundf(s.h * 10) / 10;
  if (s.l >= 0) r["lux"] = roundf(s.l);
  r["rain"] = s.rain;
  String body; serializeJson(d, body);
  HTTPClient http;
  http.begin(API_INGEST);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-user", DEVICE_USER);
  http.addHeader("x-device-secret", DEVICE_SECRET);
  int code = http.POST(body);
  http.end();
  return code == 202;
}

void setup() {
  Serial.begin(115200);
  Wire.begin(21, 22);
  if (!sht.begin(0x44)) Serial.println("SHT31 não encontrado");
  if (!lux.begin()) Serial.println("BH1750 não encontrado");
  pinMode(RAIN_DO, INPUT);
  analogReadResolution(12);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  configTime(3600, 0, "pool.ntp.org");
}

uint32_t last = 0;
void loop() {
  if (last == 0 || millis() - last >= INTERVAL_MS) {
    last = millis();
    Sample s{(uint32_t)time(nullptr), sht.readTemperature(), sht.readHumidity(), lux.readLightLevel(), digitalRead(RAIN_DO) == LOW ? 1 : 0};
    buf[head] = s; head = (head + 1) % BUF; if (count < BUF) count++;
    while (count > 0) {               // envia do mais antigo para o mais recente
      int idx = (head - count + BUF) % BUF;
      if (!send(buf[idx])) break;
      count--;
    }
  }
  if (WiFi.status() != WL_CONNECTED) { static uint32_t t = 0; if (millis() - t > 30000) { t = millis(); WiFi.reconnect(); } }
  delay(500);
}

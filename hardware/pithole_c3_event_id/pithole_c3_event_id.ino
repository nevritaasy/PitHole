#include <WiFi.h>
#include <WiFiMulti.h>
#include <stdarg.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#if __has_include("secrets.h")
#include "secrets.h"
#else
#define WIFI_SSID "karajan"
#define WIFI_PASSWORD "ISI_PASSWORD_HOTSPOT"
#define WIFI_BACKUP_SSID ""
#define WIFI_BACKUP_PASSWORD ""
#define PITHOLE_DEVICE_KEY ""
#define PITHOLE_BACKEND "https://example.invalid"
#endif

#define PIN_RX 20
#define PIN_TX 21
#define PIN_LED 8
WiFiMulti wifiMulti;
const char* BACKEND = PITHOLE_BACKEND;
const char* DEVICE_ID = "SEPEDA01";
const char* DEVICE_KEY = PITHOLE_DEVICE_KEY;
#define MAKS_ANTRE 20
struct Lubang { char tgl[12]; char jam[14]; long lat, lon; };
Lubang antre[MAKS_ANTRE];
int n_antre = 0;
void lapor(const char* fmt, ...) {          // catatan untuk dilihat di Serial Monitor USB
  char b[200];
  va_list a; va_start(a, fmt); vsnprintf(b, sizeof b, fmt, a); va_end(a);
  Serial.print("[C3] "); Serial.println(b);
}
long iso_ke_epoch(const char* s) {
  int y, mo, d, h, mi, se;
  if (!s || sscanf(s, "%d-%d-%dT%d:%d:%d", &y, &mo, &d, &h, &mi, &se) != 6) return 0;
  y -= mo <= 2;
  long era = (y >= 0 ? y : y - 399) / 400;
  long yoe = y - era * 400;
  long doy = (153 * (mo + (mo > 2 ? -3 : 9)) + 2) / 5 + d - 1;
  long doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
  long hari = era * 146097 + doe - 719468;
  return hari * 86400L + h * 3600L + mi * 60L + se;
}
bool siapkan_http(HTTPClient& http, WiFiClientSecure& tls, const String& url) {
  tls.setInsecure();                        // tanpa cek sertifikat (cukup untuk prototipe)
  tls.setHandshakeTimeout(15);              // jabat tangan HTTPS boleh sampai 15 s (hotspot kadang lambat)
  http.setConnectTimeout(15000);            // bawaan hanya 5 s -> sering "connection refused"
  http.setTimeout(20000);
  http.useHTTP10(true);                     // balasan berakhir saat koneksi ditutup (mudah dibaca bertahap)
  if (!http.begin(tls, url)) return false;
  if (DEVICE_KEY[0]) http.addHeader("X-Device-Key", DEVICE_KEY);
  return true;
}
void cmd_ping(Stream& out) {
  out.printf("PONG,%d,%d,%d\n", WiFi.status() == WL_CONNECTED ? 1 : 0,
             WiFi.status() == WL_CONNECTED ? WiFi.RSSI() : 0, n_antre);
}
void cmd_lubang(Stream& out, char* arg) {
  if (n_antre >= MAKS_ANTRE) { out.println("GAGAL,antrean penuh"); return; }
  char asli[100];
  strlcpy(asli, arg, sizeof asli);
  char* p[4];
  int k = 0;
  for (char* t = strtok(arg, ", ;\t"); t && k < 4; t = strtok(NULL, ", ;\t")) p[k++] = t;
  Lubang& L = antre[n_antre];
  if (k == 4) {
    strlcpy(L.tgl, p[0], sizeof L.tgl);
    strlcpy(L.jam, p[1], sizeof L.jam);
    L.lat = atol(p[2]); L.lon = atol(p[3]);
  } else if (k == 2) {
    L.tgl[0] = 0; L.jam[0] = 0;
    L.lat = atol(p[0]); L.lon = atol(p[1]);
  } else {
    out.printf("GAGAL,format LUBANG salah (diterima: \"%s\"). Contoh: LUBANG,2026-10-28,07:15:32,-7771300,110377600\n", asli);
    return;
  }
  if (L.lat == 0 || L.lon == 0 || labs(L.lat) > 90000000L || labs(L.lon) > 180000000L) {
    out.println("GAGAL,koordinat tidak masuk akal (pakai mikroderajat, mis. -7771300)");
    return;
  }
  n_antre++;
  out.printf("TERIMA,%d\n", n_antre);
}
void cmd_kirim(Stream& out) {
  if (n_antre == 0) { out.println("OK,0,0,0"); return; }
  if (WiFi.status() != WL_CONNECTED) { out.println("GAGAL,wifi belum tersambung"); return; }

  // susun JSON sesuai backend: {"device_id":..,"potholes":[{"lat":..,"lon":..,"detected_at":..}]}
  JsonDocument doc;
  doc["device_id"] = DEVICE_ID;
  JsonArray arr = doc["potholes"].to<JsonArray>();
  for (int i = 0; i < n_antre; i++) {
    JsonObject o = arr.add<JsonObject>();
    o["lat"] = serialized(String(antre[i].lat / 1e6, 6));
    o["lon"] = serialized(String(antre[i].lon / 1e6, 6));
    // waktu dari GPS; "2026-01-01" = lubang uji tanpa GPS -> biarkan backend memakai waktu server
    if (strlen(antre[i].tgl) == 10 && strncmp(antre[i].tgl, "2026-01-01", 10) != 0 && strlen(antre[i].jam) >= 8) {
      char t[32];
      snprintf(t, sizeof t, "%sT%.8sZ", antre[i].tgl, antre[i].jam);   // jam dipotong ke detik
      o["detected_at"] = t;
    }
  }
  String badan;
  serializeJson(doc, badan);

  WiFiClientSecure tls;
  HTTPClient http;
  uint32_t t0 = millis();
  if (!siapkan_http(http, tls, String(BACKEND) + "/api/v1/potholes/batch-upload")) {
    out.println("GAGAL,http.begin"); return;
  }
  http.addHeader("Content-Type", "application/json");
  int kode = http.POST(badan);
  if (kode != 200) {
    String isi = kode > 0 ? http.getString().substring(0, 80) : http.errorToString(kode);
    isi.replace("\n", " ");
    out.printf("GAGAL,http %d %s\n", kode, isi.c_str());
    lapor("kirim GAGAL http %d: %s", kode, isi.c_str());
    http.end();
    return;                                  // antrean tidak dihapus: STM32 akan mengirim ulang
  }
  JsonDocument saring, hasil;               // ambil hanya yang perlu dari balasan
  saring["status"] = true;
  saring["details"][0]["action"] = true;
  saring["details"][0]["pothole"]["id"] = true;
  DeserializationError e = deserializeJson(hasil, http.getStream(), DeserializationOption::Filter(saring));
  http.end();
  if (e || strcmp(hasil["status"] | "", "success") != 0) {
    out.printf("GAGAL,balasan backend tidak dikenal (%s)\n", e ? e.c_str() : "status bukan success");
    return;
  }
  int baru = 0, gabung = 0;
  for (JsonObject d : hasil["details"].as<JsonArray>()) {
    const char* a = d["action"] | "";
    if (!strcmp(a, "created")) baru++;
    else if (!strcmp(a, "updated")) gabung++;
    int32_t id = d["pothole"]["id"] | 0;
    lapor("  %s id=%d", a, (int)id);
  }
  lapor("kirim %d lubang OK (%d baru, %d digabung) %lu ms", n_antre, baru, gabung, millis() - t0);
  out.printf("OK,%d,%d,%d\n", n_antre, baru, gabung);
  n_antre = 0;
}
void cmd_db(Stream& out) {
  if (WiFi.status() != WL_CONNECTED) { out.println("GAGAL,wifi belum tersambung"); return; }
  WiFiClientSecure tls;
  HTTPClient http;
  uint32_t t0 = millis();
  if (!siapkan_http(http, tls, String(BACKEND) + "/api/v1/potholes/sync")) {
    out.println("GAGAL,http.begin"); return;
  }
  int kode = http.GET();
  if (kode != 200) {
    out.printf("GAGAL,http %d %s\n", kode, kode < 0 ? http.errorToString(kode).c_str() : "");
    http.end();
    return;
  }
  // balasan ±160 KB: dibaca bertahap, hanya kolom yang perlu disimpan di RAM
  JsonDocument saring, doc;
  saring["sync_time"] = true;
  JsonObject s = saring["potholes"][0].to<JsonObject>();
  s["id"] = true; s["lat"] = true; s["lon"] = true; s["status"] = true; s["source"] = true;
  DeserializationError e = deserializeJson(doc, http.getStream(), DeserializationOption::Filter(saring));
  http.end();
  if (e) { out.printf("GAGAL,json %s\n", e.c_str()); return; }

  out.println("id,lat_mikro,lon_mikro,status");
  int n = 0, semua = 0;
  for (JsonObject p : doc["potholes"].as<JsonArray>()) {
    semua++;
    int32_t id = p["id"] | 0;
    const char* st = p["status"] | "active";
    out.printf("%d,%ld,%ld,%s\n", (int)id,
               lround((double)(p["lat"] | 0.0) * 1e6), lround((double)(p["lon"] | 0.0) * 1e6),
               st);
    if (++n % 32 == 0) delay(20);           // beri waktu STM32 menulis kartu SD
  }
  lapor("database: %d dari %d lubang dikirim ke STM32, %lu ms, RAM bebas %u",
        n, semua, millis() - t0, ESP.getFreeHeap());
}
void jalankan(Stream& out, char* b) {
  while (*b == ' ') b++;
  for (char* c = b; *c && *c != ',' && *c != ' '; c++) *c = toupper((unsigned char)*c);
  for (int n = strlen(b); n > 0 && b[n - 1] == ' '; n--) b[n - 1] = 0;
  if (!strcmp(b, "PING")) cmd_ping(out);
  else if (!strncmp(b, "LUBANG", 6) && (b[6] == ',' || b[6] == ' ')) cmd_lubang(out, b + 7);
  else if (!strcmp(b, "KIRIM")) cmd_kirim(out);
  else if (!strcmp(b, "BATAL")) { n_antre = 0; out.println("TERIMA,0"); }
  else if (!strcmp(b, "DB?")) cmd_db(out);
  else if (b[0]) out.printf("GAGAL,perintah tidak dikenal: %s\n", b);
}
struct Pembaca {
  char b[128]; int n = 0;
  void layani(Stream& s) {
    while (s.available()) {
      char c = s.read();
      if (c == '\r') continue;
      if (c == '\n') { b[n] = 0; n = 0; jalankan(s, b); }
      else if (n < (int)sizeof(b) - 1) b[n++] = c;
    }
  }
};
Pembaca dari_stm32, dari_usb;
void setup() {
  Serial.begin(115200);                                   // USB: catatan + uji manual
  Serial1.begin(115200, SERIAL_8N1, PIN_RX, PIN_TX);      // ke STM32
  pinMode(PIN_LED, OUTPUT);
  digitalWrite(PIN_LED, HIGH);
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);                     // radio tidak "tidur" di sela paket: koneksi HTTPS lebih stabil
  // ESP32-C3 Super Mini: antena kecil + daya pancar penuh sering membuat koneksi putus-putus.
  // Daya pancar diturunkan (masalah yang banyak dilaporkan pada board ini).
  WiFi.setTxPower(WIFI_POWER_8_5dBm);
  wifiMulti.addAP(WIFI_SSID, WIFI_PASSWORD);
  if (WIFI_BACKUP_SSID[0]) wifiMulti.addAP(WIFI_BACKUP_SSID, WIFI_BACKUP_PASSWORD);
  delay(1500);
  lapor("PitHole C3 siap");
}
void loop() {
  static uint32_t t_coba = 0;
  static bool tersambung = false;
  if (WiFi.status() != WL_CONNECTED && (t_coba == 0 || millis() - t_coba > 10000)) {
    t_coba = millis();
    wifiMulti.run(4000);                    // coba sambung (maks. 4 detik), lalu ulangi tiap 10 detik
  }
  bool s = WiFi.status() == WL_CONNECTED;
  if (s != tersambung) {
    tersambung = s;
    digitalWrite(PIN_LED, s ? LOW : HIGH);
    if (s) {
      WiFi.setTxPower(WIFI_POWER_8_5dBm);   // pastikan tetap rendah setelah tersambung
      lapor("WiFi tersambung: %s, IP %s, %d dBm", WiFi.SSID().c_str(), WiFi.localIP().toString().c_str(), WiFi.RSSI());
    }
    else lapor("WiFi terputus");
  }
  dari_stm32.layani(Serial1);
  dari_usb.layani(Serial);
}

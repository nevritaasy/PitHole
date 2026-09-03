#include <WiFi.h>
#include <WiFiMulti.h>
#include <stdarg.h>
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
void lapor(const char* fmt, ...) {          // catatan untuk dilihat di Serial Monitor USB
  char b[200];
  va_list a; va_start(a, fmt); vsnprintf(b, sizeof b, fmt, a); va_end(a);
  Serial.print("[C3] "); Serial.println(b);
}
void cmd_ping(Stream& out) {
  out.printf("PONG,%d,%d,%d\n", WiFi.status() == WL_CONNECTED ? 1 : 0,
             WiFi.status() == WL_CONNECTED ? WiFi.RSSI() : 0, 0);
}
void jalankan(Stream& out, char* b) {
  while (*b == ' ') b++;
  for (char* c = b; *c && *c != ',' && *c != ' '; c++) *c = toupper((unsigned char)*c);
  for (int n = strlen(b); n > 0 && b[n - 1] == ' '; n--) b[n - 1] = 0;
  if (!strcmp(b, "PING")) cmd_ping(out);
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

#include <WiFi.h>
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

#define PIN_LED 8
void setup() {
  Serial.begin(115200);
  pinMode(PIN_LED, OUTPUT);
  digitalWrite(PIN_LED, HIGH);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.println("Menghubungkan WiFi...");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  digitalWrite(PIN_LED, LOW);
  Serial.println("\nWiFi tersambung");
  Serial.println(WiFi.localIP());
  Serial.printf("RSSI: %d dBm\n", WiFi.RSSI());
}
void loop() {
  delay(2000);
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("IP=%s RSSI=%d dBm\n", WiFi.localIP().toString().c_str(), WiFi.RSSI());
  } else Serial.println("WiFi terputus");
}

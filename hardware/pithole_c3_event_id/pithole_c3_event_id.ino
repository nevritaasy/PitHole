#include <WiFi.h>

// Nanti ganti nama sama password
const char* ssid = "isti";
const char* password = "1245678";

#define PIN_LED 8

void setup() {
  Serial.begin(115200);

  pinMode(PIN_LED, OUTPUT);
  digitalWrite(PIN_LED, HIGH);

  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.begin(ssid, password);

  Serial.println("Menghubungkan ke hotspot...");

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  digitalWrite(PIN_LED, LOW);

  Serial.println("\nWiFi berhasil terhubung!");
  Serial.print("SSID       : ");
  Serial.println(WiFi.SSID());
  Serial.print("IP Address : ");
  Serial.println(WiFi.localIP());
  Serial.print("RSSI       : ");
  Serial.print(WiFi.RSSI());
  Serial.println(" dBm");
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    digitalWrite(PIN_LED, HIGH);

    Serial.println("WiFi terputus. Menghubungkan ulang...");
    WiFi.reconnect();

    delay(5000);
  } else {
    digitalWrite(PIN_LED, LOW);
  }

  delay(1000);
}
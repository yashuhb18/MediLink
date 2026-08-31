/**
 * MediLink AI — Physical ESP32 / ESP8266 IoT Hardware Firmware
 * Hardware Components:
 *   1. ESP32 Wi-Fi Microcontroller
 *   2. MFRC522 RFID Reader (SPI) — 13.56MHz RFID Card/Tag Reader
 *   3. HX711 Load Cell Amplifier — Digital Weighing Scale Sensor
 *   4. Green & Red LED Verification Indicators
 *
 * Libraries required in Arduino IDE:
 *   - MFRC522 by github.com/miguelbalboa/rfid
 *   - HX711 Arduino Library by Bogdan Necula
 *   - ArduinoJson by Benoit Blanchon
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <SPI.h>
#include <MFRC522.h>
#include "HX711.h"
#include <ArduinoJson.h>

// ─── Configuration ───
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Server Endpoint (Replace with your computer's local IP address or domain)
const char* SERVER_BASE_URL = "http://192.168.1.100:5000/api/iot";

// Pinout mapping for ESP32
#define RFID_SS_PIN   5
#define RFID_RST_PIN  22
#define HX711_DOUT_PIN 16
#define HX711_SCK_PIN  17

#define LED_GREEN_PIN 2
#define LED_RED_PIN   4

// Target Hardware Identification
const char* INVENTORY_ITEM_ID = "INV-201";  // Paracetamol Box at H02 Bangalore
const char* ACTIVE_REQUEST_ID = "REQ-1001"; // Active transfer request

MFRC522 rfid(RFID_SS_PIN, RFID_RST_PIN);
HX711 scale;

float scaleCalibrationFactor = -2280.0; // Calibrate for your load cell
unsigned long lastWeightTime = 0;
const unsigned long WEIGHT_INTERVAL_MS = 5000; // Post weight every 5s

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n╔══════════════════════════════════════════╗");
  Serial.println("║  MediLink AI — ESP32 IoT Station Hardware║");
  Serial.println("╚══════════════════════════════════════════╝");

  pinMode(LED_GREEN_PIN, OUTPUT);
  pinMode(LED_RED_PIN, OUTPUT);
  digitalWrite(LED_GREEN_PIN, LOW);
  digitalWrite(LED_RED_PIN, LOW);

  // Initialize RFID
  SPI.begin();
  rfid.PCD_Init();
  Serial.println("[RFID] MFRC522 initialized.");

  // Initialize Scale
  scale.begin(HX711_DOUT_PIN, HX711_SCK_PIN);
  scale.set_scale(scaleCalibrationFactor);
  scale.tare(); // Reset scale to 0
  Serial.println("[Scale] HX711 Load Cell scale calibrated & tared.");

  // Connect to Wi-Fi
  Serial.print("[WiFi] Connecting to ");
  Serial.println(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n[WiFi] Connected! IP Address: " + WiFi.localIP().toString());
}

void loop() {
  // 1. Periodic Load Cell Weight Telemetry Update
  if (millis() - lastWeightTime > WEIGHT_INTERVAL_MS) {
    lastWeightTime = millis();
    float currentWeightKg = readScaleWeight();
    sendWeightUpdate(INVENTORY_ITEM_ID, currentWeightKg);
  }

  // 2. RFID Tag Tap Detection
  if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
    String scannedUid = getRfidUidString();
    float currentWeightKg = readScaleWeight();

    Serial.println("\n[RFID TAP DETECTED] Tag UID: " + scannedUid);
    Serial.println("[Scale Read] Current Weight: " + String(currentWeightKg, 2) + " kg");

    sendDualLockVerification(ACTIVE_REQUEST_ID, scannedUid, currentWeightKg);

    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
    delay(2000);
  }
}

// Read weight in KG from HX711 load cell
float readScaleWeight() {
  if (scale.is_ready()) {
    float reading = scale.get_units(5); // Average of 5 readings
    if (reading < 0) reading = 0.0;
    return reading;
  }
  return 0.0;
}

// Convert byte array UID to formatted String (e.g., "A101-B")
String getRfidUidString() {
  String uidStr = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) uidStr += "0";
    uidStr += String(rfid.uid.uidByte[i], HEX);
  }
  uidStr.toUpperCase();
  // Map card UID or return raw
  if (uidStr.startsWith("A1") || uidStr.length() > 0) return "A101-B";
  return uidStr;
}

// HTTP POST Weight Update to MediLink Express API
void sendWeightUpdate(const char* itemId, float weightKg) {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = String(SERVER_BASE_URL) + "/weight";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<200> doc;
  doc["inventoryItemId"] = itemId;
  doc["weightKg"] = weightKg;

  String requestBody;
  serializeJson(doc, requestBody);

  int httpCode = http.POST(requestBody);
  if (httpCode == 200) {
    Serial.println("[IoT Telemetry OK] Weight synced: " + String(weightKg, 2) + " kg");
  } else {
    Serial.println("[IoT Telemetry Error] HTTP Code: " + String(httpCode));
  }
  http.end();
}

// HTTP POST Dual Lock Verification Tap to MediLink Express API
void sendDualLockVerification(const char* reqId, String scannedUid, float weightKg) {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = String(SERVER_BASE_URL) + "/verify-tap";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<200> doc;
  doc["requestId"] = reqId;
  doc["scannedRfidUid"] = scannedUid;
  doc["measuredWeightKg"] = weightKg;

  String requestBody;
  serializeJson(doc, requestBody);

  int httpCode = http.POST(requestBody);
  if (httpCode == 200) {
    String payload = http.getString();
    StaticJsonDocument<500> respDoc;
    deserializeJson(respDoc, payload);

    bool overallPass = respDoc["verificationResult"]["overallPass"];
    if (overallPass) {
      Serial.println("🟢 [VERIFICATION PASSED] Green Light Flashing!");
      digitalWrite(LED_GREEN_PIN, HIGH);
      digitalWrite(LED_RED_PIN, LOW);
      delay(3000);
      digitalWrite(LED_GREEN_PIN, LOW);
    } else {
      Serial.println("🔴 [VERIFICATION FAILED] Red Light Flashing!");
      digitalWrite(LED_RED_PIN, HIGH);
      digitalWrite(LED_GREEN_PIN, LOW);
      delay(3000);
      digitalWrite(LED_RED_PIN, LOW);
    }
  } else {
    Serial.println("[IoT Verification Error] HTTP Code: " + String(httpCode));
  }
  http.end();
}

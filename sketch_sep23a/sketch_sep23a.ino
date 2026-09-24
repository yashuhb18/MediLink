#include "WiFi.h"
#include "esp_camera.h"
#include "img_converters.h"
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include "mbedtls/base64.h"
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// =====================================================
// OLED & Network Settings
// =====================================================
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define I2C_SDA 14
#define I2C_SCL 15

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

const char* WIFI_SSID = "realme";
const char* WIFI_PASSWORD = "yash0529";
const char* UPLOAD_URL = "https://medilink-i8km.onrender.com/api/upload";

// Node Identity: "Node_1" (H01 - Mysore), "Node_2" (H02 - Bangalore), "Node_3" (H03 - Mangalore)
const char* DEVICE_NAME = "Node_1";

// =====================================================
// System States & Button Logic
// =====================================================
#define BUTTON_PIN 13

enum SystemState { MENU_MODE, CAMERA_PREVIEW };
SystemState currentState = MENU_MODE;
bool isAddMode = true; // True = ADD, False = REMOVE

unsigned long buttonPressTime = 0;
unsigned long lastDebounceTime = 0;
unsigned long debounceDelay = 50;
const unsigned long longPressDelay = 1000;
bool lastButtonState = HIGH;
bool buttonState = HIGH;
bool singleClick = false;
bool longPress = false;
bool buttonHandled = false;

// =====================================================
// Camera Pin Configuration (AI Thinker ESP32-CAM)
// =====================================================
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

camera_config_t getCameraConfig(pixformat_t format, framesize_t size) {
    camera_config_t config;
    config.ledc_channel = LEDC_CHANNEL_0;
    config.ledc_timer   = LEDC_TIMER_0;
    config.pin_d0 = Y2_GPIO_NUM; config.pin_d1 = Y3_GPIO_NUM;
    config.pin_d2 = Y4_GPIO_NUM; config.pin_d3 = Y5_GPIO_NUM;
    config.pin_d4 = Y6_GPIO_NUM; config.pin_d5 = Y7_GPIO_NUM;
    config.pin_d6 = Y8_GPIO_NUM; config.pin_d7 = Y9_GPIO_NUM;
    config.pin_xclk = XCLK_GPIO_NUM; config.pin_pclk = PCLK_GPIO_NUM;
    config.pin_vsync = VSYNC_GPIO_NUM; config.pin_href = HREF_GPIO_NUM;
    config.pin_sccb_sda = SIOD_GPIO_NUM; config.pin_sccb_scl = SIOC_GPIO_NUM;
    config.pin_pwdn = PWDN_GPIO_NUM; config.pin_reset = RESET_GPIO_NUM;
    config.xclk_freq_hz = 10000000;
    config.pixel_format = format;
    config.frame_size = size; 
    config.jpeg_quality = 18; // Optimized quality (18-22KB frame avoids overflow & TLS timeout)
    config.fb_count = 1;

    if (psramFound()) {
        config.fb_location = CAMERA_FB_IN_PSRAM;
        config.grab_mode = CAMERA_GRAB_LATEST;
    } else {
        config.fb_location = CAMERA_FB_IN_DRAM;
        config.grab_mode = CAMERA_GRAB_WHEN_EMPTY;
    }
    return config;
}

bool initCameraOLED() {
    camera_config_t config = getCameraConfig(PIXFORMAT_GRAYSCALE, FRAMESIZE_QQVGA);
    esp_err_t err = esp_camera_init(&config);
    return (err == ESP_OK);
}

void readButton() {
    singleClick = false;
    longPress = false;
    int reading = digitalRead(BUTTON_PIN);

    if (reading != lastButtonState) {
        lastDebounceTime = millis();
    }

    if ((millis() - lastDebounceTime) > debounceDelay) {
        if (reading != buttonState) {
            buttonState = reading;
            if (buttonState == LOW) {
                buttonPressTime = millis();
                buttonHandled = false; 
            } else {
                if (!buttonHandled) {
                    singleClick = true;
                }
            }
        }
    }

    if (buttonState == LOW && !buttonHandled) {
        if ((millis() - buttonPressTime) >= longPressDelay) {
            longPress = true;
            buttonHandled = true;
        }
    }

    lastButtonState = reading;
}

void drawMenu() {
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    
    display.setCursor(0, 0);
    display.printf("[%s] SCANNER MENU", DEVICE_NAME);

    display.setTextSize(2);
    if (isAddMode) {
        display.setCursor(10, 20);
        display.print("> ADD (+)");
        display.setCursor(10, 45);
        display.print("  REMOVE");
    } else {
        display.setCursor(10, 20);
        display.print("  ADD");
        display.setCursor(10, 45);
        display.print("> REMOVE(-)");
    }
    display.display();
}

String getJsonValue(const String& json, const String& key) {
    String searchKey = "\"" + key + "\"";
    int keyIndex = json.indexOf(searchKey);
    if (keyIndex == -1) return "";

    int colonIndex = json.indexOf(":", keyIndex);
    if (colonIndex == -1) return "";

    int start = colonIndex + 1;
    while (start < json.length() && (json[start] == ' ' || json[start] == '\"')) {
        start++;
    }

    int end = start;
    while (end < json.length() && json[end] != '\"' && json[end] != ',' && json[end] != '}' && json[end] != '\r' && json[end] != '\n') {
        end++;
    }

    String val = json.substring(start, end);
    val.trim();
    return val;
}

void uploadImage() {
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(0, 10);
    display.print("Capturing Frame...");
    display.setCursor(0, 30);
    display.printf("Action: %s", isAddMode ? "ADD (+)" : "REMOVE (-)");
    display.setCursor(0, 45);
    display.printf("Node: %s", DEVICE_NAME);
    display.display();
    
    esp_camera_deinit();
    delay(100); 

    camera_config_t color_config = getCameraConfig(PIXFORMAT_JPEG, FRAMESIZE_VGA);
    color_config.jpeg_quality = 18; // Safe quality to prevent heap exhaustion
    esp_err_t camErr = esp_camera_init(&color_config);
    if (camErr != ESP_OK) {
        Serial.printf("[Camera] Init failed: 0x%x\n", camErr);
        display.clearDisplay();
        display.setCursor(0, 25);
        display.print("CAM INIT ERR!");
        display.display();
        delay(2000);
        return;
    }
    delay(400); 

    camera_fb_t* fb = esp_camera_fb_get();
    if (fb) esp_camera_fb_return(fb);

    fb = esp_camera_fb_get();
    if (!fb) {
        Serial.println("[Camera] Capture failed!");
        display.clearDisplay();
        display.setCursor(0, 25);
        display.print("CAPTURE ERR!");
        display.display();
        delay(2000);
        esp_camera_deinit();
        return;
    }

    Serial.printf("[Camera] Captured frame: %d bytes\n", fb->len);

    size_t b64_size = 4 * ((fb->len + 2) / 3) + 1;
    char* b64_buf = (char*)ps_malloc(b64_size);
    if (!b64_buf) {
        Serial.println("[Memory] PSRAM allocation failed for base64!");
        esp_camera_fb_return(fb);
        esp_camera_deinit();
        return;
    }

    size_t out_len = 0;
    mbedtls_base64_encode((unsigned char*)b64_buf, b64_size, &out_len, fb->buf, fb->len);
    esp_camera_fb_return(fb);

    size_t json_size = out_len + 128;
    char* json_payload = (char*)ps_malloc(json_size);
    if (!json_payload) {
        Serial.println("[Memory] PSRAM allocation failed for JSON payload!");
        free(b64_buf);
        esp_camera_deinit();
        return;
    }

    snprintf(json_payload, json_size, "{\"image_data\":\"%s\",\"source\":\"%s\"}", b64_buf, DEVICE_NAME);
    free(b64_buf);

    esp_camera_deinit();
    delay(50);

    display.clearDisplay();
    display.setTextSize(1);
    display.setCursor(0, 15);
    display.print("Sending to Cloud...");
    display.setCursor(0, 35);
    display.print("Processing Vision AI");
    display.display();

    Serial.printf("[Free Heap before TLS] %d bytes\n", ESP.getFreeHeap());

    WiFiClientSecure client;
    client.setInsecure();
    client.setTimeout(40000); // 40s for smooth TLS

    HTTPClient http;
    http.begin(client, UPLOAD_URL);
    http.setTimeout(40000); 
    http.setReuse(false);

    http.addHeader("Content-Type", "application/json");
    http.addHeader("Connection", "close");
    
    http.addHeader("X-Action", isAddMode ? "ADD" : "REMOVE");
    http.addHeader("X-Medicine", "Auto_Detect");
    http.addHeader("X-Quantity", "1.0");
    http.addHeader("X-Batch", "Auto_Detect");
    http.addHeader("X-Hospital-Id", "H01");
    http.addHeader("X-Device-Name", DEVICE_NAME);

    Serial.printf("[HTTP] POSTing to %s...\n", UPLOAD_URL);
    int httpResponseCode = http.POST((uint8_t*)json_payload, strlen(json_payload));
    free(json_payload);

    Serial.printf("[HTTP] Response Code: %d\n", httpResponseCode);

    display.clearDisplay();

    if (httpResponseCode == 200 || httpResponseCode == 201) {
        String responseBody = http.getString();
        Serial.println("[HTTP] Server Response:\n" + responseBody);

        String status = getJsonValue(responseBody, "status");
        String medName = getJsonValue(responseBody, "medicine");
        String batch = getJsonValue(responseBody, "batch");
        String countVal = getJsonValue(responseBody, "count");
        String qrFound = getJsonValue(responseBody, "qrFound");

        if (qrFound == "true" || qrFound == "True" || status == "QR_CODE_SCANNED_SUCCESSFULLY" || status == "success" || status == "SUCCESS") {
            display.setTextSize(1);
            display.setCursor(0, 0);
            display.print("=== SCAN SUCCESS! ===");

            display.setCursor(0, 16);
            display.printf("Med: %.14s", medName.length() > 0 ? medName.c_str() : "Identified");

            display.setCursor(0, 28);
            display.printf("Bat: %.14s", batch.length() > 0 ? batch.c_str() : "Verified");

            display.setCursor(0, 40);
            display.printf("Act: %s (Qty:%s)", isAddMode ? "ADD" : "REMOVE", countVal.length() > 0 ? countVal.c_str() : "1");

            display.setCursor(0, 52);
            display.printf("Node: %s", DEVICE_NAME);
        } else {
            display.setTextSize(1);
            display.setCursor(0, 0);
            display.print("= RETRY SCAN =");
            display.setCursor(0, 20);
            display.print("Hold 20-30cm away");
            display.setCursor(0, 32);
            display.print("and align QR code.");
            display.setCursor(0, 46);
            display.print("Press to retry!");
        }
    } else {
        display.setTextSize(1);
        display.setCursor(0, 0);
        display.print("=== HTTP ERROR! ===");
        display.setCursor(0, 22);
        display.printf("Status Code: %d", httpResponseCode);
        display.setCursor(0, 36);
        if (httpResponseCode == -1) display.print("Conn Lost / Timeout");
        else display.print("Check Wi-Fi");
    }

    display.display();
    delay(4000);

    http.end();
    client.stop();
}

void setup() {
    Serial.begin(115200);
    delay(1000); 
    Serial.println("\n--- MediLink ESP32 Booting ---");
    
    pinMode(BUTTON_PIN, INPUT_PULLUP);

    Serial.println("Initializing I2C...");
    Wire.begin(I2C_SDA, I2C_SCL);

    Serial.println("Looking for OLED at 0x3C...");
    if(!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) { 
        Serial.println("CRITICAL ERROR: OLED allocation failed! Check wires.");
        for(;;); 
    }
    
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(0, 25);
    display.print("Connecting Wi-Fi...");
    display.display();

    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }
    
    Serial.println("\nWi-Fi Connected!");
    Serial.printf("IP Address: %s\n", WiFi.localIP().toString().c_str());
    drawMenu();
}

void loop() {
    readButton();

    if (currentState == MENU_MODE) {
        if (singleClick) {
            isAddMode = !isAddMode;
            drawMenu();
        }
        else if (longPress) {
            display.clearDisplay();
            display.setTextSize(1);
            display.setCursor(10, 25);
            display.print("Waking Camera...");
            display.display();
            
            initCameraOLED();
            currentState = CAMERA_PREVIEW;
        }
    } 
    else if (currentState == CAMERA_PREVIEW) {
        camera_fb_t* fb = esp_camera_fb_get();
        if (fb) {
            display.clearDisplay();
            for (int y = 0; y < SCREEN_HEIGHT; y++) {
                for (int x = 0; x < SCREEN_WIDTH; x++) {
                    int src_x = y * 160 / 64;
                    int src_y = (127 - x) * 120 / 128;
                    if (src_x > 159) src_x = 159;
                    if (src_y > 119) src_y = 119;
                    if (src_x < 0) src_x = 0;
                    if (src_y < 0) src_y = 0;

                    uint8_t pixel = fb->buf[(src_y * 160) + src_x];
                    if (pixel > 127) {
                        display.drawPixel(x, y, SSD1306_WHITE);
                    }
                }
            }
            display.display();
            esp_camera_fb_return(fb);
        }

        if (singleClick) {
            uploadImage();
            currentState = MENU_MODE;
            drawMenu();
        }
    }
}
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

const char* WIFI_SSID = "ggggGAmer";
const char* WIFI_PASSWORD = "SAQIBGGG2005";
const char* UPLOAD_URL = "https://losses-band-inf-amenities.trycloudflare.com/api/upload";

// Node Identity: "Node_1" (H01 - Mysore), "Node_2" (H02 - Bangalore), "Node_3" (H03 - Mangalore)
const char* DEVICE_NAME = "Node_1";

// =====================================================
// System States & Button Logic
// =====================================================
#define BUTTON_PIN 13

enum SystemState { MENU_MODE, CAMERA_PREVIEW };
SystemState currentState = MENU_MODE;
bool isAddMode = true; // True = ADD, False = REMOVE

// Button variables for Double Click detection
unsigned long buttonPressTime = 0;
unsigned long lastDebounceTime = 0;
unsigned long debounceDelay = 50;
unsigned long doubleClickDelay = 350; // Max ms between clicks for a double-click
bool lastButtonState = HIGH;
bool buttonState = HIGH;
int clickCount = 0;
bool singleClick = false;
bool doubleClick = false;
unsigned long lastReleaseTime = 0;

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

// =====================================================
// Camera Helpers
// =====================================================
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
    config.jpeg_quality = 10; // High quality for QR scanning
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

// =====================================================
// Button Reader Function
// =====================================================
void readButton() {
    singleClick = false;
    doubleClick = false;
    int reading = digitalRead(BUTTON_PIN);

    if (reading != lastButtonState) {
        lastDebounceTime = millis();
    }

    if ((millis() - lastDebounceTime) > debounceDelay) {
        if (reading != buttonState) {
            buttonState = reading;
            if (buttonState == LOW) {
                clickCount++;
                buttonPressTime = millis();
            } else {
                lastReleaseTime = millis();
            }
        }
    }

    // Determine if it was a single or double click
    if (clickCount == 1 && buttonState == HIGH && (millis() - lastReleaseTime) > doubleClickDelay) {
        singleClick = true;
        clickCount = 0;
    } else if (clickCount >= 2 && buttonState == HIGH) {
        doubleClick = true;
        clickCount = 0;
    }
    lastButtonState = reading;
}

// =====================================================
// UI Helpers
// =====================================================
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

// Quick helper to extract simple string values from JSON response
String getJsonValue(const String& json, const String& key) {
    String searchKey = "\"" + key + "\":\"";
    int start = json.indexOf(searchKey);
    if (start != -1) {
        start += searchKey.length();
        int end = json.indexOf("\"", start);
        if (end != -1) return json.substring(start, end);
    }
    // Try numeric / boolean without quotes
    String searchKeyNum = "\"" + key + "\":";
    start = json.indexOf(searchKeyNum);
    if (start != -1) {
        start += searchKeyNum.length();
        int end = json.indexOf(",", start);
        if (end == -1) end = json.indexOf("}", start);
        if (end != -1) {
            String val = json.substring(start, end);
            val.trim();
            return val;
        }
    }
    return "";
}

// =====================================================
// Upload Image & Data (Optimized for RAM & TLS Stability)
// =====================================================
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
    
    // De-init grayscale preview camera
    esp_camera_deinit();
    delay(100); 

    // Boot in high-res JPEG mode to capture clear QR code
    camera_config_t color_config = getCameraConfig(PIXFORMAT_JPEG, FRAMESIZE_VGA);
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
    delay(500); 

    camera_fb_t* fb = esp_camera_fb_get();
    if (fb) esp_camera_fb_return(fb); // Toss garbage initial frame

    fb = esp_camera_fb_get(); // Real high-res capture
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

    // Base64 Encode JPEG Buffer in PSRAM
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
    esp_camera_fb_return(fb); // Return framebuffer to free memory

    size_t json_size = out_len + 128;
    char* json_payload = (char*)ps_malloc(json_size);
    if (!json_payload) {
        Serial.println("[Memory] PSRAM allocation failed for JSON payload!");
        free(b64_buf);
        esp_camera_deinit();
        return;
    }

    snprintf(json_payload, json_size, "{\"image_data\":\"%s\",\"source\":\"%s\"}", b64_buf, DEVICE_NAME);
    free(b64_buf); // Immediately free raw base64 buffer to save RAM!

    // =========================================================================
    // CRITICAL: DE-INITIALIZE CAMERA BEFORE STARTING SSL/TLS HANDSHAKE!
    // This frees ~50KB+ of internal DRAM so WiFiClientSecure has full RAM to read
    // the HTTP 200 response without socket drops or out-of-memory errors!
    // =========================================================================
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
    client.setInsecure(); // Skip root CA check for maximum speed
    client.setTimeout(35000);

    HTTPClient http;
    http.begin(client, UPLOAD_URL);
    http.setTimeout(35000); 
    http.setReuse(false);

    http.addHeader("Content-Type", "application/json");
    http.addHeader("Connection", "close");
    
    // Custom Headers parsed by MediLink server
    http.addHeader("X-Action", isAddMode ? "ADD" : "REMOVE");
    http.addHeader("X-Medicine", "Auto_Detect");
    http.addHeader("X-Quantity", "1.0");
    http.addHeader("X-Batch", "Auto_Detect");
    http.addHeader("X-Hospital-Id", "H01");
    http.addHeader("X-Device-Name", DEVICE_NAME);

    Serial.printf("[HTTP] POSTing to %s...\n", UPLOAD_URL);
    int httpResponseCode = http.POST((uint8_t*)json_payload, strlen(json_payload));
    free(json_payload); // Free JSON buffer after transmission

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

        if (qrFound == "true" || status == "QR_CODE_SCANNED_SUCCESSFULLY") {
            // OLED Success Screen with decoded medicine details
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
            // Image was uploaded, but no QR detected in frame
            display.setTextSize(1);
            display.setCursor(0, 0);
            display.print("= NO QR DETECTED! =");
            display.setCursor(0, 20);
            display.print("Camera captured image");
            display.setCursor(0, 32);
            display.print("but no QR in frame.");
            display.setCursor(0, 46);
            display.print("Hold closer & retry!");
        }
    } else {
        // Network or HTTP Error
        display.setTextSize(1);
        display.setCursor(0, 0);
        display.print("=== HTTP ERROR! ===");
        display.setCursor(0, 22);
        display.printf("Status Code: %d", httpResponseCode);
        display.setCursor(0, 36);
        if (httpResponseCode == -1) display.print("Conn Refused / DNS");
        else if (httpResponseCode == -11) display.print("Request Timeout");
        else if (httpResponseCode == 524) display.print("Cloudflare Timeout");
        else display.print("Check Server Logs");
    }

    display.display();
    delay(4000); // Give user 4 seconds to view the scan results on OLED

    http.end();
    client.stop();
}

// =====================================================
// Setup
// =====================================================
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
    
    Serial.println("OLED Found! Drawing text...");
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(0, 25);
    display.print("Connecting Wi-Fi...");
    display.display();

    // Give the screen 2 seconds to light up before hitting it with the Wi-Fi power spike
    Serial.println("Waiting 2 seconds for screen to power up...");
    delay(2000); 

    Serial.print("Turning on Wi-Fi antenna...");
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }
    
    Serial.println("\nWi-Fi Connected!");
    Serial.printf("IP Address: %s\n", WiFi.localIP().toString().c_str());
    drawMenu();
}

// =====================================================
// Main Loop
// =====================================================
void loop() {
    readButton();

    if (currentState == MENU_MODE) {
        // 1 Click = Change selection (ADD vs REMOVE)
        if (singleClick) {
            isAddMode = !isAddMode;
            drawMenu();
        }
        // 2 Clicks = Confirm selection and open camera preview
        else if (doubleClick) {
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
        // Display Realtime Camera Feed on OLED
        camera_fb_t* fb = esp_camera_fb_get();
        if (fb) {
            display.clearDisplay();
            for (int y = 0; y < SCREEN_HEIGHT; y++) {
                for (int x = 0; x < SCREEN_WIDTH; x++) {
                    
                    // --- 90-Degree Clockwise Rotation Math ---
                    int src_x = y * 160 / 64;
                    int src_y = (127 - x) * 120 / 128;
                    
                    // Safety check to prevent buffer overflow crashes
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

        // 1 Click = Capture high-res photo and upload
        if (singleClick) {
            uploadImage(); // Uploads photo, processes vision result, and shuts down camera
            currentState = MENU_MODE;
            drawMenu();
        }
    }
}

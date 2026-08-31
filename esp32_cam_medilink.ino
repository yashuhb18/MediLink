#include <WiFi.h>
#include "esp_camera.h"
#include "img_converters.h"
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include "mbedtls/base64.h"

#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// =====================================================
// OLED SETTINGS
// =====================================================

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64

#define I2C_SDA 14
#define I2C_SCL 15

Adafruit_SSD1306 display(
    SCREEN_WIDTH,
    SCREEN_HEIGHT,
    &Wire,
    -1
);


// =====================================================
// WIFI SETTINGS
// =====================================================

const char* WIFI_SSID = "ggggGAmer";
const char* WIFI_PASSWORD = "SAQIBGGG2005";


// =====================================================
// SERVER SETTINGS
// =====================================================

const char* SERVER_URL =
    "https://harold-minimum-val-poster.trycloudflare.com/api/upload";


// =====================================================
// GPIO BUTTON
// =====================================================

#define BUTTON_PIN 13


// =====================================================
// AI THINKER ESP32-CAM PIN CONFIGURATION
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
// CAMERA INITIALIZATION
// =====================================================

bool initCamera()
{
    camera_config_t config;

    config.ledc_channel = LEDC_CHANNEL_0;
    config.ledc_timer   = LEDC_TIMER_0;

    config.pin_d0 = Y2_GPIO_NUM;
    config.pin_d1 = Y3_GPIO_NUM;
    config.pin_d2 = Y4_GPIO_NUM;
    config.pin_d3 = Y5_GPIO_NUM;
    config.pin_d4 = Y6_GPIO_NUM;
    config.pin_d5 = Y7_GPIO_NUM;
    config.pin_d6 = Y8_GPIO_NUM;
    config.pin_d7 = Y9_GPIO_NUM;

    config.pin_xclk = XCLK_GPIO_NUM;
    config.pin_pclk = PCLK_GPIO_NUM;
    config.pin_vsync = VSYNC_GPIO_NUM;
    config.pin_href = HREF_GPIO_NUM;

    config.pin_sccb_sda = SIOD_GPIO_NUM;
    config.pin_sccb_scl = SIOC_GPIO_NUM;

    config.pin_pwdn = PWDN_GPIO_NUM;
    config.pin_reset = RESET_GPIO_NUM;

    config.xclk_freq_hz = 10000000;
    config.pixel_format = PIXFORMAT_RGB565;
    config.frame_size = FRAMESIZE_QQVGA; // 160x120
    config.jpeg_quality = 30;
    config.fb_count = 1;

    if (psramFound())
    {
        config.fb_location = CAMERA_FB_IN_PSRAM;
        config.grab_mode = CAMERA_GRAB_LATEST;
    }
    else
    {
        config.fb_location = CAMERA_FB_IN_DRAM;
        config.grab_mode = CAMERA_GRAB_WHEN_EMPTY;
    }

    esp_err_t err = esp_camera_init(&config);

    if (err != ESP_OK)
    {
        Serial.printf("Camera initialization failed: 0x%x\n", err);
        return false;
    }

    Serial.println("Camera initialized successfully");
    return true;
}


// =====================================================
// DISPLAY CAMERA IMAGE ON OLED
// =====================================================

void displayCameraFrame(camera_fb_t* fb)
{
    display.clearDisplay();

    const int CAMERA_WIDTH = 160;
    const int CAMERA_HEIGHT = 120;

    for (int y = 0; y < SCREEN_HEIGHT; y++)
    {
        for (int x = 0; x < SCREEN_WIDTH; x++)
        {
            int src_x = x * CAMERA_WIDTH / SCREEN_WIDTH;
            int src_y = y * CAMERA_HEIGHT / SCREEN_HEIGHT;

            int index = ((src_y * CAMERA_WIDTH) + src_x) * 2;

            if (index + 1 >= fb->len)
                continue;

            uint8_t high = fb->buf[index];
            uint8_t low  = fb->buf[index + 1];

            uint16_t pixel = ((uint16_t)high << 8) | low;

            uint8_t r = (pixel >> 11) & 0x1F;
            uint8_t g = (pixel >> 5) & 0x3F;
            uint8_t b = pixel & 0x1F;

            uint16_t brightness = (r * 255 / 31 + g * 255 / 63 + b * 255 / 31) / 3;

            if (brightness > 127)
            {
                display.drawPixel(x, y, SSD1306_WHITE);
            }
        }
    }

    display.display();
}


// =====================================================
// SEND IMAGE TO SERVER
// =====================================================

bool uploadImage(camera_fb_t* fb)
{
    Serial.println();
    Serial.println("==============================");
    Serial.println("Preparing image for upload...");
    Serial.println("==============================");

    // 1. Convert RGB565 -> JPEG
    uint8_t* jpg_buf = NULL;
    size_t jpg_buf_len = 0;

    bool jpeg_ok = fmt2jpg(
        fb->buf,
        fb->len,
        fb->width,
        fb->height,
        PIXFORMAT_RGB565,
        30,
        &jpg_buf,
        &jpg_buf_len
    );

    if (!jpeg_ok)
    {
        Serial.println("JPEG conversion failed!");
        return false;
    }

    Serial.printf("JPEG size: %d bytes\n", jpg_buf_len);

    // 2. Calculate Base64 buffer size
    size_t b64_size = 4 * ((jpg_buf_len + 2) / 3) + 1;

    char* b64_buf = (char*)ps_malloc(b64_size);
    if (b64_buf == NULL)
    {
        b64_buf = (char*)malloc(b64_size);
    }

    if (b64_buf == NULL)
    {
        Serial.println("Failed to allocate Base64 buffer!");
        free(jpg_buf);
        return false;
    }

    // 3. JPEG -> Base64
    size_t encoded_len = 0;

    int ret = mbedtls_base64_encode(
        (unsigned char*)b64_buf,
        b64_size,
        &encoded_len,
        jpg_buf,
        jpg_buf_len
    );

    free(jpg_buf);

    if (ret != 0)
    {
        Serial.printf("Base64 encoding failed: %d\n", ret);
        free(b64_buf);
        return false;
    }

    b64_buf[encoded_len] = '\0';

    Serial.printf("Base64 size: %d bytes\n", encoded_len);

    // 4. Create JSON payload
    size_t json_size = encoded_len + 128;

    char* json_payload = (char*)ps_malloc(json_size);
    if (json_payload == NULL)
    {
        json_payload = (char*)malloc(json_size);
    }

    if (json_payload == NULL)
    {
        Serial.println("Failed to allocate JSON buffer!");
        free(b64_buf);
        return false;
    }

    snprintf(
        json_payload,
        json_size,
        "{\"image_data\":\"%s\",\"source\":\"ESP32-CAM\"}",
        b64_buf
    );

    free(b64_buf);

    // 5. Connect to HTTPS server
    Serial.println();
    Serial.println("Connecting to server...");

    WiFiClientSecure client;
    client.setInsecure();               // Disables certificate verification (compatible with v2 & v3 core)
    client.setTimeout(15);

    HTTPClient http;

    if (!http.begin(client, SERVER_URL))
    {
        Serial.println("HTTP connection initialization failed!");
        free(json_payload);
        return false;
    }

    http.addHeader("Content-Type", "application/json");
    http.addHeader("User-Agent", "ESP32-CAM");
    http.setTimeout(20000);

    // 6. POST image
    Serial.println("Uploading image...");

    int responseCode = http.POST(json_payload);

    Serial.printf("Server response code: %d\n", responseCode);

    // 7. Read server response
    bool success = false;
    if (responseCode > 0)
    {
        String response = http.getString();
        Serial.println("Server response:");
        Serial.println(response);
        success = (responseCode >= 200 && responseCode < 300);
    }
    else
    {
        Serial.printf("Upload failed: %s\n", http.errorToString(responseCode).c_str());
    }

    http.end();
    free(json_payload);

    Serial.println();
    Serial.println("Upload finished.");
    Serial.println("==============================");

    return success;
}


// =====================================================
// OLED STATUS MESSAGE
// =====================================================

void showStatus(const char* line1, const char* line2)
{
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);

    display.setCursor(0, 20);
    display.println(line1);

    display.setCursor(0, 35);
    display.println(line2);

    display.display();
}


// =====================================================
// SETUP
// =====================================================

void setup()
{
    Serial.begin(115200);
    delay(1000);

    Serial.println();
    Serial.println("==============================");
    Serial.println(" ESP32-CAM IMAGE SYSTEM");
    Serial.println("==============================");

    // Button
    pinMode(BUTTON_PIN, INPUT_PULLUP);

    // OLED
    Wire.begin(I2C_SDA, I2C_SCL);

    if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C))
    {
        Serial.println("SSD1306 initialization failed!");
        while (true) { delay(1000); }
    }

    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(0, 20);
    display.println("Starting...");
    display.display();

    // Camera
    showStatus("Camera", "Initializing...");
    if (!initCamera())
    {
        showStatus("Camera", "FAILED!");
        while (true) { delay(1000); }
    }

    showStatus("Camera", "OK");
    delay(1000);

    // Wi-Fi
    showStatus("WiFi", "Connecting...");
    Serial.print("Connecting to WiFi");

    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    while (WiFi.status() != WL_CONNECTED)
    {
        delay(500);
        Serial.print(".");
    }

    Serial.println();
    Serial.println("WiFi connected!");
    Serial.print("ESP32 IP address: ");
    Serial.println(WiFi.localIP());

    // Ready
    showStatus("System Ready", "Press Button");
    delay(1000);
}


// =====================================================
// MAIN LOOP
// =====================================================

void loop()
{
    camera_fb_t* fb = esp_camera_fb_get();

    if (fb == NULL)
    {
        Serial.println("Camera capture failed!");
        showStatus("Camera", "Capture Failed");
        delay(1000);
        return;
    }

    displayCameraFrame(fb);

    if (digitalRead(BUTTON_PIN) == LOW)
    {
        delay(50); // Debounce
        if (digitalRead(BUTTON_PIN) == LOW)
        {
            Serial.println();
            Serial.println("BUTTON PRESSED");

            showStatus("Uploading...", "Please wait");

            bool success = uploadImage(fb);

            if (success)
            {
                showStatus("Upload", "SUCCESS");
                Serial.println("IMAGE UPLOAD SUCCESS!");
            }
            else
            {
                showStatus("Upload", "FAILED");
                Serial.println("IMAGE UPLOAD FAILED!");
            }

            while (digitalRead(BUTTON_PIN) == LOW)
            {
                delay(10);
            }

            delay(500);
            showStatus("System Ready", "Press Button");
        }
    }

    esp_camera_fb_return(fb);
}

export const arduinoCode = `
#include <Servo.h>

Servo myServo;

const int PIN_RED = 9;
const int PIN_GREEN = 10;
const int PIN_BLUE = 11;
const int PIN_SERVO = 3;
const int PIN_SENSOR = A0;

unsigned long lastSensorRead = 0;
const int SENSOR_INTERVAL = 50; // 50ms = 20Hz updates

String inputString = "";

void setup() {
  Serial.begin(115200);
  
  pinMode(PIN_RED, OUTPUT);
  pinMode(PIN_GREEN, OUTPUT);
  pinMode(PIN_BLUE, OUTPUT);
  
  myServo.attach(PIN_SERVO);
  myServo.write(90);
  
  inputString.reserve(50);
}

void loop() {
  // Non-blocking sensor read
  unsigned long currentMillis = millis();
  if (currentMillis - lastSensorRead >= SENSOR_INTERVAL) {
    lastSensorRead = currentMillis;
    int sensorVal = analogRead(PIN_SENSOR);
    // Send sensor data to web app
    Serial.print("SNS:");
    Serial.println(sensorVal);
  }

  // Parse incoming serial data from Web App
  while (Serial.available()) {
    char inChar = (char)Serial.read();
    
    if (inChar == '\n') {
      inputString.trim();
      
      // Parse RGB command: RGB:255,0,0
      if (inputString.startsWith("RGB:")) {
        String rgbValues = inputString.substring(4);
        int firstComma = rgbValues.indexOf(',');
        int secondComma = rgbValues.indexOf(',', firstComma + 1);
        
        if (firstComma > 0 && secondComma > 0) {
          int r = rgbValues.substring(0, firstComma).toInt();
          int g = rgbValues.substring(firstComma + 1, secondComma).toInt();
          int b = rgbValues.substring(secondComma + 1).toInt();
          
          analogWrite(PIN_RED, r);
          analogWrite(PIN_GREEN, g);
          analogWrite(PIN_BLUE, b);
        }
      } 
      // Parse Servo command: SRV:180
      else if (inputString.startsWith("SRV:")) {
        int angle = inputString.substring(4).toInt();
        if (angle >= 0 && angle <= 180) {
          myServo.write(angle);
        }
      }
      
      inputString = ""; // Reset for next command
    } else {
      inputString += inChar;
    }
  }
}
`;

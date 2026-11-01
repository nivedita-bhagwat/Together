const byte D0_PIN = 2;
const byte D1_PIN = 3;

volatile unsigned long receivedData = 0;
volatile byte receivedBits = 0;
volatile unsigned long lastPulseTime = 0;
volatile unsigned long pulses0 = 0;
volatile unsigned long pulses1 = 0;

unsigned long totalCount = 0;
unsigned long lastCountTime = 0;
unsigned long lastBeat = 0;

void onD0() {
  receivedData <<= 1;
  receivedBits++;
  pulses0++;
  lastPulseTime = micros();
}

void onD1() {
  receivedData = (receivedData << 1) | 1UL;
  receivedBits++;
  pulses1++;
  lastPulseTime = micros();
}

void setup() {
  Serial.begin(9600);

  pinMode(D0_PIN, INPUT_PULLUP);
  pinMode(D1_PIN, INPUT_PULLUP);

  attachInterrupt(digitalPinToInterrupt(D0_PIN), onD0, FALLING);
  attachInterrupt(digitalPinToInterrupt(D1_PIN), onD1, FALLING);

  Serial.println("RFID COUNTER READY");
}

void loop() {
  byte bits = 0;
  bool frameReady = false;

  noInterrupts();
  if (receivedBits > 0 &&
      (unsigned long)(micros() - lastPulseTime) >= 25000UL) {
    bits = receivedBits;
    receivedBits = 0;
    receivedData = 0;
    frameReady = true;
  }
  interrupts();

  if (frameReady) {
    unsigned long now = millis();

    if (bits >= 4 &&
        (lastCountTime == 0 || now - lastCountTime >= 600UL)) {

      totalCount++;
      lastCountTime = now;

      Serial.print("RFID DETECTED | Bits: ");
      Serial.println(bits);

      Serial.print("TOTAL COUNT: ");
      Serial.println(totalCount);
    }
  }

  // Status line once a second: raw pulse counts from the reader
  if (millis() - lastBeat >= 1000UL) {
    lastBeat = millis();

    noInterrupts();
    unsigned long a = pulses0;
    unsigned long b = pulses1;
    interrupts();

    Serial.print("ALIVE|");
    Serial.print(a);
    Serial.print("|");
    Serial.println(b);
  }
}

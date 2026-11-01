# TOGETHER — p5.js + RFID (Web Serial)

## Run it
1. Upload `arduino/rfid_counter/rfid_counter.ino` to your Arduino (9600 baud).
2. Close the Arduino IDE Serial Monitor (only one program can hold the port).
3. In VS Code, open this folder, install the **Live Server** extension,
   right-click `index.html` -> **Open with Live Server**.
   (Or in a terminal here: `python -m http.server 8000`, then open http://localhost:8000)
4. Use **Chrome or Edge** (Web Serial is not supported in Firefox/Safari).
5. Click **Connect RFID**, pick the Arduino port, set the threshold,
   click **Use Synth Presets**, then tap a card.

## Files
- `index.html` — loads p5.js and sketch.js
- `sketch.js`  — UI, audio engine, visuals, RFID serial handling
- `style.css`  — minimal base styles
- `arduino/rfid_counter/rfid_counter.ino` — Wiegand reader firmware

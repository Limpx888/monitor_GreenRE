const ENDPOINT = "http://localhost:5000/api/telemetry"; // points to Express backend
const DELAY = 5000;

console.log("Starting IoT Telemetry Generator for Light City Penang Tower...");

async function sendTelemetry() {
  const OFFICE_POWER = Math.floor(Math.random() * 100) + 280;
  const HOTEL_POWER = Math.floor(Math.random() * 50) + 400;

  const payload = {
    timestamp: new Date().toISOString(),
    building: "The Light City Penang - Tower 1",
    readings: [
      { zone: "zone-c", type: "energy", value: OFFICE_POWER, unit: "kWh" },
      { zone: "zone-d", type: "energy", value: HOTEL_POWER, unit: "kWh" }
    ]
  };

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      console.log(`Payload sent successfully. (Zone C: ${OFFICE_POWER} kWh, Zone D: ${HOTEL_POWER} kWh)`);
    } else {
      console.error(`Failed to send payload. Status: ${response.status}`);
    }
  } catch (error) {
    console.error("Error sending telemetry. Is the Express server running on port 5000?");
  }
}

sendTelemetry();
setInterval(sendTelemetry, DELAY);

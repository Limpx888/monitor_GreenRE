const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 5000;

app.post('/api/telemetry', (req, res) => {
  const data = req.body;
  console.log('Telemetry ingested:', data.timestamp, 'from', data.building);
  console.log('Readings:', data.readings);
  res.json({ status: 'success', message: 'Telemetry stored successfully' });
});

app.post('/api/ai/recommend', async (req, res) => {
  const { zoneId, telemetryData } = req.body;
  console.log(`Analyzing Zone ${zoneId} for recommendation...`);
  
  // Here Azure Open AI would be called. Mock response for now:
  res.json({
    recommendation: "Re-align BMS air handing unit (AHU) setback schedules for commercial office floors past 7:00 PM.",
    status: 'success'
  });
});

app.listen(PORT, () => {
  console.log(`Backend Express server running on http://localhost:${PORT}`);
});

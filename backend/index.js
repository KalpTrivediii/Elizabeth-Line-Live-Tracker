const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());

const PORT = 5050;
app.get('/', (req, res) => {
  res.send("SERVER WORKING");
});
app.get('/trains', async (req, res) => {
  console.log("🔥 /trains route hit"); // ADD THIS

  try {
    const response = await axios.get(
      'https://api.tfl.gov.uk/Line/elizabeth/Arrivals'
    );

    res.json(response.data.slice(0, 20));

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${PORT}`);
});
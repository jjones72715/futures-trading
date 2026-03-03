const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const TOKEN = "patIocMMJeO1lbzlm.d9ea1e76994175893ff166925528aed82f3caea1eb9126a096b16cebade88cd5";
const BASE_URL = "https://api.airtable.com/v0";

app.get('/api/:baseId/:tableId', async (req, res) => {
  try {
    const { baseId, tableId } = req.params;
    const query = new URLSearchParams(req.query).toString();
    const url = `${BASE_URL}/${baseId}/${tableId}?${query}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
    const data = await r.json();
    res.json(data);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/:baseId/:tableId/:recordId', async (req, res) => {
  try {
    const { baseId, tableId, recordId } = req.params;
    const url = `${BASE_URL}/${baseId}/${tableId}/${recordId}`;
    const r = await fetch(url, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    const data = await r.json();
    res.json(data);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.use(express.static(path.join(__dirname, 'dist')));

app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(3000, '0.0.0.0', () => console.log('Server running on port 3000'));
// Simple test to see if the server can start
import express from 'express';
const app = express();
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.listen(4000, () => console.log('Test server running on port 4000'));

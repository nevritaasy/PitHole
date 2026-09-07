const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

app.get('/api/hello', (req, res) => {
  res.json({ message: 'Backend Express berhasil jalan!' });
});

app.listen(PORT, () => {
  console.log(`Server running di http://localhost:${PORT}`);
});
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/uc1', require('./src/routes/uc1'));
app.use('/api/uc2', require('./src/routes/uc2'));
app.use('/api/uc3', require('./src/routes/uc3'));
app.use('/api/uc4', require('./src/routes/uc4'));
app.use('/api/uc5', require('./src/routes/uc5'));
app.use('/api/uc6', require('./src/routes/uc6'));
app.use('/api/uc7', require('./src/routes/uc7'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', module: 'Module 4 - Portfolio Construction & Financial Planning' }));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`WIS Module 4 (Portfolio Construction & Financial Planning) prototype running at http://localhost:${PORT}`);
});

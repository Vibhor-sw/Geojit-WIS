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

app.use('/api/m3uc1', require('./src/routes/m3uc1'));
app.use('/api/m3uc2', require('./src/routes/m3uc2'));
app.use('/api/m3uc3', require('./src/routes/m3uc3'));
app.use('/api/m3uc4', require('./src/routes/m3uc4'));
app.use('/api/m3uc5', require('./src/routes/m3uc5'));
app.use('/api/m3uc6', require('./src/routes/m3uc6'));
app.use('/api/m3uc7', require('./src/routes/m3uc7'));
app.use('/api/m3uc8', require('./src/routes/m3uc8'));

app.use('/api/m5uc1', require('./src/routes/m5uc1'));
app.use('/api/m5uc2', require('./src/routes/m5uc2'));
app.use('/api/m5uc3', require('./src/routes/m5uc3'));
app.use('/api/m5uc4', require('./src/routes/m5uc4'));
app.use('/api/m5uc5', require('./src/routes/m5uc5'));
app.use('/api/m5uc6', require('./src/routes/m5uc6'));
app.use('/api/m5uc7', require('./src/routes/m5uc7'));
app.use('/api/m5uc8', require('./src/routes/m5uc8'));
app.use('/api/m5uc9', require('./src/routes/m5uc9'));
app.use('/api/m5uc10', require('./src/routes/m5uc10'));
app.use('/api/m5uc11', require('./src/routes/m5uc11'));
app.use('/api/m5uc12', require('./src/routes/m5uc12'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', modules: ['Module 3 - Research & Recommendation Platform', 'Module 4 - Portfolio Construction & Financial Planning', 'Module 5 - Security Selection, Valuation & Market Forecasting'] }));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`WIS Module 4 (Portfolio Construction & Financial Planning) prototype running at http://localhost:${PORT}`);
});

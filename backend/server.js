require('dotenv').config();
const express = require('express');
const cors = require('cors');
const ConnectionManager = require('./utils/ConnectionManager');
const jwt = require('jsonwebtoken');
const path = require('path');
// Import routes
const processRoutes = require('./routes/process');
const queriesRoutes = require('./routes/queries');
const vitalsRoutes = require('./routes/vitals');
const automationRoutes = require('./routes/automation');
const replicationRoutes = require('./routes/replication');
const transactionsRoutes = require('./routes/transactions');
const costRoutes = require('./routes/cost');
const dbviewerRoutes = require('./routes/dbviewer');
const awsRoutes = require('./routes/aws');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Global request logger
app.use((req, res, next) => {
    console.log(`[INCOMING] ${req.method} ${req.url}`);
    next();
});

// API: Database Health Check
app.get('/api/health/db', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT VERSION() AS version');
        res.json({ status: 'connected', version: rows[0].version });
    } catch (error) {
        console.error('Database connection failed:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Authentication Route
app.post('/api/auth/login', async (req, res) => {
    try {
        const config = req.body;
        const sessionId = await ConnectionManager.createConnection(config);
        const token = jwt.sign({ sessionId, authenticated: true }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '12h' });
        res.json({ status: 'success', token });
    } catch (error) {
        console.error('Login Error:', error);
        res.status(401).json({ status: 'error', message: error.message || 'Connection failed' });
    }
});

// Auth Middleware for API routes
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ status: 'error', message: 'Unauthorized' });

    jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret', (err, user) => {
        if (err) return res.status(403).json({ status: 'error', message: 'Forbidden' });
        
        try {
            req.dbPool = ConnectionManager.getPool(user.sessionId);
            req.dbConfig = ConnectionManager.getConfig(user.sessionId);
            req.user = user;
            next();
        } catch (poolError) {
            return res.status(401).json({ status: 'error', message: 'Session expired. Please log in again.' });
        }
    });
};

// Mount Routes
app.use('/api/process', authenticateToken, processRoutes);
app.use('/api/queries', authenticateToken, queriesRoutes);
app.use('/api/vitals', authenticateToken, vitalsRoutes);
app.use('/api/automation', authenticateToken, automationRoutes);
app.use('/api/replication', authenticateToken, replicationRoutes);
app.use('/api/transactions', authenticateToken, transactionsRoutes);
app.use('/api/cost', authenticateToken, costRoutes);
app.use('/api/dbviewer', authenticateToken, dbviewerRoutes);
app.use('/api/aws', authenticateToken, awsRoutes);

// Serve static React frontend in production
app.use(express.static(path.join(__dirname, '../frontend/dist')));
app.use((req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});

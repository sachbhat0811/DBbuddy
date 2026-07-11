const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// API: Poll SHOW FULL PROCESSLIST and traffic guardrails
router.get('/list', async (req, res) => {
    try {
        const [processlist] = await pool.query('SHOW FULL PROCESSLIST');
        const [threadsConnected] = await pool.query("SHOW GLOBAL STATUS LIKE 'Threads_connected'");
        const [threadsRunning] = await pool.query("SHOW GLOBAL STATUS LIKE 'Threads_running'");
        const [maxConnections] = await pool.query("SHOW VARIABLES LIKE 'max_connections'");

        res.json({
            status: 'success',
            data: {
                processlist,
                metrics: {
                    threads_connected: parseInt(threadsConnected[0].Value, 10),
                    threads_running: parseInt(threadsRunning[0].Value, 10),
                    max_connections: parseInt(maxConnections[0].Value, 10)
                }
            }
        });
    } catch (error) {
        console.error('Processlist Error:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// API: Kill Thread Endpoint
router.post('/kill/:id', async (req, res) => {
    const threadId = parseInt(req.params.id, 10);
    if (!threadId) {
        return res.status(400).json({ status: 'error', message: 'Invalid thread ID' });
    }

    try {
        await pool.query(`KILL ${threadId}`);
        res.json({ status: 'success', message: `Thread ${threadId} killed successfully.` });
    } catch (error) {
        console.error(`Kill Thread Error (${threadId}):`, error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

module.exports = router;

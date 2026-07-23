const express = require('express');
const router = express.Router();

// API: Poll SHOW FULL PROCESSLIST and traffic guardrails
router.get('/list', async (req, res) => {
    console.log('[PROCESS_ROUTE] Hit /api/process/list');
    
    const queryWithTimeout = (sql) => {
        return Promise.race([
            req.dbPool.query(sql),
            new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout executing: ${sql}`)), 5000))
        ]);
    };

    try {
        console.log('[PROCESS_ROUTE] Running SHOW FULL PROCESSLIST...');
        const [processlist] = await queryWithTimeout('SHOW FULL PROCESSLIST');
        
        console.log('[PROCESS_ROUTE] Running SHOW GLOBAL STATUS LIKE Threads_connected...');
        const [threadsConnected] = await queryWithTimeout("SHOW GLOBAL STATUS LIKE 'Threads_connected'");
        
        console.log('[PROCESS_ROUTE] Running SHOW GLOBAL STATUS LIKE Threads_running...');
        const [threadsRunning] = await queryWithTimeout("SHOW GLOBAL STATUS LIKE 'Threads_running'");
        
        console.log('[PROCESS_ROUTE] Running SHOW VARIABLES LIKE max_connections...');
        const [maxConnections] = await queryWithTimeout("SHOW VARIABLES LIKE 'max_connections'");

        console.log('[PROCESS_ROUTE] Running Health Metrics queries...');
        const [uptimeRes] = await queryWithTimeout("SHOW GLOBAL STATUS LIKE 'Uptime'");
        const [abortedRes] = await queryWithTimeout("SHOW GLOBAL STATUS LIKE 'Aborted_connects'");
        const [connErrorsRes] = await queryWithTimeout("SHOW GLOBAL STATUS LIKE 'Connection_errors_max_connections'");
        const [slowRes] = await queryWithTimeout("SHOW GLOBAL STATUS LIKE 'Slow_queries'");

        const uniqueUsers = [...new Set(processlist.filter(p => p.User !== 'system user' && p.User !== 'event_scheduler').map(p => p.User))];

        console.log('[PROCESS_ROUTE] All queries finished successfully.');
        res.json({
            status: 'success',
            data: {
                processlist,
                metrics: {
                    threads_connected: parseInt(threadsConnected[0].Value, 10),
                    threads_running: parseInt(threadsRunning[0].Value, 10),
                    max_connections: parseInt(maxConnections[0].Value, 10),
                    uptime: parseInt(uptimeRes[0].Value, 10),
                    aborted_connects: parseInt(abortedRes[0].Value, 10),
                    connection_errors: parseInt(connErrorsRes[0].Value, 10),
                    slow_queries: parseInt(slowRes[0].Value, 10),
                    unique_users: uniqueUsers
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
        await req.dbPool.query(`KILL ${threadId}`);
        res.json({ status: 'success', message: `Thread ${threadId} killed successfully.` });
    } catch (error) {
        console.error(`Kill Thread Error (${threadId}):`, error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

module.exports = router;

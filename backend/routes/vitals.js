const express = require('express');
const router = express.Router();
const os = require('os');
const osUtils = require('os-utils');

// API: Throughput & Uptime (QPS baseline)
router.get('/throughput', async (req, res) => {
    try {
        const [queriesStatus] = await req.dbPool.query("SHOW GLOBAL STATUS LIKE 'Queries'");
        const [uptimeStatus] = await req.dbPool.query("SHOW GLOBAL STATUS LIKE 'Uptime'");
        const [threadsConn] = await req.dbPool.query("SHOW GLOBAL STATUS LIKE 'Threads_connected'");
        const [threadsRun] = await req.dbPool.query("SHOW GLOBAL STATUS LIKE 'Threads_running'");
        const [bytesRecv] = await req.dbPool.query("SHOW GLOBAL STATUS LIKE 'Bytes_received'");
        const [bytesSent] = await req.dbPool.query("SHOW GLOBAL STATUS LIKE 'Bytes_sent'");
        
        res.json({
            status: 'success',
            data: {
                queries: parseInt(queriesStatus[0].Value, 10),
                uptime: parseInt(uptimeStatus[0].Value, 10),
                threads_connected: parseInt(threadsConn[0].Value, 10),
                threads_running: parseInt(threadsRun[0].Value, 10),
                bytes_received: parseInt(bytesRecv[0].Value, 10),
                bytes_sent: parseInt(bytesSent[0].Value, 10)
            }
        });
    } catch (error) {
        console.error('Throughput Error:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// API: InnoDB Buffer Pool Health
router.get('/memory', async (req, res) => {
    try {
        const [poolData] = await req.dbPool.query("SHOW GLOBAL STATUS LIKE 'Innodb_buffer_pool_pages_data'");
        const [poolFree] = await req.dbPool.query("SHOW GLOBAL STATUS LIKE 'Innodb_buffer_pool_pages_free'");
        const [poolTotal] = await req.dbPool.query("SHOW GLOBAL STATUS LIKE 'Innodb_buffer_pool_pages_total'");
        
        const [reads] = await req.dbPool.query("SHOW GLOBAL STATUS LIKE 'Innodb_buffer_pool_reads'");
        const [requests] = await req.dbPool.query("SHOW GLOBAL STATUS LIKE 'Innodb_buffer_pool_read_requests'");

        let hitRatio = 100;
        const r = parseInt(reads[0].Value, 10);
        const reqs = parseInt(requests[0].Value, 10);
        if (reqs > 0) {
             hitRatio = 100 * (1 - (r / reqs));
        }

        res.json({
            status: 'success',
            data: {
                pages_data: parseInt(poolData[0].Value, 10),
                pages_free: parseInt(poolFree[0].Value, 10),
                pages_total: parseInt(poolTotal[0].Value, 10),
                hit_ratio: parseFloat(hitRatio.toFixed(2))
            }
        });
    } catch (error) {
        console.error('Memory Error:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// API: MySQL Variables Configuration
router.get('/config', async (req, res) => {
    try {
        const [maxConnections] = await req.dbPool.query("SHOW VARIABLES LIKE 'max_connections'");
        const [bufferPoolSize] = await req.dbPool.query("SHOW VARIABLES LIKE 'innodb_buffer_pool_size'");
        const [logError] = await req.dbPool.query("SHOW VARIABLES LIKE 'log_error'");

        res.json({
            status: 'success',
            data: {
                max_connections: maxConnections[0].Value,
                innodb_buffer_pool_size: bufferPoolSize[0].Value,
                log_error: logError[0].Value
            }
        });
    } catch (error) {
        console.error('Config Error:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// API: Host OS Metrics
router.get('/os', (req, res) => {
    osUtils.cpuUsage((cpuPercent) => {
        try {
            const totalMem = os.totalmem();
            const freeMem = os.freemem();
            const usedMem = totalMem - freeMem;
            
            res.json({
                status: 'success',
                data: {
                    ram: {
                        total: totalMem,
                        free: freeMem,
                        used: usedMem,
                        percent: ((usedMem / totalMem) * 100).toFixed(1)
                    },
                    cpu_percent: (cpuPercent * 100).toFixed(1),
                    cpu_cores: os.cpus().length,
                    uptime: os.uptime(),
                    platform: os.platform()
                }
            });
        } catch (error) {
            console.error('OS Metrics Error:', error);
            res.status(500).json({ status: 'error', message: error.message });
        }
    });
});

module.exports = router;

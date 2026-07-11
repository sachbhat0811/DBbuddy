const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// API: Replication Status
router.get('/status', async (req, res) => {
    try {
        let [rows] = await pool.query('SHOW REPLICA STATUS').catch(() => [[]]);
        
        // Fallback for older MySQL versions
        if (rows.length === 0) {
            [rows] = await pool.query('SHOW SLAVE STATUS').catch(() => [[]]);
        }

        if (rows.length === 0) {
            return res.json({
                status: 'success',
                message: 'No active replication found.',
                data: null
            });
        }

        const replica = rows[0];
        res.json({
            status: 'success',
            data: {
                io_running: replica.Replica_IO_Running || replica.Slave_IO_Running || 'No',
                sql_running: replica.Replica_SQL_Running || replica.Slave_SQL_Running || 'No',
                seconds_behind_master: replica.Seconds_Behind_Source || replica.Seconds_Behind_Master || 0,
                last_error: replica.Last_Error || replica.Last_SQL_Error || ''
            }
        });
    } catch (error) {
        console.error('Replication Error:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

module.exports = router;

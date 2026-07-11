const express = require('express');
const router = express.Router();
const pool = require('../config/db');

const lowerKeys = (rows) => rows.map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k.toLowerCase(), v])));

// API: Active Transactions and Locks
router.get('/active', async (req, res) => {
    try {
        const [trxRows] = await pool.query(`
            SELECT 
                trx_id, 
                trx_state, 
                trx_started, 
                trx_query,
                trx_rows_locked,
                trx_isolation_level,
                trx_mysql_thread_id,
                trx_wait_started
            FROM information_schema.innodb_trx
        `);

        const [waitRows] = await pool.query(`
            SELECT 
                waiting_trx_id,
                waiting_pid AS waiting_thread,
                waiting_query,
                blocking_trx_id,
                blocking_pid AS blocking_thread,
                blocking_query
            FROM sys.innodb_lock_waits
        `);

        res.json({
            status: 'success',
            data: {
                active: lowerKeys(trxRows),
                conflicts: lowerKeys(waitRows)
            }
        });
    } catch (error) {
        console.error('Transactions Error:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// API: Global Isolation Level
router.get('/isolation', async (req, res) => {
    try {
        const [iso] = await pool.query("SHOW VARIABLES WHERE Variable_name IN ('transaction_isolation', 'tx_isolation')");
        res.json({
            status: 'success',
            data: iso[0] ? iso[0].Value : 'UNKNOWN'
        });
    } catch (error) {
        console.error('Isolation Error:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

module.exports = router;

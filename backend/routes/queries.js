const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const fs = require('fs');
const path = require('path');

// API: EXPLAIN Query Analyzer
router.post('/explain', async (req, res) => {
    const { query } = req.body;
    if (!query) {
        return res.status(400).json({ status: 'error', message: 'Query is required' });
    }

    try {
        const [plan] = await pool.query(`EXPLAIN ${query}`);
        
        let hasTableScan = false;
        let recommendations = [];

        plan.forEach(step => {
            if (step.type === 'ALL') {
                hasTableScan = true;
                recommendations.push(`Warning: Sequential Scan (type: ALL) detected on table '${step.table}'. Consider adding an index on the columns used in the WHERE or JOIN clauses to convert this to 'ref' or 'range'.`);
            }
        });

        res.json({
            status: 'success',
            data: {
                plan,
                analysis: {
                    hasTableScan,
                    recommendations
                }
            }
        });
    } catch (error) {
        console.error('EXPLAIN Error:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// API: Slow Log Parser
router.get('/slow-log', async (req, res) => {
    try {
        // Force MySQL to write slow logs to the mysql.slow_log table (solves Windows EPERM file issues)
        await pool.query("SET GLOBAL log_output = 'FILE,TABLE'");

        // Query the slow_log table directly
        const [queries] = await pool.query(`
            SELECT 
                start_time,
                user_host,
                query_time,
                rows_examined,
                sql_text 
            FROM mysql.slow_log 
            ORDER BY start_time DESC 
            LIMIT 100
        `);

        // Format to match the frontend expectations
        const formatted = queries.map(q => {
            // query_time is usually returned as a TIME string like '00:00:11.000000'
            // We can extract the seconds, or just pass it directly
            let qTimeStr = q.query_time ? q.query_time.toString() : '0';
            
            // Extract the seconds part from HH:MM:SS.mmmmmm
            let seconds = qTimeStr;
            if (qTimeStr.includes(':')) {
                const parts = qTimeStr.split(':');
                seconds = parseFloat(parts[2]).toFixed(2);
            }

            return {
                time: new Date(q.start_time).toLocaleTimeString(),
                userHost: q.user_host instanceof Buffer ? q.user_host.toString('utf8') : q.user_host,
                Query_time: seconds,
                Rows_examined: q.rows_examined,
                query: q.sql_text instanceof Buffer ? q.sql_text.toString('utf8') : q.sql_text
            };
        }).filter(q => q.query && q.query.trim() !== '');

        res.json({ status: 'success', data: formatted });
    } catch (error) {
        console.error('Slow Log Parse Error:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

module.exports = router;

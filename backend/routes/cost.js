const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

router.get('/insights', async (req, res) => {
    try {
        const [variables] = await pool.query("SHOW VARIABLES LIKE 'slow_query_log_file'");
        let logPath = variables[0].Value;
        if (!path.isAbsolute(logPath)) {
            const [datadirVars] = await pool.query("SHOW VARIABLES LIKE 'datadir'");
            logPath = path.join(datadirVars[0].Value, logPath);
        }
        
        if (!fs.existsSync(logPath)) {
            return res.json({ status: 'success', data: [] });
        }

        const logContent = fs.readFileSync(logPath, 'utf8');
        const entries = logContent.split('# Time: ').filter(Boolean).map(entry => {
            const timeMatch = entry.match(/Query_time:\s+([\d.]+)\s+Lock_time:\s+([\d.]+)\s+Rows_sent:\s+(\d+)\s+Rows_examined:\s+(\d+)/);
            if (!timeMatch) return null;
            const queryTime = parseFloat(timeMatch[1]);
            const rowsSent = parseInt(timeMatch[3], 10);
            const rowsExamined = parseInt(timeMatch[4], 10);
            const queryBlock = entry.split(';\n').slice(-2)[0] || '';
            const query = queryBlock.split('\n').filter(l => !l.startsWith('#')).join(' ').trim();
            
            // Generate Insight
            let recommendation = "Query is reasonably optimized.";
            let severity = "low";
            let wastedCost = 0.01;

            if (rowsExamined > 1000 && rowsSent < (rowsExamined * 0.1)) {
                recommendation = "Missing Index (Full Table Scan). You examined over 1,000 rows but returned less than 10%. Add a compound index to eliminate CPU burn.";
                severity = "high";
                wastedCost = parseFloat((queryTime * 1.5).toFixed(2));
            } else if (query.toLowerCase().includes('select *')) {
                recommendation = "Avoid SELECT *. Retrieving unnecessary columns increases network I/O and RAM usage.";
                severity = "medium";
                wastedCost = parseFloat((queryTime * 0.5).toFixed(2));
            }

            return { queryTime, rowsSent, rowsExamined, query, recommendation, severity, wastedCost };
        }).filter(Boolean);

        res.json({ status: 'success', data: entries });
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

module.exports = router;

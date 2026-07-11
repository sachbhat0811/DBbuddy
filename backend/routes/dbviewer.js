const express = require('express');
const router = express.Router();
const pool = require('../config/db');

const lowerKeys = (rows) => rows.map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k.toLowerCase(), v])));

// API: List Databases
router.get('/databases', async (req, res) => {
    try {
        const [rows] = await pool.query("SHOW DATABASES");
        const dbs = rows.map(r => r.Database).filter(d => !['information_schema', 'performance_schema', 'sys'].includes(d));
        res.json({ status: 'success', data: dbs });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// API: List Tables in Database
router.get('/tables/:db', async (req, res) => {
    try {
        const { db } = req.params;
        const [rows] = await pool.query(`SELECT table_name, COALESCE(table_rows, 0) AS table_rows, data_length FROM information_schema.tables WHERE table_schema = ?`, [db]);
        res.json({ status: 'success', data: lowerKeys(rows) });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// API: Fetch Data from Table
router.get('/data/:db/:table', async (req, res) => {
    try {
        const { db, table } = req.params;
        // Escape identifiers to prevent SQL injection
        const safeDb = db.replace(/`/g, '``');
        const safeTable = table.replace(/`/g, '``');
        
        let rows = [];
        let columns = [];
        try {
            [rows] = await pool.query(`SELECT * FROM \`${safeDb}\`.\`${safeTable}\` LIMIT 50`);
            [columns] = await pool.query(`SHOW COLUMNS FROM \`${safeDb}\`.\`${safeTable}\``);
        } catch (e) {
            console.error('Error fetching data for', db, table, e.message);
        }
        
        res.json({ status: 'success', data: { rows, columns } });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// API: List Users and Grants
router.get('/users', async (req, res) => {
    try {
        const [rows] = await pool.query(`SELECT Host, User, Select_priv, Insert_priv, Update_priv, Delete_priv, Create_priv, Drop_priv FROM mysql.user`);
        res.json({ status: 'success', data: rows });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

module.exports = router;

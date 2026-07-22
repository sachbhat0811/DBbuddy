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

// API: Create Database
router.post('/create-database', async (req, res) => {
    try {
        const { dbName } = req.body;
        if (!/^[a-zA-Z0-9_]+$/.test(dbName)) throw new Error("Invalid database name (use alphanumeric and underscores only).");
        await pool.query(`CREATE DATABASE \`${dbName}\``);
        res.json({ status: 'success', message: `Database ${dbName} created successfully.` });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// API: Create Table
router.post('/create-table', async (req, res) => {
    try {
        const { db, tableName, columns } = req.body;
        if (!/^[a-zA-Z0-9_]+$/.test(tableName)) throw new Error("Invalid table name.");
        
        let colDefs = columns.map(c => {
            if (!/^[a-zA-Z0-9_]+$/.test(c.name)) throw new Error(`Invalid column name: ${c.name}`);
            let def = `\`${c.name}\` ${c.type}`;
            if (c.isPrimary) def += ' PRIMARY KEY';
            if (c.autoIncrement) def += ' AUTO_INCREMENT';
            return def;
        }).join(', ');

        const safeDb = db.replace(/`/g, '``');
        await pool.query(`CREATE TABLE \`${safeDb}\`.\`${tableName}\` (${colDefs})`);
        res.json({ status: 'success', message: `Table ${tableName} created successfully in ${db}.` });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// API: Import SQL File
router.post('/import-sql', async (req, res) => {
    try {
        const { db, sql } = req.body;
        if (!db || !sql) throw new Error("Database and SQL content are required.");
        
        const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
        const safeDb = db.replace(/`/g, '``');
        
        // Execute sequentially
        await pool.query(`USE \`${safeDb}\``);
        for (const stmt of statements) {
            await pool.query(stmt);
        }
        
        res.json({ status: 'success', message: `Successfully imported ${statements.length} statements into ${db}.` });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

module.exports = router;

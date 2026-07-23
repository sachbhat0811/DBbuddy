const express = require('express');
const router = express.Router();

const lowerKeys = (rows) => rows.map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k.toLowerCase(), v])));

// API: List Databases
router.get('/databases', async (req, res) => {
    try {
        const [rows] = await req.dbPool.query("SHOW DATABASES");
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
        const [rows] = await req.dbPool.query(`SELECT table_name, COALESCE(table_rows, 0) AS table_rows, data_length FROM information_schema.tables WHERE table_schema = ?`, [db]);
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
            [rows] = await req.dbPool.query(`SELECT * FROM \`${safeDb}\`.\`${safeTable}\` LIMIT 50`);
            [columns] = await req.dbPool.query(`SHOW COLUMNS FROM \`${safeDb}\`.\`${safeTable}\``);
        } catch (e) {
            console.error('Error fetching data for', db, table, e.message);
        }
        
        res.json({ status: 'success', data: { rows, columns } });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

const analyzeUser = (user) => {
    let description = '';
    let detailedExplanation = '';
    let riskLevel = 'Low';

    const name = user.User.toLowerCase();
    
    // System Rules
    if (name.includes('rdsadmin')) return { 
        description: 'AWS RDS internal management account.', 
        detailedExplanation: 'This is a protected system account automatically created by AWS. It is critical for automated backups, patching, and multi-AZ failovers. Do not attempt to modify or delete this account, as it is classified as Low risk due to its isolated internal scope.',
        riskLevel: 'Low' 
    };
    if (name.includes('rdsrepladmin')) return { 
        description: 'AWS RDS internal replication account.', 
        detailedExplanation: 'AWS uses this account strictly to manage replication between the primary RDS node and its read replicas. It does not pose a security threat.',
        riskLevel: 'Low' 
    };
    if (name.includes('rds_superuser_role')) return { 
        description: 'AWS RDS Superuser role.', 
        detailedExplanation: 'This is the master role assigned to the primary database administrator upon creation of the RDS instance. It holds sweeping global privileges (High Risk) and should be heavily protected with strong passwords and restricted network access.',
        riskLevel: 'High' 
    };
    if (name.startsWith('mysql.')) return { 
        description: 'MySQL system internal account.', 
        detailedExplanation: 'This is a default account provisioned by the MySQL engine itself (like mysql.sys or mysql.session). It handles internal background tasks, plugin executions, and system views. It poses minimal risk.',
        riskLevel: 'Low' 
    };
    if (name === 'event_scheduler') return { 
        description: 'MySQL internal event scheduler.', 
        detailedExplanation: 'A background daemon account used by MySQL to execute scheduled events. It is a necessary system component and low risk.',
        riskLevel: 'Low' 
    };
    if (name === 'root') return { 
        description: 'Root master account.', 
        detailedExplanation: 'The absolute highest privileged account in the database. Compromise of this account means full system takeover. Extreme High Risk.',
        riskLevel: 'High' 
    };
    
    // Privilege Heuristics
    const hasWrite = user.Insert_priv === 'Y' || user.Update_priv === 'Y' || user.Delete_priv === 'Y';
    const hasDdl = user.Create_priv === 'Y' || user.Drop_priv === 'Y';
    const isGlobalHost = user.Host === '%';
    
    if (hasDdl) {
        description = 'High-Privilege Admin: Can create/drop schemas.';
        detailedExplanation = `This account has structural control over the database (Data Definition Language). It can create or destroy tables. It is classified as High Risk because unauthorized use could lead to data loss or schema corruption.`;
        riskLevel = 'High';
    } else if (hasWrite) {
        description = 'Read/Write application user.';
        detailedExplanation = `This account has standard Data Manipulation Language (DML) permissions (Insert, Update, Delete). It is typically used by backend APIs or web applications to modify data. It is classified as Medium Risk because it can alter data, but cannot destroy the table structures.`;
        riskLevel = 'Medium';
    } else if (user.Select_priv === 'Y') {
        description = 'Read-only analytics or reporting account.';
        detailedExplanation = `This account can only view data, but cannot modify it. It is perfect for data scientists, dashboarding tools, or reporting services. It is classified as Low Risk because it cannot corrupt or alter database states.`;
        riskLevel = 'Low';
    } else {
        description = 'Restricted account with no baseline permissions.';
        detailedExplanation = `This account currently lacks basic CRUD permissions on a global level. It may have database-specific grants not visible here, or it may be completely locked down.`;
        riskLevel = 'Low';
    }
    
    if (isGlobalHost) {
        if (riskLevel !== 'Low') {
            description += ' (Warning: Connects from any IP address)';
            riskLevel = 'High';
        }
        detailedExplanation += ` Furthermore, this account is configured with a wildcard host ('%'), meaning it can attempt to authenticate from anywhere on the public internet, dramatically increasing its attack surface.`;
    } else {
        detailedExplanation += ` This account is securely restricted to connect only from specific hostnames or IP blocks (like localhost or specific VPC subnets).`;
    }
    
    return { description, detailedExplanation, riskLevel };
};

// API: List Users and Grants
router.get('/users', async (req, res) => {
    try {
        const [rows] = await req.dbPool.query(`SELECT Host, User, Select_priv, Insert_priv, Update_priv, Delete_priv, Create_priv, Drop_priv FROM mysql.user`);
        const enhancedRows = rows.map(r => ({
            ...r,
            profile: analyzeUser(r)
        }));
        res.json({ status: 'success', data: enhancedRows });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// API: Create Database
router.post('/create-database', async (req, res) => {
    try {
        const { dbName } = req.body;
        if (!/^[a-zA-Z0-9_]+$/.test(dbName)) throw new Error("Invalid database name (use alphanumeric and underscores only).");
        await req.dbPool.query(`CREATE DATABASE \`${dbName}\``);
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
        await req.dbPool.query(`CREATE TABLE \`${safeDb}\`.\`${tableName}\` (${colDefs})`);
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
        await req.dbPool.query(`USE \`${safeDb}\``);
        for (const stmt of statements) {
            await req.dbPool.query(stmt);
        }
        
        res.json({ status: 'success', message: `Successfully imported ${statements.length} statements into ${db}.` });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

module.exports = router;

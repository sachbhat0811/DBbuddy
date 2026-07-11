require('dotenv').config();
const mysql = require('mysql2/promise');

async function run() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'jusdb_test'
    });

    try {
        // Setup table
        await pool.query("CREATE TABLE IF NOT EXISTS test_lock_waits (id INT PRIMARY KEY, val INT)");
        await pool.query("INSERT IGNORE INTO test_lock_waits (id, val) VALUES (1, 10)");

        // Connection 1 (Culprit)
        const conn1 = await pool.getConnection();
        await conn1.query("START TRANSACTION");
        await conn1.query("UPDATE test_lock_waits SET val = 20 WHERE id = 1");

        // Connection 2 (Victim)
        const conn2 = await pool.getConnection();
        conn2.query("START TRANSACTION").then(() => {
            return conn2.query("UPDATE test_lock_waits SET val = 30 WHERE id = 1");
        }).catch(e => console.log("Conn2 error:", e.message));

        // Wait a bit for the lock wait to register
        await new Promise(resolve => setTimeout(resolve, 500));

        // Query sys.innodb_lock_waits
        const [waits] = await pool.query(`
            SELECT 
                waiting_trx_id,
                waiting_pid AS waiting_thread,
                waiting_query,
                blocking_trx_id,
                blocking_pid AS blocking_thread,
                blocking_query
            FROM sys.innodb_lock_waits
        `);
        console.log("LOCK WAITS:", waits);

        // Cleanup
        await conn1.query("ROLLBACK");
        await conn2.query("ROLLBACK");
        conn1.release();
        conn2.release();
    } catch(e) {
        console.error(e);
    }
    process.exit(0);
}
run();

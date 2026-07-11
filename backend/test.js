require('dotenv').config();
const pool = require('./config/db');

async function run() {
    try {
        const [trxRows] = await pool.query(`SELECT trx_id, trx_state, trx_started, trx_query, trx_rows_locked, trx_isolation_level, trx_mysql_thread_id, trx_wait_started FROM information_schema.innodb_trx`);
        console.log("TRX:", trxRows);
        
        const [waitRows] = await pool.query(`SHOW COLUMNS FROM sys.innodb_lock_waits`);
        console.log("WAITS COLUMNS:", waitRows.map(r => r.Field));
    } catch (e) {
        console.error("DB Error:", e);
    }
    process.exit(0);
}
run();

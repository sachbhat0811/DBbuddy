const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function check() {
    const pool = mysql.createPool({
        host: 'localhost',
        user: 'root',
        password: 'bLACKPANTHER123#',
        database: 'mysql'
    });

    const [slowLogStatus] = await pool.query("SHOW VARIABLES LIKE 'slow_query_log'");
    console.log('slow_query_log:', slowLogStatus[0].Value);

    const [slowLogFile] = await pool.query("SHOW VARIABLES LIKE 'slow_query_log_file'");
    let logPath = slowLogFile[0].Value;
    console.log('slow_query_log_file:', logPath);

    if (!path.isAbsolute(logPath)) {
        const [datadir] = await pool.query("SHOW VARIABLES LIKE 'datadir'");
        console.log('datadir:', datadir[0].Value);
        logPath = path.join(datadir[0].Value, logPath);
    }

    console.log('Final resolved log path:', logPath);
    console.log('File exists?', fs.existsSync(logPath));

    if (fs.existsSync(logPath)) {
        console.log('File size:', fs.statSync(logPath).size);
        console.log('First 200 chars:', fs.readFileSync(logPath, 'utf8').substring(0, 200));
    }

    process.exit(0);
}

check();

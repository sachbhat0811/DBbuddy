const express = require('express');
const router = express.Router();

// API: Replication Status
router.get('/status', async (req, res) => {
    try {
        const targetPool = req.dbPool.replicaPool || req.dbPool;
        let [rows] = await targetPool.query('SHOW REPLICA STATUS').catch(() => [[]]);
        
        // Fallback for older MySQL versions
        if (rows.length === 0) {
            [rows] = await targetPool.query('SHOW SLAVE STATUS').catch(() => [[]]);
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
                
                // New DBA Metrics
                io_state: replica.Replica_IO_State || replica.Slave_IO_State || 'Unknown',
                read_master_log_pos: replica.Read_Master_Log_Pos || 0,
                exec_master_log_pos: replica.Exec_Master_Log_Pos || 0,
                relay_log_space: replica.Relay_Log_Space || 0,
                master_host: replica.Source_Host || replica.Master_Host || 'Unknown',
                last_sql_error: replica.Last_SQL_Error || '',
                last_io_error: replica.Last_IO_Error || ''
            }
        });
    } catch (error) {
        console.error('Replication Error:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

module.exports = router;

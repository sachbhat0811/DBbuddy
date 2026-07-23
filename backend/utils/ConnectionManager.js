const mysql = require('mysql2/promise');
const { createTunnel } = require('tunnel-ssh');
const { v4: uuidv4 } = require('uuid');
const net = require('net');

class ConnectionManager {
    static activePools = new Map();

    static async createConnection(config) {
        const sessionId = uuidv4();
        let pool;
        let tunnel = null;
        let localPort = null;

        try {
            if (config.connectionType === 'private') {
                // Setup SSH Tunnel
                localPort = await this.getFreePort();

                const tunnelOptions = { autoClose: true };
                const serverOptions = { port: localPort };
                const sshOptions = {
                    host: config.sshHost,
                    port: parseInt(config.sshPort) || 22,
                    username: config.sshUser,
                    privateKey: config.sshKey
                };
                const forwardOptions = {
                    srcAddr: '127.0.0.1',
                    srcPort: localPort,
                    dstAddr: config.dbHost,
                    dstPort: parseInt(config.dbPort) || 3306
                };

                const [server, conn] = await createTunnel(tunnelOptions, serverOptions, sshOptions, forwardOptions);
                tunnel = server;

                pool = mysql.createPool({
                    host: '127.0.0.1',
                    port: localPort,
                    user: config.dbUser,
                    password: config.dbPassword,
                    database: config.dbName,
                    waitForConnections: true,
                    connectionLimit: 10,
                    queueLimit: 0,
                    enableKeepAlive: true,
                    keepAliveInitialDelay: 0
                });

                if (config.replicaHost) {
                    const localReplicaPort = await this.getFreePort();
                    const replicaForwardOptions = {
                        srcAddr: '127.0.0.1',
                        srcPort: localReplicaPort,
                        dstAddr: config.replicaHost,
                        dstPort: parseInt(config.dbPort) || 3306
                    };
                    const [replicaServer] = await createTunnel(tunnelOptions, { port: localReplicaPort }, sshOptions, replicaForwardOptions);
                    tunnel.replicaTunnel = replicaServer; // store reference to clean up later

                    pool.replicaPool = mysql.createPool({
                        host: '127.0.0.1',
                        port: localReplicaPort,
                        user: config.dbUser,
                        password: config.dbPassword,
                        database: config.dbName,
                        waitForConnections: true,
                        connectionLimit: 10,
                        queueLimit: 0,
                        enableKeepAlive: true,
                        keepAliveInitialDelay: 0
                    });
                }
            } else {
                // Public connection
                pool = mysql.createPool({
                    host: config.dbHost,
                    port: parseInt(config.dbPort) || 3306,
                    user: config.dbUser,
                    password: config.dbPassword,
                    database: config.dbName,
                    waitForConnections: true,
                    connectionLimit: 10,
                    queueLimit: 0,
                    enableKeepAlive: true,
                    keepAliveInitialDelay: 0
                });

                if (config.replicaHost) {
                    pool.replicaPool = mysql.createPool({
                        host: config.replicaHost,
                        port: parseInt(config.dbPort) || 3306,
                        user: config.dbUser,
                        password: config.dbPassword,
                        database: config.dbName,
                        waitForConnections: true,
                        connectionLimit: 10,
                        queueLimit: 0,
                        enableKeepAlive: true,
                        keepAliveInitialDelay: 0
                    });
                }
            }

            // Test connection
            await pool.query('SELECT 1');

            this.activePools.set(sessionId, {
                pool,
                tunnel,
                lastAccessed: Date.now(),
                config: {
                    dbHost: config.connectionType === 'private' ? '127.0.0.1' : config.dbHost,
                    dbPort: config.connectionType === 'private' ? localPort : parseInt(config.dbPort) || 3306,
                    dbUser: config.dbUser,
                    dbPassword: config.dbPassword,
                    dbName: config.dbName
                }
            });

            return sessionId;
        } catch (error) {
            if (tunnel) tunnel.close();
            if (pool) await pool.end();
            throw error;
        }
    }

    static getPool(sessionId) {
        const connection = this.activePools.get(sessionId);
        if (!connection) {
            throw new Error('Session expired or connection lost.');
        }
        connection.lastAccessed = Date.now();
        return connection.pool;
    }

    static getConfig(sessionId) {
        const connection = this.activePools.get(sessionId);
        if (!connection) {
            throw new Error('Session expired or connection lost.');
        }
        return connection.config;
    }

    static async closeConnection(sessionId) {
        const connection = this.activePools.get(sessionId);
        if (connection) {
            try {
                if (connection.pool.replicaPool) await connection.pool.replicaPool.end();
                await connection.pool.end();
                if (connection.tunnel) {
                    if (connection.tunnel.replicaTunnel) connection.tunnel.replicaTunnel.close();
                    connection.tunnel.close();
                }
            } catch (e) {
                console.error("Error closing connection:", e);
            }
            this.activePools.delete(sessionId);
        }
    }

    static getFreePort() {
        return new Promise((resolve, reject) => {
            const server = net.createServer();
            server.unref();
            server.on('error', reject);
            server.listen(0, () => {
                const port = server.address().port;
                server.close(() => resolve(port));
            });
        });
    }
}

module.exports = ConnectionManager;

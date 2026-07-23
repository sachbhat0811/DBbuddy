const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');

// API: Trigger mysqldump logical backup
router.post('/backup', (req, res) => {
    const { database, structureOnly, singleTransaction, compress } = req.body;
    const config = req.dbConfig;
    const dbTarget = database || config.dbName;
    
    // Create backups directory if not exists
    const backupsDir = path.join(__dirname, '../backups');
    if (!fs.existsSync(backupsDir)) {
        fs.mkdirSync(backupsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    let baseFilename = `backup_${dbTarget}_${timestamp}.sql`;
    const sqlFilepath = path.join(backupsDir, baseFilename);
    const finalFilename = compress ? baseFilename + '.gz' : baseFilename;
    const finalFilepath = path.join(backupsDir, finalFilename);

    // Build mysqldump command dynamically
    let command = `mysqldump -h ${config.dbHost} -P ${config.dbPort} -u ${config.dbUser} ${config.dbPassword ? `-p"${config.dbPassword}"` : ''}`;
    
    if (singleTransaction) command += ' --single-transaction';
    if (structureOnly) command += ' --no-data';
    
    command += ` ${dbTarget} > "${sqlFilepath}"`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Backup Error: ${error.message}`);
            return res.status(500).json({ status: 'error', message: error.message });
        }

        const sendResponse = (file, fullPath) => {
            let size = 0;
            try {
                size = fs.statSync(fullPath).size;
            } catch (e) {
                console.error("Could not read file size: ", e);
            }
            res.json({
                status: 'success',
                message: 'Logical backup generated successfully',
                data: {
                    filename: file,
                    path: fullPath,
                    size
                }
            });
        };

        if (compress) {
            const gzip = zlib.createGzip();
            const source = fs.createReadStream(sqlFilepath);
            const destination = fs.createWriteStream(finalFilepath);

            source.pipe(gzip).pipe(destination);
            
            destination.on('finish', () => {
                fs.unlinkSync(sqlFilepath); // Clean up uncompressed file
                sendResponse(finalFilename, finalFilepath);
            });

            destination.on('error', (err) => {
                res.status(500).json({ status: 'error', message: 'Compression failed: ' + err.message });
            });
        } else {
            sendResponse(baseFilename, sqlFilepath);
        }
    });
});

// API: Download backup file
router.get('/download/:filename', (req, res) => {
    const { filename } = req.params;
    const backupsDir = path.join(__dirname, '../backups');
    const filepath = path.join(backupsDir, filename);

    // Basic security check to prevent directory traversal
    if (!filepath.startsWith(backupsDir)) {
        return res.status(403).json({ status: 'error', message: 'Forbidden' });
    }

    if (fs.existsSync(filepath)) {
        res.download(filepath);
    } else {
        res.status(404).json({ status: 'error', message: 'File not found' });
    }
});

// API: Backup History
router.get('/history', (req, res) => {
    try {
        const backupDir = path.join(__dirname, '../backups');
        if (!fs.existsSync(backupDir)) {
            return res.json({ status: 'success', data: [] });
        }
        
        const files = fs.readdirSync(backupDir).map(file => {
            const stats = fs.statSync(path.join(backupDir, file));
            return {
                filename: file,
                size: stats.size,
                created: stats.mtime
            };
        }).sort((a, b) => b.created - a.created);
        
        res.json({ status: 'success', data: files });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

module.exports = router;

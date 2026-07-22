const express = require('express');
const router = express.Router();
const { CloudWatchClient, GetMetricStatisticsCommand, DescribeAlarmsCommand } = require("@aws-sdk/client-cloudwatch");
const { CloudWatchLogsClient, StartQueryCommand, GetQueryResultsCommand } = require("@aws-sdk/client-cloudwatch-logs");
const { GoogleGenAI } = require("@google/genai");

// In-memory cache to prevent spamming the Gemini API on every dashboard poll for the same time bucket
let anomalyCache = { timestamp: null, result: null };

// Initialize AWS Clients dynamically per request to ensure .env updates take effect without restart
const getClients = () => {
    const config = {
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
        }
    };
    return {
        cwClient: new CloudWatchClient(config),
        logsClient: new CloudWatchLogsClient(config)
    };
};

router.get('/metrics', async (req, res) => {
    try {
        if (!process.env.AWS_ACCESS_KEY_ID) {
            return res.status(503).json({ success: false, message: "AWS credentials not configured." });
        }
        
        const { cwClient } = getClients();
        const endTime = new Date();
        const startTime = new Date(endTime.getTime() - 60 * 60 * 1000); // Past 1 hour

        // Use DB_INSTANCE_IDENTIFIER if available (crucial when DB_HOST is 127.0.0.1 for SSH tunnels)
        const dbHost = process.env.DB_HOST || '';
        const instanceId = process.env.DB_INSTANCE_IDENTIFIER || dbHost.split('.')[0] || 'jusdb-primary';

        const cpuCommand = new GetMetricStatisticsCommand({
            Namespace: 'AWS/RDS',
            MetricName: 'CPUUtilization',
            Dimensions: [{ Name: 'DBInstanceIdentifier', Value: instanceId }],
            StartTime: startTime,
            EndTime: endTime,
            Period: 300,
            Statistics: ['Average']
        });

        const memCommand = new GetMetricStatisticsCommand({
            Namespace: 'AWS/RDS',
            MetricName: 'FreeableMemory',
            Dimensions: [{ Name: 'DBInstanceIdentifier', Value: instanceId }],
            StartTime: startTime,
            EndTime: endTime,
            Period: 300,
            Statistics: ['Average']
        });

        const dbConnCommand = new GetMetricStatisticsCommand({
            Namespace: 'AWS/RDS', MetricName: 'DatabaseConnections', Dimensions: [{ Name: 'DBInstanceIdentifier', Value: instanceId }],
            StartTime: startTime, EndTime: endTime, Period: 300, Statistics: ['Average']
        });
        const readIopsCommand = new GetMetricStatisticsCommand({
            Namespace: 'AWS/RDS', MetricName: 'ReadIOPS', Dimensions: [{ Name: 'DBInstanceIdentifier', Value: instanceId }],
            StartTime: startTime, EndTime: endTime, Period: 300, Statistics: ['Average']
        });
        const writeIopsCommand = new GetMetricStatisticsCommand({
            Namespace: 'AWS/RDS', MetricName: 'WriteIOPS', Dimensions: [{ Name: 'DBInstanceIdentifier', Value: instanceId }],
            StartTime: startTime, EndTime: endTime, Period: 300, Statistics: ['Average']
        });
        const queueCommand = new GetMetricStatisticsCommand({
            Namespace: 'AWS/RDS', MetricName: 'DiskQueueDepth', Dimensions: [{ Name: 'DBInstanceIdentifier', Value: instanceId }],
            StartTime: startTime, EndTime: endTime, Period: 300, Statistics: ['Average']
        });
        const storageCommand = new GetMetricStatisticsCommand({
            Namespace: 'AWS/RDS', MetricName: 'FreeStorageSpace', Dimensions: [{ Name: 'DBInstanceIdentifier', Value: instanceId }],
            StartTime: startTime, EndTime: endTime, Period: 300, Statistics: ['Average']
        });
        const netRxCommand = new GetMetricStatisticsCommand({
            Namespace: 'AWS/RDS', MetricName: 'NetworkReceiveThroughput', Dimensions: [{ Name: 'DBInstanceIdentifier', Value: instanceId }],
            StartTime: startTime, EndTime: endTime, Period: 300, Statistics: ['Average']
        });
        const netTxCommand = new GetMetricStatisticsCommand({
            Namespace: 'AWS/RDS', MetricName: 'NetworkTransmitThroughput', Dimensions: [{ Name: 'DBInstanceIdentifier', Value: instanceId }],
            StartTime: startTime, EndTime: endTime, Period: 300, Statistics: ['Average']
        });

        const [cpuData, memData, dbConnData, readIopsData, writeIopsData, queueData, storageData, netRxData, netTxData] = await Promise.all([
            cwClient.send(cpuCommand),
            cwClient.send(memCommand),
            cwClient.send(dbConnCommand),
            cwClient.send(readIopsCommand),
            cwClient.send(writeIopsCommand),
            cwClient.send(queueCommand),
            cwClient.send(storageCommand),
            cwClient.send(netRxCommand),
            cwClient.send(netTxCommand)
        ]);

        const timeMap = {};
        const processData = (data, key, transform = v => v) => {
            if (data.Datapoints) {
                data.Datapoints.forEach(dp => {
                    const t = dp.Timestamp.getTime();
                    if (!timeMap[t]) timeMap[t] = { time: dp.Timestamp.toLocaleTimeString() };
                    timeMap[t][key] = transform(dp.Average);
                });
            }
        };

        processData(cpuData, 'cpu');
        processData(memData, 'memory_free_mb', v => v / 1024 / 1024);
        processData(dbConnData, 'connections');
        processData(readIopsData, 'readIops');
        processData(writeIopsData, 'writeIops');
        processData(queueData, 'queueDepth');
        processData(storageData, 'free_storage_gb', v => v / 1024 / 1024 / 1024);
        processData(netRxData, 'net_rx_mb', v => v / 1024 / 1024);
        processData(netTxData, 'net_tx_mb', v => v / 1024 / 1024);

        const metrics = Object.keys(timeMap).sort().map(k => timeMap[k]);
        
        let anomalyResult = null;
        if (metrics.length > 5) {
            const latestTimestamp = metrics[metrics.length - 1].time;
            
            // Check cache to avoid hitting Gemini API repeatedly for the same 5-minute bucket
            if (anomalyCache.timestamp === latestTimestamp) {
                anomalyResult = anomalyCache.result;
            } else {
                const baseline = metrics.slice(0, metrics.length - 1);
                const newPoint = metrics[metrics.length - 1];
                
                // --- Z-SCORE ENGINE ---
                let isAnomaly = false;
                let zDetails = [];
                
                // Define absolute minimums so tiny fluctuations don't trigger alarms
                const absoluteMinimums = {
                    cpu: 20, // Must be > 20% CPU
                    connections: 20, // Must be > 20 connections
                    readIops: 50, // Must be > 50 operations/sec
                    writeIops: 50, // Must be > 50 operations/sec
                    queueDepth: 5, // Must be > 5 pending operations
                    net_tx_mb: 5, // Must be > 5 MB
                    net_rx_mb: 5 // Must be > 5 MB
                };

                const zScoreMetrics = ['cpu', 'connections', 'readIops', 'writeIops', 'queueDepth', 'net_tx_mb', 'net_rx_mb'];
                
                zScoreMetrics.forEach(metric => {
                    const values = baseline.map(b => b[metric] || 0);
                    const mean = values.reduce((a, b) => a + b, 0) / values.length;
                    const stdDev = Math.sqrt(values.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / values.length) || 1;
                    
                    const currentValue = newPoint[metric] || 0;
                    const zScore = Math.abs((currentValue - mean) / stdDev);
                    
                    // Only flag if Z-Score > 3 AND the absolute value is high enough to actually matter
                    if (zScore > 3 && currentValue > (absoluteMinimums[metric] || 0)) {
                        isAnomaly = true;
                        zDetails.push(`${metric} spiked to ${currentValue.toFixed(1)} (Z: ${zScore.toFixed(2)})`);
                    }
                });

                if (isAnomaly) {
                    try {
                        const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
                        const prompt = `You are an AWS RDS Solutions Architect monitoring a database instance.
Here is the baseline idle data (last 5 periods):
${JSON.stringify(baseline.slice(-5))}
Here is the current anomalous telemetry point:
${JSON.stringify(newPoint)}

Analyze the cause of this anomaly. Z-Score engine flagged: ${zDetails.join(', ')}.
Keep your answer concise (2-3 sentences max) and explain the root cause. Return ONLY raw JSON with no markdown formatting:
{
    "isAnomaly": true,
    "insight": "Your root cause analysis here"
}`;
                        const aiResponse = await gemini.models.generateContent({
                            model: 'gemini-3.5-flash',
                            contents: prompt,
                            config: { responseMimeType: "application/json" }
                        });
                        
                        // Sanitize response to extract JSON block in case Gemini adds markdown or conversational text
                        let responseText = aiResponse.text;
                        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
                        if (jsonMatch) {
                            responseText = jsonMatch[0];
                        }
                        anomalyResult = JSON.parse(responseText);
                    } catch (e) {
                        console.error("Gemini Anomaly API Error:", e);
                        anomalyResult = { isAnomaly: true, insight: `Statistical anomaly detected: ${zDetails.join(', ')}. (AI analysis failed)` };
                    }
                } else {
                    anomalyResult = { isAnomaly: false, insight: "System is operating normally within historical baselines." };
                }
                
                // Cache the result for this timestamp
                anomalyCache = { timestamp: latestTimestamp, result: anomalyResult };
            }
        }

        res.json({ success: true, data: metrics, anomaly: anomalyResult });
    } catch (err) {
        console.error("CloudWatch Metrics Error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

router.get('/logs', async (req, res) => {
    try {
        if (!process.env.AWS_ACCESS_KEY_ID) {
            return res.status(503).json({ success: false, message: "AWS credentials not configured." });
        }

        const { logsClient } = getClients();
        const dbHost = process.env.DB_HOST || '';
        const instanceId = process.env.DB_INSTANCE_IDENTIFIER || dbHost.split('.')[0] || 'jusdb-primary';
        const logGroupName = `/aws/rds/instance/${instanceId}/error`;

        const startCommand = new StartQueryCommand({
            logGroupName: logGroupName,
            startTime: Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000), // Past 24 hours
            endTime: Math.floor(Date.now() / 1000),
            queryString: "fields @timestamp, @message | filter @message like /Deadlock found/ | sort @timestamp desc | limit 50",
        });

        const { queryId } = await logsClient.send(startCommand);

        let queryResults;
        let status = 'Running';
        while (status === 'Running' || status === 'Scheduled') {
            await new Promise(resolve => setTimeout(resolve, 1000));
            const getCommand = new GetQueryResultsCommand({ queryId });
            queryResults = await logsClient.send(getCommand);
            status = queryResults.status;
        }

        const formattedLogs = (queryResults.results || []).map(row => {
            const log = {};
            row.forEach(field => {
                log[field.field] = field.value;
            });
            return log;
        });

        res.json({ success: true, data: formattedLogs });
    } catch (err) {
        console.error("CloudWatch Logs Error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

router.get('/alarms', async (req, res) => {
    try {
        if (!process.env.AWS_ACCESS_KEY_ID) {
            return res.status(503).json({ success: false, message: "AWS credentials not configured." });
        }
        
        const { cwClient } = getClients();
        const command = new DescribeAlarmsCommand({
            AlarmNames: ['Critical-Memory-Spike', 'Critical-CPU-Spike']
        });

        const data = await cwClient.send(command);
        res.json({ success: true, data: data.MetricAlarms || [] });
    } catch (err) {
        console.error("CloudWatch Alarms Error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;

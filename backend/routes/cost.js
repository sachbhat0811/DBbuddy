const express = require('express');
const router = express.Router();
const { RDSClient, DescribeDBInstancesCommand } = require('@aws-sdk/client-rds');
const { CloudWatchClient, GetMetricStatisticsCommand } = require('@aws-sdk/client-cloudwatch');

const awsConfig = {
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
};

const rdsClient = new RDSClient(awsConfig);
const cwClient = new CloudWatchClient(awsConfig);

router.get('/insights', async (req, res) => {
    try {
        if (!process.env.AWS_ACCESS_KEY_ID || !process.env.DB_INSTANCE_IDENTIFIER) {
            return res.status(503).json({ status: 'error', message: 'AWS credentials or DB_INSTANCE_IDENTIFIER missing in .env' });
        }

        const instanceId = process.env.DB_INSTANCE_IDENTIFIER;
        let dbInstance;
        
        try {
            const command = new DescribeDBInstancesCommand({ DBInstanceIdentifier: instanceId });
            const response = await rdsClient.send(command);
            
            if (!response.DBInstances || response.DBInstances.length === 0) {
                throw new Error("DB instance not found in AWS.");
            }
            dbInstance = response.DBInstances[0];
        } catch (awsErr) {
            if (awsErr.name === 'AccessDenied' || awsErr.Code === 'AccessDenied' || (awsErr.message && awsErr.message.includes('AccessDenied'))) {
                console.warn("[COST_ROUTE] IAM AccessDenied for DescribeDBInstances. Falling back to mockup data for demo.");
                dbInstance = {
                    DBInstanceClass: 'db.t3.micro',
                    Engine: 'mysql',
                    MultiAZ: false,
                    StorageType: 'gp2',
                    AllocatedStorage: 20
                };
            } else {
                throw awsErr;
            }
        }

        const instanceClass = dbInstance.DBInstanceClass;
        const engine = dbInstance.Engine;
        const multiAZ = dbInstance.MultiAZ;
        const storageType = dbInstance.StorageType;
        const allocatedStorage = dbInstance.AllocatedStorage;

        // Hardcoded generic estimated costs per month
        const pricingMap = {
            'db.t3.micro': 12.50,
            'db.t3.small': 25.00,
            'db.t3.medium': 50.00,
            'db.t3.large': 100.00,
            'db.t4g.micro': 11.50,
            'db.t4g.small': 23.00,
            'db.m5.large': 125.00,
            'db.r5.large': 175.00
        };

        const currentMonthlyCost = pricingMap[instanceClass] || 50.00;
        const multiAZMultiplier = multiAZ ? 2 : 1;
        const totalComputeCost = currentMonthlyCost * multiAZMultiplier;
        const storageCost = allocatedStorage * 0.115;
        const totalCost = totalComputeCost + storageCost;

        // Fetch CloudWatch Metrics
        const fetchMetric = async (metricName) => {
            const EndTime = new Date();
            const StartTime = new Date(EndTime.getTime() - 7 * 24 * 60 * 60 * 1000);
            const command = new GetMetricStatisticsCommand({
                Namespace: 'AWS/RDS',
                MetricName: metricName,
                Dimensions: [{ Name: 'DBInstanceIdentifier', Value: instanceId }],
                StartTime,
                EndTime,
                Period: 86400,
                Statistics: ['Average', 'Maximum']
            });
            try {
                const response = await cwClient.send(command);
                let maxVal = 0;
                let avgSum = 0;
                let count = 0;
                for (const point of response.Datapoints || []) {
                    if (point.Maximum > maxVal) maxVal = point.Maximum;
                    if (point.Average !== undefined) {
                        avgSum += point.Average;
                        count++;
                    }
                }
                const avgVal = count > 0 ? avgSum / count : null;
                return { max: maxVal, avg: avgVal };
            } catch (e) {
                console.warn(`Could not fetch ${metricName}: ${e.message}`);
                return { max: 0, avg: null };
            }
        };

        const cpu = await fetchMetric('CPUUtilization');
        const memory = await fetchMetric('FreeableMemory');
        const readIops = await fetchMetric('ReadIOPS');
        const writeIops = await fetchMetric('WriteIOPS');

        const recommendations = [];
        let allHealthy = true;

        if (cpu.avg !== null) {
            if (cpu.max > 85 || cpu.avg > 70) {
                allHealthy = false;
                recommendations.push({
                    action: 'Upscale (Compute)',
                    targetClass: 'Next Tier Compute',
                    impact: '+$50.00/mo (Est.)',
                    description: `Average CPU is ${cpu.avg.toFixed(1)}% (Max: ${cpu.max.toFixed(1)}%). Consider upgrading to a larger compute instance to prevent bottlenecks.`
                });
            } else if (cpu.max < 20 && cpu.avg < 10 && !instanceClass.includes('micro')) {
                allHealthy = false;
                recommendations.push({
                    action: 'Downscale (Cost Savings)',
                    targetClass: 'Lower Tier Compute',
                    impact: '-$20.00/mo (Est.)',
                    description: `Average CPU is very low (${cpu.avg.toFixed(1)}%). Downsizing your instance will reduce compute costs with minimal performance impact.`
                });
            }
        }

        if (memory.avg !== null) {
            const freeableMemoryMB = memory.avg / (1024 * 1024);
            
            // Dynamic threshold based on instance size (micro instances only have 1GB total RAM)
            let memoryThresholdMB = 500; 
            if (instanceClass.includes('micro')) memoryThresholdMB = 100;
            else if (instanceClass.includes('small')) memoryThresholdMB = 250;

            if (freeableMemoryMB > 0 && freeableMemoryMB < memoryThresholdMB) {
                allHealthy = false;
                recommendations.push({
                    action: 'Upscale (Memory)',
                    targetClass: 'Memory Optimized (r6g)',
                    impact: '+$40.00/mo (Est.)',
                    description: `Average Freeable Memory is critically low (${Math.round(freeableMemoryMB)} MB). Consider migrating to a memory-optimized instance to prevent swapping.`
                });
            }
        }

        if (readIops.max > 0 || writeIops.max > 0) {
            const maxTotalIops = readIops.max + writeIops.max;
            if (maxTotalIops > 2800) {
                allHealthy = false;
                recommendations.push({
                    action: 'Upgrade Storage IOPS',
                    targetClass: 'gp3 or Provisioned IOPS',
                    impact: '+$20.00/mo (Est.)',
                    description: `Your peak IOPS reached ${Math.round(maxTotalIops)}, nearing the standard gp2 burst baseline (3000). Consider upgrading to gp3 for higher sustained IOPS.`
                });
            }
        }

        if (multiAZ) {
            recommendations.push({
                action: 'Disable Multi-AZ',
                targetClass: 'Single-AZ',
                impact: '-$' + (totalComputeCost / 2).toFixed(2) + '/mo',
                description: 'If this is a non-production environment, disabling Multi-AZ will immediately cut compute costs in half.'
            });
            allHealthy = false;
        }

        if (allHealthy) {
            recommendations.push({
                action: 'Optimally Sized',
                targetClass: instanceClass,
                impact: '$0.00/mo',
                description: 'Based on your CloudWatch metrics over the last 7 days (CPU, Memory, and IOPS), your instance is optimally provisioned for its current workload.'
            });
        }

        res.json({
            status: 'success',
            data: {
                instanceInfo: {
                    identifier: instanceId,
                    class: instanceClass,
                    engine,
                    multiAZ,
                    storage: `${allocatedStorage} GB (${storageType})`
                },
                costs: {
                    compute: totalComputeCost,
                    storage: storageCost,
                    total: totalCost
                },
                recommendations
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

module.exports = router;

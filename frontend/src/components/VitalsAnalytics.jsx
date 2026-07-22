import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Database, HardDrive, Activity, Server, AlertTriangle, ShieldCheck } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const API_BASE = import.meta.env.DEV ? 'http://localhost:5000/api' : '/api';

const VitalsAnalytics = () => {
  const [throughput, setThroughput] = useState(null);
  const [memory, setMemory] = useState(null);
  const [config, setConfig] = useState(null);
  const [qps, setQps] = useState(0);
  const [qpsData, setQpsData] = useState([]);

  // AWS CloudWatch State
  const [awsMetrics, setAwsMetrics] = useState([]);
  const [awsLogs, setAwsLogs] = useState([]);
  const [awsAlarms, setAwsAlarms] = useState([]);
  const [awsAnomaly, setAwsAnomaly] = useState(null);
  const [awsError, setAwsError] = useState(null);
  const [isAwsConfigured, setIsAwsConfigured] = useState(true);

  const fetchData = async () => {
    try {
      const tpRes = await axios.get(`${API_BASE}/vitals/throughput`);
      const memRes = await axios.get(`${API_BASE}/vitals/memory`);
      
      setThroughput(prev => {
        if (prev && tpRes.data.data) {
          const queriesDiff = tpRes.data.data.queries - prev.queries;
          const uptimeDiff = tpRes.data.data.uptime - prev.uptime;
          if (uptimeDiff > 0) {
            const currentQps = Math.round(queriesDiff / uptimeDiff);
            setQps(currentQps);
            setQpsData(oldData => {
                 const timeStr = new Date().toLocaleTimeString('en-US', { hour12: false, minute: '2-digit', second: '2-digit' });
                 const newData = [...oldData, { time: timeStr, qps: currentQps }];
                 return newData.slice(-15);
            });
          }
        }
        return tpRes.data.data;
      });
      
      setMemory(memRes.data.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAwsData = async () => {
    try {
      const metricsRes = await axios.get(`${API_BASE}/aws/metrics`);
      setAwsMetrics(metricsRes.data.data);
      setAwsAnomaly(metricsRes.data.anomaly);
      
      const logsRes = await axios.get(`${API_BASE}/aws/logs`);
      setAwsLogs(logsRes.data.data);

      const alarmsRes = await axios.get(`${API_BASE}/aws/alarms`);
      setAwsAlarms(alarmsRes.data.data);
      
      setAwsError(null);
      setIsAwsConfigured(true);
    } catch (err) {
      if (err.response?.status === 503) {
        setIsAwsConfigured(false);
      } else {
        setAwsError(err.response?.data?.message || err.message);
      }
    }
  };

  useEffect(() => {
    axios.get(`${API_BASE}/vitals/config`).then(res => setConfig(res.data.data)).catch(console.error);
    fetchData();
    fetchAwsData();
    
    const dbInterval = setInterval(fetchData, 3000);
    const awsInterval = setInterval(fetchAwsData, 10000); // Fetch AWS every 10s (rate limits)
    
    return () => {
      clearInterval(dbInterval);
      clearInterval(awsInterval);
    };
  }, []);

  if (!throughput || !memory) return <div className="fade-in">Loading Infra Vitals...</div>;

  const memUsagePercent = memory.pages_total > 0 
    ? ((memory.pages_data / memory.pages_total) * 100).toFixed(1)
    : 0;
  
  const isMemCritical = memUsagePercent > 90;

  return (
    <div className="fade-in">
      <h1>DBbuddy Infrastructure Vitals & CloudWatch Analytics</h1>

      {/* CloudWatch Alarm Banner */}
      {isAwsConfigured && awsAlarms.length > 0 && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
          {awsAlarms.map((alarm, idx) => {
            const isAlarm = alarm.StateValue === 'ALARM';
            return (
              <div 
                key={idx} 
                className="glass-panel" 
                style={{ 
                  flex: 1, 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 16, 
                  borderColor: isAlarm ? 'var(--danger)' : 'var(--border-color)',
                  background: isAlarm ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255, 255, 255, 0.02)'
                }}
              >
                {isAlarm ? <AlertTriangle size={32} color="var(--danger)" /> : <ShieldCheck size={32} color="var(--success)" />}
                <div>
                  <h4 style={{ margin: 0, textTransform: 'uppercase', fontSize: '0.8rem', color: 'var(--text-muted)' }}>AWS CloudWatch Evaluation Engine</h4>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                    {alarm.AlarmName}: <span style={{ color: isAlarm ? 'var(--danger)' : 'var(--success)' }}>{alarm.StateValue}</span>
                  </div>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem' }} className="text-muted">
                    {alarm.StateReason}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* AI Anomaly Engine Banner */}
      {isAwsConfigured && awsAnomaly && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
          <div 
            className="glass-panel" 
            style={{ 
              flex: 1, 
              display: 'flex', 
              alignItems: 'center', 
              gap: 16, 
              border: 'none',
              borderLeft: awsAnomaly.isAnomaly ? '6px solid var(--warning)' : '6px solid var(--success)',
              background: awsAnomaly.isAnomaly ? 'linear-gradient(90deg, rgba(245, 158, 11, 0.15) 0%, rgba(0,0,0,0.2) 100%)' : 'linear-gradient(90deg, rgba(16, 185, 129, 0.15) 0%, rgba(0,0,0,0.2) 100%)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
            }}
          >
            {awsAnomaly.isAnomaly ? <AlertTriangle size={32} color="var(--warning)" /> : <ShieldCheck size={32} color="var(--success)" />}
            <div>
              <h4 style={{ margin: 0, textTransform: 'uppercase', fontSize: '0.8rem', color: 'var(--text-muted)' }}>AI Telemetry Anomaly Engine (Z-Score + Gemini)</h4>
              <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                Status: <span style={{ color: awsAnomaly.isAnomaly ? 'var(--warning)' : 'var(--success)' }}>
                  {awsAnomaly.isAnomaly ? 'ANOMALY DETECTED' : 'OPTIMAL'}
                </span>
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem' }} className={awsAnomaly.isAnomaly ? "" : "text-muted"}>
                {awsAnomaly.insight}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="dashboard-grid">
        {/* QPS */}
        <div className="glass-panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Activity color="var(--accent-primary)" />
            <h3 style={{ margin: 0 }}>Throughput Engine (QPS)</h3>
          </div>
          <div style={{ fontSize: '3.5rem', fontWeight: 700, color: '#fff', textShadow: '0 0 20px var(--accent-glow)' }}>
            {qps} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>queries/sec</span>
          </div>
          <div style={{ width: '100%', height: 120, marginTop: 16 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={qpsData}>
                <defs>
                  <linearGradient id="colorQps" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent-secondary)" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="var(--accent-secondary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                <Tooltip 
                  contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px' }}
                />
                <Area type="monotone" dataKey="qps" stroke="var(--accent-secondary)" fillOpacity={1} fill="url(#colorQps)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="text-muted" style={{ marginTop: 16 }}>Total Queries: {throughput.queries.toLocaleString()}</p>
        </div>

        {/* Buffer Pool Memory */}
        <div className="glass-panel" style={{ borderColor: isMemCritical ? 'var(--danger)' : 'var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <HardDrive color={isMemCritical ? 'var(--danger)' : 'var(--accent-primary)'} />
            <h3 style={{ margin: 0 }}>Buffer Pool Memory</h3>
          </div>
          <div style={{ fontSize: '3.5rem', fontWeight: 700, color: isMemCritical ? 'var(--danger)' : 'var(--success)' }}>
            {memUsagePercent}%
          </div>
          <div style={{ width: '100%', background: 'rgba(0,0,0,0.5)', height: 8, borderRadius: 4, marginTop: 12, overflow: 'hidden' }}>
            <div style={{ width: `${memUsagePercent}%`, background: isMemCritical ? 'var(--danger)' : 'var(--success)', height: '100%', transition: 'width 0.5s ease' }}></div>
          </div>
          <p className="text-muted" style={{ marginTop: 12 }}>
            {memory.pages_data.toLocaleString()} pages used / {memory.pages_free.toLocaleString()} free
          </p>
        </div>

        {/* Hit Ratio */}
        <div className="glass-panel" style={{ borderColor: memory.hit_ratio > 95 ? 'var(--success)' : 'var(--warning)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Database color={memory.hit_ratio > 95 ? 'var(--success)' : 'var(--warning)'} />
            <h3 style={{ margin: 0 }}>Cache Performance</h3>
          </div>
          <div style={{ fontSize: '3.5rem', fontWeight: 700, color: memory.hit_ratio > 95 ? 'var(--success)' : 'var(--warning)' }}>
            {memory.hit_ratio}% <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>Hit Ratio</span>
          </div>
          <div style={{ width: '100%', background: 'rgba(0,0,0,0.5)', height: 8, borderRadius: 4, marginTop: 12, overflow: 'hidden' }}>
            <div style={{ width: `${memory.hit_ratio}%`, background: memory.hit_ratio > 95 ? 'var(--success)' : 'var(--warning)', height: '100%', transition: 'width 0.5s ease' }}></div>
          </div>
          <p className="text-muted" style={{ marginTop: 12 }}>
            Ratio of memory hits vs disk read requests. &gt;95% is healthy.
          </p>
        </div>
      </div>

      {/* Network & Connections */}
      <div className="glass-panel" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Activity color="var(--accent-secondary)" />
          <h3 style={{ margin: 0 }}>Network & Connections</h3>
        </div>
        <div style={{ display: 'flex', gap: 48 }}>
          <div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
              {throughput.threads_connected} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>Connected</span>
            </div>
            <p className="text-muted" style={{ marginTop: 8 }}>
              {throughput.threads_running} Actively Running
            </p>
          </div>
          <div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-secondary)' }}>
              {(throughput.bytes_received / 1024 / 1024).toFixed(2)} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>MB IN</span>
            </div>
            <p className="text-muted" style={{ marginTop: 8 }}>
              {(throughput.bytes_sent / 1024 / 1024).toFixed(2)} MB OUT (Total)
            </p>
          </div>
        </div>
      </div>

      {/* CloudWatch Metrics Section */}
      <div className="glass-panel" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Server color="var(--accent-primary)" />
          <h3 style={{ margin: 0 }}>AWS CloudWatch Hypervisor Telemetry (Single Pane of Glass)</h3>
        </div>

        {!isAwsConfigured ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: 8 }}>
            CloudWatch parameters not yet configured in <code>.env</code>. Make sure <code>AWS_ACCESS_KEY_ID</code> is loaded.
          </div>
        ) : awsError ? (
          <div style={{ padding: 24, color: 'var(--danger)', border: '1px dashed var(--danger)', borderRadius: 8 }}>
            Error fetching CloudWatch details: {awsError}
          </div>
        ) : awsMetrics.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
            Retrieving metrics from AWS... (Usually takes a moment to query CloudWatch)
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Charts Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <div>
                <h4 className="text-muted">CPU Utilization</h4>
                <div style={{ height: 160 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={awsMetrics}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                      <XAxis dataKey="time" stroke="var(--text-muted)" tick={{fontSize: 10}} />
                      <YAxis stroke="var(--text-muted)" unit="%" tick={{fontSize: 10}} />
                      <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px' }} />
                      <Area type="monotone" dataKey="cpu" name="CPU Load" stroke="var(--success)" fill="rgba(16, 185, 129, 0.1)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div>
                <h4 className="text-muted">Freeable Memory</h4>
                <div style={{ height: 160 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={awsMetrics}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                      <XAxis dataKey="time" stroke="var(--text-muted)" tick={{fontSize: 10}} />
                      <YAxis stroke="var(--text-muted)" unit=" MB" tick={{fontSize: 10}} />
                      <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px' }} />
                      <Area type="monotone" dataKey="memory_free_mb" name="Free Memory" stroke="var(--accent-primary)" fill="rgba(129, 140, 248, 0.1)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div>
                <h4 className="text-muted">Free Storage Space</h4>
                <div style={{ height: 160 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={awsMetrics}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                      <XAxis dataKey="time" stroke="var(--text-muted)" tick={{fontSize: 10}} />
                      <YAxis stroke="var(--text-muted)" unit=" GB" tick={{fontSize: 10}} domain={['auto', 'auto']} />
                      <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px' }} />
                      <Area type="monotone" dataKey="free_storage_gb" name="Free Storage" stroke="#38bdf8" fill="rgba(56, 189, 248, 0.1)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div>
                <h4 className="text-muted">Storage I/O (Read/Write IOPS)</h4>
                <div style={{ height: 160 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={awsMetrics}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                      <XAxis dataKey="time" stroke="var(--text-muted)" tick={{fontSize: 10}} />
                      <YAxis stroke="var(--text-muted)" tick={{fontSize: 10}} />
                      <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px' }} />
                      <Area type="monotone" dataKey="readIops" name="Read IOPS" stroke="var(--accent-primary)" fill="rgba(129, 140, 248, 0.1)" />
                      <Area type="monotone" dataKey="writeIops" name="Write IOPS" stroke="var(--accent-secondary)" fill="rgba(244, 114, 182, 0.1)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div>
                <h4 className="text-muted">DB Connections & Queue Depth</h4>
                <div style={{ height: 160 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={awsMetrics}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                      <XAxis dataKey="time" stroke="var(--text-muted)" tick={{fontSize: 10}} />
                      <YAxis yAxisId="left" stroke="var(--text-muted)" tick={{fontSize: 10}} />
                      <YAxis yAxisId="right" orientation="right" stroke="var(--text-muted)" tick={{fontSize: 10}} />
                      <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px' }} />
                      <Area yAxisId="left" type="monotone" dataKey="connections" name="Connections" stroke="var(--warning)" fill="rgba(245, 158, 11, 0.1)" />
                      <Area yAxisId="right" type="monotone" dataKey="queueDepth" name="Queue Depth" stroke="var(--danger)" fill="rgba(239, 68, 68, 0.1)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div>
                <h4 className="text-muted">Network Throughput (MB/s)</h4>
                <div style={{ height: 160 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={awsMetrics}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                      <XAxis dataKey="time" stroke="var(--text-muted)" tick={{fontSize: 10}} />
                      <YAxis stroke="var(--text-muted)" tick={{fontSize: 10}} />
                      <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px' }} />
                      <Area type="monotone" dataKey="net_rx_mb" name="Net RX (MB)" stroke="#8b5cf6" fill="rgba(139, 92, 246, 0.1)" />
                      <Area type="monotone" dataKey="net_tx_mb" name="Net TX (MB)" stroke="#10b981" fill="rgba(16, 185, 129, 0.1)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CloudWatch Logs Insights Panel */}
      {isAwsConfigured && (
        <div className="glass-panel" style={{ marginBottom: 24, borderColor: awsLogs.length > 0 ? 'var(--danger)' : 'var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <AlertTriangle color={awsLogs.length > 0 ? 'var(--danger)' : 'var(--text-muted)'} />
            <h3 style={{ margin: 0 }}>AWS Logs Insights: Database Anomalies (Deadlocks)</h3>
          </div>
          <p className="text-muted" style={{ marginBottom: 16 }}>
            Programmatically query AWS CloudWatch log group (e.g. <code>error/mysql-error.log</code>) for InnoDB deadlock incidents.
          </p>

          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Log Message</th>
                </tr>
              </thead>
              <tbody>
                {awsLogs.map((log, idx) => (
                  <tr key={idx} style={{ background: 'rgba(239, 68, 68, 0.05)' }}>
                    <td style={{ fontFamily: 'monospace', color: '#fca5a5', width: 220 }}>{log['@timestamp']}</td>
                    <td style={{ fontFamily: 'monospace', color: '#fcd34d', fontSize: '0.85rem' }}>{log['@message']}</td>
                  </tr>
                ))}
                {awsLogs.length === 0 && (
                  <tr>
                    <td colSpan="2" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 16 }}>
                      No InnoDB Deadlocks found in the last 24 hours of CloudWatch logs.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Configuration Manager */}
      {config && (
        <div className="glass-panel">
          <h2>Configuration Manager (mysqld.cnf)</h2>
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Variable Name</th>
                  <th>Value</th>
                  <th>Implication</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>max_connections</td>
                  <td><span className="badge badge-success">{config.max_connections}</span></td>
                  <td className="text-muted">Maximum permitted concurrent client connections.</td>
                </tr>
                <tr>
                  <td>innodb_buffer_pool_size</td>
                  <td><span className="badge badge-success">{config.innodb_buffer_pool_size}</span></td>
                  <td className="text-muted">Memory allocated for caching data and indexes. Critical for read latency.</td>
                </tr>
                <tr>
                  <td>log_error</td>
                  <td><span className="badge badge-success">{config.log_error || 'stderr'}</span></td>
                  <td className="text-muted">Location of the MySQL error log file.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default VitalsAnalytics;

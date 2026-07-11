import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Database, HardDrive, Activity, Server } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const API_BASE = import.meta.env.DEV ? 'http://localhost:5000/api' : '/api';

const VitalsAnalytics = () => {
  const [throughput, setThroughput] = useState(null);
  const [memory, setMemory] = useState(null);
  const [config, setConfig] = useState(null);
  const [osMetrics, setOsMetrics] = useState(null);
  const [qps, setQps] = useState(0);
  const [qpsData, setQpsData] = useState([]);

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
      
      const osRes = await axios.get(`${API_BASE}/vitals/os`);
      setOsMetrics(osRes.data.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    axios.get(`${API_BASE}/vitals/config`).then(res => setConfig(res.data.data)).catch(console.error);
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  if (!throughput || !memory) return <div className="fade-in">Loading Infra Vitals...</div>;

  const memUsagePercent = memory.pages_total > 0 
    ? ((memory.pages_data / memory.pages_total) * 100).toFixed(1)
    : 0;
  
  const isMemCritical = memUsagePercent > 90;

  return (
    <div className="fade-in">
      <h1>Infrastructure Vitals & Memory Analytics</h1>

      <div className="dashboard-grid">
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

      <div className="dashboard-grid" style={{ marginBottom: 24 }}>
        <div className="glass-panel">
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
      </div>

      {osMetrics && (
        <div className="glass-panel" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Server color="var(--accent-primary)" />
            <h3 style={{ margin: 0 }}>Host Machine Metrics (OS Level)</h3>
          </div>
          <div style={{ display: 'flex', gap: 48 }}>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: osMetrics.ram.percent > 90 ? 'var(--danger)' : 'var(--success)' }}>
                {osMetrics.ram.percent}% <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>RAM Used</span>
              </div>
              <p className="text-muted" style={{ marginTop: 8 }}>
                {Math.round(osMetrics.ram.used / 1024 / 1024 / 1024)} GB / {Math.round(osMetrics.ram.total / 1024 / 1024 / 1024)} GB Total
              </p>
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
                {osMetrics.cpu_cores} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>Cores</span>
              </div>
              <p className="text-muted" style={{ marginTop: 8 }}>
                Uptime: {Math.round(osMetrics.uptime / 3600)} Hours
              </p>
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: osMetrics.cpu_percent > 80 ? 'var(--danger)' : 'var(--success)' }}>
                {osMetrics.cpu_percent}% <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>CPU Used</span>
              </div>
              <p className="text-muted" style={{ marginTop: 8 }}>
                Across {osMetrics.cpu_cores} logical threads
              </p>
            </div>
          </div>
        </div>
      )}

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

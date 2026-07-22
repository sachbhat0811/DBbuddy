import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { ShieldAlert, XCircle, ShieldCheck } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const API_BASE = import.meta.env.DEV ? 'http://localhost:5000/api' : '/api';



const TelemetryModule = () => {
  const [data, setData] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [errorMsg, setErrorMsg] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'Time', direction: 'desc' });

  const fetchTelemetry = async () => {
    try {
      const res = await axios.get(`${API_BASE}/process/list`);
      setData(res.data.data);
      setErrorMsg(null);
      setChartData(prev => {
        try {
          const timeStr = new Date().toLocaleTimeString('en-US', { hour12: false, minute: '2-digit', second: '2-digit' });
          const newData = [...prev, { time: timeStr, connections: res.data.data.metrics?.threads_connected || 0 }];
          return newData.slice(-15);
        } catch (e) {
          console.error("Chart data update failed:", e);
          return prev;
        }
      });
    } catch (err) {
      console.error("Telemetry fetch error:", err);
      setErrorMsg(err.message || JSON.stringify(err));
    }
  };

  useEffect(() => {
    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleKill = async (id) => {
    if(!window.confirm(`Are you sure you want to terminate thread ${id}?`)) return;
    
    // Optimistically remove from UI to provide instant feedback
    setData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        processlist: prev.processlist.filter(p => p.Id !== id)
      };
    });

    try {
      await axios.post(`${API_BASE}/process/kill/${id}`);
      // Removed immediate fetchTelemetry() so optimistic UI doesn't get overwritten by zombie thread states
    } catch (err) {
      alert('Failed to kill thread.');
      // Re-fetch to restore the row since kill failed
      fetchTelemetry();
    }
  };

  const processlist = data?.processlist || [];

  const sortedProcessList = React.useMemo(() => {
    if (!processlist || processlist.length === 0) return [];
    let sortableItems = [...processlist];
    sortableItems.sort((a, b) => {
      let valA = a[sortConfig.key];
      let valB = b[sortConfig.key];
      
      if (valA === null || valA === undefined) valA = '';
      if (valB === null || valB === undefined) valB = '';

      if (sortConfig.key === 'Time' || sortConfig.key === 'Id') {
        valA = Number(valA);
        valB = Number(valB);
      } else {
        valA = String(valA).toLowerCase();
        valB = String(valB).toLowerCase();
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sortableItems;
  }, [processlist, sortConfig]);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  if (errorMsg) return (
    <div className="fade-in" style={{ padding: 24, color: 'var(--danger)' }}>
      <h2>Frontend Error</h2>
      <p>The browser failed to fetch telemetry data. Error: <b>{errorMsg}</b></p>
      <p>Check the browser's Developer Tools (F12) for network errors.</p>
    </div>
  );

  if (!data) return <div className="fade-in">Loading Live Telemetry...</div>;

  try {
    const { metrics } = data;

    const connectionRatio = metrics.threads_connected / metrics.max_connections;
    const isHighTraffic = connectionRatio > 0.8;

    const calculateHealth = () => {
      let score = 100;
      let issues = [];
      if (connectionRatio > 0.8) { score -= 20; issues.push("Connection pool nearing exhaustion."); }
      if (metrics.aborted_connects > 50) { score -= 15; issues.push(`High number of aborted connections (${metrics.aborted_connects}). Check network stability or authentication errors.`); }
      if (metrics.connection_errors > 0) { score -= 30; issues.push(`${metrics.connection_errors} clients were blocked from connecting because max_connections was reached.`); }
      if (metrics.slow_queries > 10) { score -= 10; issues.push(`High volume of slow queries detected (${metrics.slow_queries}). Check Query Profiler.`); }
      
      return { score, issues };
    };
    const { score, issues } = calculateHealth();

    // Helper to safely render values that might be serialized Buffer objects or other objects
    const formatValue = (val) => {
      if (val === null || val === undefined) return '-';
      if (typeof val === 'object') {
        if (val.type === 'Buffer' && Array.isArray(val.data)) {
          try {
            return new TextDecoder().decode(new Uint8Array(val.data));
          } catch (e) {
            return '[Binary Data]';
          }
        }
        return JSON.stringify(val);
      }
      return String(val);
    };

    return (
      <div className="fade-in">
        <h1>Live Process Telemetry</h1>
      
      {/* Automated Health Diagnostics */}
      <div className="glass-panel" style={{ marginBottom: 24, borderColor: score < 80 ? 'var(--danger)' : score < 100 ? 'var(--warning)' : 'var(--success)' }}>
        <h3 className="text-muted" style={{ marginBottom: 16 }}>Automated Health Diagnostics</h3>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, flex: 1 }}>
            <div style={{ fontSize: '3.5rem', fontWeight: 700, lineHeight: 1, color: score < 80 ? 'var(--danger)' : score < 100 ? 'var(--warning)' : 'var(--success)' }}>
              {score}
            </div>
            <div style={{ transform: 'translateY(-6px)' }}>
              {issues.length === 0 ? (
                <div style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 8, fontSize: '1.2rem' }}>
                  <ShieldCheck size={24} /> DB Instance is completely healthy! No anomalies detected.
                </div>
              ) : (
                <ul style={{ color: score < 80 ? 'var(--danger)' : 'var(--warning)', margin: 0, paddingLeft: 20, lineHeight: 1.6 }}>
                  {issues.map((issue, idx) => <li key={idx} style={{ marginBottom: 4 }}>{issue}</li>)}
                </ul>
              )}
            </div>
          </div>
          
          <div style={{ flex: 1, borderLeft: '1px solid var(--border-color)', paddingLeft: 32 }}>
            <h4 style={{ marginBottom: 8, color: 'var(--text-muted)' }}>Evaluation Criteria:</h4>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.9rem' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {connectionRatio > 0.8 ? <XCircle size={16} color="var(--danger)" /> : <ShieldCheck size={16} color="var(--success)" />}
                <span style={{ color: connectionRatio > 0.8 ? 'var(--danger)' : 'var(--text-muted)' }}>Connection Pool Capacity</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {metrics.aborted_connects > 50 ? <XCircle size={16} color="var(--danger)" /> : <ShieldCheck size={16} color="var(--success)" />}
                <span style={{ color: metrics.aborted_connects > 50 ? 'var(--danger)' : 'var(--text-muted)' }}>Network/Auth Stability (Aborted Connects)</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {metrics.connection_errors > 0 ? <XCircle size={16} color="var(--danger)" /> : <ShieldCheck size={16} color="var(--success)" />}
                <span style={{ color: metrics.connection_errors > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>Blocked Client Rejections</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {metrics.slow_queries > 10 ? <XCircle size={16} color="var(--danger)" /> : <ShieldCheck size={16} color="var(--success)" />}
                <span style={{ color: metrics.slow_queries > 10 ? 'var(--danger)' : 'var(--text-muted)' }}>Query Efficiency (Slow Queries)</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
      
      <div className="dashboard-grid">
        <div className="glass-panel">
          <h3 className="text-muted">Threads Connected</h3>
          <div style={{ fontSize: '2.5rem', fontWeight: 700, color: isHighTraffic ? 'var(--danger)' : 'var(--success)' }}>
            {metrics.threads_connected} <span style={{fontSize:'1rem', color:'var(--text-muted)'}}>/ {metrics.max_connections}</span>
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
            <span className="badge" style={{ background: 'var(--accent-primary)', color: '#fff' }}>
              {metrics.unique_users.length} Distinct Users: {metrics.unique_users.join(', ')}
            </span>
            {isHighTraffic && (
              <span style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShieldAlert size={16} /> Pool nearing exhaustion!
              </span>
            )}
          </div>
        </div>
        
        <div className="glass-panel">
          <h3 className="text-muted">Threads Running</h3>
          <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
            {metrics.threads_running}
          </div>
        </div>
      </div>
      <div className="glass-panel" style={{ marginBottom: 24 }}>
        <h3 className="text-muted" style={{ marginBottom: 16 }}>Live Connections History</h3>
        <div style={{ width: '100%', height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
              <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={12} tickMargin={10} />
              <YAxis stroke="var(--text-muted)" fontSize={12} allowDecimals={false} />
              <Tooltip 
                contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px' }}
                itemStyle={{ color: 'var(--accent-primary)' }}
              />
              <Line type="monotone" dataKey="connections" stroke="var(--accent-primary)" strokeWidth={3} dot={false} activeDot={{ r: 6 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="glass-panel">
        <h2 style={{ marginBottom: 16 }}>Active Process List (SHOW FULL PROCESSLIST)</h2>
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('Id')} style={{cursor: 'pointer'}}>ID {sortConfig.key === 'Id' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                <th onClick={() => handleSort('User')} style={{cursor: 'pointer'}}>User / Host {sortConfig.key === 'User' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                <th onClick={() => handleSort('db')} style={{cursor: 'pointer'}}>DB {sortConfig.key === 'db' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                <th onClick={() => handleSort('Command')} style={{cursor: 'pointer'}}>Command {sortConfig.key === 'Command' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                <th onClick={() => handleSort('Time')} style={{cursor: 'pointer'}}>Time (s) {sortConfig.key === 'Time' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                <th onClick={() => handleSort('State')} style={{cursor: 'pointer'}}>State {sortConfig.key === 'State' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                <th onClick={() => handleSort('Info')} style={{cursor: 'pointer'}}>Info {sortConfig.key === 'Info' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {sortedProcessList.map(p => (
                <tr key={p.Id}>
                  <td>{p.Id}</td>
                  <td>{formatValue(p.User)} @ {formatValue(p.Host)}</td>
                  <td>{formatValue(p.db)}</td>
                  <td>{formatValue(p.Command)}</td>
                  <td>
                    <span className={p.Time > 10 ? 'badge badge-warning' : 'badge badge-success'}>
                      {p.Time}s
                    </span>
                  </td>
                  <td>{formatValue(p.State)}</td>
                  <td style={{ maxWidth: 300, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'monospace' }}>
                    {formatValue(p.Info)}
                  </td>
                  <td>
                    {p.User !== 'system user' && (
                      <button className="btn-danger" onClick={() => handleKill(p.Id)} title="Kill Thread">
                        <XCircle size={16} /> Terminate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {sortedProcessList.length === 0 && (
                <tr><td colSpan="8">No active processes found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      </div>
    );
  } catch (err) {
    return (
      <div style={{ padding: 24, background: '#fee2e2', color: '#991b1b', borderRadius: 8, margin: 24 }}>
        <h2>Calculations Crash Detected</h2>
        <p><strong>Error:</strong> {err.message}</p>
        <pre style={{ overflow: 'auto', maxHeight: 300, background: '#fff', padding: 12, marginTop: 12 }}>
          {err.stack}
        </pre>
      </div>
    );
  }
};

export default TelemetryModule;

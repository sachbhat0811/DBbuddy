import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { ShieldAlert, XCircle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const API_BASE = import.meta.env.DEV ? 'http://localhost:5000/api' : '/api';

const TelemetryModule = () => {
  const [data, setData] = useState(null);
  const [chartData, setChartData] = useState([]);

  const fetchTelemetry = async () => {
    try {
      const res = await axios.get(`${API_BASE}/process/list`);
      setData(res.data.data);
      setChartData(prev => {
        const timeStr = new Date().toLocaleTimeString('en-US', { hour12: false, minute: '2-digit', second: '2-digit' });
        const newData = [...prev, { time: timeStr, connections: res.data.data.metrics.threads_connected }];
        return newData.slice(-15);
      });
    } catch (err) {
      console.error(err);
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

  if (!data) return <div className="fade-in">Loading Live Telemetry...</div>;

  const { metrics, processlist } = data;
  const connectionRatio = metrics.threads_connected / metrics.max_connections;
  const isHighTraffic = connectionRatio > 0.8;

  return (
    <div className="fade-in">
      <h1>Live Process Telemetry</h1>
      
      <div className="dashboard-grid">
        <div className="glass-panel">
          <h3 className="text-muted">Threads Connected</h3>
          <div style={{ fontSize: '2.5rem', fontWeight: 700, color: isHighTraffic ? 'var(--danger)' : 'var(--success)' }}>
            {metrics.threads_connected} <span style={{fontSize:'1rem', color:'var(--text-muted)'}}>/ {metrics.max_connections}</span>
          </div>
          {isHighTraffic && (
            <div style={{ marginTop: 12, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldAlert size={16} /> Warning: Connection pool nearing exhaustion!
            </div>
          )}
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
                <th>ID</th>
                <th>User / Host</th>
                <th>DB</th>
                <th>Command</th>
                <th>Time (s)</th>
                <th>State</th>
                <th>Info</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {processlist.map(p => (
                <tr key={p.Id}>
                  <td>{p.Id}</td>
                  <td>{p.User} @ {p.Host}</td>
                  <td>{p.db || '-'}</td>
                  <td>{p.Command}</td>
                  <td>
                    <span className={p.Time > 10 ? 'badge badge-warning' : 'badge badge-success'}>
                      {p.Time}s
                    </span>
                  </td>
                  <td>{p.State || '-'}</td>
                  <td style={{ maxWidth: 300, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'monospace' }}>
                    {p.Info || '-'}
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
              {processlist.length === 0 && (
                <tr><td colSpan="8">No active processes found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TelemetryModule;

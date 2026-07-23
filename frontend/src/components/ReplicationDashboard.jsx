import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Network, AlertTriangle, Server, ArrowRight, Database, Activity, HardDrive, Terminal } from 'lucide-react';

const API_BASE = import.meta.env.DEV ? 'http://localhost:5000/api' : '/api';

const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const ReplicationDashboard = () => {
  const [replData, setReplData] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await axios.get(`${API_BASE}/replication/status`);
        if (res.data.data === null) {
            setErrorMsg(res.data.message);
            setReplData(null);
        } else {
            setReplData(res.data.data);
            setErrorMsg('');
        }
      } catch (err) {
        setErrorMsg('Error fetching replication status.');
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const renderStandaloneWarning = () => (
    <div style={{ marginBottom: 24, padding: 16, background: 'rgba(245, 158, 11, 0.1)', borderLeft: '4px solid var(--warning)', borderRadius: '0 8px 8px 0', display: 'flex', gap: 12, alignItems: 'center', color: '#fcd34d' }}>
      <AlertTriangle size={24} color="var(--warning)" style={{ minWidth: 24 }}/>
      <div>
        <strong>Warning: {errorMsg}</strong>
        <div style={{ fontSize: '0.85rem', marginTop: 4, color: '#d1d1d6' }}>
          The database is currently running as a standalone node. Please connect to a Replica instance via the login page to view DBA Replication Metrics.
        </div>
      </div>
    </div>
  );

  const isHealthy = replData && replData.io_running === 'Yes' && replData.sql_running === 'Yes';
  const byteDelta = replData ? Math.max(0, replData.read_master_log_pos - replData.exec_master_log_pos) : 0;

  return (
    <div className="fade-in">
      <h1 style={{ marginBottom: 24 }}>DBA Replication Diagnostics</h1>
      
      {errorMsg && renderStandaloneWarning()}

      {replData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Topology Visualizer */}
          <div className="glass-panel">
            <h3 style={{ marginBottom: 24 }}>Live Topology State</h3>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 32, padding: 16 }}>
              <div style={{ textAlign: 'center', background: 'rgba(0,0,0,0.2)', padding: '24px 48px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
                <Server size={48} color="var(--accent-primary)" style={{ marginBottom: 12 }} />
                <div style={{ fontWeight: 600, fontSize: '1.2rem' }}>Primary</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>{replData.master_host}</div>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: isHealthy ? 'var(--success)' : 'var(--danger)' }}>
                <div style={{ fontSize: '0.85rem', marginBottom: 8, fontWeight: 'bold' }}>{isHealthy ? 'Connected & Streaming' : 'Connection Broken'}</div>
                <ArrowRight size={48} className={isHealthy ? 'pulse-animation' : ''} />
              </div>

              <div style={{ textAlign: 'center', background: 'rgba(0,0,0,0.2)', padding: '24px 48px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
                <Database size={48} color="var(--accent-secondary)" style={{ marginBottom: 12 }} />
                <div style={{ fontWeight: 600, fontSize: '1.2rem' }}>Replica Node</div>
                <div className={`badge ${isHealthy ? 'badge-success' : 'badge-danger'}`} style={{ marginTop: 8 }}>
                  {isHealthy ? 'Synchronizing' : 'Failing'}
                </div>
              </div>
            </div>
          </div>

          <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {/* Lag Telemetry */}
            <div className="glass-panel" style={{ gridColumn: 'span 2' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}><Activity size={18} className="text-primary"/> Lag Telemetry</h3>
              <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', textAlign: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: 8 }}>Time Delay</div>
                  <div style={{ fontSize: '3rem', fontWeight: 700, color: replData.seconds_behind_master > 10 ? 'var(--warning)' : 'var(--success)' }}>
                    {replData.seconds_behind_master} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>sec</span>
                  </div>
                </div>
                <div style={{ width: 1, height: 60, background: 'var(--border-color)' }}></div>
                <div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: 8 }}>Byte Delta (Read - Exec)</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 600, color: byteDelta > 1000000 ? 'var(--warning)' : 'white' }}>
                    {formatBytes(byteDelta)}
                  </div>
                </div>
                <div style={{ width: 1, height: 60, background: 'var(--border-color)' }}></div>
                <div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: 8 }}>Relay Log Space</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 600, color: 'white' }}>
                    {formatBytes(replData.relay_log_space)}
                  </div>
                </div>
              </div>
            </div>

            {/* Thread Health */}
            <div className="glass-panel">
               <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}><HardDrive size={18} className="text-secondary"/> Thread Health</h3>
               <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-muted)' }}>IO Thread:</span>
                      <span className={replData.io_running === 'Yes' ? 'badge badge-success' : 'badge badge-danger'}>{replData.io_running}</span>
                  </li>
                  <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-muted)' }}>SQL Thread:</span>
                      <span className={replData.sql_running === 'Yes' ? 'badge badge-success' : 'badge badge-danger'}>{replData.sql_running}</span>
                  </li>
                  <li style={{ marginTop: 8, paddingTop: 16, borderTop: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>Current IO State</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--accent-primary)', wordBreak: 'break-word' }}>{replData.io_state}</div>
                  </li>
               </ul>
            </div>
          </div>

          {/* Error Console */}
          <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', background: 'rgba(0,0,0,0.5)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Terminal size={18} color="var(--danger)" />
              <h3 style={{ margin: 0, fontSize: '1rem' }}>Replication Error Logs</h3>
            </div>
            <div style={{ padding: 24, background: '#0a0a0a', fontFamily: 'monospace', fontSize: '0.9rem', color: '#a3a3a3', minHeight: 120 }}>
              {(!replData.last_sql_error && !replData.last_io_error) ? (
                <div style={{ color: '#4ade80' }}>$ No recent replication errors found. System is healthy.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {replData.last_io_error && (
                    <div>
                      <span style={{ color: '#ef4444' }}>[IO_ERROR]</span> {replData.last_io_error}
                    </div>
                  )}
                  {replData.last_sql_error && (
                    <div>
                      <span style={{ color: '#ef4444' }}>[SQL_ERROR]</span> {replData.last_sql_error}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReplicationDashboard;

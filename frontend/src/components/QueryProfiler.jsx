import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, AlertTriangle, CheckCircle } from 'lucide-react';

const API_BASE = import.meta.env.DEV ? 'http://localhost:5000/api' : '/api';

const QueryProfiler = () => {
  const [query, setQuery] = useState('');
  const [planData, setPlanData] = useState(null);
  const [slowLogs, setSlowLogs] = useState([]);

  useEffect(() => {
    axios.get(`${API_BASE}/queries/slow-log`)
      .then(res => setSlowLogs(res.data.data))
      .catch(err => console.error(err));
  }, []);

  const handleAnalyze = async () => {
    if (!query) return;
    try {
      const res = await axios.post(`${API_BASE}/queries/explain`, { query });
      setPlanData(res.data.data);
    } catch (err) {
      alert('Error analyzing query: ' + (err.response?.data?.message || err.message));
    }
  };

  return (
    <div className="fade-in">
      <h1>Automated Query Profiling & Index Engineering</h1>

      <div className="glass-panel" style={{ marginBottom: 24 }}>
        <h2>Execution Plan Visualizer</h2>
        <textarea 
          className="input-field" 
          rows="4" 
          placeholder="Paste your SELECT / UPDATE / DELETE query here to EXPLAIN..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{ marginBottom: 16 }}
        />
        <button className="btn-primary" onClick={handleAnalyze}>
          <Search size={18} /> Analyze Execution Plan
        </button>

        {planData && (
          <div style={{ marginTop: 24, padding: 16, background: 'rgba(0,0,0,0.3)', borderRadius: 12, border: '1px solid var(--border-color)' }}>
            {planData.analysis.hasTableScan ? (
              <div style={{ color: 'var(--danger)', display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
                <AlertTriangle size={24} /> 
                <strong>High Risk: Full Table Scan (type: ALL) detected!</strong>
              </div>
            ) : (
              <div style={{ color: 'var(--success)', display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
                <CheckCircle size={24} /> 
                <strong>Execution Plan Optimized. No sequential scans detected.</strong>
              </div>
            )}
            
            {planData.analysis.recommendations.map((rec, i) => (
              <div key={i} style={{ marginBottom: 16, padding: 12, borderLeft: '3px solid var(--warning)', background: 'rgba(245, 158, 11, 0.1)', color: '#fcd34d', borderRadius: '0 4px 4px 0' }}>
                {rec}
              </div>
            ))}

            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>id</th>
                    <th>table</th>
                    <th>type</th>
                    <th>possible_keys</th>
                    <th>key</th>
                    <th>rows</th>
                    <th>Extra</th>
                  </tr>
                </thead>
                <tbody>
                  {planData.plan.map((step, idx) => (
                    <tr key={idx}>
                      <td>{step.id}</td>
                      <td>{step.table}</td>
                      <td><span className={`badge ${step.type === 'ALL' ? 'badge-danger' : 'badge-success'}`}>{step.type}</span></td>
                      <td>{step.possible_keys || '-'}</td>
                      <td>{step.key || '-'}</td>
                      <td>{step.rows}</td>
                      <td>{step.Extra}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="glass-panel">
        <h2>Slow Query Log Diagnostics</h2>
        <p className="text-muted" style={{ marginBottom: 16 }}>Top slow queries captured from Linux native slow logs</p>
        
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Time Executed</th>
                <th>Duration (s)</th>
                <th>Rows Examined</th>
                <th>Query Snapshot</th>
              </tr>
            </thead>
            <tbody>
              {slowLogs.map((log, idx) => (
                <tr key={idx}>
                  <td style={{ whiteSpace: 'nowrap' }}>{log.time || '-'}</td>
                  <td><span className="badge badge-warning">{log.Query_time || 0}s</span></td>
                  <td>{log.Rows_examined || '-'}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#a5b4fc', cursor: 'pointer' }} onClick={() => setQuery(log.query)}>
                    {log.query ? log.query.substring(0, 100) : '-'}...
                  </td>
                </tr>
              ))}
              {slowLogs.length === 0 && (
                <tr><td colSpan="4" style={{ textAlign: 'center' }}>No slow queries logged or file not found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default QueryProfiler;

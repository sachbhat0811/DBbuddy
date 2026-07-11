import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { DollarSign, AlertTriangle, TrendingDown, CheckCircle, Info } from 'lucide-react';

const API_BASE = import.meta.env.DEV ? 'http://localhost:5000/api' : '/api';

const CostRealization = () => {
  const [insights, setInsights] = useState([]);

  useEffect(() => {
    axios.get(`${API_BASE}/cost/insights`).then(res => setInsights(res.data.data)).catch(console.error);
  }, []);

  const totalWasted = insights.reduce((acc, curr) => acc + curr.wastedCost, 0);

  return (
    <div className="fade-in">
      <h1>Cost Realization & Actionable Insights</h1>

      <div className="glass-panel" style={{ marginBottom: 24, background: 'rgba(59, 130, 246, 0.1)', borderColor: 'var(--accent-primary)' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Info color="var(--accent-primary)" size={24} />
          <p style={{ margin: 0, lineHeight: 1.5, color: '#e0e7ff' }}>
            This module parses the native MySQL slow query log (<code>slow_query_log_file</code>). To populate this hub, execute unoptimized queries (e.g., <code>SELECT SLEEP(11)</code>, or large table scans without indexes). Ensure <code>slow_query_log=ON</code> is configured.
          </p>
        </div>
      </div>

      <div className="dashboard-grid" style={{ marginBottom: 24 }}>
        <div className="glass-panel" style={{ borderColor: totalWasted > 10 ? 'var(--danger)' : 'var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <DollarSign color={totalWasted > 10 ? 'var(--danger)' : 'var(--success)'} />
            <h3 style={{ margin: 0 }}>Estimated Compute Waste</h3>
          </div>
          <div style={{ fontSize: '3.5rem', fontWeight: 700, color: totalWasted > 10 ? 'var(--danger)' : 'var(--success)' }}>
            ${totalWasted.toFixed(2)}
          </div>
          <p className="text-muted" style={{ marginTop: 8 }}>Estimated cost due to unoptimized queries (based on AWS RDS instance hours).</p>
        </div>
        
        <div className="glass-panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <TrendingDown color="var(--accent-primary)" />
            <h3 style={{ margin: 0 }}>Optimization Potential</h3>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
            {insights.filter(i => i.severity === 'high').length} Critical Issues
          </div>
          <p className="text-muted" style={{ marginTop: 8 }}>Implement the recommendations below to immediately reduce EC2/RDS resource burn.</p>
        </div>
      </div>

      <div className="glass-panel">
        <h2>Remediation Hub</h2>
        <div className="data-table-container" style={{ marginTop: 16 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Query Snapshot</th>
                <th>Cost Impact</th>
                <th>Rows (Sent/Examined)</th>
                <th>Recommendation</th>
              </tr>
            </thead>
            <tbody>
              {insights.map((insight, idx) => (
                <tr key={idx}>
                  <td style={{ fontFamily: 'monospace', color: '#a5b4fc', fontSize: '0.85rem', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {insight.query}
                  </td>
                  <td>
                    <span className={`badge ${insight.severity === 'high' ? 'badge-danger' : 'badge-warning'}`}>
                      ${insight.wastedCost.toFixed(2)}
                    </span>
                  </td>
                  <td>{insight.rowsSent} / {insight.rowsExamined}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {insight.severity === 'high' ? <AlertTriangle size={16} color="var(--danger)" /> : <CheckCircle size={16} color="var(--success)" />}
                      {insight.recommendation}
                    </div>
                  </td>
                </tr>
              ))}
              {insights.length === 0 && (
                <tr><td colSpan="4" style={{ textAlign: 'center' }}>No inefficient queries detected in the slow log!</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CostRealization;

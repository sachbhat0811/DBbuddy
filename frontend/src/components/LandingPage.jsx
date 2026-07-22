import React from 'react';
import { ArrowRight, Activity, Zap, Shield, Database, Network, Settings } from 'lucide-react';

const LandingPage = ({ onLaunch }) => {
  return (
    <div className="landing-container fade-in">
      <h1 className="hero-title">DBbuddy Observability</h1>
      <p className="hero-subtitle">
        A comprehensive, full-stack observability portal designed for AWS RDS and managed databases. 
        Monitor active connections, analyze execution plans, and trigger native logical backups without third-party SaaS bloat.
      </p>

      <div className="features-grid">
        <div className="feature-card">
          <Activity size={40} color="var(--accent-primary)" style={{ marginBottom: 16 }} />
          <h3 style={{ marginBottom: 12 }}>Live Telemetry</h3>
          <p className="text-muted" style={{ fontSize: '0.9rem' }}>Real-time processlist monitoring with instantaneous thread termination to prevent connection pool exhaustion.</p>
        </div>
        <div className="feature-card">
          <Zap size={40} color="var(--warning)" style={{ marginBottom: 16 }} />
          <h3 style={{ marginBottom: 12 }}>Query Profiling</h3>
          <p className="text-muted" style={{ fontSize: '0.9rem' }}>Automated Slow Log parsing and EXPLAIN visualizers to hunt down Sequential Scans and enforce indexing.</p>
        </div>
        <div className="feature-card">
          <Database size={40} color="var(--success)" style={{ marginBottom: 16 }} />
          <h3 style={{ marginBottom: 12 }}>Infra Vitals</h3>
          <p className="text-muted" style={{ fontSize: '0.9rem' }}>Correlate host OS metrics with InnoDB Buffer Pool capacity to predict physical disk I/O bottlenecks.</p>
        </div>
        <div className="feature-card">
          <Shield size={40} color="var(--accent-secondary)" style={{ marginBottom: 16 }} />
          <h3 style={{ marginBottom: 12 }}>ACID Isolation</h3>
          <p className="text-muted" style={{ fontSize: '0.9rem' }}>Unveil invisible table locks and monitor global snapshot isolation mechanics in real-time.</p>
        </div>
        <div className="feature-card">
          <Network size={40} color="#a855f7" style={{ marginBottom: 16 }} />
          <h3 style={{ marginBottom: 12 }}>High Availability</h3>
          <p className="text-muted" style={{ fontSize: '0.9rem' }}>Monitor Primary-Replica topologies, track binary log synchronization, and measure replica lag.</p>
        </div>
        <div className="feature-card">
          <Settings size={40} color="#ec4899" style={{ marginBottom: 16 }} />
          <h3 style={{ marginBottom: 12 }}>Config Tuning</h3>
          <p className="text-muted" style={{ fontSize: '0.9rem' }}>Review critical variables like max_connections and InnoDB buffer pool size directly from mysqld.cnf.</p>
        </div>
      </div>

      <button className="btn-launch" onClick={onLaunch}>
        Launch Portal <ArrowRight size={20} />
      </button>
    </div>
  );
};

export default LandingPage;

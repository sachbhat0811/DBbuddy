import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Database, Table as TableIcon, LayoutList } from 'lucide-react';

const API_BASE = import.meta.env.DEV ? 'http://localhost:5000/api' : '/api';

const DatabaseViewer = () => {
  const [activeTab, setActiveTab] = useState('explorer');
  const [databases, setDatabases] = useState([]);
  const [selectedDb, setSelectedDb] = useState(null);
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [tableData, setTableData] = useState({ rows: [], columns: [] });
  const [users, setUsers] = useState([]);

  useEffect(() => {
    axios.get(`${API_BASE}/dbviewer/databases`).then(res => setDatabases(res.data.data)).catch(console.error);
    axios.get(`${API_BASE}/dbviewer/users`).then(res => setUsers(res.data.data)).catch(console.error);
  }, []);

  const handleSelectDb = async (db) => {
    setSelectedDb(db);
    setSelectedTable(null);
    setTableData({ rows: [], columns: [] });
    try {
      const res = await axios.get(`${API_BASE}/dbviewer/tables/${db}`);
      setTables(res.data.data);
    } catch (err) { console.error(err); }
  };

  const handleSelectTable = async (table) => {
    setSelectedTable(table);
    try {
      const res = await axios.get(`${API_BASE}/dbviewer/data/${selectedDb}/${table}`);
      setTableData(res.data.data);
    } catch (err) { console.error(err); }
  };

  const renderExplorer = () => {
    return (
      <div style={{ display: 'flex', gap: 24, flex: 1, overflow: 'hidden' }}>
        
        {/* Databases Sidebar */}
        <div className="glass-panel" style={{ width: 250, display: 'flex', flexDirection: 'column', padding: '16px 0' }}>
          <h3 style={{ padding: '0 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Database size={18} color="var(--accent-primary)" /> Databases
          </h3>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {databases.map(db => (
              <div 
                key={db}
                onClick={() => handleSelectDb(db)}
                style={{ 
                  padding: '12px 16px', 
                  cursor: 'pointer', 
                  background: selectedDb === db ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                  borderLeft: selectedDb === db ? '3px solid var(--accent-primary)' : '3px solid transparent'
                }}
              >
                {db}
              </div>
            ))}
          </div>
        </div>

        {/* Tables Sidebar */}
        <div className="glass-panel" style={{ width: 300, display: 'flex', flexDirection: 'column', padding: '16px 0', opacity: selectedDb ? 1 : 0.5, pointerEvents: selectedDb ? 'auto' : 'none' }}>
          <h3 style={{ padding: '0 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <LayoutList size={18} color="var(--accent-secondary)" /> Tables
          </h3>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {tables.map(t => (
              <div 
                key={t.table_name}
                onClick={() => handleSelectTable(t.table_name)}
                style={{ 
                  padding: '12px 16px', 
                  cursor: 'pointer', 
                  background: selectedTable === t.table_name ? 'rgba(168, 85, 247, 0.1)' : 'transparent',
                  borderLeft: selectedTable === t.table_name ? '3px solid var(--accent-secondary)' : '3px solid transparent',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <span>{t.table_name}</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.table_rows || 0} rows</span>
              </div>
            ))}
            {tables.length === 0 && selectedDb && (
              <div style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>No tables found.</div>
            )}
          </div>
        </div>

        {/* Data Grid */}
        <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px', opacity: selectedTable ? 1 : 0.5 }}>
          {selectedTable ? (
            <>
              <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <TableIcon size={18} color="var(--success)" /> {selectedTable}
              </h3>
              
              <div style={{ marginBottom: 24 }}>
                <h4 style={{ marginBottom: 8, color: 'var(--text-muted)' }}>Schema Definition</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {tableData.columns.map(col => (
                    <span key={col.Field} className="badge" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{col.Field}</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{col.Type}</span>
                      {col.Key === 'PRI' && <span style={{ color: 'var(--warning)', fontSize: '0.8rem', fontWeight: 'bold' }}>(PK)</span>}
                    </span>
                  ))}
                </div>
              </div>

              <h4 style={{ marginBottom: 8, color: 'var(--text-muted)' }}>Raw Data (Limit 50)</h4>
              <div className="data-table-container" style={{ flex: 1, overflow: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      {tableData.columns.map(col => (
                        <th key={col.Field}>{col.Field}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableData.rows.map((row, idx) => (
                      <tr key={idx}>
                        {tableData.columns.map(col => (
                          <td key={col.Field}>{String(row[col.Field])}</td>
                        ))}
                      </tr>
                    ))}
                    {tableData.rows.length === 0 && (
                      <tr><td colSpan={tableData.columns.length} style={{ textAlign: 'center' }}>No rows in this table.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              Select a table to view data.
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderSecurity = () => {
    return (
      <div className="glass-panel" style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        <h2 style={{ marginBottom: 16 }}>Security & Grants (mysql.user)</h2>
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Host</th>
                <th>Select</th>
                <th>Insert</th>
                <th>Update</th>
                <th>Delete</th>
                <th>Create</th>
                <th>Drop</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, idx) => (
                <tr key={idx}>
                  <td style={{ fontWeight: 600 }}>{u.User}</td>
                  <td>{u.Host}</td>
                  <td><span className={`badge ${u.Select_priv === 'Y' ? 'badge-success' : 'badge-danger'}`}>{u.Select_priv}</span></td>
                  <td><span className={`badge ${u.Insert_priv === 'Y' ? 'badge-success' : 'badge-danger'}`}>{u.Insert_priv}</span></td>
                  <td><span className={`badge ${u.Update_priv === 'Y' ? 'badge-success' : 'badge-danger'}`}>{u.Update_priv}</span></td>
                  <td><span className={`badge ${u.Delete_priv === 'Y' ? 'badge-success' : 'badge-danger'}`}>{u.Delete_priv}</span></td>
                  <td><span className={`badge ${u.Create_priv === 'Y' ? 'badge-success' : 'badge-danger'}`}>{u.Create_priv}</span></td>
                  <td><span className={`badge ${u.Drop_priv === 'Y' ? 'badge-success' : 'badge-danger'}`}>{u.Drop_priv}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="fade-in" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>Schema Explorer & Data Grid</h1>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className={`btn-primary ${activeTab === 'explorer' ? '' : 'text-muted'}`} style={{ background: activeTab === 'explorer' ? 'var(--accent-primary)' : 'rgba(255,255,255,0.05)' }} onClick={() => setActiveTab('explorer')}>Schema Explorer</button>
          <button className={`btn-primary ${activeTab === 'security' ? '' : 'text-muted'}`} style={{ background: activeTab === 'security' ? 'var(--danger)' : 'rgba(255,255,255,0.05)' }} onClick={() => setActiveTab('security')}>Security & Grants</button>
        </div>
      </div>

      {activeTab === 'explorer' ? renderExplorer() : renderSecurity()}
    </div>
  );
};

export default DatabaseViewer;

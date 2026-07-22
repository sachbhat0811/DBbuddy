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
  
  // Builder State
  const [newDbName, setNewDbName] = useState('');
  const [newTableName, setNewTableName] = useState('');
  const [newTableDb, setNewTableDb] = useState('');
  const [newColumns, setNewColumns] = useState([{ name: 'id', type: 'INT', isPrimary: true, autoIncrement: true }]);
  const [importStatus, setImportStatus] = useState(null);

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

  const handleCreateDb = async () => {
    try {
      await axios.post(`${API_BASE}/dbviewer/create-database`, { dbName: newDbName });
      alert(`Database ${newDbName} created!`);
      setNewDbName('');
      axios.get(`${API_BASE}/dbviewer/databases`).then(res => setDatabases(res.data.data));
    } catch (err) { alert(err.response?.data?.message || err.message); }
  };

  const handleCreateTable = async () => {
    try {
      await axios.post(`${API_BASE}/dbviewer/create-table`, { 
        db: newTableDb, 
        tableName: newTableName, 
        columns: newColumns 
      });
      alert(`Table ${newTableName} created in ${newTableDb}!`);
      setNewTableName('');
      if (selectedDb === newTableDb) handleSelectDb(newTableDb);
    } catch (err) { alert(err.response?.data?.message || err.message); }
  };

  const handleImportSql = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!newTableDb) {
      setImportStatus({ type: 'error', message: "Please select a database from the dropdown first!" });
      return;
    }
    
    setImportStatus({ type: 'loading', message: `Importing ${file.name}...` });
    
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const sql = evt.target.result;
        const res = await axios.post(`${API_BASE}/dbviewer/import-sql`, { db: newTableDb, sql });
        setImportStatus({ type: 'success', message: res.data.message });
        if (selectedDb === newTableDb) handleSelectDb(newTableDb);
      } catch (err) {
        setImportStatus({ type: 'error', message: err.response?.data?.message || err.message });
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
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

  const renderBuilder = () => {
    return (
      <div className="glass-panel" style={{ flex: 1, overflow: 'auto', padding: 24, display: 'flex', gap: 24 }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ marginBottom: 16 }}>Create Database</h2>
          <div style={{ display: 'flex', gap: 12 }}>
            <input type="text" className="input-field" placeholder="Database Name (e.g. app_db)" value={newDbName} onChange={e => setNewDbName(e.target.value)} />
            <button className="btn-primary" onClick={handleCreateDb}>Create DB</button>
          </div>
          <p className="text-muted" style={{ marginTop: 8, fontSize: '0.9rem' }}>Creates a new schema on the AWS RDS instance.</p>
        </div>
        <div style={{ width: '1px', background: 'var(--border-color)' }}></div>
        <div style={{ flex: 2 }}>
          <h2 style={{ marginBottom: 16 }}>Create Table</h2>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <select className="input-field" value={newTableDb} onChange={e => setNewTableDb(e.target.value)}>
              <option value="">Select Database...</option>
              {databases.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <input type="text" className="input-field" placeholder="Table Name" value={newTableName} onChange={e => setNewTableName(e.target.value)} />
          </div>
          <h4 style={{ marginBottom: 8, color: 'var(--text-muted)' }}>Columns</h4>
          {newColumns.map((col, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <input type="text" className="input-field" placeholder="Column Name" value={col.name} onChange={e => {
                const cols = [...newColumns]; cols[idx].name = e.target.value; setNewColumns(cols);
              }} />
              <select className="input-field" value={col.type} onChange={e => {
                const cols = [...newColumns]; cols[idx].type = e.target.value; setNewColumns(cols);
              }}>
                <option value="INT">INT</option>
                <option value="VARCHAR(255)">VARCHAR(255)</option>
                <option value="TEXT">TEXT</option>
                <option value="BOOLEAN">BOOLEAN</option>
                <option value="DATETIME">DATETIME</option>
                <option value="FLOAT">FLOAT</option>
              </select>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)', fontSize: '0.9rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={col.isPrimary} onChange={e => {
                  const cols = [...newColumns]; cols[idx].isPrimary = e.target.checked; setNewColumns(cols);
                }} /> PK
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)', fontSize: '0.9rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={col.autoIncrement} onChange={e => {
                  const cols = [...newColumns]; cols[idx].autoIncrement = e.target.checked; setNewColumns(cols);
                }} /> A_I
              </label>
              <button className="btn-secondary" style={{ padding: '4px 8px', background: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => {
                const cols = newColumns.filter((_, i) => i !== idx); setNewColumns(cols);
              }}>X</button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            <button className="btn-secondary" onClick={() => setNewColumns([...newColumns, { name: '', type: 'VARCHAR(255)', isPrimary: false, autoIncrement: false }])}>+ Add Column</button>
            <button className="btn-primary" style={{ background: 'var(--success)', borderColor: 'var(--success)' }} onClick={handleCreateTable} disabled={!newTableDb || !newTableName}>Create Table</button>
          </div>

          <div style={{ marginTop: 32, padding: 16, border: '1px dashed var(--border-color)', borderRadius: 8, background: 'rgba(0,0,0,0.1)' }}>
            <h3 style={{ marginBottom: 8 }}>Import .sql File</h3>
            <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: 16 }}>Upload a .sql file to automatically execute tables and insert data into the selected database.</p>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <label className="btn-secondary" style={{ cursor: !newTableDb ? 'not-allowed' : 'pointer', opacity: !newTableDb ? 0.5 : 1 }}>
                Choose .sql File
                <input 
                  type="file" 
                  accept=".sql" 
                  onChange={handleImportSql} 
                  disabled={!newTableDb} 
                  style={{ display: 'none' }} 
                />
              </label>
              {!newTableDb && <span style={{ color: 'var(--warning)', fontSize: '0.85rem' }}>*Select a database above first</span>}
            </div>

            {importStatus && (
              <div style={{ 
                marginTop: 12, 
                padding: 12, 
                borderRadius: 6, 
                fontSize: '0.9rem',
                border: importStatus.type === 'error' ? '1px solid var(--danger)' : importStatus.type === 'success' ? '1px solid var(--success)' : '1px solid var(--border-color)',
                background: importStatus.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : importStatus.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.05)',
                color: importStatus.type === 'error' ? '#fca5a5' : importStatus.type === 'success' ? '#a7f3d0' : 'var(--text-muted)'
              }}>
                {importStatus.message}
              </div>
            )}
          </div>
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
          <button className={`btn-primary ${activeTab === 'builder' ? '' : 'text-muted'}`} style={{ background: activeTab === 'builder' ? 'var(--success)' : 'rgba(255,255,255,0.05)' }} onClick={() => setActiveTab('builder')}>Schema Builder</button>
          <button className={`btn-primary ${activeTab === 'security' ? '' : 'text-muted'}`} style={{ background: activeTab === 'security' ? 'var(--danger)' : 'rgba(255,255,255,0.05)' }} onClick={() => setActiveTab('security')}>Security & Grants</button>
        </div>
      </div>

      {activeTab === 'explorer' && renderExplorer()}
      {activeTab === 'builder' && renderBuilder()}
      {activeTab === 'security' && renderSecurity()}
    </div>
  );
};

export default DatabaseViewer;

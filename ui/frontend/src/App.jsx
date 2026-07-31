const API_BASE_URL = "http://localhost:3001";
import React, { useState, useEffect, useCallback } from 'react';
import SnapshotBrowser from './SnapshotBrowser';
import './App.css';

function App() {
  const [configs, setConfigs] = useState({});
  const [selectedConfig, setSelectedConfig] = useState('');
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedSnapshot, setSelectedSnapshot] = useState(null); // For browsing
  const [showBrowser, setShowBrowser] = useState(false);

  // Load snapshots
  const loadSnapshots = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/snapshots`);
      if (!response.ok) throw new Error('Failed to load snapshots');
      const data = await response.json();
      setConfigs(data.configs || {});
      
      // Auto-select first config if available
      const configKeys = Object.keys(data.configs || {});
      if (configKeys.length > 0 && !selectedConfig) {
        setSelectedConfig(configKeys[0]);
      }
    } catch (err) {
      setError(err.message);
      console.error('Error loading snapshots:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedConfig]);

  // Load snapshots for selected config
  useEffect(() => {
    if (selectedConfig && configs[selectedConfig]) {
      setSnapshots(configs[selectedConfig] || []);
    } else {
      setSnapshots([]);
    }
  }, [selectedConfig, configs]);

  // Initial load
  useEffect(() => {
    loadSnapshots();
  }, [loadSnapshots]);

  // Handle config change
  const handleConfigChange = (e) => {
    setSelectedConfig(e.target.value);
    setSelectedSnapshot(null);
    setShowBrowser(false);
  };

  // Handle snapshot double-click
  const handleSnapshotDoubleClick = (snapshot) => {
    setSelectedSnapshot(snapshot);
    setShowBrowser(true);
  };

  // Handle back from browser
  const handleBrowserClose = () => {
    setShowBrowser(false);
    setSelectedSnapshot(null);
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch {
      return dateString;
    }
  };

  if (loading) {
    return (
      <div className="app-loading">
        <div className="spinner"></div>
        <p>Loading snapshots...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-error">
        <p>Error: {error}</p>
        <button onClick={loadSnapshots}>Retry</button>
      </div>
    );
  }

  const configKeys = Object.keys(configs);

  return (
    <div className="app">
      <header className="app-header">
        <h1>📸 Snapshot Sync UI</h1>
        <p>Browse and manage your snapshots</p>
      </header>

      <main className="app-main">
        <div className="controls">
          <label htmlFor="config-select">Select Config:</label>
          <select 
            id="config-select"
            value={selectedConfig}
            onChange={handleConfigChange}
            disabled={configKeys.length === 0}
          >
            {configKeys.length === 0 ? (
              <option value="">No configs available</option>
            ) : (
              configKeys.map(key => (
                <option key={key} value={key}>{key}</option>
              ))
            )}
          </select>
          <span className="snapshot-count">
            {snapshots.length} snapshots
          </span>
        </div>

        {showBrowser && selectedSnapshot ? (
          <div className="browser-container">
            <div className="browser-header">
              <button onClick={handleBrowserClose} className="close-browser">
                ← Back to snapshots
              </button>
              <h2>
                Browsing: {selectedConfig} / {selectedSnapshot.id}
              </h2>
            </div>
            <SnapshotBrowser 
              config={selectedConfig} 
              snapshotId={selectedSnapshot.id}
            />
          </div>
        ) : (
          <div className="snapshots-list">
            {snapshots.length === 0 ? (
              <p className="empty-message">No snapshots found for this config</p>
            ) : (
              <table className="snapshots-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Size</th>
                    <th>Files</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshots.map((snapshot) => (
                    <tr 
                      key={snapshot.id}
                      onDoubleClick={() => handleSnapshotDoubleClick(snapshot)}
                      className="snapshot-row"
                    >
                      <td className="snapshot-id">{snapshot.id}</td>
                      <td>{formatDate(snapshot.date)}</td>
                      <td>{snapshot.description || 'N/A'}</td>
                      <td>
                        {snapshot.sizeBytes 
                          ? (snapshot.sizeBytes / (1024**3)).toFixed(2) + ' GB'
                          : 'N/A'
                        }
                      </td>
                      <td>{snapshot.fileCount || 'N/A'}</td>
                      <td>
                        <button 
                          onClick={() => handleSnapshotDoubleClick(snapshot)}
                          className="browse-button"
                        >
                          Browse 📂
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="hint">
              💡 Double-click on a snapshot or click "Browse" to explore its contents
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;

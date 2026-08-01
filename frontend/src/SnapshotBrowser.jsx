const API_BASE_URL = "http://localhost:3001";
import React, { useState, useEffect, useCallback } from 'react';
import './SnapshotBrowser.css';

function SnapshotBrowser({ config, snapshotId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [path, setPath] = useState('');
  const [error, setError] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);

  // Load directory contents
  const loadDirectory = useCallback(async (dirPath = '') => {
    if (!config || !snapshotId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const url = `/api/snapshots/${config}/${snapshotId}/browse${dirPath ? `?path=${encodeURIComponent(dirPath)}` : ''}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to load directory: ${response.statusText}`);
      }
      
      const data = await response.json();
      setItems(data.items || []);
      setPath(data.currentPath || '');
    } catch (err) {
      setError(err.message);
      console.error('Error loading directory:', err);
    } finally {
      setLoading(false);
    }
  }, [config, snapshotId]);

  // Load initial directory when config/snapshot changes
  useEffect(() => {
    if (config && snapshotId) {
      loadDirectory('');
    }
  }, [config, snapshotId, loadDirectory]);

  // Handle item click (navigate into directories)
  const handleItemClick = (item) => {
    if (item.type === 'directory') {
      const newPath = path ? `${path}/${item.name}` : item.name;
      loadDirectory(newPath);
      setSelectedItem(null);
    } else {
      // For files, show details or preview
      setSelectedItem(item);
    }
  };

  // Handle back navigation
  const handleBack = () => {
    if (path) {
      const parentPath = path.split('/').slice(0, -1).join('/');
      loadDirectory(parentPath);
    }
  };

  // Format file size
  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  };

  // Format date
  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString();
  };

  if (loading) {
    return (
      <div className="snapshot-browser-loading">
        <div className="spinner"></div>
        <p>Loading directory contents...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="snapshot-browser-error">
        <p>Error: {error}</p>
        <button onClick={() => loadDirectory('')}>Retry</button>
      </div>
    );
  }

  return (
    <div className="snapshot-browser">
      <div className="browser-header">
        <h3>Snapshot: {snapshotId}</h3>
        <div className="breadcrumb">
          <button onClick={handleBack} disabled={!path} className="back-button">
            ← Back
          </button>
          <span className="path-display">/ {path || 'root'}</span>
        </div>
      </div>

      <div className="browser-content">
        {items.length === 0 ? (
          <p className="empty-message">This directory is empty</p>
        ) : (
          <ul className="file-list">
            {items.map((item, index) => (
              <li 
                key={index} 
                className={`file-item ${item.type}`}
                onClick={() => handleItemClick(item)}
                onDoubleClick={() => {
                  if (item.type === 'directory') {
                    const newPath = path ? `${path}/${item.name}` : item.name;
                    loadDirectory(newPath);
                  }
                }}
              >
                <span className="file-icon">
                  {item.type === 'directory' ? '📁' : '📄'}
                </span>
                <span className="file-name">{item.name}</span>
                <span className="file-size">{formatSize(item.size)}</span>
                <span className="file-date">{formatDate(item.modified)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selectedItem && (
        <div className="file-details-modal">
          <div className="modal-content">
            <h3>File Details</h3>
            <p><strong>Name:</strong> {selectedItem.name}</p>
            <p><strong>Type:</strong> {selectedItem.type}</p>
            <p><strong>Size:</strong> {formatSize(selectedItem.size)}</p>
            <p><strong>Modified:</strong> {formatDate(selectedItem.modified)}</p>
            {selectedItem.permissions && (
              <p><strong>Permissions:</strong> {selectedItem.permissions}</p>
            )}
            <button onClick={() => setSelectedItem(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default SnapshotBrowser;

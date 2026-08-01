#!/usr/bin/env node
/**
 * Snapshot Sync API Backend
 * 
 * Wraps btrfs snapshot sync scripts, provides REST API for:
 * - Listing snapshots on backup disk
 * - Triggering new sync runs
 * - Streaming sync progress
 * - Viewing reports
 */

const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;
const BACKUP_DISK = process.env.BACKUP_DISK || '/run/media/amitp/Backup';
const SCRIPTS_DIR = process.env.SCRIPTS_DIR || '/home/amitp/bin/snapshot-sync';

// Middleware
app.use(cors());
app.use(express.json());

// Helper: Calculate directory size
function dirSize(dirPath) {
  let size = 0;
  try {
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        size += dirSize(filePath);
      } else {
        size += stat.size;
      }
    }
  } catch (e) {
    // Ignore errors
  }
  return size;
}

// Helper: Count files in directory
function countFiles(dirPath) {
  let count = 0;
  try {
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        count += countFiles(filePath);
      } else {
        count++;
      }
    }
  } catch (e) {
    // Ignore errors
  }
  return count;
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- Snapshot listing ---

/**
 * GET /api/snapshots
 * List all snapshots on backup disk, grouped by config
 */
app.get('/api/snapshots', (req, res) => {
  try {
    const configs = {};
    
    // Define which directories are configs (contain snapshots)
    const configDirs = ['home', 'root'];  // Add more as needed
    
    configDirs.forEach(config => {
      const configPath = path.join(BACKUP_DISK, config);
      
      // Skip if config directory doesn't exist
      if (!fs.existsSync(configPath) || !fs.statSync(configPath).isDirectory()) {
        return;
      }
      
      const snapshots = [];
      
      // Read snapshot directories inside this config
      fs.readdirSync(configPath).forEach(entry => {
        const entryPath = path.join(configPath, entry);
        const stat = fs.statSync(entryPath);
        
        // Skip special directories
        if (['latest', 'by-date'].includes(entry)) return;
        
        // Check if it's a directory with numeric name (snapshot ID)
        if (stat.isDirectory() && /^\d+$/.test(entry)) {
          const snapId = entry;
          const infoXmlPath = path.join(configPath, `${snapId}.info.xml`);
          let metadata = { id: snapId, date: null, description: null };
          
          if (fs.existsSync(infoXmlPath)) {
            try {
              const xml = fs.readFileSync(infoXmlPath, 'utf8');
              const dateMatch = xml.match(/<date>(.*?)<\/date>/);
              const descMatch = xml.match(/<description>(.*?)<\/description>/);
              
              if (dateMatch) metadata.date = dateMatch[1];
              if (descMatch) metadata.description = descMatch[1];
            } catch (e) {
              // silently ignore XML parse errors
            }
          }
          
          // metadata.sizeBytes = dirSize(entryPath);  // DISABLED - too slow
          // metadata.fileCount = countFiles(entryPath);  // DISABLED - too slow
          snapshots.push(metadata);
        }
      });
      
      // Sort snapshots by ID (newest first)
      configs[config] = snapshots.sort((a, b) => parseInt(b.id) - parseInt(a.id));
    });
    
    res.json({ backup_disk: BACKUP_DISK, configs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/snapshots/:config/:id
 * Get detailed info for one snapshot
 */
app.get('/api/snapshots/:config/:id', (req, res) => {
  try {
    const { config, id } = req.params;
    const snapPath = path.join(BACKUP_DISK, config, id);
    const infoXmlPath = path.join(BACKUP_DISK, config, `${id}.info.xml`);
    
    if (!fs.existsSync(snapPath)) {
      return res.status(404).json({ error: 'snapshot not found' });
    }
    
    const details = {
      config,
      id,
      path: snapPath,
      sizeBytes: dirSize(snapPath),
      fileCount: countFiles(snapPath),
      createdAt: fs.statSync(snapPath).birthtime,
    };
    
    // Try to read metadata from info.xml
    if (fs.existsSync(infoXmlPath)) {
      try {
        const xml = fs.readFileSync(infoXmlPath, 'utf8');
        const dateMatch = xml.match(/<date>(.*?)<\/date>/);
        const descMatch = xml.match(/<description>(.*?)<\/description>/);
        if (dateMatch) details.date = dateMatch[1];
        if (descMatch) details.description = descMatch[1];
      } catch (e) {
        // silently ignore XML parse errors
      }
    }
    
    res.json(details);
  } catch (error) {
    console.error('Error in /api/snapshots/:config/:id:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- Sync operations ---

/**
 * GET /api/sync/status
 * Check if a sync is currently running
 */
app.get('/api/sync/status', (req, res) => {
  try {
    const pidFile = '/tmp/snapshot-sync.pid';
    if (fs.existsSync(pidFile)) {
      try {
        const pid = parseInt(fs.readFileSync(pidFile, 'utf8').trim());
        try {
          process.kill(pid, 0);
          return res.json({ running: true, pid });
        } catch (e) {
          // Process not running, remove stale pid file
          fs.unlinkSync(pidFile);
        }
      } catch (e) {
        // Ignore
      }
    }
    res.json({ running: false });
  } catch (error) {
    console.error('Error in /api/sync/status:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/sync/start
 * Start a new sync run
 */
app.post('/api/sync/start', (req, res) => {
  try {
    const { configs } = req.body;
    
    if (!configs || !Array.isArray(configs) || configs.length === 0) {
      return res.status(400).json({ error: 'configs array required' });
    }
    
    // Check if already running
    const pidFile = '/tmp/snapshot-sync.pid';
    if (fs.existsSync(pidFile)) {
      try {
        const pid = parseInt(fs.readFileSync(pidFile, 'utf8').trim());
        process.kill(pid, 0);
        return res.status(409).json({ error: 'sync already running' });
      } catch (e) {
        fs.unlinkSync(pidFile);
      }
    }
    
    // Start the sync script
    const scriptPath = path.join(SCRIPTS_DIR, 'sync-snapshots.sh');
    if (!fs.existsSync(scriptPath)) {
      return res.status(500).json({ error: 'sync script not found' });
    }
    
    const args = ['--configs', configs.join(',')];
    const child = spawn(scriptPath, args, {
      detached: true,
      stdio: 'ignore'
    });
    
    child.unref();
    
    // Write pid file
    fs.writeFileSync(pidFile, child.pid.toString());
    
    res.json({ 
      message: 'sync started', 
      pid: child.pid,
      configs 
    });
  } catch (error) {
    console.error('Error in /api/sync/start:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/sync/log
 * Stream sync log output
 */
app.get('/api/sync/log', (req, res) => {
  try {
    const logFile = '/tmp/snapshot-sync.log';
    
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Transfer-Encoding', 'chunked');
    
    if (!fs.existsSync(logFile)) {
      res.write('No log file found. Start a sync first.\n');
      res.end();
      return;
    }
    
    // Tail the log file
    const stream = fs.createReadStream(logFile, { 
      encoding: 'utf8',
      start: fs.statSync(logFile).size > 1024 * 1024 ? fs.statSync(logFile).size - 1024 * 1024 : 0
    });
    
    stream.pipe(res);
    
    // Watch for new content
    const watcher = fs.watch(logFile, (eventType) => {
      if (eventType === 'change') {
        try {
          const newContent = fs.readFileSync(logFile, 'utf8').slice(stream.bytesRead || 0);
          if (newContent) {
            res.write(newContent);
          }
        } catch (e) {
          // Ignore read errors
        }
      }
    });
    
    req.on('close', () => {
      watcher.close();
    });
  } catch (error) {
    console.error('Error in /api/sync/log:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Snapshot Sync API running on port ${PORT}`);
  console.log(`Backup disk: ${BACKUP_DISK}`);
  console.log(`Scripts directory: ${SCRIPTS_DIR}`);
});
/**
 * GET /api/snapshots/:config/:id/browse
 * Browse files inside a snapshot
 */
app.get('/api/snapshots/:config/:id/browse', (req, res) => {
  try {
    const { config, id } = req.params;
    const { path: subPath } = req.query;
    
    const snapPath = path.join(BACKUP_DISK, config, id);
    let browsePath = snapPath;
    
    if (subPath) {
      // Security: prevent directory traversal
      const normalized = path.normalize(subPath);
      if (normalized.startsWith('..')) {
        return res.status(403).json({ error: 'Access denied' });
      }
      browsePath = path.join(snapPath, normalized);
    }
    
    if (!fs.existsSync(browsePath)) {
      return res.status(404).json({ error: 'Path not found' });
    }
    
    const stat = fs.statSync(browsePath);
    if (!stat.isDirectory()) {
      return res.status(400).json({ error: 'Not a directory' });
    }
    
    const items = fs.readdirSync(browsePath).map(name => {
      const fullPath = path.join(browsePath, name);
      try {
        const itemStat = fs.statSync(fullPath);
        return {
          name,
          type: itemStat.isDirectory() ? 'directory' : 'file',
          size: itemStat.size,
          modified: itemStat.mtime,
          created: itemStat.birthtime,
          permissions: (itemStat.mode & 0o777).toString(8)
        };
      } catch (e) {
        return {
          name,
          type: 'unknown',
          size: 0,
          modified: null,
          created: null,
          permissions: '000'
        };
      }
    });
    
    // Sort: directories first, then files
    items.sort((a, b) => {
      if (a.type === 'directory' && b.type !== 'directory') return -1;
      if (a.type !== 'directory' && b.type === 'directory') return 1;
      return a.name.localeCompare(b.name);
    });
    
    const currentPath = subPath || '';
    res.json({
      currentPath,
      items
    });
  } catch (error) {
    console.error('Browse error:', error);
    res.status(500).json({ error: error.message });
  }
});

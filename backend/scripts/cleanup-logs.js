#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Log cleanup script
 * Removes log files older than specified days
 * Usage: node scripts/cleanup-logs.js [days]
 */

const DEFAULT_RETENTION_DAYS = 30;
const LOGS_DIR = path.join(__dirname, '..', 'logs');

function cleanupLogs(retentionDays = DEFAULT_RETENTION_DAYS) {
  console.log(`Starting log cleanup - removing files older than ${retentionDays} days`);
  
  if (!fs.existsSync(LOGS_DIR)) {
    console.log('Logs directory does not exist');
    return;
  }
  
  const files = fs.readdirSync(LOGS_DIR);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  
  let removedCount = 0;
  let totalSize = 0;
  
  files.forEach(file => {
    if (file === '.gitkeep') return;
    
    const filePath = path.join(LOGS_DIR, file);
    const stats = fs.statSync(filePath);
    
    if (stats.mtime < cutoffDate) {
      console.log(`Removing old log file: ${file} (${stats.mtime.toISOString()})`);
      totalSize += stats.size;
      fs.unlinkSync(filePath);
      removedCount++;
    }
  });
  
  console.log(`Cleanup completed: Removed ${removedCount} files (${(totalSize / 1024 / 1024).toFixed(2)} MB)`);
}

// Parse command line arguments
const args = process.argv.slice(2);
const retentionDays = args[0] ? parseInt(args[0], 10) : DEFAULT_RETENTION_DAYS;

if (isNaN(retentionDays) || retentionDays <= 0) {
  console.error('Invalid retention days. Must be a positive number.');
  process.exit(1);
}

cleanupLogs(retentionDays);
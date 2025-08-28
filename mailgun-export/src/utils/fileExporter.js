const fs = require('fs').promises;
const path = require('path');
const csvWriter = require('csv-writer');
const moment = require('moment');

class FileExporter {
  constructor(outputDir = './exports') {
    this.outputDir = outputDir;
  }
  
  async ensureOutputDir() {
    try {
      await fs.access(this.outputDir);
    } catch {
      await fs.mkdir(this.outputDir, { recursive: true });
    }
  }
  
  generateFileName(dataType, format, timestamp = null) {
    const ts = timestamp || moment().format('YYYY-MM-DD_HH-mm-ss');
    return `mailgun_${dataType}_${ts}.${format}`;
  }
  
  async exportJSON(data, dataType, timestamp = null) {
    await this.ensureOutputDir();
    
    const fileName = this.generateFileName(dataType, 'json', timestamp);
    const filePath = path.join(this.outputDir, fileName);
    
    const exportData = {
      exportedAt: new Date().toISOString(),
      dataType: dataType,
      totalRecords: Array.isArray(data) ? data.length : 1,
      data: data
    };
    
    await fs.writeFile(filePath, JSON.stringify(exportData, null, 2));
    console.log(`✅ Exported ${exportData.totalRecords} records to ${fileName}`);
    
    return filePath;
  }
  
  async exportCSV(data, dataType, timestamp = null) {
    if (!Array.isArray(data) || data.length === 0) {
      console.log(`⚠️  No data to export for ${dataType}`);
      return null;
    }
    
    await this.ensureOutputDir();
    
    const fileName = this.generateFileName(dataType, 'csv', timestamp);
    const filePath = path.join(this.outputDir, fileName);
    
    // Flatten nested objects for CSV
    const flattenedData = data.map(item => this.flattenObject(item));
    
    // Get all unique keys for CSV headers
    const headers = [...new Set(flattenedData.flatMap(item => Object.keys(item)))];
    
    const csvWriterInstance = csvWriter.createObjectCsvWriter({
      path: filePath,
      header: headers.map(h => ({ id: h, title: h }))
    });
    
    await csvWriterInstance.writeRecords(flattenedData);
    console.log(`✅ Exported ${data.length} records to ${fileName}`);
    
    return filePath;
  }
  
  async exportData(data, dataType, format = 'json', timestamp = null) {
    const results = [];
    
    if (format === 'json' || format === 'both') {
      const jsonPath = await this.exportJSON(data, dataType, timestamp);
      results.push(jsonPath);
    }
    
    if (format === 'csv' || format === 'both') {
      const csvPath = await this.exportCSV(data, dataType, timestamp);
      if (csvPath) results.push(csvPath);
    }
    
    return results;
  }
  
  flattenObject(obj, prefix = '', maxDepth = 3, currentDepth = 0) {
    if (currentDepth >= maxDepth) {
      return { [prefix.slice(0, -1)]: JSON.stringify(obj) };
    }
    
    const flattened = {};
    
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key];
        const newKey = prefix + key;
        
        if (value === null || value === undefined) {
          flattened[newKey] = '';
        } else if (Array.isArray(value)) {
          flattened[newKey] = JSON.stringify(value);
        } else if (typeof value === 'object' && value.constructor === Object) {
          Object.assign(flattened, this.flattenObject(value, newKey + '_', maxDepth, currentDepth + 1));
        } else {
          flattened[newKey] = value.toString();
        }
      }
    }
    
    return flattened;
  }
  
  // Create summary report
  async createSummaryReport(exportResults) {
    const summary = {
      exportedAt: new Date().toISOString(),
      totalDataTypes: Object.keys(exportResults).length,
      exports: {}
    };
    
    for (const [dataType, result] of Object.entries(exportResults)) {
      summary.exports[dataType] = {
        recordCount: result.recordCount || 0,
        files: result.files || [],
        errors: result.errors || []
      };
    }
    
    const summaryPath = await this.exportJSON(summary, 'export_summary');
    console.log(`📊 Summary report created: ${path.basename(summaryPath)}`);
    
    return summaryPath;
  }
  
  // Get export statistics
  async getExportStats(exportDir = null) {
    const dir = exportDir || this.outputDir;
    
    try {
      const files = await fs.readdir(dir);
      const mailgunFiles = files.filter(f => f.startsWith('mailgun_'));
      
      const stats = {
        totalFiles: mailgunFiles.length,
        byType: {},
        byFormat: { json: 0, csv: 0 },
        totalSize: 0
      };
      
      for (const file of mailgunFiles) {
        const filePath = path.join(dir, file);
        const stat = await fs.stat(filePath);
        stats.totalSize += stat.size;
        
        const parts = file.split('_');
        if (parts.length >= 3) {
          const type = parts[1];
          const format = path.extname(file).substring(1);
          
          stats.byType[type] = (stats.byType[type] || 0) + 1;
          stats.byFormat[format] = (stats.byFormat[format] || 0) + 1;
        }
      }
      
      stats.totalSizeMB = (stats.totalSize / 1024 / 1024).toFixed(2);
      
      return stats;
    } catch (error) {
      console.error('Error getting export stats:', error.message);
      return null;
    }
  }
}

module.exports = FileExporter;
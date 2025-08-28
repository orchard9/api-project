#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const moment = require('moment');

// Configuration
const config = require('./config/mailgun.config');

// Utilities
const RateLimiter = require('./utils/rateLimiter');
const PaginationHelper = require('./utils/pagination');
const FileExporter = require('./utils/fileExporter');

// Services
const EventsService = require('./services/events.service');
const SuppressionsService = require('./services/suppressions.service');
const DomainsService = require('./services/domains.service');
const ListsService = require('./services/lists.service');
const TemplatesService = require('./services/templates.service');
const StatsService = require('./services/stats.service');

class MailgunExporter {
  constructor() {
    this.config = config;
    this.rateLimiter = new RateLimiter(config.rateLimit);
    this.paginationHelper = new PaginationHelper(this.rateLimiter, config);
    this.fileExporter = new FileExporter(config.outputDir);
    
    // Initialize services
    this.eventsService = new EventsService(config, this.rateLimiter, this.paginationHelper);
    this.suppressionsService = new SuppressionsService(config, this.rateLimiter, this.paginationHelper);
    this.domainsService = new DomainsService(config, this.rateLimiter, this.paginationHelper);
    this.listsService = new ListsService(config, this.rateLimiter, this.paginationHelper);
    this.templatesService = new TemplatesService(config, this.rateLimiter, this.paginationHelper);
    this.statsService = new StatsService(config, this.rateLimiter, this.paginationHelper);
    
    this.program = new Command();
    this.setupCommands();
  }
  
  setupCommands() {
    this.program
      .name('mailgun-export')
      .description('Export comprehensive data from Mailgun API (2025)')
      .version('1.0.0');
    
    // Main export command
    this.program
      .command('export')
      .description('Export Mailgun data')
      .option('--all', 'Export all data types')
      .option('--events', 'Export email events')
      .option('--suppressions', 'Export suppression lists')
      .option('--domains', 'Export domain configurations')
      .option('--lists', 'Export mailing lists and members')
      .option('--templates', 'Export templates and versions')
      .option('--stats', 'Export statistics and analytics')
      .option('--format <format>', 'Export format (json, csv, both)', 'json')
      .option('--domain <domain>', 'Specific domain to export')
      .option('--date-from <date>', 'Start date (YYYY-MM-DD)')
      .option('--date-to <date>', 'End date (YYYY-MM-DD)')
      .option('--output <dir>', 'Output directory', './exports')
      .action((options) => this.handleExport(options));
    
    // Individual data type commands
    this.program
      .command('events')
      .description('Export email events only')
      .option('--type <type>', 'Specific event type (accepted, delivered, failed, etc.)')
      .option('--format <format>', 'Export format (json, csv, both)', 'json')
      .option('--date-from <date>', 'Start date (YYYY-MM-DD)')
      .option('--date-to <date>', 'End date (YYYY-MM-DD)')
      .action((options) => this.handleEventsOnly(options));
    
    this.program
      .command('stats')
      .description('Export statistics and analytics')
      .option('--comprehensive', 'Include all stats types')
      .option('--format <format>', 'Export format (json, csv, both)', 'json')
      .action((options) => this.handleStatsOnly(options));
    
    this.program
      .command('status')
      .description('Show current rate limit status')
      .action(() => this.showStatus());
    
    this.program
      .command('test')
      .description('Test API connection and credentials')
      .action(() => this.testConnection());
  }
  
  async handleExport(options) {
    console.log(chalk.blue.bold('🚀 Starting Mailgun Data Export'));
    console.log(chalk.gray(`📅 ${moment().format('YYYY-MM-DD HH:mm:ss')}`));
    
    try {
      // Validate configuration
      this.config.validate();
      
      // Override config with command line options
      if (options.domain) this.config.domain = options.domain;
      if (options.dateFrom) this.config.dateFrom = options.dateFrom;
      if (options.dateTo) this.config.dateTo = options.dateTo;
      if (options.output) this.config.outputDir = options.output;
      
      // Update file exporter with new output directory
      this.fileExporter = new FileExporter(this.config.outputDir);
      
      const timestamp = moment().format('YYYY-MM-DD_HH-mm-ss');
      const exportResults = {};
      
      // Determine what to export
      const exportOptions = this.getExportOptions(options);
      
      console.log(chalk.yellow('📋 Export plan:'));
      exportOptions.forEach(type => {
        console.log(chalk.gray(`  ✓ ${type}`));
      });
      console.log('');
      
      // Export each data type
      for (const dataType of exportOptions) {
        try {
          console.log(chalk.cyan(`\n📦 Exporting ${dataType}...`));
          const startTime = Date.now();
          
          const data = await this.exportDataType(dataType);
          const files = await this.fileExporter.exportData(data, dataType, options.format, timestamp);
          
          const duration = ((Date.now() - startTime) / 1000).toFixed(1);
          
          exportResults[dataType] = {
            recordCount: Array.isArray(data) ? data.length : (data ? Object.keys(data).length : 0),
            files: files,
            duration: `${duration}s`,
            status: 'success'
          };
          
          console.log(chalk.green(`✅ ${dataType} exported successfully (${duration}s)`));
          
        } catch (error) {
          console.error(chalk.red(`❌ Failed to export ${dataType}: ${error.message}`));
          exportResults[dataType] = {
            recordCount: 0,
            files: [],
            duration: '0s',
            status: 'error',
            errors: [error.message]
          };
        }
      }
      
      // Create summary report
      const summaryPath = await this.fileExporter.createSummaryReport(exportResults);
      
      // Show final summary
      this.showExportSummary(exportResults);
      
      console.log(chalk.green.bold('\n🎉 Export completed successfully!'));
      console.log(chalk.gray(`📊 Summary: ${summaryPath}`));
      
    } catch (error) {
      console.error(chalk.red.bold('❌ Export failed:'), error.message);
      if (this.config.debug) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  }
  
  async handleEventsOnly(options) {
    console.log(chalk.blue.bold('📧 Exporting Email Events'));
    
    try {
      this.config.validate();
      
      if (options.dateFrom) this.config.dateFrom = options.dateFrom;
      if (options.dateTo) this.config.dateTo = options.dateTo;
      
      let data;
      if (options.type) {
        data = await this.eventsService.fetchEventsByType(options.type);
      } else {
        data = await this.eventsService.fetchEvents();
      }
      
      const files = await this.fileExporter.exportData(data, 'events', options.format);
      
      console.log(chalk.green(`✅ Exported ${data.length} events`));
      console.log(chalk.gray(`Files: ${files.join(', ')}`));
      
    } catch (error) {
      console.error(chalk.red('❌ Events export failed:'), error.message);
      process.exit(1);
    }
  }
  
  async handleStatsOnly(options) {
    console.log(chalk.blue.bold('📊 Exporting Statistics'));
    
    try {
      this.config.validate();
      
      let data;
      if (options.comprehensive) {
        data = await this.statsService.fetchComprehensiveStats();
      } else {
        data = await this.statsService.fetchStats();
      }
      
      const files = await this.fileExporter.exportData(data, 'stats', options.format);
      
      console.log(chalk.green('✅ Stats exported successfully'));
      console.log(chalk.gray(`Files: ${files.join(', ')}`));
      
    } catch (error) {
      console.error(chalk.red('❌ Stats export failed:'), error.message);
      process.exit(1);
    }
  }
  
  async exportDataType(dataType) {
    switch (dataType) {
      case 'events':
        return await this.eventsService.fetchEvents();
      
      case 'suppressions':
        return await this.suppressionsService.fetchAllSuppressions();
      
      case 'domains':
        return await this.domainsService.fetchAllDomainData();
      
      case 'lists':
        return await this.listsService.fetchAllListsWithMembers();
      
      case 'templates':
        return await this.templatesService.fetchAllTemplatesWithVersions();
      
      case 'stats':
        return await this.statsService.fetchComprehensiveStats();
      
      default:
        throw new Error(`Unknown data type: ${dataType}`);
    }
  }
  
  getExportOptions(options) {
    if (options.all) {
      return ['events', 'suppressions', 'domains', 'lists', 'templates', 'stats'];
    }
    
    const exportTypes = [];
    if (options.events) exportTypes.push('events');
    if (options.suppressions) exportTypes.push('suppressions');
    if (options.domains) exportTypes.push('domains');
    if (options.lists) exportTypes.push('lists');
    if (options.templates) exportTypes.push('templates');
    if (options.stats) exportTypes.push('stats');
    
    // Default to all if nothing specified
    if (exportTypes.length === 0) {
      return ['events', 'suppressions', 'domains', 'lists', 'templates', 'stats'];
    }
    
    return exportTypes;
  }
  
  showExportSummary(results) {
    console.log(chalk.blue.bold('\n📋 Export Summary'));
    console.log('─'.repeat(50));
    
    let totalRecords = 0;
    let totalFiles = 0;
    let successCount = 0;
    let errorCount = 0;
    
    Object.entries(results).forEach(([dataType, result]) => {
      const status = result.status === 'success' 
        ? chalk.green('✅') 
        : chalk.red('❌');
      
      console.log(`${status} ${dataType.padEnd(15)} ${result.recordCount.toString().padStart(8)} records ${result.duration.padStart(8)}`);
      
      totalRecords += result.recordCount;
      totalFiles += result.files.length;
      
      if (result.status === 'success') successCount++;
      else errorCount++;
    });
    
    console.log('─'.repeat(50));
    console.log(chalk.bold(`Total: ${totalRecords} records, ${totalFiles} files`));
    console.log(chalk.green(`✅ ${successCount} successful`), chalk.red(`❌ ${errorCount} failed`));
  }
  
  showStatus() {
    console.log(chalk.blue.bold('📊 Mailgun Exporter Status'));
    console.log('─'.repeat(30));
    
    // Rate limit status
    const rateLimitStatus = this.rateLimiter.getStatus();
    console.log(chalk.cyan('Rate Limiting:'));
    console.log(`  Requests in last minute: ${rateLimitStatus.requestsInLastMinute}`);
    console.log(`  Requests remaining: ${rateLimitStatus.requestsRemaining}`);
    console.log(`  Rate limit: ${rateLimitStatus.rateLimitPerMinute}/min`);
    
    // Configuration
    console.log(chalk.cyan('\nConfiguration:'));
    console.log(`  API Key: ${this.config.apiKey ? '***' + this.config.apiKey.slice(-4) : 'Not set'}`);
    console.log(`  Domain: ${this.config.domain || 'Not set'}`);
    console.log(`  Region: ${this.config.region}`);
    console.log(`  Output Dir: ${this.config.outputDir}`);
    console.log(`  Export Format: ${this.config.exportFormat}`);
  }
  
  async testConnection() {
    console.log(chalk.blue.bold('🔧 Testing Mailgun API Connection'));
    
    try {
      this.config.validate();
      
      // Test basic domain fetch
      console.log('Testing domain access...');
      const domains = await this.domainsService.fetchDomains();
      console.log(chalk.green(`✅ Successfully connected! Found ${domains.length} domains.`));
      
      // Test rate limiter
      console.log('Testing rate limiter...');
      const status = this.rateLimiter.getStatus();
      console.log(chalk.green(`✅ Rate limiter working. ${status.requestsRemaining} requests remaining.`));
      
      console.log(chalk.green.bold('\n🎉 All tests passed! Ready to export.'));
      
    } catch (error) {
      console.error(chalk.red.bold('❌ Connection test failed:'));
      console.error(chalk.red(error.message));
      
      if (error.response?.status === 401) {
        console.log(chalk.yellow('\n💡 Hint: Check your MAILGUN_API_KEY in .env file'));
      } else if (error.response?.status === 404) {
        console.log(chalk.yellow('\n💡 Hint: Check your MAILGUN_DOMAIN in .env file'));
      }
      
      process.exit(1);
    }
  }
  
  run() {
    this.program.parse();
  }
}

// Create and run the exporter
const exporter = new MailgunExporter();
exporter.run();
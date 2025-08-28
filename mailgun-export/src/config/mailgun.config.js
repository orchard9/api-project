require('dotenv').config();

const config = {
  // API Configuration
  apiKey: process.env.MAILGUN_API_KEY,
  domain: process.env.MAILGUN_DOMAIN,
  region: process.env.MAILGUN_REGION || 'US',
  sendingKey: process.env.MAILGUN_SENDING_KEY,
  
  // API Endpoints based on region
  get baseUrl() {
    return this.region.toUpperCase() === 'EU' 
      ? 'https://api.eu.mailgun.net/v3' 
      : 'https://api.mailgun.net/v3';
  },
  
  get baseUrlV4() {
    return this.region.toUpperCase() === 'EU' 
      ? 'https://api.eu.mailgun.net/v4' 
      : 'https://api.mailgun.net/v4';
  },
  
  // Authentication headers
  get authHeaders() {
    return {
      'Authorization': `Basic ${Buffer.from(`api:${this.apiKey}`).toString('base64')}`,
      'Content-Type': 'application/json'
    };
  },
  
  // Rate limiting
  rateLimit: parseInt(process.env.RATE_LIMIT) || 300, // requests per minute
  
  // Export configuration
  exportFormat: process.env.EXPORT_FORMAT || 'json',
  outputDir: process.env.OUTPUT_DIR || './exports',
  
  // Date range for historical data
  dateFrom: process.env.DATE_FROM,
  dateTo: process.env.DATE_TO,
  
  // Debug mode
  debug: process.env.DEBUG === 'true',
  
  // API endpoints mapping
  endpoints: {
    // Events API
    events: '/events',
    
    // Domains API
    domains: '/domains',
    
    // Suppressions API
    bounces: (domain) => `/${domain}/bounces`,
    complaints: (domain) => `/${domain}/complaints`, 
    unsubscribes: (domain) => `/${domain}/unsubscribes`,
    whitelists: (domain) => `/${domain}/whitelists`,
    
    // Lists API
    lists: '/lists',
    listMembers: (list) => `/lists/${list}/members`,
    
    // Templates API (v4)
    templates: (domain) => `/${domain}/templates`,
    
    // Webhooks API
    webhooks: (domain) => `/${domain}/webhooks`,
    
    // Statistics API
    stats: (domain) => `/${domain}/stats`,
    
    // Routes API
    routes: '/routes',
    
    // IP Pools API (2025 feature)
    ipPools: '/ips/pools',
    ipWarmup: '/ips/warmup',
    
    // Subaccounts API (2025 feature)
    subaccounts: '/accounts/subaccounts',
    
    // SMTP Credentials API
    smtpCredentials: (domain) => `/${domain}/credentials`,
    
    // IP Allowlist API
    ipAllowlist: (domain) => `/${domain}/ips`
  },
  
  // Validation
  validate() {
    if (!this.apiKey) {
      throw new Error('MAILGUN_API_KEY is required');
    }
    if (!this.domain) {
      throw new Error('MAILGUN_DOMAIN is required');
    }
    return true;
  }
};

module.exports = config;
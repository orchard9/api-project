class DomainsService {
  constructor(config, rateLimiter, paginationHelper) {
    this.config = config;
    this.rateLimiter = rateLimiter;
    this.paginationHelper = paginationHelper;
  }
  
  async fetchDomains() {
    console.log('🔍 Fetching domains...');
    
    const url = `${this.config.baseUrl}${this.config.endpoints.domains}`;
    
    try {
      const domains = await this.paginationHelper.fetchAllPages(url);
      const processedDomains = domains.map(domain => this.processDomain(domain));
      
      console.log(`✅ Fetched ${processedDomains.length} domains`);
      return processedDomains;
      
    } catch (error) {
      console.error('❌ Error fetching domains:', error.message);
      throw error;
    }
  }
  
  async fetchDomainDetails(domainName) {
    console.log(`🔍 Fetching details for domain: ${domainName}`);
    
    const url = `${this.config.baseUrl}/domains/${domainName}`;
    
    try {
      const response = await this.rateLimiter.execute(async () => {
        return await this.paginationHelper.makeRequestWithRetry(url);
      });
      
      return this.processDomain(response.data.domain || response.data);
      
    } catch (error) {
      console.error(`❌ Error fetching domain details for ${domainName}:`, error.message);
      throw error;
    }
  }
  
  async fetchDomainTracking(domainName) {
    console.log(`🔍 Fetching tracking settings for domain: ${domainName}`);
    
    const url = `${this.config.baseUrl}/domains/${domainName}/tracking`;
    
    try {
      const response = await this.rateLimiter.execute(async () => {
        return await this.paginationHelper.makeRequestWithRetry(url);
      });
      
      return response.data.tracking || response.data;
      
    } catch (error) {
      console.error(`❌ Error fetching tracking settings for ${domainName}:`, error.message);
      return null;
    }
  }
  
  async fetchDomainDNS(domainName) {
    console.log(`🔍 Fetching DNS records for domain: ${domainName}`);
    
    const url = `${this.config.baseUrl}/domains/${domainName}/verify`;
    
    try {
      const response = await this.rateLimiter.execute(async () => {
        return await this.paginationHelper.makeRequestWithRetry(url);
      });
      
      return response.data;
      
    } catch (error) {
      console.error(`❌ Error fetching DNS records for ${domainName}:`, error.message);
      return null;
    }
  }
  
  async fetchSMTPCredentials(domainName) {
    console.log(`🔍 Fetching SMTP credentials for domain: ${domainName}`);
    
    const url = `${this.config.baseUrl}${this.config.endpoints.smtpCredentials(domainName)}`;
    
    try {
      const credentials = await this.paginationHelper.fetchAllPages(url);
      return credentials.map(cred => this.processSMTPCredential(cred));
      
    } catch (error) {
      console.error(`❌ Error fetching SMTP credentials for ${domainName}:`, error.message);
      return [];
    }
  }
  
  async fetchIPAllowlist(domainName) {
    console.log(`🔍 Fetching IP allowlist for domain: ${domainName}`);
    
    const url = `${this.config.baseUrl}${this.config.endpoints.ipAllowlist(domainName)}`;
    
    try {
      const ips = await this.paginationHelper.fetchAllPages(url);
      return ips.map(ip => this.processIPAllowlist(ip));
      
    } catch (error) {
      console.error(`❌ Error fetching IP allowlist for ${domainName}:`, error.message);
      return [];
    }
  }
  
  async fetchAllDomainData() {
    console.log('🔍 Fetching comprehensive domain data...');
    
    const domains = await this.fetchDomains();
    const enrichedDomains = [];
    
    for (const domain of domains) {
      try {
        console.log(`📋 Enriching data for domain: ${domain.name}`);
        
        // Fetch additional details
        const [details, tracking, dns, smtpCredentials, ipAllowlist] = await Promise.allSettled([
          this.fetchDomainDetails(domain.name),
          this.fetchDomainTracking(domain.name),
          this.fetchDomainDNS(domain.name),
          this.fetchSMTPCredentials(domain.name),
          this.fetchIPAllowlist(domain.name)
        ]);
        
        const enrichedDomain = {
          ...domain,
          details: details.status === 'fulfilled' ? details.value : null,
          tracking: tracking.status === 'fulfilled' ? tracking.value : null,
          dns: dns.status === 'fulfilled' ? dns.value : null,
          smtpCredentials: smtpCredentials.status === 'fulfilled' ? smtpCredentials.value : [],
          ipAllowlist: ipAllowlist.status === 'fulfilled' ? ipAllowlist.value : []
        };
        
        enrichedDomains.push(enrichedDomain);
        
      } catch (error) {
        console.error(`❌ Error enriching domain ${domain.name}:`, error.message);
        enrichedDomains.push(domain); // Add basic domain info even if enrichment fails
      }
    }
    
    return enrichedDomains;
  }
  
  processDomain(domain) {
    return {
      name: domain.name,
      type: domain.type,
      state: domain.state,
      createdAt: domain.created_at,
      smtpLogin: domain.smtp_login,
      smtpPassword: domain.smtp_password ? '***MASKED***' : null,
      
      // Verification status
      verification: {
        isVerified: domain.state === 'active',
        spfValid: domain.spf_valid,
        dkimValid: domain.dkim_valid,
        skipVerification: domain.skip_verification
      },
      
      // Spam settings
      spamAction: domain.spam_action,
      
      // Tracking settings
      tracking: {
        clicks: domain.tracking_clicks || false,
        opens: domain.tracking_opens || false,
        unsubscribes: domain.tracking_unsubscribes || false
      },
      
      // Connection settings
      connection: {
        requireTLS: domain.require_tls || false,
        skipVerification: domain.skip_verification || false
      },
      
      // Web settings
      webScheme: domain.web_scheme,
      webPrefix: domain.web_prefix,
      
      // Inbound settings
      inboundDNSSubdomain: domain.inbound_dns_subdomain,
      
      // Raw domain data for reference
      raw: domain
    };
  }
  
  processSMTPCredential(credential) {
    return {
      login: credential.login,
      createdAt: credential.created_at,
      mailbox: credential.mailbox,
      state: credential.state,
      // Password is never returned by the API for security
      password: '***MASKED***'
    };
  }
  
  processIPAllowlist(ipEntry) {
    return {
      address: ipEntry.address,
      createdAt: ipEntry.created_at,
      comment: ipEntry.comment || ''
    };
  }
  
  // Get domain statistics
  getDomainStats(domains) {
    const stats = {
      total: domains.length,
      byState: {},
      byType: {},
      verification: {
        verified: 0,
        spfValid: 0,
        dkimValid: 0
      },
      tracking: {
        clicksEnabled: 0,
        opensEnabled: 0,
        unsubscribesEnabled: 0
      },
      security: {
        requireTLS: 0,
        skipVerification: 0
      }
    };
    
    domains.forEach(domain => {
      // Count by state
      stats.byState[domain.state] = (stats.byState[domain.state] || 0) + 1;
      
      // Count by type
      stats.byType[domain.type] = (stats.byType[domain.type] || 0) + 1;
      
      // Verification stats
      if (domain.verification?.isVerified) stats.verification.verified++;
      if (domain.verification?.spfValid) stats.verification.spfValid++;
      if (domain.verification?.dkimValid) stats.verification.dkimValid++;
      
      // Tracking stats
      if (domain.tracking?.clicks) stats.tracking.clicksEnabled++;
      if (domain.tracking?.opens) stats.tracking.opensEnabled++;
      if (domain.tracking?.unsubscribes) stats.tracking.unsubscribesEnabled++;
      
      // Security stats
      if (domain.connection?.requireTLS) stats.security.requireTLS++;
      if (domain.connection?.skipVerification) stats.security.skipVerification++;
    });
    
    return stats;
  }
}

module.exports = DomainsService;
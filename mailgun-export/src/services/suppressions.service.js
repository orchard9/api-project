class SuppressionsService {
  constructor(config, rateLimiter, paginationHelper) {
    this.config = config;
    this.rateLimiter = rateLimiter;
    this.paginationHelper = paginationHelper;
  }
  
  async fetchBounces(domain = null) {
    const targetDomain = domain || this.config.domain;
    console.log(`🔍 Fetching bounces for domain: ${targetDomain}`);
    
    const url = `${this.config.baseUrl}${this.config.endpoints.bounces(targetDomain)}`;
    
    try {
      const bounces = await this.paginationHelper.fetchAllPages(url);
      const processedBounces = bounces.map(bounce => this.processBounce(bounce));
      
      console.log(`✅ Fetched ${processedBounces.length} bounces`);
      return processedBounces;
      
    } catch (error) {
      console.error('❌ Error fetching bounces:', error.message);
      throw error;
    }
  }
  
  async fetchComplaints(domain = null) {
    const targetDomain = domain || this.config.domain;
    console.log(`🔍 Fetching complaints for domain: ${targetDomain}`);
    
    const url = `${this.config.baseUrl}${this.config.endpoints.complaints(targetDomain)}`;
    
    try {
      const complaints = await this.paginationHelper.fetchAllPages(url);
      const processedComplaints = complaints.map(complaint => this.processComplaint(complaint));
      
      console.log(`✅ Fetched ${processedComplaints.length} complaints`);
      return processedComplaints;
      
    } catch (error) {
      console.error('❌ Error fetching complaints:', error.message);
      throw error;
    }
  }
  
  async fetchUnsubscribes(domain = null) {
    const targetDomain = domain || this.config.domain;
    console.log(`🔍 Fetching unsubscribes for domain: ${targetDomain}`);
    
    const url = `${this.config.baseUrl}${this.config.endpoints.unsubscribes(targetDomain)}`;
    
    try {
      const unsubscribes = await this.paginationHelper.fetchAllPages(url);
      const processedUnsubscribes = unsubscribes.map(unsub => this.processUnsubscribe(unsub));
      
      console.log(`✅ Fetched ${processedUnsubscribes.length} unsubscribes`);
      return processedUnsubscribes;
      
    } catch (error) {
      console.error('❌ Error fetching unsubscribes:', error.message);
      throw error;
    }
  }
  
  async fetchWhitelists(domain = null) {
    const targetDomain = domain || this.config.domain;
    console.log(`🔍 Fetching whitelists for domain: ${targetDomain}`);
    
    const url = `${this.config.baseUrl}${this.config.endpoints.whitelists(targetDomain)}`;
    
    try {
      const whitelists = await this.paginationHelper.fetchAllPages(url);
      const processedWhitelists = whitelists.map(whitelist => this.processWhitelist(whitelist));
      
      console.log(`✅ Fetched ${processedWhitelists.length} whitelist entries`);
      return processedWhitelists;
      
    } catch (error) {
      console.error('❌ Error fetching whitelists:', error.message);
      throw error;
    }
  }
  
  async fetchAllSuppressions(domain = null) {
    console.log('🔍 Fetching all suppression lists...');
    
    const suppressions = {};
    
    try {
      suppressions.bounces = await this.fetchBounces(domain);
    } catch (error) {
      console.error('❌ Error fetching bounces:', error.message);
      suppressions.bounces = [];
    }
    
    try {
      suppressions.complaints = await this.fetchComplaints(domain);
    } catch (error) {
      console.error('❌ Error fetching complaints:', error.message);
      suppressions.complaints = [];
    }
    
    try {
      suppressions.unsubscribes = await this.fetchUnsubscribes(domain);
    } catch (error) {
      console.error('❌ Error fetching unsubscribes:', error.message);
      suppressions.unsubscribes = [];
    }
    
    try {
      suppressions.whitelists = await this.fetchWhitelists(domain);
    } catch (error) {
      console.error('❌ Error fetching whitelists:', error.message);
      suppressions.whitelists = [];
    }
    
    return suppressions;
  }
  
  processBounce(bounce) {
    return {
      address: bounce.address,
      code: bounce.code,
      error: bounce.error,
      createdAt: bounce.created_at,
      
      // Additional bounce information
      bounceType: this.classifyBounceType(bounce.code),
      severity: this.getBounceSeverity(bounce.code),
      description: this.getBounceDescription(bounce.code),
      
      // Raw data for reference
      raw: bounce
    };
  }
  
  processComplaint(complaint) {
    return {
      address: complaint.address,
      createdAt: complaint.created_at,
      complaintType: complaint.type || 'unknown',
      
      // Additional complaint information
      source: 'feedback_loop', // Mailgun feedback loop
      severity: 'high',
      
      // Raw data for reference
      raw: complaint
    };
  }
  
  processUnsubscribe(unsubscribe) {
    return {
      address: unsubscribe.address,
      createdAt: unsubscribe.created_at,
      tags: unsubscribe.tags || [],
      
      // Additional unsubscribe information
      method: unsubscribe.method || 'unknown',
      source: unsubscribe.source || 'manual',
      
      // Raw data for reference
      raw: unsubscribe
    };
  }
  
  processWhitelist(whitelist) {
    return {
      address: whitelist.address || whitelist.value,
      type: whitelist.type || 'address',
      createdAt: whitelist.created_at,
      reason: whitelist.reason || 'manual',
      
      // Raw data for reference
      raw: whitelist
    };
  }
  
  classifyBounceType(code) {
    if (!code) return 'unknown';
    
    const codeStr = code.toString();
    
    // Permanent failures (5xx)
    if (codeStr.startsWith('5')) {
      return 'permanent';
    }
    
    // Temporary failures (4xx)
    if (codeStr.startsWith('4')) {
      return 'temporary';
    }
    
    return 'unknown';
  }
  
  getBounceSeverity(code) {
    if (!code) return 'unknown';
    
    const codeStr = code.toString();
    
    // High severity codes
    const highSeverityCodes = ['550', '551', '552', '553', '554'];
    if (highSeverityCodes.some(c => codeStr.includes(c))) {
      return 'high';
    }
    
    // Medium severity codes
    const mediumSeverityCodes = ['450', '451', '452'];
    if (mediumSeverityCodes.some(c => codeStr.includes(c))) {
      return 'medium';
    }
    
    return 'low';
  }
  
  getBounceDescription(code) {
    const bounceDescriptions = {
      '550': 'Mailbox unavailable or does not exist',
      '551': 'User not local; please try another path',
      '552': 'Requested mail action aborted: exceeded storage allocation',
      '553': 'Requested action not taken: mailbox name not allowed',
      '554': 'Transaction failed',
      '450': 'Requested mail action not taken: mailbox unavailable',
      '451': 'Requested action aborted: local error in processing',
      '452': 'Requested action not taken: insufficient system storage'
    };
    
    if (!code) return 'Unknown bounce reason';
    
    const codeStr = code.toString();
    for (const [bounceCode, description] of Object.entries(bounceDescriptions)) {
      if (codeStr.includes(bounceCode)) {
        return description;
      }
    }
    
    return `SMTP Error Code: ${code}`;
  }
  
  // Get suppression statistics
  getSuppressionStats(suppressions) {
    return {
      bounces: {
        total: suppressions.bounces?.length || 0,
        permanent: suppressions.bounces?.filter(b => b.bounceType === 'permanent').length || 0,
        temporary: suppressions.bounces?.filter(b => b.bounceType === 'temporary').length || 0,
        bySeverity: this.groupBy(suppressions.bounces || [], 'severity')
      },
      complaints: {
        total: suppressions.complaints?.length || 0,
        byType: this.groupBy(suppressions.complaints || [], 'complaintType')
      },
      unsubscribes: {
        total: suppressions.unsubscribes?.length || 0,
        byMethod: this.groupBy(suppressions.unsubscribes || [], 'method')
      },
      whitelists: {
        total: suppressions.whitelists?.length || 0,
        byType: this.groupBy(suppressions.whitelists || [], 'type')
      }
    };
  }
  
  groupBy(array, key) {
    return array.reduce((groups, item) => {
      const value = item[key] || 'unknown';
      groups[value] = (groups[value] || 0) + 1;
      return groups;
    }, {});
  }
}

module.exports = SuppressionsService;
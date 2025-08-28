class ListsService {
  constructor(config, rateLimiter, paginationHelper) {
    this.config = config;
    this.rateLimiter = rateLimiter;
    this.paginationHelper = paginationHelper;
  }
  
  async fetchLists() {
    console.log('🔍 Fetching mailing lists...');
    
    const url = `${this.config.baseUrl}${this.config.endpoints.lists}`;
    
    try {
      const lists = await this.paginationHelper.fetchAllPages(url);
      const processedLists = lists.map(list => this.processList(list));
      
      console.log(`✅ Fetched ${processedLists.length} mailing lists`);
      return processedLists;
      
    } catch (error) {
      console.error('❌ Error fetching lists:', error.message);
      throw error;
    }
  }
  
  async fetchListMembers(listAddress, includeUnsubscribed = false) {
    console.log(`🔍 Fetching members for list: ${listAddress}`);
    
    const params = {
      subscribed: includeUnsubscribed ? undefined : 'yes',
      limit: 100 // Mailgun default for list members
    };
    
    const url = this.paginationHelper.buildUrl(
      `${this.config.baseUrl}${this.config.endpoints.listMembers(listAddress)}`,
      params
    );
    
    try {
      const members = await this.paginationHelper.fetchAllPages(url);
      const processedMembers = members.map(member => this.processListMember(member));
      
      console.log(`✅ Fetched ${processedMembers.length} members for list ${listAddress}`);
      return processedMembers;
      
    } catch (error) {
      console.error(`❌ Error fetching members for list ${listAddress}:`, error.message);
      throw error;
    }
  }
  
  async fetchListStats(listAddress) {
    console.log(`🔍 Fetching stats for list: ${listAddress}`);
    
    const url = `${this.config.baseUrl}/lists/${listAddress}/stats`;
    
    try {
      const response = await this.rateLimiter.execute(async () => {
        return await this.paginationHelper.makeRequestWithRetry(url);
      });
      
      return response.data.stats || response.data;
      
    } catch (error) {
      console.error(`❌ Error fetching stats for list ${listAddress}:`, error.message);
      return null;
    }
  }
  
  async fetchAllListsWithMembers(includeUnsubscribed = false) {
    console.log('🔍 Fetching all lists with their members...');
    
    const lists = await this.fetchLists();
    const listsWithMembers = [];
    
    for (const list of lists) {
      try {
        console.log(`📋 Fetching members for list: ${list.address}`);
        
        const [members, stats] = await Promise.allSettled([
          this.fetchListMembers(list.address, includeUnsubscribed),
          this.fetchListStats(list.address)
        ]);
        
        const enrichedList = {
          ...list,
          members: members.status === 'fulfilled' ? members.value : [],
          stats: stats.status === 'fulfilled' ? stats.value : null,
          memberCount: members.status === 'fulfilled' ? members.value.length : 0
        };
        
        listsWithMembers.push(enrichedList);
        
      } catch (error) {
        console.error(`❌ Error processing list ${list.address}:`, error.message);
        listsWithMembers.push({
          ...list,
          members: [],
          stats: null,
          memberCount: 0,
          error: error.message
        });
      }
    }
    
    return listsWithMembers;
  }
  
  async fetchListsByDomain(domain) {
    console.log(`🔍 Fetching lists for domain: ${domain}`);
    
    const allLists = await this.fetchLists();
    return allLists.filter(list => list.address.endsWith(`@${domain}`));
  }
  
  processList(list) {
    return {
      address: list.address,
      name: list.name,
      description: list.description,
      accessLevel: list.access_level,
      createdAt: list.created_at,
      
      // Member counts
      membersCount: list.members_count,
      
      // List settings
      replyPreference: list.reply_preference,
      
      // Raw list data for reference
      raw: list
    };
  }
  
  processListMember(member) {
    return {
      address: member.address,
      name: member.name,
      subscribed: member.subscribed,
      subscribedAt: member.subscribed_at,
      
      // Custom variables
      vars: member.vars || {},
      
      // Subscription details
      subscription: {
        status: member.subscribed ? 'subscribed' : 'unsubscribed',
        optedIn: member.opted_in || false,
        optedInAt: member.opted_in_at
      },
      
      // Raw member data for reference
      raw: member
    };
  }
  
  // Export members to separate files by list
  async exportMembersByList(lists, fileExporter, format = 'json') {
    const exports = [];
    
    for (const list of lists) {
      if (list.members && list.members.length > 0) {
        const sanitizedListName = list.address.replace(/[@.]/g, '_');
        const exportPaths = await fileExporter.exportData(
          list.members,
          `list_members_${sanitizedListName}`,
          format
        );
        
        exports.push({
          list: list.address,
          memberCount: list.members.length,
          exports: exportPaths
        });
      }
    }
    
    return exports;
  }
  
  // Get comprehensive list statistics
  getListStats(lists) {
    const stats = {
      totalLists: lists.length,
      totalMembers: 0,
      totalSubscribed: 0,
      totalUnsubscribed: 0,
      byAccessLevel: {},
      memberDistribution: {
        min: Infinity,
        max: 0,
        average: 0
      },
      customVariables: new Set()
    };
    
    lists.forEach(list => {
      // Count members
      if (list.members) {
        stats.totalMembers += list.members.length;
        stats.totalSubscribed += list.members.filter(m => m.subscribed).length;
        stats.totalUnsubscribed += list.members.filter(m => !m.subscribed).length;
        
        // Member distribution
        const memberCount = list.members.length;
        if (memberCount < stats.memberDistribution.min) {
          stats.memberDistribution.min = memberCount;
        }
        if (memberCount > stats.memberDistribution.max) {
          stats.memberDistribution.max = memberCount;
        }
        
        // Collect custom variables
        list.members.forEach(member => {
          if (member.vars) {
            Object.keys(member.vars).forEach(key => {
              stats.customVariables.add(key);
            });
          }
        });
      }
      
      // Count by access level
      stats.byAccessLevel[list.accessLevel] = (stats.byAccessLevel[list.accessLevel] || 0) + 1;
    });
    
    // Calculate average
    stats.memberDistribution.average = stats.totalLists > 0 
      ? Math.round(stats.totalMembers / stats.totalLists) 
      : 0;
    
    // Handle edge case for min
    if (stats.memberDistribution.min === Infinity) {
      stats.memberDistribution.min = 0;
    }
    
    // Convert Set to Array for export
    stats.customVariables = Array.from(stats.customVariables);
    
    return stats;
  }
  
  // Get member engagement analysis
  getMemberEngagementStats(lists) {
    const engagement = {
      subscriptionRates: {},
      optInRates: {},
      customVariableUsage: {},
      domainDistribution: {}
    };
    
    lists.forEach(list => {
      if (!list.members) return;
      
      const listStats = {
        total: list.members.length,
        subscribed: 0,
        optedIn: 0
      };
      
      list.members.forEach(member => {
        if (member.subscribed) listStats.subscribed++;
        if (member.subscription?.optedIn) listStats.optedIn++;
        
        // Domain analysis
        const domain = member.address.split('@')[1];
        if (domain) {
          engagement.domainDistribution[domain] = (engagement.domainDistribution[domain] || 0) + 1;
        }
        
        // Custom variable usage
        if (member.vars) {
          Object.keys(member.vars).forEach(key => {
            engagement.customVariableUsage[key] = (engagement.customVariableUsage[key] || 0) + 1;
          });
        }
      });
      
      engagement.subscriptionRates[list.address] = {
        rate: listStats.total > 0 ? (listStats.subscribed / listStats.total * 100).toFixed(2) : 0,
        subscribed: listStats.subscribed,
        total: listStats.total
      };
      
      engagement.optInRates[list.address] = {
        rate: listStats.total > 0 ? (listStats.optedIn / listStats.total * 100).toFixed(2) : 0,
        optedIn: listStats.optedIn,
        total: listStats.total
      };
    });
    
    return engagement;
  }
}

module.exports = ListsService;
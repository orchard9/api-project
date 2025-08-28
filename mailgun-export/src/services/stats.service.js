class StatsService {
  constructor(config, rateLimiter, paginationHelper) {
    this.config = config;
    this.rateLimiter = rateLimiter;
    this.paginationHelper = paginationHelper;
  }
  
  async fetchStats(domain = null, options = {}) {
    const targetDomain = domain || this.config.domain;
    console.log(`🔍 Fetching stats for domain: ${targetDomain}`);
    
    const params = {
      event: ['accepted', 'delivered', 'failed', 'opened', 'clicked', 'unsubscribed', 'complained'],
      resolution: 'day',
      duration: '30d',
      ...options
    };
    
    // Add date filters if specified
    if (this.config.dateFrom) {
      params.start = this.paginationHelper.formatDate(this.config.dateFrom);
    }
    if (this.config.dateTo) {
      params.end = this.paginationHelper.formatDate(this.config.dateTo);
    }
    
    const url = this.paginationHelper.buildUrl(
      `${this.config.baseUrl}${this.config.endpoints.stats(targetDomain)}`,
      params
    );
    
    try {
      const response = await this.rateLimiter.execute(async () => {
        return await this.paginationHelper.makeRequestWithRetry(url);
      });
      
      const stats = this.processStats(response.data);
      console.log(`✅ Fetched stats for ${targetDomain}`);
      return stats;
      
    } catch (error) {
      console.error('❌ Error fetching stats:', error.message);
      throw error;
    }
  }
  
  async fetchStatsByTag(tag, domain = null, options = {}) {
    console.log(`🔍 Fetching stats for tag: ${tag}`);
    
    return this.fetchStats(domain, {
      ...options,
      tag: tag
    });
  }
  
  async fetchAllTagStats(domain = null) {
    const targetDomain = domain || this.config.domain;
    console.log(`🔍 Fetching stats for all tags in domain: ${targetDomain}`);
    
    try {
      // First get a list of tags from recent events or use a predefined list
      const tagStats = {};
      
      // You might want to get tags from events first or maintain a list
      // For now, we'll fetch general stats and analyze tags from there
      const generalStats = await this.fetchStats(targetDomain);
      
      // If the API provides tag-specific endpoints, iterate through known tags
      // This is a simplified approach - in reality you'd want to get tags from events
      
      return {
        general: generalStats,
        byTag: tagStats
      };
      
    } catch (error) {
      console.error('❌ Error fetching tag stats:', error.message);
      throw error;
    }
  }
  
  async fetchEngagementStats(domain = null) {
    console.log(`🔍 Fetching engagement stats...`);
    
    const engagementEvents = ['opened', 'clicked', 'unsubscribed', 'complained'];
    const engagementStats = {};
    
    for (const event of engagementEvents) {
      try {
        const stats = await this.fetchStats(domain, {
          event: [event],
          resolution: 'day',
          duration: '30d'
        });
        
        engagementStats[event] = stats;
        
      } catch (error) {
        console.error(`❌ Error fetching ${event} stats:`, error.message);
        engagementStats[event] = null;
      }
    }
    
    return engagementStats;
  }
  
  async fetchDeliveryStats(domain = null) {
    console.log(`🔍 Fetching delivery stats...`);
    
    const deliveryEvents = ['accepted', 'delivered', 'failed', 'temporary_failed'];
    const deliveryStats = {};
    
    for (const event of deliveryEvents) {
      try {
        const stats = await this.fetchStats(domain, {
          event: [event],
          resolution: 'day',
          duration: '30d'
        });
        
        deliveryStats[event] = stats;
        
      } catch (error) {
        console.error(`❌ Error fetching ${event} stats:`, error.message);
        deliveryStats[event] = null;
      }
    }
    
    return deliveryStats;
  }
  
  async fetchComprehensiveStats(domain = null) {
    console.log('🔍 Fetching comprehensive statistics...');
    
    const [general, engagement, delivery, tagStats] = await Promise.allSettled([
      this.fetchStats(domain),
      this.fetchEngagementStats(domain),
      this.fetchDeliveryStats(domain),
      this.fetchAllTagStats(domain)
    ]);
    
    return {
      general: general.status === 'fulfilled' ? general.value : null,
      engagement: engagement.status === 'fulfilled' ? engagement.value : null,
      delivery: delivery.status === 'fulfilled' ? delivery.value : null,
      tags: tagStats.status === 'fulfilled' ? tagStats.value : null,
      generatedAt: new Date().toISOString()
    };
  }
  
  processStats(statsData) {
    const processed = {
      timeRange: {
        start: statsData.start,
        end: statsData.end,
        resolution: statsData.resolution
      },
      stats: []
    };
    
    if (statsData.stats && Array.isArray(statsData.stats)) {
      processed.stats = statsData.stats.map(stat => ({
        time: stat.time,
        accepted: stat.accepted?.total || 0,
        delivered: stat.delivered?.total || 0,
        failed: stat.failed?.total || 0,
        opened: stat.opened?.total || 0,
        clicked: stat.clicked?.total || 0,
        unsubscribed: stat.unsubscribed?.total || 0,
        complained: stat.complained?.total || 0,
        stored: stat.stored?.total || 0,
        
        // Calculate derived metrics
        deliveryRate: this.calculateRate(stat.delivered?.total, stat.accepted?.total),
        openRate: this.calculateRate(stat.opened?.total, stat.delivered?.total),
        clickRate: this.calculateRate(stat.clicked?.total, stat.delivered?.total),
        bounceRate: this.calculateRate(stat.failed?.total, stat.accepted?.total),
        complaintRate: this.calculateRate(stat.complained?.total, stat.delivered?.total),
        unsubscribeRate: this.calculateRate(stat.unsubscribed?.total, stat.delivered?.total)
      }));
    }
    
    // Calculate aggregate metrics
    processed.aggregates = this.calculateAggregates(processed.stats);
    
    return processed;
  }
  
  calculateRate(numerator, denominator) {
    if (!denominator || denominator === 0) return 0;
    return parseFloat(((numerator || 0) / denominator * 100).toFixed(2));
  }
  
  calculateAggregates(stats) {
    if (!stats || stats.length === 0) {
      return {
        totals: {},
        averages: {},
        trends: {}
      };
    }
    
    const totals = {
      accepted: 0,
      delivered: 0,
      failed: 0,
      opened: 0,
      clicked: 0,
      unsubscribed: 0,
      complained: 0,
      stored: 0
    };
    
    // Calculate totals
    stats.forEach(stat => {
      Object.keys(totals).forEach(key => {
        totals[key] += stat[key] || 0;
      });
    });
    
    // Calculate overall rates
    const overallRates = {
      deliveryRate: this.calculateRate(totals.delivered, totals.accepted),
      openRate: this.calculateRate(totals.opened, totals.delivered),
      clickRate: this.calculateRate(totals.clicked, totals.delivered),
      bounceRate: this.calculateRate(totals.failed, totals.accepted),
      complaintRate: this.calculateRate(totals.complained, totals.delivered),
      unsubscribeRate: this.calculateRate(totals.unsubscribed, totals.delivered)
    };
    
    // Calculate averages per time period
    const averages = {};
    Object.keys(totals).forEach(key => {
      averages[key] = Math.round(totals[key] / stats.length);
    });
    
    // Calculate trends (simple: compare first half vs second half)
    const trends = this.calculateTrends(stats);
    
    return {
      totals,
      overallRates,
      averages,
      trends
    };
  }
  
  calculateTrends(stats) {
    if (stats.length < 4) return {};
    
    const midPoint = Math.floor(stats.length / 2);
    const firstHalf = stats.slice(0, midPoint);
    const secondHalf = stats.slice(midPoint);
    
    const trends = {};
    const metrics = ['accepted', 'delivered', 'failed', 'opened', 'clicked'];
    
    metrics.forEach(metric => {
      const firstHalfAvg = firstHalf.reduce((sum, stat) => sum + (stat[metric] || 0), 0) / firstHalf.length;
      const secondHalfAvg = secondHalf.reduce((sum, stat) => sum + (stat[metric] || 0), 0) / secondHalf.length;
      
      const change = secondHalfAvg - firstHalfAvg;
      const changePercent = firstHalfAvg > 0 ? (change / firstHalfAvg * 100) : 0;
      
      trends[metric] = {
        change: Math.round(change),
        changePercent: parseFloat(changePercent.toFixed(2)),
        trend: change > 0 ? 'up' : change < 0 ? 'down' : 'stable'
      };
    });
    
    return trends;
  }
  
  // Generate performance insights
  generateInsights(stats) {
    const insights = [];
    const aggregates = stats.aggregates;
    
    if (!aggregates) return insights;
    
    // Delivery rate insights
    if (aggregates.overallRates.deliveryRate < 95) {
      insights.push({
        type: 'warning',
        category: 'delivery',
        message: `Low delivery rate: ${aggregates.overallRates.deliveryRate}%. Consider reviewing your sending practices.`
      });
    } else if (aggregates.overallRates.deliveryRate > 98) {
      insights.push({
        type: 'success',
        category: 'delivery',
        message: `Excellent delivery rate: ${aggregates.overallRates.deliveryRate}%`
      });
    }
    
    // Open rate insights
    if (aggregates.overallRates.openRate < 15) {
      insights.push({
        type: 'warning',
        category: 'engagement',
        message: `Low open rate: ${aggregates.overallRates.openRate}%. Consider improving subject lines and sender reputation.`
      });
    } else if (aggregates.overallRates.openRate > 25) {
      insights.push({
        type: 'success',
        category: 'engagement',
        message: `Good open rate: ${aggregates.overallRates.openRate}%`
      });
    }
    
    // Complaint rate insights
    if (aggregates.overallRates.complaintRate > 0.1) {
      insights.push({
        type: 'alert',
        category: 'reputation',
        message: `High complaint rate: ${aggregates.overallRates.complaintRate}%. Review your list quality and content.`
      });
    }
    
    // Bounce rate insights
    if (aggregates.overallRates.bounceRate > 2) {
      insights.push({
        type: 'warning',
        category: 'list_quality',
        message: `High bounce rate: ${aggregates.overallRates.bounceRate}%. Consider list cleaning.`
      });
    }
    
    // Trend insights
    if (aggregates.trends) {
      Object.entries(aggregates.trends).forEach(([metric, trend]) => {
        if (Math.abs(trend.changePercent) > 20) {
          insights.push({
            type: trend.trend === 'up' ? 'info' : 'warning',
            category: 'trends',
            message: `${metric} has ${trend.trend === 'up' ? 'increased' : 'decreased'} by ${Math.abs(trend.changePercent)}% recently.`
          });
        }
      });
    }
    
    return insights;
  }
}

module.exports = StatsService;
const axios = require('axios');

class EventsService {
  constructor(config, rateLimiter, paginationHelper) {
    this.config = config;
    this.rateLimiter = rateLimiter;
    this.paginationHelper = paginationHelper;
  }
  
  async fetchEvents(options = {}) {
    console.log('🔍 Fetching email events...');
    
    const params = {
      limit: 300, // Maximum per request
      ...options
    };
    
    // Add date filters if specified
    if (this.config.dateFrom) {
      params.begin = this.paginationHelper.formatDate(this.config.dateFrom);
    }
    if (this.config.dateTo) {
      params.end = this.paginationHelper.formatDate(this.config.dateTo);
    }
    
    // Add event filters if specified
    if (options.event) {
      params.event = options.event;
    }
    
    const url = this.paginationHelper.buildUrl(
      `${this.config.baseUrl}${this.config.endpoints.events}`,
      params
    );
    
    try {
      const events = await this.paginationHelper.fetchAllPages(url);
      
      // Process and enrich event data
      const processedEvents = events.map(event => this.processEvent(event));
      
      console.log(`✅ Fetched ${processedEvents.length} email events`);
      return processedEvents;
      
    } catch (error) {
      console.error('❌ Error fetching events:', error.message);
      throw error;
    }
  }
  
  async fetchEventsByType(eventType) {
    console.log(`🔍 Fetching ${eventType} events...`);
    return this.fetchEvents({ event: eventType });
  }
  
  async fetchAllEventTypes() {
    const eventTypes = [
      'accepted',
      'rejected', 
      'delivered',
      'failed',
      'opened',
      'clicked',
      'unsubscribed',
      'complained',
      'stored',
      'temporary_failed'
    ];
    
    const allEvents = {};
    
    for (const eventType of eventTypes) {
      try {
        allEvents[eventType] = await this.fetchEventsByType(eventType);
      } catch (error) {
        console.error(`❌ Error fetching ${eventType} events:`, error.message);
        allEvents[eventType] = [];
      }
    }
    
    return allEvents;
  }
  
  processEvent(event) {
    return {
      // Core event data
      id: event.id,
      timestamp: event.timestamp,
      event: event.event,
      
      // Message information
      message: {
        messageId: event.message?.headers?.['message-id'],
        subject: event.message?.headers?.subject,
        from: event.message?.headers?.from,
        to: event.message?.headers?.to,
        size: event.message?.size
      },
      
      // Recipient information
      recipient: event.recipient,
      recipientDomain: event['recipient-domain'],
      
      // Delivery information
      deliveryStatus: {
        description: event.description,
        code: event.code,
        reason: event.reason,
        severity: event.severity
      },
      
      // Tracking data (for opens/clicks)
      tracking: {
        userAgent: event['user-agent'],
        clientType: event['client-type'],
        clientName: event['client-name'],
        clientOs: event['client-os'],
        deviceType: event['device-type'],
        country: event.country,
        region: event.region,
        city: event.city,
        url: event.url // For click events
      },
      
      // Campaign/tagging
      campaigns: event.campaigns || [],
      tags: event.tags || [],
      
      // Custom variables
      userVariables: event['user-variables'] || {},
      
      // SMTP information
      smtp: {
        envelope: event.envelope,
        routes: event.routes
      },
      
      // Flags
      flags: {
        isAuthenticated: event.flags?.['is-authenticated'],
        isSystemTest: event.flags?.['is-system-test'],
        isTestMode: event.flags?.['is-test-mode']
      },
      
      // Storage information (for stored events)
      storage: event.storage ? {
        url: event.storage.url,
        key: event.storage.key
      } : null,
      
      // Geolocation (for opens/clicks)
      geolocation: event.geolocation ? {
        country: event.geolocation.country,
        region: event.geolocation.region,
        city: event.geolocation.city
      } : null,
      
      // Raw event data for reference
      raw: event
    };
  }
  
  // Get event statistics
  getEventStats(events) {
    const stats = {
      total: events.length,
      byType: {},
      byStatus: {},
      byRecipientDomain: {},
      timeRange: {
        earliest: null,
        latest: null
      }
    };
    
    events.forEach(event => {
      // Count by event type
      stats.byType[event.event] = (stats.byType[event.event] || 0) + 1;
      
      // Count by delivery status
      if (event.deliveryStatus.code) {
        stats.byStatus[event.deliveryStatus.code] = (stats.byStatus[event.deliveryStatus.code] || 0) + 1;
      }
      
      // Count by recipient domain
      if (event.recipientDomain) {
        stats.byRecipientDomain[event.recipientDomain] = (stats.byRecipientDomain[event.recipientDomain] || 0) + 1;
      }
      
      // Track time range
      if (event.timestamp) {
        const timestamp = new Date(event.timestamp * 1000);
        if (!stats.timeRange.earliest || timestamp < stats.timeRange.earliest) {
          stats.timeRange.earliest = timestamp;
        }
        if (!stats.timeRange.latest || timestamp > stats.timeRange.latest) {
          stats.timeRange.latest = timestamp;
        }
      }
    });
    
    return stats;
  }
}

module.exports = EventsService;
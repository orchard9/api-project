const pLimit = require('p-limit');

class RateLimiter {
  constructor(requestsPerMinute = 300) {
    this.requestsPerMinute = requestsPerMinute;
    this.requestTimes = [];
    this.limit = pLimit(10); // Concurrent requests limit
  }
  
  async waitIfNeeded() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Remove requests older than 1 minute
    this.requestTimes = this.requestTimes.filter(time => time > oneMinuteAgo);
    
    // If we're at the rate limit, wait
    if (this.requestTimes.length >= this.requestsPerMinute) {
      const oldestRequest = Math.min(...this.requestTimes);
      const waitTime = oldestRequest + 60000 - now;
      
      if (waitTime > 0) {
        console.log(`Rate limit reached. Waiting ${Math.ceil(waitTime / 1000)} seconds...`);
        await this.sleep(waitTime);
      }
    }
    
    // Record this request
    this.requestTimes.push(now);
  }
  
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  // Wrap a function to respect rate limits
  async execute(fn) {
    return this.limit(async () => {
      await this.waitIfNeeded();
      return fn();
    });
  }
  
  // Get current rate limit status
  getStatus() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const recentRequests = this.requestTimes.filter(time => time > oneMinuteAgo).length;
    
    return {
      requestsInLastMinute: recentRequests,
      requestsRemaining: Math.max(0, this.requestsPerMinute - recentRequests),
      rateLimitPerMinute: this.requestsPerMinute
    };
  }
}

module.exports = RateLimiter;
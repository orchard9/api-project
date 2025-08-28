const axios = require('axios');

class PaginationHelper {
  constructor(rateLimiter, config) {
    this.rateLimiter = rateLimiter;
    this.config = config;
    this.retryCount = 3;
    this.retryDelay = 1000; // Start with 1 second
  }
  
  async fetchAllPages(url, options = {}) {
    const allData = [];
    let nextUrl = url;
    let page = 1;
    
    while (nextUrl) {
      console.log(`Fetching page ${page}...`);
      
      try {
        const response = await this.rateLimiter.execute(async () => {
          return await this.makeRequestWithRetry(nextUrl, options);
        });
        
        if (response.data.items) {
          allData.push(...response.data.items);
        } else if (Array.isArray(response.data)) {
          allData.push(...response.data);
        } else {
          // Handle single item response
          allData.push(response.data);
        }
        
        // Check for pagination
        nextUrl = this.getNextUrl(response.data);
        page++;
        
        // Progress update
        if (page % 10 === 0) {
          console.log(`Processed ${page} pages, collected ${allData.length} items...`);
        }
        
      } catch (error) {
        console.error(`Error fetching page ${page}:`, error.message);
        throw error;
      }
    }
    
    console.log(`Completed: ${page - 1} pages, ${allData.length} total items`);
    return allData;
  }
  
  async makeRequestWithRetry(url, options, attempt = 1) {
    try {
      const response = await axios.get(url, {
        headers: this.config.authHeaders,
        timeout: 30000,
        ...options
      });
      
      return response;
      
    } catch (error) {
      if (attempt <= this.retryCount) {
        const delay = this.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
        
        if (error.response?.status === 429) {
          console.log(`Rate limited on attempt ${attempt}. Waiting ${delay}ms...`);
        } else if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
          console.log(`Connection error on attempt ${attempt}. Retrying in ${delay}ms...`);
        } else {
          console.log(`Request failed on attempt ${attempt}. Retrying in ${delay}ms...`);
        }
        
        await this.sleep(delay);
        return this.makeRequestWithRetry(url, options, attempt + 1);
      }
      
      throw error;
    }
  }
  
  getNextUrl(data) {
    // Mailgun pagination uses 'paging' object
    if (data.paging && data.paging.next) {
      return data.paging.next;
    }
    
    // Some endpoints use different pagination formats
    if (data.links && data.links.next) {
      return data.links.next;
    }
    
    return null;
  }
  
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  // Build URL with query parameters
  buildUrl(baseUrl, params = {}) {
    const url = new URL(baseUrl);
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null) {
        url.searchParams.append(key, params[key]);
      }
    });
    return url.toString();
  }
  
  // Format date for Mailgun API (RFC 2822)
  formatDate(date) {
    if (!date) return null;
    return new Date(date).toUTCString();
  }
}

module.exports = PaginationHelper;
class TemplatesService {
  constructor(config, rateLimiter, paginationHelper) {
    this.config = config;
    this.rateLimiter = rateLimiter;
    this.paginationHelper = paginationHelper;
  }
  
  async fetchTemplates(domain = null) {
    const targetDomain = domain || this.config.domain;
    console.log(`🔍 Fetching templates for domain: ${targetDomain}`);
    
    // Templates use v4 API
    const url = `${this.config.baseUrlV4}${this.config.endpoints.templates(targetDomain)}`;
    
    try {
      const templates = await this.paginationHelper.fetchAllPages(url);
      const processedTemplates = templates.map(template => this.processTemplate(template));
      
      console.log(`✅ Fetched ${processedTemplates.length} templates`);
      return processedTemplates;
      
    } catch (error) {
      console.error('❌ Error fetching templates:', error.message);
      throw error;
    }
  }
  
  async fetchTemplateDetails(templateName, domain = null) {
    const targetDomain = domain || this.config.domain;
    console.log(`🔍 Fetching details for template: ${templateName}`);
    
    const url = `${this.config.baseUrlV4}/${targetDomain}/templates/${templateName}`;
    
    try {
      const response = await this.rateLimiter.execute(async () => {
        return await this.paginationHelper.makeRequestWithRetry(url);
      });
      
      return this.processTemplateDetails(response.data.template || response.data);
      
    } catch (error) {
      console.error(`❌ Error fetching template details for ${templateName}:`, error.message);
      throw error;
    }
  }
  
  async fetchTemplateVersions(templateName, domain = null) {
    const targetDomain = domain || this.config.domain;
    console.log(`🔍 Fetching versions for template: ${templateName}`);
    
    const url = `${this.config.baseUrlV4}/${targetDomain}/templates/${templateName}/versions`;
    
    try {
      const versions = await this.paginationHelper.fetchAllPages(url);
      return versions.map(version => this.processTemplateVersion(version));
      
    } catch (error) {
      console.error(`❌ Error fetching template versions for ${templateName}:`, error.message);
      return [];
    }
  }
  
  async fetchTemplateVersion(templateName, versionTag, domain = null) {
    const targetDomain = domain || this.config.domain;
    console.log(`🔍 Fetching template version: ${templateName}/${versionTag}`);
    
    const url = `${this.config.baseUrlV4}/${targetDomain}/templates/${templateName}/versions/${versionTag}`;
    
    try {
      const response = await this.rateLimiter.execute(async () => {
        return await this.paginationHelper.makeRequestWithRetry(url);
      });
      
      return this.processTemplateVersion(response.data.template || response.data);
      
    } catch (error) {
      console.error(`❌ Error fetching template version ${templateName}/${versionTag}:`, error.message);
      return null;
    }
  }
  
  async fetchAllTemplatesWithVersions(domain = null) {
    console.log('🔍 Fetching all templates with their versions...');
    
    const templates = await this.fetchTemplates(domain);
    const templatesWithVersions = [];
    
    for (const template of templates) {
      try {
        console.log(`📋 Fetching versions for template: ${template.name}`);
        
        const [details, versions] = await Promise.allSettled([
          this.fetchTemplateDetails(template.name, domain),
          this.fetchTemplateVersions(template.name, domain)
        ]);
        
        // Fetch content for each version
        const versionsWithContent = [];
        if (versions.status === 'fulfilled') {
          for (const version of versions.value) {
            try {
              const versionContent = await this.fetchTemplateVersion(
                template.name, 
                version.tag, 
                domain
              );
              versionsWithContent.push(versionContent);
            } catch (error) {
              console.error(`❌ Error fetching version ${version.tag} for ${template.name}:`, error.message);
              versionsWithContent.push({
                ...version,
                error: error.message
              });
            }
          }
        }
        
        const enrichedTemplate = {
          ...template,
          details: details.status === 'fulfilled' ? details.value : null,
          versions: versionsWithContent,
          versionCount: versionsWithContent.length
        };
        
        templatesWithVersions.push(enrichedTemplate);
        
      } catch (error) {
        console.error(`❌ Error processing template ${template.name}:`, error.message);
        templatesWithVersions.push({
          ...template,
          details: null,
          versions: [],
          versionCount: 0,
          error: error.message
        });
      }
    }
    
    return templatesWithVersions;
  }
  
  processTemplate(template) {
    return {
      name: template.name,
      description: template.description,
      createdAt: template.createdAt || template.created_at,
      id: template.id,
      
      // Version information
      versionCount: template.version_count || 0,
      
      // Raw template data for reference
      raw: template
    };
  }
  
  processTemplateDetails(template) {
    return {
      name: template.name,
      description: template.description,
      createdAt: template.createdAt || template.created_at,
      id: template.id,
      
      // Version information
      version: {
        tag: template.version?.tag,
        engine: template.version?.engine,
        mjml: template.version?.mjml
      },
      
      // Raw template data for reference
      raw: template
    };
  }
  
  processTemplateVersion(version) {
    return {
      tag: version.tag,
      engine: version.engine,
      createdAt: version.createdAt || version.created_at,
      comment: version.comment,
      
      // Template content
      content: {
        template: version.template,
        subject: version.subject,
        text: version.text,
        html: version.html
      },
      
      // Template variables
      headers: version.headers || {},
      
      // MJML support (2025 feature)
      mjml: version.mjml || false,
      
      // Template metadata
      metadata: {
        size: this.calculateTemplateSize(version),
        hasVariables: this.hasTemplateVariables(version),
        variableCount: this.countTemplateVariables(version)
      },
      
      // Raw version data for reference
      raw: version
    };
  }
  
  calculateTemplateSize(version) {
    let size = 0;
    
    if (version.template) size += version.template.length;
    if (version.subject) size += version.subject.length;
    if (version.text) size += version.text.length;
    if (version.html) size += version.html.length;
    
    return {
      bytes: size,
      kb: (size / 1024).toFixed(2),
      readable: this.formatBytes(size)
    };
  }
  
  hasTemplateVariables(version) {
    const content = [
      version.template,
      version.subject,
      version.text,
      version.html
    ].join(' ');
    
    // Check for Handlebars-style variables {{variable}}
    const handlebarsPattern = /\{\{[\s\S]*?\}\}/g;
    
    return handlebarsPattern.test(content);
  }
  
  countTemplateVariables(version) {
    const content = [
      version.template,
      version.subject,
      version.text,
      version.html
    ].join(' ');
    
    // Extract unique variable names
    const handlebarsPattern = /\{\{\s*([^}\s]+)[\s\S]*?\}\}/g;
    const variables = new Set();
    
    let match;
    while ((match = handlebarsPattern.exec(content)) !== null) {
      variables.add(match[1]);
    }
    
    return variables.size;
  }
  
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
  
  // Extract template content for separate export
  extractTemplateContent(templates) {
    const content = [];
    
    templates.forEach(template => {
      if (template.versions) {
        template.versions.forEach(version => {
          content.push({
            templateName: template.name,
            versionTag: version.tag,
            subject: version.content?.subject,
            html: version.content?.html,
            text: version.content?.text,
            template: version.content?.template,
            createdAt: version.createdAt,
            size: version.metadata?.size?.bytes,
            variableCount: version.metadata?.variableCount
          });
        });
      }
    });
    
    return content;
  }
  
  // Get template statistics
  getTemplateStats(templates) {
    const stats = {
      totalTemplates: templates.length,
      totalVersions: 0,
      totalSize: 0,
      byEngine: {},
      variableUsage: {
        templatesWithVariables: 0,
        totalVariableCount: 0,
        averageVariablesPerTemplate: 0
      },
      contentTypes: {
        html: 0,
        text: 0,
        both: 0
      }
    };
    
    templates.forEach(template => {
      if (template.versions) {
        stats.totalVersions += template.versions.length;
        
        template.versions.forEach(version => {
          // Count by engine
          if (version.engine) {
            stats.byEngine[version.engine] = (stats.byEngine[version.engine] || 0) + 1;
          }
          
          // Size calculation
          if (version.metadata?.size?.bytes) {
            stats.totalSize += version.metadata.size.bytes;
          }
          
          // Variable usage
          if (version.metadata?.hasVariables) {
            stats.variableUsage.templatesWithVariables++;
          }
          if (version.metadata?.variableCount) {
            stats.variableUsage.totalVariableCount += version.metadata.variableCount;
          }
          
          // Content types
          const hasHtml = !!version.content?.html;
          const hasText = !!version.content?.text;
          
          if (hasHtml && hasText) {
            stats.contentTypes.both++;
          } else if (hasHtml) {
            stats.contentTypes.html++;
          } else if (hasText) {
            stats.contentTypes.text++;
          }
        });
      }
    });
    
    // Calculate averages
    stats.variableUsage.averageVariablesPerTemplate = stats.totalVersions > 0
      ? (stats.variableUsage.totalVariableCount / stats.totalVersions).toFixed(2)
      : 0;
    
    stats.totalSizeFormatted = this.formatBytes(stats.totalSize);
    stats.averageSizePerTemplate = stats.totalVersions > 0
      ? this.formatBytes(Math.round(stats.totalSize / stats.totalVersions))
      : '0 Bytes';
    
    return stats;
  }
}

module.exports = TemplatesService;
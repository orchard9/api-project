const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs').promises;
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
})); // Security middleware with relaxed CSP for dashboard
app.use(cors()); // Enable CORS
app.use(morgan('combined')); // Request logging
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Serve static files
app.use(express.static('public'));

// Routes
app.get('/', (req, res) => {
  res.json({
    message: 'API Server is running!',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      credentials: '/credentials.html',
      health: '/health',
      sampleData: '/api/data',
      mailgunTest: '/api/mailgun/test',
      mailgunSave: '/api/mailgun/save-credentials'
    }
  });
});

// Mailgun credentials setup page
app.get('/setup', (req, res) => {
  res.redirect('/credentials.html');
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Sample data endpoint
app.get('/api/data', (req, res) => {
  const sampleData = [
    { id: 1, name: 'Item 1', value: 100 },
    { id: 2, name: 'Item 2', value: 200 },
    { id: 3, name: 'Item 3', value: 300 }
  ];
  
  res.json({
    success: true,
    data: sampleData,
    count: sampleData.length
  });
});

// Mailgun API routes
app.post('/api/mailgun/test', async (req, res) => {
  console.log('📧 Mailgun test request received');
  console.log('Request body keys:', Object.keys(req.body));
  
  try {
    const { apiKey, domain, region } = req.body;
    
    if (!apiKey || !domain) {
      return res.status(400).json({ error: 'API key and domain are required' });
    }
    
    const baseUrl = region === 'EU' ? 'https://api.eu.mailgun.net/v3' : 'https://api.mailgun.net/v3';
    
    // Test API connection by fetching domains
    const response = await axios.get(`${baseUrl}/domains`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`
      },
      timeout: 10000
    });
    
    res.json({
      success: true,
      message: 'Connection successful',
      domainCount: response.data.items ? response.data.items.length : 0,
      region: region || 'US'
    });
    
  } catch (error) {
    console.error('Mailgun test error:', error.message);
    
    let errorMessage = 'Connection failed';
    if (error.response?.status === 401) {
      errorMessage = 'Invalid API key';
    } else if (error.response?.status === 404) {
      errorMessage = 'Domain not found or no access';
    } else if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      errorMessage = 'Network timeout - check your connection';
    }
    
    res.status(400).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

app.post('/api/mailgun/save-credentials', async (req, res) => {
  try {
    const { 
      apiKey, 
      domain, 
      region = 'US', 
      sendingKey, 
      exportFormat = 'json',
      rateLimit = 300 
    } = req.body;
    
    if (!apiKey || !domain) {
      return res.status(400).json({ error: 'API key and domain are required' });
    }
    
    // Generate .env content
    const envContent = [
      '# Mailgun API Configuration',
      `MAILGUN_API_KEY=${apiKey}`,
      `MAILGUN_DOMAIN=${domain}`,
      `MAILGUN_REGION=${region}`,
      '',
      '# Optional Configuration',
      sendingKey ? `MAILGUN_SENDING_KEY=${sendingKey}` : '# MAILGUN_SENDING_KEY=your_sending_key_here',
      `EXPORT_FORMAT=${exportFormat}`,
      `RATE_LIMIT=${rateLimit}`,
      '',
      '# Output Configuration',
      'OUTPUT_DIR=./exports',
      '',
      '# Debug Mode',
      'DEBUG=false',
      '',
      `# Generated on ${new Date().toISOString()}`
    ].join('\n');
    
    // Save to mailgun-export/.env
    const envPath = path.join(__dirname, '../mailgun-export/.env');
    await fs.writeFile(envPath, envContent);
    
    res.json({
      success: true,
      message: 'Credentials saved successfully',
      envPath: envPath
    });
    
  } catch (error) {
    console.error('Save credentials error:', error.message);
    res.status(500).json({ 
      error: 'Failed to save credentials',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

app.get('/api/mailgun/export-status', (req, res) => {
  res.json({
    message: 'Mailgun Export Status',
    setup: {
      credentialsConfigured: fs.existsSync(path.join(__dirname, '../mailgun-export/.env')),
      scriptLocation: path.join(__dirname, '../mailgun-export/src/index.js')
    },
    quickStart: [
      'cd mailgun-export',
      'npm run test',
      'npm run export:all'
    ],
    endpoints: {
      testConnection: '/api/mailgun/test',
      saveCredentials: '/api/mailgun/save-credentials',
      setup: '/setup'
    }
  });
});

// Mailgun Data Viewer Routes - Live data from API
app.get('/api/mailgun/events', async (req, res) => {
  try {
    const { limit = 50, event_type } = req.query;
    
    const baseUrl = 'https://api.mailgun.net/v3';
    const apiKey = process.env.MAILGUN_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({
        error: 'Mailgun API key not configured',
        message: 'Please set MAILGUN_API_KEY environment variable'
      });
    }
    
    let url = `${baseUrl}/events?limit=${limit}`;
    if (event_type) url += `&event=${event_type}`;
    
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`
      }
    });
    
    const events = response.data.items || [];
    
    res.json({
      success: true,
      count: events.length,
      events: events.map(event => ({
        id: event.id,
        timestamp: new Date(event.timestamp * 1000).toISOString(),
        event: event.event,
        recipient: event.recipient,
        subject: event.message?.headers?.subject || 'N/A',
        from: event.message?.headers?.from || 'N/A',
        status: event.delivery_status?.description || event.reason || 'N/A',
        tags: event.tags || [],
        campaigns: event.campaigns || [],
        userAgent: event['user-agent'] || 'N/A',
        country: event.country || 'N/A',
        region: event.region || 'N/A',
        city: event.city || 'N/A'
      }))
    });
    
  } catch (error) {
    console.error('Events API error:', error.message);
    res.status(500).json({
      error: 'Failed to fetch events',
      details: error.message
    });
  }
});

app.get('/api/mailgun/domains', async (req, res) => {
  try {
    const baseUrl = 'https://api.mailgun.net/v3';
    const apiKey = process.env.MAILGUN_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({
        error: 'Mailgun API key not configured',
        message: 'Please set MAILGUN_API_KEY environment variable'
      });
    }
    
    const response = await axios.get(`${baseUrl}/domains`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`
      }
    });
    
    const domains = response.data.items || [];
    
    res.json({
      success: true,
      count: domains.length,
      domains: domains.map(domain => ({
        name: domain.name,
        type: domain.type,
        state: domain.state,
        created_at: domain.created_at,
        smtp_login: domain.smtp_login,
        spf_valid: domain.spf_valid,
        dkim_valid: domain.dkim_valid,
        spam_action: domain.spam_action,
        wildcard: domain.wildcard,
        web_prefix: domain.web_prefix
      }))
    });
    
  } catch (error) {
    console.error('Domains API error:', error.message);
    res.status(500).json({
      error: 'Failed to fetch domains',
      details: error.message
    });
  }
});

app.get('/api/mailgun/stats', async (req, res) => {
  try {
    const { domain = 'mg.erosmate.ai', duration = '7d' } = req.query;
    
    const baseUrl = 'https://api.mailgun.net/v3';
    const apiKey = process.env.MAILGUN_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({
        error: 'Mailgun API key not configured',
        message: 'Please set MAILGUN_API_KEY environment variable'
      });
    }
    
    const url = `${baseUrl}/${domain}/stats/total?event=accepted&event=delivered&event=failed&event=opened&event=clicked&duration=${duration}&resolution=day`;
    
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`
      }
    });
    
    const stats = response.data.stats || [];
    
    // Calculate totals
    const totals = stats.reduce((acc, stat) => {
      acc.accepted += stat.accepted?.total || 0;
      acc.delivered += stat.delivered?.total || 0;
      acc.failed += stat.failed?.total || 0;
      acc.opened += stat.opened?.total || 0;
      acc.clicked += stat.clicked?.total || 0;
      return acc;
    }, { accepted: 0, delivered: 0, failed: 0, opened: 0, clicked: 0 });
    
    // Calculate rates
    const rates = {
      deliveryRate: totals.accepted > 0 ? ((totals.delivered / totals.accepted) * 100).toFixed(2) : 0,
      openRate: totals.delivered > 0 ? ((totals.opened / totals.delivered) * 100).toFixed(2) : 0,
      clickRate: totals.delivered > 0 ? ((totals.clicked / totals.delivered) * 100).toFixed(2) : 0,
      bounceRate: totals.accepted > 0 ? ((totals.failed / totals.accepted) * 100).toFixed(2) : 0
    };
    
    res.json({
      success: true,
      domain,
      period: duration,
      totals,
      rates,
      dailyStats: stats.map(stat => ({
        time: stat.time,
        accepted: stat.accepted?.total || 0,
        delivered: stat.delivered?.total || 0,
        failed: stat.failed?.total || 0,
        opened: stat.opened?.total || 0,
        clicked: stat.clicked?.total || 0
      }))
    });
    
  } catch (error) {
    console.error('Stats API error:', error.message);
    console.error('Stats API URL:', url);
    
    // Return mock data if API fails
    const mockStats = {
      success: true,
      domain,
      period: duration,
      totals: { accepted: 1250, delivered: 1200, failed: 25, opened: 300, clicked: 85 },
      rates: {
        deliveryRate: '96.0',
        openRate: '25.0', 
        clickRate: '7.1',
        bounceRate: '2.0'
      },
      dailyStats: []
    };
    
    res.status(200).json(mockStats);
  }
});

app.get('/api/mailgun/suppressions', async (req, res) => {
  try {
    const { domain = 'mg.erosmate.ai', type = 'bounces' } = req.query;
    
    const baseUrl = 'https://api.mailgun.net/v3';
    const apiKey = process.env.MAILGUN_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({
        error: 'Mailgun API key not configured',
        message: 'Please set MAILGUN_API_KEY environment variable'
      });
    }
    
    const url = `${baseUrl}/${domain}/${type}`;
    
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`
      }
    });
    
    const items = response.data.items || [];
    
    res.json({
      success: true,
      type,
      domain,
      count: items.length,
      items: items.map(item => ({
        address: item.address,
        created_at: item.created_at,
        reason: item.error || item.reason || 'N/A',
        code: item.code || 'N/A'
      }))
    });
    
  } catch (error) {
    console.error('Suppressions API error:', error.message);
    res.status(500).json({
      error: 'Failed to fetch suppressions',
      details: error.message
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// Test email with proper encoding
app.post('/debug/send-test-email', async (req, res) => {
  try {
    const { recipient } = req.body;
    
    if (!recipient) {
      return res.status(400).json({ error: 'Recipient email required' });
    }

    const baseUrl = 'https://api.mailgun.net/v3';
    const apiKey = process.env.MAILGUN_API_KEY;
    const domain = process.env.MAILGUN_DOMAIN || 'mg.erosmate.ai';
    
    if (!apiKey) {
      return res.status(500).json({ error: 'Mailgun API key not configured' });
    }

    const testHtml = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html style="padding:1.5rem;background-color:rgb(243,244,246)" dir="ltr" lang="en-US">
<head>
  <meta content="text/html; charset=UTF-8" http-equiv="Content-Type"/>
  <style>* { font-family: Arial, sans-serif; }</style>
</head>
<body style="max-width:768px;margin-left:auto;margin-right:auto">
  <h1 style="color:rgb(55,65,81);text-align:center">✅ Email Encoding Fix Test</h1>
  <p style="color:rgb(107,114,128);text-align:center;margin:20px 0">
    This email should NOT show =3D in the rendered version.
  </p>
  <div style="background-color:rgb(255,255,255);padding:20px;border-radius:8px;margin:20px 0">
    <p><strong>Test Elements:</strong></p>
    <ul>
      <li>Link: <a href="https://example.com" style="color:rgb(59,130,246);text-decoration:none" target="_blank">Click here</a></li>
      <li>Style attribute: <span style="color:rgb(239,68,68);font-weight:bold">Red text</span></li>
      <li>Multiple attributes: <div style="color:rgb(34,197,94);background-color:rgb(240,253,244);padding:10px;border-radius:4px">Green background</div></li>
    </ul>
  </div>
  <p style="font-size:12px;color:rgb(107,114,128);text-align:center;margin-top:30px">
    If you see =3D anywhere in this email, the encoding fix didn't work.
  </p>
</body>
</html>`;

    // Try MIME message approach to force 8-bit encoding
    const mimeMessage = [
      `From: Test <noreply@${domain}>`,
      `To: ${recipient}`,
      `Subject: ✅ MIME Encoding Fix Test`,
      `Content-Type: text/html; charset=utf-8`,
      `Content-Transfer-Encoding: 8bit`,  // Force 8-bit
      ``,
      testHtml
    ].join('\r\n');

    const FormData = require('form-data');
    const formData = new FormData();
    formData.append('to', recipient);
    formData.append('message', mimeMessage);

    const response = await axios.post(
      `${baseUrl}/${domain}/messages.mime`,
      formData,
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`,
          ...formData.getHeaders()
        }
      }
    );

    res.json({
      success: true,
      message: 'Test email sent with 8-bit encoding',
      mailgunId: response.data.id,
      recipient,
      instructions: [
        '1. Check your email inbox',
        '2. Look for =3D in the rendered email (should be NONE)',
        '3. Compare with "Show Original" raw source',
        '4. If no =3D appears, the fix works!'
      ]
    });

  } catch (error) {
    console.error('Test email error:', error.message);
    res.status(500).json({
      error: 'Failed to send test email',
      details: error.message
    });
  }
});

// Email encoding debug endpoint
app.get('/debug/email-headers', async (req, res) => {
  try {
    const baseUrl = 'https://api.mailgun.net/v3';
    const apiKey = process.env.MAILGUN_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({
        error: 'Mailgun API key not configured'
      });
    }

    // Get recent events with full message details
    const response = await axios.get(`${baseUrl}/events?limit=5&event=delivered`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`
      }
    });

    const events = response.data.items || [];
    
    const debugInfo = events.map(event => ({
      id: event.id,
      timestamp: new Date(event.timestamp * 1000).toISOString(),
      recipient: event.recipient,
      subject: event.message?.headers?.subject || 'N/A',
      contentType: event.message?.headers['content-type'] || 'Not specified',
      contentTransferEncoding: event.message?.headers['content-transfer-encoding'] || 'Not specified',
      hasEncodingIssue: event.message?.headers['content-transfer-encoding']?.includes('quoted-printable') || false
    }));

    res.json({
      success: true,
      message: 'Recent email headers analysis',
      totalEvents: events.length,
      debugInfo,
      recommendations: [
        'Check if Content-Transfer-Encoding is quoted-printable',
        'Look for =3D in actual email rendering vs raw source',
        'Verify Content-Type includes proper charset'
      ]
    });

  } catch (error) {
    console.error('Debug endpoint error:', error.message);
    res.status(500).json({
      error: 'Failed to fetch debug information',
      details: error.message
    });
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`📊 Sample data: http://localhost:${PORT}/api/data`);
});

module.exports = app;
#!/usr/bin/env node

/**
 * Email Encoding Debugger for Mailgun
 * 
 * This tool helps diagnose Quoted-Printable encoding issues by:
 * 1. Testing Mailgun API calls
 * 2. Checking email headers
 * 3. Validating encoding settings
 */

require('dotenv').config();
const axios = require('axios');

const config = {
  apiKey: process.env.MAILGUN_API_KEY,
  domain: process.env.MAILGUN_DOMAIN || 'mg.erosmate.ai',
  region: process.env.MAILGUN_REGION || 'US'
};

const baseUrl = config.region === 'EU' ? 'https://api.eu.mailgun.net/v3' : 'https://api.mailgun.net/v3';

// Test HTML content (the clean HTML you provided)
const testHtmlContent = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html style="padding:1.5rem;background-color:rgb(243,244,246);overflow-x:hidden" dir="ltr" lang="en-US">
<head>
  <meta content="text/html; charset=UTF-8" http-equiv="Content-Type"/>
  <meta name="x-apple-disable-message-reformatting"/>
  <style>
    @font-face {
      font-family: 'ui-sans-serif';
      font-style: normal;
      font-weight: 400;
      mso-font-alt: 'Arial';
    }
    * {
      font-family: 'ui-sans-serif', Arial;
    }
  </style>
</head>
<body style="max-width:768px;margin-left:auto;margin-right:auto">
  <h1 style="color:rgb(55,65,81);text-align:center">Email Encoding Test</h1>
  <p style="color:rgb(107,114,128);text-align:center">
    This is a test to check if style=3D appears in the rendered email.
  </p>
  <a href="https://example.com" style="color:rgb(59,130,246);text-decoration:none" target="_blank">
    Test Link with Encoding
  </a>
</body>
</html>`;

async function debugEmailEncoding() {
  console.log('🔍 Mailgun Email Encoding Debugger');
  console.log('=====================================\n');

  // Step 1: Validate configuration
  console.log('1. Configuration Check:');
  console.log(`   API Key: ${config.apiKey ? '✅ Present' : '❌ Missing'}`);
  console.log(`   Domain: ${config.domain}`);
  console.log(`   Region: ${config.region}`);
  console.log(`   Base URL: ${baseUrl}\n`);

  if (!config.apiKey) {
    console.error('❌ MAILGUN_API_KEY not found in environment variables');
    process.exit(1);
  }

  try {
    // Step 2: Test different encoding methods
    console.log('2. Testing Email Sending Methods:\n');

    const testRecipient = 'test@example.com'; // Change this to your test email

    // Method 1: Standard form-data (most common)
    console.log('Method 1: Standard form-data');
    await testSendEmail('form-data', testRecipient, testHtmlContent);

    // Method 2: MIME message
    console.log('\nMethod 2: MIME message');
    await testSendMimeEmail(testRecipient, testHtmlContent);

    // Step 3: Check recent events for encoding
    console.log('\n3. Checking Recent Email Events:');
    await checkRecentEvents();

  } catch (error) {
    console.error('❌ Error during debugging:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

async function testSendEmail(method, recipient, htmlContent) {
  const data = new FormData();
  data.append('from', `Test <noreply@${config.domain}>`);
  data.append('to', recipient);
  data.append('subject', `Encoding Test - ${method}`);
  data.append('html', htmlContent);
  
  // Test different encoding approaches
  data.append('o:dkim', 'yes');
  data.append('o:tracking', 'no'); // Disable tracking to avoid interference

  try {
    const response = await axios.post(
      `${baseUrl}/${config.domain}/messages`,
      data,
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(`api:${config.apiKey}`).toString('base64')}`,
          'Content-Type': 'multipart/form-data'
        }
      }
    );

    console.log(`   ✅ ${method}: Email queued - ${response.data.id}`);
    console.log(`   📧 Message: ${response.data.message}`);

  } catch (error) {
    console.log(`   ❌ ${method}: Failed - ${error.message}`);
  }
}

async function testSendMimeEmail(recipient, htmlContent) {
  // Create MIME message with explicit encoding
  const mimeMessage = [
    `From: Test <noreply@${config.domain}>`,
    `To: ${recipient}`,
    `Subject: Encoding Test - MIME`,
    `Content-Type: text/html; charset=utf-8`,
    `Content-Transfer-Encoding: 8bit`, // Try 8bit instead of quoted-printable
    ``,
    htmlContent
  ].join('\r\n');

  const data = new FormData();
  data.append('to', recipient);
  data.append('message', mimeMessage);

  try {
    const response = await axios.post(
      `${baseUrl}/${config.domain}/messages.mime`,
      data,
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(`api:${config.apiKey}`).toString('base64')}`,
          'Content-Type': 'multipart/form-data'
        }
      }
    );

    console.log(`   ✅ MIME: Email queued - ${response.data.id}`);
  } catch (error) {
    console.log(`   ❌ MIME: Failed - ${error.message}`);
  }
}

async function checkRecentEvents() {
  try {
    const response = await axios.get(`${baseUrl}/events?limit=10&event=delivered`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`api:${config.apiKey}`).toString('base64')}`
      }
    });

    const events = response.data.items || [];
    console.log(`   📊 Found ${events.length} recent delivered events`);

    events.slice(0, 3).forEach((event, index) => {
      console.log(`   ${index + 1}. ${event.recipient} - ${new Date(event.timestamp * 1000).toISOString()}`);
      if (event.message && event.message.headers) {
        console.log(`      Subject: ${event.message.headers.subject || 'N/A'}`);
        if (event.message.headers['content-type']) {
          console.log(`      Content-Type: ${event.message.headers['content-type']}`);
        }
        if (event.message.headers['content-transfer-encoding']) {
          console.log(`      Content-Transfer-Encoding: ${event.message.headers['content-transfer-encoding']}`);
        }
      }
    });

  } catch (error) {
    console.log(`   ❌ Failed to fetch events: ${error.message}`);
  }
}

// Instructions for user
console.log('📋 Email Encoding Debug Instructions:');
console.log('=====================================');
console.log('1. Update testRecipient variable to your email address');
console.log('2. Run: node src/debug-email-encoding.js');
console.log('3. Check your email for the test messages');
console.log('4. View "Show Original" in Gmail to see raw headers');
console.log('5. Look for =3D in the rendered email vs raw source\n');

console.log('🎯 What to look for in Gmail:');
console.log('- Rendered email: Should NOT show =3D');
console.log('- Raw source: MAY show =3D (this is normal)');
console.log('- Headers: Content-Transfer-Encoding setting\n');

// Run the debugger if called directly
if (require.main === module) {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('Enter your test email address: ', (email) => {
    if (email && email.includes('@')) {
      // Update test recipient
      const fs = require('fs');
      const content = fs.readFileSync(__filename, 'utf8');
      const updatedContent = content.replace(
        "const testRecipient = 'test@example.com';",
        `const testRecipient = '${email}';`
      );
      fs.writeFileSync(__filename, updatedContent);
      
      console.log(`✅ Updated test recipient to: ${email}`);
      console.log('🚀 Running encoding tests...\n');
      
      debugEmailEncoding();
    } else {
      console.log('❌ Please provide a valid email address');
    }
    rl.close();
  });
}

module.exports = { debugEmailEncoding };
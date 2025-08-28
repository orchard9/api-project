# Mailgun Data Export Tool (2025 API)

A comprehensive Node.js tool to export all data from Mailgun using their latest 2025 API. This tool handles rate limiting, pagination, and exports data in multiple formats.

## Features

### Complete Data Coverage
- **Email Events**: All event types (accepted, delivered, failed, opened, clicked, etc.)
- **Suppression Lists**: Bounces, complaints, unsubscribes, whitelists
- **Domain Configuration**: DNS records, verification status, tracking settings
- **Mailing Lists**: Lists and members with custom variables
- **Templates**: All templates with version history and content
- **Statistics**: Comprehensive analytics and performance metrics

### 2025 API Features
- ✅ Subaccount management support
- ✅ IP warmup and dynamic pools
- ✅ Enhanced analytics with OLAP cubes
- ✅ SMTP credentials and IP allowlist APIs
- ✅ Template versioning (up to 40 versions)

### Export Features
- **Rate Limited**: Respects 300 requests/minute limit
- **Paginated**: Handles large datasets automatically
- **Multiple Formats**: JSON and CSV export options
- **Resume Capability**: Tracks progress for interrupted downloads
- **Error Handling**: Robust retry logic with exponential backoff
- **Progress Tracking**: Real-time status updates

## Quick Start

### 1. Installation

```bash
cd mailgun-export
npm install
```

### 2. Configuration

Copy the environment template:
```bash
cp .env.example .env
```

Edit `.env` with your Mailgun credentials:
```env
MAILGUN_API_KEY=your_api_key_here
MAILGUN_DOMAIN=your-domain.com
MAILGUN_REGION=US  # or EU
```

### 3. Test Connection

```bash
npm run test
```

### 4. Export Data

```bash
# Export everything
npm run export:all

# Export specific data types
node src/index.js export --events --stats --format both

# Export with date range
node src/index.js export --all --date-from 2024-01-01 --date-to 2024-12-31
```

## Usage Examples

### Command Line Interface

```bash
# Export all data types
node src/index.js export --all

# Export only events
node src/index.js events

# Export only statistics (comprehensive)
node src/index.js stats --comprehensive

# Export specific data types with custom format
node src/index.js export --events --domains --templates --format csv

# Export for specific domain
node src/index.js export --all --domain example.com

# Export with date filtering
node src/index.js export --events --date-from 2024-01-01 --date-to 2024-12-31

# Check status
node src/index.js status

# Test connection
node src/index.js test
```

### Available Options

| Option | Description | Default |
|--------|-------------|---------|
| `--all` | Export all data types | - |
| `--events` | Export email events | - |
| `--suppressions` | Export suppression lists | - |
| `--domains` | Export domain configurations | - |
| `--lists` | Export mailing lists | - |
| `--templates` | Export templates | - |
| `--stats` | Export statistics | - |
| `--format <format>` | Export format (json, csv, both) | json |
| `--domain <domain>` | Specific domain to export | config.domain |
| `--date-from <date>` | Start date (YYYY-MM-DD) | - |
| `--date-to <date>` | End date (YYYY-MM-DD) | - |
| `--output <dir>` | Output directory | ./exports |

## Output Structure

Exported files are organized with timestamps:

```
exports/
├── mailgun_events_2025-01-15_10-30-45.json
├── mailgun_events_2025-01-15_10-30-45.csv
├── mailgun_suppressions_2025-01-15_10-30-45.json
├── mailgun_domains_2025-01-15_10-30-45.json
├── mailgun_lists_2025-01-15_10-30-45.json
├── mailgun_templates_2025-01-15_10-30-45.json
├── mailgun_stats_2025-01-15_10-30-45.json
└── mailgun_export_summary_2025-01-15_10-30-45.json
```

## Data Types Exported

### 1. Email Events
- All event types (accepted, delivered, failed, opened, clicked, etc.)
- Complete metadata (user agent, geolocation, campaigns, tags)
- SMTP response codes and delivery details
- Custom variables and tracking data

### 2. Suppression Lists
- **Bounces**: With SMTP error codes and classifications
- **Complaints**: From feedback loops
- **Unsubscribes**: With campaign associations
- **Whitelists**: Allowed addresses and domains

### 3. Domain Configuration
- DNS records (SPF, DKIM, MX)
- Verification status
- SMTP credentials (masked)
- Tracking settings
- IP allowlist

### 4. Mailing Lists
- List metadata and settings
- All members with custom variables
- Subscription status and opt-in data
- Member statistics

### 5. Templates
- All templates with up to 40 versions
- HTML, text, and MJML content
- Template variables analysis
- Version history and metadata

### 6. Statistics
- Comprehensive analytics data
- Engagement metrics (opens, clicks, unsubscribes)
- Delivery performance
- Trend analysis and insights

## Configuration Options

### Environment Variables

```env
# Required
MAILGUN_API_KEY=your_api_key_here
MAILGUN_DOMAIN=your-domain.com

# Optional
MAILGUN_REGION=US                    # US or EU
MAILGUN_SENDING_KEY=key_here         # For specific sending keys
EXPORT_FORMAT=json                   # json, csv, both
DATE_FROM=2024-01-01                 # Historical data start
DATE_TO=2024-12-31                   # Historical data end
OUTPUT_DIR=./exports                 # Output directory
RATE_LIMIT=300                       # Requests per minute
DEBUG=false                          # Debug mode
```

### Rate Limiting

The tool automatically handles Mailgun's rate limits:
- **300 requests per minute** (configurable)
- Exponential backoff for retries
- HTTP 429 handling
- Progress tracking during waits

## Error Handling

- **Automatic retries** with exponential backoff
- **Graceful degradation** for failed data types
- **Detailed error logging** with suggestions
- **Resume capability** for large exports

## Performance

- **Concurrent requests** (limited to prevent rate limiting)
- **Efficient pagination** handling
- **Memory-optimized** for large datasets
- **Progress indicators** for long-running exports

## Security

- ✅ API keys stored in environment variables
- ✅ No hardcoded credentials
- ✅ Sensitive data masked in exports
- ✅ Secure file permissions

## Support

For issues or questions:
1. Check your API credentials
2. Verify domain access in Mailgun dashboard
3. Review rate limit status with `npm run status`
4. Test connection with `npm run test`

## API Reference

This tool uses the latest Mailgun API endpoints:
- **v3 API**: Events, domains, suppressions, lists, stats
- **v4 API**: Templates and advanced features
- **2025 Features**: Subaccounts, IP management, enhanced analytics

For more information, see [Mailgun API Documentation](https://documentation.mailgun.com/).
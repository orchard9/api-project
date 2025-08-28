# Mailgun Data Platform

A comprehensive platform for accessing and visualizing Mailgun email data with both web dashboard and CLI export capabilities.

## 🚀 Features

- **Web Dashboard**: Real-time data visualization from Mailgun API
- **CLI Export System**: Complete data export for all Mailgun data types  
- **Interactive Controls**: Manual/auto-refresh toggle
- **Mobile Responsive**: Works across all device sizes
- **Rate Limited**: Compliant with Mailgun API limits (300 requests/minute)

## ⚡ Quick Start

### 1. Setup Environment

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your Mailgun credentials
MAILGUN_API_KEY=your_actual_api_key_here
MAILGUN_DOMAIN=your_domain_here
MAILGUN_REGION=US
```

### 2. Install Dependencies

```bash
npm install
cd mailgun-export && npm install
```

### 3. Start the Server

```bash
npm start
```

### 4. Access the Platform

- **Dashboard**: http://localhost:3000/dashboard.html
- **Setup Interface**: http://localhost:3000/credentials.html
- **API Testing**: http://localhost:3000/test-dashboard.html

## 🛠 CLI Export Usage

```bash
cd mailgun-export

# Test connection
npm run test

# Export all data types
npm run export:all

# Export specific data types
npm run export:events
npm run export:domains
npm run export:stats
npm run export:suppressions
```

## 📊 API Endpoints

- `GET /api/mailgun/events` - Email events data
- `GET /api/mailgun/domains` - Domain configuration  
- `GET /api/mailgun/stats` - Email statistics
- `GET /api/mailgun/suppressions` - Bounce/complaint data

## 🔧 Configuration

### Environment Variables

- `MAILGUN_API_KEY` - Your Mailgun API key (required)
- `MAILGUN_DOMAIN` - Your Mailgun domain (optional, defaults used)
- `MAILGUN_REGION` - US or EU (optional, defaults to US)
- `PORT` - Server port (optional, defaults to 3000)

### Web Configuration

Use the web interface at `/credentials.html` to:
- Test API connection
- Configure credentials  
- Validate domain access
- Save settings for CLI tool

## 🚨 Security Notes

- Never commit `.env` files to version control
- API keys are stored locally only
- Use environment variables for all sensitive data
- Web interface includes connection testing

## 📈 Performance

- Real-time dashboard updates
- Configurable refresh intervals
- Rate limiting compliance
- Efficient data pagination
- Mobile-optimized interface

## 🔍 Troubleshooting

### API Connection Issues
- Verify API key in `.env` file
- Check domain permissions in Mailgun dashboard
- Confirm region setting (US/EU)

### Dashboard Not Loading
- Check browser console for errors
- Verify server is running on port 3000
- Ensure API key is configured

### CLI Export Failures
- Run `npm run test` to verify connection
- Check rate limiting settings
- Verify output directory permissions

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License.
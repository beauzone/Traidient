# Deployment Guide

## Port Configuration

The application is configured to run on port 5000 in both development and production environments. In the Replit deployment environment, port 5000 is mapped to external port 80, making the application accessible via standard HTTP.

## Environment Variables

The following environment variables need to be set in the deployment environment:

- `NODE_ENV=production` - Ensures the application runs in production mode
- `PORT=5000` - Specifies the port to use (hardcoded in server/index.ts for reliability)
- `REPLIT_DISABLE_PACKAGE_LAYER=1` - Helps with dependency installation

## API Keys

The application depends on several API keys that must be configured as secrets in the deployment environment:

- `ALPACA_API_KEY` - For Alpaca stock trading API
- `ALPACA_API_SECRET` - For Alpaca stock trading API
- `ALPHAVANTAGE_API_KEY` - For Alpha Vantage market data
- `POLYGON_API_KEY` - For Polygon.io market data
- `OPENAI_API_KEY` - For AI strategy generation
- `JWT_SECRET` - For authentication
- `SNAPTRADE_CLIENT_ID` - For SnapTrade brokerage integration
- `SNAPTRADE_CONSUMER_KEY` - For SnapTrade brokerage integration
- `TWILIO_ACCOUNT_SID` - For alert notifications
- `TWILIO_AUTH_TOKEN` - For alert notifications
- `TWILIO_PHONE_NUMBER` - For alert notifications

## Deployment Steps

1. Make sure all code changes are committed
2. Configure all required environment variables in the deployment settings
3. Deploy using the Replit deployment interface
4. Verify the application is running on the assigned domain
5. Check logs for any initialization issues

## Troubleshooting

- If Python services fail to initialize, they won't block the application startup due to timeout protections
- Static files are served from the dist/public directory in production
- Deployment uses the start.sh script which sets the appropriate environment variables
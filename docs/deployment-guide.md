# Deployment Guide

## Port Configuration

The application is configured to run on port 5000 in both development and production environments. In the Replit deployment environment, port 5000 is mapped to external port 80, making the application accessible via standard HTTP.

## Environment Variables

The following environment variables need to be set in the deployment environment:

- `NODE_ENV=production` - Ensures the application runs in production mode
- `PORT=5000` - Specifies the port to use (configured in server/index.ts)
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
3. In the Replit deployment settings:
   - Set the deployment target to "gce" (Google Cloud Engine)
   - Set the run command to: `bash ./start.sh`
   - Set the build command to: `bash ./build.sh`
   - Ensure port 5000 is mapped to external port 80:
     ```
     [[ports]]
     localPort = 5000
     externalPort = 80
     ```
4. Deploy using the Replit deployment interface
5. Verify the application is running on the assigned domain
6. Check logs for any initialization issues

## Scripts

The application uses the following scripts for deployment:

### build.sh
This script runs during the deployment build process and:
- Sets production environment variables
- Cleans previous build files
- Builds client and server code

### start.sh
This script runs when the deployment starts and:
- Sets production environment variables
- Verifies the build completed successfully
- Starts the server with the correct configuration

## Troubleshooting

- If Python services fail to initialize, they won't block the application startup due to timeout protections
- Static files are served from the dist/public directory in production
- The application uses a custom static file server implementation as fallback if the built-in one fails
- If deployment fails due to port issues, check that the PORT environment variable is set to 5000 and that port 5000 is correctly mapped to external port 80 in the deployment settings
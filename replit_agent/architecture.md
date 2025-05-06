# Architecture Overview

## 1. Overview

This repository houses an algorithmic trading application that allows users to backtest trading strategies, analyze market data, and potentially execute trades through various brokerage integrations. The application is built using a modern full-stack JavaScript/TypeScript architecture with a clear separation between client and server components.

The system leverages multiple financial data providers, supports technical indicator calculations, and provides visualization tools for trading strategy analysis. It follows a RESTful API design with WebSocket support for real-time data.

## 2. System Architecture

The application follows a client-server architecture with the following high-level components:

```
├── client/                  # Frontend React application
├── server/                  # Backend Node.js application 
├── shared/                  # Shared code between client and server
└── migrations/              # Database migrations
```

### 2.1 Frontend Architecture

The frontend is built with React and TypeScript, using modern React patterns including hooks and context. UI components are built with Tailwind CSS and shadcn/ui, providing a responsive and accessible interface.

Key frontend architectural decisions:
- **Component Architecture**: Uses a hierarchical component structure with pages, components, hooks, and context providers
- **State Management**: Leverages React Context for global state (Auth, Account) and TanStack Query for server state
- **Routing**: Uses wouter for client-side routing
- **Data Visualization**: Implements charts with Recharts and Embla Carousel

### 2.2 Backend Architecture

The backend is built with Node.js and Express, using TypeScript. It provides RESTful API endpoints and WebSocket connections for real-time data. The server handles market data retrieval, backtesting calculations, and database operations.

Key backend architectural decisions:
- **API Structure**: RESTful API endpoints with appropriate HTTP methods
- **WebSockets**: Used for streaming real-time market data
- **Data Processing**: Custom implementation for backtesting algorithms
- **External API Integration**: Multiple market data providers including Alpaca, Polygon.io, Alpha Vantage, Tiingo, and Yahoo Finance

### 2.3 Database Architecture

The application uses PostgreSQL with Drizzle ORM for data persistence. Database schema is defined in the shared directory and migrations are managed with drizzle-kit.

Key database architectural decisions:
- **ORM**: Uses Drizzle for type-safe database access
- **Schema Location**: Shared between client and server for consistency
- **Connection**: Uses @neondatabase/serverless for PostgreSQL connectivity

## 3. Key Components

### 3.1 Client Components

- **Pages**: Main application views (backtest, live-trading, etc.)
- **Components**: Reusable UI elements (charts, tables, forms)
- **Hooks**: Custom React hooks for shared functionality
- **Context**: Global state providers (Auth, Account)
- **Lib**: Utility functions and API client

### 3.2 Server Components

- **API Routes**: RESTful endpoints for client-server communication
- **Market Data Services**: Integration with various financial data providers
- **Backtesting Engine**: Implementation of strategy backtesting functionality
- **WebSocket Handlers**: Real-time data streaming
- **Storage Service**: Database operations and persistence
- **OpenAI Integration**: AI-based strategy generation

### 3.3 Data Model

The data model is defined in `shared/schema.ts` and includes:
- User accounts and authentication
- Trading strategies and configurations
- Backtest results and performance metrics
- Market data caching
- Screener configurations

## 4. Data Flow

### 4.1 Market Data Flow

1. Client requests market data for specific symbols
2. Server retrieves data from appropriate provider (Alpaca, Yahoo Finance, etc.)
3. Data is processed, cached if needed, and returned to client
4. For real-time data, WebSocket connections stream updates

### 4.2 Backtesting Flow

1. User configures a trading strategy
2. Client sends strategy parameters to server
3. Server retrieves historical market data
4. Backtesting engine simulates strategy execution
5. Results are calculated, stored, and returned to client
6. Client visualizes results with charts and metrics

### 4.3 Authentication Flow

1. User registers or logs in
2. Server validates credentials
3. JWT token is generated and returned
4. Client stores token and includes it in subsequent requests
5. Server validates token for protected endpoints

## 5. External Dependencies

### 5.1 Market Data Providers

- **Alpaca**: Trading API and market data
- **Polygon.io**: Real-time and historical market data
- **Alpha Vantage**: Financial data and technical indicators
- **Tiingo**: Financial market data
- **Yahoo Finance**: Market data and financial information

### 5.2 Brokerage Integration

- **SnapTrade**: Integration for connecting to brokerage accounts (evidenced by test-snaptrade.js)

### 5.3 AI Integration

- **OpenAI**: Strategy generation and analysis

### 5.4 Development Dependencies

- **UI Framework**: shadcn/ui components built on Radix UI
- **Styling**: Tailwind CSS
- **State Management**: TanStack Query
- **Code Editor**: CodeMirror for strategy code editing
- **Database ORM**: Drizzle

## 6. Deployment Strategy

The application is set up for deployment in multiple environments:

### 6.1 Development Environment

- Vite for frontend development
- Node.js with ts-node for backend development
- Local PostgreSQL database

### 6.2 Production Environment

- Vite build process for frontend
- Node.js production server
- Production PostgreSQL database

### 6.3 Deployment Configuration

- Environment variables for API keys and database connections
- Build scripts for production deployment
- Support for Replit deployment with custom Replit configuration

The repo contains configurations for deployment on Replit:
- `.replit` file configures the Replit environment
- `replit.nix` specifies system dependencies
- Port configurations for various services

## 7. Technical Considerations

### 7.1 Performance Optimization

- Server-side caching of market data
- Client-side query caching with TanStack Query
- Optimized chart rendering for large datasets

### 7.2 Security Considerations

- JWT-based authentication
- Environment variables for sensitive credentials
- Secure API key management

### 7.3 Extensibility

- Modular architecture allows for adding new data providers
- Strategy template system supports custom algorithms
- Python integration for advanced statistical analysis

### 7.4 Python Integration

The application includes Python support for more advanced financial calculations:
- Statistical analysis with scipy, numpy, pandas
- Machine learning capabilities with scikit-learn
- Technical indicators via pandas-ta
- Custom stock screeners written in Python
# Stock Screener Architecture Review

## System Overview

Our application is a full-stack trading platform that includes stock screening functionality among other features. The stock screeners are designed to identify investment opportunities based on customizable criteria.

The system follows a client-server architecture:

```
├── client/               # Frontend React application
├── server/               # Backend Node.js Express application 
├── docs/examples/        # Example screener implementations
└── shared/               # Shared code between client and server
```

## Screener Architecture

### Core Components

1. **Python Execution Service**
   - Located in `server/pythonExecutionService.ts`
   - Responsible for running Python-based screeners in an isolated environment
   - Uses child_process to execute Python code
   - Extracts results using special markers

2. **Screener API Endpoints**
   - Located in `server/routes.ts`
   - Handles CRUD operations for screeners
   - Runs screeners and returns results to the frontend

3. **Screener Storage**
   - Screeners are stored in PostgreSQL database
   - Managed through Drizzle ORM

4. **Market Data Integration**
   - Multiple market data providers (Alpaca, Yahoo Finance)
   - Fallback system for data reliability

### Data Flow

1. User creates a screener with Python code
2. Code is stored in the database
3. When user runs the screener:
   - Server retrieves code from database
   - Python execution service runs the code in a child process
   - Results are extracted using special markers
   - Results are returned to the client

## Key Implementation Details

### Python Execution Service

The Python execution service runs the screener code in a child process and extracts the results. Special markers (`RESULT_JSON_START` and `RESULT_JSON_END`) are used to identify the results in the output.

```typescript
// Simplified version of server/pythonExecutionService.ts

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export class PythonExecutionService {
  async executeScreener(code: string, parameters: any = {}): Promise<any> {
    // Create temporary file for the code
    const tempFilePath = path.join(os.tmpdir(), `screener-${Date.now()}.py`);
    fs.writeFileSync(tempFilePath, code);
    
    // Spawn Python process
    const pythonProcess = spawn('python3', [tempFilePath, JSON.stringify(parameters)]);
    
    let output = '';
    let error = '';
    
    // Collect output
    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      error += data.toString();
    });
    
    return new Promise((resolve, reject) => {
      pythonProcess.on('close', (code) => {
        // Clean up temp file
        fs.unlinkSync(tempFilePath);
        
        if (code !== 0) {
          return reject(new Error(`Python process exited with code ${code}: ${error}`));
        }
        
        try {
          // Extract result between markers
          const resultMatch = output.match(/RESULT_JSON_START\s*([\s\S]*?)\s*RESULT_JSON_END/);
          if (!resultMatch) {
            return reject(new Error('Could not find result markers in output'));
          }
          
          const resultJson = resultMatch[1].trim();
          const result = JSON.parse(resultJson);
          
          resolve(result);
        } catch (err) {
          reject(new Error(`Failed to parse result: ${err.message}`));
        }
      });
    });
  }
}
```

### Screener API Routes

The API routes handle the CRUD operations for screeners and the execution of screeners.

```typescript
// Simplified version of server/routes.ts (screener-related endpoints)

app.post('/api/screeners', isAuthenticated, async (req, res) => {
  try {
    const { name, description, source } = req.body;
    
    const screener = await storage.createScreener({
      userId: req.user.id,
      name,
      description,
      type: 'python',
      source
    });
    
    res.status(201).json(screener);
  } catch (error) {
    console.error('Error creating screener:', error);
    res.status(500).json({ message: 'Failed to create screener' });
  }
});

app.get('/api/screeners', isAuthenticated, async (req, res) => {
  try {
    const screeners = await storage.getScreeners(req.user.id);
    res.json(screeners);
  } catch (error) {
    console.error('Error fetching screeners:', error);
    res.status(500).json({ message: 'Failed to fetch screeners' });
  }
});

app.post('/api/screeners/:id/run', isAuthenticated, async (req, res) => {
  try {
    const screenerId = parseInt(req.params.id);
    const screener = await storage.getScreener(screenerId, req.user.id);
    
    if (!screener) {
      return res.status(404).json({ message: 'Screener not found' });
    }
    
    const pythonService = new PythonExecutionService();
    const result = await pythonService.executeScreener(screener.source.content, req.body);
    
    res.json(result);
  } catch (error) {
    console.error('Error running screener:', error);
    res.status(500).json({ message: 'Failed to run screener' });
  }
});
```

### Example Screener Implementation

This is a basic screener that uses Yahoo Finance to find stocks above a certain price:

```python
# docs/examples/basic_price_screener.py

import json
import yfinance as yf
import traceback

def screen_stocks(data_dict):
    """
    Very simple screener that just finds stocks above a certain price
    using Yahoo Finance data with minimal processing
    """
    print("=" * 50)
    print("BASIC PRICE SCREENER")
    print("Finding stocks above threshold price")
    print("=" * 50)
    
    # Initialize results
    matches = []
    details = {}
    errors = []
    
    # List of popular tech and blue chip stocks
    symbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "META", "TSLA", "NVDA", "AMD", 
               "NFLX", "DIS", "JPM", "V", "PG", "JNJ", "KO", "MCD", "WMT", "HD"]
    
    # Price threshold
    price_threshold = 100
    
    print(f"Scanning {len(symbols)} stocks for price above ${price_threshold}")
    
    # Process each symbol
    for symbol in symbols:
        try:
            print(f"Checking {symbol}...")
            
            # Get current data from Yahoo Finance
            stock = yf.Ticker(symbol)
            
            # Get the latest price
            latest_price = stock.history(period="1d")['Close'].iloc[-1]
            company_name = stock.info.get('shortName', 'Unknown')
            
            print(f"  {symbol} ({company_name}): ${latest_price:.2f}")
            
            # Check if price is above threshold
            if latest_price > price_threshold:
                matches.append(symbol)
                details[symbol] = {
                    "symbol": symbol,
                    "company": company_name,
                    "price": float(latest_price),
                    "reason": f"Price ${latest_price:.2f} is above threshold of ${price_threshold}"
                }
                
                print(f"✓ MATCH: {symbol} - Price ${latest_price:.2f} > ${price_threshold}")
            else:
                print(f"× NO MATCH: {symbol} - Price ${latest_price:.2f} ≤ ${price_threshold}")
                
        except Exception as e:
            print(f"Error processing {symbol}: {str(e)}")
            traceback.print_exc()
            errors.append(f"Error processing {symbol}: {str(e)}")
    
    # Print summary
    if matches:
        print(f"\nFound {len(matches)} stocks with price above ${price_threshold}:")
        for symbol in matches:
            company = details[symbol]["company"]
            price = details[symbol]["price"]
            print(f"- {symbol} ({company}): ${price:.2f}")
    else:
        print(f"\nNo stocks found with price above ${price_threshold}")
    
    if errors:
        print(f"\n{len(errors)} errors encountered during screening")
    
    # Prepare result
    result = {
        'matches': matches,
        'details': details,
        'errors': errors if errors else None
    }
    
    # Print with special markers for proper extraction
    print("RESULT_JSON_START")
    print(json.dumps(result))
    print("RESULT_JSON_END")
    
    return result
```

## Current Issues

We're experiencing several issues with the screener functionality:

1. **Alpaca API Issues**: 
   - Alpaca API endpoints return 403 Forbidden errors with the message: "subscription does not permit querying recent SIP data"
   - This suggests our Alpaca API keys don't have sufficient permissions for the data we're trying to access

2. **Yahoo Finance Screeners**:
   - We've tried multiple Yahoo Finance-based screeners that should work
   - In logs, we can see Yahoo Finance successfully fetching data for SPY
   - However, when running screeners, no matches are returned despite simplifying criteria
   - We've created multiple versions with increasingly simpler logic:
     - A potential breakout screener
     - A simple price threshold screener
     - An ultra-basic price screener
   - None of them return any matches

3. **Specific Observations**:
   - Logging shows the Python code executes successfully
   - The server restarts when our workflow is restarted

## Example Log Output

```
[express] Initializing Python environment for screeners...
Initializing Python environment for screeners...
Python 3.11.10 detected
Installing missing Python libraries: pandas-ta
[pip install] Requirement already satisfied: pandas-ta in ./.pythonlibs/lib/python3.11/site-packages (0.3.14b0)
[pip install] Requirement already satisfied: pandas in ./.pythonlibs/lib/python3.11/site-packages (from pandas-ta) (2.2.3)
Python environment initialized successfully
[express] Python environment initialized successfully

Got Yahoo Finance data for SPY: 565.06
Market status (fixed): CLOSED
```

The logs show:
1. Python environment initializes correctly
2. Required libraries are installed
3. Yahoo Finance can fetch data for SPY
4. But our screeners still don't return any matches

## Possible Issues to Investigate

1. **Result Extraction**: 
   - Are the special markers (`RESULT_JSON_START` and `RESULT_JSON_END`) being properly detected?
   - Is the JSON parsing failing due to format issues?

2. **Environment Variables**: 
   - Are the required API keys available in the Python environment?

3. **Child Process Issues**: 
   - Is there any issue with how we're spawning and capturing the output from the Python process?

4. **Data Format Compatibility**: 
   - Are there version incompatibilities between the Yahoo Finance package and our code?

5. **Error Handling**: 
   - Are errors being caught and not propagated correctly?

## Files for Review

Please examine the following files to diagnose the issue:

1. `server/pythonExecutionService.ts` - The core service that runs Python code
2. `server/routes.ts` - The API endpoints for screeners
3. `docs/examples/basic_price_screener.py` - A simple test screener that should work
4. Any logs related to Python execution

## Actual Code from the Server

Here's the actual implementation of our `pythonExecutionService.ts`:

```typescript
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { logger } from './logger';

interface ExecutionResult {
  output: string;
  error: string;
  exitCode: number | null;
}

export class PythonExecutionService {
  private static readonly PYTHON_COMMAND = 'python3';

  constructor() {}

  /**
   * Initialize Python environment and install required packages
   */
  async initPythonEnvironment(): Promise<void> {
    logger.info('Initializing Python environment for screeners...');
    console.log('Initializing Python environment for screeners...');
    
    try {
      // Check Python version
      const versionResult = await this.runCommand(PythonExecutionService.PYTHON_COMMAND, ['--version']);
      console.log(versionResult.output);
      
      // Install required packages
      const requiredPackages = ['pandas-ta'];
      console.log(`Installing missing Python libraries: ${requiredPackages.join(', ')}`);
      
      const pipResult = await this.runCommand(PythonExecutionService.PYTHON_COMMAND, [
        '-m', 'pip', 'install', ...requiredPackages
      ]);
      console.log('[pip install]', pipResult.output);
      
      if (pipResult.exitCode !== 0) {
        console.error('[pip install error]', pipResult.error);
        throw new Error(`Failed to install required Python packages: ${pipResult.error}`);
      }
      
      console.log('Python environment initialized successfully');
      logger.info('Python environment initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Python environment', error);
      console.error('Failed to initialize Python environment:', error);
      throw error;
    }
  }

  /**
   * Run a Python screener with the provided code and parameters
   */
  async executeScreener(code: string, parameters: any = {}): Promise<any> {
    logger.info('Executing Python screener');
    
    // Create a temporary file
    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, `screener-${Date.now()}.py`);
    
    try {
      // Write code to a temporary file
      fs.writeFileSync(tempFilePath, code);
      
      // Execute the screener
      const result = await this.runPythonScript(tempFilePath, parameters);
      
      // Extract results from output using markers
      const extractedResult = this.extractResultFromOutput(result.output);
      
      if (extractedResult) {
        return extractedResult;
      } else {
        logger.error('Failed to extract result from screener output', { output: result.output, error: result.error });
        throw new Error('Failed to extract result from screener output');
      }
    } catch (error) {
      logger.error('Error executing screener', error);
      throw error;
    } finally {
      // Clean up temporary file
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    }
  }

  /**
   * Execute a Python script with the provided parameters
   */
  private async runPythonScript(filePath: string, parameters: any): Promise<ExecutionResult> {
    // Create a temporary parameters file
    const paramsFilePath = `${filePath}.params.json`;
    fs.writeFileSync(paramsFilePath, JSON.stringify(parameters));
    
    try {
      // Run the Python script with the parameters file
      const result = await this.runCommand(PythonExecutionService.PYTHON_COMMAND, [filePath, paramsFilePath]);
      
      return result;
    } catch (error) {
      logger.error('Error running Python script', error);
      throw error;
    } finally {
      // Clean up parameters file
      if (fs.existsSync(paramsFilePath)) {
        fs.unlinkSync(paramsFilePath);
      }
    }
  }

  /**
   * Run a command and return the result
   */
  private runCommand(command: string, args: string[]): Promise<ExecutionResult> {
    return new Promise((resolve) => {
      const process = spawn(command, args, {
        env: {
          ...process.env,
          PYTHONIOENCODING: 'utf-8', // Ensure UTF-8 encoding for output
          PYTHONUNBUFFERED: '1',      // Disable buffering for immediate output
        }
      });
      
      let output = '';
      let error = '';
      
      process.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      process.stderr.on('data', (data) => {
        error += data.toString();
      });
      
      process.on('close', (exitCode) => {
        resolve({ output, error, exitCode });
      });
    });
  }

  /**
   * Extract the JSON result from the script output using markers
   */
  private extractResultFromOutput(output: string): any {
    const resultMarker = /RESULT_JSON_START\s*([\s\S]*?)\s*RESULT_JSON_END/;
    const match = output.match(resultMarker);
    
    if (match && match[1]) {
      try {
        return JSON.parse(match[1]);
      } catch (error) {
        logger.error('Failed to parse JSON result', { result: match[1], error });
        throw new Error(`Failed to parse JSON result: ${error.message}`);
      }
    }
    
    return null;
  }
}
```

And here's a snippet of the relevant routes from `server/routes.ts`:

```typescript
// Screener routes
app.post('/api/screeners', isAuthenticated, async (req, res) => {
  try {
    const { name, description, type, source } = req.body;
    
    const newScreener = await storage.createScreener({
      userId: req.user.id,
      name,
      description,
      type,
      source,
    });
    
    res.status(201).json(newScreener);
  } catch (error) {
    logger.error('Failed to create screener', error);
    res.status(500).json({ message: 'Failed to create screener' });
  }
});

app.get('/api/screeners', isAuthenticated, async (req, res) => {
  try {
    const screeners = await storage.getScreenersByUser(req.user.id);
    res.json(screeners);
  } catch (error) {
    logger.error('Failed to fetch screeners', error);
    res.status(500).json({ message: 'Failed to fetch screeners' });
  }
});

app.get('/api/screeners/:id', isAuthenticated, async (req, res) => {
  try {
    const screenerId = parseInt(req.params.id);
    const screener = await storage.getScreener(screenerId);
    
    if (!screener || screener.userId !== req.user.id) {
      return res.status(404).json({ message: 'Screener not found' });
    }
    
    res.json(screener);
  } catch (error) {
    logger.error('Failed to fetch screener', error);
    res.status(500).json({ message: 'Failed to fetch screener' });
  }
});

app.post('/api/screeners/:id/run', isAuthenticated, async (req, res) => {
  try {
    const screenerId = parseInt(req.params.id);
    const screener = await storage.getScreener(screenerId);
    
    if (!screener || screener.userId !== req.user.id) {
      return res.status(404).json({ message: 'Screener not found' });
    }
    
    const pythonService = new PythonExecutionService();
    
    let result;
    if (screener.type === 'python' && screener.source.type === 'code') {
      result = await pythonService.executeScreener(screener.source.content, req.body);
    } else {
      return res.status(400).json({ message: 'Unsupported screener type' });
    }
    
    res.json(result);
  } catch (error) {
    logger.error('Failed to run screener', error);
    res.status(500).json({ message: 'Failed to run screener', error: error.message });
  }
});
```

## Environment Check

When running `python3` from the command line to check available packages and versions:

```
import yfinance as yf
print("YFinance version:", yf.__version__)
stock = yf.Ticker("AAPL")
info = stock.info
print("Can fetch AAPL info:", "shortName" in info)
hist = stock.history(period="1d")
print("Can fetch AAPL history:", not hist.empty)
```

This code appears to run fine in the environment but when run through our service, no results are returned or errors are shown.

## Server Logs During Screener Execution

Here's an example of server logs when trying to run our basic price screener:

```
[express] GET /api/screeners/53/run 200 in 2341ms :: {"matches":[],"details":{},"errors":null}
```

The response is always empty with no matches and no errors, despite the fact that several stocks in our test list should be above the price threshold.

## Debugging Insights

1. We've verified Yahoo Finance is working in the environment by confirming:
   - The server logs show successful data retrieval for SPY
   - `yfinance` package is installed and can be imported

2. We've tried multiple screener implementations with increasing simplicity:
   - A complex breakout screener with technical indicators
   - A simple price threshold screener
   - An ultra-basic price check screener

3. We've confirmed that when running a simple Python script directly, it successfully retrieves data:
   ```
   python3 -c "import yfinance as yf; print(yf.Ticker('AAPL').history(period='1d')['Close'].iloc[-1])"
   ```
   Returns the correct AAPL price.

4. When a screener runs through our service, we see that:
   - The Python code appears to execute (no errors are returned)
   - The proper JSON markers are included in our code
   - But the results show empty matches and no errors
   
5. Oddly, when we do the exact same operations in our screeners that work when run manually, they return no results when run through the service.

## Potential Hypotheses

1. **Environment Variables**: Perhaps API keys or other environment variables aren't being properly passed to the child process.

2. **Path/Directory Issues**: The Python process might be running in a different working directory than expected.

3. **Parameter Passing**: There might be issues with how parameters are passed to the Python script.

4. **Regex Issue**: The regex pattern for extracting results might not be matching as expected.

5. **Encoding/Output Issues**: There could be issues with how the stdout/stderr is captured or encoded.

The most perplexing aspect is that the Python code executes without errors, but still returns no results, and we don't see any errors in the logs that would indicate what's going wrong.
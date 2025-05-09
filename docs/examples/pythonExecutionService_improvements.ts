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
    // Existing implementation...
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
      
      // Log the entire output for debugging
      logger.debug(`Screener output:\n${result.output}`);
      if (result.error) {
        logger.debug(`Screener stderr:\n${result.error}`);
      }
      
      // Extract results from output using markers
      const extractedResult = this.extractResultFromOutput(result.output);
      
      if (extractedResult) {
        return extractedResult;
      } else {
        // NEW: Check if there are any results we can use
        logger.error('Failed to extract result from screener output. No result markers found.');
        
        // If no markers found but the script executed successfully, check if we have a well-formed JSON somewhere in the output
        if (result.exitCode === 0) {
          logger.info('Attempting to find JSON in output without markers');
          // Look for any valid JSON objects in the output
          const jsonMatch = this.findJsonInOutput(result.output);
          
          if (jsonMatch) {
            logger.info('Found potential JSON result in output without markers');
            return jsonMatch;
          }
        }
        
        throw new Error('Failed to extract result from screener output. Make sure your screener includes RESULT_JSON_START and RESULT_JSON_END markers with JSON between them.');
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
      // NEW: Option to inject universal wrapper
      // Uncomment to use the universal wrapper approach instead of direct execution
      /*
      const wrapperPath = path.join(__dirname, '..', 'universal_screener_wrapper.py');
      if (fs.existsSync(wrapperPath)) {
        logger.info('Using universal screener wrapper');
        const result = await this.runCommand(PythonExecutionService.PYTHON_COMMAND, [
          wrapperPath, filePath, paramsFilePath
        ]);
        return result;
      }
      */
      
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
        const chunk = data.toString();
        output += chunk;
        // For debugging, you can uncomment this to see real-time output
        // logger.debug(`Python stdout: ${chunk}`);
      });
      
      process.stderr.on('data', (data) => {
        const chunk = data.toString();
        error += chunk;
        // For debugging, you can uncomment this to see real-time errors
        // logger.debug(`Python stderr: ${chunk}`);
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
    // More permissive regex that can handle newlines and spacing
    const resultMarker = /RESULT_JSON_START\s*([\s\S]*?)\s*RESULT_JSON_END/;
    const match = output.match(resultMarker);
    
    if (match && match[1]) {
      try {
        // Trim the result to remove any extra whitespace
        const jsonStr = match[1].trim();
        return JSON.parse(jsonStr);
      } catch (error) {
        logger.error('Failed to parse JSON result', { result: match[1], error });
        throw new Error(`Failed to parse JSON result: ${error.message}`);
      }
    }
    
    return null;
  }

  /**
   * NEW: Try to find any valid JSON object in the output as a fallback
   */
  private findJsonInOutput(output: string): any {
    // Look for objects that look like JSON
    const jsonPattern = /\{[\s\S]*?\}/g;
    const matches = output.match(jsonPattern);
    
    if (matches) {
      // Try each match to see if it parses as valid JSON
      for (const match of matches) {
        try {
          const result = JSON.parse(match);
          // Check if it has the expected structure
          if (result && typeof result === 'object' && 
              (Array.isArray(result.matches) || 'matches' in result)) {
            return result;
          }
        } catch (e) {
          // Not valid JSON, skip
          continue;
        }
      }
    }
    
    return null;
  }
}
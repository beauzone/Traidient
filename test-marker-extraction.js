// Simple test to diagnose marker extraction in the Python execution service
import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name properly in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test script content - simulates our screener with many different ways of printing the markers
const pythonScriptContent = `
import json
import sys

print("--- Starting Test Script ---")
print("This script tests multiple ways of emitting markers and JSON results")

# Test Data
test_data = {
    'matches': ['AAPL', 'MSFT', 'GOOGL'],
    'details': {
        'AAPL': {'price': 190.5, 'reason': 'Test data'},
        'MSFT': {'price': 420.25, 'reason': 'Test data'},
        'GOOGL': {'price': 180.75, 'reason': 'Test data'}
    },
    'errors': None
}

# ---------------------------------------------------------------------------
print("\\nTEST 1: Basic marker with newlines")
print("RESULT_JSON_START")
print(json.dumps(test_data))
print("RESULT_JSON_END")

# ---------------------------------------------------------------------------
print("\\nTEST 2: Markers on same line as JSON")
print("RESULT_JSON_START " + json.dumps(test_data) + " RESULT_JSON_END")

# ---------------------------------------------------------------------------
print("\\nTEST 3: Markers with extra whitespace")
print("RESULT_JSON_START  ")
print(json.dumps(test_data))
print("  RESULT_JSON_END")

# ---------------------------------------------------------------------------
print("\\nTEST 4: Directly to stdout without print")
sys.stdout.write("RESULT_JSON_START\\n")
sys.stdout.write(json.dumps(test_data) + "\\n")
sys.stdout.write("RESULT_JSON_END\\n")
sys.stdout.flush()

# ---------------------------------------------------------------------------
print("\\nTEST 5: Single print statement for everything")
print(f"""RESULT_JSON_START
{json.dumps(test_data)}
RESULT_JSON_END""")

# ---------------------------------------------------------------------------
print("\\nTEST 6: Print without newlines")
print("RESULT_JSON_START", end="")
print(json.dumps(test_data), end="")
print("RESULT_JSON_END")

print("\\n--- Test Script Complete ---")
`;

async function runTest() {
    try {
        // Create a temp directory if it doesn't exist
        const tempDir = path.join(__dirname, 'tmp');
        await fs.mkdir(tempDir, { recursive: true });
        
        // Write test script to file
        const testScriptPath = path.join(tempDir, 'marker-test.py');
        await fs.writeFile(testScriptPath, pythonScriptContent);
        
        console.log("Running test script...");
        
        // Run the script with Node's child_process
        const pythonProcess = spawn('python3', [testScriptPath]);
        
        let outputData = '';
        let errorData = '';
        
        pythonProcess.stdout.on('data', (data) => {
            const chunk = data.toString();
            console.log(`[STDOUT chunk received, ${chunk.length} chars]`);
            outputData += chunk;
        });
        
        pythonProcess.stderr.on('data', (data) => {
            const chunk = data.toString();
            console.error(`[STDERR] ${chunk}`);
            errorData += chunk;
        });
        
        pythonProcess.on('close', async (code) => {
            console.log(`\nPython process exited with code ${code}`);
            
            // Write full output to a log file for inspection
            await fs.writeFile(path.join(tempDir, 'full-output.log'), outputData);
            
            console.log(`\nFull output written to ${path.join(tempDir, 'full-output.log')}`);
            console.log(`\nOutput length: ${outputData.length} characters`);
            
            // Now test different regexp patterns
            testMarkerExtraction(outputData);
            
            // Clean up
            await fs.unlink(testScriptPath).catch(err => console.error("Failed to delete test script:", err));
        });
    } catch (error) {
        console.error("Error running test:", error);
    }
}

function testMarkerExtraction(output) {
    console.log("\n--- TESTING DIFFERENT EXTRACTION METHODS ---");
    
    // Method 1: Current implementation - basic indexOf
    console.log("\nMETHOD 1: Current implementation (indexOf)");
    const resultStartMarker = "RESULT_JSON_START";
    const resultEndMarker = "RESULT_JSON_END";
    
    const startIndex = output.indexOf(resultStartMarker);
    const endIndex = output.indexOf(resultEndMarker);
    
    console.log(`Marker indices: start=${startIndex}, end=${endIndex}`);
    
    if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
        console.log("Found result markers in output");
        
        // Extract the JSON between the markers
        const markerLength = resultStartMarker.length;
        const jsonContent = output.substring(
            startIndex + markerLength, 
            endIndex
        ).trim();
        
        console.log(`Extracted content length: ${jsonContent.length} chars`);
        console.log(`Extracted content preview: ${jsonContent.substring(0, 100)}...`);
        
        try {
            const result = JSON.parse(jsonContent);
            console.log("✅ Successfully parsed JSON - Method 1 works!");
            console.log(`Result has ${result.matches ? result.matches.length : 0} matches`);
        } catch (e) {
            console.error("❌ Failed to parse JSON:", e);
            console.error("Content tried to parse:", jsonContent.substring(0, 200));
        }
    } else {
        console.log("❌ No result markers found using Method 1");
    }
    
    // Method 2: Using regex with [\s\S]*? (non-greedy match of any character including newlines)
    console.log("\nMETHOD 2: Regex with non-greedy matcher");
    const regexPattern = /RESULT_JSON_START\s*([\s\S]*?)\s*RESULT_JSON_END/;
    const match = output.match(regexPattern);
    
    if (match && match[1]) {
        console.log("Found result markers using regex");
        const jsonContent = match[1].trim();
        console.log(`Extracted content length: ${jsonContent.length} chars`);
        console.log(`Extracted content preview: ${jsonContent.substring(0, 100)}...`);
        
        try {
            const result = JSON.parse(jsonContent);
            console.log("✅ Successfully parsed JSON - Method 2 works!");
            console.log(`Result has ${result.matches ? result.matches.length : 0} matches`);
        } catch (e) {
            console.error("❌ Failed to parse JSON:", e);
            console.error("Content tried to parse:", jsonContent.substring(0, 200));
        }
    } else {
        console.log("❌ No result markers found using Method 2");
    }
    
    // Method 3: Try all regex matches and see which one works
    console.log("\nMETHOD 3: Try all marker patterns");
    const allMatches = [...output.matchAll(/RESULT_JSON_START\s*([\s\S]*?)\s*RESULT_JSON_END/g)];
    
    console.log(`Found ${allMatches.length} marker pairs in output`);
    
    for (let i = 0; i < allMatches.length; i++) {
        console.log(`\nTrying match #${i+1}:`);
        const jsonContent = allMatches[i][1].trim();
        console.log(`Extracted content length: ${jsonContent.length} chars`);
        console.log(`Extracted content preview: ${jsonContent.substring(0, 100)}...`);
        
        try {
            const result = JSON.parse(jsonContent);
            console.log(`✅ Successfully parsed JSON from match #${i+1}!`);
            console.log(`Result has ${result.matches ? result.matches.length : 0} matches`);
        } catch (e) {
            console.error(`❌ Failed to parse JSON from match #${i+1}:`, e);
        }
    }
}

// Run the test
runTest();
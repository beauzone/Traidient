// Script to fix the Python execution service extraction issue
import * as fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name properly in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fixPythonExecutionService() {
  try {
    console.log("Starting fix for pythonExecutionService.ts...");
    
    // Path to the file
    const serviceFilePath = path.join(__dirname, 'server', 'pythonExecutionService.ts');
    
    // Read the file
    const fileContent = await fs.readFile(serviceFilePath, 'utf8');
    console.log(`Read original file (${fileContent.length} characters)`);
    
    // Make a backup of the original file
    const backupFilePath = serviceFilePath + '.backup';
    await fs.writeFile(backupFilePath, fileContent);
    console.log(`Created backup at ${backupFilePath}`);
    
    // Find the section that extracts JSON between markers (around line 360)
    const markerExtractionPattern = /const startIndex = outputData\.indexOf\(resultStartMarker\);[\s\S]*?endIndex\)/;
    
    // New implementation that uses a more accurate method
    const newImplementation = `const startIndex = outputData.indexOf(resultStartMarker);
          // Need to capture content after the marker + its length
          const contentStartIndex = startIndex + resultStartMarker.length;
          const endIndex = outputData.indexOf(resultEndMarker, contentStartIndex);`;
    
    // Replace the marker extraction section
    let updatedContent = fileContent.replace(markerExtractionPattern, newImplementation);
    
    // Also update the JSON extraction part to be more resilient
    const jsonExtractionPattern = /const jsonContent = outputData\.substring\(\s*startIndex \+ markerLength,\s*endIndex\s*\)\.trim\(\);/;
    const newJsonExtraction = `const jsonContent = outputData.substring(contentStartIndex, endIndex).trim();
            // Debug info for marker extraction
            console.log(\`Content extraction: markers at startIndex=\${startIndex}, endIndex=\${endIndex}\`);
            console.log(\`Content start index (after marker)=\${contentStartIndex}\`);
            console.log(\`JSON content length: \${jsonContent.length}\`);
            console.log(\`First few chars: \${jsonContent.substring(0, 50)}\`);`;
    
    updatedContent = updatedContent.replace(jsonExtractionPattern, newJsonExtraction);
    
    // Also ensure the error logging is more informative
    const errorLoggingPattern = /console\.error\('Error parsing JSON between markers:', e\);/;
    const newErrorLogging = `console.error('Error parsing JSON between markers:', e);
              console.error('Raw extracted content:', jsonContent);
              // Escape character analysis - identify hidden chars
              const escaped = JSON.stringify(jsonContent);
              console.error('Content with escapes visible:', escaped);`;
    
    updatedContent = updatedContent.replace(errorLoggingPattern, newErrorLogging);
    
    // Add a more robust regex extraction as a fallback method
    const fallbackMethodPattern = /\/\/ First, try to identify a clean JSON object that's on its own line/;
    const newFallbackMethod = `// Try a more robust regex extraction as a fallback
          console.log("Trying robust regex extraction fallback for markers");
          const resultMarkerRegex = /RESULT_JSON_START\\s*([\\s\\S]*?)\\s*RESULT_JSON_END/;
          const regexMatch = outputData.match(resultMarkerRegex);
          
          if (regexMatch && regexMatch[1]) {
            try {
              const jsonStr = regexMatch[1].trim();
              console.log(\`Regex fallback found content: \${jsonStr.substring(0, 50)}...\`);
              const result = JSON.parse(jsonStr);
              console.log(\`Successfully parsed JSON using regex fallback with \${result.matches ? result.matches.length : 0} matches\`);
              resolve(result);
              return; // Exit early if regex method works
            } catch (e) {
              console.error('Error parsing JSON from regex fallback:', e);
              // Fall through to other fallback methods
            }
          }
          
          // First, try to identify a clean JSON object that's on its own line`;
    
    updatedContent = updatedContent.replace(fallbackMethodPattern, newFallbackMethod);
    
    // Write the updated file
    await fs.writeFile(serviceFilePath, updatedContent);
    console.log(`Updated ${serviceFilePath} with new implementation`);
    
    console.log("Fix complete! Try running a screener now.");
    console.log("\nIf you need to restore the original file, run:");
    console.log(`cp ${backupFilePath} ${serviceFilePath}`);
    
  } catch (error) {
    console.error("Error applying fix:", error);
  }
}

// Run the fix
fixPythonExecutionService();
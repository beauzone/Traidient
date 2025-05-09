#!/usr/bin/env python3
"""
Standalone diagnostic script to test marker extraction behavior.
Run this directly to see what output is produced and captured.
"""
import json
import sys

def main():
    print("=== Marker Extraction Diagnostic Script ===")
    print(f"Python version: {sys.version}")
    print(f"Running from: {sys.executable}")
    
    # Test data
    test_data = {
        'matches': ['AAPL', 'MSFT', 'GOOGL'],
        'details': {
            'AAPL': {'price': 190.5, 'reason': 'Diagnostic test data'},
            'MSFT': {'price': 415.56, 'reason': 'Diagnostic test data'},
            'GOOGL': {'price': 179.88, 'reason': 'Diagnostic test data'}
        },
        'errors': None
    }
    
    print("\nTest data prepared:")
    print(f"- {len(test_data['matches'])} matches")
    print(f"- {len(test_data['details'])} details")
    
    # Print with markers in different ways
    print("\n===== MARKER TEST VARIATIONS =====")
    
    # Standard method (print statements on separate lines)
    print("\nVARIATION 1: Standard separate print statements")
    print("RESULT_JSON_START")
    print(json.dumps(test_data))
    print("RESULT_JSON_END")
    
    # All on one line, no spaces
    print("\nVARIATION 2: All on one line (no spaces)")
    print("RESULT_JSON_START" + json.dumps(test_data) + "RESULT_JSON_END")
    
    # All on one line, with spaces
    print("\nVARIATION 3: All on one line (with spaces)")
    print("RESULT_JSON_START " + json.dumps(test_data) + " RESULT_JSON_END")
    
    # Print with concatenation and newlines
    print("\nVARIATION 4: Triple-quoted string")
    print(f"""RESULT_JSON_START
{json.dumps(test_data)}
RESULT_JSON_END""")
    
    # Print with sys.stdout.write
    print("\nVARIATION 5: Using sys.stdout.write()")
    sys.stdout.write("RESULT_JSON_START\n")
    sys.stdout.write(json.dumps(test_data) + "\n")
    sys.stdout.write("RESULT_JSON_END\n")
    sys.stdout.flush()
    
    # Print with end="" parameter
    print("\nVARIATION 6: Using print with end=\"\"")
    print("RESULT_JSON_START", end="")
    print(json.dumps(test_data), end="")
    print("RESULT_JSON_END")
    
    # Print with debug statements in between
    print("\nVARIATION 7: With debug statements mixed in")
    print("RESULT_JSON_START")
    print("Debug: Starting JSON dump...")
    print(json.dumps(test_data))
    print("Debug: JSON dump complete")
    print("RESULT_JSON_END")
    
    # Print with newlines in output
    print("\nVARIATION 8: With intentional newlines in JSON")
    formatted_json = json.dumps(test_data, indent=2)
    print("RESULT_JSON_START")
    print(formatted_json)
    print("RESULT_JSON_END")
    
    print("\n===== END OF MARKER TESTS =====")
    print("This script can be run directly to see the output patterns.")
    print("Copy this output and share it with the diagnosis system.")

if __name__ == "__main__":
    main()
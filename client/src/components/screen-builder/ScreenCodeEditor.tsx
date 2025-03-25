import { useEffect, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { EditorView } from "@codemirror/view";
import { python } from "@codemirror/lang-python";
import { okaidia } from "@uiw/codemirror-theme-okaidia";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, HelpCircle } from "lucide-react";
import { postData } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const DEFAULT_PYTHON_SCREEN = `import pandas as pd
import numpy as np
import yfinance as yf
from datetime import datetime, timedelta

def load_market_data(symbols, period='1y', interval='1d'):
    """Load market data for multiple symbols using yfinance"""
    dataframes = {}
    for symbol in symbols:
        try:
            df = yf.download(symbol, period=period, interval=interval)
            if not df.empty:
                dataframes[symbol] = df
        except Exception as e:
            print(f"Error loading data for {symbol}: {e}")
    return dataframes

def calculate_technical_indicators(dataframes):
    """Calculate technical indicators for each dataframe"""
    results = {}
    for symbol, df in dataframes.items():
        if len(df) == 0:
            continue
            
        # Make a copy to avoid modifying the original
        df_copy = df.copy()
        
        # Calculate moving averages
        df_copy['SMA_20'] = df_copy['Close'].rolling(window=20).mean()
        df_copy['SMA_50'] = df_copy['Close'].rolling(window=50).mean()
        
        # Calculate RSI
        delta = df_copy['Close'].diff()
        gain = delta.clip(lower=0)
        loss = -delta.clip(upper=0)
        avg_gain = gain.rolling(window=14).mean()
        avg_loss = loss.rolling(window=14).mean()
        rs = avg_gain / avg_loss
        df_copy['RSI'] = 100 - (100 / (1 + rs))
        
        # Calculate MACD
        ema12 = df_copy['Close'].ewm(span=12, adjust=False).mean()
        ema26 = df_copy['Close'].ewm(span=26, adjust=False).mean()
        df_copy['MACD'] = ema12 - ema26
        df_copy['MACD_Signal'] = df_copy['MACD'].ewm(span=9, adjust=False).mean()
        
        # Calculate Bollinger Bands
        df_copy['BB_Middle'] = df_copy['Close'].rolling(window=20).mean()
        df_copy['BB_Std'] = df_copy['Close'].rolling(window=20).std()
        df_copy['BB_Upper'] = df_copy['BB_Middle'] + 2 * df_copy['BB_Std']
        df_copy['BB_Lower'] = df_copy['BB_Middle'] - 2 * df_copy['BB_Std']
        
        # Add volume metrics
        df_copy['Volume_SMA_20'] = df_copy['Volume'].rolling(window=20).mean()
        
        # Store the processed dataframe
        results[symbol] = df_copy
        
    return results

def screen_stocks(data_dict):
    """
    Screen stocks based on your custom criteria.
    Modify this function to implement your screening logic.
    """
    matches = []
    details = {}
    
    for symbol, df in data_dict.items():
        if len(df) < 50:  # Need enough data
            continue
            
        # Get the latest data point
        latest = df.iloc[-1]
        
        # Example screening criteria - modify as needed:
        # 1. Price above 20-day moving average
        # 2. RSI between 30 and 70
        # 3. Recent MACD crossover (MACD > Signal)
        # 4. Volume above 20-day average
        
        try:
            price_above_sma = latest['Close'] > latest['SMA_20']
            rsi_in_range = 30 < latest['RSI'] < 70
            macd_signal = latest['MACD'] > latest['MACD_Signal']
            volume_above_avg = latest['Volume'] > latest['Volume_SMA_20']
            
            # Combine conditions
            if price_above_sma and rsi_in_range and macd_signal and volume_above_avg:
                matches.append(symbol)
                
                # Store details about why this stock matched
                details[symbol] = {
                    'close_price': latest['Close'],
                    'sma_20': latest['SMA_20'],
                    'rsi': latest['RSI'],
                    'macd': latest['MACD'],
                    'macd_signal': latest['MACD_Signal'],
                    'volume': latest['Volume'],
                    'avg_volume': latest['Volume_SMA_20']
                }
        except Exception as e:
            print(f"Error screening {symbol}: {e}")
            
    return matches, details

# Main screening function that will be called when running the screen
def run_screen(universe):
    """Run the stock screen on the provided universe of symbols"""
    # Load the data
    data_dict = load_market_data(universe, period='6mo', interval='1d')
    
    # Calculate indicators
    processed_data = calculate_technical_indicators(data_dict)
    
    # Run the screen
    matches, details = screen_stocks(processed_data)
    
    return {
        'matches': matches,
        'details': details
    }
`;

interface ScreenCodeEditorProps {
  initialCode?: string;
  onChange?: (code: string) => void;
}

const ScreenCodeEditor = ({ initialCode, onChange }: ScreenCodeEditorProps) => {
  const [code, setCode] = useState(initialCode || DEFAULT_PYTHON_SCREEN);
  const [explanation, setExplanation] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (initialCode) {
      setCode(initialCode);
    }
  }, [initialCode]);

  const explainCode = useMutation({
    mutationFn: (codeContent: string) => 
      postData('/api/screen-builder/explain', { code: codeContent }),
    onSuccess: (data) => {
      setExplanation(data.explanation);
    },
    onError: (error: any) => {
      console.error("Code explanation error:", error);
      toast({
        title: "Explanation failed",
        description: error?.response?.data?.message || "Failed to explain code",
        variant: "destructive",
      });
    }
  });

  const handleCodeChange = (value: string) => {
    setCode(value);
    if (onChange) {
      onChange(value);
    }
  };

  const handleExplainCode = () => {
    if (code.trim()) {
      explainCode.mutate(code);
    } else {
      toast({
        title: "Empty code",
        description: "There's no code to explain",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="border rounded-md">
        <CodeMirror
          value={code}
          height="400px"
          extensions={[python(), EditorView.lineWrapping]}
          onChange={handleCodeChange}
          theme={okaidia}
          basicSetup={{
            lineNumbers: true,
            highlightActiveLineGutter: true,
            highlightSpecialChars: true,
            foldGutter: true,
            dropCursor: true,
            allowMultipleSelections: true,
            indentOnInput: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: true,
            rectangularSelection: true,
            crosshairCursor: true,
            highlightActiveLine: true,
            highlightSelectionMatches: true,
            closeBracketsKeymap: true,
            defaultKeymap: true,
            searchKeymap: true,
            historyKeymap: true,
            foldKeymap: true,
            completionKeymap: true,
            lintKeymap: true,
          }}
        />
      </div>
      
      <div className="flex justify-end">
        <Button 
          variant="outline" 
          onClick={handleExplainCode}
          disabled={explainCode.isPending}
        >
          {explainCode.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Explaining...
            </>
          ) : (
            <>
              <HelpCircle className="mr-2 h-4 w-4" /> Explain This Code
            </>
          )}
        </Button>
      </div>
      
      {explanation && (
        <Card>
          <CardHeader>
            <CardTitle>Code Explanation</CardTitle>
            <CardDescription>
              Here's what this code does in simple terms
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm whitespace-pre-wrap">
              {explanation}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ScreenCodeEditor;
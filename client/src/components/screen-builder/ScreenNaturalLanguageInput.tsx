import React from 'react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Info } from 'lucide-react';

interface ScreenNaturalLanguageInputProps {
  value: string;
  onChange: (value: string) => void;
}

const PLACEHOLDER = 
`Enter a description of the screen you want to create. For example:

"Create a screen that finds stocks with RSI below 30 and showing signs of reversal. Include volume analysis to confirm the trend reversal."

"Find stocks that have formed a cup and handle pattern in the last 3 months, with volume confirmation."

"Build a momentum screener that identifies stocks trending above their 20-day moving average with accelerating MACD."`;

const EXAMPLES = [
  {
    title: "Value Stocks",
    description: "Find undervalued stocks with low P/E ratios, high dividend yields, and strong fundamentals.",
  },
  {
    title: "MACD Crossover",
    description: "Screen for stocks where the MACD line has recently crossed above the signal line, indicating bullish momentum.",
  },
  {
    title: "Golden Cross",
    description: "Identify stocks where the 50-day moving average has crossed above the 200-day moving average, a bullish signal.",
  },
  {
    title: "Oversold Bounce",
    description: "Find stocks with RSI below 30 that are showing early signs of reversal with increased volume.",
  },
  {
    title: "Breakout Candidates",
    description: "Screen for stocks that are approaching or breaking through significant resistance levels with high volume.",
  },
];

export const ScreenNaturalLanguageInput: React.FC<ScreenNaturalLanguageInputProps> = ({ value, onChange }) => {
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  const insertExample = (example: string) => {
    onChange(example);
  };

  return (
    <div className="space-y-4">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Instructions</AlertTitle>
        <AlertDescription>
          Describe the stock screening criteria you want to use. Be as specific as possible about the technical indicators, 
          patterns, fundamental metrics, or other conditions you want to include. The AI will convert your description into 
          Python code that can be executed to screen stocks.
        </AlertDescription>
      </Alert>
      
      <Textarea 
        placeholder={PLACEHOLDER}
        value={value}
        onChange={handleChange}
        className="min-h-[200px] font-mono text-sm"
      />
      
      <div className="space-y-2">
        <h3 className="text-sm font-medium">Examples (click to use):</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {EXAMPLES.map((example) => (
            <div 
              key={example.title}
              className="p-3 bg-secondary/50 rounded cursor-pointer hover:bg-secondary"
              onClick={() => insertExample(example.description)}
            >
              <h4 className="font-medium">{example.title}</h4>
              <p className="text-sm opacity-80">{example.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
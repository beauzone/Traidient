import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
// Configure OpenAI with more options to support both traditional and project-scoped API keys
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || "demo-api-key",
  dangerouslyAllowBrowser: false,
  defaultHeaders: {
    "Content-Type": "application/json"
  },
  defaultQuery: undefined
});

export async function generateStrategy(prompt: string): Promise<{
  strategy: string;
  explanation: string;
  configuration: any;
}> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: 
            "You are an expert trading strategy builder. Your task is to convert a natural language description into a " +
            "structured trading strategy with clear rules. Provide a detailed strategy with entry/exit rules, risk management " +
            "and indicators needed. Return a JSON object containing: strategy (code implementation), explanation (plain language), " +
            "and configuration (parameters and settings for running the strategy)."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content ?? '{}';
    const result = JSON.parse(content);
    
    return {
      strategy: result.strategy || '',
      explanation: result.explanation || '',
      configuration: result.configuration || {}
    };
  } catch (error) {
    console.error("Error generating strategy:", error);
    throw new Error("Failed to generate strategy with OpenAI: " + (error as Error).message);
  }
}

export async function explainStrategy(strategyCode: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: 
            "You are an expert at explaining trading algorithms in simple terms. Take the provided trading strategy code " +
            "and explain how it works in plain, non-technical language that a beginner trader could understand."
        },
        {
          role: "user",
          content: strategyCode
        }
      ]
    });

    return response.choices[0].message.content ?? "No explanation provided";
  } catch (error) {
    console.error("Error explaining strategy:", error);
    throw new Error("Failed to explain strategy with OpenAI: " + (error as Error).message);
  }
}

export async function optimizeStrategy(
  strategyCode: string, 
  backtestResults: any, 
  optimizationGoal: string
): Promise<{
  optimizedStrategy: string;
  changes: string;
  expectedImprovements: string;
}> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: 
            "You are an expert at optimizing trading strategies. Given a strategy code, backtest results, and an optimization goal, " +
            "suggest improvements to the strategy. Return a JSON object with the optimized strategy code, a summary of changes made, " +
            "and expected improvements."
        },
        {
          role: "user",
          content: `
            Strategy code:
            ${strategyCode}
            
            Backtest results:
            ${JSON.stringify(backtestResults, null, 2)}
            
            Optimization goal:
            ${optimizationGoal}
          `
        }
      ],
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content ?? '{}';
    const result = JSON.parse(content);
    
    return {
      optimizedStrategy: result.optimizedStrategy || '',
      changes: result.changes || '',
      expectedImprovements: result.expectedImprovements || ''
    };
  } catch (error) {
    console.error("Error optimizing strategy:", error);
    throw new Error("Failed to optimize strategy with OpenAI: " + (error as Error).message);
  }
}

export async function generateScreen(prompt: string): Promise<{
  screen: string;
  explanation: string;
  configuration: any;
}> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: 
            "You are an expert at creating stock screeners using Python. Your task is to convert a natural language description into " +
            "a structured Python-based stock screener with clear filtering rules. The screener should use libraries like pandas, pandas_ta, numpy, and yfinance " +
            "to load and analyze stock data. Return a JSON object containing: screen (Python code implementation), explanation (plain language), " +
            "and configuration (symbols to analyze and other settings for running the screener). The Python code should follow the format of our " +
            "existing screeners that include functions for loading data, calculating indicators, and screening stocks based on criteria."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content ?? '{}';
    const result = JSON.parse(content);
    
    return {
      screen: result.screen || '',
      explanation: result.explanation || '',
      configuration: result.configuration || {}
    };
  } catch (error) {
    console.error("Error generating screen:", error);
    throw new Error("Failed to generate screen with OpenAI: " + (error as Error).message);
  }
}

export async function explainScreen(screenCode: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: 
            "You are an expert at explaining stock screeners in simple terms. Take the provided Python stock screener code " +
            "and explain how it works in plain, non-technical language that a beginner investor could understand."
        },
        {
          role: "user",
          content: screenCode
        }
      ]
    });

    return response.choices[0].message.content ?? "No explanation provided";
  } catch (error) {
    console.error("Error explaining screen:", error);
    throw new Error("Failed to explain screen with OpenAI: " + (error as Error).message);
  }
}

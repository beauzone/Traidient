import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "demo-api-key" });

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

    const result = JSON.parse(response.choices[0].message.content);
    
    return {
      strategy: result.strategy,
      explanation: result.explanation,
      configuration: result.configuration
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

    return response.choices[0].message.content || "No explanation provided";
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

    const result = JSON.parse(response.choices[0].message.content);
    
    return {
      optimizedStrategy: result.optimizedStrategy,
      changes: result.changes,
      expectedImprovements: result.expectedImprovements
    };
  } catch (error) {
    console.error("Error optimizing strategy:", error);
    throw new Error("Failed to optimize strategy with OpenAI: " + (error as Error).message);
  }
}

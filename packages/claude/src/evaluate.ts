import Anthropic from "@anthropic-ai/sdk";
import { METHODOLOGY_SYSTEM_PROMPT, METHODOLOGY_VERSION } from "./prompts/methodology.js";
import { SUBMIT_EVALUATION_TOOL } from "./tools.js";
import type {
  EvaluationInput,
  EvaluationOutput,
  EvaluationResult,
  EvaluationUsage,
  PortfolioAction,
  Signal,
} from "./types.js";

const DEFAULT_MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 1024;

export interface EvaluatorConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
}

export function createEvaluator(config: EvaluatorConfig) {
  const client = new Anthropic({ apiKey: config.apiKey });
  const model = config.model ?? DEFAULT_MODEL;
  const maxTokens = config.maxTokens ?? MAX_TOKENS;

  async function evaluateOne(input: EvaluationInput): Promise<EvaluationResult> {
    const userPayload = buildUserPayload(input);
    try {
      const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        temperature: 0,
        system: [
          {
            type: "text",
            text: METHODOLOGY_SYSTEM_PROMPT,
            cache_control: { type: "ephemeral" },
          },
        ],
        tools: [SUBMIT_EVALUATION_TOOL],
        tool_choice: { type: "tool", name: "submit_evaluation" },
        messages: [{ role: "user", content: userPayload }],
        metadata: { user_id: "buy-sell-tool" },
      });

      const toolBlock = response.content.find(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
      );
      if (!toolBlock) {
        return {
          ok: false,
          symbol: input.symbol,
          error: "no_tool_use_block",
          raw: response,
        };
      }
      const evalOut = coerceEvaluation(toolBlock.input);
      if (!evalOut) {
        return {
          ok: false,
          symbol: input.symbol,
          error: "invalid_tool_output_shape",
          raw: toolBlock.input,
        };
      }

      const usage: EvaluationUsage = {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        cache_creation_input_tokens: response.usage.cache_creation_input_tokens ?? 0,
        cache_read_input_tokens: response.usage.cache_read_input_tokens ?? 0,
      };

      return { ok: true, symbol: input.symbol, evaluation: evalOut, usage };
    } catch (err) {
      return {
        ok: false,
        symbol: input.symbol,
        error: (err as Error).message,
      };
    }
  }

  return { evaluateOne, model, methodologyVersion: METHODOLOGY_VERSION };
}

function buildUserPayload(input: EvaluationInput): string {
  const compact = {
    symbol: input.symbol,
    name: input.name,
    exchange: input.exchange,
    currency: input.currency,
    current_price: input.current_price,
    fear_greed: input.fear_greed,
    scores: {
      technical: input.scores.technical,
      fundamental: input.scores.fundamental,
      sentiment: input.scores.sentiment,
      total: input.scores.total,
      preliminary_signal: input.scores.signal,
    },
    indicators: {
      rsi: input.indicators.rsi,
      macd: input.indicators.macd,
      macd_signal: input.indicators.macd_signal,
      macd_histogram: input.indicators.macd_histogram,
      macd_crossover: input.indicators.macd_crossover,
      bb_position: input.indicators.bb_position,
      bb_lower: input.indicators.bb_lower,
      bb_upper: input.indicators.bb_upper,
      sma50: input.indicators.sma50,
      sma200: input.indicators.sma200,
      ma_cross: input.indicators.ma_cross,
      atr: input.indicators.atr,
      atr_pct: input.indicators.atr_pct,
      volume_ratio: input.indicators.volume_ratio,
      fib_support: input.indicators.fibonacci?.next_support,
      fib_resistance: input.indicators.fibonacci?.next_resistance,
      stop_loss_atr: input.indicators.stop_loss,
    },
    fundamentals: input.fundamentals ?? null,
    news_top: (input.news ?? []).slice(0, 3).map((n) => ({
      title: n.title,
      sentiment: n.sentiment_label,
      sentiment_score: n.sentiment_score,
      source: n.source,
      published: n.published,
    })),
    portfolio: input.portfolio ?? null,
  };
  return `Evaluate this single ticker. Call submit_evaluation exactly once.\n\n${JSON.stringify(compact, null, 2)}`;
}

const VALID_SIGNALS: Signal[] = [
  "STRONG_BUY",
  "BUY",
  "HOLD",
  "SELL",
  "STRONG_SELL",
];
const VALID_PORTFOLIO_ACTIONS: PortfolioAction[] = ["BUY", "HOLD", "SELL", "ADD"];

function coerceEvaluation(input: unknown): EvaluationOutput | null {
  if (typeof input !== "object" || input === null) return null;
  const o = input as Record<string, unknown>;
  const signal = o["signal"];
  const conviction = o["conviction"];
  const thesis = o["thesis"];
  const risks = o["risks"];
  const catalysts = o["catalysts"];
  const target = o["target_price"];
  const stop = o["stop_loss"];
  const pa = o["portfolio_action"];

  if (typeof signal !== "string" || !VALID_SIGNALS.includes(signal as Signal)) return null;
  if (typeof conviction !== "number" || conviction < 0 || conviction > 1) return null;
  if (typeof thesis !== "string" || thesis.length === 0) return null;
  if (!Array.isArray(risks) || !risks.every((r) => typeof r === "string")) return null;
  if (!Array.isArray(catalysts) || !catalysts.every((c) => typeof c === "string")) return null;
  if (typeof target !== "number") return null;
  if (typeof stop !== "number") return null;

  const out: EvaluationOutput = {
    signal: signal as Signal,
    conviction,
    thesis,
    risks: risks as string[],
    catalysts: catalysts as string[],
    target_price: target,
    stop_loss: stop,
  };
  if (typeof pa === "string" && VALID_PORTFOLIO_ACTIONS.includes(pa as PortfolioAction)) {
    out.portfolio_action = pa as PortfolioAction;
  }
  return out;
}

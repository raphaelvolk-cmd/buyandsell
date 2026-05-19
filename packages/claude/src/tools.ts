import type Anthropic from "@anthropic-ai/sdk";

export const SUBMIT_EVALUATION_TOOL: Anthropic.Tool = {
  name: "submit_evaluation",
  description:
    "Submit your final evaluation of this single ticker. You MUST call this tool exactly once.",
  input_schema: {
    type: "object",
    properties: {
      signal: {
        type: "string",
        enum: ["STRONG_BUY", "BUY", "HOLD", "SELL", "STRONG_SELL"],
        description: "Overall directional signal for the stock.",
      },
      conviction: {
        type: "number",
        minimum: 0,
        maximum: 1,
        description:
          "How confident are you in this signal? 0.9+ = high conviction, 0.5-0.7 = speculative, <0.5 = essentially uncertain (report HOLD).",
      },
      thesis: {
        type: "string",
        description:
          "2-4 sentences. Crisp bull or bear case. Reference specific indicator/fundamental values.",
      },
      risks: {
        type: "array",
        items: { type: "string" },
        minItems: 1,
        maxItems: 3,
        description:
          "Short bullet strings describing what would invalidate this thesis.",
      },
      catalysts: {
        type: "array",
        items: { type: "string" },
        maxItems: 3,
        description: "Specific events/levels/dates that would confirm the thesis.",
      },
      target_price: {
        type: "number",
        description: "6-12 month price objective in the ticker's native currency.",
      },
      stop_loss: {
        type: "number",
        description:
          "Confirmed exit level. May tighten or widen the precomputed stop_loss.",
      },
      portfolio_action: {
        type: "string",
        enum: ["BUY", "HOLD", "SELL", "ADD"],
        description:
          "Only when user holds this position. ADD = pyramid; SELL = exit; HOLD = no action.",
      },
    },
    required: [
      "signal",
      "conviction",
      "thesis",
      "risks",
      "catalysts",
      "target_price",
      "stop_loss",
    ],
  },
};

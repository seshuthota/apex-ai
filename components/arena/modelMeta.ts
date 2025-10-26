import React from "react";
import { ModelIcon } from "./icons";
import type { ModelMeta } from "./types";

const minimaxMeta: ModelMeta = {
  id: "minimax",
  name: "MiniMax M2 Trader",
  color: "#5B8DEF",
  icon: React.createElement(ModelIcon, { color: "#5B8DEF" }),
};

const deepseekMeta: ModelMeta = {
  id: "deepseek",
  name: "DeepSeek Chat Trader",
  color: "#42A5F5",
  icon: React.createElement(ModelIcon, { color: "#42A5F5" }),
};

export const MODEL_META: Record<string, ModelMeta> = {
  minimax: minimaxMeta,
  "minimax m2 trader": minimaxMeta,
  "minimax m2 trader (openrouter)": minimaxMeta,
  deepseek: deepseekMeta,
  "deepseek chat trader": deepseekMeta,
  "deepseek chat v3.1 trader (openrouter)": deepseekMeta,
};

const FALLBACK_COLORS = [
  "#16a34a",
  "#2563eb",
  "#f59e0b",
  "#dc2626",
  "#0ea5e9",
  "#7c3aed",
  "#db2777",
];

export const getModelMeta = (modelId: string, modelName?: string): ModelMeta => {
  const meta =
    MODEL_META[modelId] ??
    (modelName ? MODEL_META[modelName.toLowerCase()] : undefined);
  if (meta) return meta;

  const hash = Array.from(modelId || modelName || "model").reduce(
    (acc, char) => acc + char.charCodeAt(0),
    0,
  );
  const color = FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
  return {
    id: modelId,
    name: modelName ?? modelId,
    color,
    icon: React.createElement(ModelIcon, { color }),
  };
};

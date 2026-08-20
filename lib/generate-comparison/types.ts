export type ComparisonRequest = {
  baselinePrompt: string;
  diversePrompt: string;
  numInferenceSteps: number;
  guidanceScale: number;
  seed: number;
  loraScale: number;
  loraWeightsUrl: string;
};

export type ComparisonResponse = {
  baselineUrl: string;
  diverseUrl: string;
  seed: number;
  durationMs: number;
  diversePrompt: string;
};

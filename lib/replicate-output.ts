/** Normalize Replicate `run()` return value to a single image URL string. */
export function firstOutputUrl(output: unknown): string {
  if (output == null) {
    throw new Error("Empty model output");
  }
  if (typeof output === "string") {
    return output;
  }
  if (Array.isArray(output) && output.length > 0) {
    return firstOutputUrl(output[0]);
  }
  const obj = output as { url?: (() => string | URL) | string };
  if (typeof obj.url === "function") {
    const u = obj.url();
    return typeof u === "string" ? u : u.toString();
  }
  if (typeof obj.url === "string") {
    return obj.url;
  }
  throw new Error("Unexpected Replicate output shape (expected URL or FileOutput)");
}

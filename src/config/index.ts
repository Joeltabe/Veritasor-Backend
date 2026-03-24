/**
 * @module config
 * @description Centralized configuration with runtime validation for all
 * critical environment variables. Fails fast on startup if any required
 * variable is missing or malformed, preventing silent misconfigurations.
 *
 * @throws {Error} If any critical environment variable is missing or invalid.
 */

import { z } from "zod";

/**
 * @schema envSchema
 * @description Zod schema defining all required and optional environment
 * variables for the Veritasor backend. Add new vars here as the app grows.
 */
const envSchema = z.object({
  // Server
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z
    .string()
    .optional()
    .default("3000")
    .transform((val) => parseInt(val, 10)),

  // Database
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // Auth / JWT
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),

  // Razorpay
  RAZORPAY_KEY_ID: z.string().min(1, "RAZORPAY_KEY_ID is required"),
  RAZORPAY_KEY_SECRET: z.string().min(1, "RAZORPAY_KEY_SECRET is required"),
  RAZORPAY_WEBHOOK_SECRET: z
    .string()
    .min(1, "RAZORPAY_WEBHOOK_SECRET is required"),
});

/**
 * @typedef {z.infer<typeof envSchema>} Env
 * @description Inferred TypeScript type for the validated config object.
 */
export type Env = z.infer<typeof envSchema>;

/**
 * @function validateConfig
 * @description Parses and validates process.env against the schema.
 * Logs all missing/invalid fields at once before throwing, so developers
 * can fix everything in one pass.
 *
 * @returns {Env} Validated and typed configuration object.
 * @throws {Error} If validation fails.
 */
function validateConfig(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");

    throw new Error(
      `[Config] Missing or invalid environment variables:\n${issues}\n\n` +
        `Ensure all required variables are set before starting the server.`
    );
  }

  return result.data;
}

/**
 * @constant config
 * @description Validated, typed config object. Import this throughout the
 * app instead of accessing process.env directly.
 *
 * @example
 * import { config } from "../config/index.js";
 * const secret = config.JWT_SECRET;
 */
export const config = validateConfig();
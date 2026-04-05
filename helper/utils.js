// === helper/fileNameGenerator.js ===
import crypto from "crypto";

/**
 * Generates a random filename
 * @param {number} bytes - number of bytes for randomness (default 32)
 * @returns {string} hex string
 */
export const generateFileName = (bytes = 32) =>
  crypto.randomBytes(bytes).toString("hex");
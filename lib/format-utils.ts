import { HERB_NAMES, HerbId, POTION_NAMES, PotionId } from "./types";

/**
 * Replace H## and P## IDs in error strings with their actual names
 */
export function parseErrorString(error: string): string {
  let result = error;

  // Replace potion IDs (P01-P18) with names
  result = result.replace(/P(0[1-9]|1[0-8])/g, (match) => {
    const name = POTION_NAMES[match as PotionId];
    return name ? name : match;
  });

  // Replace herb IDs (H01-H12) with names
  result = result.replace(/H(0[1-9]|1[0-2])/g, (match) => {
    const name = HERB_NAMES[match as HerbId];
    return name ? name : match;
  });

  return result;
}

/**
 * Parse an array of error strings
 */
export function parseErrorStrings(errors: string[]): string[] {
  return errors.map(parseErrorString);
}


import type { Problem } from "./types";
import { twoSum } from "./two-sum";
import { binarySearch } from "./binary-search";
import { validParentheses } from "./valid-parentheses";

export type { Problem, Difficulty, ProblemExample } from "./types";

export const problems: Problem[] = [twoSum, binarySearch, validParentheses];

export function getProblem(id: string): Problem | undefined {
  return problems.find((p) => p.id === id);
}

import type { Problem } from "./types";

export const validParentheses: Problem = {
  id: "valid-parentheses",
  title: "Valid Parentheses",
  difficulty: "easy",
  statement: `給定一個只包含字元 \`()[]{}\` 的字串 \`s\`，判斷括號是否合法配對。`,
  examples: [
    { input: 's = "()"', output: "true" },
    { input: 's = "()[]{}"', output: "true" },
    { input: 's = "(]"', output: "false" },
  ],
  hints: [
    "括號配對有『後進先出』的特性，你想到什麼資料結構？",
    "Stack：遇到左括號就 push，遇到右括號就 pop 並比對是否成對。",
  ],
};

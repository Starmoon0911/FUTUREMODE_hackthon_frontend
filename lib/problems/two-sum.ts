import type { Problem } from "./types";

export const twoSum: Problem = {
  id: "two-sum",
  title: "Two Sum",
  difficulty: "easy",
  statement: `給定一個整數陣列 \`nums\` 和目標值 \`target\`，請回傳兩個索引（index），使得 \`nums[i] + nums[j] = target\`。
假設每個輸入都恰好有一組解，且不能重複使用同一個元素。`,
  examples: [
    { input: "nums = [2,7,11,15], target = 9", output: "[0,1]", explanation: "nums[0]+nums[1] = 9" },
    { input: "nums = [3,2,4], target = 6", output: "[1,2]" },
  ],
  hints: [
    "想想看暴力解是 O(n²)，能不能更快？",
    "陣列中找某個值是否出現過，你會用什麼資料結構？",
    "HashMap 可以讓你在 O(1) 時間內查到某個值是否出現過。",
  ],
  defaultLanguage: "typescript",
  allowedLanguages: ["typescript", "javascript", "python", "cpp", "go", "java"],
  starters: {
    typescript: `function twoSum(nums: number[], target: number): number[] {
  // 在這裡寫你的解題程式碼
  return [];
}
`,
    javascript: `function twoSum(nums, target) {
  // 在這裡寫你的解題程式碼
  return [];
}
`,
    python: `def two_sum(nums, target):
    # 在這裡寫你的解題程式碼
    return []
`,
    cpp: `#include <vector>
using namespace std;

vector<int> twoSum(vector<int>& nums, int target) {
    // 在這裡寫你的解題程式碼
    return {};
}
`,
    go: `package main

func twoSum(nums []int, target int) []int {
    // 在這裡寫你的解題程式碼
    return nil
}
`,
    java: `import java.util.*;

class Solution {
    public int[] twoSum(int[] nums, int target) {
        // 在這裡寫你的解題程式碼
        return new int[]{};
    }
}
`,
  },
};

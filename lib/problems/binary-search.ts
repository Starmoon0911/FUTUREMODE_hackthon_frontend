import type { Problem } from "./types";

export const binarySearch: Problem = {
  id: "binary-search",
  title: "Binary Search",
  difficulty: "easy",
  statement: `給定一個已排序（遞增）的整數陣列 \`nums\` 和目標值 \`target\`，寫一個函式搜尋 \`target\` 在陣列中的索引，若不存在則回傳 -1。
時間複雜度必須是 O(log n)。`,
  examples: [
    { input: "nums = [-1,0,3,5,9,12], target = 9", output: "4" },
    { input: "nums = [-1,0,3,5,9,12], target = 2", output: "-1" },
  ],
  hints: [
    "O(log n) 的時間複雜度提示你每次要把搜尋範圍砍半。",
    "維護左右邊界，每次看中間的元素是大還是小。",
    "小心邊界條件：while (left <= right) 還是 while (left < right)？",
  ],
};

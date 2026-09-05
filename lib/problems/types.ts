export type Difficulty = "easy" | "medium" | "hard";

export interface ProblemExample {
  input: string;
  output: string;
  explanation?: string;
}

export interface Problem {
  id: string;
  title: string;
  difficulty: Difficulty;
  statement: string; // markdown
  examples: ProblemExample[];
  hints: string[];
}

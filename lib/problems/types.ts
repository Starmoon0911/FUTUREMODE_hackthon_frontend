export type Difficulty = "easy" | "medium" | "hard";

export type SupportedLanguage =
  | "typescript"
  | "javascript"
  | "python"
  | "cpp"
  | "go"
  | "rust"
  | "java";

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
  /** Default language when the editor opens this problem. */
  defaultLanguage: SupportedLanguage;
  /** Languages the learner is allowed to switch to. Must include defaultLanguage. */
  allowedLanguages: SupportedLanguage[];
  /** Per-language starter code shown when that language is selected. */
  starters: Partial<Record<SupportedLanguage, string>>;
}

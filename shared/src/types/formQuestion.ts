export type QuestionType = 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'SHORT_ANSWER' | 'TABLE';

export interface QuestionOption {
  id: string;
  text: string;
}

export interface FormQuestion {
  id: string;
  type: QuestionType;
  title: string;
  required: boolean;
  options: QuestionOption[];
  tableRows: string[];
  tableColumns: string[];
}

// SINGLE_CHOICE: selected option id. MULTIPLE_CHOICE: selected option ids.
// TRUE_FALSE: literal 'true' | 'false' (not an option id). SHORT_ANSWER: free text.
// TABLE: row index -> column index, e.g. { "0": "2", "1": "0" }.
export type Answer = string | string[] | Record<string, string>;

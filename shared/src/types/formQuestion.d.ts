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
export type Answer = string | string[] | Record<string, string>;

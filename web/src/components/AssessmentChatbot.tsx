// 'use client';

// import { useState, useRef, useEffect } from 'react';
// import { createPortal } from 'react-dom';
// import { cn } from '@/lib/utils';
// // import extractTextFromPDF from "react-pdftotext";

// // ── Types ──────────────────────────────────────────────────────────────────────
// export type GeneratedQuestionType =
//   | 'SINGLE_CHOICE'
//   | 'MULTIPLE_CHOICE'
//   | 'TRUE_FALSE'
//   | 'SHORT_ANSWER'
//   | 'TABLE';

// export interface GeneratedQuestion {
//   type: GeneratedQuestionType;
//   title: string;
//   required: boolean;
//   options: string[];
//   tableRows: string[];
//   tableColumns: string[];
// }

// interface ChatMessage {
//   role: 'user' | 'assistant';
//   content: string;
//   questions?: GeneratedQuestion[];
//   inserted?: boolean;
// }

// export interface AssessmentChatbotProps {
//   /** Short description of the current page/context passed to the AI system prompt */
//   context?: string;
//   /** Called when the user clicks "Add to form" on a generated question set */
//   onInsertQuestions?: (questions: GeneratedQuestion[]) => void;
//   /** Optional quick-prompt chips shown before the first message. Falls back to the default 360° prompts. */
//   quickPrompts?: string[];
// }

// // ── Quick-prompt chips ─────────────────────────────────────────────────────────
// const QUICK_PROMPTS = [
//   'Generate 5 leadership questions',
//   'Best practices for 360° feedback',
//   'Create a TABLE question for communication skills',
//   'Suggest questions for emotional intelligence',
// ];

// // ── Component ──────────────────────────────────────────────────────────────────
// export function AssessmentChatbot({ context, onInsertQuestions, quickPrompts }: AssessmentChatbotProps) {
//   const activePrompts = quickPrompts ?? QUICK_PROMPTS;
//   const [isOpen, setIsOpen] = useState(false);
//   const [messages, setMessages] = useState<ChatMessage[]>([
//     {
//       role: 'assistant',
//       content:
//         "Hi! I'm your AI assessment assistant. I can help you design effective questions, explain best practices, or generate a full question set. What would you like to build?",
//     },
//   ]);
//   const [input, setInput] = useState('');
//   const [isLoading, setIsLoading] = useState(false);
//   const [mounted, setMounted] = useState(false);
//   const messagesEndRef = useRef<HTMLDivElement>(null);
//   const inputRef = useRef<HTMLInputElement>(null);

//   useEffect(() => { setMounted(true); }, []);

//   useEffect(() => {
//     if (isOpen) {
//       setTimeout(() => {
//         messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
//         inputRef.current?.focus();
//       }, 50);
//     }
//   }, [isOpen]);

//   useEffect(() => {
//     messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
//   }, [messages]);

//   async function send(text?: string) {
//     const content = (text ?? input).trim();
//     if (!content || isLoading) return;

//     const userMsg: ChatMessage = { role: 'user', content };
//     setMessages((prev) => [...prev, userMsg]);
//     setInput('');
//     setIsLoading(true);

//     try {
//       const res = await fetch('/chat-api', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({
//           messages: [...messages, userMsg].map((m) => ({
//             role: m.role,
//             content: m.content,
//           })),
//           context: context ?? '',
//         }),
//       });

//       if (!res.ok) throw new Error('API error');
//       const data = await res.json();

//       setMessages((prev) => [
//         ...prev,
//         {
//           role: 'assistant',
//           content: data.message,
//           questions: data.questions?.length ? data.questions : undefined,
//         },
//       ]);
//     } catch {
//       setMessages((prev) => [
//         ...prev,
//         { role: 'assistant', content: 'Sorry, I ran into an error. Please try again.' },
//       ]);
//     } finally {
//       setIsLoading(false);
//     }
//   }

//   const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
//     const file = e.target.files?.[0];
//     if (!file) return;

//     setIsLoading(true);
//     try {
//       const { default: extractTextFromPDF } = await import("react-pdftotext");
//       const pdfText = await extractTextFromPDF(file);
//       console.log('Extracted PDF text:', pdfText);
//     } catch (error) {
//       console.log('Error extracting text from PDF:', error);
//     } finally {
//       setIsLoading(false);
//     }
//   }

//   function markInserted(msgIndex: number) {
//     setMessages((prev) =>
//       prev.map((m, i) => (i === msgIndex ? { ...m, inserted: true } : m)),
//     );
//   }

//   if (!mounted) return null;

//   return createPortal(
//     <>
//       {/* ── Toggle button ── */}
//       <button
//         onClick={() => setIsOpen((v) => !v)}
//         title="AI Assessment Assistant"
//         className={cn(
//           'fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95',
//           isOpen
//             ? 'bg-gray-700 text-white shadow-gray-300'
//             : 'bg-gradient-to-br from-blue-600 to-blue-350 text-white shadow-blue-200',
//         )}
//       >
//         {isOpen ? (
//           <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
//             <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
//           </svg>
//         ) : (
//           <svg className="w-6 h-6" fill="none" viewBox="0 0 20 24" stroke="currentColor" strokeWidth={1.5}>
//             <path
//               strokeLinecap="round"
//               strokeLinejoin="round"
//               d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
//             />
//           </svg>
//         )}
//       </button>

//       {/* ── Chat panel ── */}
//       {isOpen && (
//         <div className="fixed bottom-24 right-6 z-40 w-[22rem] sm:w-96 flex flex-col bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden"
//           style={{ maxHeight: 'calc(100vh - 9rem)' }}
//         >
//           {/* Header */}
//           <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-500 shrink-0">
//             <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
//               <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
//                 <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
//               </svg>
//             </div>
//             <div className="flex-1 min-w-0">
//               <p className="text-sm font-semibold text-white">AI Assessment Assistant</p>
//               <p className="text-xs text-blue-100">Powered by GPT-4o mini</p>
//             </div>
//             <button
//               onClick={() => setIsOpen(false)}
//               className="text-white/70 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
//             >
//               <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
//                 <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
//               </svg>
//             </button>
//           </div>

//           {/* Messages */}
//           <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
//             {messages.map((msg, idx) => (
//               <div key={idx} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
//                 {msg.role === 'assistant' && (
//                   <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mr-2 mt-0.5">
//                     <svg className="w-3 h-3 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
//                       <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
//                     </svg>
//                   </div>
//                 )}
//                 <div className={cn('flex flex-col gap-2', msg.role === 'user' ? 'items-end' : 'items-start', 'max-w-[82%]')}>
//                   {/* Bubble */}
//                   <div
//                     className={cn(
//                       'px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap',
//                       msg.role === 'user'
//                         ? 'bg-blue-600 text-white rounded-br-sm'
//                         : 'bg-gray-100 text-gray-800 rounded-bl-sm',
//                     )}
//                   >
//                     {msg.content}
//                   </div>

//                   {/* Generated questions card */}
//                   {msg.questions && msg.questions.length > 0 && onInsertQuestions && (
//                     <div className="w-full bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-3 space-y-2.5">
//                       <div className="flex items-center gap-2">
//                         <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
//                           <svg className="w-3 h-3 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
//                             <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
//                           </svg>
//                         </div>
//                         <p className="text-xs font-semibold text-blue-800">
//                           {msg.questions.length} question{msg.questions.length !== 1 ? 's' : ''} ready to insert
//                         </p>
//                       </div>
//                       <div className="space-y-1 max-h-32 overflow-y-auto">
//                         {msg.questions.map((q, qi) => (
//                           <div key={qi} className="flex items-start gap-1.5">
//                             <span className="text-xs text-blue-400 shrink-0 mt-0.5 font-mono">{qi + 1}.</span>
//                             <p className="text-xs text-gray-700 line-clamp-2 leading-relaxed">{q.title}</p>
//                           </div>
//                         ))}
//                       </div>
//                       {msg.inserted ? (
//                         <div className="flex items-center gap-1.5 text-xs text-green-600 font-medium py-1">
//                           <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
//                             <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
//                           </svg>
//                           Added to form
//                         </div>
//                       ) : (
//                         <button
//                           onClick={() => {
//                             onInsertQuestions(msg.questions!);
//                             markInserted(idx);
//                           }}
//                           className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold rounded-lg px-3 py-2 transition-colors flex items-center justify-center gap-1.5"
//                         >
//                           <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
//                             <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
//                           </svg>
//                           Add all to form
//                         </button>
//                       )}
//                     </div>
//                   )}
//                 </div>
//               </div>
//             ))}

//             {/* Typing indicator */}
//             {isLoading && (
//               <div className="flex justify-start">
//                 <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mr-2 mt-0.5">
//                   <svg className="w-3 h-3 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
//                     <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
//                   </svg>
//                 </div>
//                 <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3">
//                   <div className="flex gap-1.5 items-center h-4">
//                     <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
//                     <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
//                     <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
//                   </div>
//                 </div>
//               </div>
//             )}
//             <div ref={messagesEndRef} />
//           </div>

//           {/* Quick prompts — shown only when there's just the initial message */}
//           {messages.length === 1 && !isLoading && (
//             <div className="px-4 pb-2 flex flex-wrap gap-1.5 shrink-0">
//               {activePrompts.map((prompt) => (
//                 <button
//                   key={prompt}
//                   onClick={() => send(prompt)}
//                   className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-full px-3 py-1.5 transition-colors"
//                 >
//                   {prompt}
//                 </button>
//               ))}
//             </div>
//           )}

//           {/* Input */}
//           <div className="p-3 border-t border-gray-100 shrink-0">
//             <div className="flex gap-2 items-center bg-gray-50 rounded-xl border border-gray-200 px-3 py-2 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
//               <label className={`w-5 h-5 text-gray-400 shrink-0 cursor-pointer flex items-center justify-center hover:text-gray-600 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}>
//                 {/* Plus SVG Icon */}
//                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-full h-full">
//                   <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
//                 </svg>

//                 {/* Hidden File Input */}
//                 <input
//                   type="file"
//                   className="hidden"
//                   accept="application/pdf"
//                   onChange={handleUpload}
//                   disabled={isLoading}
//                 />
//               </label>

//               <input
//                 ref={inputRef} 
//                 type="text"
//                 value={input}
//                 onChange={(e) => setInput(e.target.value)}
//                 onKeyDown={(e) => {
//                   if (e.key === 'Enter' && !e.shiftKey) {
//                     e.preventDefault();
//                     send();
//                   }
//                 }}
//                 placeholder="Ask about assessment design…"
//                 disabled={isLoading}
//                 className="flex-1 bg-transparent text-sm text-gray-700 placeholder-gray-400 focus:outline-none disabled:opacity-50 min-w-0"
//               />



//               <button
//                 onClick={() => send()}
//                 disabled={!input.trim() || isLoading}
//                 className="w-8 h-8 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg flex items-center justify-center transition-all shrink-0"
//               >
//                 <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
//                   <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
//                 </svg>
//               </button>
//             </div>
//           </div>
//         </div>
//       )}
//     </>,
//     document.body,
//   );
// }

'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────────
export type GeneratedQuestionType =
  | 'SINGLE_CHOICE'
  | 'MULTIPLE_CHOICE'
  | 'TRUE_FALSE'
  | 'SHORT_ANSWER'
  | 'TABLE';

export interface GeneratedQuestion {
  type: GeneratedQuestionType;
  title: string;
  required: boolean;
  options: string[];
  tableRows: string[];
  tableColumns: string[];
}

export interface Attachment {
  id: string;
  name: string;
  text: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string; // The full content sent to the API (including PDF text)
  displayContent?: string; // The short text shown in the UI bubble
  attachedFiles?: string[]; // Array of filenames shown as chips in the UI bubble
  questions?: GeneratedQuestion[];
  inserted?: boolean;
}

export interface AssessmentChatbotProps {
  context?: string;
  onInsertQuestions?: (questions: GeneratedQuestion[]) => void;
  quickPrompts?: string[];
}

// ── Quick-prompt chips ─────────────────────────────────────────────────────────
const QUICK_PROMPTS = [
  'Generate 5 leadership questions',
  'Best practices for 360° feedback',
  'Create a TABLE question for communication skills',
  'Suggest questions for emotional intelligence',
];

// ── Component ──────────────────────────────────────────────────────────────────
export function AssessmentChatbot({ context, onInsertQuestions, quickPrompts }: AssessmentChatbotProps) {
  const activePrompts = quickPrompts ?? QUICK_PROMPTS;
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        "Hi! I'm your AI assessment assistant. I can help you design effective questions, explain best practices, or generate a full question set. What would you like to build?",
    },
  ]);
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, attachments]);

  async function send(text?: string) {
    const userText = (text ?? input).trim();

    // Do not send if there is no text AND no attachments
    if ((!userText && attachments.length === 0) || isLoading) return;

    // Build the combined payload for the API
    let combinedContent = userText;
    if (attachments.length > 0) {
      const attachmentsText = attachments
        .map((att) => `--- Document: ${att.name} ---\n${att.text}`)
        .join('\n\n');

      combinedContent = userText
        ? `${userText}\n\n${attachmentsText}`
        : attachmentsText;
    }

    // Determine what to show in the chat bubble UI
    const displayContent = userText || 'Sent attached document(s)';

    const userMsg: ChatMessage = {
      role: 'user',
      content: combinedContent,
      displayContent: displayContent,
      attachedFiles: attachments.map(a => a.name)
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setAttachments([]); // Clear capsules after sending
    setIsLoading(true);

    try {
      const res = await fetch('/chat-api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Send all previous messages + the newly constructed one
          messages: [...messages, userMsg].map((m) => ({
            role: m.role,
            content: m.content, // Send the full text including PDFs to the AI
          })),
          context: context ?? '',
        }),
      });

      if (!res.ok) throw new Error('API error');
      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.message,
          questions: data.questions?.length ? data.questions : undefined,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I ran into an error. Please try again.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsLoading(true);
    try {
      const newAttachments: Attachment[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          // Use our new custom extractor
          const text = await extractTextFromPDF(file);

          newAttachments.push({
            id: Math.random().toString(36).substring(7),
            name: file.name,
            text
          });
        } catch (err) {
          console.error(`Failed to parse ${file.name}`, err);
        }
      }

      setAttachments((prev) => [...prev, ...newAttachments]);
    } catch (error) {
      console.error('Error extracting text from PDF:', error);
    } finally {
      setIsLoading(false);
      e.target.value = '';
    }
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((att) => att.id !== id));
  }

  function markInserted(msgIndex: number) {
    setMessages((prev) =>
      prev.map((m, i) => (i === msgIndex ? { ...m, inserted: true } : m)),
    );
  }

  if (!mounted) return null;

  return createPortal(
    <>
      {/* ── Toggle button ── */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        title="AI Assessment Assistant"
        className={cn(
          'fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95',
          isOpen
            ? 'bg-gray-700 text-white shadow-gray-300'
            : 'bg-gradient-to-br from-blue-600 to-blue-350 text-white shadow-blue-200',
        )}
      >
        {isOpen ? (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 20 24" stroke="currentColor" strokeWidth={1.5}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
            />
          </svg>
        )}
      </button>

      {/* ── Chat panel ── */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-40 w-[22rem] sm:w-96 flex flex-col bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden"
          style={{ maxHeight: 'calc(100vh - 9rem)' }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-500 shrink-0">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">AI Assessment Assistant</p>
              <p className="text-xs text-blue-100">Powered by GPT-4o mini</p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white/70 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
            {messages.map((msg, idx) => (
              <div key={idx} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mr-2 mt-0.5">
                    <svg className="w-3 h-3 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                  </div>
                )}
                <div className={cn('flex flex-col gap-2', msg.role === 'user' ? 'items-end' : 'items-start', 'max-w-[82%]')}>
                  {/* Bubble */}
                  <div
                    className={cn(
                      'px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap',
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white rounded-br-sm'
                        : 'bg-gray-100 text-gray-800 rounded-bl-sm',
                    )}
                  >
                    {/* Render attached file chips inside the message bubble */}
                    {msg.attachedFiles && msg.attachedFiles.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {msg.attachedFiles.map((name, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-[10px] bg-blue-500/30 border border-blue-400/40 text-blue-50 px-2 py-1 rounded-md">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                            </svg>
                            <span className="truncate max-w-[120px]">{name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {msg.displayContent || msg.content}
                  </div>

                  {/* Generated questions card */}
                  {msg.questions && msg.questions.length > 0 && onInsertQuestions && (
                    <div className="w-full bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-3 space-y-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                          <svg className="w-3 h-3 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                          </svg>
                        </div>
                        <p className="text-xs font-semibold text-blue-800">
                          {msg.questions.length} question{msg.questions.length !== 1 ? 's' : ''} ready to insert
                        </p>
                      </div>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {msg.questions.map((q, qi) => (
                          <div key={qi} className="flex items-start gap-1.5">
                            <span className="text-xs text-blue-400 shrink-0 mt-0.5 font-mono">{qi + 1}.</span>
                            <p className="text-xs text-gray-700 line-clamp-2 leading-relaxed">{q.title}</p>
                          </div>
                        ))}
                      </div>
                      {msg.inserted ? (
                        <div className="flex items-center gap-1.5 text-xs text-green-600 font-medium py-1">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          Added to form
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            onInsertQuestions(msg.questions!);
                            markInserted(idx);
                          }}
                          className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold rounded-lg px-3 py-2 transition-colors flex items-center justify-center gap-1.5"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                          </svg>
                          Add all to form
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mr-2 mt-0.5">
                  <svg className="w-3 h-3 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                </div>
                <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3">
                  <div className="flex gap-1.5 items-center h-4">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick prompts — shown only when there's just the initial message */}
          {messages.length === 1 && !isLoading && (
            <div className="px-4 pb-2 flex flex-wrap gap-1.5 shrink-0">
              {activePrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => send(prompt)}
                  className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-full px-3 py-1.5 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          {/* Input Area */}
          <div className="p-3 border-t border-gray-100 shrink-0">
            <div className={cn(
              "flex flex-col bg-gray-50 rounded-xl border border-gray-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all",
              isLoading ? "opacity-70 pointer-events-none" : ""
            )}>

              {/* Active Attachments Display (Capsules) */}
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 px-3 pt-3 pb-1">
                  {attachments.map((att) => (
                    <div
                      key={att.id}
                      className="flex items-center gap-1.5 text-xs bg-white border border-gray-200 text-gray-700 pl-2 pr-1 py-1 rounded-md shadow-sm"
                    >
                      <svg className="w-3.5 h-3.5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                      <span className="truncate max-w-[120px] font-medium">{att.name}</span>
                      <button
                        onClick={() => removeAttachment(att.id)}
                        className="text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md p-1 transition-colors"
                        title="Remove file"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Text Input Row */}
              <div className="flex gap-2 items-center px-3 py-2">
                <label className="w-5 h-5 text-gray-400 shrink-0 cursor-pointer flex items-center justify-center hover:text-gray-600 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-full h-full">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  <input
                    type="file"
                    className="hidden"
                    accept="application/pdf"
                    multiple // Allow multiple files
                    onChange={handleUpload}
                    disabled={isLoading}
                  />
                </label>

                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder={attachments.length > 0 ? "Add a message..." : "Ask about assessment design…"}
                  disabled={isLoading}
                  className="flex-1 bg-transparent text-sm text-gray-700 placeholder-gray-400 focus:outline-none disabled:opacity-50 min-w-0"
                />

                <button
                  onClick={() => send()}
                  disabled={(!input.trim() && attachments.length === 0) || isLoading}
                  className="w-8 h-8 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg flex items-center justify-center transition-all shrink-0"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body,
  );
}
"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Renders GitHub-flavored markdown with ContextOS styling (see .ctx-md in globals.css). */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="ctx-md">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}

import React, { useMemo } from 'react';
import katex from 'katex';

export default function MathText({ text }) {
  // DIAGNOSTIC LOG: This will print the exact string received from Supabase in your browser console (F12)
  console.log("RAW TEXT FROM DB:", text);

  const htmlContent = useMemo(() => {
    if (!text) return '';
    
    let processed = String(text);

    // Try parsing both single and double-escaped parentheses/brackets
    processed = processed
      .replace(/\\\\/g, '\\')
      .replace(/\\\[([\s\S]*?)\\\]/g, (m, f) => `$$${f.trim()}$$`)
      .replace(/\\\(([\s\S]*?)\\\)/g, (m, f) => `$${f.trim()}$`);

    // Render Block Display
    processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (match, formula) => {
      try {
        return katex.renderToString(formula.trim(), { displayMode: true, throwOnError: false });
      } catch (e) {
        return match;
      }
    });

    // Render Inline
    processed = processed.replace(/\$([^\$\n]+?)\$/g, (match, formula) => {
      try {
        return katex.renderToString(formula.trim(), { displayMode: false, throwOnError: false });
      } catch (e) {
        return match;
      }
    });

    return processed;
  }, [text]);

  return <span className="break-words" dangerouslySetInnerHTML={{ __html: htmlContent }} />;
}
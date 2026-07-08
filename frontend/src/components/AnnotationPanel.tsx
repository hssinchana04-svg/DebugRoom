import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Trash2, User } from 'lucide-react';

interface Annotation {
  id: string;
  filePath: string;
  lineNumber: number;
  content: string;
  createdAt: string;
  user: {
    id: string;
    username: string;
    isGuest: boolean;
  };
}

interface AnnotationPanelProps {
  annotations: Annotation[];
  selectedLine: number | null;
  currentFilePath: string;
  currentUserId: string;
  onAddAnnotation: (lineNumber: number, content: string) => void;
  onDeleteAnnotation: (id: string) => void;
}

export const AnnotationPanel: React.FC<AnnotationPanelProps> = ({
  annotations,
  selectedLine,
  currentFilePath,
  currentUserId,
  onAddAnnotation,
  onDeleteAnnotation
}) => {
  const [newComment, setNewComment] = useState('');
  const [lineInput, setLineInput] = useState('');

  const fileAnnotations = annotations
    .filter(a => a.filePath === currentFilePath)
    .sort((a, b) => a.lineNumber - b.lineNumber);

  const resolvedLine = selectedLine ?? (lineInput ? parseInt(lineInput, 10) : null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !resolvedLine || isNaN(resolvedLine) || resolvedLine < 1) return;
    onAddAnnotation(resolvedLine, newComment.trim());
    setNewComment('');
  };

  return (
    <div className="flex flex-col h-full bg-dark-900 border-l border-dark-800 w-72 flex-shrink-0">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-dark-800">
        <MessageSquare size={16} className="text-indigo-400" />
        <span className="text-sm font-semibold text-gray-200">Annotations</span>
        <span className="ml-auto text-xs text-gray-500 bg-dark-800 px-2 py-0.5 rounded-full">
          {fileAnnotations.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* All file annotations grouped by line */}
        {fileAnnotations.length === 0 && (
          <div className="text-center py-8 text-gray-500 text-sm">
            <MessageSquare size={32} className="mx-auto mb-2 opacity-30" />
            <p>No annotations yet.</p>
            <p className="text-xs mt-1">Click a line in the editor to add comments.</p>
          </div>
        )}

        {fileAnnotations.map(annotation => (
          <motion.div
            key={annotation.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className={`p-3 rounded-lg border text-sm transition-all ${
              selectedLine === annotation.lineNumber
                ? 'border-indigo-500/50 bg-indigo-500/10'
                : 'border-dark-700 bg-dark-800'
            }`}
          >
            {/* Line number badge */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/30">
                Line {annotation.lineNumber}
              </span>
              {annotation.user.id === currentUserId && (
                <button
                  onClick={() => onDeleteAnnotation(annotation.id)}
                  className="text-gray-600 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>

            {/* Author */}
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center">
                <User size={10} className="text-white" />
              </div>
              <span className="text-xs font-semibold text-gray-300">{annotation.user.username}</span>
              {annotation.user.isGuest && (
                <span className="text-xs text-gray-500">(guest)</span>
              )}
            </div>

            {/* Content */}
            <p className="text-gray-300 leading-relaxed">{annotation.content}</p>
            <p className="text-xs text-gray-600 mt-1.5">
              {new Date(annotation.createdAt).toLocaleTimeString()}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Add annotation form — always visible */}
      <form
        onSubmit={handleSubmit}
        className="p-3 border-t border-dark-800 bg-dark-950 flex-shrink-0"
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-gray-500">Comment on line</span>
          {selectedLine ? (
            <span className="font-mono text-xs text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/30">
              {selectedLine}
            </span>
          ) : (
            <input
              type="number"
              min={1}
              value={lineInput}
              onChange={e => setLineInput(e.target.value)}
              placeholder="#"
              className="w-16 bg-dark-800 border border-dark-700 rounded px-2 py-0.5 text-xs font-mono text-indigo-400 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          )}
        </div>
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder={resolvedLine ? `Comment on line ${resolvedLine}...` : 'Click a line in the editor first, or enter a line number above...'}
          rows={2}
          className="w-full bg-dark-800 border border-dark-700 rounded-lg text-sm text-gray-200 placeholder-gray-600 px-3 py-2 resize-none focus:outline-none focus:border-indigo-500 transition-colors"
        />
        <button
          type="submit"
          disabled={!newComment.trim() || !resolvedLine || isNaN(resolvedLine)}
          className="mt-2 w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold py-1.5 rounded-lg transition-colors"
        >
          Add Comment
        </button>
      </form>
    </div>
  );
};

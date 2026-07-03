import React, { useEffect, useRef, useState } from 'react';
import MonacoEditor, { Monaco } from '@monaco-editor/react';
import { Socket } from 'socket.io-client';

interface CodeEditorProps {
  socket: Socket | null;
  filePath: string;
  annotations: any[];
  onLineSelect: (lineNumber: number) => void;
  selectedLine: number | null;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  socket,
  filePath,
  annotations,
  onLineSelect,
  selectedLine
}) => {
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const isApplyingRemoteChangeRef = useRef<boolean>(false);
  const [editorValue, setEditorValue] = useState<string>('// Loading code...');

  // Map to track other users' decoration IDs: { userId: decorationIds[] }
  const remoteCursorsRef = useRef<Map<string, string[]>>(new Map());

  // Track current highlighted annotation lines decoration IDs
  const annotationDecorationsRef = useRef<string[]>([]);

  // Track current selected line decoration IDs
  const selectedLineDecorationsRef = useRef<string[]>([]);

  // Setup initial editor values when files are synced
  useEffect(() => {
    if (!socket) return;

    const handleSyncFiles = (files: any[]) => {
      const activeFile = files.find(f => f.filePath === filePath);
      if (activeFile) {
        setEditorValue(activeFile.content);
        if (editorRef.current) {
          editorRef.current.setValue(activeFile.content);
        }
      }
    };

    socket.on('editor:sync-files', handleSyncFiles);

    return () => {
      socket.off('editor:sync-files', handleSyncFiles);
    };
  }, [socket, filePath]);

  // Handle incoming editor change broadcasts
  useEffect(() => {
    if (!socket) return;

    const handleRemoteChange = (data: { filePath: string; changes: any; senderId: string }) => {
      if (data.filePath !== filePath) return;
      if (!editorRef.current) return;

      isApplyingRemoteChangeRef.current = true;
      const model = editorRef.current.getModel();

      if (model && monacoRef.current) {
        const monaco = monacoRef.current;
        // Format changes to Monaco range objects
        const edits = data.changes.map((c: any) => ({
          range: new monaco.Range(
            c.range.startLineNumber,
            c.range.startColumn,
            c.range.endLineNumber,
            c.range.endColumn
          ),
          text: c.text,
          forceMoveMarkers: true
        }));

        editorRef.current.executeEdits('remote-change', edits);
      }
      isApplyingRemoteChangeRef.current = false;
    };

    // Handle incoming remote cursors
    const handleRemoteCursor = (data: { filePath: string; userId: string; username: string; cursor: any }) => {
      if (data.filePath !== filePath || !editorRef.current || !monacoRef.current) return;

      const editor = editorRef.current;
      const monaco = monacoRef.current;
      const { userId, username, cursor } = data;

      // Clear previous cursor decorations for this user
      const oldDecorations = remoteCursorsRef.current.get(userId) || [];

      // Apply new cursor decorator
      const newDecorations = editor.deltaDecorations(oldDecorations, [
        {
          range: new monaco.Range(cursor.lineNumber, cursor.column, cursor.lineNumber, cursor.column),
          options: {
            className: 'remote-cursor-decorator',
            hoverMessage: { value: `**${username}** is typing here` },
            // Using beforeContentClassName can render custom user flag tag
            beforeContentClassName: 'remote-cursor-flag'
          }
        }
      ]);

      // Cache decoration IDs so we can remove them later
      remoteCursorsRef.current.set(userId, newDecorations);

      // Inject custom CSS to label the flag dynamically if needed (or rely on hoverMessage)
    };

    socket.on('editor:change', handleRemoteChange);
    socket.on('editor:cursor', handleRemoteCursor);

    return () => {
      socket.off('editor:change', handleRemoteChange);
      socket.off('editor:cursor', handleRemoteCursor);
    };
  }, [socket, filePath]);

  // Update annotation highlight decorations whenever annotations list changes
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return;

    const editor = editorRef.current;
    const monaco = monacoRef.current;

    // Filter annotations for current file
    const fileAnnotations = annotations.filter(a => a.filePath === filePath);

    const newDecorations = fileAnnotations.map(anno => ({
      range: new monaco.Range(anno.lineNumber, 1, anno.lineNumber, 1),
      options: {
        isWholeLine: true,
        className: 'annotated-line-highlight',
        marginClassName: 'annotated-line-gutter-marker',
        glyphMarginHoverMessage: { value: 'This line has comments' }
      }
    }));

    annotationDecorationsRef.current = editor.deltaDecorations(
      annotationDecorationsRef.current,
      newDecorations
    );
  }, [annotations, filePath]);

  // Highlight the user's currently selected line
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current || !selectedLine) return;

    const editor = editorRef.current;
    const monaco = monacoRef.current;

    const newDecorations = [
      {
        range: new monaco.Range(selectedLine, 1, selectedLine, 1),
        options: {
          isWholeLine: true,
          className: 'bg-indigo-500/10 border-l border-indigo-500'
        }
      }
    ];

    selectedLineDecorationsRef.current = editor.deltaDecorations(
      selectedLineDecorationsRef.current,
      newDecorations
    );
  }, [selectedLine]);

  // Handle local text edits
  const handleEditorChange = (value: string | undefined, ev: any) => {
    if (isApplyingRemoteChangeRef.current || !socket || !ev) return;

    // Stream changes to other users
    socket.emit('editor:change', {
      filePath,
      changes: ev.changes
    });

    // Also update periodic backup snapshots
    setEditorValue(value || '');
  };

  // Editor configuration on mount
  const handleEditorDidMount = (editor: any, monaco: Monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Enable custom style injections for cursors
    const styleNode = document.createElement('style');
    styleNode.id = 'remote-cursor-style';
    styleNode.innerHTML = `
      .remote-cursor-flag::before {
        content: "Collaborator";
      }
    `;
    document.head.appendChild(styleNode);

    // Listen to local cursor movement
    editor.onDidChangeCursorPosition((e: any) => {
      if (socket) {
        socket.emit('editor:cursor', {
          filePath,
          cursor: e.position
        });
      }
      onLineSelect(e.position.lineNumber);
    });

    // Initial setup request to load buffer
    if (socket) {
      socket.emit('room:request-sync-files');
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-dark-900 border border-dark-800 rounded-lg overflow-hidden">
      {/* Tab bar header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-dark-800 bg-dark-900 select-none">
        <div className="flex items-center gap-2">
          <span className="text-xs bg-indigo-500/20 text-indigo-400 font-mono px-2 py-0.5 rounded border border-indigo-500/30">JS</span>
          <span className="text-sm font-semibold text-gray-300 font-mono">{filePath}</span>
        </div>
        <div className="text-xs text-gray-500 font-mono">
          Click any line to view/add annotations
        </div>
      </div>

      {/* Monaco React Editor Wrapper */}
      <div className="flex-1 w-full overflow-hidden relative">
        <MonacoEditor
          height="100%"
          language="javascript"
          theme="vs-dark"
          value={editorValue}
          onChange={handleEditorChange}
          onMount={handleEditorDidMount}
          options={{
            fontSize: 14,
            fontFamily: 'JetBrains Mono, Menlo, Courier New, monospace',
            minimap: { enabled: false },
            lineHeight: 22,
            scrollbar: {
              verticalScrollbarSize: 10,
              horizontalScrollbarSize: 10
            },
            selectOnLineNumbers: true,
            cursorBlinking: 'smooth',
            smoothScrolling: true,
            padding: { top: 12, bottom: 12 },
            automaticLayout: true
          }}
        />
      </div>
    </div>
  );
};

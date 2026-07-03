import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, FastForward } from 'lucide-react';
import { Terminal as Xterm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import MonacoEditor from '@monaco-editor/react';
import 'xterm/css/xterm.css';

interface SessionEvent {
  id: string;
  type: string;
  data: any;
  timestamp: string;
  sequence: number;
}

interface ReplayPlayerProps {
  events: SessionEvent[];
  onClose: () => void;
}

const SPEEDS = [0.5, 1, 2, 4];

export const ReplayPlayer: React.FC<ReplayPlayerProps> = ({ events, onClose }) => {
  const termContainerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Xterm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const timeoutRefs = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [progress, setProgress] = useState(0);
  const [currentEventIdx, setCurrentEventIdx] = useState(0);
  const [editorContent, setEditorContent] = useState('// Session replay...');

  // Initialize terminal
  useEffect(() => {
    if (!termContainerRef.current) return;
    const term = new Xterm({
      cursorBlink: false,
      theme: {
        background: '#0b0f19',
        foreground: '#e5e7eb',
        cursor: '#06b6d4',
      },
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: 13,
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(termContainerRef.current);
    fitAddon.fit();
    term.write('\x1b[36m[Replay Mode] — Session recording\x1b[0m\r\n\r\n');
    termRef.current = term;
    fitAddonRef.current = fitAddon;

    return () => { term.dispose(); };
  }, []);

  // Clear all pending timers
  const clearTimers = () => {
    timeoutRefs.current.forEach(clearTimeout);
    timeoutRefs.current = [];
  };

  // Start replay from beginning
  const replay = () => {
    clearTimers();
    termRef.current?.clear();
    termRef.current?.write('\x1b[36m[Replay Mode] — Playing back session...\x1b[0m\r\n\r\n');
    setEditorContent('// Session replay...');
    setProgress(0);
    setCurrentEventIdx(0);
    setIsPlaying(true);

    if (events.length === 0) return;

    const startTimestamp = new Date(events[0].timestamp).getTime();

    events.forEach((event, idx) => {
      const eventTime = new Date(event.timestamp).getTime();
      const delay = (eventTime - startTimestamp) / speed;

      const t = setTimeout(() => {
        setCurrentEventIdx(idx);
        setProgress(Math.round(((idx + 1) / events.length) * 100));

        if (event.type === 'terminal_output') {
          termRef.current?.write(event.data.output);
        } else if (event.type === 'editor_change' && event.data.changes) {
          setEditorContent(prev => {
            // Simple replay: for demonstration, append change description
            return prev + '\n// [edit at ' + new Date(event.timestamp).toLocaleTimeString() + ']';
          });
        } else if (event.type === 'presence') {
          const txt = event.data.action === 'join'
            ? `\r\n\x1b[32m[+] ${event.data.username} joined the session\x1b[0m\r\n`
            : `\r\n\x1b[33m[-] ${event.data.username} left the session\x1b[0m\r\n`;
          termRef.current?.write(txt);
        }

        // Mark as done when last event replays
        if (idx === events.length - 1) {
          setIsPlaying(false);
          setProgress(100);
          termRef.current?.write('\r\n\x1b[36m[Replay complete]\x1b[0m\r\n');
        }
      }, delay);

      timeoutRefs.current.push(t);
    });
  };

  const handleStop = () => {
    clearTimers();
    setIsPlaying(false);
  };

  const cycleSpeed = () => {
    setSpeed(prev => {
      const idx = SPEEDS.indexOf(prev);
      return SPEEDS[(idx + 1) % SPEEDS.length];
    });
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
      <div className="w-full max-w-5xl bg-dark-900 rounded-2xl border border-dark-700 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center">
              <Play size={16} className="text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Session Replay</h2>
              <p className="text-xs text-gray-500">{events.length} recorded events</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors text-xl px-2"
          >✕</button>
        </div>

        {/* Replay Views */}
        <div className="flex-1 grid grid-cols-2 gap-0 overflow-hidden min-h-0">
          {/* Terminal replay */}
          <div className="border-r border-dark-800 flex flex-col">
            <div className="px-4 py-2 text-xs text-gray-500 border-b border-dark-800 font-mono">terminal output</div>
            <div className="flex-1 overflow-hidden" ref={termContainerRef} />
          </div>
          {/* Editor replay */}
          <div className="flex flex-col">
            <div className="px-4 py-2 text-xs text-gray-500 border-b border-dark-800 font-mono">code editor</div>
            <div className="flex-1">
              <MonacoEditor
                height="100%"
                language="javascript"
                theme="vs-dark"
                value={editorContent}
                options={{
                  readOnly: true,
                  fontSize: 13,
                  fontFamily: 'JetBrains Mono, monospace',
                  minimap: { enabled: false },
                  automaticLayout: true,
                }}
              />
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="px-6 py-4 border-t border-dark-800 bg-dark-950">
          {/* Progress bar */}
          <div className="w-full h-1.5 bg-dark-800 rounded-full mb-4 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-cyan-500 rounded-full transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {!isPlaying ? (
                <button
                  onClick={replay}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
                >
                  <Play size={14} />
                  {progress > 0 ? 'Replay Again' : 'Play'}
                </button>
              ) : (
                <button
                  onClick={handleStop}
                  className="flex items-center gap-2 bg-dark-700 hover:bg-dark-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
                >
                  <Pause size={14} />
                  Stop
                </button>
              )}

              <button
                onClick={replay}
                className="flex items-center gap-2 text-gray-400 hover:text-white text-sm px-3 py-2 rounded-lg hover:bg-dark-800 transition-colors"
              >
                <RotateCcw size={14} />
                Reset
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={cycleSpeed}
                className="flex items-center gap-2 text-gray-400 hover:text-cyan-400 text-sm px-3 py-2 rounded-lg hover:bg-dark-800 transition-colors"
              >
                <FastForward size={14} />
                {speed}x speed
              </button>

              <div className="text-xs text-gray-600 font-mono">
                Event {currentEventIdx + 1} / {events.length}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

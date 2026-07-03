import React, { useEffect, useRef } from 'react';
import { Terminal as Xterm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { Socket } from 'socket.io-client';

// We import the CSS locally
import 'xterm/css/xterm.css';

interface TerminalProps {
  socket: Socket | null;
}

export const Terminal: React.FC<TerminalProps> = ({ socket }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Xterm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize xterm.js instance
    const term = new Xterm({
      cursorBlink: true,
      theme: {
        background: '#0b0f19', // Dark charcoal/slate matching theme
        foreground: '#e5e7eb', // Slate-200
        cursor: '#06b6d4',     // Cyan cursor
        black: '#1f2937',
        red: '#ef4444',
        green: '#10b981',
        yellow: '#f59e0b',
        blue: '#3b82f6',
        magenta: '#8b5cf6',
        cyan: '#06b6d4',
        white: '#f3f4f6'
      },
      fontFamily: 'JetBrains Mono, Menlo, monospace',
      fontSize: 14,
      lineHeight: 1.2
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    fitAddon.fit();

    terminalRef.current = term;
    fitAddonRef.current = fitAddon;

    // Handle user keystrokes
    const onDataDisposable = term.onData((data) => {
      if (socket && socket.connected) {
        socket.emit('terminal:input', data);
      }
    });

    // Handle resize calculations
    const handleResize = () => {
      try {
        fitAddon.fit();
        if (socket && socket.connected) {
          socket.emit('terminal:resize', {
            cols: term.cols,
            rows: term.rows
          });
        }
      } catch (e) {
        // Ignore container dimensions error on display hide/show
      }
    };

    window.addEventListener('resize', handleResize);
    
    // Initial size emit
    setTimeout(() => {
      handleResize();
    }, 200);

    return () => {
      onDataDisposable.dispose();
      window.removeEventListener('resize', handleResize);
      term.dispose();
    };
  }, [socket]);

  // Handle incoming websocket terminal feeds
  useEffect(() => {
    if (!socket || !terminalRef.current) return;

    const handleTerminalOutput = (data: string) => {
      terminalRef.current?.write(data);
    };

    const handleSyncBuffer = (buffer: string) => {
      terminalRef.current?.clear();
      terminalRef.current?.write(buffer);
    };

    socket.on('terminal:output', handleTerminalOutput);
    socket.on('terminal:sync-buffer', handleSyncBuffer);

    // Request full output refresh if socket reconnected
    socket.emit('terminal:request-sync');

    return () => {
      socket.off('terminal:output', handleTerminalOutput);
      socket.off('terminal:sync-buffer', handleSyncBuffer);
    };
  }, [socket]);

  return (
    <div className="w-full h-full flex flex-col bg-dark-950 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-dark-800 bg-dark-900 select-none">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-500"></span>
          <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
          <span className="w-3 h-3 rounded-full bg-green-500"></span>
          <span className="text-xs text-gray-400 font-semibold ml-2 font-mono">terminal - live bash / powershell</span>
        </div>
      </div>
      <div className="flex-1 w-full overflow-hidden relative" ref={containerRef}></div>
    </div>
  );
};

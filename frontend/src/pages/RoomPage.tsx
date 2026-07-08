import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { io, Socket } from 'socket.io-client';
import {
  Terminal as TerminalIcon, Code2, Users, MessageSquare,
  Copy, Check, Play, Zap, LogOut
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Terminal } from '../components/Terminal';
import { CodeEditor } from '../components/CodeEditor';
import { AnnotationPanel } from '../components/AnnotationPanel';
import { ParticipantsPanel } from '../components/ParticipantsPanel';
import { ReplayPlayer } from '../components/ReplayPlayer';
import { API_BASE, SOCKET_URL } from '../lib/config';

type PanelType = 'participants' | 'annotations' | null;

export const RoomPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, token, logout } = useAuth();

  const socketRef = useRef<Socket | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [roomInfo, setRoomInfo] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [annotations, setAnnotations] = useState<any[]>([]);
  const [activePanel, setActivePanel] = useState<PanelType>(null);
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [showReplay, setShowReplay] = useState(false);
  const [replayEvents, setReplayEvents] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'editor' | 'terminal'>('editor');
  const [error, setError] = useState('');

  // Auto-login as guest if not authenticated
  const ensureAuth = useCallback(async () => {
    if (user && token) return token;
    try {
      const res = await fetch(`${API_BASE}/api/auth/guest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (data.token) {
        localStorage.setItem('debugroom_token', data.token);
        localStorage.setItem('debugroom_user', JSON.stringify(data.user));
        return data.token;
      }
    } catch {}
    return null;
  }, [user, token]);

  // Initialize socket and load room
  useEffect(() => {
    if (!slug) return;

    const init = async () => {
      const authToken = await ensureAuth();
      if (!authToken) {
        setError('Failed to authenticate');
        return;
      }

      // Load room info
      try {
        const res = await fetch(`${API_BASE}/api/rooms/${slug}`, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        if (!res.ok) {
          setError('Room not found');
          return;
        }
        const data = await res.json();
        setRoomInfo(data);
      } catch {
        setError('Failed to load room');
        return;
      }

      // Load initial annotations
      try {
        const res = await fetch(`${API_BASE}/api/annotations/${slug}`, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        const data = await res.json();
        if (Array.isArray(data)) setAnnotations(data);
      } catch {}

      // Connect WebSocket
      const s = io(SOCKET_URL, {
        auth: { token: authToken },
        transports: ['websocket', 'polling']
      });

      s.on('connect', () => {
        setConnected(true);
        s.emit('room:join', { slug });
      });

      s.on('disconnect', () => setConnected(false));

      s.on('room:participants-update', (list: any[]) => {
        setParticipants(list);
      });

      s.on('annotation:create', (annotation: any) => {
        setAnnotations(prev => [...prev, annotation]);
      });

      s.on('annotation:delete', ({ id }: { id: string }) => {
        setAnnotations(prev => prev.filter(a => a.id !== id));
      });

      s.on('error', (msg: string) => {
        setError(msg);
      });

      socketRef.current = s;
      setSocket(s);
    };

    init();

    return () => {
      socketRef.current?.disconnect();
    };
  }, [slug, ensureAuth]);

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddAnnotation = async (lineNumber: number, content: string) => {
    const authToken = localStorage.getItem('debugroom_token');
    try {
      const res = await fetch(`${API_BASE}/api/annotations/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ filePath: 'index.js', lineNumber, content })
      });
      const data = await res.json();
      if (res.ok) {
        setAnnotations(prev => [...prev, data]);
        socketRef.current?.emit('annotation:create', data);
      } else {
        console.error('Failed to add annotation:', data.error);
        setError(data.error || 'Failed to add annotation');
        setTimeout(() => setError(''), 4000);
      }
    } catch (err) {
      console.error('Annotation fetch error:', err);
      setError('Network error — could not save annotation');
      setTimeout(() => setError(''), 4000);
    }
  };

  const handleDeleteAnnotation = async (id: string) => {
    const authToken = localStorage.getItem('debugroom_token');
    try {
      const res = await fetch(`${API_BASE}/api/annotations/${slug}/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.ok) {
        setAnnotations(prev => prev.filter(a => a.id !== id));
        socket?.emit('annotation:delete', { id });
      }
    } catch {}
  };

  const openReplay = async () => {
    const authToken = localStorage.getItem('debugroom_token');
    try {
      const res = await fetch(`${API_BASE}/api/recordings/${slug}/events`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const events = await res.json();
      setReplayEvents(Array.isArray(events) ? events : []);
      setShowReplay(true);
    } catch {}
  };

  const currentUserId = user?.id || JSON.parse(localStorage.getItem('debugroom_user') || '{}')?.id || '';

  if (error) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center text-center p-6">
        <div>
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-white mb-2">{error}</h1>
          <p className="text-gray-400 mb-6">Check the room code and try again.</p>
          <button
            onClick={() => navigate('/')}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-dark-950 overflow-hidden font-sans">
      {/* Top Navbar */}
      <header className="flex items-center justify-between px-4 py-2.5 bg-dark-900 border-b border-dark-800 z-20 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center shadow-md shadow-indigo-500/30">
            <Zap size={15} className="text-white" />
          </div>
          <span className="font-bold text-sm text-white">DebugRoom</span>
          <span className="text-dark-700 text-lg">/</span>
          <span className="text-sm text-gray-300 font-semibold">{roomInfo?.name || '...'}</span>

          {/* Connection status */}
          <div className="flex items-center gap-1.5 ml-2">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />
            <span className="text-xs text-gray-500">{connected ? 'Connected' : 'Connecting...'}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Replay button */}
          <button
            onClick={openReplay}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-violet-400 hover:bg-violet-500/10 px-3 py-1.5 rounded-lg transition-all border border-transparent hover:border-violet-500/20"
          >
            <Play size={13} />
            Replay
          </button>

          {/* Copy Link */}
          <button
            onClick={copyLink}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-cyan-400 hover:bg-cyan-500/10 px-3 py-1.5 rounded-lg transition-all border border-transparent hover:border-cyan-500/20"
          >
            {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            {copied ? 'Copied!' : `Share · ${slug}`}
          </button>

          {/* Participants toggle */}
          <button
            onClick={() => setActivePanel(p => p === 'participants' ? null : 'participants')}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all border ${
              activePanel === 'participants'
                ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                : 'text-gray-400 hover:text-white border-transparent hover:bg-dark-800'
            }`}
          >
            <Users size={13} />
            {participants.length}
          </button>

          {/* Annotations toggle */}
          <button
            onClick={() => setActivePanel(p => p === 'annotations' ? null : 'annotations')}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all border ${
              activePanel === 'annotations'
                ? 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20'
                : 'text-gray-400 hover:text-white border-transparent hover:bg-dark-800'
            }`}
          >
            <MessageSquare size={13} />
            {annotations.length}
          </button>

          {/* Leave Room */}
          <button
            onClick={() => navigate('/')}
            title="Leave Room"
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-orange-400 hover:bg-orange-500/10 px-3 py-1.5 rounded-lg transition-all border border-transparent hover:border-orange-500/20"
          >
            <LogOut size={13} />
            Leave
          </button>

          {/* Logout */}
          <button
            onClick={() => { logout(); navigate('/login'); }}
            title="Logout"
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-400 hover:bg-red-500/10 px-3 py-1.5 rounded-lg transition-all border border-transparent hover:border-red-500/20"
          >
            <LogOut size={13} />
            Logout
          </button>
        </div>
      </header>

      {/* Main workspace */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left sidebar (participants when open) */}
        <AnimatePresence>
          {activePanel === 'participants' && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 240, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="border-r border-dark-800 overflow-hidden flex-shrink-0 bg-dark-900"
            >
              <ParticipantsPanel
                participants={participants}
                hostId={roomInfo?.hostId}
                currentUserId={currentUserId}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Center: Editor + Terminal */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* Tab bar for mobile/small screens */}
          <div className="flex md:hidden border-b border-dark-800 bg-dark-900">
            <button
              onClick={() => setActiveTab('editor')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors ${
                activeTab === 'editor' ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-gray-500'
              }`}
            >
              <Code2 size={14} />Editor
            </button>
            <button
              onClick={() => setActiveTab('terminal')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors ${
                activeTab === 'terminal' ? 'text-cyan-400 border-b-2 border-cyan-500' : 'text-gray-500'
              }`}
            >
              <TerminalIcon size={14} />Terminal
            </button>
          </div>

          {/* Desktop: Side-by-side split */}
          <div className="flex-1 min-h-0 grid md:grid-cols-2 grid-cols-1">
            {/* Editor pane */}
            <div className={`min-h-0 overflow-hidden ${activeTab === 'terminal' ? 'hidden md:flex' : 'flex'} flex-col`}>
              <CodeEditor
                socket={socket}
                filePath="index.js"
                annotations={annotations}
                onLineSelect={setSelectedLine}
                selectedLine={selectedLine}
              />
            </div>

            {/* Terminal pane */}
            <div className={`min-h-0 overflow-hidden border-l border-dark-800 ${activeTab === 'editor' ? 'hidden md:flex' : 'flex'} flex-col`}>
              <Terminal socket={socket} />
            </div>
          </div>
        </div>

        {/* Right sidebar: Annotations */}
        <AnimatePresence>
          {activePanel === 'annotations' && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 288, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="border-l border-dark-800 overflow-hidden flex-shrink-0"
            >
              <AnnotationPanel
                annotations={annotations}
                selectedLine={selectedLine}
                currentFilePath="index.js"
                currentUserId={currentUserId}
                onAddAnnotation={handleAddAnnotation}
                onDeleteAnnotation={handleDeleteAnnotation}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Session Replay Modal */}
      <AnimatePresence>
        {showReplay && (
          <ReplayPlayer
            events={replayEvents}
            onClose={() => setShowReplay(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Terminal, Code2, Users, Play, Zap, ArrowRight, Github, Link2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../lib/config';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, login, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  const [roomName, setRoomName] = useState('');
  const [joinSlug, setJoinSlug] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const ensureGuest = async () => {
    if (user) return true;
    try {
      const res = await fetch(`${API_BASE}/api/auth/guest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (data.token) {
        login(data.token, data.user);
        return true;
      }
    } catch {}
    return false;
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomName.trim()) return;
    setLoading(true);
    setError('');
    try {
      const ok = await ensureGuest();
      if (!ok) throw new Error('Auth failed');
      const token = localStorage.getItem('debugroom_token');
      const res = await fetch(`${API_BASE}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: roomName.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create room');
      navigate(`/room/${data.slug}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinSlug.trim()) return;
    setLoading(true);
    setError('');
    try {
      const ok = await ensureGuest();
      if (!ok) throw new Error('Auth failed');
      navigate(`/room/${joinSlug.trim()}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { icon: Terminal, title: 'Shared Live Terminal', desc: 'Real commands running on the server, streamed to everyone in the room instantly via PTY + WebSockets.', color: 'from-cyan-500 to-blue-600' },
    { icon: Code2, title: 'Collaborative Monaco Editor', desc: 'The same editor as VS Code, synced live across all participants. See each other\'s cursors in real time.', color: 'from-violet-500 to-purple-600' },
    { icon: Play, title: 'Session Replay', desc: 'Every keystroke and terminal output recorded. Replay the entire debugging session like a video.', color: 'from-pink-500 to-rose-600' },
    { icon: Users, title: 'Instant Room Sharing', desc: 'Generate a link, share it, friend joins instantly. No signup needed to join a session.', color: 'from-emerald-500 to-teal-600' },
  ];

  return (
    <div className="min-h-screen bg-dark-950 text-gray-100 font-sans overflow-x-hidden">
      {/* Ambient Background Blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-cyan-600/10 rounded-full blur-3xl" />
      </div>

      {/* Navbar */}
      <nav className="relative z-10 flex items-center justify-between px-6 md:px-12 py-5 border-b border-white/5 backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Zap size={18} className="text-white" />
          </div>
          <span className="text-lg font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
            DebugRoom
          </span>
        </div>
        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-400">
                Signed in as <span className="text-indigo-400 font-semibold">{user.username}</span>
              </span>
              <button
                id="logout-btn"
                onClick={handleLogout}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-400 bg-transparent hover:bg-red-500/10 border border-transparent hover:border-red-500/20 px-3 py-1.5 rounded-lg transition-all"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                Logout
              </button>
            </div>
          ) : (
            <button
              onClick={() => navigate('/login')}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Sign in
            </button>
          )}
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all"
          >
            <Github size={18} />
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 pt-20 pb-16 px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold px-4 py-1.5 rounded-full mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            Real-time collaborative debugging platform
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold leading-tight mb-6">
            Debug Together,{' '}
            <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent">
              Ship Faster
            </span>
          </h1>
          <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed mb-12">
            Share a live terminal, co-edit code in Monaco, and replay entire debugging sessions.
            Built for developers who debug together.
          </p>
        </motion.div>

        {/* Room Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-stretch max-w-2xl mx-auto"
        >
          {/* Create Room */}
          <form onSubmit={handleCreateRoom} className="flex-1 flex gap-2">
            <input
              type="text"
              value={roomName}
              onChange={e => setRoomName(e.target.value)}
              placeholder="Room name..."
              className="flex-1 bg-dark-800 border border-dark-700 focus:border-indigo-500 rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-600 outline-none transition-colors min-w-0"
            />
            <button
              type="submit"
              disabled={loading || !roomName.trim()}
              className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 text-white font-semibold text-sm px-5 py-3 rounded-xl transition-all shadow-lg shadow-indigo-500/20 whitespace-nowrap"
            >
              <Zap size={16} />
              Create Room
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center text-gray-600 text-sm font-medium">or</div>

          {/* Join Room */}
          <form onSubmit={handleJoinRoom} className="flex-1 flex gap-2">
            <input
              type="text"
              value={joinSlug}
              onChange={e => setJoinSlug(e.target.value)}
              placeholder="Room code..."
              className="flex-1 bg-dark-800 border border-dark-700 focus:border-cyan-500 rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-600 outline-none transition-colors min-w-0 font-mono"
            />
            <button
              type="submit"
              disabled={loading || !joinSlug.trim()}
              className="flex items-center gap-2 bg-dark-700 hover:bg-dark-600 border border-dark-600 hover:border-cyan-500/50 disabled:opacity-50 text-white font-semibold text-sm px-5 py-3 rounded-xl transition-all whitespace-nowrap"
            >
              <Link2 size={16} />
              Join
            </button>
          </form>
        </motion.div>

        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 text-red-400 text-sm"
          >
            {error}
          </motion.p>
        )}

        {/* Terminal Preview */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-16 max-w-3xl mx-auto rounded-2xl border border-dark-700 overflow-hidden shadow-2xl shadow-black/50"
        >
          <div className="flex items-center gap-2 px-4 py-3 bg-dark-900 border-b border-dark-800">
            <span className="w-3 h-3 rounded-full bg-red-500" />
            <span className="w-3 h-3 rounded-full bg-yellow-500" />
            <span className="w-3 h-3 rounded-full bg-green-500" />
            <span className="ml-3 text-xs text-gray-500 font-mono">debugroom — shared terminal</span>
            <div className="ml-auto flex gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-emerald-400">3 online</span>
            </div>
          </div>
          <div className="bg-dark-950 p-5 font-mono text-sm text-left">
            <div className="text-emerald-400">$ <span className="text-gray-300">git clone https://github.com/team/buggy-service.git</span></div>
            <div className="text-gray-500 mt-1">Cloning into 'buggy-service'...</div>
            <div className="text-gray-500">remote: Counting objects: 847, done.</div>
            <div className="text-emerald-400 mt-1">$ <span className="text-gray-300">cd buggy-service && npm install</span></div>
            <div className="text-gray-500 mt-1">added 312 packages in 4.2s</div>
            <div className="text-emerald-400 mt-1">$ <span className="text-gray-300">node --inspect src/index.js</span></div>
            <div className="text-cyan-400 mt-1">Debugger listening on ws://127.0.0.1:9229</div>
            <div className="text-red-400">TypeError: Cannot read properties of undefined (reading 'userId')</div>
            <div className="text-gray-500">    at getUserData (/src/routes/users.js:42:18)</div>
            <div className="flex items-center mt-2">
              <span className="text-emerald-400">$</span>
              <span className="ml-1 w-2 h-4 bg-cyan-400 animate-pulse" />
            </div>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="relative z-10 py-20 px-6 max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Everything you need to debug together</h2>
          <p className="text-gray-400 text-lg">A complete collaborative debugging environment in your browser.</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="group p-6 rounded-2xl bg-dark-900 border border-dark-800 hover:border-dark-600 transition-all hover:shadow-xl hover:shadow-black/30"
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform`}>
                <f.icon size={24} className="text-white" />
              </div>
              <h3 className="text-lg font-bold text-gray-100 mb-2">{f.title}</h3>
              <p className="text-gray-400 leading-relaxed text-sm">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 py-20 px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto bg-gradient-to-br from-indigo-600/20 to-cyan-600/20 border border-indigo-500/20 rounded-3xl p-12"
        >
          <h2 className="text-3xl font-bold mb-4">Ready to debug together?</h2>
          <p className="text-gray-400 mb-8">Create a room in seconds. No account required to join.</p>
          <button
            onClick={() => document.querySelector('input')?.focus()}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold px-8 py-4 rounded-2xl transition-all shadow-xl shadow-indigo-500/30 text-lg"
          >
            Get Started Free
            <ArrowRight size={20} />
          </button>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-dark-800 py-8 px-6 text-center text-gray-600 text-sm">
        <p>Built by developers, for developers · DebugRoom 2026</p>
      </footer>
    </div>
  );
};

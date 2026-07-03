import React from 'react';
import { motion } from 'framer-motion';
import { Users, Circle, Crown } from 'lucide-react';

interface Participant {
  userId: string;
  username: string;
  isGuest: boolean;
  joinedAt: string;
}

interface ParticipantsPanelProps {
  participants: Participant[];
  hostId?: string;
  currentUserId: string;
}

// Generate a consistent color for each user based on their ID
function getUserColor(userId: string): string {
  const colors = [
    'from-violet-500 to-purple-600',
    'from-cyan-500 to-blue-600',
    'from-pink-500 to-rose-600',
    'from-emerald-500 to-teal-600',
    'from-amber-500 to-orange-600',
    'from-indigo-500 to-blue-600',
  ];
  const idx = userId.charCodeAt(0) % colors.length;
  return colors[idx];
}

export const ParticipantsPanel: React.FC<ParticipantsPanelProps> = ({
  participants,
  hostId,
  currentUserId
}) => {
  return (
    <div className="p-3 space-y-1">
      <div className="flex items-center gap-2 px-1 mb-3">
        <Users size={14} className="text-gray-400" />
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Online · {participants.length}
        </span>
      </div>

      {participants.map((p, i) => (
        <motion.div
          key={p.userId}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.05 }}
          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors ${
            p.userId === currentUserId ? 'bg-indigo-500/10 border border-indigo-500/20' : 'hover:bg-dark-800'
          }`}
        >
          {/* Avatar */}
          <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${getUserColor(p.userId)} flex items-center justify-center flex-shrink-0 text-white text-xs font-bold shadow-md`}>
            {p.username.charAt(0).toUpperCase()}
          </div>

          {/* Name + badges */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-gray-200 font-medium truncate">
                {p.username}
                {p.userId === currentUserId && (
                  <span className="text-gray-500 text-xs ml-1">(you)</span>
                )}
              </span>
              {p.userId === hostId && (
                <Crown size={11} className="text-amber-400 flex-shrink-0" />
              )}
            </div>
            {p.isGuest && (
              <span className="text-xs text-gray-600">Guest</span>
            )}
          </div>

          {/* Online indicator */}
          <Circle size={8} className="text-emerald-400 fill-emerald-400 flex-shrink-0" />
        </motion.div>
      ))}

      {participants.length === 0 && (
        <div className="text-center py-4 text-gray-600 text-xs">
          No one else is here yet
        </div>
      )}
    </div>
  );
};

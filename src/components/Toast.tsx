import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle, XCircle, X, AlertCircle } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning';
  text: string;
}

interface ToastProps {
  messages: ToastMessage[];
  onRemove: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ messages, onRemove }) => {
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      <AnimatePresence>
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg min-w-[250px] ${
              msg.type === 'success' ? 'bg-green-600 text-white' : 
              msg.type === 'error' ? 'bg-red-600 text-white' : 'bg-orange-500 text-white'
            }`}
          >
            {msg.type === 'success' ? <CheckCircle size={20} /> : 
             msg.type === 'error' ? <XCircle size={20} /> : <AlertCircle size={20} />}
            <span className="flex-1 text-sm font-medium">{msg.text}</span>
            <button onClick={() => onRemove(msg.id)} className="hover:opacity-70">
              <X size={16} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

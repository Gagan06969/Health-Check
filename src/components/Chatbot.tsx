import { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Sparkles, User, Bot, Loader2 } from 'lucide-react';
import { api } from '../utils/api';
import './Chatbot.css';

export const Chatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([
    { role: 'assistant', content: "Hi! I'm your AI Nutritionist. Ask me anything about food, calories, or your health goals!" }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);

    try {
      const data = await api.chat(userMsg);
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I'm having trouble connecting to my brain right now." }]);
    }
    setIsLoading(false);
  };

  return (
    <div className="chatbot-root">
      {/* Floating Button */}
      <button 
        className={`chatbot-toggle ${isOpen ? 'hidden' : ''}`}
        onClick={() => setIsOpen(true)}
      >
        <MessageSquare size={28} color="white" />
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="chat-window">
          {/* Header */}
          <div className="chat-header">
            <div className="bot-info">
              <div className="bot-icon-wrapper">
                <Sparkles size={20} />
              </div>
              <div className="bot-status">
                <div className="bot-name">AI Nutritionist</div>
                <div className="status-indicator">
                  <span className="status-dot"></span>
                  Online & Learning
                </div>
              </div>
            </div>
            <button className="close-btn" onClick={() => setIsOpen(false)}>
              <X size={20} />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="messages-area">
            {messages.map((msg, i) => (
              <div key={i} className={`message-row ${msg.role === 'user' ? 'user' : 'bot'}`}>
                <div className="message-bubble-group">
                  <div className={`avatar ${msg.role === 'user' ? 'user' : 'bot'}`}>
                    {msg.role === 'user' ? <User size={18} color="white" /> : <Bot size={18} color="white" />}
                  </div>
                  <div className="message-text">
                    {msg.content}
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="message-row bot">
                <div className="message-bubble-group">
                  <div className="avatar bot">
                    <Bot size={18} color="white" />
                  </div>
                  <div className="message-text thinking-bubble">
                    <Loader2 size={16} className="animate-spin text-primary" />
                    <span>Thinking...</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="chat-input-area">
            <div className="input-container">
              <input 
                type="text" 
                className="chat-input" 
                placeholder="Ask me anything..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
              />
              <button 
                className="chat-send-btn"
                onClick={handleSend}
                disabled={!input.trim()}
              >
                <Send size={18} />
              </button>
            </div>
            <div className="chat-footer-note">
              Powered by Gemini AI • Concisely expert
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


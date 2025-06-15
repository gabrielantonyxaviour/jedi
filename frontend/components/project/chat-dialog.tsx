"use client";

import { useState, useRef, useEffect } from "react";
import { Send, User, Bot } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Message {
  id: string;
  text: string;
  sender: "user" | "ai";
  timestamp: Date;
}

const agents = [
  { id: "github", name: "GitHub" },
  { id: "socials", name: "Socials" },
  { id: "leads", name: "Leads" },
  { id: "compliance", name: "Compliance" },
  { id: "ip", name: "IP" },
  { id: "karma", name: "Karma" },
  { id: "orchestrator", name: "Orchestrator" },
];

const getAgentDisplayName = (
  agentId: string,
  side: "light" | "dark" | null
) => {
  const nameMap = {
    light: {
      github: "C-3PO",
      socials: "Ahsoka Tano",
      leads: "Chewbacca",
      compliance: "Princess Leia Organa",
      ip: "Obi-Wan Kenobi",
      karma: "Luke Skywalker",
      orchestrator: "Yoda",
    },
    dark: {
      github: "General Grievous",
      socials: "Savage Opress",
      leads: "Count Dooku",
      compliance: "Darth Maul",
      ip: "Kylo Ren",
      karma: "Darth Vader",
      orchestrator: "Emperor Palpatine",
    },
  };

  if (side && nameMap[side][agentId as keyof typeof nameMap.light]) {
    return nameMap[side][agentId as keyof typeof nameMap.light];
  }
  return agents.find((a) => a.id === agentId)?.name || agentId;
};

interface ChatDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userSide: "light" | "dark" | null;
}

export default function ChatDialog({
  isOpen,
  onClose,
  userSide,
}: ChatDialogProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      text:
        userSide === "light"
          ? "Help you, I will. What seek you, young one?"
          : "Your commands, I await. Speak, and power shall be yours.",
      sender: "ai",
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = () => {
    if (!inputText.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, newMessage]);
    setInputText("");
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: "I understand your request. Let me help you with that.",
        sender: "ai",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiResponse]);
      setIsTyping(false);
    }, 1500);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl h-[600px] p-0 flex flex-col bg-stone-800/95 backdrop-blur-sm border border-stone-600/30 text-stone-100">
        <DialogHeader className="px-4 py-3 border-b border-stone-700 bg-stone-800/50">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-3">
              <img
                src={`/agents/${userSide}/orchestrator.png`}
                alt="Orchestrator"
                className="w-8 h-8 rounded-full object-cover"
              />
              <div>
                <span className="text-lg">
                  {getAgentDisplayName("orchestrator", userSide)}
                </span>
                <p className="text-xs text-stone-400 font-normal">
                  Orchestrator Agent
                </p>
              </div>
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-stone-800/50">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex items-start space-x-3 ${
                message.sender === "user"
                  ? "flex-row-reverse space-x-reverse"
                  : ""
              }`}
            >
              <div
                className={`p-2 rounded-full flex-shrink-0 ${
                  message.sender === "user"
                    ? "bg-stone-700"
                    : userSide === "light"
                    ? "bg-blue-900/30"
                    : userSide === "dark"
                    ? "bg-red-900/30"
                    : "bg-stone-800"
                }`}
              >
                {message.sender === "user" ? (
                  <User className="w-4 h-4 text-stone-400" />
                ) : (
                  <img
                    src={`/agents/${userSide}/orchestrator.png`}
                    alt="Orchestrator"
                    className="w-10 h-10 rounded-full object-cover"
                  />
                )}
              </div>

              <div
                className={`max-w-[70%] p-3 rounded-lg ${
                  message.sender === "user"
                    ? userSide === "light"
                      ? "bg-blue-600 text-white"
                      : userSide === "dark"
                      ? "bg-red-600 text-white"
                      : "bg-stone-600 text-white"
                    : "bg-stone-800 text-stone-100"
                }`}
              >
                <p className="text-sm">{message.text}</p>
                <p className="text-xs opacity-70 mt-1">
                  {message.timestamp.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex items-start space-x-3">
              <div
                className={`p-2 rounded-full flex-shrink-0 ${
                  userSide === "light"
                    ? "bg-blue-900/30"
                    : userSide === "dark"
                    ? "bg-red-900/30"
                    : "bg-stone-800"
                }`}
              >
                <Bot
                  className={`w-4 h-4 ${
                    userSide === "light"
                      ? "text-blue-400"
                      : userSide === "dark"
                      ? "text-red-400"
                      : "text-stone-400"
                  }`}
                />
              </div>
              <div className="bg-stone-800 text-stone-100 p-3 rounded-lg">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-stone-400 rounded-full animate-bounce" />
                  <div
                    className="w-2 h-2 bg-stone-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0.1s" }}
                  />
                  <div
                    className="w-2 h-2 bg-stone-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t border-stone-700 bg-stone-800/30">
          <div className="flex space-x-2 ">
            <Input
              ref={inputRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={
                userSide === "light"
                  ? "Share your thoughts, you must..."
                  : "Command me, Master..."
              }
              className="placeholder:text-stone-500 bg-stone-700 focus-visible:ring-0 focus-visible:ring-offset-0 border-none"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!inputText.trim()}
              variant={
                userSide === "light"
                  ? "default"
                  : userSide === "dark"
                  ? "destructive"
                  : "secondary"
              }
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

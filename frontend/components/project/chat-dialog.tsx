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
      text: "Hello! I'm your AI assistant. How can I help you today?",
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
      <DialogContent className="max-w-2xl h-[600px] p-0 flex flex-col">
        <DialogHeader className="px-4 py-3 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Bot
                className={`w-5 h-5 ${
                  userSide === "light"
                    ? "text-blue-400"
                    : userSide === "dark"
                    ? "text-red-400"
                    : "text-gray-400"
                }`}
              />
              <span>AI Assistant</span>
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
                    ? "bg-gray-700"
                    : userSide === "light"
                    ? "bg-blue-900/30"
                    : userSide === "dark"
                    ? "bg-red-900/30"
                    : "bg-gray-800"
                }`}
              >
                {message.sender === "user" ? (
                  <User className="w-4 h-4 text-gray-400" />
                ) : (
                  <Bot
                    className={`w-4 h-4 ${
                      userSide === "light"
                        ? "text-blue-400"
                        : userSide === "dark"
                        ? "text-red-400"
                        : "text-gray-400"
                    }`}
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
                      : "bg-gray-600 text-white"
                    : "bg-gray-800 text-gray-100"
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
                    : "bg-gray-800"
                }`}
              >
                <Bot
                  className={`w-4 h-4 ${
                    userSide === "light"
                      ? "text-blue-400"
                      : userSide === "dark"
                      ? "text-red-400"
                      : "text-gray-400"
                  }`}
                />
              </div>
              <div className="bg-gray-800 text-gray-100 p-3 rounded-lg">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                  <div
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0.1s" }}
                  />
                  <div
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t">
          <div className="flex space-x-2">
            <Input
              ref={inputRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
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

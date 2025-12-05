"use client"

import { useEffect, useRef } from "react"
import type { Message } from "./chatbot-container"

interface ChatMessagesProps {
  messages: Message[]
}

export function ChatMessages({ messages }: ChatMessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  return (
    <div
      className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4"
      role="log"
      aria-label="Conversation history"
      aria-live="polite"
    >
      {messages.map((message) => (
        <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
          <div
            className={`max-w-[85%] md:max-w-[75%] rounded-2xl px-4 py-3 ${
              message.role === "user"
                ? "bg-chat-user-bg text-foreground rounded-br-md"
                : "bg-chat-bot-bg border border-border text-foreground rounded-bl-md shadow-sm"
            }`}
            role="article"
            aria-label={`${message.role === "user" ? "You" : "Assistant"} said`}
          >
            <p className="leading-relaxed">{message.content}</p>
            <time className="block text-xs text-muted-foreground mt-2" dateTime={message.timestamp.toISOString()}>
              {message.timestamp.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </time>
          </div>
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  )
}

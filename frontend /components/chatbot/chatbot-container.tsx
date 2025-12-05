"use client"

import { useState, useCallback } from "react"
import { Header } from "./header"
import { ChatMessages } from "./chat-messages"
import { ControlPanel } from "./control-panel"
import { TalkingAvatar } from "./talking-avatar"
import { AccessibilityPanel } from "./accessibility-panel"

export type AudioState = "idle" | "listening" | "speaking" | "connecting"

export interface Message {
  id: string
  role: "user" | "bot"
  content: string
  timestamp: Date
}

export function ChatbotContainer() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "bot",
      content:
        "Hello! I'm your Government Services Assistant. How can I help you today? You can speak to me by pressing the large button below, or type your question in the text box.",
      timestamp: new Date(),
    },
  ])
  const [audioState, setAudioState] = useState<AudioState>("idle")
  const [showAccessibility, setShowAccessibility] = useState(false)
  const [textSize, setTextSize] = useState<"normal" | "large" | "xlarge">("normal")
  const [speechRate, setSpeechRate] = useState(1)

  const addMessage = useCallback((role: "user" | "bot", content: string) => {
    const newMessage: Message = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role,
      content,
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, newMessage])
    return newMessage
  }, [])

  const handleVoiceToggle = useCallback(() => {
    if (audioState === "idle") {
      setAudioState("listening")
      // Simulated voice interaction
      setTimeout(() => {
        addMessage("user", "I need help with my passport application")
        setAudioState("speaking")
        setTimeout(() => {
          addMessage(
            "bot",
            "I can help you with your passport application. You can apply for a new passport, renew an existing one, or check your application status. Which service would you like to use?",
          )
          setAudioState("idle")
        }, 2000)
      }, 3000)
    } else {
      setAudioState("idle")
    }
  }, [audioState, addMessage])

  const handleTextSubmit = useCallback(
    (text: string) => {
      if (!text.trim()) return
      addMessage("user", text)
      setAudioState("speaking")
      setTimeout(() => {
        addMessage(
          "bot",
          "Thank you for your message. I'm processing your request. How else can I assist you with government services today?",
        )
        setAudioState("idle")
      }, 1500)
    },
    [addMessage],
  )

  const textSizeClass = textSize === "large" ? "text-lg" : textSize === "xlarge" ? "text-xl" : "text-base"

  return (
    <div className={`flex flex-col h-screen max-w-4xl mx-auto bg-card shadow-xl ${textSizeClass}`}>
      <Header onAccessibilityClick={() => setShowAccessibility(!showAccessibility)} />

      {showAccessibility && (
        <AccessibilityPanel
          textSize={textSize}
          onTextSizeChange={setTextSize}
          speechRate={speechRate}
          onSpeechRateChange={setSpeechRate}
          onClose={() => setShowAccessibility(false)}
        />
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <ChatMessages messages={messages} />

        <ControlPanel audioState={audioState} onVoiceToggle={handleVoiceToggle} onTextSubmit={handleTextSubmit} />
      </div>

      {/* Avatar positioned in bottom right */}
      <div className="fixed bottom-32 right-4 md:right-8 z-10">
        <TalkingAvatar isListening={audioState === "listening"} isSpeaking={audioState === "speaking"} size="medium" />
      </div>
    </div>
  )
}

/**
 * Voice Interface Component
 * Combines the TalkingAvatar with voice controls for a complete experience
 * ElevenLabs handles speech, Gemini handles automation
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAccessibility } from '../context/AccessibilityContext';
import TalkingAvatar from './TalkingAvatar';
import elevenLabsService from '../services/elevenLabsService';
import avatarService from '../services/avatarService';
import eCitizenAutomation from '../services/eCitizenAutomation';
import api from '../services/api';
import toast from 'react-hot-toast';

function VoiceInterface({ disabled = false, onAutomationAction }) {
  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState('idle'); // idle, connecting, listening, speaking, thinking
  const [videoUrl, setVideoUrl] = useState(null);
  const [useVideoAvatar, setUseVideoAvatar] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [lastResponse, setLastResponse] = useState('');
  const [useLocalGemini, setUseLocalGemini] = useState(true); // Use our Gemini backend
  const { settings, announce, speak } = useAccessibility();
  const videoRef = useRef(null);
  const recognitionRef = useRef(null);

  // Check SadTalker availability on mount
  useEffect(() => {
    const checkAvatar = async () => {
      const status = await avatarService.checkStatus();
      setUseVideoAvatar(status.available);
      console.log('Avatar service status:', status);
    };
    checkAvatar();
  }, []);

  // Setup speech recognition for local Gemini mode
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = settings.language === 'sw' ? 'sw-KE' : 'en-KE';

      recognitionRef.current.onresult = (event) => {
        const current = event.resultIndex;
        const result = event.results[current];
        const transcriptText = result[0].transcript;
        setTranscript(transcriptText);
        
        if (result.isFinal) {
          handleUserInput(transcriptText);
        }
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        if (event.error !== 'no-speech') {
          toast.error('Speech recognition error. Please try again.');
        }
        setStatus('idle');
      };

      recognitionRef.current.onend = () => {
        if (isActive && status === 'listening') {
          // Restart recognition if still active
          try {
            recognitionRef.current.start();
          } catch (e) {
            console.log('Recognition restart skipped');
          }
        }
      };
    }
  }, [settings.language, isActive, status]);

  // Handle user voice input - send to Gemini for processing
  const handleUserInput = useCallback(async (userMessage) => {
    if (!userMessage.trim()) return;

    setStatus('thinking');
    announce('Processing your request...');

    try {
      // Send to our Gemini backend
      const response = await api.sendMessage(userMessage, settings.language);
      
      if (response) {
        const responseText = response.text || response.response;
        setLastResponse(responseText);
        
        // Use ElevenLabs or browser TTS to speak the response
        setStatus('speaking');
        await speakResponse(responseText);
        
        // Handle automation if present
        if (response.automation && response.automation.action !== 'none') {
          await handleAutomation(response.automation, response.entities);
        }
        
        // Store entities for later autofill
        if (response.entities) {
          eCitizenAutomation.setUserInfo(response.entities);
        }
        
        // Callback for parent component
        if (onAutomationAction) {
          onAutomationAction(response);
        }
      }
    } catch (error) {
      console.error('Error processing message:', error);
      const errorMsg = settings.language === 'sw' 
        ? 'Samahani, kuna tatizo. Jaribu tena.'
        : 'Sorry, there was an error. Please try again.';
      await speakResponse(errorMsg);
    }

    setStatus('listening');
  }, [settings.language, announce, onAutomationAction]);

  // Speak response using ElevenLabs or browser TTS
  const speakResponse = useCallback(async (text) => {
    // First try ElevenLabs if connected
    if (elevenLabsService.isActive()) {
      // ElevenLabs will handle speaking through the conversation
      return;
    }
    
    // Fallback to browser TTS
    speak(text);
    
    // Wait for speech to complete (estimate)
    const wordsPerMinute = 130;
    const words = text.split(' ').length;
    const duration = (words / wordsPerMinute) * 60 * 1000;
    await new Promise(resolve => setTimeout(resolve, duration));
  }, [speak]);

  // Handle automation commands from Gemini
  const handleAutomation = useCallback(async (automation, entities) => {
    const result = await eCitizenAutomation.executeAutomation(automation);
    
    if (result.success && !result.noAction) {
      // Announce what was done
      if (result.message) {
        toast.success(result.message.substring(0, 100));
        await speakResponse(result.message);
      }
    } else if (!result.success) {
      if (result.fallbackUrl) {
        // Popup blocked, provide link
        toast.error('Popup blocked. Click the link below.');
        window.open(result.fallbackUrl, '_blank');
      }
    }
  }, [speakResponse]);

  // Setup ElevenLabs callbacks (for direct ElevenLabs mode)
  useEffect(() => {
    elevenLabsService.onConnect = () => {
      setIsActive(true);
      setStatus('listening');
      announce('Connected to Habari. You can start speaking now.');
      toast.success('Connected! Start speaking...');
    };

    elevenLabsService.onDisconnect = () => {
      setIsActive(false);
      setStatus('idle');
      announce('Conversation ended.');
      if (videoUrl) {
        avatarService.revokeVideoUrl(videoUrl);
        setVideoUrl(null);
      }
    };

    elevenLabsService.onModeChange = async (mode) => {
      setStatus(mode);
      if (mode === 'speaking') {
        announce('Habari is speaking...');
      } else if (mode === 'listening') {
        announce('Listening...');
      }
    };

    elevenLabsService.onMessage = async (message) => {
      // When ElevenLabs agent responds, we can still trigger automation
      // by analyzing the message through our backend
      if (message && useLocalGemini) {
        try {
          // Send to Gemini for automation analysis only
          const response = await api.analyzeForAutomation(message);
          if (response?.automation?.action !== 'none') {
            await handleAutomation(response.automation, response.entities);
          }
        } catch (e) {
          console.log('Automation analysis skipped');
        }
      }
    };

    elevenLabsService.onError = (error) => {
      setIsActive(false);
      setStatus('idle');
      toast.error(`Error: ${error}`);
      announce(`Error: ${error}`);
    };

    return () => {
      if (elevenLabsService.isActive()) {
        elevenLabsService.endConversation();
      }
      if (videoUrl) {
        avatarService.revokeVideoUrl(videoUrl);
      }
    };
  }, [announce, videoUrl, useLocalGemini, handleAutomation]);

  // Toggle conversation - supports both modes
  const toggleConversation = useCallback(async () => {
    if (isActive) {
      // End conversation
      if (useLocalGemini) {
        if (recognitionRef.current) {
          recognitionRef.current.stop();
        }
      } else {
        await elevenLabsService.endConversation();
      }
      setIsActive(false);
      setStatus('idle');
      announce('Conversation ended.');
      toast.success('Conversation ended');
    } else {
      // Start conversation
      setStatus('connecting');
      announce('Starting conversation with Habari...');
      
      if (useLocalGemini) {
        // Use local speech recognition + Gemini + browser TTS
        try {
          if (recognitionRef.current) {
            recognitionRef.current.start();
            setIsActive(true);
            setStatus('listening');
            toast.success('Listening! Say something...');
            announce('Listening. You can speak now.');
          } else {
            throw new Error('Speech recognition not available');
          }
        } catch (error) {
          setStatus('idle');
          toast.error('Failed to start speech recognition.');
        }
      } else {
        // Use ElevenLabs directly
        const success = await elevenLabsService.startConversation();
        if (!success) {
          setStatus('idle');
          toast.error('Failed to connect. Please check your microphone.');
        }
      }
    }
  }, [isActive, announce, useLocalGemini]);

  const getStatusText = () => {
    switch (status) {
      case 'connecting':
        return settings.language === 'sw' ? 'Inaunganisha...' : 'Connecting...';
      case 'listening':
        return settings.language === 'sw' ? 'Inasikiliza...' : 'Listening...';
      case 'speaking':
        return settings.language === 'sw' ? 'Habari anazungumza...' : 'Habari is speaking...';
      case 'thinking':
        return settings.language === 'sw' ? 'Inafikiria...' : 'Thinking...';
      default:
        return settings.language === 'sw' 
          ? 'Bonyeza kuongea na Habari' 
          : 'Tap to talk to Habari';
    }
  };

  const getButtonLabel = () => {
    if (isActive) {
      return settings.language === 'sw' ? 'Maliza Mazungumzo' : 'End Conversation';
    }
    return settings.language === 'sw' ? 'Anza Mazungumzo' : 'Start Conversation';
  };

  return (
    <div className="voice-interface">
      {/* Avatar Section */}
      <div className="avatar-section">
        {videoUrl && useVideoAvatar ? (
          <div className="video-avatar">
            <video
              ref={videoRef}
              src={videoUrl}
              autoPlay
              loop={status === 'speaking'}
              muted={false}
              className="avatar-video"
            />
          </div>
        ) : (
          <TalkingAvatar
            isListening={status === 'listening'}
            isSpeaking={status === 'speaking'}
            isThinking={status === 'thinking'}
            size="large"
          />
        )}
      </div>

      {/* Transcript Display */}
      {isActive && (transcript || lastResponse) && (
        <div className="transcript-section">
          {transcript && status === 'listening' && (
            <div className="transcript user-transcript">
              <span className="transcript-label">You:</span>
              <span className="transcript-text">{transcript}</span>
            </div>
          )}
          {lastResponse && (
            <div className="transcript assistant-transcript">
              <span className="transcript-label">Habari:</span>
              <span className="transcript-text">{lastResponse}</span>
            </div>
          )}
        </div>
      )}

      {/* Voice Control Section */}
      <div className="voice-controls">
        <button
          className={`voice-button ${isActive ? 'active' : ''} ${status}`}
          onClick={toggleConversation}
          disabled={disabled || status === 'connecting'}
          aria-label={getButtonLabel()}
          aria-pressed={isActive}
        >
          <span className="button-icon">
            {isActive ? (
              // Stop icon
              <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            ) : (
              // Microphone icon
              <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
            )}
          </span>
          <span className="button-text">{getButtonLabel()}</span>
        </button>

        {/* Status indicator */}
        <p className="status-text" aria-live="polite">
          {getStatusText()}
        </p>

        {/* Mode Toggle */}
        <div className="mode-toggle">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={!useLocalGemini}
              onChange={(e) => setUseLocalGemini(!e.target.checked)}
              disabled={isActive}
            />
            <span className="toggle-text">
              {useLocalGemini 
                ? (settings.language === 'sw' ? 'Kutumia Gemini + TTS' : 'Using Gemini + TTS')
                : (settings.language === 'sw' ? 'Kutumia ElevenLabs' : 'Using ElevenLabs')}
            </span>
          </label>
        </div>

        {/* Instructions */}
        {!isActive && (
          <div className="instructions">
            <p>
              {settings.language === 'sw' 
                ? 'Bonyeza kitufe kuanza mazungumzo ya sauti na Habari. Anaweza kukusaidia kufungua kurasa za eCitizen na kujaza fomu.'
                : 'Press the button to start talking with Habari. She can help you open eCitizen pages and fill out forms.'}
            </p>
            <p className="feature-hint">
              {settings.language === 'sw'
                ? '✨ Sema "Tafadhali fungua ukurasa wa pasipoti" kufungua eCitizen'
                : '✨ Say "Please open the passport page" to navigate to eCitizen'}
            </p>
          </div>
        )}

        {/* Active conversation indicator */}
        {isActive && (
          <div className={`active-indicator ${status}`} aria-hidden="true">
            <span className="indicator-dot" />
            <span className="indicator-text">
              {settings.language === 'sw' ? 'Mazungumzo hai' : 'Conversation active'}
            </span>
          </div>
        )}
      </div>

      <style>{`
        .voice-interface {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--spacing-xl);
          padding: var(--spacing-xl);
          max-width: 400px;
          margin: 0 auto;
        }

        .avatar-section {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 200px;
        }

        .video-avatar {
          width: 180px;
          height: 180px;
          border-radius: 50%;
          overflow: hidden;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        }

        .avatar-video {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .voice-controls {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--spacing-md);
          width: 100%;
        }

        .voice-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: var(--spacing-sm);
          padding: var(--spacing-md) var(--spacing-xl);
          border: none;
          border-radius: 50px;
          background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%);
          color: white;
          font-size: var(--font-size-lg);
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 4px 16px rgba(0, 59, 74, 0.3);
          min-width: 250px;
        }

        .voice-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 24px rgba(0, 59, 74, 0.4);
        }

        .voice-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .voice-button.active {
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          box-shadow: 0 4px 16px rgba(239, 68, 68, 0.3);
        }

        .voice-button.listening {
          animation: pulse-button 2s infinite;
        }

        .voice-button.speaking {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          box-shadow: 0 4px 16px rgba(16, 185, 129, 0.3);
        }

        .voice-button.connecting {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          animation: connecting 1.5s infinite;
        }

        @keyframes pulse-button {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.02); }
        }

        @keyframes connecting {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }

        .button-icon {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .status-text {
          font-size: var(--font-size-base);
          font-weight: 500;
          color: var(--color-text-primary);
          min-height: 1.5em;
          text-align: center;
        }

        .instructions {
          text-align: center;
          max-width: 300px;
        }

        .instructions p {
          font-size: var(--font-size-sm);
          color: var(--color-text-secondary);
          margin-bottom: var(--spacing-xs);
        }

        .keyboard-hint {
          font-size: var(--font-size-xs) !important;
          opacity: 0.7;
        }

        .active-indicator {
          display: flex;
          align-items: center;
          gap: var(--spacing-xs);
          padding: var(--spacing-xs) var(--spacing-sm);
          border-radius: 20px;
          background: rgba(16, 185, 129, 0.1);
        }

        .active-indicator.listening {
          background: rgba(59, 130, 246, 0.1);
        }

        .active-indicator.speaking {
          background: rgba(16, 185, 129, 0.1);
        }

        .indicator-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #10b981;
          animation: blink 1.5s infinite;
        }

        .active-indicator.listening .indicator-dot {
          background: #3b82f6;
        }

        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }

        .indicator-text {
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
        }

        /* Transcript styles */
        .transcript-section {
          width: 100%;
          max-width: 350px;
          display: flex;
          flex-direction: column;
          gap: var(--spacing-sm);
          padding: var(--spacing-md);
          background: var(--color-surface);
          border-radius: var(--border-radius-md);
          max-height: 150px;
          overflow-y: auto;
        }

        .transcript {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .transcript-label {
          font-size: var(--font-size-xs);
          font-weight: 600;
          color: var(--color-text-secondary);
        }

        .transcript-text {
          font-size: var(--font-size-sm);
          color: var(--color-text-primary);
          line-height: 1.4;
        }

        .user-transcript .transcript-label {
          color: var(--color-primary);
        }

        .assistant-transcript .transcript-label {
          color: #10b981;
        }

        /* Mode toggle */
        .mode-toggle {
          margin-top: var(--spacing-sm);
        }

        .toggle-label {
          display: flex;
          align-items: center;
          gap: var(--spacing-xs);
          cursor: pointer;
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
        }

        .toggle-label input {
          width: 16px;
          height: 16px;
          cursor: pointer;
        }

        .toggle-label input:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }

        .feature-hint {
          font-size: var(--font-size-xs) !important;
          color: var(--color-primary) !important;
          margin-top: var(--spacing-sm) !important;
        }

        /* High contrast mode */
        [data-high-contrast="true"] .voice-button {
          border: 3px solid white;
        }

        /* Reduced motion */
        @media (prefers-reduced-motion: reduce) {
          .voice-button,
          .indicator-dot {
            animation: none;
          }
        }

        /* Keyboard navigation */
        .voice-button:focus-visible {
          outline: 3px solid var(--color-focus);
          outline-offset: 3px;
        }
      `}</style>
    </div>
  );
}

export default VoiceInterface;

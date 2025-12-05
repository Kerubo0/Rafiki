/**
 * Voice Interface Component
 * Combines the TalkingAvatar with voice controls for a complete experience
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAccessibility } from '../context/AccessibilityContext';
import TalkingAvatar from './TalkingAvatar';
import elevenLabsService from '../services/elevenLabsService';
import avatarService from '../services/avatarService';
import toast from 'react-hot-toast';

function VoiceInterface({ disabled = false }) {
  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState('idle'); // idle, connecting, listening, speaking, thinking
  const [videoUrl, setVideoUrl] = useState(null);
  const [useVideoAvatar, setUseVideoAvatar] = useState(false);
  const { settings, announce } = useAccessibility();
  const videoRef = useRef(null);

  // Check SadTalker availability on mount
  useEffect(() => {
    const checkAvatar = async () => {
      const status = await avatarService.checkStatus();
      setUseVideoAvatar(status.available);
      console.log('Avatar service status:', status);
    };
    checkAvatar();
  }, []);

  // Setup ElevenLabs callbacks
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
      // Cleanup video URL
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

    elevenLabsService.onError = (error) => {
      setIsActive(false);
      setStatus('idle');
      toast.error(`Error: ${error}`);
      announce(`Error: ${error}`);
    };

    // Cleanup on unmount
    return () => {
      if (elevenLabsService.isActive()) {
        elevenLabsService.endConversation();
      }
      if (videoUrl) {
        avatarService.revokeVideoUrl(videoUrl);
      }
    };
  }, [announce, videoUrl]);

  const toggleConversation = useCallback(async () => {
    if (isActive) {
      // End conversation
      await elevenLabsService.endConversation();
      setIsActive(false);
      setStatus('idle');
      announce('Conversation ended.');
      toast.success('Conversation ended');
    } else {
      // Start conversation
      setStatus('connecting');
      announce('Connecting to Habari...');
      
      const success = await elevenLabsService.startConversation();
      if (!success) {
        setStatus('idle');
        toast.error('Failed to connect. Please check your microphone.');
      }
    }
  }, [isActive, announce]);

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

        {/* Instructions */}
        {!isActive && (
          <div className="instructions">
            <p>
              {settings.language === 'sw' 
                ? 'Bonyeza kitufe kuanza mazungumzo ya sauti na Habari, msaidizi wako wa eCitizen.'
                : 'Press the button to start a voice conversation with Habari, your eCitizen assistant.'}
            </p>
            <p className="keyboard-hint">
              {settings.language === 'sw'
                ? 'Bonyeza Nafasi kuanza au kusimamisha'
                : 'Press Space to start or stop'}
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

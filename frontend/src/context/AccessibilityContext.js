/**
 * Accessibility Context
 * Manages accessibility preferences across the application
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AccessibilityContext = createContext(null);

// Default accessibility settings
const defaultSettings = {
  highContrast: false,
  largeText: false,
  reducedMotion: false,
  screenReaderMode: false,
  speechRate: 80, // Reduced from 150 to 80 for slower speech
  voiceEnabled: true,
  autoSpeak: true,
  language: 'en', // 'en' for English, 'sw' for Kiswahili
};

export function AccessibilityProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    // Load settings from localStorage
    const saved = localStorage.getItem('accessibilitySettings');
    if (saved) {
      try {
        return { ...defaultSettings, ...JSON.parse(saved) };
      } catch (e) {
        console.error('Failed to parse accessibility settings:', e);
      }
    }
    return defaultSettings;
  });

  // Check system preferences on mount
  useEffect(() => {
    // Check for reduced motion preference
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motionQuery.matches) {
      setSettings(prev => ({ ...prev, reducedMotion: true }));
    }

    // Check for high contrast preference
    const contrastQuery = window.matchMedia('(prefers-contrast: more)');
    if (contrastQuery.matches) {
      setSettings(prev => ({ ...prev, highContrast: true }));
    }
  }, []);

  // Apply settings to document
  useEffect(() => {
    document.documentElement.setAttribute('data-high-contrast', settings.highContrast);
    document.documentElement.setAttribute('data-large-text', settings.largeText);
    document.documentElement.setAttribute('data-reduced-motion', settings.reducedMotion);

    // Save to localStorage
    localStorage.setItem('accessibilitySettings', JSON.stringify(settings));
  }, [settings]);

  const updateSetting = useCallback((key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  const toggleSetting = useCallback((key) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(defaultSettings);
    localStorage.removeItem('accessibilitySettings');
  }, []);

  // Announce message to screen readers
  const announce = useCallback((message, priority = 'polite') => {
    const announcer = document.getElementById('announcements');
    if (announcer) {
      announcer.setAttribute('aria-live', priority);
      announcer.textContent = message;
      
      // Clear after announcement
      setTimeout(() => {
        announcer.textContent = '';
      }, 1000);
    }
  }, []);

  // Speak text using Web Speech API
  const speak = useCallback((text, options = {}) => {
    if (!settings.voiceEnabled || !window.speechSynthesis) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = (options.rate || settings.speechRate) / 100; // Lower rate = slower speech
    utterance.pitch = options.pitch || 1;
    utterance.volume = options.volume || 1;
    
    // Set language based on user preference
    const langCode = options.lang || (settings.language === 'sw' ? 'sw-KE' : 'en-KE');
    utterance.lang = langCode;

    window.speechSynthesis.speak(utterance);
  }, [settings.voiceEnabled, settings.speechRate, settings.language]);

  // Stop speaking
  const stopSpeaking = useCallback(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const value = {
    settings,
    updateSetting,
    toggleSetting,
    resetSettings,
    announce,
    speak,
    stopSpeaking,
  };

  return (
    <AccessibilityContext.Provider value={value}>
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility must be used within AccessibilityProvider');
  }
  return context;
}

export default AccessibilityContext;

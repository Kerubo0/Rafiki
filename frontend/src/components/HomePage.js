/**
 * Home Page Component
 * Main landing page with voice assistant and service overview
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccessibility } from '../context/AccessibilityContext';
import { useSession } from '../context/SessionContext';
import VoiceInterface from './VoiceInterface';
import ChatInterface from './ChatInterface';
import ServiceCard from './ServiceCard';
import api from '../services/api';
import toast from 'react-hot-toast';

function HomePage() {
  const navigate = useNavigate();
  const { speak, settings, updateSetting } = useAccessibility();
  const { isLoading: sessionLoading } = useSession();
  const [services, setServices] = useState([]);
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [hasGreeted, setHasGreeted] = useState(false);
  const [showLanguageChoice, setShowLanguageChoice] = useState(true);

  // Habari's bilingual greeting
  const habariGreeting = 
    "Hello! My name is Habari, your Government assistant. How can I help you today? " +
    "Press 1 to continue in English. Press 2 for Kiswahili. " +
    "Hujambo! Naitwa Habari, msaidizi wako wa Serikali. Naweza kukusaidia vipi leo? " +
    "Bonyeza 1 kuendelea kwa Kiingereza. Bonyeza 2 kwa Kiswahili.";

  // Load services on mount
  useEffect(() => {
    loadInitialData();
  }, []);

  // Speak Habari's greeting when page loads
  useEffect(() => {
    if (!isLoading && !sessionLoading && !hasGreeted && settings.voiceEnabled) {
      // Small delay to ensure everything is loaded
      const timer = setTimeout(() => {
        speak(habariGreeting);
        setHasGreeted(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isLoading, sessionLoading, hasGreeted, settings.voiceEnabled, speak]);

  // Handle keyboard input for language selection
  const handleKeyPress = useCallback((event) => {
    if (!showLanguageChoice) return;
    
    if (event.key === '1') {
      // English selected
      updateSetting('language', 'en');
      setShowLanguageChoice(false);
      speak("You have selected English. Welcome! How can I help you today?");
      toast.success('Language set to English');
    } else if (event.key === '2') {
      // Kiswahili selected
      updateSetting('language', 'sw');
      setShowLanguageChoice(false);
      speak("Umechagua Kiswahili. Karibu! Naweza kukusaidia vipi leo?");
      toast.success('Lugha imewekwa Kiswahili');
    }
  }, [showLanguageChoice, updateSetting, speak]);

  // Add keyboard listener for language selection
  useEffect(() => {
    window.addEventListener('keypress', handleKeyPress);
    return () => window.removeEventListener('keypress', handleKeyPress);
  }, [handleKeyPress]);

  const handleLanguageSelect = (lang) => {
    updateSetting('language', lang);
    setShowLanguageChoice(false);
    if (lang === 'en') {
      speak("You have selected English. Welcome! How can I help you today?");
      toast.success('Language set to English');
    } else {
      speak("Umechagua Kiswahili. Karibu! Naweza kukusaidia vipi leo?");
      toast.success('Lugha imewekwa Kiswahili');
    }
  };

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const servicesData = await api.getServices();
      setServices(servicesData.services || []);
      setWelcomeMessage(habariGreeting);
    } catch (error) {
      console.error('Failed to load initial data:', error);
      toast.error('Failed to load services. Please refresh the page.');
      setWelcomeMessage(habariGreeting);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoiceResponse = (response) => {
    // Handle navigation intents from voice
    if (response.intent === 'book_appointment' && response.entities?.service_type) {
      navigate(`/booking/${response.entities.service_type}`);
    }
  };

  const handleServiceSelect = (service) => {
    const serviceType = service.type || service.service_type;
    navigate(`/booking/${serviceType}`);
  };

  if (isLoading || sessionLoading) {
    return (
      <div className="loading-overlay" role="alert" aria-busy="true">
        <div className="loading-content">
          <span className="loading-spinner" aria-hidden="true" />
          <p className="loading-text">Loading eCitizen Voice Assistant...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      {/* Language Selection Modal */}
      {showLanguageChoice && (
        <div 
          className="language-selection-overlay"
          role="dialog"
          aria-labelledby="language-title"
          aria-modal="true"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div 
            className="language-selection-card"
            style={{
              backgroundColor: '#ffffff',
              padding: 'var(--spacing-xl)',
              borderRadius: 'var(--border-radius-lg)',
              maxWidth: '500px',
              width: '90%',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '4rem', marginBottom: 'var(--spacing-md)' }}>👋</div>
            <h2 id="language-title" style={{ marginBottom: 'var(--spacing-md)', color: 'var(--color-primary)' }}>
              Welcome / Karibu
            </h2>
            <p style={{ marginBottom: 'var(--spacing-lg)', fontSize: '1.1rem', lineHeight: '1.6' }}>
              Hello! I'm <strong>Habari</strong>, your Government assistant.<br />
              Hujambo! Naitwa <strong>Habari</strong>, msaidizi wako wa Serikali.
            </p>
            <p style={{ marginBottom: 'var(--spacing-lg)', color: 'var(--color-text-secondary)' }}>
              Choose your language / Chagua lugha yako:
            </p>
            <div style={{ display: 'flex', gap: 'var(--spacing-md)', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => handleLanguageSelect('en')}
                className="btn btn-primary"
                style={{ 
                  padding: 'var(--spacing-md) var(--spacing-xl)',
                  fontSize: '1.2rem',
                  minWidth: '180px',
                }}
                aria-label="Press 1 for English"
              >
                🇬🇧 English (1)
              </button>
              <button
                onClick={() => handleLanguageSelect('sw')}
                className="btn btn-secondary"
                style={{ 
                  padding: 'var(--spacing-md) var(--spacing-xl)',
                  fontSize: '1.2rem',
                  minWidth: '180px',
                }}
                aria-label="Press 2 for Kiswahili"
              >
                🇰🇪 Kiswahili (2)
              </button>
            </div>
            <p style={{ marginTop: 'var(--spacing-lg)', fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>
              Press <kbd style={{ padding: '2px 8px', backgroundColor: '#e5e7eb', borderRadius: '4px' }}>1</kbd> or <kbd style={{ padding: '2px 8px', backgroundColor: '#e5e7eb', borderRadius: '4px' }}>2</kbd> on your keyboard
            </p>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section className="home-hero" aria-labelledby="hero-title">
        <h1 id="hero-title" className="home-hero-title">
          {settings.language === 'sw' ? 'Msaidizi wa Sauti wa eCitizen' : 'eCitizen Voice Assistant'}
        </h1>
        <p className="home-hero-subtitle">
          {settings.language === 'sw' 
            ? 'Pata huduma za serikali ya Kenya kwa kutumia sauti yako. Weka miadi ya Pasipoti, Kitambulisho cha Taifa, Leseni ya Kuendesha, na zaidi.'
            : 'Access Kenyan government services using your voice. Book appointments for Passport, National ID, Driving License, and more.'}
        </p>
      </section>

      {/* Voice Interaction Section */}
      <section 
        className="home-voice-section"
        aria-labelledby="voice-section-title"
      >
        <h2 id="voice-section-title" className="sr-only">
          Voice Assistant
        </h2>
        
        {/* Voice Interface with Talking Avatar - Talk to Habari */}
        <VoiceInterface />
        
        <div style={{ width: '100%', maxWidth: '600px' }}>
          <ChatInterface onResponse={handleVoiceResponse} />
        </div>
      </section>

      {/* Services Section */}
      <section 
        className="home-services-section"
        aria-labelledby="services-title"
      >
        <h2 id="services-title" className="section-title">
          {settings.language === 'sw' ? 'Huduma Zinazopatikana' : 'Available Services'}
        </h2>
        
        <p 
          className="text-center mb-lg"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {settings.language === 'sw' 
            ? 'Chagua huduma hapa chini au tumia amri za sauti kuanza'
            : 'Select a service below or use voice commands to get started'}
        </p>

        <div className="services-grid" role="list">
          {services.map((service) => (
            <ServiceCard
              key={service.service_type}
              service={service}
              onSelect={handleServiceSelect}
            />
          ))}
        </div>
      </section>

      {/* Help Section */}
      <section 
        className="card mt-xl"
        aria-labelledby="help-title"
        style={{ padding: 'var(--spacing-xl)' }}
      >
        <h2 id="help-title" style={{ marginBottom: 'var(--spacing-md)' }}>
          How to Use
        </h2>
        
        <div style={{ display: 'grid', gap: 'var(--spacing-lg)', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
          <div>
            <h3 style={{ fontSize: 'var(--font-size-lg)', marginBottom: 'var(--spacing-sm)' }}>
              Voice Commands
            </h3>
            <ul style={{ paddingLeft: 'var(--spacing-lg)', color: 'var(--color-text-secondary)' }}>
              <li>"Book a passport appointment"</li>
              <li>"I need a driving license"</li>
              <li>"What services are available?"</li>
              <li>"Help me with my booking"</li>
            </ul>
          </div>
          
          <div>
            <h3 style={{ fontSize: 'var(--font-size-lg)', marginBottom: 'var(--spacing-sm)' }}>
              Keyboard Navigation
            </h3>
            <ul style={{ paddingLeft: 'var(--spacing-lg)', color: 'var(--color-text-secondary)' }}>
              <li><kbd>Tab</kbd> - Navigate between elements</li>
              <li><kbd>Enter</kbd> / <kbd>Space</kbd> - Select or activate</li>
              <li><kbd>Escape</kbd> - Cancel voice input</li>
            </ul>
          </div>
          
          <div>
            <h3 style={{ fontSize: 'var(--font-size-lg)', marginBottom: 'var(--spacing-sm)' }}>
              Accessibility
            </h3>
            <ul style={{ paddingLeft: 'var(--spacing-lg)', color: 'var(--color-text-secondary)' }}>
              <li>High contrast mode available</li>
              <li>Large text option</li>
              <li>Screen reader optimized</li>
              <li>Voice feedback on/off</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}

export default HomePage;

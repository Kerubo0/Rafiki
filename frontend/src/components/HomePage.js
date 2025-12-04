/**
 * Home Page Component
 * Main landing page with voice assistant and service overview
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccessibility } from '../context/AccessibilityContext';
import { useSession } from '../context/SessionContext';
import VoiceButton from './VoiceButton';
import ChatInterface from './ChatInterface';
import ServiceCard from './ServiceCard';
import api from '../services/api';
import toast from 'react-hot-toast';

function HomePage() {
  const navigate = useNavigate();
  const { speak, settings, announce } = useAccessibility();
  const { isLoading: sessionLoading } = useSession();
  const [services, setServices] = useState([]);
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Load services and welcome message on mount
  useEffect(() => {
    loadInitialData();
  }, []);

  // Speak welcome message when loaded
  useEffect(() => {
    if (welcomeMessage && settings.voiceEnabled && settings.autoSpeak && !sessionLoading) {
      speak(welcomeMessage);
    }
  }, [welcomeMessage, settings.voiceEnabled, settings.autoSpeak, sessionLoading, speak]);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const [servicesData, welcomeData] = await Promise.all([
        api.getServices(),
        api.getWelcomeMessage(),
      ]);

      setServices(servicesData.services || []);
      setWelcomeMessage(welcomeData.greeting || '');
    } catch (error) {
      console.error('Failed to load initial data:', error);
      toast.error('Failed to load services. Please refresh the page.');
      
      // Set default welcome message
      setWelcomeMessage(
        "Welcome to eCitizen Voice Assistant. I'm here to help you access government services."
      );
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
      {/* Hero Section */}
      <section className="home-hero" aria-labelledby="hero-title">
        <h1 id="hero-title" className="home-hero-title">
          eCitizen Voice Assistant
        </h1>
        <p className="home-hero-subtitle">
          Access Kenyan government services using your voice. 
          Book appointments for Passport, National ID, Driving License, and more.
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
        
        <VoiceButton onResponse={handleVoiceResponse} />
        
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
          Available Services
        </h2>
        
        <p 
          className="text-center mb-lg"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Select a service below or use voice commands to get started
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
              🎤 Voice Commands
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
              ⌨️ Keyboard Navigation
            </h3>
            <ul style={{ paddingLeft: 'var(--spacing-lg)', color: 'var(--color-text-secondary)' }}>
              <li><kbd>Tab</kbd> - Navigate between elements</li>
              <li><kbd>Enter</kbd> / <kbd>Space</kbd> - Select or activate</li>
              <li><kbd>Escape</kbd> - Cancel voice input</li>
            </ul>
          </div>
          
          <div>
            <h3 style={{ fontSize: 'var(--font-size-lg)', marginBottom: 'var(--spacing-sm)' }}>
              ♿ Accessibility
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

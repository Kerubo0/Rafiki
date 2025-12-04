/**
 * ElevenLabs Conversational AI Service
 * Integrates with ElevenLabs agent for voice conversations
 */

import { Conversation } from '@11labs/client';

class ElevenLabsService {
  constructor() {
    this.conversation = null;
    this.isConnected = false;
    this.agentId = 'agent_0601kbntk14cet68q60vzy6y55v7';
    
    // Callbacks
    this.onConnect = null;
    this.onDisconnect = null;
    this.onMessage = null;
    this.onError = null;
    this.onModeChange = null;
    this.onStatusChange = null;
  }

  /**
   * Request microphone permission
   */
  async requestMicrophonePermission() {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      return true;
    } catch (error) {
      console.error('Microphone permission denied:', error);
      return false;
    }
  }

  /**
   * Start a conversation with the ElevenLabs agent
   */
  async startConversation(options = {}) {
    try {
      // Request microphone permission first
      const hasPermission = await this.requestMicrophonePermission();
      if (!hasPermission) {
        throw new Error('Microphone permission is required for voice conversation');
      }

      // End any existing conversation
      if (this.conversation) {
        await this.endConversation();
      }

      // Start the conversation session
      this.conversation = await Conversation.startSession({
        agentId: this.agentId,
        
        onConnect: () => {
          console.log('ElevenLabs: Connected to agent');
          this.isConnected = true;
          if (this.onConnect) this.onConnect();
          if (this.onStatusChange) this.onStatusChange('connected');
        },
        
        onDisconnect: () => {
          console.log('ElevenLabs: Disconnected from agent');
          this.isConnected = false;
          if (this.onDisconnect) this.onDisconnect();
          if (this.onStatusChange) this.onStatusChange('disconnected');
        },
        
        onMessage: (message) => {
          console.log('ElevenLabs message:', message);
          if (this.onMessage) this.onMessage(message);
        },
        
        onError: (error) => {
          console.error('ElevenLabs error:', error);
          if (this.onError) this.onError(error);
          if (this.onStatusChange) this.onStatusChange('error');
        },
        
        onModeChange: (mode) => {
          // mode.mode can be 'speaking', 'listening', or 'idle'
          console.log('ElevenLabs mode:', mode.mode);
          if (this.onModeChange) this.onModeChange(mode.mode);
          if (this.onStatusChange) this.onStatusChange(mode.mode);
        },
      });

      return true;
    } catch (error) {
      console.error('Failed to start ElevenLabs conversation:', error);
      if (this.onError) this.onError(error.message);
      return false;
    }
  }

  /**
   * End the current conversation
   */
  async endConversation() {
    if (this.conversation) {
      try {
        await this.conversation.endSession();
        this.conversation = null;
        this.isConnected = false;
        console.log('ElevenLabs: Conversation ended');
      } catch (error) {
        console.error('Error ending conversation:', error);
      }
    }
  }

  /**
   * Set the volume for the agent's voice
   * @param {number} volume - Volume level between 0 and 1
   */
  setVolume(volume) {
    if (this.conversation) {
      this.conversation.setVolume({ volume: Math.max(0, Math.min(1, volume)) });
    }
  }

  /**
   * Get the conversation ID
   */
  getConversationId() {
    return this.conversation?.getId() || null;
  }

  /**
   * Check if the conversation is active
   */
  isActive() {
    return this.isConnected && this.conversation !== null;
  }

  /**
   * Get the current status
   */
  getStatus() {
    if (!this.conversation) return 'disconnected';
    return this.isConnected ? 'connected' : 'connecting';
  }
}

// Export singleton instance
const elevenLabsService = new ElevenLabsService();
export default elevenLabsService;

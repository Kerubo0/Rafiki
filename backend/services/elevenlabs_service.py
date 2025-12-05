"""
ElevenLabs Conversational AI Service
Handles signed URL generation and text-to-speech via ElevenLabs API
"""

import httpx
import base64
from typing import Optional, Dict, Any
from config import get_settings
from utils.logger import get_logger

logger = get_logger(__name__)


class ElevenLabsService:
    """
    Service for ElevenLabs Conversational AI integration.
    Provides signed URL generation for secure WebSocket connections
    and text-to-speech functionality.
    """
    
    BASE_URL = "https://api.elevenlabs.io/v1"
    
    def __init__(self):
        """Initialize ElevenLabs service."""
        self.settings = get_settings()
        self.api_key = self.settings.ELEVENLABS_API_KEY
        self.agent_id = self.settings.ELEVENLABS_AGENT_ID
        self._client = None
    
    @property
    def client(self) -> httpx.AsyncClient:
        """Get or create async HTTP client."""
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=self.BASE_URL,
                headers={
                    "xi-api-key": self.api_key,
                    "Content-Type": "application/json"
                },
                timeout=30.0
            )
        return self._client
    
    async def close(self):
        """Close the HTTP client."""
        if self._client:
            await self._client.aclose()
            self._client = None
    
    async def get_signed_url(self, agent_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Generate a signed URL for WebSocket connection to ElevenLabs agent.
        This allows secure connections without exposing API key in frontend.
        
        Args:
            agent_id: Optional agent ID override (defaults to configured agent)
            
        Returns:
            Dict with signed_url and expiration info
        """
        try:
            target_agent = agent_id or self.agent_id
            
            if not target_agent:
                return {
                    "success": False,
                    "error": "No agent ID configured"
                }
            
            if not self.api_key:
                return {
                    "success": False,
                    "error": "ElevenLabs API key not configured"
                }
            
            # Request signed URL from ElevenLabs
            response = await self.client.get(
                f"/convai/conversation/get_signed_url",
                params={"agent_id": target_agent}
            )
            
            if response.status_code == 200:
                data = response.json()
                logger.info(f"Generated signed URL for agent {target_agent}")
                return {
                    "success": True,
                    "signed_url": data.get("signed_url"),
                    "agent_id": target_agent
                }
            else:
                error_msg = f"Failed to get signed URL: {response.status_code}"
                logger.error(error_msg)
                return {
                    "success": False,
                    "error": error_msg
                }
                
        except Exception as e:
            logger.error(f"Error getting signed URL: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def text_to_speech(
        self,
        text: str,
        voice_id: Optional[str] = None,
        model_id: str = "eleven_multilingual_v2",
        output_format: str = "mp3_44100_128"
    ) -> Dict[str, Any]:
        """
        Convert text to speech using ElevenLabs TTS API.
        
        Args:
            text: Text to convert to speech
            voice_id: ElevenLabs voice ID (defaults to configured voice)
            model_id: TTS model to use
            output_format: Audio output format
            
        Returns:
            Dict with audio data (base64) or error
        """
        try:
            target_voice = voice_id or self.settings.ELEVENLABS_VOICE_ID
            
            if not target_voice:
                return {
                    "success": False,
                    "error": "No voice ID configured"
                }
            
            response = await self.client.post(
                f"/text-to-speech/{target_voice}",
                json={
                    "text": text,
                    "model_id": model_id,
                    "voice_settings": {
                        "stability": 0.5,
                        "similarity_boost": 0.75,
                        "style": 0.0,
                        "use_speaker_boost": True
                    }
                },
                params={"output_format": output_format}
            )
            
            if response.status_code == 200:
                audio_data = base64.b64encode(response.content).decode("utf-8")
                logger.info(f"Generated TTS audio for {len(text)} characters")
                return {
                    "success": True,
                    "audio_data": audio_data,
                    "content_type": f"audio/{output_format.split('_')[0]}",
                    "text_length": len(text)
                }
            else:
                error_msg = f"TTS failed: {response.status_code}"
                logger.error(error_msg)
                return {
                    "success": False,
                    "error": error_msg
                }
                
        except Exception as e:
            logger.error(f"TTS error: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def get_voices(self) -> Dict[str, Any]:
        """
        Get available ElevenLabs voices.
        
        Returns:
            Dict with list of available voices
        """
        try:
            response = await self.client.get("/voices")
            
            if response.status_code == 200:
                data = response.json()
                voices = [
                    {
                        "voice_id": v["voice_id"],
                        "name": v["name"],
                        "labels": v.get("labels", {}),
                        "preview_url": v.get("preview_url")
                    }
                    for v in data.get("voices", [])
                ]
                return {
                    "success": True,
                    "voices": voices
                }
            else:
                return {
                    "success": False,
                    "error": f"Failed to get voices: {response.status_code}"
                }
                
        except Exception as e:
            logger.error(f"Error getting voices: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def get_agent_info(self, agent_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Get information about an ElevenLabs conversational agent.
        
        Args:
            agent_id: Agent ID to query (defaults to configured agent)
            
        Returns:
            Dict with agent information
        """
        try:
            target_agent = agent_id or self.agent_id
            
            response = await self.client.get(f"/convai/agents/{target_agent}")
            
            if response.status_code == 200:
                data = response.json()
                return {
                    "success": True,
                    "agent": {
                        "agent_id": data.get("agent_id"),
                        "name": data.get("name"),
                        "conversation_config": data.get("conversation_config", {})
                    }
                }
            else:
                return {
                    "success": False,
                    "error": f"Failed to get agent info: {response.status_code}"
                }
                
        except Exception as e:
            logger.error(f"Error getting agent info: {e}")
            return {
                "success": False,
                "error": str(e)
            }


# Singleton instance
elevenlabs_service = ElevenLabsService()

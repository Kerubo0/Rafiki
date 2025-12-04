"""
Google Gemini API integration for natural language understanding.
"""

import json
from typing import Dict, Any, Optional, List
import google.generativeai as genai

from ..config import get_settings, GOVERNMENT_SERVICES, ASSISTANT_RESPONSES
from ..utils.logger import get_logger

logger = get_logger(__name__)


class GeminiService:
    """
    Service for integrating with Google Gemini API for NLU.
    Handles intent detection, entity extraction, and response generation.
    """
    
    def __init__(self):
        """Initialize Gemini service with API configuration."""
        self.settings = get_settings()
        self._model = None
        self._chat = None
        self._initialized = False
        
        # System context for the assistant
        self._system_context = self._build_system_context()
    
    def _build_system_context(self) -> str:
        """Build the system context prompt for Gemini."""
        services_info = "\n".join([
            f"- {key}: {info['name']} - {info['description']}"
            for key, info in GOVERNMENT_SERVICES.items()
        ])
        
        return f"""You are Wanjiku, a friendly and helpful voice assistant designed to help visually impaired users access Kenyan government services through the eCitizen portal.

Your role:
1. Help users book appointments for government services
2. Provide information about required documents and procedures
3. Guide users through the booking process step by step
4. Be patient, clear, and speak in a warm, friendly manner
5. Always confirm actions before proceeding
6. Provide audio-friendly responses (avoid visual references)

Available services:
{services_info}

Available time slots: Morning (8:00 AM - 12:00 PM) or Afternoon (2:00 PM - 5:00 PM)

Response format:
- Keep responses concise but informative
- Use natural, conversational language
- Avoid jargon and technical terms
- Always acknowledge the user's request before responding
- For booking requests, collect: service type, user name, phone number, preferred time slot, and date

When extracting information, identify:
- Intent: greeting, book_appointment, service_info, check_status, navigate_ecitizen, help, confirm, cancel, unknown
- Entities: service_type, user_name, phone_number, time_slot, date, confirmation

Always respond in a way that's easy to understand when spoken aloud."""
    
    def initialize(self) -> bool:
        """
        Initialize the Gemini API client.
        
        Returns:
            True if initialization successful, False otherwise
        """
        try:
            if not self.settings.GEMINI_API_KEY:
                logger.error("Gemini API key not configured")
                return False
            
            genai.configure(api_key=self.settings.GEMINI_API_KEY)
            
            # Configure the model
            generation_config = genai.types.GenerationConfig(
                temperature=0.7,
                top_p=0.9,
                top_k=40,
                max_output_tokens=500,
            )
            
            safety_settings = [
                {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
                {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
                {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
                {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
            ]
            
            self._model = genai.GenerativeModel(
                model_name=self.settings.GEMINI_MODEL,
                generation_config=generation_config,
                safety_settings=safety_settings,
                system_instruction=self._system_context
            )
            
            self._initialized = True
            logger.info("Gemini service initialized successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to initialize Gemini service: {e}")
            return False
    
    async def process_message(
        self,
        user_message: str,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Process a user message and generate a response.
        
        Args:
            user_message: The user's input message
            conversation_history: Previous conversation turns
            context: Additional context (booking state, user preferences)
        
        Returns:
            Dictionary containing response text, intent, entities, and suggested actions
        """
        if not self._initialized:
            if not self.initialize():
                return {
                    "text": ASSISTANT_RESPONSES["error_generic"],
                    "intent": "error",
                    "entities": {},
                    "suggested_actions": ["Try again", "Say 'help' for assistance"]
                }
        
        try:
            # Build the prompt with context
            prompt = self._build_prompt(user_message, conversation_history, context)
            
            # Generate response
            response = await self._generate_response(prompt)
            
            # Parse the response
            parsed_response = self._parse_response(response, user_message)
            
            logger.info(f"Processed message - Intent: {parsed_response.get('intent')}")
            return parsed_response
            
        except Exception as e:
            logger.error(f"Error processing message: {e}")
            return {
                "text": ASSISTANT_RESPONSES["error_generic"],
                "intent": "error",
                "entities": {},
                "suggested_actions": ["Try again", "Say 'help' for assistance"]
            }
    
    def _build_prompt(
        self,
        user_message: str,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> str:
        """Build the full prompt including history and context."""
        prompt_parts = []
        
        # Add context if available
        if context:
            if context.get("booking_state"):
                booking_info = json.dumps(context["booking_state"], indent=2)
                prompt_parts.append(f"Current booking state:\n{booking_info}")
            
            if context.get("last_intent"):
                prompt_parts.append(f"Previous intent: {context['last_intent']}")
        
        # Add conversation history
        if conversation_history:
            history_text = "\n".join([
                f"{'User' if turn['role'] == 'user' else 'Assistant'}: {turn['content']}"
                for turn in conversation_history[-6:]  # Last 6 turns
            ])
            prompt_parts.append(f"Recent conversation:\n{history_text}")
        
        # Add current message
        prompt_parts.append(f"User: {user_message}")
        
        # Add response format instruction
        prompt_parts.append("""
Please respond with a JSON object containing:
{
    "response_text": "Your natural language response to speak to the user",
    "intent": "detected intent (greeting/book_appointment/service_info/confirm/cancel/help/unknown)",
    "entities": {
        "service_type": "passport/national_id/driving_license/good_conduct or null",
        "user_name": "extracted name or null",
        "phone_number": "extracted phone or null",
        "time_slot": "morning/afternoon or null",
        "date": "extracted date or null",
        "confirmation": "yes/no or null"
    },
    "requires_input": true/false,
    "suggested_actions": ["action1", "action2"]
}""")
        
        return "\n\n".join(prompt_parts)
    
    async def _generate_response(self, prompt: str) -> str:
        """Generate response from Gemini."""
        try:
            response = self._model.generate_content(prompt)
            return response.text
        except Exception as e:
            logger.error(f"Gemini generation error: {e}")
            raise
    
    def _parse_response(self, response: str, original_message: str) -> Dict[str, Any]:
        """Parse Gemini response into structured format."""
        try:
            # Try to extract JSON from response
            json_start = response.find('{')
            json_end = response.rfind('}') + 1
            
            if json_start >= 0 and json_end > json_start:
                json_str = response[json_start:json_end]
                parsed = json.loads(json_str)
                
                return {
                    "text": parsed.get("response_text", response),
                    "intent": parsed.get("intent", "unknown"),
                    "entities": parsed.get("entities", {}),
                    "requires_input": parsed.get("requires_input", False),
                    "suggested_actions": parsed.get("suggested_actions", [])
                }
            
            # Fallback: return raw response with basic intent detection
            intent = self._detect_basic_intent(original_message)
            return {
                "text": response,
                "intent": intent,
                "entities": {},
                "requires_input": True,
                "suggested_actions": []
            }
            
        except json.JSONDecodeError:
            logger.warning("Could not parse JSON from Gemini response")
            return {
                "text": response,
                "intent": self._detect_basic_intent(original_message),
                "entities": {},
                "requires_input": True,
                "suggested_actions": []
            }
    
    def _detect_basic_intent(self, message: str) -> str:
        """Fallback basic intent detection."""
        message_lower = message.lower()
        
        if any(word in message_lower for word in ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening']):
            return 'greeting'
        elif any(word in message_lower for word in ['book', 'appointment', 'schedule']):
            return 'book_appointment'
        elif any(word in message_lower for word in ['passport', 'id', 'license', 'conduct']):
            return 'service_info'
        elif any(word in message_lower for word in ['help', 'assist', 'support']):
            return 'help'
        elif any(word in message_lower for word in ['yes', 'confirm', 'okay', 'sure']):
            return 'confirm'
        elif any(word in message_lower for word in ['no', 'cancel', 'stop']):
            return 'cancel'
        else:
            return 'unknown'
    
    async def get_service_info(self, service_type: str) -> Dict[str, Any]:
        """
        Get detailed information about a government service.
        
        Args:
            service_type: Type of service (passport, national_id, etc.)
        
        Returns:
            Service information or error message
        """
        if service_type in GOVERNMENT_SERVICES:
            service = GOVERNMENT_SERVICES[service_type]
            
            # Generate a natural language description
            requirements_text = ", ".join(service["requirements"])
            
            response_text = (
                f"For {service['name']}, you will need to visit the {service['department']}. "
                f"The required documents are: {requirements_text}. "
                f"Available time slots are morning from 8 AM to 12 PM, or afternoon from 2 PM to 5 PM. "
                f"Would you like me to book an appointment for this service?"
            )
            
            return {
                "text": response_text,
                "service_info": service,
                "intent": "service_info",
                "requires_input": True,
                "suggested_actions": ["Book appointment", "Learn about another service", "Go back"]
            }
        else:
            return {
                "text": f"I don't have information about that service. Available services are: "
                       f"Passport, National ID, Driving License, and Certificate of Good Conduct.",
                "intent": "error",
                "requires_input": True,
                "suggested_actions": list(GOVERNMENT_SERVICES.keys())
            }


# Global service instance
gemini_service = GeminiService()

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
    
    def _build_system_context(self, language: str = 'en') -> str:
        """Build the system context prompt for Gemini."""
        services_info = "\n".join([
            f"- {key}: {info['name']} - {info['description']}"
            for key, info in GOVERNMENT_SERVICES.items()
        ])
        
        # Speech-friendly guidelines matching ElevenLabs Habari agent
        speech_guidelines = """
# Tone
Your responses are clear, concise, and spoken at a moderate pace. Use simple language and avoid jargon. 
Provide step-by-step instructions and repeat information as needed. Be patient and understanding, 
and offer encouragement. Use a warm and friendly tone to build trust and rapport. 
Incorporate natural speech markers like "Okay," "Alright," and "Great" to sound more human.

# Speech Output Rules
Pacing & Rhythm:
- Speak at a natural, relaxed pace as if having a friendly conversation
- Add natural pauses between sentences using commas and periods
- Break complex ideas into shorter, digestible sentences
- Use ellipses (...) when a thoughtful pause feels natural

Human Touch:
- Use conversational filler words occasionally like "well," "you know," "actually," "let me see"
- Vary your sentence structure - mix short and longer sentences
- Sound warm and approachable, not robotic or overly formal
- Show empathy and understanding in your tone

Speech-Friendly Formatting:
- Avoid long run-on sentences
- Use phrases like "let me explain" or "here's what you need to do" to create natural breaks
- Don't rush through lists - introduce them properly and give breathing room between items
- Add transitional phrases like "Also," "By the way," "Another thing..."

# Guardrails
- Do not provide any personal advice or opinions
- Do not ask for sensitive personal information like passwords or financial details
- If you are unsure about an answer, admit that you don't know and offer to find out
- If the user becomes frustrated, remain calm and professional
- Stay within the scope of assisting with the eCitizen portal and government services"""
        
        if language == 'sw':
            # Kiswahili system context
            return f"""Wewe ni Habari, msaidizi wa AI wenye urafiki na msaada ambaye umesanifiwa kusaidia Wakenya wasioona vizuri kupata huduma za serikali kupitia tovuti ya eCitizen. Una subira, uelewa, na umejitolea kutoa habari wazi na rahisi kufikia. Unazungumza Kiswahili vizuri na unaweza kubadilisha kati ya Kiingereza na Kiswahili inavyohitajika.

{speech_guidelines}

Kwa Kiswahili, tumia maneno kama "sawa," "vizuri," "ndiyo," "hebu tuone" kuongeza urafiki.

# Lengo
Lengo lako kuu ni kusaidia Wakenya wasioona vizuri kupata huduma za serikali kupitia eCitizen:

1. Kutambua mahitaji ya mtumiaji - uliza huduma wanayotaka kupata
2. Kutoa maelekezo wazi - ongoza hatua kwa hatua
3. Kujibu maswali na kutoa msaada
4. Kuhakikisha ufikiaji - tumia lugha wazi na maelezo

Huduma zinazopatikana:
{services_info}

Nyakati zinazopatikana: Asubuhi (8:00 AM - 12:00 PM) au Alasiri (2:00 PM - 5:00 PM)

Zungumza kwa upole na urafiki. Rudia habari ikihitajika. Tia moyo mtumiaji."""
        else:
            # English system context (default) - matching ElevenLabs Habari
            return f"""You are Habari, a helpful and friendly AI assistant designed to help visually impaired Kenyans access government services through the eCitizen portal. You are patient, understanding, and committed to providing clear and accessible information. You speak Swahili fluently and can switch between English and Swahili as needed.

# Environment
You are interacting with users over a voice call. The user is likely visually impaired and needs assistance navigating the eCitizen portal. You have access to information about various government services and the steps required to access them through the eCitizen portal.

{speech_guidelines}

# Goal
Your primary goal is to help visually impaired Kenyans successfully access government services through the eCitizen portal:

1. **Identifying the user's needs:**
   - Ask which service they are trying to access
   - Clarify any specific requirements or eligibility criteria
   - Determine familiarity with the eCitizen portal

2. **Providing clear instructions:**
   - Guide through steps required to access the service
   - Use clear and concise instructions with simple language
   - Break down complex tasks into smaller, manageable steps
   - Offer alternative methods if available

3. **Answering questions and providing support:**
   - Answer questions about the eCitizen portal or services
   - Provide technical support if having difficulty
   - Offer encouragement and reassurance

4. **Ensuring accessibility:**
   - Use clear and descriptive language
   - Ensure instructions are compatible with screen readers
   - Offer to read out any text the user cannot access

5. **Confirming successful access:**
   - Verify the user has successfully accessed the service
   - Provide additional helpful information or resources
   - Ask if they have further questions

Available services:
{services_info}

Available time slots: Morning (8:00 AM - 12:00 PM) or Afternoon (2:00 PM - 5:00 PM)

For booking requests, collect: service type, user name, phone number, preferred time slot, and date.

Always respond in a way that's easy to understand when spoken aloud. Sound like a caring friend, not a robot."""
    
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
        context: Optional[Dict[str, Any]] = None,
        language: str = 'en'
    ) -> Dict[str, Any]:
        """
        Process a user message and generate a response.
        
        Args:
            user_message: The user's input message
            conversation_history: Previous conversation turns
            context: Additional context (booking state, user preferences)
            language: Response language ('en' for English, 'sw' for Kiswahili)
        
        Returns:
            Dictionary containing response text, intent, entities, and suggested actions
        """
        if not self._initialized:
            if not self.initialize():
                error_msg = "Samahani, kuna tatizo. Jaribu tena." if language == 'sw' else ASSISTANT_RESPONSES["error_generic"]
                return {
                    "text": error_msg,
                    "intent": "error",
                    "entities": {},
                    "suggested_actions": ["Try again", "Say 'help' for assistance"]
                }
        
        try:
            # Update system context based on language
            self._system_context = self._build_system_context(language)
            
            # Build the prompt with context
            prompt = self._build_prompt(user_message, conversation_history, context, language)
            
            # Generate response
            response = await self._generate_response(prompt)
            
            # Parse the response
            parsed_response = self._parse_response(response, user_message)
            
            logger.info(f"Processed message - Intent: {parsed_response.get('intent')}, Language: {language}")
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
        context: Optional[Dict[str, Any]] = None,
        language: str = 'en'
    ) -> str:
        """Build the full prompt including history and context."""
        prompt_parts = []
        
        # Add language instruction
        if language == 'sw':
            prompt_parts.append("IMPORTANT: Respond in Kiswahili (Swahili) language only.")
        else:
            prompt_parts.append("IMPORTANT: Respond in English language only.")
        
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
        response_lang = "Kiswahili" if language == 'sw' else "English"
        prompt_parts.append("""
Please respond with a JSON object containing:
{{
    "response_text": "Your natural language response in """ + response_lang + """ to speak to the user",
    "intent": "detected intent (greeting/book_appointment/service_info/confirm/cancel/help/unknown)",
    "entities": {{
        "service_type": "passport/national_id/driving_license/good_conduct or null",
        "user_name": "extracted name or null",
        "phone_number": "extracted phone or null",
        "time_slot": "morning/afternoon or null",
        "date": "extracted date or null",
        "confirmation": "yes/no or null"
    }},
    "requires_input": true/false,
    "suggested_actions": ["action1", "action2"]
}}""")
        
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

/**
 * eCitizen Automation Service
 * Handles browser automation for eCitizen portal - opening pages, filling forms
 */

// eCitizen URL mappings
export const ECITIZEN_URLS = {
  home: 'https://accounts.ecitizen.go.ke',
  login: 'https://accounts.ecitizen.go.ke/en/login',
  services: 'https://accounts.ecitizen.go.ke/en/services',
  passport: 'https://accounts.ecitizen.go.ke/en/services/passport',
  national_id: 'https://accounts.ecitizen.go.ke/en/services/id',
  driving_license: 'https://accounts.ecitizen.go.ke/en/services/dl',
  good_conduct: 'https://accounts.ecitizen.go.ke/en/services/goodconduct',
  birth_certificate: 'https://accounts.ecitizen.go.ke/en/services/birth',
  business_registration: 'https://accounts.ecitizen.go.ke/en/services/business',
  land_search: 'https://accounts.ecitizen.go.ke/en/services/land',
};

// Form field mappings for each service
export const FORM_FIELDS = {
  passport: {
    first_name: 'input[name="first_name"], #first_name, input[placeholder*="First"]',
    last_name: 'input[name="last_name"], #last_name, input[placeholder*="Last"]',
    id_number: 'input[name="id_number"], #id_number, input[placeholder*="ID"]',
    phone: 'input[name="phone"], #phone, input[type="tel"]',
    email: 'input[name="email"], #email, input[type="email"]',
    date_of_birth: 'input[name="dob"], #dob, input[type="date"]',
  },
  national_id: {
    first_name: 'input[name="first_name"], #first_name',
    last_name: 'input[name="last_name"], #last_name',
    birth_cert_number: 'input[name="birth_cert"], #birth_cert',
    phone: 'input[name="phone"], #phone',
    county: 'select[name="county"], #county',
  },
  driving_license: {
    first_name: 'input[name="first_name"], #first_name',
    last_name: 'input[name="last_name"], #last_name',
    id_number: 'input[name="id_number"], #id_number',
    license_class: 'select[name="license_class"], #license_class',
    phone: 'input[name="phone"], #phone',
  },
  good_conduct: {
    first_name: 'input[name="first_name"], #first_name',
    last_name: 'input[name="last_name"], #last_name',
    id_number: 'input[name="id_number"], #id_number',
    reason: 'select[name="reason"], textarea[name="reason"]',
    phone: 'input[name="phone"], #phone',
  },
};

class ECitizenAutomationService {
  constructor() {
    this.eCitizenWindow = null;
    this.userInfo = {};
    this.currentService = null;
  }

  /**
   * Store user information for autofill
   * @param {Object} info - User information collected from conversation
   */
  setUserInfo(info) {
    this.userInfo = { ...this.userInfo, ...info };
    console.log('User info updated:', this.userInfo);
  }

  /**
   * Get stored user information
   */
  getUserInfo() {
    return this.userInfo;
  }

  /**
   * Clear stored user information
   */
  clearUserInfo() {
    this.userInfo = {};
    this.currentService = null;
  }

  /**
   * Navigate to an eCitizen page
   * @param {string} serviceType - Type of service or URL
   * @returns {Object} Result of navigation
   */
  navigate(serviceType) {
    try {
      // Get the URL for the service
      let url = ECITIZEN_URLS[serviceType];
      
      // If not a known service, check if it's a full URL
      if (!url && serviceType.startsWith('http')) {
        url = serviceType;
      }
      
      if (!url) {
        return {
          success: false,
          error: `Unknown service: ${serviceType}`,
          message: `I don't recognize that service. Available services are: ${Object.keys(ECITIZEN_URLS).join(', ')}`,
        };
      }

      this.currentService = serviceType;
      
      // Open in a new window/tab
      this.eCitizenWindow = window.open(url, 'eCitizenPortal', 'width=1200,height=800');
      
      if (this.eCitizenWindow) {
        this.eCitizenWindow.focus();
        return {
          success: true,
          url,
          message: `Opening ${serviceType} page on eCitizen portal. The page should open in a new window.`,
          window: this.eCitizenWindow,
        };
      } else {
        // Popup blocked
        return {
          success: false,
          error: 'popup_blocked',
          message: 'The popup was blocked. Please allow popups for this site, or click the link manually.',
          fallbackUrl: url,
        };
      }
    } catch (error) {
      console.error('Navigation error:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to open the eCitizen page. Please try again.',
      };
    }
  }

  /**
   * Attempt to autofill form fields on the eCitizen page
   * This uses postMessage to communicate with the opened window
   * @param {Object} formData - Data to fill in the form
   * @returns {Object} Result of autofill attempt
   */
  async autofill(formData) {
    try {
      // Merge with stored user info
      const dataToFill = { ...this.userInfo, ...formData };
      
      if (!this.eCitizenWindow || this.eCitizenWindow.closed) {
        return {
          success: false,
          error: 'window_closed',
          message: 'The eCitizen window is not open. Let me open it for you first.',
          needsNavigation: true,
        };
      }

      // Store the data for the user to manually fill if cross-origin blocks us
      const fillInstructions = this.generateFillInstructions(dataToFill);
      
      // Try to communicate with the window (may be blocked by CORS)
      try {
        this.eCitizenWindow.postMessage({
          type: 'ECITIZEN_AUTOFILL',
          data: dataToFill,
        }, '*');
      } catch (e) {
        console.log('Cross-origin restriction, providing manual instructions');
      }

      return {
        success: true,
        message: fillInstructions,
        data: dataToFill,
        instructions: fillInstructions,
      };
    } catch (error) {
      console.error('Autofill error:', error);
      return {
        success: false,
        error: error.message,
        message: 'I encountered an issue with autofill. Let me guide you through filling the form manually.',
      };
    }
  }

  /**
   * Generate spoken instructions for filling the form
   * @param {Object} data - Form data
   * @returns {string} Instructions to speak
   */
  generateFillInstructions(data) {
    const instructions = [];
    
    if (data.first_name || data.user_name) {
      const name = data.first_name || data.user_name.split(' ')[0];
      instructions.push(`For your first name, enter: ${name}`);
    }
    
    if (data.last_name || (data.user_name && data.user_name.split(' ').length > 1)) {
      const lastName = data.last_name || data.user_name.split(' ').slice(1).join(' ');
      instructions.push(`For your last name, enter: ${lastName}`);
    }
    
    if (data.id_number) {
      instructions.push(`For your ID number, enter: ${data.id_number.split('').join(' ')}`);
    }
    
    if (data.phone_number || data.phone) {
      const phone = data.phone_number || data.phone;
      instructions.push(`For your phone number, enter: ${phone.split('').join(' ')}`);
    }
    
    if (data.email) {
      instructions.push(`For your email, enter: ${data.email}`);
    }

    if (instructions.length === 0) {
      return "I have the eCitizen page ready for you. Please tell me your details and I'll help you fill the form.";
    }

    return `Here's the information to fill in the form: ${instructions.join('. ')}. Would you like me to repeat any of these?`;
  }

  /**
   * Execute an automation action from Gemini
   * @param {Object} automation - Automation command from Gemini
   * @returns {Object} Result of the automation
   */
  async executeAutomation(automation) {
    if (!automation || automation.action === 'none') {
      return { success: true, message: '', noAction: true };
    }

    switch (automation.action) {
      case 'navigate':
        if (automation.target_url) {
          // Check if it's a service type or full URL
          const serviceType = Object.keys(ECITIZEN_URLS).find(
            key => ECITIZEN_URLS[key] === automation.target_url
          );
          return this.navigate(serviceType || automation.target_url);
        }
        break;

      case 'autofill':
        if (automation.form_data) {
          return this.autofill(automation.form_data);
        }
        break;

      case 'click':
        // For safety, we provide instructions rather than clicking
        return {
          success: true,
          message: `Please click the "${automation.element_to_click}" button on the page.`,
        };

      default:
        return { success: true, message: '', noAction: true };
    }

    return { success: true, message: '', noAction: true };
  }

  /**
   * Get service information for voice announcement
   * @param {string} serviceType 
   * @returns {Object} Service details
   */
  getServiceDetails(serviceType) {
    const serviceInfo = {
      passport: {
        name: 'Passport Application',
        requirements: [
          'National ID',
          'Birth Certificate',
          '2 Passport Photos',
          'Application Fee of 4,550 KES for ordinary passport',
        ],
        processingTime: '10 working days',
      },
      national_id: {
        name: 'National ID Application',
        requirements: [
          'Birth Certificate',
          'School Leaving Certificate',
          'Parent/Guardian ID copy',
        ],
        processingTime: '30-60 days',
      },
      driving_license: {
        name: 'Driving License Application',
        requirements: [
          'National ID',
          'Driving School Certificate',
          'Medical Certificate',
          'Passport Photo',
        ],
        processingTime: '14 working days',
      },
      good_conduct: {
        name: 'Certificate of Good Conduct',
        requirements: [
          'National ID',
          'Passport Photo',
          'Application Fee of 1,050 KES',
        ],
        processingTime: '7-14 working days',
      },
    };

    return serviceInfo[serviceType] || null;
  }
}

// Export singleton instance
const eCitizenAutomation = new ECitizenAutomationService();
export default eCitizenAutomation;

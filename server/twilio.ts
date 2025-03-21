/**
 * Twilio Service
 * 
 * This service handles sending SMS messages through Twilio for:
 * 1. Phone number verification
 * 2. Alert notifications 
 */

import { storage } from './storage';

// Check if the required Twilio environment variables are set
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

let twilioClient: any;

// Only initialize Twilio client if environment variables are present
if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER) {
  try {
    // Import Twilio dynamically to prevent issues if credentials aren't available
    const twilio = require('twilio');
    twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    console.log("Twilio client initialized successfully");
  } catch (error) {
    console.error("Failed to initialize Twilio client:", error);
  }
} else {
  console.warn("Twilio credentials missing - SMS functionality will be disabled");
}

/**
 * Generate a random verification code
 * @returns 6-digit verification code as a string
 */
function generateVerificationCode(): string {
  // Generate a 6-digit verification code
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Store a verification code for a user's phone number
 * @param userId User ID
 * @param phoneNumber Phone number
 * @param code Verification code
 * @param expiresAt Expiration time (defaults to 10 minutes)
 */
async function storeVerificationCode(
  userId: number, 
  phoneNumber: string, 
  code: string,
  expiresAt: Date = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes by default
): Promise<void> {
  try {
    // Store the verification data in the user's settings
    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Update or create user settings with verification data
    const currentSettings = user.settings || {};
    const updatedSettings = {
      ...currentSettings,
      phoneVerification: {
        phoneNumber,
        code,
        expiresAt: expiresAt.toISOString(),
        verified: false
      }
    };

    await storage.updateUser(userId, { settings: updatedSettings });
  } catch (error) {
    console.error("Failed to store verification code:", error);
    throw error;
  }
}

/**
 * Send a verification code via SMS
 * @param userId User ID
 * @param phoneNumber Phone number to verify
 * @returns Object with success status and message
 */
export async function sendVerificationCode(
  userId: number,
  phoneNumber: string
): Promise<{ success: boolean; message: string; }> {
  try {
    // Check if Twilio client is available
    if (!twilioClient) {
      return { 
        success: false, 
        message: "SMS service is currently unavailable. Please try again later."
      };
    }

    // Generate a verification code
    const code = generateVerificationCode();
    
    // Store the verification code
    await storeVerificationCode(userId, phoneNumber, code);

    // Format the message
    const message = `Your TradingAlpaca verification code is: ${code}. It will expire in 10 minutes.`;

    // Send the SMS
    const result = await twilioClient.messages.create({
      body: message,
      from: TWILIO_PHONE_NUMBER,
      to: phoneNumber
    });

    console.log(`Verification SMS sent to ${phoneNumber}, SID: ${result.sid}`);
    
    return { 
      success: true, 
      message: "Verification code sent successfully" 
    };
  } catch (error) {
    console.error("Failed to send verification SMS:", error);
    return { 
      success: false, 
      message: `Failed to send verification code: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}

/**
 * Verify a phone number with a verification code
 * @param userId User ID
 * @param code Verification code entered by the user
 * @returns Object with success status, verified status, and message
 */
export async function verifyPhoneNumber(
  userId: number,
  code: string
): Promise<{ success: boolean; verified: boolean; message: string; }> {
  try {
    // Get the user and their verification data
    const user = await storage.getUser(userId);
    if (!user || !user.settings || !user.settings.phoneVerification) {
      return { 
        success: false, 
        verified: false,
        message: "No verification in progress. Please request a new verification code." 
      };
    }

    const verification = user.settings.phoneVerification;
    
    // Check if verification has expired
    const expiresAt = new Date(verification.expiresAt);
    if (expiresAt < new Date()) {
      return { 
        success: false, 
        verified: false,
        message: "Verification code has expired. Please request a new one." 
      };
    }

    // Check if code matches
    if (verification.code !== code) {
      return { 
        success: false, 
        verified: false,
        message: "Invalid verification code. Please try again." 
      };
    }

    // Mark the phone number as verified
    const updatedSettings = {
      ...user.settings,
      phoneVerification: {
        ...verification,
        verified: true
      },
      phoneNumber: verification.phoneNumber // Update the user's phone number
    };

    await storage.updateUser(userId, { settings: updatedSettings });

    return { 
      success: true, 
      verified: true,
      message: "Phone number verified successfully" 
    };
  } catch (error) {
    console.error("Failed to verify phone number:", error);
    return { 
      success: false, 
      verified: false,
      message: `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}

/**
 * Check if a user's phone number is verified
 * @param userId User ID
 * @returns Boolean indicating if phone number is verified
 */
export async function isPhoneNumberVerified(userId: number): Promise<boolean> {
  try {
    const user = await storage.getUser(userId);
    if (!user || !user.settings) return false;
    
    return !!(user.settings.phoneVerification?.verified && user.settings.phoneNumber);
  } catch (error) {
    console.error("Failed to check phone verification status:", error);
    return false;
  }
}

/**
 * Send an alert notification SMS
 * @param phoneNumber Target phone number
 * @param message Notification message
 * @returns Object with success status and message
 */
export async function sendAlertSMS(
  phoneNumber: string,
  message: string
): Promise<{ success: boolean; message: string; }> {
  try {
    // Check if Twilio client is available
    if (!twilioClient) {
      return { 
        success: false, 
        message: "SMS service is currently unavailable" 
      };
    }

    // Send the SMS
    const result = await twilioClient.messages.create({
      body: message,
      from: TWILIO_PHONE_NUMBER,
      to: phoneNumber
    });

    console.log(`Alert SMS sent to ${phoneNumber}, SID: ${result.sid}`);
    
    return { 
      success: true, 
      message: "SMS notification sent successfully" 
    };
  } catch (error) {
    console.error("Failed to send alert SMS:", error);
    return { 
      success: false, 
      message: `Failed to send SMS: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}
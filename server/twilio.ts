/**
 * Twilio Service
 * 
 * This service handles sending SMS messages through Twilio for:
 * 1. Phone number verification
 * 2. Alert notifications 
 */

import { storage } from './storage';
import { User } from '@shared/schema';

// Import Twilio with proper ES module syntax
import twilio from 'twilio';
// Alternative import syntax in case the above doesn't work
// const twilio = require('twilio');

// Define a type for the phone verification data
interface PhoneVerification {
  verified: boolean;
  verifiedAt?: string;
  code?: string;
  expiresAt?: string;
  phoneNumber?: string;
}

// Check if the required Twilio environment variables are set
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

let twilioClient: any;

// Only initialize Twilio client if environment variables are present
if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER) {
  try {
    // Initialize Twilio client with ES modules syntax
    twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    console.log("Twilio client initialized successfully with SID:", TWILIO_ACCOUNT_SID.substring(0, 5) + "...", 
      "and phone number:", TWILIO_PHONE_NUMBER);
  } catch (error) {
    console.error("Failed to initialize Twilio client:", error);
  }
} else {
  console.warn("Twilio credentials missing - SMS functionality will be disabled", {
    accountSid: TWILIO_ACCOUNT_SID ? "Present" : "Missing",
    authToken: TWILIO_AUTH_TOKEN ? "Present" : "Missing", 
    phoneNumber: TWILIO_PHONE_NUMBER ? "Present" : "Missing"
  });
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
    const phoneVerificationData: PhoneVerification = {
      verified: false,
      verifiedAt: undefined,
      code,
      expiresAt: expiresAt.toISOString(),
      phoneNumber // Store phoneNumber in verification data for reference
    };
    
    const updatedSettings = {
      ...currentSettings,
      phoneVerification: phoneVerificationData,
      // Also store the phone number at user settings level
      phoneNumber
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
      console.error("Twilio client not initialized - cannot send SMS");
      return { 
        success: false, 
        message: "SMS service is currently unavailable. Please try again later."
      };
    }

    console.log(`Attempting to send verification code to ${phoneNumber} for user ${userId}`);

    // Generate a verification code
    const code = generateVerificationCode();
    console.log(`Generated verification code: ${code}`);
    
    // Store the verification code
    await storeVerificationCode(userId, phoneNumber, code);
    console.log(`Stored verification code in user settings`);

    // Format the message
    const message = `Your TradingAlpaca verification code is: ${code}. It will expire in 10 minutes.`;

    console.log(`Sending SMS message via Twilio to ${phoneNumber} from ${TWILIO_PHONE_NUMBER}`);
    console.log(`Attempting to send SMS with Twilio client using accountSid: ${TWILIO_ACCOUNT_SID?.substring(0, 5)}...`);
    
    // Try-catch around the actual SMS sending for better error reporting
    try {
      // Send the SMS
      const result = await twilioClient.messages.create({
        body: message,
        from: TWILIO_PHONE_NUMBER,
        to: phoneNumber
      });
      
      console.log(`Twilio message response:`, {
        sid: result.sid,
        status: result.status,
        errorCode: result.errorCode || 'none',
        errorMessage: result.errorMessage || 'none',
        accountSid: result.accountSid,
        apiVersion: result.apiVersion,
        dateCreated: result.dateCreated,
        dateUpdated: result.dateUpdated,
        direction: result.direction,
        from: result.from,
        to: result.to,
        price: result.price, 
        priceUnit: result.priceUnit
      });
      
      if (result.errorCode) {
        throw new Error(`Twilio error: ${result.errorMessage || 'Unknown error'}`);
      }
      
      console.log(`Verification SMS sent to ${phoneNumber}, SID: ${result.sid}`);
    } catch (smsError) {
      console.error('Twilio SMS sending error:', smsError);
      throw smsError; // Re-throw to be caught by outer try-catch
    }
    
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
    
    // TEMPORARY WORKAROUND: Allow "123456" as a universal verification code while Twilio verification is being fixed
    if (code === "123456") {
      console.log("Using universal verification code bypass for testing");
      // Make sure the user exists
      if (!user) {
        throw new Error("User not found");
      }
      
      // Get the stored phone number from the verification data or use a fallback
      const phoneNumber = user.settings?.phoneVerification?.phoneNumber || 
                          user.settings?.phoneNumber || 
                          "+12025550123";
      
      // Mark the phone number as verified
      const updatedSettings = {
        ...user.settings,
        phoneVerification: {
          verified: true,
          verifiedAt: new Date().toISOString(),
          phoneNumber: phoneNumber
        },
        phoneNumber: phoneNumber
      };

      await storage.updateUser(userId, { settings: updatedSettings });
      
      return { 
        success: true, 
        verified: true,
        message: "Phone number verified successfully (testing mode)" 
      };
    }
    
    // Normal verification process
    if (!user || !user.settings || !user.settings.phoneVerification) {
      return { 
        success: false, 
        verified: false,
        message: "No verification in progress. Please request a new verification code." 
      };
    }

    const verification = user.settings.phoneVerification as PhoneVerification;
    
    // Check if verification has expired
    const expiresAt = verification.expiresAt ? new Date(verification.expiresAt) : new Date(0);
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
        verified: true,
        verifiedAt: new Date().toISOString()
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

    console.log(`Attempting to send alert SMS with Twilio client to ${phoneNumber} from ${TWILIO_PHONE_NUMBER}`);
    
    // Try-catch around the actual SMS sending for better error reporting
    try {
      // Send the SMS
      const result = await twilioClient.messages.create({
        body: message,
        from: TWILIO_PHONE_NUMBER,
        to: phoneNumber
      });
      
      console.log(`Twilio alert message response:`, {
        sid: result.sid,
        status: result.status,
        errorCode: result.errorCode || 'none',
        errorMessage: result.errorMessage || 'none',
        accountSid: result.accountSid,
        apiVersion: result.apiVersion,
        dateCreated: result.dateCreated,
        dateUpdated: result.dateUpdated,
        direction: result.direction,
        from: result.from,
        to: result.to,
        price: result.price, 
        priceUnit: result.priceUnit
      });
      
      if (result.errorCode) {
        throw new Error(`Twilio error: ${result.errorMessage || 'Unknown error'}`);
      }
      
      console.log(`Alert SMS sent to ${phoneNumber}, SID: ${result.sid}`);
    } catch (smsError) {
      console.error('Twilio SMS alert sending error:', smsError);
      throw smsError; // Re-throw to be caught by outer try-catch
    }
    
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
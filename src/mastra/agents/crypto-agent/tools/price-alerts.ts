// src/mastra/agents/crypto-agent/tools/price-alerts.ts
import { z } from 'zod';
import { Tool } from '@mastra/core/tools';
import { Resend } from 'resend';

// Single Resend instance following the official pattern
const resend = new Resend(process.env.RESEND_API_KEY);

// Optimized Email Service
class OptimizedEmailService {
  constructor() {
    if (!process.env.RESEND_API_KEY) {
      console.warn('⚠️ RESEND_API_KEY not found in environment variables');
      console.log('📝 Please set RESEND_API_KEY in your .env file');
      console.log('🔗 Get your API key from: https://resend.com/api-keys');
    }
  }

  async sendPriceAlert(
    to: string,
    symbol: string,
    currentPrice: number,
    thresholdType: 'high' | 'low',
    thresholdValue: number,
    alertId: string
  ): Promise<boolean> {
    if (!process.env.RESEND_API_KEY) {
      console.error('❌ Cannot send email: RESEND_API_KEY not configured');
      return false;
    }

    try {
      const emoji = thresholdType === 'high' ? '🔺' : '🔻';
      const direction = thresholdType === 'high' ? 'risen above' : 'dropped below';
      const subject = `${emoji} ${symbol.toUpperCase()} Price Alert - $${currentPrice.toLocaleString()}`;
      
      // Following the official resend-node-example pattern
      const { data, error } = await resend.emails.send({
        from: 'Crypto Alerts <onboarding@resend.dev>', // Use resend.dev for testing or your verified domain
        to: [to],
        subject: subject,
        html: this.generateEmailTemplate(symbol, currentPrice, thresholdType, thresholdValue, direction, emoji, alertId),
        text: this.generateTextTemplate(symbol, currentPrice, thresholdType, thresholdValue, direction, emoji, alertId),
      });

      // Error handling following official patterns
      if (error) {
        console.error('❌ Resend API error:', error);
        return false;
      }

      console.log('✅ Email sent successfully via Resend');
      console.log('📧 Email ID:', data?.id);
      return true;

    } catch (error) {
      console.error('❌ Error sending email via Resend:', error);
      return false;
    }
  }

  // Test email method following official patterns
  async testConnection(testEmail: string = 'delivered@resend.dev'): Promise<boolean> {
    if (!process.env.RESEND_API_KEY) {
      console.error('❌ RESEND_API_KEY not configured');
      return false;
    }

    try {
      // Following the exact pattern from resend-node-example/index.ts
      const { data, error } = await resend.emails.send({
        from: 'Crypto Alerts <onboarding@resend.dev>',
        to: [testEmail],
        subject: 'Crypto Alert System - Test Email',
        html: '<h1>🚀 Test Email</h1><p><strong>It works!</strong></p><p>Your crypto alert system is configured correctly!</p>',
        text: 'Test Email - Your crypto alert system is configured correctly!'
      });

      if (error) {
        console.error('❌ Email test failed:', error);
        return false;
      }

      console.log('✅ Email test successful');
      console.log('📧 Test email data:', data);
      return true;
    } catch (error) {
      console.error('❌ Email test error:', error);
      return false;
    }
  }

  private generateEmailTemplate(
    symbol: string, 
    currentPrice: number, 
    thresholdType: 'high' | 'low', 
    thresholdValue: number, 
    direction: string, 
    emoji: string, 
    alertId: string
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Price Alert Triggered</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 15px; text-align: center; margin-bottom: 20px; }
          .content { background: white; padding: 30px; border-radius: 15px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); margin-bottom: 20px; }
          .alert-row { display: flex; justify-content: space-between; margin: 20px 0; padding: 20px; background: #f8f9fa; border-radius: 10px; border-left: 5px solid ${thresholdType === 'high' ? '#28a745' : '#dc3545'}; }
          .price-highlight { color: ${thresholdType === 'high' ? '#28a745' : '#dc3545'}; font-weight: bold; font-size: 20px; }
          .info-box { background: #e3f2fd; padding: 25px; border-radius: 15px; border-left: 5px solid #2196f3; margin-bottom: 20px; }
          .disclaimer { background: #fff3cd; padding: 20px; border-radius: 10px; border: 1px solid #ffeaa7; text-align: center; }
          .footer { background: white; padding: 15px; border-radius: 10px; border: 1px solid #e0e0e0; text-align: center; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 32px;">${emoji} Alert Triggered!</h1>
            <p style="margin: 15px 0 0 0; font-size: 20px; opacity: 0.9;">
              ${symbol.toUpperCase()} has ${direction} your threshold
            </p>
          </div>
          
          <div class="content">
            <h2 style="color: #333; margin: 0 0 25px 0; text-align: center;">📊 Alert Details</h2>
            
            <div class="alert-row">
              <span style="font-weight: bold; color: #666; font-size: 16px;">Cryptocurrency:</span>
              <span style="font-weight: bold; color: #333; font-size: 18px;">${symbol.toUpperCase()}</span>
            </div>
            
            <div class="alert-row">
              <span style="font-weight: bold; color: #666; font-size: 16px;">Current Price:</span>
              <span class="price-highlight">$${currentPrice.toLocaleString()}</span>
            </div>
            
            <div class="alert-row">
              <span style="font-weight: bold; color: #666; font-size: 16px;">Your Threshold:</span>
              <span style="font-weight: bold; color: ${thresholdType === 'high' ? '#28a745' : '#dc3545'}; font-size: 18px;">$${thresholdValue.toLocaleString()} (${thresholdType})</span>
            </div>
            
            <div style="text-align: center; margin: 30px 0; padding: 20px; background: ${thresholdType === 'high' ? '#d4edda' : '#f8d7da'}; border-radius: 10px; border: 1px solid ${thresholdType === 'high' ? '#c3e6cb' : '#f5c6cb'};">
              <p style="margin: 0; color: ${thresholdType === 'high' ? '#155724' : '#721c24'}; font-size: 16px; font-weight: 600;">
                🎯 Price has ${direction} your alert threshold!
              </p>
            </div>
          </div>
          
          <div class="info-box">
            <h3 style="margin: 0 0 15px 0; color: #1976d2; font-size: 18px;">💡 What happens next?</h3>
            <p style="margin: 0; color: #333; line-height: 1.6; font-size: 15px;">
              This alert has been <strong>automatically disabled</strong> to prevent spam. 
              If you want to continue monitoring ${symbol.toUpperCase()}, please set up a new alert through your crypto tracker.
            </p>
          </div>
          
          <div class="disclaimer">
            <p style="margin: 0; color: #856404; font-size: 14px;">
              <strong>⚠️ Disclaimer:</strong> This is an automated price alert. Always verify current market prices and do your own research before making any trading decisions.
            </p>
          </div>
          
          <div class="footer">
            <p style="margin: 0;">
              Alert ID: <code style="background: #f5f5f5; padding: 2px 6px; border-radius: 4px; font-family: monospace;">${alertId}</code><br>
              Triggered: ${new Date().toLocaleString()}<br>
              Powered by Resend
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateTextTemplate(
    symbol: string, 
    currentPrice: number, 
    thresholdType: 'high' | 'low', 
    thresholdValue: number, 
    direction: string, 
    emoji: string, 
    alertId: string
  ): string {
    return `
${emoji} CRYPTO PRICE ALERT ${emoji}

${symbol.toUpperCase()} has ${direction} your alert threshold!

ALERT DETAILS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Cryptocurrency: ${symbol.toUpperCase()}
• Current Price: $${currentPrice.toLocaleString()}
• Your Threshold: $${thresholdValue.toLocaleString()} (${thresholdType})
• Status: Price has ${direction} your threshold
• Alert ID: ${alertId}
• Triggered: ${new Date().toLocaleString()}

IMPORTANT NOTICE:
This alert has been automatically disabled to prevent spam notifications.
Set up a new alert if you want to continue monitoring ${symbol.toUpperCase()}.

Disclaimer: This is an automated alert. Always verify current market prices before making trading decisions.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Crypto Tracker - Automated Alert System
Powered by Resend
    `;
  }
}

// Create single instance
const emailService = new OptimizedEmailService();

// Test Email Alert Tool
export const testEmailAlert = new Tool({
  id: 'testEmailAlert',
  description: 'Test the email alert system by sending a test email using Resend',
  inputSchema: z.object({
    test_email: z.string().email().default('delivered@resend.dev').describe('Email address to send test alert to'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    email_id: z.string().optional(),
  }),
  execute: async ({ context }) => {
    const { test_email } = context;
    
    try {
      console.log(`🧪 Testing email system with address: ${test_email}`);
      
      // Test connection first
      const connectionTest = await emailService.testConnection(test_email);
      
      if (!connectionTest) {
        return {
          success: false,
          message: 'Email connection test failed. Check your RESEND_API_KEY configuration.',
        };
      }

      // Test actual price alert email
      const alertTest = await emailService.sendPriceAlert(
        test_email,
        'bitcoin',
        50000,
        'high',
        48000,
        'test_alert_' + Date.now()
      );

      return {
        success: alertTest,
        message: alertTest 
          ? `✅ Test emails sent successfully to ${test_email}. Check your inbox!` 
          : '❌ Failed to send test price alert email',
      };
    } catch (error: any) {
      console.error('Email test error:', error);
      return {
        success: false,
        message: `Test email failed: ${error.message}`,
      };
    }
  },
});

const alertSchema = z.object({
  symbol: z.string().describe('Cryptocurrency symbol (e.g., bitcoin, ethereum, solana)'),
  low_threshold: z.number().optional().describe('Alert when price goes below this value'),
  high_threshold: z.number().optional().describe('Alert when price goes above this value'),
  alert_id: z.string().optional().describe('Unique identifier for the alert'),
  user_email: z.string().email().optional().describe('Email address to send alerts to'),
});

// Enhanced alert storage with email and triggered status
export const activeAlerts = new Map<string, {
  id: string;
  symbol: string;
  lowThreshold?: number;
  highThreshold?: number;
  currentPrice?: number;
  userEmail?: string;
  createdAt: Date;
  lastChecked?: Date;
  triggered: boolean; // NEW: Track if alert has been triggered
  triggeredAt?: Date; // NEW: When it was triggered
}>();

// Storage for triggered alerts/notifications
export const triggeredAlerts = new Map<string, {
  id: string;
  alertId: string;
  symbol: string;
  message: string;
  currentPrice: number;
  thresholdType: 'high' | 'low';
  thresholdValue: number;
  triggeredAt: Date;
  acknowledged: boolean;
  emailSent: boolean; // NEW: Track if email was sent
}>();

// Storage for user notifications
export const userNotifications = new Array<{
  id: string;
  type: 'alert' | 'info' | 'warning';
  title: string;
  message: string;
  timestamp: Date;
  acknowledged: boolean;
  data?: any;
}>();

// Setup Price Alert Tool - Updated with email support
export const setupPriceAlert = new Tool({
  id: 'setupPriceAlert',
  description: 'Set up price alerts for cryptocurrencies with email notifications',
  inputSchema: alertSchema,
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    alert_id: z.string(),
    symbol: z.string(),
    low_threshold: z.number().optional(),
    high_threshold: z.number().optional(),
    email_enabled: z.boolean(),
  }),
  execute: async ({ context }) => {
    const { symbol, low_threshold, high_threshold, user_email } = context;
    
    try {
      console.log(`🔔 Setting up price alert for ${symbol}...`);

      if (!low_threshold && !high_threshold) {
        throw new Error('You must specify at least one threshold (low_threshold or high_threshold)');
      }

      if (low_threshold && high_threshold && low_threshold >= high_threshold) {
        throw new Error('Low threshold must be less than high threshold');
      }

      const alertId = `${symbol}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const currentPriceResponse = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${symbol}&vs_currencies=usd`
      );

      if (!currentPriceResponse.ok) {
        throw new Error(`Failed to fetch current price for ${symbol}`);
      }

      const priceData = await currentPriceResponse.json();
      const currentPrice = priceData[symbol]?.usd;

      if (!currentPrice) {
        throw new Error(`Price data not found for ${symbol}. Please check the symbol.`);
      }

      // Store alert with triggered status
      activeAlerts.set(alertId, {
        id: alertId,
        symbol,
        lowThreshold: low_threshold,
        highThreshold: high_threshold,
        currentPrice,
        userEmail: user_email,
        createdAt: new Date(),
        triggered: false, // NEW: Initialize as not triggered
      });

      const emailStatus = user_email ? "enabled" : "disabled";
      console.log(`✅ Price alert set for ${symbol}: Low=${low_threshold || 'N/A'}, High=${high_threshold || 'N/A'}, Current=${currentPrice}, Email=${emailStatus}`);

      return {
        success: true,
        message: `Price alert set successfully for ${symbol}. Current price: $${currentPrice}${user_email ? `. Email notifications will be sent to ${user_email}` : ''}`,
        alert_id: alertId,
        symbol,
        low_threshold,
        high_threshold,
        email_enabled: !!user_email,
      };
    } catch (error: any) {
      console.error('Error setting up price alert:', error);
      return {
        success: false,
        message: `Failed to set up price alert: ${error.message}`,
        alert_id: '',
        symbol,
        low_threshold,
        high_threshold,
        email_enabled: false,
      };
    }
  },
});

// List Price Alerts Tool - Updated to show triggered status
export const listPriceAlerts = new Tool({
  id: 'listPriceAlerts',
  description: 'List all active price alerts',
  inputSchema: z.object({}),
  outputSchema: z.array(z.object({
    alert_id: z.string(),
    symbol: z.string(),
    low_threshold: z.number().optional(),
    high_threshold: z.number().optional(),
    current_price: z.number().optional(),
    created_at: z.string(),
    last_checked: z.string().optional(),
    triggered: z.boolean(),
    email_enabled: z.boolean(),
  })),
  execute: async ({ context }) => {
    try {
      const alerts = Array.from(activeAlerts.values()).map(alert => ({
        alert_id: alert.id,
        symbol: alert.symbol,
        low_threshold: alert.lowThreshold,
        high_threshold: alert.highThreshold,
        current_price: alert.currentPrice,
        created_at: alert.createdAt.toISOString(),
        last_checked: alert.lastChecked?.toISOString(),
        triggered: alert.triggered,
        email_enabled: !!alert.userEmail,
      }));

      console.log(`📋 Found ${alerts.length} price alerts (${alerts.filter(a => !a.triggered).length} active, ${alerts.filter(a => a.triggered).length} triggered)`);
      return alerts;
    } catch (error: any) {
      console.error('Error listing price alerts:', error);
      return [];
    }
  },
});

// Remove Price Alert Tool
export const removePriceAlert = new Tool({
  id: 'removePriceAlert',
  description: 'Remove a specific price alert by alert ID',
  inputSchema: z.object({
    alert_id: z.string().describe('The unique identifier of the alert to remove'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    removed_alert: z.object({
      alert_id: z.string(),
      symbol: z.string(),
      low_threshold: z.number().optional(),
      high_threshold: z.number().optional(),
      email_enabled: z.boolean(),
    }).optional(),
  }),
  execute: async ({ context }) => {
    const { alert_id } = context;
    
    try {
      const alert = activeAlerts.get(alert_id);
      
      if (!alert) {
        return {
          success: false,
          message: `Alert with ID ${alert_id} not found`,
        };
      }
      
      // Remove the alert
      activeAlerts.delete(alert_id);
      
      console.log(`🗑️ Removed price alert: ${alert_id} for ${alert.symbol}`);
      
      return {
        success: true,
        message: `Successfully removed price alert for ${alert.symbol.toUpperCase()}`,
        removed_alert: {
          alert_id: alert.id,
          symbol: alert.symbol,
          low_threshold: alert.lowThreshold,
          high_threshold: alert.highThreshold,
          email_enabled: !!alert.userEmail,
        },
      };
    } catch (error: any) {
      console.error('Error removing price alert:', error);
      return {
        success: false,
        message: `Failed to remove price alert: ${error.message}`,
      };
    }
  },
});

// Check Alert Status Tool
export const checkAlertStatus = new Tool({
  id: 'checkAlertStatus',
  description: 'Check the status of all price alerts including recent triggers and monitoring status',
  inputSchema: z.object({
    detailed: z.boolean().default(false).describe('Include detailed price and threshold information'),
  }),
  outputSchema: z.object({
    monitor_status: z.object({
      is_running: z.boolean(),
      check_interval_seconds: z.number(),
      last_check_time: z.string().optional(),
    }),
    alert_summary: z.object({
      total_alerts: z.number(),
      active_alerts: z.number(),
      triggered_alerts: z.number(),
      email_enabled_alerts: z.number(),
    }),
    active_alerts: z.array(z.object({
      alert_id: z.string(),
      symbol: z.string(),
      status: z.enum(['monitoring', 'triggered', 'error']),
      low_threshold: z.number().optional(),
      high_threshold: z.number().optional(),
      current_price: z.number().optional(),
      price_distance_to_low: z.number().optional(),
      price_distance_to_high: z.number().optional(),
      created_at: z.string(),
      last_checked: z.string().optional(),
      email_enabled: z.boolean(),
      time_since_creation: z.string(),
    })),
    recent_triggers: z.array(z.object({
      triggered_alert_id: z.string(),
      original_alert_id: z.string(),
      symbol: z.string(),
      threshold_type: z.string(),
      threshold_value: z.number(),
      trigger_price: z.number(),
      triggered_at: z.string(),
      email_sent: z.boolean(),
      acknowledged: z.boolean(),
    })),
  }),
  execute: async ({ context }) => {
    const { detailed } = context;
    
    try {
      const allAlerts = Array.from(activeAlerts.values());
      const activeAlertsArray = allAlerts.filter(alert => !alert.triggered);
      const triggeredAlertsArray = Array.from(triggeredAlerts.values());
      
      // Calculate time since creation for each alert
      const formatTimeSince = (date: Date): string => {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMinutes / 60);
        const diffDays = Math.floor(diffHours / 24);
        
        if (diffDays > 0) return `${diffDays} day(s) ago`;
        if (diffHours > 0) return `${diffHours} hour(s) ago`;
        return `${diffMinutes} minute(s) ago`;
      };
      
      // Format active alerts with detailed information
      const formattedActiveAlerts = allAlerts.map(alert => {
        let status: 'monitoring' | 'triggered' | 'error' = 'monitoring';
        if (alert.triggered) status = 'triggered';
        
        // Calculate distance to thresholds
        let priceDistanceToLow: number | undefined;
        let priceDistanceToHigh: number | undefined;
        
        if (detailed && alert.currentPrice) {
          if (alert.lowThreshold) {
            priceDistanceToLow = ((alert.currentPrice - alert.lowThreshold) / alert.lowThreshold) * 100;
          }
          if (alert.highThreshold) {
            priceDistanceToHigh = ((alert.highThreshold - alert.currentPrice) / alert.currentPrice) * 100;
          }
        }
        
        return {
          alert_id: alert.id,
          symbol: alert.symbol,
          status,
          low_threshold: alert.lowThreshold,
          high_threshold: alert.highThreshold,
          current_price: detailed ? alert.currentPrice : undefined,
          price_distance_to_low: detailed ? priceDistanceToLow : undefined,
          price_distance_to_high: detailed ? priceDistanceToHigh : undefined,
          created_at: alert.createdAt.toISOString(),
          last_checked: alert.lastChecked?.toISOString(),
          email_enabled: !!alert.userEmail,
          time_since_creation: formatTimeSince(alert.createdAt),
        };
      });
      
      // Format recent triggers (last 10)
      const recentTriggers = triggeredAlertsArray
        .sort((a, b) => b.triggeredAt.getTime() - a.triggeredAt.getTime())
        .slice(0, 10)
        .map(trigger => ({
          triggered_alert_id: trigger.id,
          original_alert_id: trigger.alertId,
          symbol: trigger.symbol,
          threshold_type: trigger.thresholdType,
          threshold_value: trigger.thresholdValue,
          trigger_price: trigger.currentPrice,
          triggered_at: trigger.triggeredAt.toISOString(),
          email_sent: trigger.emailSent,
          acknowledged: trigger.acknowledged,
        }));
      
      const result = {
        monitor_status: {
          is_running: priceAlertMonitor.isRunning,
          check_interval_seconds: 30,
          last_check_time: activeAlertsArray.length > 0 
            ? activeAlertsArray
                .filter(a => a.lastChecked)
                .sort((a, b) => (b.lastChecked?.getTime() || 0) - (a.lastChecked?.getTime() || 0))[0]
                ?.lastChecked?.toISOString()
            : undefined,
        },
        alert_summary: {
          total_alerts: allAlerts.length,
          active_alerts: activeAlertsArray.length,
          triggered_alerts: allAlerts.filter(a => a.triggered).length,
          email_enabled_alerts: allAlerts.filter(a => a.userEmail).length,
        },
        active_alerts: formattedActiveAlerts,
        recent_triggers: recentTriggers,
      };
      
      console.log(`📊 Alert Status Check: ${result.alert_summary.active_alerts} active, ${result.alert_summary.triggered_alerts} triggered, ${result.recent_triggers.length} recent triggers`);
      
      return result;
    } catch (error: any) {
      console.error('Error checking alert status:', error);
      return {
        monitor_status: {
          is_running: false,
          check_interval_seconds: 30,
        },
        alert_summary: {
          total_alerts: 0,
          active_alerts: 0,
          triggered_alerts: 0,
          email_enabled_alerts: 0,
        },
        active_alerts: [],
        recent_triggers: [],
      };
    }
  },
});

// Updated Price Alert Monitor Class
class PriceAlertMonitor {
  public isRunning = false; // Make this public so checkAlertStatus can access it
  private intervalId: NodeJS.Timeout | null = null;
  private readonly checkInterval = 30000; // 30 seconds

  start() {
    if (this.isRunning) {
      console.log('Price alert monitor is already running');
      return;
    }

    this.isRunning = true;
    console.log('🚀 Starting price alert monitor with email notifications...');
    
    this.intervalId = setInterval(() => {
      this.checkAlerts();
    }, this.checkInterval);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('⏹️ Price alert monitor stopped');
  }

  private async checkAlerts() {
    // Only check non-triggered alerts
    const activeAlertsArray = Array.from(activeAlerts.values()).filter(alert => !alert.triggered);
    
    if (activeAlertsArray.length === 0) {
      return;
    }

    console.log(`🔍 Checking ${activeAlertsArray.length} active price alerts...`);

    for (const alert of activeAlertsArray) {
      try {
        await this.checkSingleAlert(alert);
      } catch (error) {
        console.error(`Error checking alert ${alert.id}:`, error);
      }
    }
  }

  private async checkSingleAlert(alert: any) {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${alert.symbol}&vs_currencies=usd`
    );

    if (!response.ok) {
      console.error(`Failed to fetch price for ${alert.symbol}`);
      return;
    }

    const priceData = await response.json();
    const currentPrice = priceData[alert.symbol]?.usd;

    if (!currentPrice) {
      console.error(`No price data found for ${alert.symbol}`);
      return;
    }

    alert.currentPrice = currentPrice;
    alert.lastChecked = new Date();
    activeAlerts.set(alert.id, alert);

    let alertTriggered = false;
    let alertMessage = '';
    let thresholdType: 'high' | 'low' = 'low';
    let thresholdValue = 0;

    if (alert.lowThreshold && currentPrice <= alert.lowThreshold) {
      alertTriggered = true;
      thresholdType = 'low';
      thresholdValue = alert.lowThreshold;
      alertMessage = `🔻 PRICE ALERT: ${alert.symbol.toUpperCase()} has dropped to $${currentPrice} (below your threshold of $${alert.lowThreshold})`;
    } else if (alert.highThreshold && currentPrice >= alert.highThreshold) {
      alertTriggered = true;
      thresholdType = 'high';
      thresholdValue = alert.highThreshold;
      alertMessage = `🔺 PRICE ALERT: ${alert.symbol.toUpperCase()} has risen to $${currentPrice} (above your threshold of $${alert.highThreshold})`;
    }

    if (alertTriggered) {
      console.log(alertMessage);
      await this.triggerAlert(alert, alertMessage, currentPrice, thresholdType, thresholdValue);
    }
  }

  private async triggerAlert(alert: any, message: string, currentPrice: number, thresholdType: 'high' | 'low', thresholdValue: number) {
    console.log(`🚨 ALERT TRIGGERED: ${message}`);
    
    // Mark alert as triggered so it won't trigger again
    alert.triggered = true;
    alert.triggeredAt = new Date();
    activeAlerts.set(alert.id, alert);
    
    // Create unique IDs for tracking
    const triggeredAlertId = `triggered_${alert.id}_${Date.now()}`;
    const notificationId = `notification_${alert.id}_${Date.now()}`;
    
    // Send email if user email is provided
    let emailSent = false;
    if (alert.userEmail) {
      console.log(`📧 Sending email notification to ${alert.userEmail}...`);
      emailSent = await emailService.sendPriceAlert(
        alert.userEmail,
        alert.symbol,
        currentPrice,
        thresholdType,
        thresholdValue,
        alert.id
      );
      
      if (emailSent) {
        console.log(`✅ Email sent successfully to ${alert.userEmail}`);
      } else {
        console.log(`❌ Failed to send email to ${alert.userEmail}`);
      }
    }
    
    // Store triggered alert
    triggeredAlerts.set(triggeredAlertId, {
      id: triggeredAlertId,
      alertId: alert.id,
      symbol: alert.symbol,
      message,
      currentPrice,
      thresholdType,
      thresholdValue,
      triggeredAt: new Date(),
      acknowledged: false,
      emailSent,
    });

    // Add to user notifications
    userNotifications.push({
      id: notificationId,
      type: 'alert',
      title: `${alert.symbol.toUpperCase()} Price Alert`,
      message: message,
      timestamp: new Date(),
      acknowledged: false,
      data: {
        alertId: alert.id,
        symbol: alert.symbol,
        currentPrice,
        thresholdType,
        thresholdValue,
        triggeredAlertId,
        emailSent,
      },
    });

    console.log(`📢 Notification stored: ${notificationId}`);
    console.log(`📊 Alert ${alert.id} has been disabled after triggering`);
  }
}

// Create and start the monitor
export const priceAlertMonitor = new PriceAlertMonitor();
priceAlertMonitor.start();

export const getAlertNotifications = new Tool({
  id: 'getAlertNotifications',
  description: 'Get all triggered alerts and notifications for the user',
  inputSchema: z.object({
    unacknowledged_only: z.boolean().default(false).describe('Only show unacknowledged alerts'),
  }),
  outputSchema: z.object({
    notifications: z.array(z.object({
      id: z.string(),
      type: z.string(),
      title: z.string(),
      message: z.string(),
      timestamp: z.string(),
      acknowledged: z.boolean(),
      data: z.any().optional(),
    })),
    total_count: z.number(),
    unacknowledged_count: z.number(),
  }),
  execute: async ({ context }) => {
    const { unacknowledged_only } = context;
    
    try {
      let notifications = [...userNotifications];
      
      if (unacknowledged_only) {
        notifications = notifications.filter(n => !n.acknowledged);
      }
      
      const formattedNotifications = notifications.map(notification => ({
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        timestamp: notification.timestamp.toISOString(),
        acknowledged: notification.acknowledged,
        data: notification.data,
      }));

      console.log(`📢 Retrieved ${formattedNotifications.length} notifications`);
      
      return {
        notifications: formattedNotifications,
        total_count: userNotifications.length,
        unacknowledged_count: userNotifications.filter(n => !n.acknowledged).length,
      };
    } catch (error) {
      console.error('Error getting alert notifications:', error);
      return {
        notifications: [],
        total_count: 0,
        unacknowledged_count: 0,
      };
    }
  },
});

export const acknowledgeAlert = new Tool({
  id: 'acknowledgeAlert',
  description: 'Mark an alert notification as acknowledged/read',
  inputSchema: z.object({
    notification_id: z.string().describe('The notification ID to acknowledge'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ context }) => {
    const { notification_id } = context;
    
    try {
      const notification = userNotifications.find(n => n.id === notification_id);
      
      if (!notification) {
        return {
          success: false,
          message: `Notification with ID ${notification_id} not found`,
        };
      }
      
      notification.acknowledged = true;
      
      console.log(`✅ Acknowledged notification: ${notification_id}`);
      
      return {
        success: true,
        message: 'Notification acknowledged successfully',
      };
    } catch (error: any) {
      console.error('Error acknowledging alert:', error);
      return {
        success: false,
        message: `Failed to acknowledge alert: ${error.message}`,
      };
    }
  },
});


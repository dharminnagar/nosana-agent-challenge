// src/mastra/agents/crypto-agent/tools/price-alerts.ts
import { z } from 'zod';
import { Tool } from '@mastra/core/tools';

const alertSchema = z.object({
  symbol: z.string().describe('Cryptocurrency symbol (e.g., bitcoin, ethereum, solana)'),
  low_threshold: z.number().optional().describe('Alert when price goes below this value'),
  high_threshold: z.number().optional().describe('Alert when price goes above this value'),
  alert_id: z.string().optional().describe('Unique identifier for the alert'),
});

// In-memory storage for alerts
export const activeAlerts = new Map<string, {
  id: string;
  symbol: string;
  lowThreshold?: number;
  highThreshold?: number;
  currentPrice?: number;
  createdAt: Date;
  lastChecked?: Date;
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

// Setup Price Alert Tool
export const setupPriceAlert = new Tool({
  id: 'setupPriceAlert',
  description: 'Set up price alerts for cryptocurrencies with high/low thresholds',
  inputSchema: alertSchema,
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    alert_id: z.string(),
    symbol: z.string(),
    low_threshold: z.number().optional(),
    high_threshold: z.number().optional(),
  }),
  execute: async ({ context }) => {
    const { symbol, low_threshold, high_threshold } = context;
    
    try {
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

      activeAlerts.set(alertId, {
        id: alertId,
        symbol,
        lowThreshold: low_threshold,
        highThreshold: high_threshold,
        currentPrice,
        createdAt: new Date(),
      });

      console.log(`✅ Price alert set for ${symbol}: Low=${low_threshold || 'N/A'}, High=${high_threshold || 'N/A'}, Current=${currentPrice}`);

      return {
        success: true,
        message: `Price alert set successfully for ${symbol}. Current price: $${currentPrice}`,
        alert_id: alertId,
        symbol,
        low_threshold,
        high_threshold,
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
      };
    }
  },
});

// List Price Alerts Tool
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
      }));

      console.log(`📋 Found ${alerts.length} active price alerts`);
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
  description: 'Remove a specific price alert by ID',
  inputSchema: z.object({
    alert_id: z.string().describe('The alert ID to remove'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ context }) => {
    const { alert_id } = context;
    
    try {
      if (activeAlerts.has(alert_id)) {
        const alert = activeAlerts.get(alert_id);
        activeAlerts.delete(alert_id);
        
        console.log(`🗑️ Removed price alert: ${alert_id} for ${alert?.symbol}`);
        
        return {
          success: true,
          message: `Price alert removed successfully for ${alert?.symbol}`,
        };
      } else {
        return {
          success: false,
          message: `Alert with ID ${alert_id} not found`,
        };
      }
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
  description: 'Check the current status of price alerts and recent price movements',
  inputSchema: z.object({
    alert_id: z.string().optional().describe('Specific alert ID to check (optional)'),
  }),
  outputSchema: z.object({
    total_alerts: z.number(),
    alerts_status: z.array(z.object({
      alert_id: z.string(),
      symbol: z.string(),
      current_price: z.number(),
      low_threshold: z.number().optional(),
      high_threshold: z.number().optional(),
      status: z.string(),
      last_checked: z.string().optional(),
    })),
    message: z.string(),
  }),
  execute: async ({ context }) => {
    const { alert_id } = context;
    
    try {
      let alertsToCheck = Array.from(activeAlerts.values());
      
      if (alert_id) {
        const specificAlert = activeAlerts.get(alert_id);
        if (!specificAlert) {
          return {
            total_alerts: 0,
            alerts_status: [],
            message: `Alert with ID ${alert_id} not found`,
          };
        }
        alertsToCheck = [specificAlert];
      }

      const alertsStatus = alertsToCheck.map(alert => {
        let status = 'ACTIVE';
        
        if (alert.currentPrice && alert.lowThreshold && alert.currentPrice <= alert.lowThreshold) {
          status = 'TRIGGERED (LOW)';
        } else if (alert.currentPrice && alert.highThreshold && alert.currentPrice >= alert.highThreshold) {
          status = 'TRIGGERED (HIGH)';
        }

        return {
          alert_id: alert.id,
          symbol: alert.symbol,
          current_price: alert.currentPrice || 0,
          low_threshold: alert.lowThreshold,
          high_threshold: alert.highThreshold,
          status,
          last_checked: alert.lastChecked?.toISOString(),
        };
      });

      const message = alert_id 
        ? `Status for alert ${alert_id}`
        : `Status for all ${alertsToCheck.length} active alerts`;

      console.log(`📊 Alert status check: ${message}`);

      return {
        total_alerts: alertsToCheck.length,
        alerts_status: alertsStatus,
        message,
      };
    } catch (error: any) {
      console.error('Error checking alert status:', error);
      return {
        total_alerts: 0,
        alerts_status: [],
        message: `Error checking alert status: ${error.message}`,
      };
    }
  },
});

// Price Alert Monitor Class
class PriceAlertMonitor {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private readonly checkInterval = 30000; // 30 seconds

  start() {
    if (this.isRunning) {
      console.log('Price alert monitor is already running');
      return;
    }

    this.isRunning = true;
    console.log('🚀 Starting price alert monitor...');
    
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
    const alerts = Array.from(activeAlerts.values());
    
    if (alerts.length === 0) {
      return;
    }

    console.log(`🔍 Checking ${alerts.length} price alerts...`);

    for (const alert of alerts) {
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

    if (alert.lowThreshold && currentPrice <= alert.lowThreshold) {
      alertTriggered = true;
      alertMessage = `🔻 PRICE ALERT: ${alert.symbol.toUpperCase()} has dropped to $${currentPrice} (below your threshold of $${alert.lowThreshold})`;
    } else if (alert.highThreshold && currentPrice >= alert.highThreshold) {
      alertTriggered = true;
      alertMessage = `🔺 PRICE ALERT: ${alert.symbol.toUpperCase()} has risen to $${currentPrice} (above your threshold of $${alert.highThreshold})`;
    }

    if (alertTriggered) {
      console.log(alertMessage);
      this.triggerAlert(alert, alertMessage, currentPrice);
    }
  }

  private triggerAlert(alert: any, message: string, currentPrice: number) {
    console.log(`🚨 ALERT TRIGGERED: ${message}`);
    
    // Determine threshold type and value
    let thresholdType: 'high' | 'low' = 'low';
    let thresholdValue = 0;
    
    if (alert.lowThreshold && currentPrice <= alert.lowThreshold) {
      thresholdType = 'low';
      thresholdValue = alert.lowThreshold;
    } else if (alert.highThreshold && currentPrice >= alert.highThreshold) {
      thresholdType = 'high';
      thresholdValue = alert.highThreshold;
    }
    
    // Create unique IDs for tracking
    const triggeredAlertId = `triggered_${alert.id}_${Date.now()}`;
    const notificationId = `notification_${alert.id}_${Date.now()}`;
    
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
    });

    // Add to user notifications - THIS WAS MISSING!
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
      },
    });

    console.log(`📢 Notification stored: ${notificationId}`);
    console.log(`📊 Total notifications: ${userNotifications.length}`);
    
    // Optional: Remove alert after triggering (or keep for repeated alerts)
    // activeAlerts.delete(alert.id);
  }
}

// Create and start the monitor
export const priceAlertMonitor = new PriceAlertMonitor();
priceAlertMonitor.start();

// Add to src/mastra/agents/crypto-agent/tools/price-alerts.ts

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
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
    
    // In production: send email, push notification, webhook, etc.
  }
}

// Create and start the monitor
export const priceAlertMonitor = new PriceAlertMonitor();
priceAlertMonitor.start();
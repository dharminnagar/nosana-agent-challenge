import { z } from 'zod';
import { Tool } from '@mastra/core/tools';

const trendsSchema = z.object({
  trend_type: z.enum(['gainers', 'losers', 'trending']).describe('Type of trend data to fetch'),
  limit: z.number().default(10).describe('Number of results to return'),
});

class RateLimiter {
  private lastCall: number = 0;
  private readonly minInterval: number = 6000; // 6 seconds between calls

  async wait(): Promise<void> {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastCall;
    
    if (timeSinceLastCall < this.minInterval) {
      const waitTime = this.minInterval - timeSinceLastCall;
      console.log(`Rate limiting: waiting ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastCall = Date.now();
  }
}

const rateLimiter = new RateLimiter();

async function fetchWithTimeout(url: string, timeout: number = 10000): Promise<Response> {
  await rateLimiter.wait();
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

export const getMarketTrends = new Tool({
  id: 'getMarketTrends',
  description: 'Get market trends including top gainers, losers, and trending coins',
  inputSchema: trendsSchema,
  outputSchema: z.array(z.object({
    name: z.string(),
    symbol: z.string(),
    current_price: z.number(),
    price_change_percentage_24h: z.number(),
    market_cap_rank: z.number(),
    volume_24h: z.number(),
  })),
  execute: async ({ context }) => {
    const { trend_type, limit } = context;
    
    try {
      let orderBy = 'market_cap_desc';
      
      if (trend_type === 'gainers') {
        orderBy = 'price_change_percentage_24h_desc';
      } else if (trend_type === 'losers') {
        orderBy = 'price_change_percentage_24h_asc';
      } else if (trend_type === 'trending') {
        orderBy = 'volume_desc';
      }
      
      console.log(`Fetching ${trend_type} with limit ${limit}...`);
      
      const response = await fetchWithTimeout(
        `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=${orderBy}&per_page=${limit}&page=1&sparkline=false&price_change_percentage=24h`
      );
      
      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Rate limited');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      console.log(`Successfully fetched ${data.length} ${trend_type}`);
      
      return data.map((coin: any) => ({
        name: coin.name,
        symbol: coin.symbol.toUpperCase(),
        current_price: coin.current_price,
        price_change_percentage_24h: coin.price_change_percentage_24h || 0,
        market_cap_rank: coin.market_cap_rank,
        volume_24h: coin.total_volume,
      }));
    } catch (error: any) {
      console.error('Error fetching market trends:', error);
      
      const errorMessage = error.message.includes('429') || error.message.includes('Rate limited')
        ? 'I apologize, but I cannot fetch the current market trends due to API rate limits. Please try again in a few minutes.'
        : 'I apologize, but I cannot fetch the current market trends due to API issues. Please try again later.';
      
      return [{
        name: 'Error',
        symbol: 'ERROR',
        error_message: errorMessage,
        current_price: 0,
        price_change_percentage_24h: 0,
        market_cap_rank: 0,
        volume_24h: 0,
      }];
    }
  },
});
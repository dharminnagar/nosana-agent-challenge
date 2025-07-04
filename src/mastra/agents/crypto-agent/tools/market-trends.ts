import { z } from 'zod';
import { Tool } from '@mastra/core/tools';

const trendsSchema = z.object({
  trend_type: z.enum(['gainers', 'losers', 'trending']).describe('Type of trend data to fetch'),
  limit: z.number().default(10).describe('Number of results to return'),
});

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
      
      const response = await fetch(
        `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=${orderBy}&per_page=${limit}&page=1&sparkline=false`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      return data.map((coin: any) => ({
        name: coin.name,
        symbol: coin.symbol.toUpperCase(),
        current_price: coin.current_price,
        price_change_percentage_24h: coin.price_change_percentage_24h || 0,
        market_cap_rank: coin.market_cap_rank,
        volume_24h: coin.total_volume,
      }));
    } catch (error) {
      console.error('Error fetching market trends:', error);
      throw new Error('Failed to fetch market trends');
    }
  },
});
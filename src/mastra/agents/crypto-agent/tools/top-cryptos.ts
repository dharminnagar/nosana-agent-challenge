import { z } from 'zod';
import { Tool } from '@mastra/core/tools';

const topCryptosSchema = z.object({
  limit: z.number().default(10).describe('Number of top cryptocurrencies to fetch (default: 10)'),
  sort_by: z.enum(['market_cap', 'volume', 'price_change_24h']).default('market_cap').describe('Sort criteria'),
});

export const getTopCryptos = new Tool({
  id: 'getTopCryptos',
  description: 'Get top cryptocurrencies by market cap, volume, or 24h change',
  inputSchema: topCryptosSchema,
  outputSchema: z.array(z.object({
    name: z.string(),
    symbol: z.string(),
    current_price: z.number(),
    price_change_percentage_24h: z.number(),
    market_cap: z.number(),
    market_cap_rank: z.number(),
    total_volume: z.number(),
  })),
  execute: async ({ context }) => {
    const { limit, sort_by } = context;
    
    try {
      const response = await fetch(
        `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=${sort_by}_desc&per_page=${limit}&page=1&sparkline=false`
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
        market_cap: coin.market_cap,
        market_cap_rank: coin.market_cap_rank,
        total_volume: coin.total_volume,
      }));
    } catch (error) {
      console.error('Error fetching top cryptocurrencies:', error);
      throw new Error('Failed to fetch top cryptocurrencies. Please try again.');
    }
  },
});
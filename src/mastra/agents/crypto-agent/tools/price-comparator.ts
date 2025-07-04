import { z } from 'zod';
import { Tool } from '@mastra/core/tools';

const compareSchema = z.object({
  symbols: z.array(z.string()).describe('Array of cryptocurrency symbols to compare'),
});

export const comparePrices = new Tool({
  id: 'comparePrices',
  description: 'Compare prices and performance of multiple cryptocurrencies',
  inputSchema: compareSchema,
  outputSchema: z.array(z.object({
    name: z.string(),
    symbol: z.string(),
    current_price: z.number(),
    price_change_percentage_24h: z.number(),
    market_cap_rank: z.number(),
  })),
  execute: async ({ context }) => {
    const { symbols } = context;
    
    try {
      const symbolsString = symbols.join(',');
      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${symbolsString}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      const results = [];
      
      for (const symbol of symbols) {
        if (data[symbol]) {
          // Get coin info for each symbol
          const coinResponse = await fetch(
            `https://api.coingecko.com/api/v3/coins/${symbol}?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false`
          );
          
          const coinInfo = coinResponse.ok ? await coinResponse.json() : null;
          
          results.push({
            name: coinInfo?.name || symbol,
            symbol: coinInfo?.symbol?.toUpperCase() || symbol.toUpperCase(),
            current_price: data[symbol].usd,
            price_change_percentage_24h: data[symbol].usd_24h_change || 0,
            market_cap_rank: coinInfo?.market_cap_rank || 0,
          });
        }
      }
      
      return results;
    } catch (error) {
      console.error('Error comparing crypto prices:', error);
      throw new Error('Failed to compare cryptocurrency prices. Please check the symbols and try again.');
    }
  },
});
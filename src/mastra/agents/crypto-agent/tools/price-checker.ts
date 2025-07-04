import { z } from 'zod';
import { Tool } from '@mastra/core/tools';

const priceSchema = z.object({
  symbol: z.string().describe('The cryptocurrency symbol (e.g., bitcoin, ethereum, solana)'),
});

export const getPriceBySymbol = new Tool({
  id: 'getPriceBySymbol',
  description: 'Get current price and market data for a specific cryptocurrency',
  inputSchema: priceSchema,
  outputSchema: z.object({
    name: z.string(),
    symbol: z.string(),
    current_price: z.number(),
    price_change_24h: z.number(),
    price_change_percentage_24h: z.number(),
    market_cap: z.number(),
    market_cap_rank: z.number(),
    total_volume: z.number(),
  }),
  execute: async ({ context }) => {
    const { symbol } = context;
    
    try {
      // CoinGecko API endpoint
      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${symbol}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data[symbol]) {
        throw new Error(`Cryptocurrency '${symbol}' not found. Try using the full name like 'bitcoin' instead of 'btc'`);
      }
      
      const cryptoData = data[symbol];
      
      // Get additional coin info
      const coinResponse = await fetch(
        `https://api.coingecko.com/api/v3/coins/${symbol}?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false`
      );
      
      const coinInfo = coinResponse.ok ? await coinResponse.json() : null;
      
      return {
        name: coinInfo?.name || symbol,
        symbol: coinInfo?.symbol?.toUpperCase() || symbol.toUpperCase(),
        current_price: cryptoData.usd,
        price_change_24h: cryptoData.usd_24h_change || 0,
        price_change_percentage_24h: cryptoData.usd_24h_change || 0,
        market_cap: cryptoData.usd_market_cap || 0,
        market_cap_rank: coinInfo?.market_cap_rank || 0,
        total_volume: cryptoData.usd_24h_vol || 0,
      };
    } catch (error) {
      console.error('Error fetching crypto price:', error);
      throw new Error(`Failed to fetch price for ${symbol}. Please check the symbol and try again.`);
    }
  },
});
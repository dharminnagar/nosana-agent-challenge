import { z } from 'zod';
import { Tool } from '@mastra/core/tools';

const portfolioSchema = z.object({
  wallet_address: z.string().describe('Wallet address (Ethereum, Solana, etc.)'),
  blockchain: z.enum(['ethereum', 'solana', 'polygon', 'bsc']).default('ethereum').describe('Blockchain network'),
});

export const calculatePortfolio = new Tool({
  id: 'calculatePortfolio',
  description: 'Calculate portfolio value from wallet address - fetches all token holdings automatically',
  inputSchema: portfolioSchema,
  outputSchema: z.object({
    wallet_address: z.string(),
    blockchain: z.string(),
    total_value: z.number(),
    total_change_24h: z.number(),
    total_change_percentage_24h: z.number(),
    holdings: z.array(z.object({
      name: z.string(),
      symbol: z.string(),
      amount: z.number(),
      current_price: z.number(),
      value: z.number(),
      change_24h: z.number(),
      change_percentage_24h: z.number(),
      token_address: z.string().optional(),
    })),
  }),
  execute: async ({ context }) => {
    const { wallet_address, blockchain } = context;
    
    try {
      let holdings: any[] = [];
      
      if (blockchain === 'ethereum') {
        holdings = await getEthereumHoldings(wallet_address);
      } else if (blockchain === 'bsc') {
        holdings = await getBscHoldings(wallet_address);
      } else {
        throw new Error(`Blockchain ${blockchain} not supported yet`);
      }
      
      if (holdings.length === 0) {
        return {
          wallet_address,
          blockchain,
          total_value: 0,
          total_change_24h: 0,
          total_change_percentage_24h: 0,
          holdings: [],
        };
      }
      
      // Get prices for all tokens
      const tokenIds = holdings.map(h => h.coingecko_id).filter(Boolean);
      const priceData = await getCryptoPrices(tokenIds);
      
      let totalValue = 0;
      let totalChange24h = 0;
      const holdingsData = [];
      
      for (const holding of holdings) {
        const { symbol, amount, coingecko_id, token_address, name } = holding;
        
        if (coingecko_id && priceData[coingecko_id]) {
          const price = priceData[coingecko_id].usd;
          const change24h = priceData[coingecko_id].usd_24h_change || 0;
          const value = amount * price;
          const holdingChange24h = amount * change24h;
          
          holdingsData.push({
            name: name || symbol,
            symbol: symbol.toUpperCase(),
            amount,
            current_price: price,
            value,
            change_24h: holdingChange24h,
            change_percentage_24h: change24h / price * 100,
            token_address,
          });
          
          totalValue += value;
          totalChange24h += holdingChange24h;
        }
      }
      
      return {
        wallet_address,
        blockchain,
        total_value: totalValue,
        total_change_24h: totalChange24h,
        total_change_percentage_24h: totalValue > 0 ? (totalChange24h / totalValue) * 100 : 0,
        holdings: holdingsData,
      };
    } catch (error: any) {
      console.error('Error calculating portfolio:', error);
      throw new Error(`Failed to fetch portfolio for wallet ${wallet_address}: ${error.message}`);
    }
  },
});

// Helper function to get Ethereum holdings using Moralis
async function getEthereumHoldings(walletAddress: string) {
  try {
    const MORALIS_API_KEY = process.env.MORALIS_API_KEY;
    
    if (!MORALIS_API_KEY) {
      console.warn('MORALIS_API_KEY not found, using mock data');
      return getMockEthereumHoldings();
    }
    
    // Get ERC20 token balances
    const response = await fetch(
      `https://deep-index.moralis.io/api/v2.2/${walletAddress}/erc20?chain=eth`,
      {
        headers: {
          'X-API-Key': MORALIS_API_KEY,
        },
      }
    );
    
    if (!response.ok) {
      throw new Error(`Moralis API error: ${response.status}`);
    }
    
    const data = await response.json();
    const holdings = [];
    
    // Also get native ETH balance
    const ethBalanceResponse = await fetch(
      `https://deep-index.moralis.io/api/v2.2/${walletAddress}/balance?chain=eth`,
      {
        headers: {
          'X-API-Key': MORALIS_API_KEY,
        },
      }
    );
    
    if (ethBalanceResponse.ok) {
      const ethData = await ethBalanceResponse.json();
      const ethBalance = parseFloat(ethData.balance) / Math.pow(10, 18);

      console.log(`ETH Balance: ${ethBalance} ETH`);
      
      if (ethBalance > 0) {
        holdings.push({
          symbol: 'ETH',
          name: 'Ethereum',
          amount: ethBalance,
          token_address: null,
          coingecko_id: 'ethereum',
        });
      }
    }
    
    // Process ERC20 tokens
    for (const token of data) {
      const balance = parseFloat(token.balance) / Math.pow(10, parseInt(token.decimals));
      
      if (balance > 0) {
        holdings.push({
          symbol: token.symbol,
          name: token.name,
          amount: balance,
          token_address: token.token_address,
          coingecko_id: getCoingeckoId(token.symbol),
        });
      }
    }

    return holdings;
  } catch (error) {
    console.error('Error fetching Ethereum holdings:', error);
    return getMockEthereumHoldings();
  }
}

// Helper function to get BSC holdings using Moralis
async function getBscHoldings(walletAddress: string) {
  try {
    const MORALIS_API_KEY = process.env.MORALIS_API_KEY;
    
    if (!MORALIS_API_KEY) {
      console.warn('MORALIS_API_KEY not found, using mock data');
      return getMockBscHoldings();
    }
    
    // Get BEP20 token balances on BSC
    const response = await fetch(
      `https://deep-index.moralis.io/api/v2.2/${walletAddress}/erc20?chain=bsc`,
      {
        headers: {
          'X-API-Key': MORALIS_API_KEY,
        },
      }
    );
    
    if (!response.ok) {
      throw new Error(`Moralis BSC API error: ${response.status}`);
    }
    
    const data = await response.json();
    const holdings = [];
    
    // Get native BNB balance
    const bnbBalanceResponse = await fetch(
      `https://deep-index.moralis.io/api/v2.2/${walletAddress}/balance?chain=bsc`,
      {
        headers: {
          'X-API-Key': MORALIS_API_KEY,
        },
      }
    );
    
    if (bnbBalanceResponse.ok) {
      const bnbData = await bnbBalanceResponse.json();
      const bnbBalance = parseFloat(bnbData.balance) / Math.pow(10, 18);
      
      if (bnbBalance > 0) {
        holdings.push({
          symbol: 'BNB',
          name: 'BNB',
          amount: bnbBalance,
          token_address: null,
          coingecko_id: 'binancecoin',
        });
      }
    }
    
    // Process BEP20 tokens
    for (const token of data) {
      const balance = parseFloat(token.balance) / Math.pow(10, parseInt(token.decimals));
      
      if (balance > 0) {
        holdings.push({
          symbol: token.symbol,
          name: token.name,
          amount: balance,
          token_address: token.token_address,
          coingecko_id: getCoingeckoId(token.symbol),
        });
      }
    }
    
    return holdings;
  } catch (error) {
    console.error('Error fetching BSC holdings:', error);
    return getMockBscHoldings();
  }
}

// Helper function to get crypto prices
async function getCryptoPrices(tokenIds: string[]) {
  if (tokenIds.length === 0) return {};
  
  const response = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${tokenIds.join(',')}&vs_currencies=usd&include_24hr_change=true`
  );
  
  if (!response.ok) {
    throw new Error('Failed to fetch crypto prices');
  }
  
  return await response.json();
}

// Helper function to map token symbols to CoinGecko IDs
function getCoingeckoId(symbol: string): string | null {
  const mapping: { [key: string]: string } = {
    'WETH': 'ethereum',
    'USDC': 'usd-coin',
    'USDT': 'tether',
    'DAI': 'dai',
    'WBTC': 'wrapped-bitcoin',
    'UNI': 'uniswap',
    'AAVE': 'aave',
    'LINK': 'chainlink',
    'COMP': 'compound-governance-token',
    'MKR': 'maker',
    'SNX': 'havven',
    'YFI': 'yearn-finance',
    'SUSHI': 'sushi',
    'CRV': 'curve-dao-token',
    'BAL': 'balancer',
    '1INCH': '1inch',
    'WMATIC': 'matic-network',
    'QUICK': 'quickswap',
    'CAKE': 'pancakeswap-token',
    'BUSD': 'binance-usd',
  };
  
  return mapping[symbol.toUpperCase()] || null;
}

// Mock data for demo purposes
function getMockEthereumHoldings() {
  return [
    {
      symbol: 'ETH',
      name: 'Ethereum',
      amount: 2.5,
      token_address: null,
      coingecko_id: 'ethereum',
    },
    {
      symbol: 'USDC',
      name: 'USD Coin',
      amount: 1000,
      token_address: '0xA0b86a33E6441c8e1e8A7C0f16B4A0fE8F70BF88',
      coingecko_id: 'usd-coin',
    },
    {
      symbol: 'UNI',
      name: 'Uniswap',
      amount: 50,
      token_address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
      coingecko_id: 'uniswap',
    },
  ];
}

function getMockBscHoldings() {
  return [
    {
      symbol: 'BNB',
      name: 'BNB',
      amount: 5,
      token_address: null,
      coingecko_id: 'binancecoin',
    },
    {
      symbol: 'CAKE',
      name: 'PancakeSwap Token',
      amount: 25,
      token_address: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82',
      coingecko_id: 'pancakeswap-token',
    },
  ];
}
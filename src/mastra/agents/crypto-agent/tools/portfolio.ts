import { z } from "zod";
import { Tool } from "@mastra/core/tools";

const portfolioSchema = z.object({
  wallet_address: z.string()
    .min(26, 'Invalid wallet address length')
    .regex(/^[a-zA-Z0-9]+$/, 'Invalid wallet address format').describe("Wallet Address: Must be a valid blockchain address"),
  blockchain: z.string()
    .default('ethereum'),
});

export const calculatePortfolio = new Tool({
  id: "calculatePortfolio",
  description:
    "Calculate portfolio value from wallet address - fetches all token holdings automatically",
  inputSchema: portfolioSchema,
  outputSchema: z.object({
    wallet_address: z.string(),
    blockchain: z.string(),
    total_value: z.number(),
    total_change_24h: z.number(),
    total_change_percentage_24h: z.number(),
    holdings: z.array(
      z.object({
        name: z.string(),
        symbol: z.string(),
        amount: z.number(),
        current_price: z.number(),
        value: z.number(),
        change_24h: z.number(),
        change_percentage_24h: z.number(),
        token_address: z.string().optional(),
      })
    ),
  }),
  execute: async ({ context }) => {
    const { wallet_address, blockchain } = context;

    try {
      let holdings: any[] = [];

      if (blockchain === "ethereum") {
        holdings = await getEthereumHoldings(wallet_address);
      } else if (blockchain === "solana") {
        holdings = await getSolanaHoldings(wallet_address);
      } else if (blockchain === "polygon") {
        holdings = await getPolygonHoldings(wallet_address);
      } else if (blockchain === "bsc") {
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

      // Get prices for all tokens using Moralis
      console.error(`Fetching prices for ${holdings.length} holdings on ${blockchain}...`);
      const priceData = await getMoralisTokenPrices(holdings, blockchain);

      console.log(
        `Fetched ${holdings.length} holdings for wallet ${wallet_address} on ${blockchain}`
      );
      console.log("Holdings Data:", holdings);
      console.log("Price Data:", priceData);

      let totalValue = 0;
      let totalChange24h = 0;
      const holdingsData = [];

      for (const holding of holdings) {
        const { symbol, amount, token_address, name } = holding;
        const priceKey = token_address || symbol;

        if (priceData[priceKey] && priceData[priceKey].usd > 0) {
          const price = priceData[priceKey].usd;
          const change24hPercent = priceData[priceKey].usd_24h_change || 0;
          const value = amount * price;
          const holdingChange24h = (value * change24hPercent) / 100;

          holdingsData.push({
            name: name || symbol,
            symbol: symbol.toUpperCase(),
            amount,
            current_price: price,
            value,
            change_24h: holdingChange24h,
            change_percentage_24h: change24hPercent,
            token_address,
          });

          totalValue += value;
          totalChange24h += holdingChange24h;
        } else {
          console.warn(`No price data found for token ${symbol} (${token_address})`);
        }
      }

      console.log({
        wallet_address,
        blockchain,
        totalValue,
        total_change_percentage_24h: totalValue > 0 ? (totalChange24h / totalValue) * 100 : 0,
        holdingsData,
      });

      return {
        wallet_address,
        blockchain,
        total_value: totalValue,
        total_change_24h: totalChange24h,
        total_change_percentage_24h: totalValue > 0 ? (totalChange24h / totalValue) * 100 : 0,
        holdings: holdingsData,
      };
    } catch (error: any) {
      console.error("Error calculating portfolio:", error);
      throw new Error(`Failed to fetch portfolio for wallet ${wallet_address}: ${error.message}`);
    }
  },
});

// Helper function to get Ethereum holdings using Moralis
async function getEthereumHoldings(walletAddress: string) {
  try {
    const MORALIS_API_KEY = process.env.MORALIS_API_KEY;

    if (!MORALIS_API_KEY) {
      console.warn("MORALIS_API_KEY not found, using mock data");
      return getMockEthereumHoldings();
    }

    const holdings = [];

    // Get native ETH balance first
    const ethBalanceResponse = await fetch(
      `https://deep-index.moralis.io/api/v2.2/${walletAddress}/balance?chain=eth`,
      {
        headers: {
          "X-API-Key": MORALIS_API_KEY,
        },
      }
    );

    if (ethBalanceResponse.ok) {
      const ethData = await ethBalanceResponse.json();
      const ethBalance = parseFloat(ethData.balance) / Math.pow(10, 18);

      if (ethBalance > 0) {
        holdings.push({
          symbol: "ETH",
          name: "Ethereum",
          amount: ethBalance,
          token_address: null,
        });
      }
    }

    // Get ERC20 token balances
    const response = await fetch(
      `https://deep-index.moralis.io/api/v2.2/${walletAddress}/erc20?chain=eth`,
      {
        headers: {
          "X-API-Key": MORALIS_API_KEY,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Moralis API error: ${response.status}`);
    }

    const data = await response.json();

    // Process ERC20 tokens
    for (const token of data) {
      const balance = parseFloat(token.balance) / Math.pow(10, parseInt(token.decimals));

      if (balance > 0) {
        holdings.push({
          symbol: token.symbol,
          name: token.name,
          amount: balance,
          token_address: token.token_address,
        });
      }
    }

    return holdings;
  } catch (error) {
    console.error("Error fetching Ethereum holdings:", error);
    return getMockEthereumHoldings();
  }
}

// Helper function to get Solana holdings using Moralis
async function getSolanaHoldings(walletAddress: string) {
  try {
    const MORALIS_API_KEY = process.env.MORALIS_API_KEY;

    if (!MORALIS_API_KEY) {
      console.warn("MORALIS_API_KEY not found, using mock data");
      return getMockSolanaHoldings();
    }

    const holdings = [];

    // Get native SOL balance
    const solBalanceResponse = await fetch(
      `https://solana-gateway.moralis.io/account/mainnet/${walletAddress}/balance`,
      {
        headers: {
          "X-API-Key": MORALIS_API_KEY,
        },
      }
    );

    if (solBalanceResponse.ok) {
      const solData = await solBalanceResponse.json();
      const solBalance = parseFloat(solData.solana) || 0;

      if (solBalance > 0) {
        holdings.push({
          symbol: "SOL",
          name: "Solana",
          amount: solBalance,
          token_address: null,
        });
      }
    }

    // Get SPL token balances
    const response = await fetch(
      `https://solana-gateway.moralis.io/account/mainnet/${walletAddress}/tokens`,
      {
        headers: {
          "X-API-Key": MORALIS_API_KEY,
        },
      }
    );

    if (response.ok) {
      const data = await response.json();

      // Process SPL tokens
      for (const token of data) {
        if (token.amount > 0) {
          holdings.push({
            symbol: token.symbol || "UNKNOWN",
            name: token.name || "Unknown Token",
            amount: parseFloat(token.amount),
            token_address: token.mint,
          });
        }
      }
    }

    console.log(`Fetched ${holdings.length} Solana holdings for wallet ${walletAddress}`);
    return holdings;
  } catch (error) {
    console.error("Error fetching Solana holdings:", error);
    return getMockSolanaHoldings();
  }
}

// Helper function to get Polygon holdings using Moralis
async function getPolygonHoldings(walletAddress: string) {
  try {
    const MORALIS_API_KEY = process.env.MORALIS_API_KEY;

    if (!MORALIS_API_KEY) {
      console.warn("MORALIS_API_KEY not found, using mock data");
      return getMockPolygonHoldings();
    }

    const holdings = [];

    // Get native MATIC balance
    const maticBalanceResponse = await fetch(
      `https://deep-index.moralis.io/api/v2.2/${walletAddress}/balance?chain=polygon`,
      {
        headers: {
          "X-API-Key": MORALIS_API_KEY,
        },
      }
    );

    if (maticBalanceResponse.ok) {
      const maticData = await maticBalanceResponse.json();
      const maticBalance = parseFloat(maticData.balance) / Math.pow(10, 18);

      if (maticBalance > 0) {
        holdings.push({
          symbol: "MATIC",
          name: "Polygon",
          amount: maticBalance,
          token_address: null,
        });
      }
    }

    // Get ERC20 token balances on Polygon
    const response = await fetch(
      `https://deep-index.moralis.io/api/v2.2/${walletAddress}/erc20?chain=polygon`,
      {
        headers: {
          "X-API-Key": MORALIS_API_KEY,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Moralis Polygon API error: ${response.status}`);
    }

    const data = await response.json();

    // Process ERC20 tokens on Polygon
    for (const token of data) {
      const balance = parseFloat(token.balance) / Math.pow(10, parseInt(token.decimals));

      if (balance > 0) {
        holdings.push({
          symbol: token.symbol,
          name: token.name,
          amount: balance,
          token_address: token.token_address,
        });
      }
    }

    return holdings;
  } catch (error) {
    console.error("Error fetching Polygon holdings:", error);
    return getMockPolygonHoldings();
  }
}

// Helper function to get BSC holdings using Moralis
async function getBscHoldings(walletAddress: string) {
  try {
    const MORALIS_API_KEY = process.env.MORALIS_API_KEY;

    if (!MORALIS_API_KEY) {
      console.warn("MORALIS_API_KEY not found, using mock data");
      return getMockBscHoldings();
    }

    const holdings = [];

    // Get native BNB balance
    const bnbBalanceResponse = await fetch(
      `https://deep-index.moralis.io/api/v2.2/${walletAddress}/balance?chain=bsc`,
      {
        headers: {
          "X-API-Key": MORALIS_API_KEY,
        },
      }
    );

    if (bnbBalanceResponse.ok) {
      const bnbData = await bnbBalanceResponse.json();
      const bnbBalance = parseFloat(bnbData.balance) / Math.pow(10, 18);

      if (bnbBalance > 0) {
        holdings.push({
          symbol: "BNB",
          name: "BNB",
          amount: bnbBalance,
          token_address: null,
        });
      }
    }

    // Get BEP20 token balances on BSC
    const response = await fetch(
      `https://deep-index.moralis.io/api/v2.2/${walletAddress}/erc20?chain=bsc`,
      {
        headers: {
          "X-API-Key": MORALIS_API_KEY,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Moralis BSC API error: ${response.status}`);
    }

    const data = await response.json();

    // Process BEP20 tokens
    for (const token of data) {
      const balance = parseFloat(token.balance) / Math.pow(10, parseInt(token.decimals));

      if (balance > 0) {
        holdings.push({
          symbol: token.symbol,
          name: token.name,
          amount: balance,
          token_address: token.token_address,
        });
      }
    }

    return holdings;
  } catch (error) {
    console.error("Error fetching BSC holdings:", error);
    return getMockBscHoldings();
  }
}

// Updated function to get prices using Moralis price endpoints
async function getMoralisTokenPrices(tokens: any[], blockchain: string) {
  const MORALIS_API_KEY = process.env.MORALIS_API_KEY;

  if (!MORALIS_API_KEY) {
    console.warn("MORALIS_API_KEY not found, using fallback prices");
    return {};
  }

  const priceData: { [key: string]: { usd: number; usd_24h_change: number } } = {};

  // Map blockchain names to Moralis chain identifiers
  const chainMap: { [key: string]: string } = {
    ethereum: "eth",
    polygon: "polygon",
    bsc: "bsc",
    solana: "solana",
  };

  const chain = chainMap[blockchain];

  for (const token of tokens) {
    try {
      let endpoint = "";
      const tokenKey = token.token_address || token.symbol;

      if (blockchain === "solana") {
        // For Solana, use the SPL token endpoint
        if (token.symbol === "SOL") {
          endpoint = `https://solana-gateway.moralis.io/token/mainnet/So11111111111111111111111111111111111111112/price`;
        } else if (token.token_address) {
          endpoint = `https://solana-gateway.moralis.io/token/mainnet/${token.token_address}/price`;
        } else {
          console.warn(`No valid token identifier for Solana token: ${token.symbol}`);
          continue;
        }
      } else {
        // For EVM chains (Ethereum, Polygon, BSC)
        if (token.token_address) {
          endpoint = `https://deep-index.moralis.io/api/v2.2/erc20/${token.token_address}/price?chain=${chain}`;
        } else {
          // For native tokens, we need to use their wrapped versions or special handling
          if (token.symbol === "ETH") {
            // Use WETH address for price
            endpoint = `https://deep-index.moralis.io/api/v2.2/erc20/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/price?chain=eth`;
          } else if (token.symbol === "MATIC") {
            // Use WMATIC address for price
            endpoint = `https://deep-index.moralis.io/api/v2.2/erc20/0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270/price?chain=polygon`;
          } else if (token.symbol === "BNB") {
            // Use WBNB address for price
            endpoint = `https://deep-index.moralis.io/api/v2.2/erc20/0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c/price?chain=bsc`;
          }
        }
      }

      if (endpoint) {
        console.log(`Fetching price for ${token.symbol} from: ${endpoint}`);
        
        const response = await fetch(endpoint, {
          headers: {
            "X-API-Key": MORALIS_API_KEY,
          },
        });

        if (response.ok) {
          const data = await response.json();
          
          priceData[tokenKey] = {
            usd: parseFloat(data.usdPrice || 0),
            usd_24h_change: parseFloat(data.usdPrice24hrPercentChange || 0),
          };
        } else {
          console.error(`Failed to fetch price for ${token.symbol}: ${response.status}`);
        }
      }
    } catch (error) {
      console.error(`Error fetching price for ${token.symbol}:`, error);
    }
  }

  console.log("Final price data:", priceData);
  return priceData;
}

// Mock data for demo purposes (removed coingecko_id fields)
function getMockEthereumHoldings() {
  return [
    {
      symbol: "ETH",
      name: "Ethereum",
      amount: 2.5,
      token_address: null,
    },
    {
      symbol: "USDC",
      name: "USD Coin",
      amount: 1000,
      token_address: "0xA0b86a33E6441c8e1e8A7C0f16B4A0fE8F70BF88",
    },
    {
      symbol: "UNI",
      name: "Uniswap",
      amount: 50,
      token_address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
    },
  ];
}

function getMockSolanaHoldings() {
  return [
    {
      symbol: "SOL",
      name: "Solana",
      amount: 10,
      token_address: null,
    },
    {
      symbol: "USDC",
      name: "USD Coin",
      amount: 500,
      token_address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    },
  ];
}

function getMockPolygonHoldings() {
  return [
    {
      symbol: "MATIC",
      name: "Polygon",
      amount: 100,
      token_address: null,
    },
    {
      symbol: "USDC",
      name: "USD Coin",
      amount: 500,
      token_address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    },
  ];
}

function getMockBscHoldings() {
  return [
    {
      symbol: "BNB",
      name: "BNB",
      amount: 5,
      token_address: null,
    },
    {
      symbol: "CAKE",
      name: "PancakeSwap Token",
      amount: 25,
      token_address: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82",
    },
  ];
}
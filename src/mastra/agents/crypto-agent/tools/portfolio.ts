import { z } from "zod";
import { Tool } from "@mastra/core/tools";

const portfolioSchema = z.object({
  wallet_address: z.string()
    .min(26, 'Invalid wallet address length')
    .regex(/^[a-zA-Z0-9]+$/, 'Invalid wallet address format').describe("Wallet Address: Must be a valid blockchain address"),
  blockchain: z.string()
    .default('ethereum'),
});

export const analyzePortfolioRisk = new Tool({
  id: "analyzePortfolioRisk",
  description: "Analyze portfolio risk metrics including volatility, diversification, concentration risk, and Value at Risk (VaR)",
  inputSchema: z.object({
    wallet_address: z.string()
      .min(26, 'Invalid wallet address length')
      .regex(/^[a-zA-Z0-9]+$/, 'Invalid wallet address format')
      .describe("Wallet Address: Must be a valid blockchain address"),
    blockchain: z.string().default('ethereum'),
    confidence_level: z.number().min(0.01).max(0.99).default(0.95).describe("Confidence level for VaR calculation (0.95 = 95%)"),
  }),
  outputSchema: z.object({
    wallet_address: z.string(),
    blockchain: z.string(),
    portfolio_value: z.number(),
    risk_metrics: z.object({
      portfolio_volatility: z.number().describe("Annualized portfolio volatility (%)"),
      value_at_risk_1d: z.number().describe("1-day Value at Risk in USD"),
      value_at_risk_7d: z.number().describe("7-day Value at Risk in USD"),
      sharpe_ratio: z.number().describe("Risk-adjusted return ratio"),
      maximum_drawdown: z.number().describe("Maximum potential loss (%)"),
    }),
    diversification_metrics: z.object({
      number_of_assets: z.number(),
      herfindahl_index: z.number().describe("Concentration index (0-1, closer to 1 = more concentrated)"),
      effective_assets: z.number().describe("Effective number of assets based on concentration"),
      diversification_ratio: z.number().describe("Diversification effectiveness (0-1)"),
    }),
    concentration_risk: z.object({
      top_holding_percentage: z.number(),
      top_3_holdings_percentage: z.number(),
      top_5_holdings_percentage: z.number(),
      concentration_risk_level: z.enum(['low', 'medium', 'high']),
    }),
    asset_allocation: z.object({
      by_risk_level: z.array(z.object({
        risk_level: z.enum(['low', 'medium', 'high']),
        percentage: z.number(),
        assets: z.array(z.string()),
      })),
      by_category: z.array(z.object({
        category: z.string(),
        percentage: z.number(),
        volatility: z.number(),
      })),
    }),
    risk_recommendations: z.array(z.object({
      type: z.enum(['rebalance', 'diversify', 'reduce_risk', 'hedge']),
      priority: z.enum(['high', 'medium', 'low']),
      message: z.string(),
      suggested_action: z.string(),
    })),
    overall_risk_score: z.number().min(1).max(10).describe("Overall portfolio risk score (1=lowest risk, 10=highest risk)"),
  }),
  execute: async ({ context }) => {
    const { wallet_address, blockchain, confidence_level } = context;

    try {
      const portfolioData = await getPortfolioData(wallet_address, blockchain);
      
      if (portfolioData.holdings.length === 0) {
        return createEmptyRiskAnalysis(wallet_address, blockchain);
      }

      // Calculate risk metrics
      const riskMetrics = calculateRiskMetrics(portfolioData, confidence_level);
      const diversificationMetrics = calculateDiversificationMetrics(portfolioData.holdings);
      const concentrationRisk = calculateConcentrationRisk(portfolioData.holdings, portfolioData.total_value);
      const assetAllocation = analyzeAssetAllocation(portfolioData.holdings, portfolioData.total_value);
      const riskRecommendations = generateRiskRecommendations(portfolioData, riskMetrics, concentrationRisk);
      const overallRiskScore = calculateOverallRiskScore(riskMetrics, concentrationRisk, diversificationMetrics);

      return {
        wallet_address,
        blockchain,
        portfolio_value: Math.round(portfolioData.total_value * 100) / 100,
        risk_metrics: riskMetrics,
        diversification_metrics: diversificationMetrics,
        concentration_risk: concentrationRisk,
        asset_allocation: assetAllocation,
        risk_recommendations: riskRecommendations,
        overall_risk_score: Math.round(overallRiskScore * 10) / 10,
      };
    } catch (error: any) {
      console.error("Error analyzing portfolio risk:", error);
      throw new Error(`Failed to analyze portfolio risk for wallet ${wallet_address}: ${error.message}`);
    }
  },
});

async function getPortfolioData(wallet_address: string, blockchain: string) {
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
}

// Update the calculatePortfolio tool to use the shared function
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
    return await getPortfolioData(wallet_address, blockchain);
  },
});

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

// Helper function to calculate risk metrics
function calculateRiskMetrics(portfolioData: any, confidenceLevel: number) {
  const { holdings, total_value } = portfolioData;
  
  // Calculate portfolio volatility (weighted average of individual volatilities)
  let portfolioVolatility = 0;
  let totalWeight = 0;
  
  holdings.forEach((holding: any) => {
    const weight = holding.value / total_value;
    const volatility = Math.abs(holding.change_percentage_24h);
    portfolioVolatility += weight * volatility;
    totalWeight += weight;
  });
  
  // Annualize the volatility (assuming 24h volatility)
  const annualizedVolatility = portfolioVolatility * Math.sqrt(365);
  
  // Calculate Value at Risk (VaR) using normal distribution approximation
  const zScore = getZScore(confidenceLevel);
  const var1d = total_value * portfolioVolatility * zScore / 100;
  const var7d = total_value * portfolioVolatility * Math.sqrt(7) * zScore / 100;
  
  // Calculate Sharpe ratio (simplified using portfolio return vs volatility)
  const portfolioReturn = portfolioData.total_change_percentage_24h;
  const riskFreeRate = 0.02; // Assume 2% annual risk-free rate
  const sharpeRatio = portfolioReturn > 0 ? 
    (portfolioReturn - riskFreeRate/365) / (portfolioVolatility > 0 ? portfolioVolatility : 1) : 0;
  
  // Maximum drawdown estimation based on volatility
  const maxDrawdown = Math.min(portfolioVolatility * 2, 100); // Cap at 100%
  
  return {
    portfolio_volatility: Math.round(annualizedVolatility * 100) / 100,
    value_at_risk_1d: Math.round(var1d * 100) / 100,
    value_at_risk_7d: Math.round(var7d * 100) / 100,
    sharpe_ratio: Math.round(sharpeRatio * 1000) / 1000,
    maximum_drawdown: Math.round(maxDrawdown * 100) / 100,
  };
}

// Helper function to calculate diversification metrics
function calculateDiversificationMetrics(holdings: any[]) {
  const numberOfAssets = holdings.length;
  
  // Calculate Herfindahl Index (sum of squared weights)
  const totalValue = holdings.reduce((sum, h) => sum + h.value, 0);
  const herfindahlIndex = holdings.reduce((sum, holding) => {
    const weight = holding.value / totalValue;
    return sum + Math.pow(weight, 2);
  }, 0);
  
  // Effective number of assets (1 / Herfindahl Index)
  const effectiveAssets = 1 / herfindahlIndex;
  
  // Diversification ratio (effective assets / total assets)
  const diversificationRatio = effectiveAssets / numberOfAssets;
  
  return {
    number_of_assets: numberOfAssets,
    herfindahl_index: Math.round(herfindahlIndex * 10000) / 10000,
    effective_assets: Math.round(effectiveAssets * 100) / 100,
    diversification_ratio: Math.round(diversificationRatio * 1000) / 1000,
  };
}

// Helper function to calculate concentration risk
function calculateConcentrationRisk(holdings: any[], totalValue: number) {
  const sortedHoldings = [...holdings].sort((a, b) => b.value - a.value);
  
  const topHoldingPercentage = (sortedHoldings[0]?.value || 0) / totalValue * 100;
  const top3HoldingsPercentage = sortedHoldings.slice(0, 3).reduce((sum, h) => sum + h.value, 0) / totalValue * 100;
  const top5HoldingsPercentage = sortedHoldings.slice(0, 5).reduce((sum, h) => sum + h.value, 0) / totalValue * 100;
  
  // Determine concentration risk level
  let concentrationRiskLevel: 'low' | 'medium' | 'high' = 'low';
  if (topHoldingPercentage > 50) {
    concentrationRiskLevel = 'high';
  } else if (topHoldingPercentage > 25) {
    concentrationRiskLevel = 'medium';
  }
  
  return {
    top_holding_percentage: Math.round(topHoldingPercentage * 100) / 100,
    top_3_holdings_percentage: Math.round(top3HoldingsPercentage * 100) / 100,
    top_5_holdings_percentage: Math.round(top5HoldingsPercentage * 100) / 100,
    concentration_risk_level: concentrationRiskLevel,
  };
}

// Helper function to analyze asset allocation
function analyzeAssetAllocation(holdings: any[], totalValue: number) {
  // Define asset categories and their typical volatilities
  const assetCategories: {
    [key: string]: {
      symbols: string[];
      riskLevel: 'low' | 'medium' | 'high';
      expectedVolatility: number;
    }
  } = {
    'Stablecoins': {
      symbols: ['USDC', 'USDT', 'DAI', 'BUSD', 'TUSD', 'FRAX'],
      riskLevel: 'low' as const,
      expectedVolatility: 2,
    },
    'Blue Chip': {
      symbols: ['BTC', 'ETH', 'BNB'],
      riskLevel: 'medium' as const,
      expectedVolatility: 60,
    },
    'Large Cap Altcoins': {
      symbols: ['ADA', 'DOT', 'LINK', 'UNI', 'MATIC', 'SOL'],
      riskLevel: 'medium' as const,
      expectedVolatility: 80,
    },
    'DeFi Tokens': {
      symbols: ['AAVE', 'COMP', 'MKR', 'SNX', 'YFI', 'SUSHI', 'CAKE'],
      riskLevel: 'high' as const,
      expectedVolatility: 100,
    },
    'Meme/Small Cap': {
      symbols: [], // Everything else falls here
      riskLevel: 'high' as const,
      expectedVolatility: 120,
    },
  };
  
  const byRiskLevel = {
    low: { percentage: 0, assets: [] as string[] },
    medium: { percentage: 0, assets: [] as string[] },
    high: { percentage: 0, assets: [] as string[] },
  };
  
  const byCategory: any[] = [];
  
  // Initialize category tracking
  Object.keys(assetCategories).forEach(category => {
    byCategory.push({
      category,
      percentage: 0,
      volatility: assetCategories[category as keyof typeof assetCategories].expectedVolatility,
    });
  });
  
  holdings.forEach(holding => {
    const symbol = holding.symbol.toUpperCase();
    const weight = (holding.value / totalValue) * 100;
    
    // Find which category this asset belongs to
    let categorized = false;
    
    // Check each category except Meme/Small Cap first
    for (const [categoryName, categoryData] of Object.entries(assetCategories)) {
      if (categoryName !== 'Meme/Small Cap' && categoryData.symbols.includes(symbol)) {
        const categoryIndex = byCategory.findIndex(c => c.category === categoryName);
        byCategory[categoryIndex].percentage += weight;
        
        byRiskLevel[categoryData.riskLevel].percentage += weight;
        byRiskLevel[categoryData.riskLevel].assets.push(symbol);
        
        categorized = true;
        break;
      }
    }
    
    // If not categorized in any specific category, it's a meme/small cap
    if (!categorized) {
      const memeIndex = byCategory.findIndex(c => c.category === 'Meme/Small Cap');
      byCategory[memeIndex].percentage += weight;
      
      byRiskLevel.high.percentage += weight;
      byRiskLevel.high.assets.push(symbol);
    }
  });
  
  // Round percentages
  byCategory.forEach(category => {
    category.percentage = Math.round(category.percentage * 100) / 100;
  });
  
  const riskLevelArray = Object.entries(byRiskLevel).map(([level, data]) => ({
    risk_level: level as 'low' | 'medium' | 'high',
    percentage: Math.round(data.percentage * 100) / 100,
    assets: data.assets,
  }));
  
  return {
    by_risk_level: riskLevelArray,
    by_category: byCategory.filter(c => c.percentage > 0),
  };
}

// Helper function to generate risk recommendations
function generateRiskRecommendations(portfolioData: any, riskMetrics: any, concentrationRisk: any) {
  const recommendations: any[] = [];
  
  // High concentration risk
  if (concentrationRisk.concentration_risk_level === 'high') {
    recommendations.push({
      type: 'rebalance',
      priority: 'high',
      message: `Your portfolio is highly concentrated with ${concentrationRisk.top_holding_percentage.toFixed(1)}% in your top holding`,
      suggested_action: 'Consider reducing your largest position to below 25% of total portfolio value',
    });
  }
  
  // High volatility
  if (riskMetrics.portfolio_volatility > 100) {
    recommendations.push({
      type: 'reduce_risk',
      priority: 'high',
      message: `Portfolio volatility is very high at ${riskMetrics.portfolio_volatility.toFixed(1)}%`,
      suggested_action: 'Add stablecoins or blue-chip assets to reduce overall portfolio volatility',
    });
  }
  
  // Low diversification
  if (portfolioData.holdings.length < 5) {
    recommendations.push({
      type: 'diversify',
      priority: 'medium',
      message: `Portfolio contains only ${portfolioData.holdings.length} assets`,
      suggested_action: 'Consider diversifying across more assets and different crypto sectors',
    });
  }
  
  // High Value at Risk
  if (riskMetrics.value_at_risk_1d > portfolioData.total_value * 0.1) {
    recommendations.push({
      type: 'hedge',
      priority: 'high',
      message: `Daily Value at Risk is ${(riskMetrics.value_at_risk_1d / portfolioData.total_value * 100).toFixed(1)}% of portfolio`,
      suggested_action: 'Consider implementing stop-losses or hedging strategies',
    });
  }
  
  // Good portfolio structure
  if (recommendations.length === 0) {
    recommendations.push({
      type: 'diversify',
      priority: 'low',
      message: 'Portfolio shows good risk characteristics',
      suggested_action: 'Continue monitoring and consider periodic rebalancing',
    });
  }
  
  return recommendations;
}

// Helper function to calculate overall risk score
function calculateOverallRiskScore(riskMetrics: any, concentrationRisk: any, diversificationMetrics: any) {
  let score = 1;
  
  // Volatility component (0-3 points)
  if (riskMetrics.portfolio_volatility > 150) score += 3;
  else if (riskMetrics.portfolio_volatility > 100) score += 2;
  else if (riskMetrics.portfolio_volatility > 50) score += 1;
  
  // Concentration component (0-3 points)
  if (concentrationRisk.top_holding_percentage > 70) score += 3;
  else if (concentrationRisk.top_holding_percentage > 50) score += 2;
  else if (concentrationRisk.top_holding_percentage > 30) score += 1;
  
  // Diversification component (0-2 points)
  if (diversificationMetrics.diversification_ratio < 0.3) score += 2;
  else if (diversificationMetrics.diversification_ratio < 0.5) score += 1;
  
  // VaR component (0-2 points)
  if (riskMetrics.value_at_risk_1d > 0) {
    const varPercentage = (riskMetrics.value_at_risk_1d / 10000) * 100; // Assume 10k portfolio for percentage
    if (varPercentage > 20) score += 2;
    else if (varPercentage > 10) score += 1;
  }
  
  return Math.min(10, score);
}

// Helper function to get Z-score for VaR calculation
function getZScore(confidenceLevel: number): number {
  // Approximate Z-scores for common confidence levels
  const zScores: { [key: number]: number } = {
    0.90: 1.282,
    0.95: 1.645,
    0.99: 2.326,
  };
  
  return zScores[confidenceLevel] || 1.645; // Default to 95% confidence
}

// Helper function to create empty risk analysis
function createEmptyRiskAnalysis(wallet_address: string, blockchain: string) {
  return {
    wallet_address,
    blockchain,
    portfolio_value: 0,
    risk_metrics: {
      portfolio_volatility: 0,
      value_at_risk_1d: 0,
      value_at_risk_7d: 0,
      sharpe_ratio: 0,
      maximum_drawdown: 0,
    },
    diversification_metrics: {
      number_of_assets: 0,
      herfindahl_index: 0,
      effective_assets: 0,
      diversification_ratio: 0,
    },
    concentration_risk: {
      top_holding_percentage: 0,
      top_3_holdings_percentage: 0,
      top_5_holdings_percentage: 0,
      concentration_risk_level: 'low' as const,
    },
    asset_allocation: {
      by_risk_level: [],
      by_category: [],
    },
    risk_recommendations: [{
      type: 'diversify' as const,
      priority: 'low' as const,
      message: 'No holdings found in portfolio',
      suggested_action: 'Add cryptocurrency holdings to begin risk analysis',
    }],
    overall_risk_score: 1,
  };
}
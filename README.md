# Nosana Builders Challenge: Agent-101

![Agent-101](./assets/NosanaBuildersChallengeAgents.jpg)

## Agent Description: CryptoTracker AI Agent

**CryptoTracker** is an advanced cryptocurrency analysis and portfolio management AI agent that provides comprehensive crypto market insights, risk analysis, sentiment tracking, and automated price alerts with email notifications.

### Key Features

🔍 **Real-time Price Tracking**
- Live cryptocurrency price monitoring
- Multi-crypto price comparisons
- Market trend analysis and top performer tracking

📊 **Advanced Portfolio Analytics**
- Complete portfolio valuation across multiple blockchains
- Risk assessment with VaR, Sharpe ratio, and volatility metrics
- Diversification analysis and concentration risk evaluation
- Personalized investment recommendations

💭 **Social Sentiment Analysis**
- Twitter sentiment analysis for cryptocurrencies
- Market sentiment trends and social media buzz tracking
- Sentiment-based trading recommendations

🚨 **Smart Price Alerts**
- Automated price threshold monitoring
- Email notifications via Resend API
- One-time trigger system to prevent spam
- Comprehensive alert management and history

🔗 **Multi-Blockchain Support**
- Ethereum, BSC, Polygon wallet analysis
- Cross-chain portfolio aggregation
- Blockchain-specific risk metrics

## Technology Stack

- **Framework**: [Mastra](https://mastra.ai) - TypeScript AI agent framework
- **LLM**: Qwen 2.5 (1.5b for development, 32b for production)
- **Email Service**: [Resend](https://resend.com) for reliable email delivery
- **APIs**: CoinGecko API for cryptocurrency data
- **Deployment**: Docker + Nosana distributed computing network

## Get Started

### Prerequisites

- [Node.js](https://nodejs.org/) (>=20.9.0)
- [pnpm](https://pnpm.io/installation) (recommended) or npm
- [Docker](https://docs.docker.com/get-docker/) for containerization
- [Ollama](https://ollama.com/download) for local LLM (optional)

### Local Development Setup

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/agent-challenge.git
cd agent-challenge
```

2. **Install dependencies**
```bash
pnpm install
```

3. **Configure environment variables**
```bash
cp .env.example .env
# Edit .env with your actual API keys
```

4. **Start development server**
```bash
pnpm run dev
```

5. **Access the agent**
Navigate to `http://localhost:3000` in your browser

### Environment Variables

Create a `.env` file with the following variables:

```bash
# Required: Resend API for email notifications
RESEND_API_KEY=re_your_resend_api_key_here

# Application Configuration
NODE_ENV=development
PORT=3000
LOG_LEVEL=info

# Optional: Enhanced API access
COINGECKO_API_KEY=your_coingecko_pro_key_here

# LLM Configuration (for local Ollama)
MODEL_NAME_AT_ENDPOINT=qwen2.5:1.5b
API_BASE_URL=http://127.0.0.1:11434/api
```

### Local LLM Setup (Optional)

If you prefer to run your own LLM locally:

1. **Install Ollama**
```bash
# macOS
brew install ollama

# Or download from https://ollama.com/download
```

2. **Start Ollama and pull the model**
```bash
ollama serve
ollama pull qwen2.5:1.5b
```

## Usage Examples

### Basic Price Checking
```
"What is the current price of bitcoin?"
"Compare ethereum and solana prices"
"Show me the top 10 cryptocurrencies"
```

### Portfolio Analysis
```
"Analyze the portfolio for wallet 0x1234...5678 on ethereum"
"What's the risk assessment for my crypto holdings?"
"Calculate portfolio diversification metrics"
```

### Price Alerts
```
"Set up a bitcoin alert at $50000 and email me at john@example.com"
"Track ethereum price and alert me if it goes above $4000"
"Show me my active price alerts"
```

### Sentiment Analysis
```
"What's the Twitter sentiment for Bitcoin?"
"Analyze social media buzz around Solana for the past week"
"How are people feeling about Ethereum lately?"
```

### Email Testing
```
"Test my email system with test@example.com"
"Verify email alerts are working"
```

## Docker Deployment

### Build and Run Locally

```bash
# Build the container
docker build -t yourusername/cryptotracker-agent:latest .

# Run with environment variables
docker run -p 3000:3000 --env-file .env yourusername/cryptotracker-agent:latest

# Test the containerized agent
curl http://localhost:3000/health
```

### Docker Compose (Recommended)

```bash
# Setup environment
cp .env.example .env
# Edit .env with your API keys

# Start all services
docker-compose up --build -d

# View logs
docker-compose logs -f crypto-agent

# Stop services
docker-compose down
```

### Publish to Docker Hub

```bash
# Login to Docker Hub
docker login

# Build and tag
docker build -t yourusername/cryptotracker-agent:latest .

# Push to registry
docker push yourusername/cryptotracker-agent:latest
```

## Nosana Deployment

### Option A: Using Nosana CLI

1. **Install Nosana CLI**
```bash
npm install -g @nosana/cli
```

2. **Update job definition**
Edit `./nos_job_def/nosana_mastra.json` with your Docker image:
```json
{
  "image": "docker.io/yourusername/cryptotracker-agent:latest"
}
```

3. **Deploy to Nosana**
```bash
# Get wallet address and fund it
nosana address

# Deploy your agent
nosana job post --file ./nos_job_def/nosana_mastra.json --market nvidia-3090 --timeout 30
```

### Option B: Using Nosana Dashboard

1. Go to [Nosana Dashboard](https://dashboard.nosana.com/deploy)
2. Install [Phantom Wallet](https://phantom.app/)
3. Fund your wallet (ask in [Nosana Discord](https://nosana.com/discord))
4. Upload your job definition and deploy

## Project Structure

```
src/mastra/agents/crypto-agent/
├── crypto-agent.ts          # Main agent definition
├── tools/
│   ├── price-checker.ts     # Real-time price fetching
│   ├── price-comparator.ts  # Multi-crypto comparisons
│   ├── top-cryptos.ts       # Market leaders tracking
│   ├── market-trends.ts     # Market analysis
│   ├── portfolio.ts         # Portfolio & risk analysis
│   ├── price-alerts.ts      # Alert system with email
│   └── sentiment-analysis.ts # Twitter sentiment tracking
└── tests/
    └── agent.test.ts        # Test suite
```

## Key Tools & Features

### 1. Price Monitoring Tools
- **getPriceBySymbol**: Real-time price fetching
- **comparePrices**: Multi-cryptocurrency comparison
- **getTopCryptos**: Market leaders analysis
- **getMarketTrends**: Market trend insights

### 2. Portfolio Analysis
- **calculatePortfolio**: Multi-blockchain portfolio valuation
- **analyzePortfolioRisk**: Advanced risk metrics (VaR, Sharpe ratio, volatility)

### 3. Alert System
- **setupPriceAlert**: Configurable price thresholds
- **listPriceAlerts**: Active alert management
- **removePriceAlert**: Alert cleanup
- **checkAlertStatus**: System monitoring

### 4. Sentiment Analysis
- **analyzeSentiment**: Twitter sentiment tracking
- **sentimentTrends**: Social media buzz analysis

### 5. Email Notifications
- **testEmailAlert**: Email system verification
- Automated price alert emails via Resend
- Beautiful HTML email templates

## Testing

### Local Testing
```bash
# Start development server
pnpm run dev

# Run specific tests
pnpm test

# Test email functionality
curl -X POST http://localhost:3000/test-email \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

### Docker Testing
```bash
# Test container build
docker build -t test-crypto-agent .

# Test container run
docker run -p 3000:3000 --env-file .env test-crypto-agent

# Health check
curl http://localhost:3000/health
```

## API Integrations

- **CoinGecko API**: Real-time cryptocurrency data
- **Resend API**: Reliable email delivery service
- **Twitter API**: Social sentiment analysis (configurable)

## Architecture Highlights

- **Modular Design**: Each feature is a separate, testable tool
- **Type Safety**: Full TypeScript implementation with Zod validation
- **Error Handling**: Comprehensive error catching and user feedback
- **Rate Limiting**: Built-in API rate limiting and retry logic
- **Scalable**: Docker-ready for cloud deployment

## Demo Video

🎥 **[Watch Demo Video](YOUR_VIDEO_LINK_HERE)**

See CryptoTracker in action:
- Real-time price analysis
- Portfolio risk assessment
- Automated email alerts
- Sentiment analysis features

## Deployment Links

- **Docker Hub**: `docker.io/yourusername/cryptotracker-agent:latest`
- **Nosana Job ID**: `YOUR_NOSANA_JOB_ID_HERE`
- **Live Demo**: `YOUR_NOSANA_DEPLOYMENT_URL_HERE`

## Social Media

🐦 **Twitter Post**: [Link to your tweet with #NosanaAgentChallenge](YOUR_TWITTER_LINK)

---

## Resources

- [Nosana Documentation](https://docs.nosana.io)
- [Mastra Documentation](https://mastra.ai/docs)
- [Resend API Docs](https://resend.com/docs)
- [CoinGecko API](https://www.coingecko.com/en/api)

## Support

- [Nosana Discord](https://nosana.com/discord) - Technical support
- [Builders Challenge Chat](https://discord.com/channels/236263424676331521/1354391113028337664)
- Follow [@nosana_ai](https://x.com/nosana_ai) for updates

---

**Built with ❤️ for the Nosana Builders Challenge**
*Empowering the future of decentralized AI agents*

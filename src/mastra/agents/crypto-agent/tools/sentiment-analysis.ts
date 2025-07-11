import { z } from 'zod';
import { Tool } from '@mastra/core/tools';

const sentimentSchema = z.object({
  token_symbol: z.string().describe('Token symbol to analyze sentiment for (e.g., BTC, ETH, SOL)'),
  timeframe: z.enum(['1h', '6h', '24h', '7d']).default('24h').describe('Timeframe for sentiment analysis'),
  max_tweets: z.number().min(10).max(100).default(50).describe('Maximum number of tweets to analyze'),
});

// Rate limiter for API calls
class SentimentRateLimiter {
  private lastCall: number = 0;
  private readonly minInterval: number = 2000; // 2 seconds between calls

  async wait(): Promise<void> {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastCall;
    
    if (timeSinceLastCall < this.minInterval) {
      const waitTime = this.minInterval - timeSinceLastCall;
      console.log(`Sentiment API rate limiting: waiting ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastCall = Date.now();
  }
}

const sentimentRateLimiter = new SentimentRateLimiter();

// Simple sentiment analysis function
function analyzeSentimentBase(text: string): { score: number; label: string } {
  const positiveWords = [
    'bull', 'bullish', 'moon', 'pump', 'buy', 'hodl', 'diamond', 'hands', 
    'rocket', 'green', 'up', 'rise', 'gain', 'profit', 'win', 'good', 'great',
    'awesome', 'amazing', 'strong', 'solid', 'love', 'like', 'optimistic',
    'confident', 'breakthrough', 'surge', 'rally', 'boom'
  ];
  
  const negativeWords = [
    'bear', 'bearish', 'dump', 'sell', 'crash', 'drop', 'fall', 'red', 'down',
    'loss', 'lose', 'bad', 'terrible', 'awful', 'weak', 'fear', 'panic',
    'worried', 'concerned', 'doubt', 'skeptical', 'disappointed', 'frustrated',
    'collapse', 'plummet', 'disaster', 'bubble', 'scam', 'rug'
  ];

  const words = text.toLowerCase().split(/\s+/);
  let score = 0;
  
  words.forEach(word => {
    if (positiveWords.includes(word)) score += 1;
    if (negativeWords.includes(word)) score -= 1;
  });

  // Normalize score to -1 to 1 range
  const normalizedScore = Math.max(-1, Math.min(1, score / Math.max(words.length / 10, 1)));
  
  let label = 'Neutral';
  if (normalizedScore > 0.1) label = 'Positive';
  else if (normalizedScore > 0.3) label = 'Very Positive';
  else if (normalizedScore < -0.1) label = 'Negative';
  else if (normalizedScore < -0.3) label = 'Very Negative';

  return { score: Math.round(normalizedScore * 1000) / 1000, label };
}

// Mock Twitter data for demonstration
function getMockTwitterData(tokenSymbol: string, maxTweets: number) {
  const mockTweets = [
    `$${tokenSymbol} is looking bullish today! Great momentum 🚀`,
    `Just bought more $${tokenSymbol}. Diamond hands! 💎🙌`,
    `$${tokenSymbol} dumping hard... not looking good 📉`,
    `Love the technology behind $${tokenSymbol}. Long term holder 📈`,
    `$${tokenSymbol} to the moon! Best investment ever 🌙`,
    `Worried about $${tokenSymbol} recent performance. Might sell soon 😰`,
    `$${tokenSymbol} showing strong support levels. Time to buy the dip!`,
    `Market crash affecting $${tokenSymbol} badly. Bear market confirmed 🐻`,
    `$${tokenSymbol} partnership announcement huge! This is amazing news 🎉`,
    `$${tokenSymbol} overvalued in my opinion. Bubble territory 💭`,
    `HODL $${tokenSymbol} no matter what! Strong fundamentals 💪`,
    `$${tokenSymbol} technical analysis looking very promising 📊`,
    `Sold all my $${tokenSymbol}. Too much volatility for me 📉`,
    `$${tokenSymbol} community is the best! Great project 👥`,
    `$${tokenSymbol} regulations coming. Might be risky 🚨`
  ];

  // Shuffle and take requested number of tweets
  const shuffled = mockTweets.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(maxTweets, shuffled.length)).map((tweet, index) => ({
    id: `mock_${index}`,
    text: tweet,
    created_at: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
    author: `CryptoUser${Math.floor(Math.random() * 1000)}`,
    metrics: {
      retweet_count: Math.floor(Math.random() * 100),
      like_count: Math.floor(Math.random() * 500),
      reply_count: Math.floor(Math.random() * 50)
    }
  }));
}

export const analyzeSentiment = new Tool({
  id: 'analyzeSentiment',
  description: 'Analyze Twitter sentiment for a specific cryptocurrency token',
  inputSchema: sentimentSchema,
  outputSchema: z.object({
    token_symbol: z.string(),
    timeframe: z.string(),
    total_tweets_analyzed: z.number(),
    sentiment_summary: z.object({
      overall_sentiment: z.enum(['Very Positive', 'Positive', 'Neutral', 'Negative', 'Very Negative']),
      sentiment_score: z.number().describe('Sentiment score from -1 (very negative) to 1 (very positive)'),
      confidence_level: z.number().describe('Confidence in sentiment analysis (0-1)'),
    }),
    sentiment_breakdown: z.object({
      positive_tweets: z.number(),
      negative_tweets: z.number(),
      neutral_tweets: z.number(),
      positive_percentage: z.number(),
      negative_percentage: z.number(),
      neutral_percentage: z.number(),
    }),
    key_topics: z.array(z.object({
      topic: z.string(),
      frequency: z.number(),
      sentiment: z.string(),
    })),
    influential_tweets: z.array(z.object({
      text: z.string(),
      sentiment: z.string(),
      engagement: z.number().describe('Combined likes, retweets, and replies'),
      created_at: z.string(),
    })),
    sentiment_trend: z.object({
      trend_direction: z.enum(['Improving', 'Declining', 'Stable']),
      trend_strength: z.enum(['Strong', 'Moderate', 'Weak']),
      description: z.string(),
    }),
    recommendations: z.array(z.object({
      type: z.enum(['buy_signal', 'sell_signal', 'hold', 'monitor']),
      confidence: z.enum(['high', 'medium', 'low']),
      reasoning: z.string(),
    })),
  }),
  execute: async ({ context }) => {
    const { token_symbol, timeframe, max_tweets } = context;
    
    try {
      await sentimentRateLimiter.wait();
      
      console.log(`Analyzing sentiment for $${token_symbol} over ${timeframe} timeframe...`);
      
      // For now, use mock data. In production, you'd integrate with:
      // - Twitter API v2
      // - Social media aggregation services like LunarCrush
      // - Alternative data providers
      
      const tweets = getMockTwitterData(token_symbol, max_tweets);
      
      // Analyze sentiment for each tweet
      const analyzedTweets = tweets.map(tweet => ({
        ...tweet,
        sentiment: analyzeSentimentBase(tweet.text),
        engagement: tweet.metrics.like_count + tweet.metrics.retweet_count + tweet.metrics.reply_count
      }));

      // Calculate sentiment breakdown
      const positiveCount = analyzedTweets.filter(t => t.sentiment.score > 0.1).length;
      const negativeCount = analyzedTweets.filter(t => t.sentiment.score < -0.1).length;
      const neutralCount = analyzedTweets.length - positiveCount - negativeCount;

      const positivePercentage = (positiveCount / analyzedTweets.length) * 100;
      const negativePercentage = (negativeCount / analyzedTweets.length) * 100;
      const neutralPercentage = (neutralCount / analyzedTweets.length) * 100;

      // Calculate overall sentiment
      const averageSentiment = analyzedTweets.reduce((sum, tweet) => sum + tweet.sentiment.score, 0) / analyzedTweets.length;
      
      let overallSentiment: 'Very Positive' | 'Positive' | 'Neutral' | 'Negative' | 'Very Negative' = 'Neutral';
      if (averageSentiment > 0.3) overallSentiment = 'Very Positive';
      else if (averageSentiment > 0.1) overallSentiment = 'Positive';
      else if (averageSentiment < -0.3) overallSentiment = 'Very Negative';
      else if (averageSentiment < -0.1) overallSentiment = 'Negative';

      // Find key topics
      const topicWords = ['price', 'moon', 'dip', 'buy', 'sell', 'hodl', 'bull', 'bear', 'pump', 'dump'];
      const keyTopics = topicWords.map(topic => {
        const frequency = analyzedTweets.filter(t => 
          t.text.toLowerCase().includes(topic)
        ).length;
        const topicSentiment = analyzedTweets
          .filter(t => t.text.toLowerCase().includes(topic))
          .reduce((sum, t) => sum + t.sentiment.score, 0) / frequency || 0;
        
        return {
          topic,
          frequency,
          sentiment: topicSentiment > 0.1 ? 'Positive' : topicSentiment < -0.1 ? 'Negative' : 'Neutral'
        };
      }).filter(t => t.frequency > 0).sort((a, b) => b.frequency - a.frequency).slice(0, 5);

      // Get most influential tweets
      const influentialTweets = analyzedTweets
        .sort((a, b) => b.engagement - a.engagement)
        .slice(0, 5)
        .map(tweet => ({
          text: tweet.text,
          sentiment: tweet.sentiment.label,
          engagement: tweet.engagement,
          created_at: tweet.created_at,
        }));

      // Determine sentiment trend
      const recentTweets = analyzedTweets.slice(0, Math.floor(analyzedTweets.length / 2));
      const olderTweets = analyzedTweets.slice(Math.floor(analyzedTweets.length / 2));
      
      const recentSentiment = recentTweets.reduce((sum, t) => sum + t.sentiment.score, 0) / recentTweets.length;
      const olderSentiment = olderTweets.reduce((sum, t) => sum + t.sentiment.score, 0) / olderTweets.length;
      
      const trendDiff = recentSentiment - olderSentiment;
      let trendDirection: 'Improving' | 'Declining' | 'Stable' = 'Stable';
      let trendStrength: 'Strong' | 'Moderate' | 'Weak' = 'Weak';
      
      if (Math.abs(trendDiff) > 0.2) {
        trendStrength = 'Strong';
        trendDirection = trendDiff > 0 ? 'Improving' : 'Declining';
      } else if (Math.abs(trendDiff) > 0.1) {
        trendStrength = 'Moderate';
        trendDirection = trendDiff > 0 ? 'Improving' : 'Declining';
      }

      // Generate recommendations
      const recommendations = [];
      
      if (overallSentiment === 'Very Positive' && trendDirection === 'Improving') {
        recommendations.push({
          type: 'buy_signal' as const,
          confidence: 'high' as const,
          reasoning: 'Very positive sentiment with improving trend suggests strong buying opportunity'
        });
      } else if (overallSentiment === 'Positive') {
        recommendations.push({
          type: 'hold' as const,
          confidence: 'medium' as const,
          reasoning: 'Positive sentiment indicates good holding opportunity'
        });
      } else if (overallSentiment === 'Very Negative' && trendDirection === 'Declining') {
        recommendations.push({
          type: 'sell_signal' as const,
          confidence: 'high' as const,
          reasoning: 'Very negative sentiment with declining trend suggests potential sell signal'
        });
      } else {
        recommendations.push({
          type: 'monitor' as const,
          confidence: 'medium' as const,
          reasoning: 'Mixed or neutral sentiment requires continued monitoring'
        });
      }

      const confidenceLevel = Math.min(1, analyzedTweets.length / 50); // Higher confidence with more data

      return {
        token_symbol: token_symbol.toUpperCase(),
        timeframe,
        total_tweets_analyzed: analyzedTweets.length,
        sentiment_summary: {
          overall_sentiment: overallSentiment,
          sentiment_score: Math.round(averageSentiment * 1000) / 1000,
          confidence_level: Math.round(confidenceLevel * 1000) / 1000,
        },
        sentiment_breakdown: {
          positive_tweets: positiveCount,
          negative_tweets: negativeCount,
          neutral_tweets: neutralCount,
          positive_percentage: Math.round(positivePercentage * 100) / 100,
          negative_percentage: Math.round(negativePercentage * 100) / 100,
          neutral_percentage: Math.round(neutralPercentage * 100) / 100,
        },
        key_topics: keyTopics,
        influential_tweets: influentialTweets,
        sentiment_trend: {
          trend_direction: trendDirection,
          trend_strength: trendStrength,
          description: `Sentiment is ${trendDirection.toLowerCase()} with ${trendStrength.toLowerCase()} ${trendStrength === 'Strong' ? 'momentum' : 'signals'}`,
        },
        recommendations,
      };

    } catch (error: any) {
      console.error('Error analyzing sentiment:', error);
      throw new Error(`Failed to analyze sentiment for ${token_symbol}: ${error.message}`);
    }
  },
});
import { Mastra } from "@mastra/core/mastra";
import { PinoLogger } from "@mastra/loggers";
import { weatherAgent } from "./agents/weather-agent/weather-agent";
import { weatherWorkflow } from "./agents/weather-agent/weather-workflow";
import { cryptoAgent } from "./agents/crypto-agent/crypto-agent";

export const mastra = new Mastra({
    workflows: { weatherWorkflow },
    agents: { weatherAgent, cryptoAgent },
    logger: new PinoLogger({
        name: "Mastra",
        level: "info",
    }),
    server: {
        port: 8080,
        timeout: 10000,
    },
});

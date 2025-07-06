import { Mastra } from "@mastra/core/mastra";
import { PinoLogger } from "@mastra/loggers";
import { cryptoAgent } from "./agents/crypto-agent/crypto-agent";

export const mastra = new Mastra({
    workflows: { },
    agents: { cryptoAgent },
    logger: new PinoLogger({
        name: "Mastra",
        level: "info",
    }),
    server: {
        port: 8080,
        timeout: 10000,
    },
});

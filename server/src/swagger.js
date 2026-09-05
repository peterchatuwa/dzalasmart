import swaggerJsdoc from "swagger-jsdoc";
import { APP_NAME, APP_SLUG } from "./brand.js";
import { config } from "./config.js";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: `${APP_NAME} API`,
      version: "0.1.0",
      description: `Server-backed farming system for Malawi. Manages farmer records, season events, market intelligence, and agricultural advisory services.`,
      contact: {
        name: "API Support",
        url: "https://github.com/peterchatuwa/dzalasmart",
      },
      license: {
        name: "MIT",
        url: "https://github.com/peterchatuwa/dzalasmart/blob/main/LICENSE",
      },
    },
    servers: [
      {
        url: config.isDevelopment ? "http://localhost:4000" : "https://api.nzeru.mw",
        description: config.isDevelopment ? "Development server" : "Production server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Enter the token received from login/register",
        },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            error: {
              type: "string",
              description: "Error message",
            },
          },
        },
        Farmer: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            code: { type: "string", example: "MW-LIL-1234-5678" },
            name: { type: "string", example: "Grace Banda" },
            phone: { type: "string", example: "+265888000001" },
            district: { type: "string", example: "Lilongwe" },
            epa: { type: "string", example: "Mitundu" },
            region: { type: "string", example: "Central" },
            createdAt: { type: "number", format: "int64" },
          },
        },
        Stage: {
          type: "object",
          properties: {
            index: { type: "number" },
            key: { type: "string", example: "planting" },
            name: { type: "string", example: "Planting" },
          },
        },
        SeasonEvent: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            stageIndex: { type: "number" },
            stageKey: { type: "string" },
            stageName: { type: "string" },
            channel: { type: "string", enum: ["mobile", "ussd"] },
            createdAt: { type: "number", format: "int64" },
          },
        },
      },
    },
    tags: [
      { name: "Health", description: "System health and monitoring" },
      { name: "Farmers", description: "Farmer authentication and management" },
      { name: "Staff", description: "Staff authentication and management" },
      { name: "Season", description: "Agricultural season tracking" },
      { name: "Market", description: "Market prices and intelligence" },
      { name: "Advisory", description: "Agricultural advisory services" },
      { name: "USSD", description: "USSD channel integration" },
    ],
  },
  apis: ["./src/swagger/*.js"],
};

export const swaggerSpec = swaggerJsdoc(options);

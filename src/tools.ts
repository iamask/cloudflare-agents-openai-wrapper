/**
 * Tool definitions for the AI chat agent with MCP server integration.
 * Tools can either require human confirmation or execute automatically.
 */

import { tool } from "ai";
import { z } from "zod";
import { generateId } from "ai";

import { agentContext } from "./server";
import { unstable_scheduleSchema } from "agents/schedule";

export interface Env {
  AI: Ai;
  PUBLIC_BUCKET: R2Bucket;
  doWorker: Fetcher;
  graphqlWorker: Fetcher;
}

// Cloudflare configuration constants
const CLOUDFLARE_ZONE_ID =
  process.env.CLOUDFLARE_ZONE_ID || "a37b5b3eca17274d2ca0cbc97a950636";
const CLOUDFLARE_RULESET_ID =
  process.env.CLOUDFLARE_RULESET_ID || "f252f8e1e67e42db970584d5e67b9c59";

/**
 * Tool: Send a webhook message.
 */
const sendWebhook = tool({
  description: "send a message to the webhook",
  parameters: z.object({ message: z.string() }),
  execute: async ({ message }) => {
    // Use environment variable instead of hardcoded URL
    const hookurl = process.env.GOOGLE_CHAT_WEBHOOK_URL || "";
    try {
      console.log("Preparing to send webhook message:", message);

      const payload = JSON.stringify({ text: message });
      console.log("Payload:", payload);

      const response = await fetch(hookurl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=UTF-8",
        },
        body: payload,
      });

      const responseText = await response.text();

      if (!response.ok) {
        throw new Error(
          `HTTP error! status: ${response.status}, body: ${responseText}`
        );
      }

      return {
        content: [
          {
            type: "text",
            text: `Message successfully sent to the webhook.`,
          },
        ],
      };
    } catch (error) {
      console.error("Error sending webhook:", error);
      return {
        content: [
          {
            type: "text",
            text: `Failed to send message to the webhook. Error: ${error}`,
          },
        ],
      };
    }
  },
});

/**
 * Tool: Get weather information.
 * This tool requires human confirmation when executed.
 */
const getWeatherInformation = tool({
  description:
    "Get current weather information for a specific city using the Open-Meteo API",
  parameters: z.object({
    city: z
      .string()
      .describe("The name of the city to get weather information for"),
  }),
  execute: async ({ city }) => {
    try {
      console.log(`[Weather] Getting weather information for ${city}`);

      // First, get the coordinates for the city using geocoding API
      const geocodingUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;

      const geocodingResponse = await fetch(geocodingUrl);
      if (!geocodingResponse.ok) {
        throw new Error(`Geocoding API error: ${geocodingResponse.status}`);
      }

      const geocodingData =
        (await geocodingResponse.json()) as GeocodingResponse;

      if (!geocodingData.results || geocodingData.results.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `City "${city}" not found. Please check the spelling or try a different city name.`,
            },
          ],
        };
      }

      const location = geocodingData.results[0];
      const { latitude, longitude, name, country, admin1 } = location;

      console.log(
        `[Weather] Found coordinates for ${name}: ${latitude}, ${longitude}`
      );

      // Get weather data using the coordinates
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m&timezone=auto`;

      const weatherResponse = await fetch(weatherUrl);
      if (!weatherResponse.ok) {
        throw new Error(`Weather API error: ${weatherResponse.status}`);
      }

      const weatherData = (await weatherResponse.json()) as WeatherResponse;
      const current = weatherData.current;

      // Weather code mapping for human-readable descriptions
      const weatherCodes: Record<number, string> = {
        0: "Clear sky",
        1: "Mainly clear",
        2: "Partly cloudy",
        3: "Overcast",
        45: "Foggy",
        48: "Depositing rime fog",
        51: "Light drizzle",
        53: "Moderate drizzle",
        55: "Dense drizzle",
        56: "Light freezing drizzle",
        57: "Dense freezing drizzle",
        61: "Slight rain",
        63: "Moderate rain",
        65: "Heavy rain",
        66: "Light freezing rain",
        67: "Heavy freezing rain",
        71: "Slight snow fall",
        73: "Moderate snow fall",
        75: "Heavy snow fall",
        77: "Snow grains",
        80: "Slight rain showers",
        81: "Moderate rain showers",
        82: "Violent rain showers",
        85: "Slight snow showers",
        86: "Heavy snow showers",
        95: "Thunderstorm",
        96: "Thunderstorm with slight hail",
        99: "Thunderstorm with heavy hail",
      };

      const weatherDescription =
        weatherCodes[current.weather_code] || "Unknown weather condition";
      const locationName = admin1
        ? `${name}, ${admin1}, ${country}`
        : `${name}, ${country}`;

      const weatherInfo = `🌤️ **Weather in ${locationName}**

🌡️ **Temperature**: ${current.temperature_2m}°C (feels like ${current.apparent_temperature}°C)
💧 **Humidity**: ${current.relative_humidity_2m}%
🌦️ **Conditions**: ${weatherDescription}
🌧️ **Precipitation**: ${current.precipitation}mm
💨 **Wind**: ${current.wind_speed_10m} km/h from ${current.wind_direction_10m}° direction

*Data provided by Open-Meteo API*`;

      return {
        content: [
          {
            type: "text",
            text: weatherInfo,
          },
        ],
      };
    } catch (error) {
      console.error("[Weather] Error fetching weather information:", error);
      return {
        content: [
          {
            type: "text",
            text: `Failed to get weather information for "${city}". Error: ${error}`,
          },
        ],
      };
    }
  },
});

/**
 * Tool: Get local time.
 * This tool executes automatically.
 */
const getLocalTime = tool({
  description:
    "Get the current local time for a specified city or location around the world",
  parameters: z.object({
    location: z
      .string()
      .describe("The name of the city or location to get local time for"),
  }),
  execute: async ({ location }) => {
    try {
      console.log(`[LocalTime] Getting local time for ${location}`);

      // First, get the timezone information for the location using geocoding API
      const geocodingUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`;

      const geocodingResponse = await fetch(geocodingUrl);
      if (!geocodingResponse.ok) {
        throw new Error(`Geocoding API error: ${geocodingResponse.status}`);
      }

      const geocodingData =
        (await geocodingResponse.json()) as GeocodingResponse;

      if (!geocodingData.results || geocodingData.results.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `Location "${location}" not found. Please check the spelling or try a different location name.`,
            },
          ],
          type: "text",
        };
      }

      const locationData = geocodingData.results[0];
      const { name, country, admin1, timezone } = locationData;

      console.log(`[LocalTime] Found timezone for ${name}: ${timezone}`);

      // Get current time in the location's timezone
      const now = new Date();

      // Format the time for the specific timezone
      const localTime = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      }).format(now);

      // Get timezone offset information
      const timezoneOffset = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        timeZoneName: "short",
      }).format(now);

      // Get day/night status
      const hour = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour: "numeric",
        hour12: false,
      }).format(now);

      const hourNum = parseInt(hour);
      let timeOfDay = "";
      if (hourNum >= 5 && hourNum < 12) {
        timeOfDay = "🌅 Morning";
      } else if (hourNum >= 12 && hourNum < 17) {
        timeOfDay = "☀️ Afternoon";
      } else if (hourNum >= 17 && hourNum < 21) {
        timeOfDay = "🌆 Evening";
      } else {
        timeOfDay = "🌙 Night";
      }

      const locationName = admin1
        ? `${name}, ${admin1}, ${country}`
        : `${name}, ${country}`;

      const timeInfo = `🕐 **Local Time in ${locationName}**

⏰ **Current Time**: ${localTime}
🌍 **Timezone**: ${timezoneOffset}
${timeOfDay}

*Data provided by Open-Meteo Geocoding API*`;

      return {
        content: [
          {
            type: "text",
            text: timeInfo,
          },
        ],
      };
    } catch (error) {
      console.error("[LocalTime] Error fetching local time:", error);
      return {
        content: [
          {
            type: "text",
            text: `Failed to get local time for "${location}". Error: ${error}`,
          },
        ],
      };
    }
  },
});

/**
 * Tool: Search document using Cloudflare AutoRAG.
 */
const searchDocs = tool({
  description:
    "Search Cloudflare documentation using AutoRAG to get detailed answers about Cloudflare services and features",
  parameters: z.object({
    message: z
      .string()
      .describe("The question or query about Cloudflare services"),
  }),
  execute: async ({ message }) => {
    try {
      const agent = agentContext.getStore();
      if (!agent) {
        throw new Error("No agent found");
      }

      // Call AutoRAG using the specified instance
      const response = await (agent as any).env.AI.autorag(
        "dark-wind-fbc8"
      ).aiSearch({
        query: message,
        rewrite_query: true,
        max_num_results: 3,
        ranking_options: {
          score_threshold: 0.3,
        },
      });

      if (!response?.response) {
        throw new Error("No response from AutoRAG");
      }

      return {
        content: [
          {
            type: "text",
            text: response.response,
          },
        ],
      };
    } catch (error) {
      console.error("Error searching Cloudflare docs:", error);
      return {
        content: [
          {
            type: "text",
            text: `Failed to search Cloudflare documentation. Error: ${error}`,
          },
        ],
      };
    }
  },
});

/**
 * Tool: Schedule a task for later execution.
 */
const scheduleTask = tool({
  description: "A tool to schedule a task to be executed at a later time",
  parameters: unstable_scheduleSchema,
  execute: async ({ when, description }) => {
    // Retrieve the agent context.
    const agent = agentContext.getStore();
    if (!agent) {
      throw new Error("No agent found");
    }
    function throwError(msg: string): string {
      throw new Error(msg);
    }
    if (when.type === "no-schedule") {
      return "Not a valid schedule input";
    }
    const input =
      when.type === "scheduled"
        ? when.date // scheduled
        : when.type === "delayed"
          ? when.delayInSeconds // delayed
          : when.type === "cron"
            ? when.cron // cron
            : throwError("not a valid schedule input");
    try {
      agent.schedule(input!, "executeTask", description);
    } catch (error) {
      console.error("error scheduling task", error);
      return `Error scheduling task: ${error}`;
    }
    return `Task scheduled for type "${when.type}" : ${input}`;
  },
});

/**
 * Tool: Generate images using Cloudflare Workers AI.
 */
const generateImage = tool({
  description:
    "generate an image from a text description using Cloudflare Workers AI",
  parameters: z.object({
    prompt: z
      .string()
      .min(1)
      .max(2048)
      .describe("A text description of the image you want to generate"),
    steps: z
      .number()
      .min(1)
      .max(8)
      .optional()
      .default(4)
      .describe(
        "Number of diffusion steps (1-8). Higher values can improve quality but take longer"
      ),
  }),
  execute: async ({ prompt, steps }) => {
    try {
      console.log(
        "[Image Generation] Starting with prompt:",
        prompt,
        "steps:",
        steps
      );

      const agent = agentContext.getStore();
      if (!agent) {
        console.error("[Image Generation] No agent found in context");
        throw new Error("No agent found");
      }

      console.log("[Image Generation] Agent context found, calling AI.run...");

      // Access AI binding through the environment
      const response = await (agent as any).env.AI.run(
        "@cf/black-forest-labs/flux-1-schnell",
        {
          prompt,
          steps,
        },
        {
          gateway: {
            id: "agents",
            skipCache: false,
            cacheTtl: 3360,
            metadata: { application: "openai-wrapper", user: "aj", dev: true },
          },
        }
      );

      console.log("[Image Generation] AI.run response received:", {
        hasImage: !!response?.image,
        responseKeys: Object.keys(response || {}),
        responseType: typeof response,
        imageType: response?.image ? typeof response.image : "undefined",
        imageLength: response?.image ? response.image.length : 0,
        firstFewChars: response?.image
          ? response.image.substring(0, 50) + "..."
          : "none",
      });

      if (!response?.image) {
        console.error("[Image Generation] No image in response:", response);
        throw new Error("No image generated in response");
      }

      // Generate a unique filename using timestamp and random string
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 8);
      const filename = `${timestamp}-${randomString}.jpg`;
      const key = `ai-generated/${filename}`;

      // Convert base64 to ArrayBuffer
      const base64Data = response.image;
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Save to R2
      console.log("[Image Generation] Saving image to R2");
      await (agent as any).env.PUBLIC_BUCKET.put(key, bytes, {
        httpMetadata: {
          contentType: "image/jpeg",
          cacheControl: "public, max-age=31536000",
        },
      });

      // Generate public URL
      const publicUrl = `https://r2.zxc.co.in/${key}`;
      console.log("[Image Generation] Image saved successfully:", {
        publicUrl,
      });

      // Return the result with a direct URL without any Markdown syntax
      return {
        type: "text",
        text: `I have generated an image of a "${prompt}". View it at: ${publicUrl}`,
      };
    } catch (error) {
      console.error("[Image Generation] Error:", error);
      return {
        type: "text",
        text: `Failed to generate image. Error: ${error}`,
      };
    }
  },
});

// Add type definitions for REST Countries API
interface CountryResponse {
  name: {
    common: string;
    official: string;
  };
  capital: string[];
  region: string;
  population: number;
  languages: Record<string, string>;
  currencies: Record<
    string,
    {
      name: string;
      symbol: string;
    }
  >;
  flags: {
    png: string;
  };
}

// Add type definitions for Pokémon API
interface PokemonResponse {
  name: string;
  id: number;
  height: number;
  weight: number;
  types: Array<{
    type: {
      name: string;
    };
  }>;
  abilities: Array<{
    ability: {
      name: string;
    };
  }>;
  sprites: {
    front_default: string;
  };
}

// Add type definitions for Open-Meteo API
interface GeocodingResponse {
  results: Array<{
    id: number;
    name: string;
    latitude: number;
    longitude: number;
    elevation: number;
    feature_code: string;
    country_code: string;
    admin1_id: number;
    admin2_id: number;
    admin3_id: number;
    admin4_id: number;
    admin1: string;
    admin2: string;
    admin3: string;
    admin4: string;
    country: string;
    timezone: string;
    population: number;
    postcodes: string[];
    country_id: number;
  }>;
  generationtime_ms: number;
}

interface WeatherResponse {
  latitude: number;
  longitude: number;
  generationtime_ms: number;
  utc_offset_seconds: number;
  timezone: string;
  timezone_abbreviation: string;
  elevation: number;
  current_units: {
    time: string;
    interval: string;
    temperature_2m: string;
    relative_humidity_2m: string;
    apparent_temperature: string;
    precipitation: string;
    weather_code: string;
    wind_speed_10m: string;
    wind_direction_10m: string;
  };
  current: {
    time: string;
    interval: number;
    temperature_2m: number;
    relative_humidity_2m: number;
    apparent_temperature: number;
    precipitation: number;
    weather_code: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
  };
}

/**
 * Tool: Search country details using REST Countries API.
 */
const searchCountry = tool({
  description:
    "Search for country details using the REST Countries API. Can search by country name or full name.",
  parameters: z.object({
    name: z.string().describe("The name of the country to search for"),
    fullName: z
      .boolean()
      .optional()
      .default(false)
      .describe("Whether to search for exact full name match"),
  }),
  execute: async ({ name, fullName }) => {
    try {
      const baseUrl = "https://restcountries.com/v3.1/name";
      const url = `${baseUrl}/${encodeURIComponent(name)}${fullName ? "?fullText=true" : ""}`;

      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 404) {
          return {
            content: [
              {
                type: "text",
                text: `No country found with the name "${name}"`,
              },
            ],
          };
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const countries = (await response.json()) as CountryResponse[];

      // Format the response for better readability
      const formattedResponse = countries.map((country) => {
        return {
          name: country.name.common,
          officialName: country.name.official,
          capital: country.capital?.[0] || "N/A",
          region: country.region,
          population: country.population.toLocaleString(),
          languages: Object.values(country.languages || {}).join(", ") || "N/A",
          currencies:
            Object.values(country.currencies || {})
              .map((curr) => `${curr.name} (${curr.symbol})`)
              .join(", ") || "N/A",
          flag: country.flags.png,
        };
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(formattedResponse, null, 2),
          },
        ],
      };
    } catch (error) {
      console.error("Error fetching country details:", error);
      return {
        content: [
          {
            type: "text",
            text: `Failed to fetch country details. Error: ${error}`,
          },
        ],
      };
    }
  },
});

/**
 * Tool: Search for Pokémon information using the PokéAPI.
 */
const searchPokemon = tool({
  description: "Search for Pokémon details by name or ID using the PokéAPI",
  parameters: z.object({
    query: z.string().describe("The Pokémon name or ID to search for"),
  }),
  execute: async ({ query }) => {
    try {
      // Try to parse as ID first, then as name
      const isId = !isNaN(Number(query));
      const url = isId
        ? `https://pokeapi.co/api/v2/pokemon/${query}`
        : `https://pokeapi.co/api/v2/pokemon/${query.toLowerCase()}`;

      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 404) {
          return {
            content: [
              {
                type: "text",
                text: `No Pokémon found with the name or ID "${query}"`,
              },
            ],
          };
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const pokemon = (await response.json()) as PokemonResponse;

      // Format the response
      const formattedResponse = {
        name: pokemon.name,
        id: pokemon.id,
        height: pokemon.height,
        weight: pokemon.weight,
        types: pokemon.types.map((t) => t.type.name).join(", "),
        abilities: pokemon.abilities.map((a) => a.ability.name).join(", "),
        sprite: pokemon.sprites.front_default,
      };

      return {
        content: [
          {
            type: "text",
            text: `Pokémon: ${formattedResponse.name} (ID: ${formattedResponse.id})\nHeight: ${formattedResponse.height}\nWeight: ${formattedResponse.weight}\nTypes: ${formattedResponse.types}\nAbilities: ${formattedResponse.abilities}\nSprite: ${formattedResponse.sprite}`,
          },
        ],
      };
    } catch (error) {
      console.error("Error fetching Pokémon details:", error);
      return {
        content: [
          {
            type: "text",
            text: `Failed to fetch Pokémon details. Error: ${error}`,
          },
        ],
      };
    }
  },
});

/**
 * Tool: Call a Cloudflare Worker via the doWorker binding.
 */
const callDoWorker = tool({
  description: "Send a request to a Cloudflare Worker via the doWorker binding",
  parameters: z.object({
    workerName: z.string().describe("The name of the worker to call"),
    method: z.string().optional().default("GET").describe("HTTP method to use"),
    body: z
      .string()
      .optional()
      .describe("Request body (for POST/PUT requests)"),
    headers: z
      .record(z.string())
      .optional()
      .describe("Additional headers to send"),
  }),
  execute: async ({ workerName, method = "GET", body, headers = {} }) => {
    try {
      const agent = agentContext.getStore();
      if (!agent) {
        throw new Error("No agent found");
      }

      const requestInit: RequestInit = {
        method,
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
      };

      if (
        body &&
        (method === "POST" || method === "PUT" || method === "PATCH")
      ) {
        requestInit.body = body;
      }

      const response = await (agent as any).env.doWorker.fetch(
        `https://${workerName}.workers.dev`,
        requestInit
      );

      const responseText = await response.text();

      return {
        content: [
          {
            type: "text",
            text: `Worker response (${response.status}): ${responseText}`,
          },
        ],
      };
    } catch (error) {
      console.error("Error calling worker:", error);
      return {
        content: [
          {
            type: "text",
            text: `Failed to call worker. Error: ${error}`,
          },
        ],
      };
    }
  },
});

/**
 * Tool: Call the GraphQL worker to check total user agent.
 */
const callgraphqlWorker = tool({
  description:
    "Call the GraphQL worker to check for total user agent information",
  parameters: z.object({
    query: z.string().optional().describe("GraphQL query to execute"),
  }),
  execute: async ({ query }) => {
    try {
      const agent = agentContext.getStore();
      if (!agent) {
        throw new Error("No agent found");
      }

      // Default query to get total user agent if none provided
      const defaultQuery =
        query ||
        `
        query {
          totalUserAgent {
            count
            timestamp
          }
        }
      `;

      const response = await (agent as any).env.graphqlWorker.fetch(
        "https://graphql-worker.workers.dev/graphql",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: defaultQuery,
          }),
        }
      );

      const responseData = await response.json();

      return {
        content: [
          {
            type: "text",
            text: `GraphQL Worker response: ${JSON.stringify(responseData, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      console.error("Error calling GraphQL worker:", error);
      return {
        content: [
          {
            type: "text",
            text: `Failed to call GraphQL worker. Error: ${error}`,
          },
        ],
      };
    }
  },
});

/**
 * Tool: Add Cloudflare custom rules to a pre-configured ruleset.
 */
const addCloudflareCustomRule = tool({
  description: `
You are an AI agent for creating Cloudflare custom rules, interacting with the Cloudflare API to add rules to the pre-configured ruleset (Zone ID: ${process.env.CLOUDFLARE_ZONE_ID || "bcbaeaa288da7324b61d91b0e41adc90"}, Ruleset ID: ${process.env.CLOUDFLARE_RULESET_ID || "ab811bb77a694282bc7252073c972f83"}).

**Knowledge:** Cloudflare rules evaluate conditions against HTTP requests using fields, values, and operators, structured with parentheses.

**Values:** Strings (quoted/raw), booleans, arrays/maps (from fields), lists (named $list_name, inline {}).

**Operators:**
- Comparison: eq, ne, lt, gt, contains (case-sensitive string), wildcard (case-insensitive string, * matches zero or more), strict wildcard (case-sensitive string, * matches zero or more), matches (regular expression - Business/Enterprise), in (checks if the field's value is present in a set or list).
- Logical: not (!), and (&&), xor (^^), or (||). Precedence: not > and > xor > or. Use parentheses to override precedence.
- Grouping Symbols: use Parentheses () for all conditions and controlling the order in which logical operators are evaluated.
- **CRITICAL: Always wrap the entire rule expression in parentheses, e.g., (cf.waf.score < 20 and ip.src.country ne "JP").**

**Tool:** Use addCloudflareCustomRule (description, expression, action)

**Key Fields:**

* Bot Management: cf.bot_management.corporate_proxy, cf.bot_management.ja3_hash/ja4, cf.bot_management.score, cf.bot_management.static_resource, cf.bot_management.verified_bot, cf.client.bot, cf.verified_bot_category.
* Edge/Network: cf.edge.server_ip, cf.edge.server_port.
* LLM Detection: cf.llm.prompt.detected/pii_detected/pii_categories.
* WAF: cf.waf.score.
* HTTP Request: cf.ray_id, http.cookie, http.host, http.referer, http.request.accepted_languages, http.request.body.*, http.request.cookies, http.request.full_uri, http.request.headers.*, http.request.method, http.request.uri*, http.request.version, http.user_agent, http.x_forwarded_for.
* IP/Geo: ip.src, ip.src.asnum, ip.src.* (city, region, country, etc.), ip.src.lat/lon.

**Workflow:** Understand user intent, construct the rule expression (using the tool and manual combination), use the internal API tool to add the rule, and respond to the user.

**Example Interaction:**

User: "I want to block requests with the user agent 'BadBot/1.0'."

You:
  1. Construct Expression: http.user_agent eq "BadBot/1.0"
  2. Response: Successfully added a rule to block requests with the user agent 'BadBot/1.0'.

User: "create a custom rule to give manage challenge for all request with bot score less than 20 and request coming outside of india"

You:
  1. Construct Expression: cf.bot_management.score lt 20 and ip.src.country ne "IN"
  2. Response: Successfully added a rule to block requests with bot score less than 20 and from outside India.

`,
  parameters: z.object({
    rule: z.union([
      z.object({
        action: z.string(),
        description: z.string(),
        expression: z.string(),
      }),
      z.object({
        type: z.literal("object"),
        value: z.object({
          action: z.string(),
          description: z.string(),
          expression: z.string(),
        }),
      }),
      z.string(), // Accept stringified JSON as well
    ]),
  }),
  execute: async ({ rule }) => {
    console.log(
      "[addCloudflareCustomRule] Raw rule input:",
      rule,
      "Type:",
      typeof rule
    );
    // If rule is a string, try to parse it as JSON
    if (typeof rule === "string") {
      try {
        rule = JSON.parse(rule);
        console.log(
          "[addCloudflareCustomRule] Parsed rule object:",
          rule,
          "Type:",
          typeof rule
        );
      } catch (e) {
        // Attempt to fix common escaping issues (replace inner unescaped double quotes with escaped ones)
        //example :  { "expression": "http.user_agent eq "BadBot/1.0"" }
        try {
          if (typeof rule === "string") {
            // Replace: key: "value with unescaped quotes" => key: \"value with unescaped quotes\"
            // Only replace quotes inside values, not the outer quotes
            const fixed = rule.replace(
              /: (\")(.*?)(?<!\\)\1/g,
              (match: string) => {
                // Replace inner quotes with escaped quotes
                return match.replace(/"/g, '\\"');
              }
            );
            rule = JSON.parse(fixed);
          } else {
            return "Invalid rule format: could not parse string as JSON.";
          }
        } catch (e2) {
          return "Invalid rule format: could not parse string as JSON, even after attempting to fix escaping.";
        }
      }
    }
    // Unwrap if rule is wrapped in { type: "object", value: ... }
    if (
      rule &&
      typeof rule === "object" &&
      "type" in rule &&
      rule.type === "object" &&
      "value" in rule
    ) {
      rule = rule.value as {
        action: string;
        description: string;
        expression: string;
      };
    }
    // Ensure the expression is always wrapped in parentheses
    //for dashboard expression builder we need to wrap the expression in parentheses
    if (rule && typeof rule === "object" && "expression" in rule) {
      let expr = rule.expression.trim();
      if (!(expr.startsWith("(") && expr.endsWith(")"))) {
        rule.expression = `(${expr})`;
      }
    }
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;

    if (!apiToken) {
      return "CLOUDFLARE_API_TOKEN is not set in environment variables.";
    }
    const url = `https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/rulesets/${CLOUDFLARE_RULESET_ID}/rules`;
    const headers = new Headers({
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiToken}`,
    });
    const body = JSON.stringify(rule);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body,
        redirect: "follow",
      });
      const data: any = await response.json();
      if (!response.ok) {
        return `Error from Cloudflare API: ${data.errors ? JSON.stringify(data.errors) : response.statusText}`;
      }
      return data;
    } catch (error) {
      console.error("Error adding Cloudflare custom rule:", error);
      return `Error adding Cloudflare custom rule: ${error}`;
    }
  },
});

/**
 * Export all available tools.
 * These will be provided to the AI model to describe available capabilities.
 */
export const tools = {
  getWeatherInformation,
  getLocalTime,
  scheduleTask,
  sendWebhook,
  searchDocs,
  generateImage,
  searchCountry,
  searchPokemon,
  callDoWorker,
  callgraphqlWorker,
  addCloudflareCustomRule,
};

/**
 * Implementation of confirmation-required tools.
 * This object contains the actual logic for tools that need human approval.
 * Each function here corresponds to a tool above that doesn't have an execute function.
 */
export const executions = {
  // getWeatherInformation removed - now executes automatically
};

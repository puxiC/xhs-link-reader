import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createXhsMcpServer } from "./mcp.js";

const server = createXhsMcpServer();
const transport = new StdioServerTransport();
await server.connect(transport);

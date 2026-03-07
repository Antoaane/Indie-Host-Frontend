import { Server } from "@modelcontextprotocol/sdk/server/index.js"

const CLERK_API = "https://api.clerk.com/v1"

const server = new Server({
  name: "clerk",
  version: "1.0.0"
})

server.tool(
  "clerk_api",
  {
    method: "HTTP method",
    path: "API path like /users or /users/{id}",
    body: "optional request body"
  },
  async ({ method, path, body }) => {

    const res = await fetch(`${CLERK_API}${path}`, {
      method,
      headers: {
        "Authorization": `Bearer ${process.env.CLERK_SECRET_KEY}`,
        "Content-Type": "application/json"
      },
      body: body ? JSON.stringify(body) : undefined
    })

    const data = await res.json()

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(data, null, 2)
        }
      ]
    }
  }
)

server.start()
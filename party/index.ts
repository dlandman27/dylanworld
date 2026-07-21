import { routePartykitRequest, Server } from 'partyserver'
import type { Connection, WSMessage } from 'partyserver'

// Presence relay for a table, running as a Cloudflare Durable Object via
// partyserver (the successor to PartyKit's dead hosted platform). Holds no
// state: stamps each message with the sender's id and fans it out to everyone
// else. Disconnects are announced so clients can drop the peer immediately.

type Env = {
  Table: DurableObjectNamespace
}

export class Table extends Server<Env> {
  onMessage(sender: Connection, message: WSMessage): void {
    if (typeof message !== 'string') return
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(message) as Record<string, unknown>
    } catch {
      return // garbage in, nothing out
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return // non-object payloads ignored
    }
    parsed.id = sender.id
    this.broadcast(JSON.stringify(parsed), [sender.id])
  }

  onClose(conn: Connection): void {
    this.broadcast(JSON.stringify({ t: 'leave', id: conn.id }))
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return (
      (await routePartykitRequest(request, env as unknown as Record<string, unknown>)) ||
      new Response('Not Found', { status: 404 })
    )
  },
}

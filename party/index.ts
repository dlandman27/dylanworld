import { routePartykitRequest, Server } from 'partyserver'
import type { Connection, WSMessage } from 'partyserver'

// Presence relay for a table, running as a Cloudflare Durable Object via
// partyserver (the successor to PartyKit's dead hosted platform). Holds no
// state: stamps each message with the sender's id and fans it out to everyone
// else. Disconnects are announced so clients can drop the peer immediately.

type Env = {
  Table: DurableObjectNamespace
}

// abuse limits — sized around the real client (<=20 msg/s, ~120-byte payloads)
const MAX_CONNECTIONS = 32     // per table; broadcast fan-out is O(n²)
const MAX_MESSAGE_BYTES = 1024
const RATE_WINDOW_MS = 1000
const RATE_LIMIT = 30          // relayed messages per window per connection
const RATE_KILL = 120          // sustained flooding gets the boot

interface Bucket { count: number; windowStart: number }

export class Table extends Server<Env> {
  private buckets = new Map<string, Bucket>()

  onConnect(conn: Connection): void {
    let n = 0
    for (const _ of this.getConnections()) n++
    if (n > MAX_CONNECTIONS) {
      conn.close(1013, 'table full') // 1013 = try again later
    }
  }

  onMessage(sender: Connection, message: WSMessage): void {
    if (typeof message !== 'string' || message.length > MAX_MESSAGE_BYTES) return

    // per-connection rate limit (in-memory; resets on hibernation, which is fine)
    const now = Date.now()
    let bucket = this.buckets.get(sender.id)
    if (!bucket || now - bucket.windowStart >= RATE_WINDOW_MS) {
      bucket = { count: 0, windowStart: now }
      this.buckets.set(sender.id, bucket)
    }
    bucket.count++
    if (bucket.count > RATE_KILL) {
      sender.close(1008, 'rate limit') // 1008 = policy violation
      return
    }
    if (bucket.count > RATE_LIMIT) return // drop, don't relay

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
    this.buckets.delete(conn.id)
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

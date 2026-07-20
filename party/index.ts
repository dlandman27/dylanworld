import type * as Party from 'partykit/server'

// Presence relay for a table. Holds no state: stamps each message with the
// sender's id and fans it out to everyone else in the room. Disconnects are
// announced so clients can drop the peer immediately.
export default class Table implements Party.Server {
  constructor(readonly room: Party.Room) {}

  onMessage(message: string, sender: Party.Connection): void {
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(message) as Record<string, unknown>
    } catch {
      return // garbage in, nothing out
    }
    parsed.id = sender.id
    this.room.broadcast(JSON.stringify(parsed), [sender.id])
  }

  onClose(conn: Party.Connection): void {
    this.room.broadcast(JSON.stringify({ t: 'leave', id: conn.id }))
  }
}

Table satisfies Party.Worker

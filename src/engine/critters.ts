// Ambient creatures (flies) register here so tools like the flyswatter can find
// and hit them, without either side importing the other.

export interface Critter {
  pos(): { x: number; y: number; z: number }
  alive(): boolean
  swat(): void
}

const list: Critter[] = []
export function registerCritter(c: Critter): void { list.push(c) }
export function critters(): Critter[] { return list }

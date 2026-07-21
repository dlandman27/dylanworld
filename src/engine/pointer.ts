// The cursor's world position, published each frame by main.ts so ambient
// creatures (the fly, future critters) can react to where you are without
// capturing the pointer.

const p = { x: 0, y: 0 }
export function setPointer(x: number, y: number): void { p.x = x; p.y = y }
export function pointer(): { x: number; y: number } { return p }

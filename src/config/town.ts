import { world } from './world'

// The town square — the cozy heart of the map, centered just below spawn so the
// hero title sits above it like a welcome arch. Geometry is shared so the
// scenery scatter keeps foliage off the paving.
export const plaza = {
  cx: world.spawn.x,
  cy: world.spawn.y + 150,
  w: 1060,
  h: 620,
}

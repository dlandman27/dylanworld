// Dylan's released Apple apps, shown on the iPad on the table. Tapping an icon
// opens its App Store page in a new tab.
//
// To use real icons: drop each app's icon PNG in  public/apps/<file>.png  and
// set `icon` to `/apps/<file>.png`. Until an icon loads, a clean canvas
// placeholder (colored tile + initial) is drawn instead — so this always works.

export interface AppEntry {
  name: string
  url: string      // App Store listing
  icon?: string    // e.g. '/apps/myapp.png'
}

export const apps: AppEntry[] = [
  { name: '1List', url: 'https://apps.apple.com/us/app/1list-simple-todo-list/id6782178620', icon: '/apps/app1.png' },
  { name: 'Make It Loud', url: 'https://apps.apple.com/us/app/make-it-loud/id6787190848', icon: '/apps/app2.png' },
  { name: 'Wiigit', url: 'https://apps.apple.com/us/app/wiigit-guided-journal/id6738006366', icon: '/apps/app3.png' },
]

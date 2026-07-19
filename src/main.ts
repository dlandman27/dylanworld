const canvas = document.getElementById('game') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!
canvas.width = window.innerWidth
canvas.height = window.innerHeight
ctx.fillStyle = '#f5ecd6'
ctx.fillRect(0, 0, canvas.width, canvas.height)
console.log('dylanworld boot ok')

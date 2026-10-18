// activeASSET WebSocket Service — รันบน port 3003
// ใช้สำหรับ real-time notifications + activity feed
// Frontend: io("/?XTransformPort=3003")
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import { createServer as createHttpServer } from 'http'

const PORT = 3003
const httpServer = createHttpServer()
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
})

// เก็บ user → socketId mapping
const userSockets = new Map<string, Set<string>>()
// เก็บ tenant → Set<socketId> สำหรับ broadcast ระดับ tenant
const tenantSockets = new Map<string, Set<string>>()

io.on('connection', (socket) => {
  console.log(`[WS] Connected: ${socket.id}`)

  // Auth + register
  socket.on('auth', ({ userId, tenantId }: { userId: string; tenantId?: string }) => {
    if (userId) {
      if (!userSockets.has(userId)) userSockets.set(userId, new Set())
      userSockets.get(userId)!.add(socket.id)
      socket.join(`user:${userId}`)
      console.log(`[WS] User ${userId} registered (socket ${socket.id})`)
    }
    if (tenantId) {
      if (!tenantSockets.has(tenantId)) tenantSockets.set(tenantId, new Set())
      tenantSockets.get(tenantId)!.add(socket.id)
      socket.join(`tenant:${tenantId}`)
      console.log(`[WS] Tenant ${tenantId} joined (socket ${socket.id})`)
    }
  })

  // Send notification to specific user
  socket.on('notify:user', ({ userId, notification }: { userId: string; notification: unknown }) => {
    io.to(`user:${userId}`).emit('notification', notification)
    console.log(`[WS] Notification sent to user ${userId}`)
  })

  // Broadcast to tenant
  socket.on('broadcast:tenant', ({ tenantId, event, data }: { tenantId: string; event: string; data: unknown }) => {
    io.to(`tenant:${tenantId}`).emit(event, data)
    console.log(`[WS] Broadcast to tenant ${tenantId}: ${event}`)
  })

  // Activity feed
  socket.on('activity', ({ tenantId, activity }: { tenantId: string; activity: unknown }) => {
    io.to(`tenant:${tenantId}`).emit('activity', activity)
  })

  socket.on('disconnect', () => {
    console.log(`[WS] Disconnected: ${socket.id}`)
    // cleanup userSockets + tenantSockets
    for (const [userId, sockets] of userSockets.entries()) {
      sockets.delete(socket.id)
      if (sockets.size === 0) userSockets.delete(userId)
    }
    for (const [tenantId, sockets] of tenantSockets.entries()) {
      sockets.delete(socket.id)
      if (sockets.size === 0) tenantSockets.delete(tenantId)
    }
  })
})

// REST endpoint สำหรับ Next.js API ส่ง notification มา
import express from 'express'
const app = express()
app.use(cors())
app.use(express.json())

app.post('/notify-user', (req, res) => {
  const { userId, notification } = req.body
  if (!userId || !notification) {
    return res.status(400).json({ error: 'ต้องระบุ userId และ notification' })
  }
  io.to(`user:${userId}`).emit('notification', notification)
  res.json({ ok: true })
})

app.post('/broadcast-tenant', (req, res) => {
  const { tenantId, event, data } = req.body
  if (!tenantId || !event) {
    return res.status(400).json({ error: 'ต้องระบุ tenantId และ event' })
  }
  io.to(`tenant:${tenantId}`).emit(event, data)
  res.json({ ok: true })
})

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    connectedUsers: userSockets.size,
    connectedTenants: tenantSockets.size,
    totalSockets: io.engine.clientsCount,
  })
})

httpServer.listen(PORT, () => {
  console.log(`[WS] activeASSET WebSocket service running on port ${PORT}`)
})

// ตัวช่วยส่ง LINE notification
// ใช้ LINE Messaging API push message ถ้ามี env config
// ถ้าไม่มี → return share URL ให้ client ใช้ share เอง

interface LineResult {
  sent: boolean
  channel: 'messaging-api' | 'share'
  recipientCount?: number
  shareUrl?: string
  error?: string
}

export async function sendLineNotification(message: string): Promise<LineResult> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  const targetUser = process.env.LINE_TARGET_USER_ID
  const broadcastUsers = (process.env.LINE_BROADCAST_USER_IDS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
  const allRecipients = [...new Set([targetUser, ...broadcastUsers].filter(Boolean) as string[])]

  if (!token || allRecipients.length === 0) {
    return {
      sent: false,
      channel: 'share',
      shareUrl: `https://line.me/R/share?text=${encodeURIComponent(message)}`,
    }
  }

  let okCount = 0
  for (const recipient of allRecipients) {
    try {
      const res = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          to: recipient,
          messages: [{ type: 'text', text: message }],
        }),
      })
      if (res.ok) okCount++
    } catch (e) {
      // continue to next recipient
      console.error('LINE push error:', e)
    }
  }

  if (okCount > 0) {
    return { sent: true, channel: 'messaging-api', recipientCount: okCount }
  }
  return {
    sent: false,
    channel: 'share',
    error: 'LINE push failed for all recipients',
    shareUrl: `https://line.me/R/share?text=${encodeURIComponent(message)}`,
  }
}

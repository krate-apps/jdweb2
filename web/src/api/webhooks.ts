import { apiJson } from './http'

export type WebhookEvent = 'download.finished' | 'mover.succeeded' | 'mover.failed'

export interface Webhook {
  id: number
  url: string
  events: WebhookEvent[]
  enabled: boolean
  createdAt: number
  updatedAt: number
}

export async function listWebhooks(): Promise<Webhook[]> {
  const res = await apiJson<{ webhooks: Webhook[] }>('api/webhooks')
  return res.webhooks
}

export async function createWebhook(
  url: string,
  events: WebhookEvent[],
  enabled = true,
): Promise<Webhook> {
  const res = await apiJson<{ webhook: Webhook }>('api/webhooks', {
    method: 'POST',
    body: JSON.stringify({ url, events, enabled }),
  })
  return res.webhook
}

export async function updateWebhook(
  id: number,
  patch: { url?: string; events?: WebhookEvent[]; enabled?: boolean },
): Promise<Webhook> {
  const res = await apiJson<{ webhook: Webhook }>(`api/webhooks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
  return res.webhook
}

export async function deleteWebhook(id: number): Promise<void> {
  await apiJson(`api/webhooks/${id}`, { method: 'DELETE' })
}

export async function notifyWebhook(
  event: WebhookEvent,
  pkg: { uuid?: number; name: string; saveTo?: string },
  error?: string,
): Promise<void> {
  await apiJson('api/webhooks/notify', {
    method: 'POST',
    body: JSON.stringify({ event, package: pkg, error }),
  })
}

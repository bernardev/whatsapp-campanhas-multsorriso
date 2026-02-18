// scripts/configurar-webhook.ts
import axios, { AxiosError } from 'axios'

const EVOLUTION_URL = 'http://31.97.42.88:8082'
const API_KEY = 'apikey321'
const INSTANCE = 'teste-eduardo'
const WEBHOOK_URL = 'https://b399-2804-7f4-323a-dd4a-911d-30e2-df2d-d756.ngrok-free.app/api/webhooks/evolution'

interface WebhookConfig {
  enabled: boolean
  url: string
  webhookByEvents: boolean
  webhookBase64: boolean
  events: string[]
}

interface WebhookPayload {
  webhook: WebhookConfig
}

interface EvolutionSuccessResponse {
  message: string
  webhook: WebhookConfig
}

interface EvolutionErrorResponse {
  status: number
  error: string
  response: {
    message: string[][]
  }
}

async function configurarWebhook(): Promise<void> {
  try {
    const payload: WebhookPayload = {
      webhook: {
        enabled: true,
        url: WEBHOOK_URL,
        webhookByEvents: false,
        webhookBase64: false,
        events: [
          'MESSAGES_UPSERT',
          'MESSAGES_UPDATE',
          'CONNECTION_UPDATE'
        ]
      }
    }

    const response = await axios.post<EvolutionSuccessResponse>(
      `${EVOLUTION_URL}/webhook/set/${INSTANCE}`,
      payload,
      {
        headers: {
          'apikey': API_KEY,
          'Content-Type': 'application/json'
        }
      }
    )

    console.log('✅ Webhook configurado com sucesso!')
    console.log(response.data)
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<EvolutionErrorResponse>
      console.error('❌ Erro ao configurar webhook')
      console.error('Status:', axiosError.response?.status)
      console.error('Resposta:', JSON.stringify(axiosError.response?.data, null, 2))
    } else {
      console.error('❌ Erro desconhecido:', error)
    }
  }
}

configurarWebhook()
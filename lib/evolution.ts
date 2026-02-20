// lib/evolution.ts
import axios, { AxiosError } from 'axios'

const evolutionAPI = axios.create({
  baseURL: process.env.EVOLUTION_API_URL,
  headers: {
    'Content-Type': 'application/json',
    'apikey': process.env.EVOLUTION_API_KEY || '',
  },
})

interface EvolutionResponse {
  success: boolean
  data?: unknown
  error?: string
}

export async function sendTextMessage(
  instanceKey: string,
  phone: string,
  message: string
): Promise<EvolutionResponse> {
  console.log(`[Evolution] Usando instância: ${instanceKey}`)
  
  try {
    const response = await evolutionAPI.post(`/message/sendText/${instanceKey}`, {
      number: phone,
      text: message,
    })
    return { success: true, data: response.data }
  } catch (error) {
    const axiosError = error as AxiosError
    console.error('Evolution API Error:', axiosError.response?.data || axiosError.message)
    return { 
      success: false, 
      error: JSON.stringify(axiosError.response?.data) || axiosError.message 
    }
  }
}

export async function sendImageMessage(
  instanceKey: string,
  phone: string,
  imageUrl: string,
  caption?: string
): Promise<EvolutionResponse> {
  console.log(`[Evolution] Usando instância: ${instanceKey}`)
  
  try {
        const publicUrl = imageUrl.startsWith('http') 
      ? imageUrl 
      : `https://b399-2804-7f4-323a-dd4a-911d-30e2-df2d-d756.ngrok-free.app${imageUrl}`
    
    console.log(`[Evolution] Enviando imagem: ${publicUrl}`)

    const response = await evolutionAPI.post(`/message/sendMedia/${instanceKey}`, {
      number: phone,
      mediatype: 'image',
      media: publicUrl,
      caption: caption || '',
    })

    return { success: true, data: response.data }
  } catch (error) {
    const axiosError = error as AxiosError
    console.error('Evolution API Error (Image):', axiosError.response?.data || axiosError.message)
    return { 
      success: false, 
      error: JSON.stringify(axiosError.response?.data) || axiosError.message 
    }
  }
}

export async function checkInstanceStatus(instanceKey: string): Promise<EvolutionResponse> {
  try {
    const response = await evolutionAPI.get(`/instance/connectionState/${instanceKey}`)
    return { success: true, data: response.data }
  } catch (error) {
    const axiosError = error as AxiosError
    return { 
      success: false, 
      error: JSON.stringify(axiosError.response?.data) || axiosError.message 
    }
  }
}

export { evolutionAPI }
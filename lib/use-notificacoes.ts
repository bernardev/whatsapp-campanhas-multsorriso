// lib/use-notificacoes.ts
'use client'

import { useCallback, useEffect, useState } from 'react'

export interface Notificacao {
  id: string
  type: 'nova_resposta' | 'aguardando_10min' | 'aguardando_30min' | 'aguardando_1h'
  clientName: string
  remoteJid: string
  lastMessage: string
  waitingMinutes: number
  timestamp: Date
}

const INTERVALO_MS = 30_000

// Polling de notificacoes em um lugar so. As tres telas que mostram o sino
// (campanhas, monitoramento, usuarios) usavam cada uma seu proprio timer, e o
// relogio seguia correndo com a aba em segundo plano: eram 4 GB de Fast Origin
// Transfer em dois dias na Vercel. Aqui o tick e ignorado enquanto a aba esta
// escondida e a busca acontece na hora em que ela volta.
export function useNotificacoes(): {
  notificacoes: Notificacao[]
  loadNotificacoes: () => Promise<void>
} {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([])

  const loadNotificacoes = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch('/api/notificacoes')
      const data = await response.json()
      setNotificacoes(data.notificacoes || [])
    } catch (error) {
      console.error('Erro ao carregar notificacoes:', error)
    }
  }, [])

  useEffect(() => {
    void loadNotificacoes()

    const intervalo = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      void loadNotificacoes()
    }, INTERVALO_MS)

    const aoVoltar = (): void => {
      if (document.visibilityState === 'visible') void loadNotificacoes()
    }
    document.addEventListener('visibilitychange', aoVoltar)

    return () => {
      clearInterval(intervalo)
      document.removeEventListener('visibilitychange', aoVoltar)
    }
  }, [loadNotificacoes])

  return { notificacoes, loadNotificacoes }
}

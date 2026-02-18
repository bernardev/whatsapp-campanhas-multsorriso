// app/(dashboard)/contatos/importar/importar-contatos-client.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Image from 'next/image'
import { ArrowLeft, Upload, FileText, CheckCircle, AlertCircle, Download } from 'lucide-react'

interface ImportarContatosClientProps {
  user: {
    id: string
    name: string
    email: string
  }
}

interface ImportResult {
  imported: number
  skipped: number
  errors: string[]
}

export default function ImportarContatosClient({ user }: ImportarContatosClientProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<boolean>(false)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string[][]>([])
  const [result, setResult] = useState<ImportResult | null>(null)

  const handleLogout = async (): Promise<void> => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setResult(null)

    // Ler e fazer preview
    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      const lines = text.split('\n').filter(line => line.trim())
      
      // Detecta separador (vírgula ou ponto e vírgula)
      const separator = text.includes(';') ? ';' : ','
      
      const parsed = lines.map(line => line.split(separator).map(cell => cell.trim()))
      setPreview(parsed.slice(0, 6))
    }
    reader.readAsText(selectedFile)
  }

  const handleImport = async (): Promise<void> => {
    if (!file) return

    setLoading(true)
    setResult(null)

    try {
      const reader = new FileReader()
      reader.onload = async (event) => {
        const text = event.target?.result as string
        const lines = text.split('\n').filter(line => line.trim())
        
        // Parse CSV
        const separator = text.includes(';') ? ';' : ','

        const headers = lines[0].split(separator).map(h => h.trim().toLowerCase())
        const contacts = lines.slice(1).map(line => {
          const values = line.split(separator).map(v => v.trim())
          const contact: Record<string, string> = {}
          
          headers.forEach((header, index) => {
            if (values[index]) {
              contact[header] = values[index]
            }
          })
          
          return contact
        })

        // Envia para API
        const response = await fetch('/api/contatos/importar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contacts }),
        })

        const data = await response.json() as ImportResult

        if (!response.ok) {
          throw new Error('Erro ao importar contatos')
        }

        setResult(data)
        
        if (data.imported > 0) {
          setTimeout(() => {
            router.push('/contatos')
            router.refresh()
          }, 3000)
        }
      }
      
      reader.readAsText(file)
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Erro ao importar')
    } finally {
      setLoading(false)
    }
  }

  const downloadTemplate = (): void => {
    const csv = 'name,phone,company\nJoão Silva,41999999999,Empresa ABC\nMaria Santos,41988888888,Empresa XYZ'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'template-contatos.csv'
    a.click()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {/* Header */}
      <div className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Image
                src="/logo-multsorriso.png"
                alt="MultSorriso"
                width={140}
                height={56}
                className="object-contain cursor-pointer"
                onClick={() => router.push('/campanhas')}
              />
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-sm font-semibold text-[#1D2748]">{user.name}</span>
                <span className="text-xs text-slate-500">{user.email}</span>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                className="border-slate-200 hover:bg-slate-50 text-slate-700"
                onClick={handleLogout}
              >
                Sair
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.push('/contatos')}
            className="text-slate-600 hover:text-[#1D2748] mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar para Contatos
          </Button>
          
          <h1 className="text-3xl font-bold text-[#1D2748] mb-2">
            Importar Contatos CSV
          </h1>
          <p className="text-slate-600">
            Faça upload de um arquivo CSV com seus contatos
          </p>
        </div>

        {/* Instruções */}
        <Card className="border-0 shadow-xl mb-6">
          <CardHeader>
            <CardTitle className="text-[#1D2748]">Como preparar seu arquivo</CardTitle>
            <CardDescription>Siga estas instruções para importar com sucesso</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#BD8F29]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-[#BD8F29]">1</span>
                </div>
                <div>
                  <p className="font-medium text-[#1D2748]">Formato CSV</p>
                  <p className="text-sm text-slate-600">O arquivo deve estar em formato .csv separado por vírgulas</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#BD8F29]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-[#BD8F29]">2</span>
                </div>
                <div>
                  <p className="font-medium text-[#1D2748]">Colunas obrigatórias</p>
                  <p className="text-sm text-slate-600">
                    <code className="bg-slate-100 px-2 py-0.5 rounded text-xs">name</code>,{' '}
                    <code className="bg-slate-100 px-2 py-0.5 rounded text-xs">phone</code>,{' '}
                    <code className="bg-slate-100 px-2 py-0.5 rounded text-xs">company</code> (opcional)
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#BD8F29]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-[#BD8F29]">3</span>
                </div>
                <div>
                  <p className="font-medium text-[#1D2748]">Formato do telefone</p>
                  <p className="text-sm text-slate-600">Use apenas números: 41999999999 (DDD + número)</p>
                </div>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={downloadTemplate}
              className="w-full border-[#BD8F29] text-[#BD8F29] hover:bg-[#BD8F29]/10"
            >
              <Download className="w-4 h-4 mr-2" />
              Baixar Arquivo de Exemplo
            </Button>
          </CardContent>
        </Card>

        {/* Upload */}
        <Card className="border-0 shadow-xl mb-6">
          <CardHeader>
            <CardTitle className="text-[#1D2748]">Upload do Arquivo</CardTitle>
            <CardDescription>Selecione o arquivo CSV para importar</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-[#BD8F29] transition-colors">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                  id="csv-upload"
                />
                <label htmlFor="csv-upload" className="cursor-pointer">
                  <Upload className="w-12 h-12 text-[#BD8F29] mx-auto mb-4" />
                  <p className="text-[#1D2748] font-medium mb-1">
                    {file ? file.name : 'Clique para selecionar o arquivo'}
                  </p>
                  <p className="text-sm text-slate-500">
                    Arquivo CSV (máximo 10MB)
                  </p>
                </label>
              </div>

              {preview.length > 0 && (
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="w-4 h-4 text-[#BD8F29]" />
                    <span className="font-medium text-[#1D2748]">Preview dos dados</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-300">
                          {preview[0].map((header, i) => (
                            <th key={i} className="text-left p-2 font-semibold text-slate-700">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.slice(1).map((row, i) => (
                          <tr key={i} className="border-b border-slate-200">
                            {row.map((cell, j) => (
                              <td key={j} className="p-2 text-slate-600">
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    Mostrando as primeiras 5 linhas
                  </p>
                </div>
              )}

              <Button
                onClick={handleImport}
                disabled={!file || loading}
                className="w-full bg-gradient-to-r from-[#BD8F29] to-[#BD8F29]/90 text-white shadow-lg"
                size="lg"
              >
                <Upload className="w-5 h-5 mr-2" />
                {loading ? 'Importando...' : 'Importar Contatos'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Resultado */}
        {result && (
          <Card className="border-0 shadow-xl">
            <CardHeader>
              <CardTitle className="text-[#1D2748] flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                Importação Concluída
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                  <p className="text-sm text-emerald-700 mb-1">Importados</p>
                  <p className="text-3xl font-bold text-emerald-600">{result.imported}</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-sm text-amber-700 mb-1">Ignorados</p>
                  <p className="text-3xl font-bold text-amber-600">{result.skipped}</p>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-4 h-4 text-red-600" />
                    <span className="font-medium text-red-700">Erros encontrados:</span>
                  </div>
                  <ul className="text-sm text-red-600 space-y-1">
                    {result.errors.map((error, i) => (
                      <li key={i}>• {error}</li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="text-sm text-slate-600 text-center">
                Redirecionando para lista de contatos em 3 segundos...
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
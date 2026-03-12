// app/(dashboard)/contatos/importar/importar-contatos-client.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Image from 'next/image'
import { ArrowLeft, Upload, FileText, CheckCircle, AlertCircle, Download } from 'lucide-react'
import * as XLSX from 'xlsx'

interface ImportarContatosClientProps {
  user: {
    id: string
    name: string
    email: string
    role: 'ADMIN' | 'USER'
  }
}

interface ImportResult {
  imported: number
  skipped: number
  errors: string[]
}

interface ParsedContact {
  name: string
  phone: string
  company?: string
}

// Detecta se é o formato "ID Nome ; Telefone ;" e extrai nome + telefone
function parseSpecialFormat(cellValue: string): { name: string; phone: string } | null {
  // Formato: "16366 Daniel ; 5541998011258 ;" ou "16439 ; 5541995804511 ;"
  const parts = cellValue.split(';').map(p => p.trim()).filter(Boolean)
  if (parts.length < 2) return null

  const phonePart = parts[1]
  // Verifica se a segunda parte parece um telefone (apenas números, 10-14 dígitos)
  const phoneDigits = phonePart.replace(/\D/g, '')
  if (phoneDigits.length < 10 || phoneDigits.length > 14) return null

  // Primeira parte: "ID Nome" ou "ID"
  const firstPart = parts[0]
  // Remove o(s) ID(s) numérico(s) do início e extrair o nome
  // Padrão: número(s) de até 6 dígitos seguidos de espaço e nome
  const nameMatch = firstPart.replace(/\b\d{1,6}\b/g, '').trim()
  const name = nameMatch || ''

  return { name, phone: phoneDigits }
}

// Detecta se os dados estão no formato especial (ID Nome ; Telefone ;)
function isSpecialFormat(rows: string[][]): boolean {
  // Verifica as primeiras linhas (excluindo possível header)
  const samplesToCheck = rows.slice(0, Math.min(5, rows.length))
  let matchCount = 0

  for (const row of samplesToCheck) {
    if (row.length >= 1) {
      const cell = row[0]
      if (cell.includes(';') && parseSpecialFormat(cell) !== null) {
        matchCount++
      }
    }
  }

  // Se a maioria das amostras bate, é o formato especial
  return matchCount >= Math.min(3, samplesToCheck.length)
}

// Detecta se a primeira linha é um header CSV padrão
function isStandardCSVHeader(row: string[]): boolean {
  const headers = row.map(h => h.trim().toLowerCase())
  return headers.includes('phone') || headers.includes('telefone') || headers.includes('nome')
}

// Parseia dados do formato especial
function parseSpecialData(rows: string[][]): ParsedContact[] {
  const contacts: ParsedContact[] = []

  for (const row of rows) {
    // Pode ter dado em qualquer coluna, pega a primeira não-vazia
    for (const cell of row) {
      if (!cell || !cell.trim()) continue
      const parsed = parseSpecialFormat(cell)
      if (parsed) {
        contacts.push({
          name: parsed.name,
          phone: parsed.phone
        })
        break // Só usa a primeira célula válida de cada linha
      }
    }
  }

  return contacts
}

// Parseia dados do formato CSV padrão (com headers)
function parseStandardData(rows: string[][]): ParsedContact[] {
  if (rows.length < 2) return []

  const headers = rows[0].map(h => h.trim().toLowerCase())
  const contacts: ParsedContact[] = []

  for (const row of rows.slice(1)) {
    const contact: Record<string, string> = {}
    headers.forEach((header, index) => {
      if (row[index]) contact[header] = row[index].trim()
    })

    // Mapeia variações de nomes de coluna
    const name = contact['name'] || contact['nome'] || ''
    const phone = contact['phone'] || contact['telefone'] || contact['celular'] || ''
    const company = contact['company'] || contact['empresa'] || ''

    if (phone) {
      contacts.push({ name, phone, company: company || undefined })
    }
  }

  return contacts
}

// Lê arquivo XLSX e retorna array de arrays de strings
function readXLSX(data: ArrayBuffer): string[][] {
  const workbook = XLSX.read(data, { type: 'array' })
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
  const jsonData = XLSX.utils.sheet_to_json<string[]>(firstSheet, {
    header: 1,
    defval: '',
    raw: false
  })
  return jsonData.filter(row => row.some(cell => cell && cell.toString().trim()))
}

// Lê arquivo CSV e retorna array de arrays de strings
function readCSV(text: string): string[][] {
  const separator = text.includes(';') ? ';' : ','
  const lines = text.split('\n').filter(line => line.trim())
  return lines.map(line => line.split(separator).map(cell => cell.trim()))
}

export default function ImportarContatosClient({ user }: ImportarContatosClientProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<boolean>(false)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ParsedContact[]>([])
  const [totalContacts, setTotalContacts] = useState(0)
  const [detectedFormat, setDetectedFormat] = useState<string>('')
  const [result, setResult] = useState<ImportResult | null>(null)

  const handleLogout = async (): Promise<void> => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  const processFileData = (rows: string[][]) => {
    let contacts: ParsedContact[]

    if (isSpecialFormat(rows)) {
      contacts = parseSpecialData(rows)
      setDetectedFormat('Formato detectado: ID + Nome + Telefone (separado por ;)')
    } else if (isStandardCSVHeader(rows[0])) {
      contacts = parseStandardData(rows)
      setDetectedFormat('Formato detectado: CSV padrão (com cabeçalho)')
    } else {
      // Tenta o formato especial como fallback
      contacts = parseSpecialData(rows)
      if (contacts.length > 0) {
        setDetectedFormat('Formato detectado: ID + Nome + Telefone')
      } else {
        setDetectedFormat('Formato não reconhecido')
      }
    }

    setTotalContacts(contacts.length)
    setPreview(contacts.slice(0, 8))
    return contacts
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setResult(null)
    setPreview([])
    setDetectedFormat('')

    const isXLSX = selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls')

    if (isXLSX) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const data = event.target?.result as ArrayBuffer
        const rows = readXLSX(data)
        processFileData(rows)
      }
      reader.readAsArrayBuffer(selectedFile)
    } else {
      const reader = new FileReader()
      reader.onload = (event) => {
        const text = event.target?.result as string
        const rows = readCSV(text)
        processFileData(rows)
      }
      reader.readAsText(selectedFile)
    }
  }

  const handleImport = async (): Promise<void> => {
    if (!file) return

    setLoading(true)
    setResult(null)

    try {
      const isXLSX = file.name.endsWith('.xlsx') || file.name.endsWith('.xls')

      const readFile = (): Promise<string[][]> => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onerror = reject

          if (isXLSX) {
            reader.onload = (event) => {
              const data = event.target?.result as ArrayBuffer
              resolve(readXLSX(data))
            }
            reader.readAsArrayBuffer(file)
          } else {
            reader.onload = (event) => {
              const text = event.target?.result as string
              resolve(readCSV(text))
            }
            reader.readAsText(file)
          }
        })
      }

      const rows = await readFile()
      let contacts: ParsedContact[]

      if (isSpecialFormat(rows)) {
        contacts = parseSpecialData(rows)
      } else if (isStandardCSVHeader(rows[0])) {
        contacts = parseStandardData(rows)
      } else {
        contacts = parseSpecialData(rows)
      }

      if (contacts.length === 0) {
        alert('Nenhum contato encontrado no arquivo. Verifique o formato.')
        setLoading(false)
        return
      }

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
            Importar Contatos
          </h1>
          <p className="text-slate-600">
            Faça upload de um arquivo .xlsx ou .csv com seus contatos
          </p>
        </div>

        {/* Instruções */}
        <Card className="border-0 shadow-xl mb-6">
          <CardHeader>
            <CardTitle className="text-[#1D2748]">Formatos aceitos</CardTitle>
            <CardDescription>O sistema detecta automaticamente o formato do arquivo</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#BD8F29]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-[#BD8F29]">1</span>
                </div>
                <div>
                  <p className="font-medium text-[#1D2748]">CSV padrão</p>
                  <p className="text-sm text-slate-600">
                    Colunas: <code className="bg-slate-100 px-2 py-0.5 rounded text-xs">name</code>,{' '}
                    <code className="bg-slate-100 px-2 py-0.5 rounded text-xs">phone</code>,{' '}
                    <code className="bg-slate-100 px-2 py-0.5 rounded text-xs">company</code> (opcional)
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#BD8F29]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-[#BD8F29]">2</span>
                </div>
                <div>
                  <p className="font-medium text-[#1D2748]">Planilha com ID + Nome + Telefone</p>
                  <p className="text-sm text-slate-600">
                    Formato: <code className="bg-slate-100 px-2 py-0.5 rounded text-xs">16366 Daniel ; 5541998011258 ;</code>
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#BD8F29]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-[#BD8F29]">3</span>
                </div>
                <div>
                  <p className="font-medium text-[#1D2748]">Arquivos suportados</p>
                  <p className="text-sm text-slate-600">.xlsx (Excel) e .csv</p>
                </div>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={downloadTemplate}
              className="w-full border-[#BD8F29] text-[#BD8F29] hover:bg-[#BD8F29]/10"
            >
              <Download className="w-4 h-4 mr-2" />
              Baixar Modelo CSV
            </Button>
          </CardContent>
        </Card>

        {/* Upload */}
        <Card className="border-0 shadow-xl mb-6">
          <CardHeader>
            <CardTitle className="text-[#1D2748]">Upload do Arquivo</CardTitle>
            <CardDescription>Selecione o arquivo para importar</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-[#BD8F29] transition-colors">
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Upload className="w-12 h-12 text-[#BD8F29] mx-auto mb-4" />
                  <p className="text-[#1D2748] font-medium mb-1">
                    {file ? file.name : 'Clique para selecionar o arquivo'}
                  </p>
                  <p className="text-sm text-slate-500">
                    .xlsx ou .csv (máximo 10MB)
                  </p>
                </label>
              </div>

              {/* Formato detectado */}
              {detectedFormat && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  <span className="text-sm text-blue-700">{detectedFormat} — {totalContacts} contato(s) encontrado(s)</span>
                </div>
              )}

              {/* Preview dos contatos parseados */}
              {preview.length > 0 && (
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="w-4 h-4 text-[#BD8F29]" />
                    <span className="font-medium text-[#1D2748]">Preview dos contatos</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-300">
                          <th className="text-left p-2 font-semibold text-slate-700">Nome</th>
                          <th className="text-left p-2 font-semibold text-slate-700">Telefone</th>
                          {preview.some(c => c.company) && (
                            <th className="text-left p-2 font-semibold text-slate-700">Empresa</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.map((contact, i) => (
                          <tr key={i} className="border-b border-slate-200">
                            <td className="p-2 text-slate-600">{contact.name || <span className="text-slate-400 italic">sem nome</span>}</td>
                            <td className="p-2 text-slate-600 font-mono text-xs">{contact.phone}</td>
                            {preview.some(c => c.company) && (
                              <td className="p-2 text-slate-600">{contact.company || '-'}</td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    Mostrando {preview.length} de {totalContacts} contatos
                  </p>
                </div>
              )}

              <Button
                onClick={handleImport}
                disabled={!file || loading || totalContacts === 0}
                className="w-full bg-gradient-to-r from-[#BD8F29] to-[#BD8F29]/90 text-white shadow-lg"
                size="lg"
              >
                <Upload className="w-5 h-5 mr-2" />
                {loading ? 'Importando...' : `Importar ${totalContacts} Contato(s)`}
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
                  <ul className="text-sm text-red-600 space-y-1 max-h-40 overflow-y-auto">
                    {result.errors.slice(0, 20).map((error, i) => (
                      <li key={i}>• {error}</li>
                    ))}
                    {result.errors.length > 20 && (
                      <li className="text-slate-500">... e mais {result.errors.length - 20} erros</li>
                    )}
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

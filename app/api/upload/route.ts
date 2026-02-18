// app/api/upload/route.ts
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { cloudinary } from '@/lib/cloudinary'

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('image') as File
    
    if (!file) {
      return NextResponse.json({ error: 'Nenhuma imagem enviada' }, { status: 400 })
    }

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if (!validTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: 'Tipo de arquivo inválido. Use JPG, PNG, GIF ou WebP' 
      }, { status: 400 })
    }

    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json({ 
        error: 'Arquivo muito grande. Máximo 5MB' 
      }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder: 'whatsapp-campanhas',
          resource_type: 'auto'
        },
        (error, result) => {
          if (error) reject(error)
          else resolve(result as { secure_url: string })
        }
      ).end(buffer)
    })

    const imageUrl = result.secure_url

    console.log('[Upload] Imagem salva no Cloudinary:', imageUrl)

    return NextResponse.json({ 
      success: true,
      imageUrl 
    })
  } catch (error) {
    console.error('[Upload] Erro:', error)
    return NextResponse.json(
      { error: 'Erro ao fazer upload da imagem' },
      { status: 500 }
    )
  }
}
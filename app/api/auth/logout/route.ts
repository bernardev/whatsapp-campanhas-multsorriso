// app/api/auth/logout/route.ts
import { NextResponse } from 'next/server'
import { AUTH_COOKIE } from '@/lib/auth-secret'

export async function POST() {
  const response = NextResponse.json({ success: true })
  
  // Remove cookie
  response.cookies.delete(AUTH_COOKIE)
  
  return response
}
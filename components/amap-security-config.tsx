// components/amap-security-config.tsx
'use client'

import { useEffect } from 'react'

/**
 * Global AMap Security Config - MUST run before AMapLoader.load()
 * Injects securityJsCode into document head to fix INVALID_USER_DOMAIN error.
 */
export function AMapSecurityConfig() {
  useEffect(() => {
    const securityCode = process.env.NEXT_PUBLIC_AMAP_SECURITY_CODE

    if (!securityCode || securityCode === 'your_security_code_here') {
      console.warn('[AMap] 安全密钥未配置: 请在 .env.local 中设置 NEXT_PUBLIC_AMAP_SECURITY_CODE')
      return
    }

    ;(window as any)._AMapSecurityConfig = {
      securityJsCode: securityCode,
    }

    console.log('[AMap] 安全配置已注入全局')
  }, [])

  return null
}

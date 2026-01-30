'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export const ConfirmOrder: React.FC = () => {
  const router = useRouter()

  useEffect(() => {
    // With Cash on Delivery, orders are confirmed immediately in the checkout page
    // This page is no longer used, redirect to home
    router.push('/')
  }, [router])

  return (
    <div className="text-center w-full flex flex-col items-center justify-start gap-4">
      <h1 className="text-2xl">Redirecting...</h1>
    </div>
  )
}

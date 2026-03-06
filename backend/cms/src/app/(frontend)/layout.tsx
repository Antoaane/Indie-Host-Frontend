import React from 'react'
import './styles.css'

export const metadata = {
  description: 'IndieHost CMS frontend (blank Payload + Next.js app).',
  title: 'IndieHost CMS',
}

export default async function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props

  return (
    
      {children}
    
  )
}


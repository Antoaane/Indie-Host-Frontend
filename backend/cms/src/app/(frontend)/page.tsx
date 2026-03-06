import { headers as getHeaders } from 'next/headers.js'
import Link from 'next/link'
import { getPayload } from 'payload'
import React from 'react'
import { fileURLToPath } from 'url'

import config from '@/payload.config'
import './styles.css'

export default async function HomePage() {
  const headers = await getHeaders()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const { user } = await payload.auth({ headers })

  const fileURL = `vscode://file/${fileURLToPath(import.meta.url)}`

  return (
    
      <main className="home">
        <div className="content">
          <h1>{!user ? 'Bienvenue sur votre nouveau CMS Payload.' : `Bon retour, ${user.email}`}</h1>
          <p>
            Mettez à jour cette page en éditant <code>src/app/(frontend)/page.tsx</code>.
          </p>
          <div className="links">
            <Link href="/admin" className="admin">
              Aller au panel admin
            </Link>
            <a
              href="https://payloadcms.com/docs"
              target="_blank"
              rel="noreferrer"
              className="docs"
            >
              Documentation Payload
            </a>
          </div>
        </div>
        <footer className="footer">
          <p>
            Ouvrir ce fichier dans VS Code :{' '}
            <a href={fileURL} className="codeLink">
              src/app/(frontend)/page.tsx
            </a>
          </p>
        </footer>
      </main>
    
  )
}


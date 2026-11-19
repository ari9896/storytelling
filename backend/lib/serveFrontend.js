import express from 'express'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const frontendDirectory = fileURLToPath(new URL('../../frontend/dist/', import.meta.url))

export const serveFrontend = app => {
  if (!existsSync(path.join(frontendDirectory, 'index.html'))) {
    throw new Error('Frontend build missing. Run npm run build from the project root before starting production.')
  }
  app.use(express.static(frontendDirectory))
  // React Router handles browser URLs, including refreshing a story or editor page.
  // Unknown asset requests remain 404s rather than receiving HTML.
  app.get('/{*page}', (req, res, next) => {
    if (path.extname(req.path) || !req.accepts('html')) return next()
    res.set('Cache-Control', 'no-cache')
    return res.sendFile(path.join(frontendDirectory, 'index.html'))
  })
}

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // In Docker, use the service name 'api'
  // In local dev, use localhost
  const isDocker = mode === 'docker' || process.env.DOCKER === 'true'
  const apiTarget = isDocker ? 'http://api:3001' : 'http://localhost:3001'
  
  console.log(`API target: ${apiTarget} (${isDocker ? 'Docker mode' : 'Development mode'})`)

  return {
    plugins: [react()],
    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path
        }
      }
    }
  }
})

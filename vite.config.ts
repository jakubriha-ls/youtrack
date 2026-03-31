import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = env.VITE_YOUTRACK_PROXY_TARGET || 'https://youtrack.livesport.eu'

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api/youtrack': {
          target: proxyTarget,
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/api\/youtrack/, '/api'),
        },
      },
    },
  }
})
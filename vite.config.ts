import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react()],
  envPrefix: ['VITE_', 'SUPABASE_'],
  server: {
    port: 5173,
    host: true,
  },
})


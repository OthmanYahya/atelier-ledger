import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { redact } from '@tanstack/redact/vite'

export default defineConfig({
  base: './',
  plugins: [redact(), tailwindcss()],
})

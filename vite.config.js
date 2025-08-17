import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // ⚠️ Set this to your repo name, including the leading and trailing slashes.
  // If you’ll name the repo "kanban-todo", keep it as below.
  base: '/kanban-todo/',
})
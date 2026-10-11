import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import './index.css'
import App from './App'

type MockModule = { installMocks: () => void | Promise<void> }

async function start() {
  // `npm run dev:mock` sets VITE_USE_MOCKS=true. The glob resolves to nothing until src/mocks/install.ts exists,
  // so this file builds before and after the mock API is added.
  if (import.meta.env.VITE_USE_MOCKS === 'true') {
    const loaders = import.meta.glob('./mocks/install.ts') as Record<string, () => Promise<MockModule>>
    const load = loaders['./mocks/install.ts']
    if (load) await (await load()).installMocks()
    else console.warn('VITE_USE_MOCKS=true but src/mocks/install.ts was not found; using the real API.')
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void start()

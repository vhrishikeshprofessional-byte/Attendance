import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'

/** Shown for any unknown URL inside the signed-in layout. */
export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-20 text-center">
      <Compass className="h-10 w-10 text-gray-400" aria-hidden />
      <h1>Page not found</h1>
      <p className="max-w-sm text-sm text-gray-600">The page you opened does not exist or has moved.</p>
      <Link to="/dashboard" className="mt-2 inline-flex h-9 items-center justify-center rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700">
        Go to dashboard
      </Link>
    </div>
  )
}

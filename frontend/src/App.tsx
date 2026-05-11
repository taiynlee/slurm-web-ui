import { Outlet } from '@tanstack/react-router'
import ErrorBoundary from './components/ErrorBoundary'

export function Root() {
  return (
    <ErrorBoundary>
      <Outlet />
    </ErrorBoundary>
  )
}

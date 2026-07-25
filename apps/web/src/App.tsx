import { RouterProvider } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider }  from '@/context/AuthContext'
import { PortalAuthProvider } from '@/context/PortalAuthContext'
import { ThemeProvider } from '@/context/ThemeContext'
import { queryClient }   from '@/lib/queryClient'
import { router }        from '@/router'

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <PortalAuthProvider>
            <RouterProvider router={router} />
          </PortalAuthProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

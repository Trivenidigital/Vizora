import { ThemeProvider } from "@/contexts/theme-provider";
import { AuthProvider } from "@/contexts/AuthContext"; // AuthProvider now in main.tsx
import { Routes, Route } from 'react-router-dom'; // Import routing components

// Pages
import LandingPage from "@/pages/LandingPage"; 
import LoginPage from "@/pages/LoginPage"; 
import SignUpPage from "@/pages/SignUpPage";
import { DashboardPage } from "@/pages/DashboardPage"; // Import DashboardPage

// Layout & Protection
import { AppLayout } from "@/layouts/AppLayout"; 
import ProtectedRoute from "@/components/shared/ProtectedRoute"; 

function App() {

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme"> 
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignUpPage />} />

        {/* Protected Routes - Requires Authentication */}
        <Route element={<ProtectedRoute />}>
          {/* Routes within AppLayout */}
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            {/* Add other authenticated routes here (e.g., /devices, /content) */}
            {/* Example: <Route path="/devices" element={<DevicesPage />} /> */} 
          </Route>
        </Route>

        {/* Optional: Catch-all route for 404 */}
        <Route path="*" element={<div>404 - Page Not Found</div>} /> 
        {/* Or redirect unknown paths to landing/login */} 
        {/* <Route path="*" element={<Navigate to="/" replace />} /> */}

      </Routes>
    </ThemeProvider>
  );
}

export default App;

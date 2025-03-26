import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Displays from './pages/Displays';
import ContentLibrary from './pages/ContentLibrary';
import Playlists from './pages/Playlists';
import Schedule from './pages/Schedule';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import Landing from './pages/Landing';
import NotFound from './pages/NotFound';
import ProtectedRoute from './components/ProtectedRoute';
import { useEffect } from 'react';
import { AuthProvider } from './contexts/AuthContext';

function App() {
  // Set document title
  useEffect(() => {
    document.title = 'Vizora - Digital Signage Platform';
  }, []);

  return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-50">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          {/* Protected routes */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Layout>
                <Dashboard />
              </Layout>
            </ProtectedRoute>
          } />
          
          <Route path="/displays" element={
            <ProtectedRoute>
              <Layout>
                <Displays />
              </Layout>
            </ProtectedRoute>
          } />
          
          {/* Add the displays/add route */}
          <Route path="/displays/add" element={
            <ProtectedRoute>
              <Layout>
                <Displays initialAddModalOpen={true} />
              </Layout>
            </ProtectedRoute>
          } />
          
          <Route path="/content" element={
            <ProtectedRoute>
              <Layout>
                <ContentLibrary />
              </Layout>
            </ProtectedRoute>
          } />
          
          {/* Add the content/upload route */}
          <Route path="/content/upload" element={
            <ProtectedRoute>
              <Layout>
                <ContentLibrary upload={true} />
              </Layout>
            </ProtectedRoute>
          } />
          
          <Route path="/playlists" element={
            <ProtectedRoute>
              <Layout>
                <Playlists />
              </Layout>
            </ProtectedRoute>
          } />
          
          <Route path="/schedule" element={
            <ProtectedRoute>
              <Layout>
                <Schedule />
              </Layout>
            </ProtectedRoute>
          } />
          
          <Route path="/analytics" element={
            <ProtectedRoute>
              <Layout>
                <Analytics />
              </Layout>
            </ProtectedRoute>
          } />
          
          <Route path="/settings" element={
            <ProtectedRoute>
              <Layout>
                <Settings />
              </Layout>
            </ProtectedRoute>
          } />
          
          {/* Catch all route for 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </AuthProvider>
  );
}

export default App;

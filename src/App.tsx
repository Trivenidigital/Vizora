import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
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

function App() {
  // Mock authentication state - in a real app, this would come from a context or state management
  const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        {/* Protected routes */}
        <Route path="/dashboard" element={
          <Layout>
            <Dashboard />
          </Layout>
        } />
        
        <Route path="/displays" element={
          <Layout>
            <Displays />
          </Layout>
        } />
        
        <Route path="/content" element={
          <Layout>
            <ContentLibrary />
          </Layout>
        } />
        
        <Route path="/playlists" element={
          <Layout>
            <Playlists />
          </Layout>
        } />
        
        <Route path="/schedule" element={
          <Layout>
            <Schedule />
          </Layout>
        } />
        
        <Route path="/analytics" element={
          <Layout>
            <Analytics />
          </Layout>
        } />
        
        <Route path="/settings" element={
          <Layout>
            <Settings />
          </Layout>
        } />
        
        {/* Catch all route for 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}

export default App;

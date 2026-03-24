import { Routes, Route, Navigate } from 'react-router-dom';
import { PrivateRoute } from './components/PrivateRoute';
import { LoginPage } from './pages/LoginPage';
import { HomePage } from './pages/HomePage';
import { SpacePage } from './pages/SpacePage';
import { SearchPage } from './pages/SearchPage';
import { ForbiddenPage } from './pages/ForbiddenPage';
import { AdminUsersPage } from './pages/AdminUsersPage';
import { AdminSpacesPage } from './pages/AdminSpacesPage';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <HomePage />
          </PrivateRoute>
        }
      />
      <Route
        path="/space/:spaceId"
        element={
          <PrivateRoute>
            <SpacePage />
          </PrivateRoute>
        }
      />
      <Route
        path="/space/:spaceId/page/:pageId"
        element={
          <PrivateRoute>
            <SpacePage />
          </PrivateRoute>
        }
      />
      <Route
        path="/search"
        element={
          <PrivateRoute>
            <SearchPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <PrivateRoute requiredRole="system_admin">
            <AdminUsersPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/admin/spaces"
        element={
          <PrivateRoute requiredRole="system_admin">
            <AdminSpacesPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/403"
        element={
          <PrivateRoute>
            <ForbiddenPage />
          </PrivateRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;

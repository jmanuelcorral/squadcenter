import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { NotificationProvider } from './hooks/useNotifications';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import ProjectView from './pages/ProjectView';
import SessionView from './pages/SessionView';

export default function App() {
  return (
    <BrowserRouter>
      <NotificationProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/project/:id" element={<ProjectView />} />
            <Route path="/sessions/:id" element={<SessionView />} />
          </Route>
        </Routes>
      </NotificationProvider>
    </BrowserRouter>
  );
}

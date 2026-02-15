import { Outlet, useLocation } from 'react-router-dom';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';

export default function MainLayout() {
  const location = useLocation();
  const hideSidebar = ['/settings', '/home'].includes(location.pathname) || location.pathname.startsWith('/admin');

  return (
    <div className="h-screen flex flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        {!hideSidebar && <Sidebar />}
        <main className="flex-1 overflow-y-auto p-6 bg-cad-bg">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

import { Outlet } from 'react-router-dom';
import Logo from '../components/ui/Logo';

const AuthLayout = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center">
      <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-lg">
        <div className="flex flex-col items-center mb-6">
          <Logo className="h-12 w-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900">
            Vizora Dashboard
          </h2>
        </div>

        <div>
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default AuthLayout; 
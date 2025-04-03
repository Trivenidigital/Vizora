import { Outlet } from 'react-router-dom';
import Logo from '../components/ui/Logo';

const AuthLayout = () => {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <div className="flex flex-1 flex-col justify-center py-12 px-4 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          <div>
            <Logo className="h-12 w-auto" />
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
              Vizora Dashboard
            </h2>
          </div>

          <div className="mt-8">
            <Outlet />
          </div>
        </div>
      </div>
      
      <div className="hidden lg:block relative w-0 flex-1">
        <img
          className="absolute inset-0 h-full w-full object-cover"
          src="/images/auth-splash.jpg"
          alt="Vizora Digital Signage"
        />
      </div>
    </div>
  );
};

export default AuthLayout; 
import { useAuth } from '../../context/AuthContext';
import { ShieldExclamationIcon } from '@heroicons/react/24/outline';

const AdminOnly = ({ children, fallback }) => {
  const { user } = useAuth();

  if (user?.role !== 'admin') {
    return fallback || (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center">
          <ShieldExclamationIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Admin Access Required</h3>
          <p className="text-gray-500">
            This feature is only available to administrators.
          </p>
        </div>
      </div>
    );
  }

  return children;
};

export default AdminOnly; 
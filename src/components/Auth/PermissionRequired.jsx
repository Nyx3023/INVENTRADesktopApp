import { Navigate } from 'react-router-dom';
import { usePermissions } from '../../context/AuthContext';

const PermissionRequired = ({ permission, children }) => {
    const { hasPermission } = usePermissions();

    if (!hasPermission(permission)) {
        return <Navigate to="/" replace />;
    }

    return children;
};

export default PermissionRequired;

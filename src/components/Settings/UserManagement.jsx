import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { userService } from '../../services/api';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  EyeSlashIcon
} from '@heroicons/react/24/outline';
import AdminOnly from './AdminOnly';
import ModalPortal from '../common/ModalPortal';

const UserManagement = () => {
  const { colors } = useTheme();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: '',
    permissions: []
  });
  const [userToDelete, setUserToDelete] = useState(null);

  const permissionCategories = [
    {
      group: 'Inventory',
      perms: [
        { id: 'view_inventory', label: 'View Inventory' },
        { id: 'add_product', label: 'Add Product' },
        { id: 'edit_product', label: 'Edit Product' },
        { id: 'delete_product', label: 'Delete Product' }
      ]
    },
    {
      group: 'POS',
      perms: [
        { id: 'process_sales', label: 'Process Sales' },
        { id: 'apply_discount', label: 'Apply Discount' },
        { id: 'void_item', label: 'Void Item' }
      ]
    },
    {
      group: 'Sales History',
      perms: [
        { id: 'view_sales_history', label: 'View Sales History' },
        { id: 'view_receipts', label: 'View Receipts' },
        { id: 'void_transaction', label: 'Void Transaction' }
      ]
    },
    {
      group: 'Reports',
      perms: [
        { id: 'view_statistical_reports', label: 'View Statistical Reports' }
      ]
    },
    {
      group: 'Stock Management',
      perms: [
        { id: 'adjust_stock', label: 'Adjust Stock' },
        { id: 'perform_audits', label: 'Perform Audits' }
      ]
    },
    {
      group: 'Suppliers & POs',
      perms: [
        { id: 'manage_suppliers', label: 'Manage Suppliers' }
      ]
    }
  ];

  // Default permissions pre-selected per role
  const defaultPermissions = {
    admin: [
      'view_inventory', 'add_product', 'edit_product', 'delete_product',
      'process_sales', 'apply_discount', 'void_item',
      'view_sales_history', 'view_receipts', 'void_transaction',
      'view_statistical_reports',
      'adjust_stock', 'perform_audits',
      'manage_suppliers'
    ],
    employee: [
      'view_inventory', 'add_product', 'edit_product',
      'process_sales', 'apply_discount',
      'view_sales_history', 'view_receipts',
      'adjust_stock', 'perform_audits',
      'manage_suppliers'
    ]
  };

  const handlePermissionToggle = (permId) => {
    setFormData(prev => {
      const perms = prev.permissions || [];
      if (perms.includes(permId)) {
        return { ...prev, permissions: perms.filter(p => p !== permId) };
      } else {
        return { ...prev, permissions: [...perms, permId] };
      }
    });
  };
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await userService.list();
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Error fetching users');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    console.log(`Input changed: ${name} = ${value}`);
    // When role changes, auto-apply the default permission preset
    if (name === 'role' && defaultPermissions[value]) {
      setFormData(prev => ({
        ...prev,
        [name]: value,
        permissions: [...defaultPermissions[value]]
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Debug logging
    console.log('Form data before submission:', formData);

    // Prevent self role change on final submit too (safety guard)
    const isSelf = editingUser && currentUser && editingUser.id === currentUser.id;

    // Validate role selection
    if (!formData.role) {
      toast.error('Please select a role');
      return;
    }

    try {
      const submitData = { ...formData };
      // If editing yourself, strip the role field so backend doesn't change it
      if (isSelf) {
        delete submitData.role;
      }
      if (editingUser && !submitData.password) {
        delete submitData.password;
      }

      console.log('Submitting data:', submitData);

      if (editingUser) {
        await userService.update(editingUser.id, submitData);
      } else {
        await userService.create(submitData);
      }

      toast.success(editingUser ? 'User updated successfully' : 'User created successfully');
      setShowModal(false);
      setEditingUser(null);
      setFormData({ name: '', email: '', password: '', role: '', permissions: [] });
      fetchUsers();
    } catch (error) {
      console.error('Error saving user:', error);
      toast.error('Error saving user');
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      permissions: user.permissions || []
    });
    setShowModal(true);
  };

  const handleDelete = (userId) => {
    // Prevent deleting yourself
    if (currentUser && userId === currentUser.id) {
      toast.error('You cannot delete your own account');
      return;
    }
    const targetUser = users.find(u => u.id === userId);
    setUserToDelete(targetUser);
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;
    try {
      await userService.remove(userToDelete.id);
      toast.success('User deleted successfully');
      setUserToDelete(null);
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error(error.message || 'Error deleting user');
    }
  };

  const openCreateModal = () => {
    setEditingUser(null);
    setFormData({ name: '', email: '', password: '', role: '', permissions: [] });
    setShowModal(true);
  };

  if (loading) {
    return (
      <AdminOnly>
        <div className="flex justify-center items-center h-64">
          <div className={`text-lg ${colors.text.primary}`}>Loading users...</div>
        </div>
      </AdminOnly>
    );
  }

  return (
    <AdminOnly>
      <div className={`${colors.card.primary} rounded-lg shadow border ${colors.border.primary} p-6`}>
        <div className="flex justify-between items-center mb-6">
          <h2 className={`text-lg font-semibold ${colors.text.primary}`}>User Management</h2>
          <button
            onClick={openCreateModal}
            className="bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600 text-white px-4 py-2 rounded-md flex items-center space-x-2 transition-colors"
          >
            <PlusIcon className="h-5 w-5" />
            <span>Add User</span>
          </button>
        </div>

        {/* Users Table */}
        <div className="overflow-x-auto">
          <table className={`min-w-full divide-y ${colors.border.primary}`}>
            <thead className={`${colors.bg.secondary}`}>
              <tr>
                <th className={`px-6 py-3 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>
                  Name
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>
                  Email
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>
                  Role
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>
                  Created At
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className={`${colors.card.primary} divide-y ${colors.border.primary}`}>
              {users.map((user) => (
                <tr key={user.id} className={`hover:${colors.bg.secondary}`}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className={`text-sm font-medium ${colors.text.primary}`}>{user.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className={`text-sm ${colors.text.primary}`}>{user.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${user.role === 'admin'
                      ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300'
                      : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                      }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm ${colors.text.secondary}`}>
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      onClick={() => handleEdit(user)}
                      className="text-teal-600 dark:text-teal-400 hover:text-teal-900 dark:hover:text-teal-300 p-1"
                      title="Edit User"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(user.id)}
                      disabled={currentUser && user.id === currentUser.id}
                      className={`p-1 ${currentUser && user.id === currentUser.id
                        ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-50'
                        : 'text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300'
                        }`}
                      title={currentUser && user.id === currentUser.id ? 'You cannot delete your own account' : 'Delete User'}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {users.length === 0 && (
            <div className={`text-center py-8 ${colors.text.secondary}`}>
              No users found
            </div>
          )}
        </div>

        {/* User Modal */}
        {showModal && (
          <ModalPortal>
          <div className="fixed inset-0 bg-gray-600 dark:bg-black bg-opacity-50 dark:bg-opacity-50 flex items-center justify-center z-50 p-4" onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setShowModal(false); } if (e.key === 'Enter') { e.stopPropagation(); /* treat enter as submit */ const form = e.currentTarget.querySelector('form'); if (form) { const btn = form.querySelector('button[type="submit"]'); if (btn) { btn.click(); } } } }}>
            <div className={`${colors.card.primary} rounded-lg p-6 w-full max-w-3xl border ${colors.border.primary} max-h-[90vh] overflow-y-auto`}>
              <div className="flex justify-between items-center mb-4">
                <h3 className={`text-lg font-semibold ${colors.text.primary}`}>
                  {editingUser ? 'Edit User' : 'Create New User'}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className={`${colors.text.tertiary} hover:${colors.text.secondary}`}
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${colors.text.primary}`}>
                    Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent ${colors.input.primary}`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-1 ${colors.text.primary}`}>
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent ${colors.input.primary}`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-1 ${colors.text.primary}`}>
                    Password {editingUser && '(leave blank to keep current)'}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      required={!editingUser}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent pr-10 ${colors.input.primary}`}
                      placeholder={editingUser ? 'Leave blank to keep current password' : 'Enter password'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? (
                        <EyeSlashIcon className="h-5 w-5" />
                      ) : (
                        <EyeIcon className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-1 ${colors.text.primary}`}>
                    Role
                  </label>
                  {editingUser && currentUser && editingUser.id === currentUser.id ? (
                    <div className={`w-full px-3 py-2 border rounded-md ${colors.input.primary} opacity-60 cursor-not-allowed flex items-center gap-2`}>
                      <span className="capitalize">{formData.role}</span>
                      <span className="text-xs text-amber-600 dark:text-amber-400 ml-auto">⚠ You cannot change your own role</span>
                    </div>
                  ) : (
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleInputChange}
                    required
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent ${colors.input.primary}`}
                  >
                    <option value="">Select a role</option>
                    <option value="employee">Employee</option>
                    <option value="admin">Admin</option>
                  </select>
                  )}
                </div>

                {/* Permissions Section (only show for non-admin to not clutter UI, admins bypass anyway) */}
                {formData.role && formData.role !== 'admin' && (
                  <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-6">
                    <h4 className={`text-md font-semibold mb-4 ${colors.text.primary}`}>User Permissions</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {permissionCategories.map(category => (
                        <div key={category.group} className={`p-4 rounded-lg border ${colors.border.primary} bg-gray-50 dark:bg-gray-800`}>
                          <h5 className={`font-medium mb-3 text-sm text-teal-700 dark:text-teal-400 border-b pb-2 ${colors.border.primary}`}>{category.group}</h5>
                          <div className="space-y-3">
                            {category.perms.map(perm => {
                              const isChecked = (formData.permissions || []).includes(perm.id);
                              return (
                                <label key={perm.id} className="flex items-center justify-between cursor-pointer group">
                                  <span className={`text-sm ${colors.text.primary}`}>{perm.label}</span>
                                  <div className="relative">
                                    <input
                                      type="checkbox"
                                      className="sr-only"
                                      checked={isChecked}
                                      onChange={() => handlePermissionToggle(perm.id)}
                                    />
                                    <div className={`block w-10 h-6 rounded-full transition-colors ${isChecked ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                                    <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${isChecked ? 'transform translate-x-4' : ''}`}></div>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex space-x-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-teal-600 hover:bg-teal-700 text-white py-2 px-4 rounded-md transition-colors"
                  >
                    {editingUser ? 'Update User' : 'Create User'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 px-4 rounded-md transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
          </ModalPortal>
        )}

        {/* Delete User Confirmation Modal */}
        {userToDelete && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            onClick={() => setUserToDelete(null)}
          >
            <div
              className={`${colors.card.primary} rounded-2xl shadow-2xl border ${colors.border.primary} w-full max-w-sm`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={`px-6 py-4 border-b ${colors.border.primary}`}>
                <h3 className={`text-lg font-semibold ${colors.text.primary}`}>Delete User</h3>
              </div>
              <div className="px-6 py-4">
                <div className={`p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 mb-4`}>
                  <p className="text-sm text-red-800 dark:text-red-300">
                    <strong>Warning:</strong> This action cannot be undone.
                  </p>
                </div>
                <p className={`${colors.text.secondary}`}>
                  Are you sure you want to delete <strong className={colors.text.primary}>{userToDelete.name}</strong> ({userToDelete.email})?
                </p>
              </div>
              <div className={`px-6 py-4 border-t ${colors.border.primary} flex justify-end gap-2`}>
                <button
                  onClick={() => setUserToDelete(null)}
                  className="px-4 py-2 bg-gray-600 dark:bg-gray-500 text-white rounded-lg hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="px-4 py-2 bg-red-600 dark:bg-red-500 text-white rounded-lg hover:bg-red-700 dark:hover:bg-red-600 transition-colors"
                >
                  Delete User
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminOnly>
  );
};

export default UserManagement; 
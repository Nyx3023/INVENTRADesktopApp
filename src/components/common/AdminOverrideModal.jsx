import React, { useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { toast } from 'react-hot-toast';
import { EyeIcon, EyeSlashIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import ModalPortal from './ModalPortal';
import { adminOverrideService } from '../../services/api';

const AdminOverrideModal = ({ isOpen, onClose, onSuccess, actionDescription, context }) => {
    const { colors } = useTheme();
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!password) {
            toast.error('Password is required');
            return;
        }

        setIsVerifying(true);
        try {
            const data = await adminOverrideService.verify({
                password,
                context: context || actionDescription || 'unspecified',
            });

            if (data.success) {
                toast.success(`Admin Override Approved by ${data.user.name}`);
                onSuccess(data);
                onClose();
            } else {
                toast.error(data.message || 'Invalid admin password');
            }
        } catch (error) {
            console.error('Verify error:', error);
            toast.error(error.message || 'Failed to verify admin password');
        } finally {
            setIsVerifying(false);
            setPassword('');
        }
    };

    return (
        <ModalPortal>
        <div className="fixed inset-0 bg-gray-600 dark:bg-black bg-opacity-50 dark:bg-opacity-50 flex items-center justify-center z-50 p-4"
            onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}>
            <div className={`${colors.card.primary} rounded-lg p-6 w-full max-w-sm border ${colors.border.primary} shadow-xl relative`}>
                <div className="flex flex-col items-center mb-6">
                    <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
                        <ExclamationTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
                    </div>
                    <h3 className={`text-lg font-bold text-center ${colors.text.primary}`}>
                        Access Restricted
                    </h3>
                    <p className={`text-sm text-center mt-2 ${colors.text.secondary}`}>
                        Admin authorization is required {actionDescription ? `to ${actionDescription}` : 'for this action'}.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className={`block text-sm font-medium mb-1 ${colors.text.primary}`}>
                            Admin Password
                        </label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent ${colors.input.primary}`}
                                placeholder="Enter admin password"
                                autoFocus
                                disabled={isVerifying}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            >
                                {showPassword ? (
                                    <EyeSlashIcon className="h-5 w-5" />
                                ) : (
                                    <EyeIcon className="h-5 w-5" />
                                )}
                            </button>
                        </div>
                    </div>

                    <div className="flex space-x-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isVerifying}
                            className={`flex-1 py-2 px-4 border ${colors.border.primary} rounded-md text-sm font-medium ${colors.text.primary} hover:${colors.bg.secondary} transition-colors`}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isVerifying}
                            className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-md text-sm font-medium disabled:opacity-50 transition-colors flex items-center justify-center"
                        >
                            {isVerifying ? 'Verifying...' : 'Override'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
        </ModalPortal>
    );
};

export default AdminOverrideModal;

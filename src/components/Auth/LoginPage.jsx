import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authService, activityLogService } from '../../services/api';
import jboLogo from '../../assets/jbologo.png';
import { EnvelopeIcon, LockClosedIcon, EyeIcon, EyeSlashIcon, XMarkIcon, InformationCircleIcon } from '@heroicons/react/24/outline';

const LoginPage = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [storeInfo, setStoreInfo] = useState({
    storeName: 'JBO Arts & Crafts Trading'
  });
  const navigate = useNavigate();

  // Load store info from localStorage
  useEffect(() => {
    const savedStoreInfo = localStorage.getItem('storeInfo');
    if (savedStoreInfo) {
      try {
        const parsed = JSON.parse(savedStoreInfo);
        setStoreInfo(prev => ({ ...prev, ...parsed }));
      } catch (e) {
        console.error('Error parsing store info:', e);
      }
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const data = await authService.login({ email, password });

      if (data?.success) {
        // Store user info in localStorage or sessionStorage
        if (rememberMe) {
          localStorage.setItem('user', JSON.stringify(data.user));
        } else {
          sessionStorage.setItem('user', JSON.stringify(data.user));
        }
        
        onLogin(data.user);
        
        // Log login activity
        try {
          await activityLogService.log({
            userId: data.user.id,
            userName: data.user.name,
            userEmail: data.user.email,
            action: 'LOGIN',
            details: { method: 'manual', rememberMe }
          });
        } catch (logError) {
          console.error('Error logging activity:', logError);
        }
        
        toast.success('Login successful!');
        navigate('/');
      } else {
        toast.error(data.message || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      const errorMessage = error?.message || 'Login failed';
      if (errorMessage.includes('Invalid email') || errorMessage.includes('INVALID_CREDENTIALS')) {
        toast.error('Invalid email or password');
      } else {
        toast.error('Connection error. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };



  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-4">
      <div className="w-full max-w-5xl">
        {/* Single Card Container */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl overflow-hidden">
          <div className="flex flex-col lg:flex-row">
            {/* Left Panel - Login Form */}
            <div className="w-full lg:w-1/2 p-8 lg:p-12">
              {/* Header */}
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Hello!</h1>
                <p className="text-gray-600 dark:text-gray-400">Sign in to your account</p>
              </div>

              {/* Login Form */}
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Email Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    E-mail
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <EnvelopeIcon className="h-5 w-5 text-purple-500 dark:text-purple-400" />
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full pl-10 pr-4 py-3 rounded-lg border-2 border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-purple-500 dark:focus:border-purple-400 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900 transition-all"
                      placeholder="Email"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <LockClosedIcon className="h-5 w-5 text-purple-500 dark:text-purple-400" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full pl-10 pr-12 py-3 rounded-lg border-2 border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-purple-500 dark:focus:border-purple-400 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900 transition-all"
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showPassword ? (
                        <EyeSlashIcon className="h-5 w-5 text-purple-500 dark:text-purple-400 hover:text-purple-600 dark:hover:text-purple-300" />
                      ) : (
                        <EyeIcon className="h-5 w-5 text-purple-500 dark:text-purple-400 hover:text-purple-600 dark:hover:text-purple-300" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Remember Me and Forgot Password */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="rememberMe"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 text-purple-600 dark:text-purple-400 border-gray-300 dark:border-slate-600 rounded focus:ring-purple-500 dark:focus:ring-purple-400 dark:bg-slate-700"
                    />
                    <label htmlFor="rememberMe" className="ml-2 text-sm text-gray-600 dark:text-gray-300">
                      Remember me
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowForgotPasswordModal(true)}
                    className="text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium"
                  >
                    Forgot password?
                  </button>
                </div>

                {/* Login Button with System Name */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 px-6 rounded-lg text-white font-semibold text-base transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transform hover:scale-[1.02] active:scale-[0.98]"
                  style={{
                    background: 'linear-gradient(90deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)'
                  }}
                >
                  {isLoading ? 'Logging in...' : 'Login'}
                </button>


              </form>
            </div>

            {/* Right Panel - Branding with Logo */}
            <div className="w-full lg:w-1/2 bg-gradient-to-br from-purple-500 via-indigo-500 to-blue-500 dark:from-purple-600 dark:via-indigo-600 dark:to-blue-600 relative overflow-hidden p-8 lg:p-12 flex flex-col justify-center items-center">
              {/* Decorative Cloud/Wavy Shapes */}
              <div className="absolute inset-0 opacity-30">
                <svg className="w-full h-full" viewBox="0 0 400 600" preserveAspectRatio="none">
                  <path d="M0,50 Q100,20 200,50 T400,50 L400,600 L0,600 Z" fill="white" opacity="0.4"/>
                  <path d="M0,200 Q150,150 300,200 T400,200 L400,600 L0,600 Z" fill="white" opacity="0.3"/>
                  <path d="M0,400 Q200,350 400,400 L400,600 L0,600 Z" fill="white" opacity="0.2"/>
                  <circle cx="350" cy="100" r="80" fill="white" opacity="0.2"/>
                  <circle cx="50" cy="500" r="60" fill="white" opacity="0.15"/>
                </svg>
              </div>

              {/* Content - Centered */}
              <div className="relative z-10 text-center w-full">
                {/* Logo - Bigger and Centered */}
                <div className="mb-8 flex justify-center">
                  <img 
                    src={jboLogo} 
                    alt="JBO Logo" 
                    className="w-48 h-48 object-contain"
                  />
                </div>

                {/* Welcome Text */}
                <h2 className="text-4xl font-bold text-white mb-4">Welcome Back!</h2>
                <p className="text-white/90 text-base leading-relaxed max-w-md mx-auto">
                  Your comprehensive inventory management solution for arts and crafts trading. 
                  Manage products, track sales, and streamline your business operations with ease.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <InformationCircleIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Forgot Password?</h3>
              </div>
              <button
                onClick={() => setShowForgotPasswordModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <XMarkIcon className="w-6 h-6 text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              <p className="text-gray-700 dark:text-gray-300 mb-6 leading-relaxed">
                If you're having trouble accessing your account or need to reset your password, 
                please contact the owner for assistance with account-related problems.
              </p>
              
              {/* Store Contact Info */}
              {(() => {
                let contactInfo = {
                  email: 'jboartsandcrafts@gmail.com',
                  phone: '0932 868 7911'
                };
                try {
                  const savedStoreInfo = localStorage.getItem('storeInfo');
                  if (savedStoreInfo) {
                    const parsed = JSON.parse(savedStoreInfo);
                    contactInfo = {
                      email: parsed.email || contactInfo.email,
                      phone: parsed.phone || contactInfo.phone
                    };
                  }
                } catch (e) {
                  console.error('Error parsing store info:', e);
                }
                return (
                  <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 space-y-2">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Contact Information:</p>
                    <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <EnvelopeIcon className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      <a 
                        href={`mailto:${contactInfo.email}`}
                        className="hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                      >
                        {contactInfo.email}
                      </a>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.36l3.506 7.854a3 3 0 01.317.545l.478.877a3 3 0 01-.98 4.28l-2.648 1.53A11.042 11.042 0 016 18c0-1.657.343-3.23.96-4.672l1.34-2.327a3 3 0 011.1-1.1l2.327-1.34A11 11 0 0118 6c1.657 0 3.23.343 4.672.96l2.327 1.34a3 3 0 011.1 1.1l1.34 2.327A11.042 11.042 0 0130 18a11.042 11.042 0 01-.96 4.672l-1.34 2.327a3 3 0 01-1.1 1.1l-2.327 1.34A11 11 0 0118 30c-1.657 0-3.23-.343-4.672-.96l-2.327-1.34a3 3 0 01-1.1-1.1l-1.34-2.327A11.042 11.042 0 016 18z" />
                      </svg>
                      <a 
                        href={`tel:${contactInfo.phone}`}
                        className="hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                      >
                        {contactInfo.phone}
                      </a>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-slate-700">
              <button
                onClick={() => setShowForgotPasswordModal(false)}
                className="px-6 py-2.5 rounded-lg text-white font-semibold transition-all duration-200 hover:shadow-lg transform hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  background: 'linear-gradient(90deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginPage;

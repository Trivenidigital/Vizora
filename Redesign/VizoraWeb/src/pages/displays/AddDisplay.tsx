import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import displayService, { DisplayData } from '../../services/displays';

export const AddDisplay: React.FC = () => {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [formData, setFormData] = useState<DisplayData>({
    name: '',
    location: '',
    qrCode: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Check authentication from localStorage
  useEffect(() => {
    const authStatus = localStorage.getItem('isAuthenticated');
    setIsAuthenticated(authStatus === 'true');
    console.log("AddDisplay - Auth state from localStorage:", { isAuthenticated: authStatus === 'true' });
  }, []);

  // Redirect if not logged in
  useEffect(() => {
    if (!isAuthenticated) {
      console.log("AddDisplay - Not authenticated, redirecting to login");
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear error when typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Display name is required';
    }
    
    if (!formData.location.trim()) {
      newErrors.location = 'Location is required';
    }
    
    if (!formData.qrCode.trim()) {
      newErrors.qrCode = 'QR code is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      const display = await displayService.pairDisplay(formData);
      toast.success('Display paired successfully!');
      navigate('/displays');
    } catch (error: any) {
      console.error('Error pairing display:', error);
      toast.error(error.response?.data?.message || 'Failed to pair display');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Add New Display</h1>
        <p className="text-gray-600 mt-1">
          Enter the QR code from your TV app and provide display details
        </p>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* QR Code */}
          <div>
            <label htmlFor="qrCode" className="block text-sm font-medium text-gray-700">
              QR Code <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="qrCode"
              name="qrCode"
              value={formData.qrCode}
              onChange={handleChange}
              className={`mt-1 block w-full rounded-md border ${
                errors.qrCode ? 'border-red-500' : 'border-gray-300'
              } px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm`}
              placeholder="Enter the QR code displayed on your TV"
            />
            {errors.qrCode && (
              <p className="mt-1 text-sm text-red-600">{errors.qrCode}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              The QR code is displayed on your TV screen when you open the Vizora TV app
            </p>
          </div>

          {/* Display Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Display Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className={`mt-1 block w-full rounded-md border ${
                errors.name ? 'border-red-500' : 'border-gray-300'
              } px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm`}
              placeholder="e.g. Living Room TV"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name}</p>
            )}
          </div>

          {/* Location */}
          <div>
            <label htmlFor="location" className="block text-sm font-medium text-gray-700">
              Location <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="location"
              name="location"
              value={formData.location}
              onChange={handleChange}
              className={`mt-1 block w-full rounded-md border ${
                errors.location ? 'border-red-500' : 'border-gray-300'
              } px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm`}
              placeholder="e.g. Main Office"
            />
            {errors.location && (
              <p className="mt-1 text-sm text-red-600">{errors.location}</p>
            )}
          </div>

          {/* Buttons */}
          <div className="flex justify-end space-x-3 pt-5">
            <button
              type="button"
              onClick={() => navigate('/displays')}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              {isLoading ? 'Pairing...' : 'Pair Display'}
            </button>
          </div>
        </form>
      </div>
      
      <div className="mt-8 bg-blue-50 p-4 rounded-lg border border-blue-100">
        <h3 className="text-lg font-medium text-blue-800">How to pair your display</h3>
        <ol className="mt-2 space-y-2 text-sm text-blue-700">
          <li>1. Download and install the Vizora TV app on your TV</li>
          <li>2. Open the app and you'll see a QR code on screen</li>
          <li>3. Enter the QR code above along with a display name and location</li>
          <li>4. Click "Pair Display" to connect your account with the TV</li>
        </ol>
      </div>
    </div>
  );
};

export default AddDisplay; 
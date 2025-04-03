import { Fragment, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { toast } from 'react-hot-toast';
import displayService from '../services/displayService';

interface AddDisplayDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const AddDisplayDialog: React.FC<AddDisplayDialogProps> = ({ isOpen, onClose }) => {
  const [step, setStep] = useState<'scan' | 'manual'>('scan');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    qrCode: '',
    name: '',
    location: ''
  });
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.qrCode) {
      toast.error('QR Code is required');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Call the displayService to register the display
      const registrationToast = toast.loading('Registering display...');
      
      try {
        await displayService.registerDisplay(
          formData.qrCode,
          formData.name || undefined,
          formData.location || undefined
        );
        
        toast.dismiss(registrationToast);
        toast.success('Display added successfully');
        
        // Reset form and close dialog
        setFormData({
          qrCode: '',
          name: '',
          location: ''
        });
        onClose();
      } catch (error) {
        toast.dismiss(registrationToast);
        throw error;
      }
    } catch (err) {
      console.error('Error registering display:', err);
      toast.error('Failed to register display. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const resetForm = () => {
    setStep('scan');
    setFormData({
      qrCode: '',
      name: '',
      location: ''
    });
  };
  
  const handleClose = () => {
    resetForm();
    onClose();
  };
  
  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={handleClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-lg bg-white p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title
                  as="h3"
                  className="text-lg font-semibold leading-6 text-gray-900"
                >
                  Add New Display
                </Dialog.Title>
                
                {/* Tab navigation */}
                <div className="flex border-b border-gray-200 mb-4 mt-4">
                  <button
                    type="button"
                    className={`px-4 py-2 ${
                      step === 'scan'
                        ? 'text-purple-600 border-b-2 border-purple-600 font-medium'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                    onClick={() => setStep('scan')}
                  >
                    Scan QR Code
                  </button>
                  <button
                    type="button"
                    className={`px-4 py-2 ${
                      step === 'manual'
                        ? 'text-purple-600 border-b-2 border-purple-600 font-medium'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                    onClick={() => setStep('manual')}
                  >
                    Manual Entry
                  </button>
                </div>
                
                {step === 'scan' ? (
                  <div>
                    <p className="text-sm text-gray-500 mb-4">
                      Open the Vizora app on your display and scan the QR code shown on screen.
                    </p>
                    
                    <div className="flex justify-center py-4">
                      <div className="w-48 h-48 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50">
                        <div className="text-center px-4">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <p className="text-sm text-gray-500">Camera access required</p>
                          <button className="mt-2 px-2 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700">
                            Enable Camera
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    <p className="text-center text-sm text-gray-500 mb-4">
                      Having trouble? <button 
                        type="button" 
                        className="text-purple-600 hover:text-purple-800" 
                        onClick={() => setStep('manual')}
                      >
                        Enter the code manually
                      </button>
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit}>
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="qrCode" className="block text-sm font-medium text-gray-700 mb-1">
                          QR Code <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          id="qrCode"
                          name="qrCode"
                          className="px-3 py-2 block w-full border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 text-sm"
                          placeholder="Enter the QR code displayed on your device"
                          value={formData.qrCode}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                      
                      <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                          Display Name
                        </label>
                        <input
                          type="text"
                          id="name"
                          name="name"
                          className="px-3 py-2 block w-full border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 text-sm"
                          placeholder="e.g. Conference Room TV"
                          value={formData.name}
                          onChange={handleInputChange}
                        />
                      </div>
                      
                      <div>
                        <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
                          Location
                        </label>
                        <input
                          type="text"
                          id="location"
                          name="location"
                          className="px-3 py-2 block w-full border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 text-sm"
                          placeholder="e.g. Conference Room"
                          value={formData.location}
                          onChange={handleInputChange}
                        />
                      </div>
                    </div>
                    
                    <div className="mt-6 flex justify-end space-x-3">
                      <button
                        type="button"
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-transparent rounded-md hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-purple-500"
                        onClick={handleClose}
                      >
                        Cancel
                      </button>
                      
                      <button
                        type="submit"
                        className={`px-4 py-2 text-sm font-medium text-white bg-purple-600 border border-transparent rounded-md hover:bg-purple-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-purple-500 flex items-center ${
                          isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
                        }`}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Adding...
                          </>
                        ) : (
                          'Add Display'
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default AddDisplayDialog; 
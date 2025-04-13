import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select-basic';
import { Button } from '@/components/ui/Button';
import { toast } from 'react-hot-toast';

// Available location options for the dropdown
const LOCATION_OPTIONS = [
  'Lobby',
  'Reception',
  'Kitchen',
  'Conference Room',
  'Office',
  'Hallway',
  'Cafeteria',
  'Break Room',
  'Other'
];

interface DisplayMetadata {
  pairingCode: string;
  name: string;
  location: string;
}

interface AddDisplayDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (displayData: DisplayMetadata) => Promise<boolean>;
}

const AddDisplayDialog = ({ isOpen, onClose, onAdd }: AddDisplayDialogProps) => {
  const [displayData, setDisplayData] = useState<DisplayMetadata>({
    pairingCode: '',
    name: '',
    location: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  
  // Reset form data when modal is opened/closed
  const handleClose = () => {
    setDisplayData({
      pairingCode: '',
      name: '',
      location: ''
    });
    setErrors({});
    onClose();
  };
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // Clear error for this field when user types
    if (errors[name]) {
      setErrors({ ...errors, [name]: '' });
    }
    
    // For pairing code, automatically convert to uppercase for better readability
    if (name === 'pairingCode') {
      // Allow only alphanumeric characters and uppercase them
      const formattedValue = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      setDisplayData({ ...displayData, [name]: formattedValue });
    } else {
      setDisplayData({ ...displayData, [name]: value });
    }
  };
  
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    // Validate pairing code (6-character alphanumeric)
    if (!displayData.pairingCode) {
      newErrors.pairingCode = 'Pairing code is required';
    } else if (!/^[A-Z0-9]{6}$/.test(displayData.pairingCode)) {
      newErrors.pairingCode = 'Pairing code must be 6 alphanumeric characters';
    }
    
    // Validate name (required, max 50 characters)
    if (!displayData.name) {
      newErrors.name = 'Display name is required';
    } else if (displayData.name.length > 50) {
      newErrors.name = 'Display name cannot exceed 50 characters';
    }
    
    // Validate location (required)
    if (!displayData.location) {
      newErrors.location = 'Location is required';
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
      const success = await onAdd(displayData);
      
      if (success) {
        toast.success(`Display "${displayData.name}" paired successfully`);
        handleClose();
      }
    } catch (error) {
      console.error('Error adding display:', error);
      toast.error('Failed to pair display. Please check the pairing code and try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Modal
      title="Add Display"
      isOpen={isOpen}
      onClose={handleClose}
      size="md"
    >
      <div className="mt-2">
        <p className="text-sm text-gray-600 mb-6">
          Enter the 6-character pairing code shown on your Vizora display screen to connect it to your account.
        </p>
        
        <form onSubmit={handleSubmit} className="space-y-5">
          <Input
            label="Pairing Code"
            id="pairingCode"
            name="pairingCode"
            value={displayData.pairingCode}
            onChange={handleChange}
            placeholder="Enter 6-character code (e.g. ABC123)"
            disabled={isLoading}
            error={errors.pairingCode}
            maxLength={6}
            className="uppercase rounded-lg"
            required
          />
          
          <Input
            label="Display Name"
            id="name"
            name="name"
            value={displayData.name}
            onChange={handleChange}
            placeholder="Enter display name (max 50 characters)"
            disabled={isLoading}
            error={errors.name}
            maxLength={50}
            className="rounded-lg"
            required
          />
          
          <Select
            label="Location"
            id="location"
            name="location"
            value={displayData.location}
            onChange={handleChange}
            disabled={isLoading}
            error={errors.location}
            required
          >
            <option value="">Select a location</option>
            {LOCATION_OPTIONS.map(option => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
          
          <div className="mt-6 flex justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={handleClose}
              disabled={isLoading}
              className="px-4 py-2"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isLoading}
              isLoading={isLoading}
              className="px-5 py-2"
            >
              Pair Display
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default AddDisplayDialog; 
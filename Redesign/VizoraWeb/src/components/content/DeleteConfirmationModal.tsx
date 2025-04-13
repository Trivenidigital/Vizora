import React from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Content } from '@vizora/common';
import { Folder } from '@/types/content';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  content: Content | Folder | null;
  isDeleting: boolean;
}

export const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  content,
  isDeleting
}) => {
  if (!content) return null;

  const isFolder = 'name' in content && !('type' in content);
  const title = isFolder ? 'Delete Folder' : 'Delete Content';
  const message = isFolder
    ? `Are you sure you want to delete the folder "${content.name}"? This action cannot be undone.`
    : `Are you sure you want to delete "${content.title}"? This action cannot be undone.`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          {message}
        </p>

        <div className="flex justify-end space-x-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}; 
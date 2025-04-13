import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Folder } from '@/services/folderService';

interface MoveContentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMove: (folderId: string | 'root') => void;
  folders: Folder[];
  isMoving: boolean;
  currentFolder: string | 'root';
  contentCount: number;
}

export const MoveContentModal: React.FC<MoveContentModalProps> = ({
  isOpen,
  onClose,
  onMove,
  folders,
  isMoving,
  currentFolder,
  contentCount
}) => {
  const [selectedFolder, setSelectedFolder] = useState<string | 'root'>(currentFolder);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onMove(selectedFolder);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Move Content"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="folder" className="block text-sm font-medium text-gray-700">
            Select Destination Folder
          </label>
          <Select
            id="folder"
            value={selectedFolder}
            onChange={(e) => setSelectedFolder(e.target.value as string | 'root')}
            className="mt-1"
          >
            <option value="root">Root (No Folder)</option>
            {folders
              .filter(folder => folder.id !== currentFolder) // Don't show current folder
              .map(folder => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))
            }
          </Select>
        </div>

        <p className="text-sm text-gray-600">
          Moving {contentCount} item{contentCount !== 1 ? 's' : ''} to {
            selectedFolder === 'root' 
              ? 'root folder' 
              : `"${folders.find(f => f.id === selectedFolder)?.name || 'selected folder'}"`
          }
        </p>

        <div className="flex justify-end space-x-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isMoving}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={selectedFolder === currentFolder || isMoving}
          >
            {isMoving ? 'Moving...' : 'Move'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}; 
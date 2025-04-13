import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Content, ContentMetadata } from '@vizora/common';

interface EditMetadataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, metadata: ContentMetadata) => void;
  content: Content | null;
  isSaving: boolean;
}

export const EditMetadataModal: React.FC<EditMetadataModalProps> = ({
  isOpen,
  onClose,
  onSave,
  content,
  isSaving
}) => {
  const [metadata, setMetadata] = useState<ContentMetadata>({
    title: '',
    description: '',
    category: '',
    tags: []
  });

  useEffect(() => {
    if (content) {
      setMetadata({
        title: content.title || '',
        description: content.description || '',
        category: content.category || '',
        tags: content.tags || []
      });
    }
  }, [content]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (content) {
      onSave(content.id, metadata);
    }
  };

  if (!content) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Content"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700">
            Title
          </label>
          <Input
            id="title"
            type="text"
            value={metadata.title}
            onChange={(e) => setMetadata(prev => ({ ...prev, title: e.target.value }))}
            placeholder="Enter content title"
            required
            className="mt-1"
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">
            Description
          </label>
          <Textarea
            id="description"
            value={metadata.description}
            onChange={(e) => setMetadata(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Enter content description"
            rows={3}
            className="mt-1"
          />
        </div>

        <div>
          <label htmlFor="category" className="block text-sm font-medium text-gray-700">
            Category
          </label>
          <Input
            id="category"
            type="text"
            value={metadata.category}
            onChange={(e) => setMetadata(prev => ({ ...prev, category: e.target.value }))}
            placeholder="Enter content category"
            className="mt-1"
          />
        </div>

        <div>
          <label htmlFor="tags" className="block text-sm font-medium text-gray-700">
            Tags
          </label>
          <Input
            id="tags"
            type="text"
            value={Array.isArray(metadata.tags) ? metadata.tags.join(', ') : metadata.tags}
            onChange={(e) => setMetadata(prev => ({ 
              ...prev, 
              tags: e.target.value.split(',').map(tag => tag.trim()).filter(Boolean)
            }))}
            placeholder="Enter tags separated by commas"
            className="mt-1"
          />
        </div>

        <div className="flex justify-end space-x-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!metadata.title.trim() || isSaving}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}; 
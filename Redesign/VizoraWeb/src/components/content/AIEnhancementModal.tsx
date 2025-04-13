import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { SparklesIcon } from '@heroicons/react/24/outline';
import { Content, ContentMetadata } from '@vizora/common';

interface AIEnhancementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (content: Content, updates: Partial<ContentMetadata>) => void;
  content: Content | null;
  isProcessing: boolean;
}

const AIEnhancementModal: React.FC<AIEnhancementModalProps> = ({
  isOpen,
  onClose,
  onApply,
  content,
  isProcessing
}) => {
  const [enhancedMetadata, setEnhancedMetadata] = useState<Partial<ContentMetadata>>({
    title: '',
    description: '',
    tags: []
  });

  if (!content) return null;

  const handleApply = () => {
    onApply(content, enhancedMetadata);
  };

  return (
    <Modal
      title="AI Content Enhancement"
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
    >
      <div className="space-y-6">
        <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
          <div className="flex items-start">
            <SparklesIcon className="h-5 w-5 text-purple-600 mt-0.5 mr-3" />
            <div>
              <h3 className="text-sm font-medium text-purple-900">AI-Enhanced Content Attributes</h3>
              <p className="mt-1 text-sm text-purple-700">
                Our AI will analyze your content and suggest optimized attributes to improve its visibility and engagement.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {/* Original content preview */}
          <div className="border rounded-lg p-4 bg-gray-50">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Original Content</h4>
            <div className="space-y-2">
              <p className="text-sm text-gray-600"><span className="font-medium">Title:</span> {content.title}</p>
              <p className="text-sm text-gray-600"><span className="font-medium">Description:</span> {content.description}</p>
              <p className="text-sm text-gray-600">
                <span className="font-medium">Tags:</span> {content.tags?.join(', ') || 'No tags'}
              </p>
            </div>
          </div>

          {/* AI enhanced preview */}
          <div className="border rounded-lg p-4 bg-gradient-to-r from-purple-50 to-blue-50">
            <h4 className="text-sm font-medium text-gray-700 mb-2">AI-Enhanced Content</h4>
            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                <span className="font-medium">Enhanced Title:</span> {enhancedMetadata.title || 'Processing...'}
              </p>
              <p className="text-sm text-gray-600">
                <span className="font-medium">Enhanced Description:</span> {enhancedMetadata.description || 'Processing...'}
              </p>
              <p className="text-sm text-gray-600">
                <span className="font-medium">Suggested Tags:</span> {enhancedMetadata.tags?.join(', ') || 'Processing...'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-6 border-t border-gray-100">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleApply}
            disabled={isProcessing}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            {isProcessing ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Applying Changes...
              </>
            ) : (
              <>
                <SparklesIcon className="h-4 w-4 mr-2" />
                Apply AI Enhancements
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export { AIEnhancementModal }; 
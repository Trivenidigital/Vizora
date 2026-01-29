import { Content } from '@/lib/types';
import Modal from './Modal';

interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: Content | null;
}

export default function PreviewModal({ isOpen, onClose, content }: PreviewModalProps) {
  if (!content) return null;

  const renderPreview = () => {
    switch (content.type) {
      case 'image':
        return (
          <img 
            src={content.url} 
            alt={content.name}
            className="max-w-full max-h-[80vh] object-contain cursor-zoom-in"
            onClick={(e) => {
              // Click to toggle zoom
              e.currentTarget.classList.toggle('scale-150');
            }}
          />
        );
      
      case 'video':
        return (
          <video 
            src={content.url} 
            controls 
            className="w-full max-h-[80vh]"
            preload="metadata"
          />
        );
      
      case 'pdf':
        return (
          <iframe 
            src={content.url}
            className="w-full h-[80vh]"
            sandbox="allow-scripts allow-same-origin"
            title={`PDF: ${content.name}`}
          />
        );
      
      case 'url':
        return (
          <div className="text-center p-8">
            <p className="text-gray-600 mb-4">External content:</p>
            <a 
              href={content.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline break-all"
            >
              {content.url}
            </a>
          </div>
        );
      
      default:
        return <p className="text-gray-500 p-8">Preview not available for this content type</p>;
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={content.name}>
      <div className="flex items-center justify-center min-h-[400px]">
        {renderPreview()}
      </div>
    </Modal>
  );
}

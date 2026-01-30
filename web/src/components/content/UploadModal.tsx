'use client';

import { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import Modal from '@/components/Modal';
import LoadingSpinner from '@/components/LoadingSpinner';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (form: UploadForm, queue: UploadQueueItem[]) => Promise<void>;
}

export interface UploadForm {
  title: string;
  type: 'image' | 'video' | 'pdf' | 'url';
  url: string;
}

export interface UploadQueueItem {
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
}

export function UploadModal({ isOpen, onClose, onUpload }: UploadModalProps) {
  const [uploadForm, setUploadForm] = useState<UploadForm>({
    title: '',
    type: 'image',
    url: '',
  });
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [actionLoading, setActionLoading] = useState(false);

  const getAcceptedFileTypes = (): Record<string, string[]> => {
    if (uploadForm.type === 'image')
      return { 'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'] };
    if (uploadForm.type === 'video')
      return { 'video/*': ['.mp4', '.mov', '.avi', '.webm'] };
    if (uploadForm.type === 'pdf') return { 'application/pdf': ['.pdf'] };
    return {};
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: getAcceptedFileTypes() as any,
    multiple: true,
    disabled: uploadForm.type === 'url',
    onDrop: (acceptedFiles) => {
      const newQueueItems = acceptedFiles.map((file) => ({
        file,
        status: 'pending' as const,
        progress: 0,
      }));
      setUploadQueue((prev) => [...prev, ...newQueueItems]);

      if (acceptedFiles.length > 0 && !uploadForm.url) {
        const file = acceptedFiles[0];
        const url = URL.createObjectURL(file);
        setUploadForm({ ...uploadForm, url });
        if (!uploadForm.title) {
          setUploadForm((prev) => ({
            ...prev,
            title: file.name.replace(/\.[^/.]+$/, ''),
          }));
        }
      }
    },
  });

  const handleSubmit = async () => {
    setActionLoading(true);
    try {
      await onUpload(uploadForm, uploadQueue);
      // Reset form
      setUploadForm({ title: '', type: 'image', url: '' });
      setUploadQueue([]);
      onClose();
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Upload Content" size="lg">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Content Title
          </label>
          <input
            type="text"
            value={uploadForm.title}
            onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
            placeholder="e.g., Summer Sale Banner"
            autoComplete="off"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Content Type
          </label>
          <select
            value={uploadForm.type}
            onChange={(e) =>
              setUploadForm({ ...uploadForm, type: e.target.value as any })
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
          >
            <option value="image">Image</option>
            <option value="video">Video</option>
            <option value="pdf">PDF</option>
            <option value="url">URL/Web Page</option>
          </select>
        </div>

        {uploadForm.type !== 'url' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload File
            </label>
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-all cursor-pointer ${
                isDragActive
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
              }`}
            >
              <input {...getInputProps()} />
              <svg
                className="w-12 h-12 text-gray-400 mb-3 mx-auto"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
              >
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {isDragActive ? (
                <p className="text-sm font-medium text-blue-600">
                  Drop the file here...
                </p>
              ) : (
                <>
                  <p className="text-sm font-medium text-blue-600 hover:text-blue-700 mb-1">
                    Drag & drop file here, or click to browse
                  </p>
                  <p className="text-xs text-gray-500">
                    {uploadForm.type === 'image' && 'PNG, JPG, GIF up to 10MB'}
                    {uploadForm.type === 'video' && 'MP4, MOV, AVI up to 100MB'}
                    {uploadForm.type === 'pdf' && 'PDF up to 50MB'}
                  </p>
                </>
              )}
            </div>

            {uploadQueue.length > 0 && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-700">
                    Upload Queue ({uploadQueue.length} file
                    {uploadQueue.length > 1 ? 's' : ''})
                  </p>
                  <button
                    onClick={() => setUploadQueue([])}
                    className="text-xs text-red-600 hover:text-red-700"
                  >
                    Clear All
                  </button>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {uploadQueue.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {item.file.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {(item.file.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <div className="ml-4 flex items-center gap-2">
                        {item.status === 'pending' && (
                          <span className="text-xs text-gray-500">Pending</span>
                        )}
                        {item.status === 'uploading' && <LoadingSpinner size="sm" />}
                        {item.status === 'success' && (
                          <span className="text-green-600">✓</span>
                        )}
                        {item.status === 'error' && (
                          <span className="text-red-600" title={item.error}>
                            ✗
                          </span>
                        )}
                        <button
                          onClick={() =>
                            setUploadQueue((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="text-gray-400 hover:text-red-600"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {uploadForm.type === 'url' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              URL
            </label>
            <input
              type="url"
              value={uploadForm.url}
              onChange={(e) => setUploadForm({ ...uploadForm, url: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              placeholder="https://example.com/page"
              autoComplete="off"
            />
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
            disabled={
              actionLoading ||
              (uploadQueue.length === 0 && (!uploadForm.title || !uploadForm.url))
            }
          >
            {actionLoading && <LoadingSpinner size="sm" />}
            {uploadQueue.length > 0
              ? `Upload ${uploadQueue.length} File${uploadQueue.length > 1 ? 's' : ''}`
              : 'Upload Content'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

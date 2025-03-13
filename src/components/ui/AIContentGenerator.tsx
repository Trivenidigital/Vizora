import React from 'react';
import { useState } from 'react';
import { Zap, Image, Video, FileText, Check, X, Loader2 } from 'lucide-react';
import PlaceholderImage from './PlaceholderImage';

interface AIContentGeneratorProps {
  onGenerate: (content: any) => void;
  onClose: () => void;
}

const AIContentGenerator: React.FC<AIContentGeneratorProps> = ({ onGenerate, onClose }) => {
  const [step, setStep] = useState(1);
  const [contentType, setContentType] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedPreview, setGeneratedPreview] = useState<React.ReactNode | null>(null);
  
  const contentTypes = [
    { id: 'image', name: 'Image', icon: Image, description: 'Generate static images for displays' },
    { id: 'video', name: 'Video', icon: Video, description: 'Create animated content with motion' },
    { id: 'presentation', name: 'Presentation', icon: FileText, description: 'Multi-slide content with transitions' },
  ];
  
  const handleGenerate = async () => {
    setGenerating(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Set different placeholders based on content type
    if (prompt.toLowerCase().includes('video')) {
      setGeneratedPreview(<PlaceholderImage width={600} height={400} text="Generated Video" />);
    } else if (prompt.toLowerCase().includes('image')) {
      setGeneratedPreview(<PlaceholderImage width={600} height={400} text="Generated Image" />);
    } else {
      setGeneratedPreview(<PlaceholderImage width={600} height={400} text="Generated Content" />);
    }
    
    setGenerating(false);
  };
  
  const handleAccept = () => {
    onGenerate({
      type: contentType,
      prompt,
      preview: generatedPreview,
      timestamp: new Date().toISOString(),
    });
    onClose();
  };
  
  return (
    <div className="bg-white rounded-lg shadow-xl overflow-hidden max-w-2xl w-full">
      {/* Header */}
      <div className="bg-primary-600 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center">
          <Zap className="h-6 w-6 text-white mr-2" />
          <h2 className="text-lg font-medium text-white">AI Content Generator</h2>
        </div>
        <button 
          onClick={onClose}
          className="text-white hover:text-primary-100"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      
      {/* Progress steps */}
      <div className="px-6 pt-4">
        <div className="flex items-center">
          <div className={`flex items-center justify-center h-8 w-8 rounded-full ${step >= 1 ? 'bg-primary-600 text-white' : 'bg-secondary-200 text-secondary-600'}`}>
            1
          </div>
          <div className={`flex-1 h-1 mx-2 ${step >= 2 ? 'bg-primary-600' : 'bg-secondary-200'}`}></div>
          <div className={`flex items-center justify-center h-8 w-8 rounded-full ${step >= 2 ? 'bg-primary-600 text-white' : 'bg-secondary-200 text-secondary-600'}`}>
            2
          </div>
          <div className={`flex-1 h-1 mx-2 ${step >= 3 ? 'bg-primary-600' : 'bg-secondary-200'}`}></div>
          <div className={`flex items-center justify-center h-8 w-8 rounded-full ${step >= 3 ? 'bg-primary-600 text-white' : 'bg-secondary-200 text-secondary-600'}`}>
            3
          </div>
        </div>
        <div className="flex justify-between text-xs text-secondary-500 mt-1 px-1">
          <span>Select Type</span>
          <span>Describe Content</span>
          <span>Review</span>
        </div>
      </div>
      
      {/* Content */}
      <div className="px-6 py-6">
        {step === 1 && (
          <div>
            <h3 className="text-lg font-medium text-secondary-900 mb-4">What type of content do you want to create?</h3>
            <div className="space-y-3">
              {contentTypes.map((type) => (
                <div 
                  key={type.id}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    contentType === type.id 
                      ? 'border-primary-600 bg-primary-50' 
                      : 'border-secondary-200 hover:bg-secondary-50'
                  }`}
                  onClick={() => setContentType(type.id)}
                >
                  <div className="flex items-center">
                    <div className={`p-2 rounded-full ${
                      contentType === type.id 
                        ? 'bg-primary-100 text-primary-600' 
                        : 'bg-secondary-100 text-secondary-600'
                    }`}>
                      <type.icon className="h-5 w-5" />
                    </div>
                    <div className="ml-3">
                      <h4 className="text-sm font-medium text-secondary-900">{type.name}</h4>
                      <p className="text-xs text-secondary-500">{type.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {step === 2 && (
          <div>
            <h3 className="text-lg font-medium text-secondary-900 mb-4">Describe what you want to create</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="prompt" className="block text-sm font-medium text-secondary-700 mb-1">
                  Content Description
                </label>
                <textarea
                  id="prompt"
                  rows={4}
                  className="input"
                  placeholder="Describe the content you want to generate in detail..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                ></textarea>
              </div>
              
              <div className="bg-secondary-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-secondary-900 mb-2">Tips for better results:</h4>
                <ul className="text-xs text-secondary-600 space-y-1 list-disc pl-4">
                  <li>Be specific about colors, style, and mood</li>
                  <li>Include your brand guidelines if applicable</li>
                  <li>Mention the target audience and purpose</li>
                  <li>Specify any text that should be included</li>
                </ul>
              </div>
            </div>
          </div>
        )}
        
        {step === 3 && (
          <div>
            <h3 className="text-lg font-medium text-secondary-900 mb-4">Review Generated Content</h3>
            <div className="space-y-4">
              <div className="bg-secondary-50 p-4 rounded-lg">
                <div className="mb-2 flex items-center">
                  <span className="text-sm font-medium text-secondary-900 mr-2">Your Prompt:</span>
                  <span className="text-sm text-secondary-600">{prompt}</span>
                </div>
                <div className="flex items-center">
                  <span className="text-sm font-medium text-secondary-900 mr-2">Content Type:</span>
                  <span className="text-sm text-secondary-600 capitalize">{contentType}</span>
                </div>
              </div>
              
              <div className="border border-secondary-200 rounded-lg overflow-hidden">
                <div className="aspect-video bg-secondary-100 flex items-center justify-center">
                  {generatedPreview ? (
                    <div className="w-full h-full">
                      {generatedPreview}
                    </div>
                  ) : (
                    <div className="text-secondary-400">Preview not available</div>
                  )}
                </div>
              </div>
              
              <div className="bg-primary-50 border border-primary-200 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-primary-800 mb-2">AI Analysis</h4>
                <p className="text-sm text-primary-700">
                  This content is optimized for digital signage with high contrast and visibility from a distance. 
                  Based on your prompt, we've created a design that aligns with modern design principles and should 
                  engage your target audience effectively.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Footer */}
      <div className="px-6 py-4 bg-secondary-50 flex justify-between">
        {step > 1 ? (
          <button 
            className="btn btn-secondary"
            onClick={() => setStep(step - 1)}
          >
            Back
          </button>
        ) : (
          <button 
            className="btn btn-secondary"
            onClick={onClose}
          >
            Cancel
          </button>
        )}
        
        {step < 3 ? (
          <button 
            className="btn btn-primary"
            disabled={step === 1 && !contentType || step === 2 && !prompt}
            onClick={() => step === 1 ? setStep(2) : handleGenerate()}
          >
            {step === 2 && generating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              'Continue'
            )}
          </button>
        ) : (
          <div className="space-x-3">
            <button 
              className="btn btn-secondary"
              onClick={() => setStep(2)}
            >
              <X className="h-4 w-4 mr-2" />
              Regenerate
            </button>
            <button 
              className="btn btn-primary"
              onClick={handleAccept}
            >
              <Check className="h-4 w-4 mr-2" />
              Accept & Save
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIContentGenerator;

'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api';

interface AIDesignerModalProps {
  onClose: () => void;
  onTemplateGenerated?: (templateId: string) => void;
}

type Step = 'prompt' | 'generating' | 'result' | 'coming-soon';

const STYLE_OPTIONS = ['Modern', 'Classic', 'Bold', 'Minimal', 'Playful', 'Elegant'];
const INDUSTRY_OPTIONS = [
  { value: '', label: 'Any Industry' },
  { value: 'retail', label: 'Retail' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'corporate', label: 'Corporate' },
  { value: 'education', label: 'Education' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'events', label: 'Events' },
];

const GENERATION_STEPS = [
  'Understanding your vision...',
  'Choosing color palette...',
  'Designing layout...',
  'Adding typography...',
  'Applying finishing touches...',
];

export default function AIDesignerModal({ onClose, onTemplateGenerated }: AIDesignerModalProps) {
  const [step, setStep] = useState<Step>('prompt');
  const [prompt, setPrompt] = useState('');
  const [selectedIndustry, setSelectedIndustry] = useState('');
  const [selectedOrientation, setSelectedOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [selectedStyle, setSelectedStyle] = useState('');
  const [generationStep, setGenerationStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setStep('generating');
    setGenerationStep(0);

    // Simulate generation steps for visual effect
    const stepInterval = setInterval(() => {
      setGenerationStep((prev) => {
        if (prev >= GENERATION_STEPS.length - 1) {
          clearInterval(stepInterval);
          return prev;
        }
        return prev + 1;
      });
    }, 800);

    try {
      const response = await apiClient.aiGenerateTemplate({
        prompt: prompt.trim(),
        category: selectedIndustry || undefined,
        orientation: selectedOrientation,
        style: selectedStyle || undefined,
      });

      clearInterval(stepInterval);

      if (response.available && response.template) {
        setStep('result');
        onTemplateGenerated?.(response.template.id);
      } else {
        setStep('coming-soon');
      }
    } catch {
      clearInterval(stepInterval);
      setStep('coming-soon');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop with mesh gradient */}
      <div className="fixed inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-[var(--surface)] rounded-2xl border border-[var(--border)] w-full max-w-2xl mx-4 shadow-2xl overflow-hidden animate-[fadeIn_0.2s_ease-out]">
        {/* Top gradient bar */}
        <div className="h-1 bg-gradient-to-r from-[#00E5A0] via-[#00B4D8] to-[#00E5A0]" />

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-lg text-[var(--foreground-tertiary)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-all"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>

        {/* Step: Prompt input */}
        {step === 'prompt' && (
          <div className="p-6 sm:p-8">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00E5A0]/20 to-[#00B4D8]/20 border border-[#00E5A0]/20 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-[#00E5A0]">
                  <path d="M12 2L14.09 8.26L20 9.27L15.55 13.97L16.91 20L12 16.9L7.09 20L8.45 13.97L4 9.27L9.91 8.26L12 2Z" fill="currentColor" />
                </svg>
              </div>
              <div>
                <h2 className="font-[var(--font-sora)] text-lg font-bold text-[var(--foreground)]">
                  AI Template Designer
                </h2>
                <p className="text-sm text-[var(--foreground-tertiary)]">
                  Describe what you want and AI will design it
                </p>
              </div>
            </div>

            {/* Prompt textarea */}
            <div className="mb-5">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe your ideal display template...&#10;&#10;e.g., A modern coffee shop menu board with warm earth tones, featuring daily specials and prices in a clean grid layout"
                className="w-full h-32 px-4 py-3 rounded-xl bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] placeholder-[var(--foreground-tertiary)] text-sm focus:outline-none focus:ring-2 focus:ring-[#00E5A0]/30 focus:border-[#00E5A0]/30 resize-none transition-all"
              />
            </div>

            {/* Options row */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--foreground-tertiary)] mb-1.5">
                  Industry
                </label>
                <select
                  value={selectedIndustry}
                  onChange={(e) => setSelectedIndustry(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-[#00E5A0]/30"
                >
                  {INDUSTRY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--foreground-tertiary)] mb-1.5">
                  Orientation
                </label>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setSelectedOrientation('landscape')}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
                      selectedOrientation === 'landscape'
                        ? 'bg-[#00E5A0]/10 text-[#00E5A0] border-[#00E5A0]/20'
                        : 'bg-[var(--background)] text-[var(--foreground-tertiary)] border-[var(--border)] hover:text-[var(--foreground-secondary)]'
                    }`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2" /></svg>
                    Landscape
                  </button>
                  <button
                    onClick={() => setSelectedOrientation('portrait')}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
                      selectedOrientation === 'portrait'
                        ? 'bg-[#00E5A0]/10 text-[#00E5A0] border-[#00E5A0]/20'
                        : 'bg-[var(--background)] text-[var(--foreground-tertiary)] border-[var(--border)] hover:text-[var(--foreground-secondary)]'
                    }`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2" /></svg>
                    Portrait
                  </button>
                </div>
              </div>
            </div>

            {/* Style chips */}
            <div className="mb-6">
              <label className="block text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--foreground-tertiary)] mb-1.5">
                Style Preference
              </label>
              <div className="flex flex-wrap gap-1.5">
                {STYLE_OPTIONS.map((style) => (
                  <button
                    key={style}
                    onClick={() => setSelectedStyle(selectedStyle === style ? '' : style)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                      selectedStyle === style
                        ? 'bg-[#00E5A0]/10 text-[#00E5A0] border-[#00E5A0]/20'
                        : 'text-[var(--foreground-tertiary)] border-[var(--border)] hover:text-[var(--foreground-secondary)] hover:border-[var(--border-dark)]'
                    }`}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>

            {/* Generate button */}
            <button
              onClick={handleGenerate}
              disabled={!prompt.trim()}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#00E5A0] to-[#00CC8E] text-[#061A21] font-bold text-sm hover:shadow-[0_0_30px_rgba(0,229,160,0.3)] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none flex items-center justify-center gap-2"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-[#061A21]">
                <path d="M12 2L14.09 8.26L20 9.27L15.55 13.97L16.91 20L12 16.9L7.09 20L8.45 13.97L4 9.27L9.91 8.26L12 2Z" fill="currentColor" />
              </svg>
              Generate Template
            </button>

            {error && (
              <p className="mt-3 text-xs text-red-400 text-center">{error}</p>
            )}
          </div>
        )}

        {/* Step: Generating */}
        {step === 'generating' && (
          <div className="p-8 sm:p-12 flex flex-col items-center justify-center min-h-[400px]">
            {/* Animated gradient orb */}
            <div className="relative w-24 h-24 mb-8">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#00E5A0] to-[#00B4D8] opacity-20 animate-ping" />
              <div className="absolute inset-2 rounded-full bg-gradient-to-br from-[#00E5A0] to-[#00B4D8] opacity-30 animate-pulse" />
              <div className="absolute inset-4 rounded-full bg-gradient-to-br from-[#00E5A0]/60 to-[#00B4D8]/60 flex items-center justify-center">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-white animate-spin" style={{ animationDuration: '3s' }}>
                  <path d="M12 2L14.09 8.26L20 9.27L15.55 13.97L16.91 20L12 16.9L7.09 20L8.45 13.97L4 9.27L9.91 8.26L12 2Z" fill="currentColor" />
                </svg>
              </div>
            </div>

            <h3 className="font-[var(--font-sora)] text-lg font-bold text-[var(--foreground)] mb-3">
              AI is designing your template
            </h3>

            {/* Progress steps */}
            <div className="space-y-2 w-full max-w-xs">
              {GENERATION_STEPS.map((stepText, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 text-sm transition-all duration-500 ${
                    i <= generationStep ? 'opacity-100' : 'opacity-0 translate-y-2'
                  }`}
                >
                  {i < generationStep ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00E5A0" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                  ) : i === generationStep ? (
                    <div className="w-3.5 h-3.5 border-2 border-[#00E5A0]/30 border-t-[#00E5A0] rounded-full animate-spin" />
                  ) : (
                    <div className="w-3.5 h-3.5 rounded-full border border-[var(--border)]" />
                  )}
                  <span className={i <= generationStep ? 'text-[var(--foreground)]' : 'text-[var(--foreground-tertiary)]'}>
                    {stepText}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step: Coming Soon */}
        {step === 'coming-soon' && (
          <div className="p-8 sm:p-12 flex flex-col items-center justify-center min-h-[400px] text-center">
            {/* Gradient icon */}
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#00E5A0]/10 to-[#00B4D8]/10 border border-[#00E5A0]/15 flex items-center justify-center mb-6">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" className="text-[#00E5A0]">
                <path d="M12 2L14.09 8.26L20 9.27L15.55 13.97L16.91 20L12 16.9L7.09 20L8.45 13.97L4 9.27L9.91 8.26L12 2Z" fill="currentColor" opacity="0.8" />
                <path d="M19 2L19.5 3.5L21 4L19.5 4.5L19 6L18.5 4.5L17 4L18.5 3.5L19 2Z" fill="currentColor" opacity="0.5" />
                <path d="M5 18L5.5 19.5L7 20L5.5 20.5L5 22L4.5 20.5L3 20L4.5 19.5L5 18Z" fill="currentColor" opacity="0.5" />
              </svg>
            </div>

            <h3 className="font-[var(--font-sora)] text-xl font-bold text-[var(--foreground)] mb-2">
              AI Designer is Launching Soon
            </h3>
            <p className="text-[var(--foreground-secondary)] text-sm max-w-sm mb-8">
              We&apos;re training our AI to create stunning display templates.
              Be among the first to experience AI-powered design.
            </p>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-5 py-2.5 rounded-lg bg-[#00E5A0] text-[#061A21] font-semibold text-sm hover:bg-[#00CC8E] transition-all"
              >
                Browse Templates
              </button>
              <button
                onClick={() => setStep('prompt')}
                className="px-5 py-2.5 rounded-lg border border-[var(--border)] text-[var(--foreground-secondary)] font-medium text-sm hover:bg-[var(--surface-hover)] transition-all"
              >
                Try Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

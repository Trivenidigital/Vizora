export default function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  };

  return (
    <div className="flex items-center justify-center" role="status" aria-live="polite" aria-label="Loading">
      <div
        className={`${sizeClasses[size]} border-4 border-[#00E5A0]/20 border-t-[#00E5A0] rounded-full animate-spin`}
        aria-hidden="true"
      />
    </div>
  );
}

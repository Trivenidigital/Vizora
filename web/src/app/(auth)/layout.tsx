export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      {children}
      {/* Shared footer for all auth pages */}
      <footer className="fixed bottom-0 left-0 right-0 py-3 text-center text-[10px] text-[var(--foreground-tertiary)] bg-[var(--background)]/80 backdrop-blur-sm border-t border-[var(--border)]/30">
        <div className="flex items-center justify-center gap-3">
          <a href="/terms" className="hover:text-[var(--foreground-secondary)] transition-colors">Terms of Service</a>
          <span className="text-[var(--border)]">|</span>
          <a href="/privacy" className="hover:text-[var(--foreground-secondary)] transition-colors">Privacy Policy</a>
          <span className="text-[var(--border)]">|</span>
          <a href="mailto:support@vizora.cloud" className="hover:text-[var(--foreground-secondary)] transition-colors">Help</a>
        </div>
      </footer>
    </div>
  );
}

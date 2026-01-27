import './globals.css';

export const metadata = {
  title: 'Vizora - Digital Signage Platform',
  description: 'Modern cloud-based digital signage management',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">{children}</body>
    </html>
  );
}

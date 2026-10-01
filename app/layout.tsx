import './styles.css';
export const metadata = { title: 'Ghost Growth · Creative Operations', description: 'Creative production from brief to delivery' };
export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) { return <html lang="en"><body>{children}</body></html>; }

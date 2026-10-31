import type { Metadata } from 'next';
import { AiSettingsLink } from '@/components/ai-settings-link';
import './globals.css';

export const metadata: Metadata = {
  title: '\u5c0f\u8bf4\u8bbe\u5b9a\u5723\u7ecf | \u6587\u5b57\u5192\u9669\u6e38\u620f\u751f\u6210\u5668',
  description: '\u8f93\u5165\u5c0f\u8bf4\u540d\uff0c\u89e3\u6790\u8bbe\u5b9a\u5723\u7ecf\uff0c\u6f0f\u6d1e\u4f53\u68c0\uff0c\u751f\u6210\u53ef\u73a9\u7684\u6587\u5b57\u5192\u9669\u6e38\u620f',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="dark">
      <body className="antialiased min-h-screen bg-background text-foreground">
        <AiSettingsLink />
        {children}
      </body>
    </html>
  );
}

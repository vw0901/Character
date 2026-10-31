import type { Metadata } from 'next';
import { AiSettingsLink } from '@/components/ai-settings-link';
import './globals.css';

export const metadata: Metadata = {
  title: '假如是你 | 小说设定圣经与 AI 文字冒险',
  description: '输入小说名，生成设定圣经、体检设定漏洞，再以「你」为主角走进故事。',
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

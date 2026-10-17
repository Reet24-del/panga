import type { Metadata } from 'next';
import { Settings } from '@/components/Settings';

export const metadata: Metadata = { title: 'Memory & library' };

export default function SettingsPage() {
  return <Settings />;
}

import type { Metadata } from 'next';
import { DealRoom } from '@/components/deal/DealRoom';

export const metadata: Metadata = { title: 'Deal file' };

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DealRoom id={id} />;
}

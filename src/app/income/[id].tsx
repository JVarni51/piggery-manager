import { useLocalSearchParams } from 'expo-router';
import { MoneyEdit } from '@/components/MoneyScreen';
import { oneParam } from '@/lib/view';

export default function IncomeEditPage() {
  const params = useLocalSearchParams<{ id: string }>();
  return <MoneyEdit kind="income" id={oneParam(params.id)} />;
}

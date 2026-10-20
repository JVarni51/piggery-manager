import { useLocalSearchParams } from 'expo-router';
import { MoneyEdit } from '@/components/MoneyScreen';
import { oneParam } from '@/lib/view';

export default function ExpenseEditPage() {
  const params = useLocalSearchParams<{ id: string }>();
  return <MoneyEdit kind="expense" id={oneParam(params.id)} />;
}

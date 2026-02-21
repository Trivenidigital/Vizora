import { Alert } from 'react-native';

type Options = {
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
};

export function showConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  destructive = false,
  onConfirm,
}: Options) {
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    {
      text: confirmLabel,
      style: destructive ? 'destructive' : 'default',
      onPress: onConfirm,
    },
  ]);
}

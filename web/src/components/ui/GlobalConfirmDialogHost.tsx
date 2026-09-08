import { useEffect, useState, type ReactElement } from 'react';
import { ConfirmDialog, handleConfirmResult } from './ConfirmDialog';

interface ConfirmDialogState {
  isOpen: boolean;
  message: string;
  title?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

export function GlobalConfirmDialogHost(): ReactElement {
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    isOpen: false,
    message: '',
  });

  useEffect(() => {
    const handleShowConfirm = (event: Event) => {
      const detail = (event as CustomEvent<Partial<ConfirmDialogState>>).detail;
      if (!detail) return;
      setConfirmDialog({
        isOpen: true,
        message: detail.message ?? '',
        title: detail.title ?? '确认操作',
        confirmText: detail.confirmText ?? '确认',
        cancelText: detail.cancelText ?? '取消',
        variant: detail.variant,
      });
    };

    window.addEventListener('show-confirm-dialog', handleShowConfirm);
    return () => window.removeEventListener('show-confirm-dialog', handleShowConfirm);
  }, []);

  const close = (result: boolean) => {
    handleConfirmResult(result);
    setConfirmDialog({ isOpen: false, message: '' });
  };

  return (
    <ConfirmDialog
      isOpen={confirmDialog.isOpen}
      message={confirmDialog.message}
      title={confirmDialog.title}
      confirmText={confirmDialog.confirmText}
      cancelText={confirmDialog.cancelText}
      variant={confirmDialog.variant}
      onConfirm={() => close(true)}
      onCancel={() => close(false)}
    />
  );
}

export default GlobalConfirmDialogHost;

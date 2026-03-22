'use client';

import * as React from 'react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';

export interface ModalProps {
  readonly open?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  readonly title: string;
  readonly description?: string;
  readonly children: React.ReactNode;
  readonly actions?: React.ReactNode;
  readonly trigger?: React.ReactNode;
}

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  actions,
  trigger,
}: ModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>
        {children}
        {actions && <DialogFooter>{actions}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}

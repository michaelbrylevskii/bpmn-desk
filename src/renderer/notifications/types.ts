export interface Notice {
  severity: 'info' | 'success' | 'error';
  title?: string;
  message: string;
  details?: string;
  action?: { label: string; run: () => void | Promise<void> };
}

export interface FailureContext { title: string; message?: string }
export type ReportNotice = (notice: Notice) => void;
export type RunOperation = (operation: () => void | Promise<void>, failure?: FailureContext) => void;

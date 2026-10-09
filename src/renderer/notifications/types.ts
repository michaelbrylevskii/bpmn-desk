export interface Notice {
  severity: 'info' | 'success' | 'error';
  title?: string;
  message: string;
  details?: string;
}

export interface FailureContext { title: string; message?: string }
export type ReportNotice = (notice: Notice) => void;
export type RunOperation = (operation: () => void | Promise<void>, failure?: FailureContext) => void;

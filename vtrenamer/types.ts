
export interface ProcessedFile {
  id: string;
  originalName: string;
  newName: string;
  tripNumber: string | null;
  status: 'pending' | 'processing' | 'completed' | 'error';
  error?: string;
  blob: Blob;
  size: number;
}

export interface ExtractionResult {
  tripNumber: string | null;
  success: boolean;
  error?: string;
}

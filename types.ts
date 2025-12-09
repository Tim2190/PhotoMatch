export interface CsvData {
  [key: string]: string; 
}

export interface PhotoData {
  id: string;
  file: File;
  previewUrl: string;
  originalName: string;
  matchedId: string | null; // Corresponds to 'Код'
  fileSize: number; // Bytes
  
  // Mapped fields
  description: string; // 'Наименование'
  type: string;        // 'Тип'
  location: string;    // 'Локация'
  date: string;        // 'Дата'
  quantity: string;    // 'Количество'
  note: string;        // 'Примечание'
  
  // Geolocation
  lat?: number;
  lng?: number;
  
  tags: string[];      // Constructed from Type, Location, etc.
  status: 'matched' | 'unmatched';
  matchReason?: string; // Debug info explaining why it matched or didn't
}

export interface ProcessingStats {
  totalPhotos: number;
  matched: number;
  unmatched: number;
}
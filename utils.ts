import { CsvData, PhotoData } from './types';

/* -------------------------------------------------------
 * NORMALIZE FILENAME
 * ----------------------------------------------------- */
export const normalizeFilename = (filename: string): string => {
  let name = filename.replace(/\.[^/.]+$/, "");
  name = name.replace(/\s*\(\d+\)$/, "");
  return name.trim();
};

/* -------------------------------------------------------
 * SAFE ID GENERATOR
 * ----------------------------------------------------- */
const generateId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
};

/* -------------------------------------------------------
 * CSV FIELD GETTER
 * ----------------------------------------------------- */
const getValue = (row: CsvData, possibleKeys: string[]): string => {
  const rowKeys = Object.keys(row);
  for (const key of possibleKeys) {
    const foundKey = rowKeys.find(
      (k) => k.toLowerCase().trim() === key.toLowerCase(),
    );
    if (foundKey && row[foundKey]) {
      return row[foundKey].trim();
    }
  }
  return '';
};

/* -------------------------------------------------------
 * CSV PARSER
 * ----------------------------------------------------- */
export const parseCSV = (text: string): CsvData[] => {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentValue = '';
  let inQuotes = false;

  const cleanText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentValue += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentValue);
      currentValue = '';
    } else if (char === '\n' && !inQuotes) {
      currentRow.push(currentValue);
      if (currentRow.length > 1 || (currentRow.length === 1 && currentRow[0] !== '')) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentValue = '';
    } else {
      currentValue += char;
    }
  }

  if (currentRow.length > 0 || currentValue) {
    currentRow.push(currentValue);
    rows.push(currentRow);
  }

  if (rows.length === 0) return [];

  const headers = rows[0].map((h) => h.trim().replace(/^\uFEFF/, ''));
  const data: CsvData[] = [];

  for (let i = 1; i < rows.length; i++) {
    const values = rows[i];
    if (values.length === 0 || (values.length === 1 && !values[0])) continue;

    const entry: CsvData = {};
    headers.forEach((header, index) => {
      const val = values[index] || '';
      entry[header] = val;
    });

    data.push(entry);
  }

  return data;
};

/* -------------------------------------------------------
 * FORMAT BYTES
 * ----------------------------------------------------- */
export const formatBytes = (bytes: number, decimals = 1) => {
  if (!+bytes) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

/* -------------------------------------------------------
 * PARSE DATE
 * ----------------------------------------------------- */
export const parseDateString = (dateStr: string): Date | null => {
  if (!dateStr) return null;

  const firstDatePart = dateStr.split('-')[0].trim();
  const cleanDate = firstDatePart.replace(/[^\d.]/g, '');
  const parts = cleanDate.split('.');

  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);

    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      const fullYear = year < 100 ? year + 1900 : year;
      return new Date(fullYear, month, day);
    }
  }

  return null;
};

/* -------------------------------------------------------
 * TIFF PREVIEW
 * ----------------------------------------------------- */
const convertTiffToPreview = async (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;

        //@ts-ignore
        if (typeof window.UTIF === 'undefined') {
          console.warn('UTIF library not loaded');
          resolve('');
          return;
        }

        //@ts-ignore
        const ifds = window.UTIF.decode(buffer);
        if (!ifds || ifds.length === 0) {
          resolve('');
          return;
        }

        const page = ifds[0];
        //@ts-ignore
        window.UTIF.decodeImage(buffer, page);
        //@ts-ignore
        const rgba = window.UTIF.toRGBA8(page);

        const canvas = document.createElement('canvas');
        canvas.width = page.width;
        canvas.height = page.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve('');
          return;
        }

        const imgData = ctx.createImageData(page.width, page.height);
        for (let i = 0; i < rgba.length; i++) imgData.data[i] = rgba[i];
        ctx.putImageData(imgData, 0, 0);

        resolve(canvas.toDataURL('image/jpeg', 0.8));
      } catch (err) {
        console.error('Error converting TIFF:', err);
        resolve('');
      }
    };

    reader.onerror = () => resolve('');
    reader.readAsArrayBuffer(file);
  });
};

/* -------------------------------------------------------
 * COORDINATES DB
 * ----------------------------------------------------- */
const COORDINATE_DB: Record<string, [number, number]> = {
  "алма-ата": [43.2551, 76.9126],
  "алматы": [43.2551, 76.9126],
  "дели": [28.6139, 77.209],
  "вашингтон": [38.9072, -77.0369],
  "хельсинки": [60.1695, 24.9354],
  "бонн": [50.7374, 7.0982],
  "ташкент": [41.2995, 69.2401],
  "каир": [30.0444, 31.2357],
  "ашхабад": [37.9601, 58.3261],
  "ашгабад": [37.9601, 58.3261],
  "ордабасы": [42.44, 69.35],
  "бангкок": [13.7563, 100.5018],
  "мадрид": [40.4168, -3.7038],
  "токио": [35.6762, 139.6503],
  "таллин": [59.437, 24.7536],
  "вильнюс": [54.6872, 25.2797],
  "киев": [50.4501, 30.5234],
  "париж": [48.8566, 2.3522],
  "будапешт": [47.4979, 19.0402],
  "москва": [55.7558, 37.6173],
  "эр-рияд": [24.7136, 46.6753],
  "дашховуз": [41.8363, 59.9666],
  "нью-йорк": [40.7128, -74.006],
  "тель-авив": [32.0853, 34.7818],
  "иерусалим": [31.7683, 35.2137],
  "пекин": [39.9042, 116.4074],
  "казань": [55.8304, 49.0661],
  "минск": [53.9045, 27.5615],
  "тегеран": [35.6892, 51.389],
  "баку": [40.4093, 49.8671],
  "тбилиси": [41.7151, 44.8271],
  "сингапур": [1.3521, 103.8198],
  "куала-лумпур": [3.139, 101.6869],
  "давос": [46.8027, 9.8298],
  "варшава": [52.2297, 21.0122],
  "кувейт": [29.3759, 47.9774],
  "маскат": [23.5859, 58.4059],
  "манама": [26.2285, 50.586],
  "туркестан": [43.3025, 68.257],
  "доха": [25.2854, 51.531],
  "абу-даби": [24.4539, 54.3773],
  "астана": [51.1694, 71.4491],
  "бухарест": [44.4268, 26.1025],
  "рим": [41.9028, 12.4964],
  "ватикан": [41.9029, 12.4534],
  "моква": [55.7558, 37.6173],
  "бишкек": [42.8746, 74.5698],
  "софия": [42.6977, 23.3219],
  "улан-батор": [47.9181, 106.9173],
  "вена": [48.2082, 16.3738],
  "душанбе": [38.5598, 68.787],
  "брюссель": [50.8503, 4.3517],
  "стамбул": [41.0082, 28.9784],
  "ереван": [40.1872, 44.5152],
  "афины": [37.9838, 23.7275],
  "загреб": [45.815, 15.9819],
  "любляна": [46.0569, 14.5058],
  "цюрих": [47.3769, 8.5417],
  "омск": [54.9885, 73.3242],
  "анкара": [39.9334, 32.8597],
  "санкт-петербург": [59.9343, 30.3351],
  "оттава": [45.4215, -75.6972],
  "ялта": [44.4952, 34.1663],
  "манила": [14.5995, 120.9842],
  "сеул": [37.5665, 126.978],
  "исламабад": [33.6844, 73.0479],
  "берлин": [52.52, 13.405],
  "уфа": [54.7388, 55.9721],
  "стокгольм": [59.3293, 18.0686],
  "кишинев": [47.0105, 28.8638],
  "ново-огарево": [55.7275, 37.2144],
  "челябинск": [55.1644, 61.4368],
  "байконур": [45.9646, 63.3052],
  "сочи": [43.6028, 39.7342],
  "шанхай": [31.2304, 121.4737],
  "рига": [56.9496, 24.1052],
  "уральск": [51.2333, 51.3667],
  "лондон": [51.5074, -0.1278],
  "амман": [31.9454, 35.9284],
  "туркменбаши": [40.0113, 52.9697],
  "бразилия": [-15.8267, -47.9218],
  "братислава": [48.1486, 17.1077],
  "пальма де майорка": [39.5696, 2.6502],
  "актобе": [50.2839, 57.1669],
  "боровое": [53.0883, 70.3061],
};

const getCoordinates = (location: string): [number, number] | null => {
  if (!location) return null;
  const clean = location.toLowerCase().replace(/^г\.\s*|^г\s+/, '').trim();

  if (COORDINATE_DB[clean]) return COORDINATE_DB[clean];

  for (const [key, coords] of Object.entries(COORDINATE_DB)) {
    if (clean.includes(key) || key.includes(clean)) {
      return coords;
    }
  }

  return null;
};

/* -------------------------------------------------------
 * LINK PHOTOS TO CSV (FIXED & SAFE)
 * ----------------------------------------------------- */
export const linkPhotosToCsv = async (
  files: File[],
  csvData: CsvData[],
): Promise<{ photos: PhotoData[]; stats: any }> => {
  const csvMap = new Map<string, CsvData>();

  csvData.forEach((row) => {
    const rawKey = getValue(row, ['код', 'code', 'id']);
    if (rawKey) {
      const mapKey = rawKey.toLowerCase().trim();
      csvMap.set(mapKey, row);
    }
  });

  let matchedCount = 0;
  const processedPhotos: PhotoData[] = [];

  for (const file of files) {
    // ВАЖНОЕ ИСПРАВЛЕНИЕ: Проверяем, что это действительно File
    if (!(file instanceof File)) {
      console.warn('Пропущен объект, который не является File:', file);
      continue;
    }

    const normalizedName = normalizeFilename(file.name);
    const lookupKey = normalizedName.toLowerCase();
    const match = csvMap.get(lookupKey);

    const description = match ? getValue(match, ['наименование', 'name', 'description']) : '';
    const type = match ? getValue(match, ['тип', 'type']) : '';
    const location = match ? getValue(match, ['локация', 'location', 'place']) : '';
    const date = match ? getValue(match, ['дата', 'date', 'year']) : '';
    const quantity = match ? getValue(match, ['количество', 'qty', 'count']) : '';
    const note = match ? getValue(match, ['примечание', 'note', 'comments']) : '';

    const tags: string[] = [];
    if (type) tags.push(type);
    if (location) tags.push(location);
    if (date) tags.push(date);

    const coords = getCoordinates(location);
    const lat = coords ? coords[0] : undefined;
    const lng = coords ? coords[1] : undefined;

    if (match) matchedCount++;

    // ГЕНЕРАЦИЯ ПРЕВЬЮ (САМОЕ ВАЖНОЕ)
    const ext = file.name.split('.').pop()?.toLowerCase();
    let previewUrl = '';

    try {
      if (ext === 'tif' || ext === 'tiff') {
        // Ждем конвертации TIFF
        previewUrl = await convertTiffToPreview(file);
      } else {
        // Для JPG/PNG создаем Blob URL сразу здесь
        previewUrl = URL.createObjectURL(file);
      }
    } catch (err) {
      console.error(`Ошибка создания превью для ${file.name}:`, err);
      previewUrl = ''; 
    }

    processedPhotos.push({
      id: generateId(),
      file: file, // Сохраняем оригинал для загрузки
      previewUrl: previewUrl, // Используем эту строку для <img src="...">
      originalName: file.name,
      fileSize: file.size,
      matchedId: match ? normalizedName : null,
      description: description || (match ? 'Без наименования' : ''),
      type,
      location,
      date,
      quantity,
      note,
      lat,
      lng,
      tags,
      status: match ? 'matched' : 'unmatched',
      matchReason: match ? 'OK' : `Код "${normalizedName}" не найден в CSV.`,
    });
  }

  return {
    photos: processedPhotos,
    stats: {
      total: files.length,
      matched: matchedCount,
      unmatched: files.length - matchedCount,
    },
  };
};

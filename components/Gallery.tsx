import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, X, Maximize2, Download, MapPin, Calendar, LayoutGrid, List, Map as MapIcon, Loader2, ChevronRight, ChevronDown } from 'lucide-react';
import { PhotoData } from '../types';
import { formatBytes, parseDateString } from '../utils';

interface GalleryProps {
  photos: PhotoData[];
}

type ViewMode = 'grid' | 'timeline' | 'map';

type LocationFilter = {
  name: string;
  lat: number;
  lng: number;
} | null;

const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

/* -------------------------------------------------------
 * HELPER: SMART RUSSIAN STEMMER
 * Отрезает окончания, чтобы искать по корню слова
 * ----------------------------------------------------- */
const getRussianRoot = (word: string) => {
  const w = word.toLowerCase();
  if (w.length < 4) return w; // Короткие слова не трогаем
  // Убираем окончания (гласные, й, ь, ъ) с конца слова
  // Это превращает "Астаны" -> "астан", "Президента" -> "президент"
  return w.replace(/[аяоеиыуэюьъй]+$/, "");
};

const Gallery: React.FC<GalleryProps> = ({ photos }) => {
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoData | null>(null);
  const [imgResolution, setImgResolution] = useState<{w: number, h: number} | null>(null);
  const [activeLocationFilter, setActiveLocationFilter] = useState<LocationFilter>(null);

  const [expandedYears, setExpandedYears] = useState<number[]>([]);
  const [expandedMonths, setExpandedMonths] = useState<string[]>([]);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [isMapLoading, setIsMapLoading] = useState(false);

  // --- FILTERING LOGIC (SMART SEARCH) ---
  const filteredPhotos = useMemo(() => {
    let result = photos;
    
    // 1. Умный поиск по тексту
    if (search) {
      // Разбиваем запрос на слова и получаем их "корни"
      const searchTerms = search.split(/\s+/).filter(t => t.length > 0).map(getRussianRoot);
      
      result = result.filter(p => {
        const fullText = [
          p.matchedId,
          p.description,
          p.location,
          p.type,
          p.date,
          ...(p.tags || [])
        ].join(' ').toLowerCase();

        // Проверяем, содержится ли КОРЕНЬ каждого слова запроса в тексте
        return searchTerms.every(root => fullText.includes(root));
      });
    }

    // 2. Фильтр по карте (координаты)
    if (activeLocationFilter) {
      result = result.filter(p => {
        if (!p.lat || !p.lng) return false;
        const isSameLat = Math.abs(p.lat - activeLocationFilter.lat) < 0.0001;
        const isSameLng = Math.abs(p.lng - activeLocationFilter.lng) < 0.0001;
        return isSameLat && isSameLng;
      });
    }

    return result;
  }, [photos, search, activeLocationFilter]);

  // --- TIMELINE LOGIC ---
  const timelineData = useMemo(() => {
    if (viewMode !== 'timeline') return { grouped: {}, years: [], withoutDates: [] };

    const withDates = filteredPhotos.filter(p => !!p.date);
    const withoutDates = filteredPhotos.filter(p => !p.date);

    const grouped: Record<number, Record<number, Record<number, PhotoData[]>>> = {};

    withDates.forEach(photo => {
      const dateObj = parseDateString(photo.date);
      if (dateObj) {
        const year = dateObj.getFullYear();
        const month = dateObj.getMonth();
        const day = dateObj.getDate();

        if (!grouped[year]) grouped[year] = {};
        if (!grouped[year][month]) grouped[year][month] = {};
        if (!grouped[year][month][day]) grouped[year][month][day] = [];

        grouped[year][month][day].push(photo);
      }
    });

    const years = Object.keys(grouped).map(Number).sort((a, b) => b - a);

    return { grouped, years, withoutDates };
  }, [filteredPhotos, viewMode]);

  const toggleYear = (year: number) => {
    setExpandedYears(prev => 
      prev.includes(year) ? prev.filter(y => y !== year) : [...prev, year]
    );
  };

  const toggleMonth = (year: number, month: number) => {
    const key = `${year}-${month}`;
    setExpandedMonths(prev => 
      prev.includes(key) ? prev.filter(m => m !== key) : [...prev, key]
    );
  };

  const handleOpenPhoto = (photo: PhotoData) => {
    setImgResolution(null);
    setSelectedPhoto(photo);
  };

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    setImgResolution({ w: naturalWidth, h: naturalHeight });
  };

  const getExtension = (filename: string) => {
    return filename.split('.').pop()?.toUpperCase() || 'FILE';
  };

  const resetView = () => {
    setActiveLocationFilter(null);
    setSearch('');
  };

  // --- LEAFLET MAP ---
  useEffect(() => {
    if (viewMode !== 'map') {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      return;
    }

    // @ts-ignore
    if (typeof window.L === 'undefined') {
      setIsMapLoading(true);
      const checkInterval = setInterval(() => {
        // @ts-ignore
        if (typeof window.L !== 'undefined') {
          clearInterval(checkInterval);
          setIsMapLoading(false);
        }
      }, 100);
      return () => clearInterval(checkInterval);
    }

    if (!mapContainerRef.current) return;
    
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
    }

    // @ts-ignore
    const L = window.L;
    
    const map = L.map(mapContainerRef.current).setView([48.0196, 66.9237], 3); 
    mapInstanceRef.current = map;

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(map);

    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    const markers: Record<string, {lat: number, lng: number, count: number, location: string}> = {};
    
    photos.forEach(p => {
      if (p.lat && p.lng && p.location) {
        const key = `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`;
        if (!markers[key]) {
          markers[key] = { lat: p.lat, lng: p.lng, count: 0, location: p.location };
        }
        markers[key].count++;
      }
    });

    Object.values(markers).forEach(m => {
      const icon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color: #4f46e5; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-size: 10px; font-weight: bold;">${m.count}</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      const marker = L.marker([m.lat, m.lng], { icon }).addTo(map);
      
      marker.bindPopup(`
        <div style="text-align: center;">
          <h3 style="font-weight: bold; margin-bottom: 4px;">${m.location}</h3>
          <p style="margin: 0; color: #666;">${m.count} фото</p>
          <button id="btn-${m.lat}-${m.lng}" style="margin-top: 8px; background: #4f46e5; color: white; border: none; padding: 4px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">Показать</button>
        </div>
      `);

      marker.on('popupopen', () => {
        const btnId = `btn-${m.lat}-${m.lng}`; 
        const btn = document.getElementById(btnId);
        if (btn) {
          btn.onclick = () => {
            setActiveLocationFilter({
                name: m.location,
                lat: m.lat,
                lng: m.lng
            });
          };
        }
      });
    });

  }, [viewMode, photos]);

  // --- RENDERERS ---

  const renderGridView = (items: PhotoData[] = filteredPhotos) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 animate-in fade-in duration-500">
        {items.map((photo) => (
          <div 
            key={photo.id} 
            className="group bg-white rounded-xl shadow-sm hover:shadow-xl border border-slate-100 overflow-hidden transition-all duration-300 hover:-translate-y-1 cursor-pointer"
            onClick={() => handleOpenPhoto(photo)}
          >
            <div className="aspect-[4/3] overflow-hidden bg-slate-100 relative flex items-center justify-center">
              <img 
                src={photo.previewUrl} 
                alt={photo.description} 
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                <Maximize2 className="text-white drop-shadow-md" size={32} />
              </div>
            </div>
            <div className="p-4">
              <h3 className="font-bold text-slate-800 truncate mb-1" title={photo.description}>
                {photo.description || photo.originalName}
              </h3>
              
              <div className="flex flex-col gap-1 mt-2 text-xs text-slate-500">
                {photo.location && (
                  <div className="flex items-center gap-1.5">
                    <MapPin size={12} className="text-indigo-500" />
                    <span className="truncate">{photo.location}</span>
                  </div>
                )}
                {photo.date && (
                  <div className="flex items-center gap-1.5">
                    <Calendar size={12} className="text-indigo-500" />
                    <span>{photo.date}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
    </div>
  );

  const renderTimelineView = () => (
    <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      {timelineData.years.length === 0 && timelineData.withoutDates.length === 0 && (
         <p className="text-center text-slate-500 mt-10">Нет данных с датами для отображения хронологии.</p>
      )}

      <div className="space-y-4">
        {timelineData.years.map((year) => {
          const isYearExpanded = expandedYears.includes(year);
          const monthsInYear = timelineData.grouped[year];
          const sortedMonths = Object.keys(monthsInYear).map(Number).sort((a, b) => a - b);

          return (
            <div key={year} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div 
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => toggleYear(year)}
              >
                <div className="flex items-center gap-4">
                   <div className="bg-indigo-600 text-white px-3 py-1 rounded-lg font-bold text-lg shadow-sm">
                      {year}
                   </div>
                   <span className="text-slate-500 text-sm">
                      {Object.values(monthsInYear).reduce((acc, m) => acc + Object.values(m).reduce((a, d) => a + d.length, 0), 0)} фото
                   </span>
                </div>
                {isYearExpanded ? <ChevronDown className="text-slate-400" /> : <ChevronRight className="text-slate-400" />}
              </div>

              {isYearExpanded && (
                <div className="border-t border-slate-100 bg-slate-50/50 p-2 space-y-2">
                  {sortedMonths.map(month => {
                    const isMonthExpanded = expandedMonths.includes(`${year}-${month}`);
                    const daysInMonth = monthsInYear[month];
                    const sortedDays = Object.keys(daysInMonth).map(Number).sort((a, b) => a - b);

                    return (
                      <div key={month} className="ml-4 border-l-2 border-indigo-200 pl-4">
                         <div 
                            className="flex items-center gap-2 py-2 cursor-pointer hover:text-indigo-600 transition-colors"
                            onClick={() => toggleMonth(year, month)}
                         >
                            {isMonthExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            <h3 className="font-semibold text-slate-700">{MONTH_NAMES[month]}</h3>
                            <span className="text-xs text-slate-400 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                              {Object.values(daysInMonth).reduce((acc, d) => acc + d.length, 0)}
                            </span>
                         </div>

                         {isMonthExpanded && (
                           <div className="mt-2 space-y-6 pl-2">
                              {sortedDays.map(day => (
                                <div key={day}>
                                   <div className="flex items-center gap-2 mb-3">
                                      <div className="w-2 h-2 bg-indigo-400 rounded-full"></div>
                                      <span className="font-medium text-sm text-slate-600">{day} {MONTH_NAMES[month]} {year}</span>
                                   </div>
                                   <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                      {daysInMonth[day].map(photo => (
                                         <div 
                                            key={photo.id} 
                                            onClick={() => handleOpenPhoto(photo)}
                                            className="aspect-square bg-slate-200 rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity border border-slate-200"
                                          >
                                            <img src={photo.previewUrl} className="w-full h-full object-cover" alt="" />
                                         </div>
                                      ))}
                                   </div>
                                </div>
                              ))}
                           </div>
                         )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {timelineData.withoutDates.length > 0 && (
        <div className="mt-12 pt-8 border-t border-slate-200">
           <h3 className="text-center text-slate-400 font-medium mb-6 uppercase tracking-wider text-sm">Без точной даты</h3>
           {renderGridView(timelineData.withoutDates)}
        </div>
      )}
    </div>
  );

  const renderMapView = () => {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="bg-slate-100 rounded-xl shadow-inner border border-slate-200 overflow-hidden relative">
           <div ref={mapContainerRef} className="w-full aspect-[2/1] relative bg-slate-200 z-0"></div>
           
           {isMapLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/80 backdrop-blur-sm z-10">
                 <Loader2 className="animate-spin text-indigo-600 mb-2" size={32} />
                 <p className="text-sm font-medium text-slate-600">Загрузка картографии...</p>
              </div>
           )}
           
           <div className="absolute top-4 left-4 z-[400] bg-white/90 backdrop-blur px-3 py-2 rounded-lg shadow-md text-xs text-slate-600 border border-slate-200 pointer-events-none">
              <p className="font-semibold">Интерактивная карта</p>
              <p>Нажмите на маркер для фильтрации</p>
           </div>
        </div>
        
        {activeLocationFilter && (
           <div className="animate-in fade-in slide-in-from-top-4 duration-300">
             <div className="mb-4 flex items-center justify-between">
                <h3 className="font-bold text-xl text-slate-800 flex items-center gap-2">
                   <MapPin className="text-indigo-600" size={24} />
                   {activeLocationFilter.name}
                </h3>
                <button onClick={() => setActiveLocationFilter(null)} className="text-sm text-indigo-600 hover:underline">
                  Показать все локации
                </button>
             </div>
             {renderGridView()}
           </div>
        )}
        
        {!activeLocationFilter && (
           <div className="text-center text-slate-400 py-4 text-sm">
             География архива. Нажмите на кружок с цифрой, чтобы увидеть фото.
           </div>
        )}
      </div>
    );
  };

  if (photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-slate-400">
        <div className="w-20 h-20 bg-slate-200 rounded-full flex items-center justify-center mb-4">
           <Search size={40} className="text-slate-400" />
        </div>
        <p className="text-xl font-medium">Фотобанк пуст.</p>
        <p className="text-sm">Перейдите в Админ панель для загрузки.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-8">
         <div className="relative w-full md:max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-xl leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow shadow-sm"
              placeholder="Поиск (например: Алматы зима)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={resetView} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            )}
         </div>

         <div className="flex bg-white p-1 rounded-lg border border-slate-200 shadow-sm w-full md:w-auto">
            <button 
              onClick={() => { setViewMode('grid'); setActiveLocationFilter(null); }}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${viewMode === 'grid' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <LayoutGrid size={16} />
              Сетка
            </button>
            <button 
              onClick={() => { setViewMode('timeline'); setActiveLocationFilter(null); }}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${viewMode === 'timeline' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <List size={16} />
              Хронология
            </button>
            <button 
              onClick={() => { setViewMode('map'); setActiveLocationFilter(null); }}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${viewMode === 'map' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <MapIcon size={16} />
              Карта
            </button>
         </div>
      </div>

      <div className="min-h-[50vh]">
        {viewMode === 'grid' && renderGridView()}
        {viewMode === 'timeline' && renderTimelineView()}
        {viewMode === 'map' && renderMapView()}

        {filteredPhotos.length === 0 && !activeLocationFilter && viewMode !== 'map' && (
           <div className="text-center py-12 text-slate-500 bg-white rounded-xl border border-dashed border-slate-300 mt-4">
             Ничего не найдено по запросу "{search}"
           </div>
        )}
      </div>

      {selectedPhoto && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedPhoto(null)}>
          <div 
            className="bg-white rounded-2xl overflow-hidden max-w-5xl w-full max-h-[90vh] flex flex-col md:flex-row shadow-2xl animate-in fade-in zoom-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full md:w-2/3 bg-slate-900 flex items-center justify-center p-4 relative group">
               <img 
                  src={selectedPhoto.previewUrl} 
                  alt={selectedPhoto.description} 
                  className="max-h-[85vh] max-w-full object-contain"
                  onLoad={handleImageLoad}
               />
            </div>

            <div className="w-full md:w-1/3 p-6 md:p-8 flex flex-col bg-white overflow-y-auto">
              <div className="flex justify-between items-start mb-6">
                <div>
                   <h2 className="text-2xl font-bold text-slate-900 leading-tight mb-1">
                     {selectedPhoto.description || "Без наименования"}
                   </h2>
                </div>
                <button 
                  onClick={() => setSelectedPhoto(null)}
                  className="p-1 rounded-full hover:bg-slate-100 text-slate-500 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-grow space-y-6">
                <div className="grid grid-cols-1 gap-4">
                  {selectedPhoto.location && (
                     <div className="flex items-start gap-3">
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                           <MapPin size={18} />
                        </div>
                        <div>
                           <p className="text-xs text-slate-400 uppercase font-semibold">Локация</p>
                           <p className="text-slate-800">{selectedPhoto.location}</p>
                        </div>
                     </div>
                  )}

                  {selectedPhoto.date && (
                     <div className="flex items-start gap-3">
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                           <Calendar size={18} />
                        </div>
                        <div>
                           <p className="text-xs text-slate-400 uppercase font-semibold">Дата</p>
                           <p className="text-slate-800">{selectedPhoto.date}</p>
                        </div>
                     </div>
                  )}
                </div>

                {selectedPhoto.note && (
                   <div className="mt-4 p-4 bg-yellow-50 border border-yellow-100 rounded-lg">
                      <p className="text-xs text-yellow-600 uppercase font-bold mb-1">Примечание</p>
                      <p className="text-sm text-yellow-800 italic">"{selectedPhoto.note}"</p>
                   </div>
                )}
              </div>

              <div className="mt-8 pt-6 border-t border-slate-100">
                <div className="flex flex-col gap-2">
                   <a 
                    href={selectedPhoto.previewUrl} 
                    download={selectedPhoto.originalName}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-3 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-800 transition-colors"
                   >
                     <Download size={18} />
                     <span>
                       {getExtension(selectedPhoto.originalName)} • {formatBytes(selectedPhoto.fileSize)}
                       {imgResolution ? ` • ${imgResolution.w}x${imgResolution.h}` : ''}
                     </span>
                   </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Gallery;

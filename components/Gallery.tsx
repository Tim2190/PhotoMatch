import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, X, Maximize2, Download, MapPin, Calendar, LayoutGrid, List, Map as MapIcon, Loader2 } from 'lucide-react';
import { PhotoData } from '../types';
import { formatBytes, parseDateString } from '../utils';

interface GalleryProps {
  photos: PhotoData[];
}

type ViewMode = 'grid' | 'timeline' | 'map';

const Gallery: React.FC<GalleryProps> = ({ photos }) => {
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoData | null>(null);
  const [imgResolution, setImgResolution] = useState<{w: number, h: number} | null>(null);
  const [activeLocationFilter, setActiveLocationFilter] = useState<string | null>(null);

  // Map state
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [isMapLoading, setIsMapLoading] = useState(false);

  // --- Filtering Logic ---
  const filteredPhotos = useMemo(() => {
    let result = photos;
    
    // Apply text search
    if (search) {
      const lowerSearch = search.toLowerCase();
      result = result.filter(p => 
        (p.matchedId && p.matchedId.toLowerCase().includes(lowerSearch)) ||
        p.description.toLowerCase().includes(lowerSearch) ||
        p.location.toLowerCase().includes(lowerSearch) ||
        p.type.toLowerCase().includes(lowerSearch) ||
        p.date.toLowerCase().includes(lowerSearch) ||
        p.tags.some(t => t.toLowerCase().includes(lowerSearch))
      );
    }

    // Apply location drill-down (for Map/Location View)
    if (activeLocationFilter) {
      result = result.filter(p => p.location === activeLocationFilter);
    }

    return result;
  }, [photos, search, activeLocationFilter]);

  // --- Grouping Logic for Timeline ---
  const timelineData = useMemo(() => {
    if (viewMode !== 'timeline') return { grouped: [], withoutDates: [] };

    // Filter out photos without dates for the main timeline
    const withDates = filteredPhotos.filter(p => !!p.date);
    const withoutDates = filteredPhotos.filter(p => !p.date);

    // Sort by Date
    withDates.sort((a, b) => {
      const da = parseDateString(a.date);
      const db = parseDateString(b.date);
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return da.getTime() - db.getTime();
    });

    // Group by Year
    const grouped: { year: number; photos: PhotoData[] }[] = [];
    withDates.forEach(photo => {
      const dateObj = parseDateString(photo.date);
      if (dateObj) {
        const year = dateObj.getFullYear();
        let group = grouped.find(g => g.year === year);
        if (!group) {
          group = { year, photos: [] };
          grouped.push(group);
        }
        group.photos.push(photo);
      }
    });

    return { grouped, withoutDates };
  }, [filteredPhotos, viewMode]);

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

  // --- LEAFLET MAP LOGIC ---
  useEffect(() => {
    // Only run if map view is active
    if (viewMode !== 'map') {
      // Cleanup map if switching away
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      return;
    }

    // Check if Leaflet is loaded
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
    
    // Prevent double init
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
    }

    // Initialize Map
    // @ts-ignore
    const L = window.L;
    
    // Default view: Eurasia/Center
    const map = L.map(mapContainerRef.current).setView([48.0196, 66.9237], 3); // Centered roughly on Kazakhstan
    mapInstanceRef.current = map;

    // CartoDB Positron (Light, minimalist)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(map);

    // Fix gray tiles issue by invalidating size after render
    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    // Group photos by location coords
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

    // Add Markers
    Object.values(markers).forEach(m => {
      // Custom Icon
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
        const btn = document.getElementById(`btn-${m.lat}-${m.lng}`);
        if (btn) {
          btn.onclick = () => {
            setActiveLocationFilter(m.location);
            // Optional: scroll down or just show filter state
          };
        }
      });
    });

  }, [viewMode, photos]);


  // --- RENDERERS ---

  const renderGridView = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 animate-in fade-in duration-500">
        {filteredPhotos.map((photo) => (
          <div 
            key={photo.id} 
            className="group bg-white rounded-xl shadow-sm hover:shadow-xl border border-slate-100 overflow-hidden transition-all duration-300 hover:-translate-y-1 cursor-pointer"
            onClick={() => handleOpenPhoto(photo)}
          >
            <div className="aspect-[4/3] overflow-hidden bg-slate-100 relative flex items-center justify-center">
              {/* ✅ ИСПОЛЬЗУЕМ PREVIEWURL, ОН ВСЕГДА ЕСТЬ */}
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
    <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      {timelineData.grouped.length === 0 && timelineData.withoutDates.length === 0 && (
         <p className="text-center text-slate-500 mt-10">Нет данных с датами для отображения хронологии.</p>
      )}

      {/* Grouped Years */}
      {timelineData.grouped.map(({ year, photos }) => (
        <div key={year} className="relative pl-8 md:pl-0">
           {/* Year Marker */}
           <div className="sticky top-20 z-10 md:absolute md:left-1/2 md:-translate-x-1/2 mb-8 md:mb-0 flex justify-center">
              <div className="bg-indigo-600 text-white px-4 py-1.5 rounded-full font-bold text-lg shadow-lg border-4 border-slate-50">
                {year}
              </div>
           </div>
           
           {/* Center Line (Hidden on mobile) */}
           <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-0.5 bg-indigo-100 -translate-x-1/2 -z-10"></div>
           
           <div className="flex flex-col gap-8 pb-12 pt-4">
             {photos.map((photo, idx) => (
                <div key={photo.id} className={`flex flex-col md:flex-row items-center gap-6 ${idx % 2 === 0 ? 'md:flex-row-reverse' : ''}`}>
                   {/* Spacer for alignment */}
                   <div className="hidden md:block flex-1"></div>
                   
                   {/* Content Card */}
                   <div 
                      className="flex-1 w-full bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow cursor-pointer flex gap-4 items-start"
                      onClick={() => handleOpenPhoto(photo)}
                   >
                      <div className="w-24 h-24 flex-shrink-0 bg-slate-100 rounded-lg overflow-hidden">
                        {/* ✅ ИСПОЛЬЗУЕМ PREVIEWURL */}
                        <img src={photo.previewUrl} className="w-full h-full object-cover" alt="" />
                      </div>
                      <div className="overflow-hidden">
                          <div className="text-xs font-semibold text-indigo-600 mb-1 flex items-center gap-1">
                             <Calendar size={10} />
                             {photo.date}
                          </div>
                          <h4 className="font-bold text-slate-800 text-sm line-clamp-2 mb-1" title={photo.description}>
                            {photo.description}
                          </h4>
                          {photo.location && (
                            <p className="text-xs text-slate-500 flex items-center gap-1 truncate">
                               <MapPin size={10} /> {photo.location}
                            </p>
                          )}
                      </div>
                   </div>
                </div>
             ))}
           </div>
        </div>
      ))}

      {/* Undated Photos */}
      {timelineData.withoutDates.length > 0 && (
        <div className="mt-12 pt-8 border-t border-slate-200">
           <h3 className="text-center text-slate-400 font-medium mb-6 uppercase tracking-wider text-sm">Без точной даты</h3>
           <div className="grid grid-cols-2 md:grid-cols-4 gap-4 opacity-75 hover:opacity-100 transition-opacity">
              {timelineData.withoutDates.map(photo => (
                 <div key={photo.id} onClick={() => handleOpenPhoto(photo)} className="bg-white p-2 rounded-lg border border-slate-200 cursor-pointer">
                    {/* ✅ ИСПОЛЬЗУЕМ PREVIEWURL */}
                    <img src={photo.previewUrl} className="w-full aspect-square object-cover rounded-md mb-2" alt="" />
                    <p className="text-xs text-slate-600 truncate">{photo.description}</p>
                 </div>
              ))}
           </div>
        </div>
      )}
    </div>
  );

  const renderMapView = () => {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        
        {/* LEAFLET MAP CONTAINER */}
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
                   {activeLocationFilter}
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

  // --- MAIN RENDER ---

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
      {/* Controls Header */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-8">
         
         {/* Search */}
         <div className="relative w-full md:max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-xl leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow shadow-sm"
              placeholder="Поиск по всему..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={resetView} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            )}
         </div>

         {/* View Switcher */}
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

      {/* Content */}
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

      {/* Modal */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedPhoto(null)}>
          <div 
            className="bg-white rounded-2xl overflow-hidden max-w-5xl w-full max-h-[90vh] flex flex-col md:flex-row shadow-2xl animate-in fade-in zoom-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Image Side */}
            <div className="w-full md:w-2/3 bg-slate-900 flex items-center justify-center p-4 relative group">
               {/* ✅ ИСПОЛЬЗУЕМ PREVIEWURL */}
               <img 
                  src={selectedPhoto.previewUrl} 
                  alt={selectedPhoto.description} 
                  className="max-h-[85vh] max-w-full object-contain"
                  onLoad={handleImageLoad}
               />
            </div>

            {/* Info Side */}
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
                
                {/* Metadata Grid */}
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
                   {/* ✅ ВАЖНЫЙ ФИКС ЗДЕСЬ 
                      Заменили createObjectURL(file) на previewUrl, так как file может быть null
                   */}
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

import React, { useState, useEffect } from 'react';
import { LayoutGrid, Lock } from 'lucide-react';
import Gallery from './components/Gallery';
import AdminPanel from './components/AdminPanel';
import { PhotoData } from './types';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://nugixzapgicswhtuaeki.supabase.co',
  'sb_publishable_kGevgEdevKM4enF33Hahjg_AnqeKNFx'
);

function App() {
  const [view, setView] = useState<'gallery' | 'admin'>('gallery');
  const [photos, setPhotos] = useState<PhotoData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPhotos();
  }, []);

  const loadPhotos = async () => {
    try {
      setLoading(true);
      
      const { data: files, error: filesError } = await supabase
        .storage
        .from('photos')
        .list();

      if (filesError) {
        console.error('Ошибка загрузки файлов:', filesError);
        setLoading(false);
        return;
      }

      if (!files || files.length === 0) {
        setPhotos([]);
        setLoading(false);
        return;
      }

      const loadedPhotos: PhotoData[] = [];
      
      for (const file of files) {
        if (file.name === '.emptyFolderPlaceholder' || file.name.endsWith('.json')) continue;

        const { data: urlData } = supabase
          .storage
          .from('photos')
          .getPublicUrl(file.name);

        const metadataFileName = file.name.replace(/\.[^/.]+$/, '') + '.json';
        const { data: metadataText, error: metaError } = await supabase
          .storage
          .from('photos')
          .download(metadataFileName);

        let metadata: any = {};
        if (!metaError && metadataText) {
          const text = await metadataText.text();
          metadata = JSON.parse(text);
        }

        loadedPhotos.push({
          id: metadata.id || file.name,
          file: null as any,
          previewUrl: urlData.publicUrl,
          originalName: metadata.originalName || file.name,
          matchedId: metadata.matchedId || null,
          fileSize: metadata.fileSize || 0,
          description: metadata.description || '',
          type: metadata.type || '',
          location: metadata.location || '',
          date: metadata.date || '',
          quantity: metadata.quantity || '',
          note: metadata.note || '',
          lat: metadata.lat,
          lng: metadata.lng,
          tags: metadata.tags || [],
          status: metadata.status || 'matched',
          matchReason: metadata.matchReason
        });
      }

      setPhotos(loadedPhotos);
    } catch (error) {
      console.error('Ошибка при загрузке фото:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async (newPhotos: PhotoData[]) => {
    try {
      setLoading(true);

      for (const photo of newPhotos) {
        const fileName = `${photo.id}_${photo.originalName}`;
        const { error: uploadError } = await supabase
          .storage
          .from('photos')
          .upload(fileName, photo.file, {
            cacheControl: '3600',
            upsert: true
          });

        if (uploadError) {
          console.error('Ошибка загрузки фото:', uploadError);
          continue;
        }

        const metadata = {
          id: photo.id,
          originalName: photo.originalName,
          matchedId: photo.matchedId,
          fileSize: photo.fileSize,
          description: photo.description,
          type: photo.type,
          location: photo.location,
          date: photo.date,
          quantity: photo.quantity,
          note: photo.note,
          lat: photo.lat,
          lng: photo.lng,
          tags: photo.tags,
          status: photo.status,
          matchReason: photo.matchReason
        };

        const metadataFileName = `${photo.id}_${photo.originalName.replace(/\.[^/.]+$/, '')}.json`;
        const metadataBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json' });
        
        await supabase
          .storage
          .from('photos')
          .upload(metadataFileName, metadataBlob, {
            cacheControl: '3600',
            upsert: true
          });
      }

      await loadPhotos();
      setView('gallery');
    } catch (error) {
      console.error('Ошибка публикации:', error);
      alert('Ошибка при публикации фото. Проверьте консоль.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('gallery')}>
            <div className="bg-indigo-600 text-white p-1.5 rounded-lg">
              <LayoutGrid size={24} />
            </div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">PhotoMatch <span className="text-indigo-600">Bank</span></h1>
          </div>

          <div className="flex items-center gap-4">
            {view === 'gallery' ? (
              <button 
                onClick={() => setView('admin')}
                className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors"
              >
                <Lock size={16} />
                Admin Panel
              </button>
            ) : (
              <button 
                onClick={() => setView('gallery')}
                className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors"
              >
                Back to Gallery
              </button>
            )}
          </div>
        </div>
      </header>

      {loading && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-4 text-slate-600 font-medium">Загрузка...</p>
          </div>
        </div>
      )}

      <main className="flex-grow bg-slate-50">
        {view === 'gallery' ? (
          <Gallery photos={photos} />
        ) : (
          <div className="container mx-auto px-4 py-8">
            <AdminPanel 
              onPublish={handlePublish} 
              onCancel={() => setView('gallery')} 
            />
          </div>
        )}
      </main>

      <footer className="bg-white border-t border-slate-200 py-6 mt-auto">
        <div className="container mx-auto px-4 text-center text-slate-400 text-sm">
          &copy; {new Date().getFullYear()} PhotoMatch Bank. Optimized for intelligent asset management.
        </div>
      </footer>
    </div>
  );
}

export default App;

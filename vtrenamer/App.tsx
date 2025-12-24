
import React, { useState, useMemo } from 'react';
import { Upload, FileText, Download, Trash2, CheckCircle2, AlertCircle, Loader2, ArrowRight, RotateCcw, Zap, Check } from 'lucide-react';
import { ProcessedFile } from './types';
import { extractTripNumber } from './services/geminiService';

const App: React.FC = () => {
  const [files, setFiles] = useState<ProcessedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result.split(',')[1]);
        }
      };
      reader.onerror = () => reject(new Error("Erro ao ler arquivo local"));
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = event.target.files;
    if (!uploadedFiles) return;

    const newFiles: ProcessedFile[] = Array.from(uploadedFiles).map((file: File) => ({
      id: Math.random().toString(36).substr(2, 9),
      originalName: file.name,
      newName: file.name,
      tripNumber: null,
      status: 'pending',
      blob: file,
      size: file.size,
    }));

    setFiles(prev => [...prev, ...newFiles]);
    event.target.value = '';
  };

  const processSingleFile = async (file: ProcessedFile) => {
    setFiles(prev => prev.map(f => f.id === file.id ? { ...f, status: 'processing', error: undefined } : f));

    try {
      const base64 = await fileToBase64(file.blob as File);
      const result = await extractTripNumber(base64);

      setFiles(prev => prev.map(f => {
        if (f.id !== file.id) return f;
        if (result.success && result.tripNumber) {
          return { 
            ...f, 
            status: 'completed', 
            tripNumber: result.tripNumber, 
            newName: `${result.tripNumber}.pdf` 
          };
        }
        return { ...f, status: 'error', error: result.error || 'Não identificado' };
      }));
    } catch (err: any) {
      setFiles(prev => prev.map(f => f.id === file.id ? { ...f, status: 'error', error: 'Erro no processamento' } : f));
    }
  };

  const processAll = async () => {
    if (isProcessing) return;
    setIsProcessing(true);

    const pending = files.filter(f => f.status === 'pending' || f.status === 'error');
    
    // Processamento paralelo otimizado
    const BATCH_SIZE = 10;
    for (let i = 0; i < pending.length; i += BATCH_SIZE) {
      const batch = pending.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(file => processSingleFile(file)));
    }
    
    setIsProcessing(false);
  };

  const downloadFile = (file: ProcessedFile) => {
    const url = URL.createObjectURL(file.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.newName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadAll = () => {
    files.filter(f => f.status === 'completed').forEach((f, i) => {
      setTimeout(() => downloadFile(f), i * 200);
    });
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const stats = useMemo(() => {
    return {
      total: files.length,
      done: files.filter(f => f.status === 'completed').length,
      fail: files.filter(f => f.status === 'error').length,
      doing: files.filter(f => f.status === 'processing').length
    };
  }, [files]);

  return (
    <div className="min-h-screen bg-[#f1f5f9] text-slate-900 selection:bg-blue-100">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2.5 rounded-2xl shadow-xl shadow-blue-100 rotate-3">
              <Zap className="text-white w-6 h-6 fill-current" />
            </div>
            <div>
              <h1 className="font-black text-2xl tracking-tighter text-slate-800 leading-none">VTRenamer</h1>
              <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">IA Powered Renamer</span>
            </div>
          </div>
          
          {stats.total > 0 && (
            <button 
              onClick={() => setFiles([])}
              className="text-xs font-bold text-slate-400 hover:text-red-500 transition-colors px-3 py-2 uppercase tracking-widest"
            >
              Limpar Lista
            </button>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Upload Area */}
        <div className="bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200 p-16 text-center hover:border-blue-400 hover:bg-blue-50/10 transition-all relative group cursor-pointer mb-12 shadow-sm">
          <input
            type="file"
            multiple
            accept="application/pdf"
            onChange={handleFileUpload}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          />
          <div className="flex flex-col items-center">
            <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
              <Upload className="w-10 h-10 text-blue-600" />
            </div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">Importe seus PDFs</h2>
            <p className="text-slate-400 mt-2 font-semibold">O sistema identificará os números de viagem automaticamente</p>
          </div>
        </div>

        {files.length > 0 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6 bg-slate-800 p-8 rounded-[2.5rem] shadow-2xl text-white">
              <div className="flex gap-8">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Arquivos</p>
                  <p className="text-2xl font-black">{stats.total}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-green-400 uppercase tracking-widest mb-1">Concluídos</p>
                  <p className="text-2xl font-black text-green-400">{stats.done}</p>
                </div>
                {stats.fail > 0 && (
                  <div>
                    <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-1">Falhas</p>
                    <p className="text-2xl font-black text-red-400">{stats.fail}</p>
                  </div>
                )}
              </div>
              
              <div className="flex gap-3 w-full sm:w-auto">
                {stats.done > 0 && (
                  <button
                    onClick={downloadAll}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-8 py-4 bg-white text-slate-900 rounded-2xl font-black hover:bg-slate-100 transition-all active:scale-95 shadow-lg"
                  >
                    <Download className="w-5 h-5" /> BAIXAR TUDO
                  </button>
                )}
                <button
                  onClick={processAll}
                  disabled={isProcessing || !files.some(f => f.status === 'pending' || f.status === 'error')}
                  className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-10 py-4 rounded-2xl font-black transition-all shadow-xl ${
                    isProcessing || !files.some(f => f.status === 'pending' || f.status === 'error')
                      ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-500 active:scale-95 shadow-blue-500/20'
                  }`}
                >
                  {isProcessing ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> ANALISANDO...</>
                  ) : (
                    <><Zap className="w-5 h-5 fill-current" /> INICIAR LEITURA</>
                  )}
                </button>
              </div>
            </div>

            <div className="grid gap-4">
              {files.map(file => (
                <div 
                  key={file.id} 
                  className={`bg-white border-2 rounded-[2rem] p-6 flex items-center justify-between transition-all duration-500 ${
                    file.status === 'error' ? 'border-red-100 bg-red-50/20' : 
                    file.status === 'completed' ? 'border-green-100 bg-green-50/40 translate-x-1 shadow-sm' : 
                    'border-transparent hover:border-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-6 min-w-0">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-all duration-500 ${
                      file.status === 'completed' ? 'bg-green-500 text-white shadow-lg shadow-green-200' :
                      file.status === 'error' ? 'bg-red-500 text-white shadow-lg shadow-red-200' :
                      file.status === 'processing' ? 'bg-blue-600 text-white animate-pulse' :
                      'bg-slate-100 text-slate-400'
                    }`}>
                      {file.status === 'completed' ? <Check className="w-7 h-7 stroke-[3px]" /> :
                       file.status === 'error' ? <AlertCircle className="w-7 h-7" /> :
                       file.status === 'processing' ? <Loader2 className="w-7 h-7 animate-spin" /> :
                       <FileText className="w-7 h-7" />}
                    </div>
                    
                    <div className="truncate">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-bold text-slate-700 truncate max-w-[150px] sm:max-w-md">
                          {file.originalName}
                        </span>
                        {file.status === 'completed' && (
                          <div className="flex items-center gap-2 animate-in slide-in-from-left-4 duration-500">
                            <ArrowRight className="w-4 h-4 text-slate-300" />
                            <span className="font-black text-blue-600 text-xl">{file.newName}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                          {(file.size / 1024).toFixed(0)} KB
                        </span>
                        {file.status === 'completed' && (
                          <span className="text-[9px] font-black text-green-600 bg-green-100 px-2 py-0.5 rounded uppercase tracking-tighter">SUCESSO</span>
                        )}
                        {file.status === 'error' && (
                          <span className="text-xs text-red-500 font-bold italic">{file.error}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 ml-4">
                    {file.status === 'completed' && (
                      <button
                        onClick={() => downloadFile(file)}
                        className="p-4 bg-green-500 text-white hover:bg-green-600 rounded-2xl transition-all shadow-lg shadow-green-100"
                        title="Baixar Agora"
                      >
                        <Download className="w-6 h-6" />
                      </button>
                    )}
                    {file.status === 'error' && !isProcessing && (
                      <button
                        onClick={() => processSingleFile(file)}
                        className="p-4 bg-slate-100 text-slate-600 hover:bg-blue-600 hover:text-white rounded-2xl transition-all"
                        title="Tentar novamente"
                      >
                        <RotateCcw className="w-6 h-6" />
                      </button>
                    )}
                    <button
                      onClick={() => removeFile(file.id)}
                      disabled={isProcessing && file.status === 'processing'}
                      className="p-4 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all disabled:opacity-0"
                    >
                      <Trash2 className="w-6 h-6" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <footer className="py-20 text-center opacity-30">
        <p className="text-[10px] font-black tracking-[0.5em] uppercase text-slate-500">
          VTRENAMER &bull; Gemini 3 Flash Optimized
        </p>
      </footer>
    </div>
  );
};

export default App;

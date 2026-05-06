import { useState, useEffect } from 'react';
import { Music, Waves, Mic2, Sparkles, AlertCircle, Key, ExternalLink, History } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ControlPanel from './components/ControlPanel';
import VoiceUpload from './components/VoiceUpload';
import AudioPlayer from './components/AudioPlayer';
import Archive, { ArchiveItem } from './components/Archive';
import { generateMusicStream, decodeAudioResponse, GenerationParams } from './lib/musicService';

export default function App() {
  const [voiceSample, setVoiceSample] = useState<{ data: string; mimeType: string } | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [lyrics, setLyrics] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsApiKey, setNeedsApiKey] = useState(false);
  const [playTrigger, setPlayTrigger] = useState(0);

  // Archive state
  const [archive, setArchive] = useState<ArchiveItem[]>(() => {
    const saved = localStorage.getItem('melodymix_archive');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('melodymix_archive', JSON.stringify(archive));
  }, [archive]);

  useEffect(() => {
    const checkApiKey = async () => {
      // Check if the user has selected a paid key for Lyria
      if (window.aistudio?.hasSelectedApiKey) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setNeedsApiKey(!hasKey);
      }
    };
    checkApiKey();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      // Assume success and proceed as per guidelines
      setNeedsApiKey(false);
    }
  };

  const handleGenerate = async (params: any) => {
    // Check key again before generating
    if (window.aistudio?.hasSelectedApiKey) {
      const hasKey = await window.aistudio.hasSelectedApiKey();
      if (!hasKey) {
        setNeedsApiKey(true);
        setIsLoading(false);
        return;
      }
    }

    setIsLoading(true);
    setError(null);
    setAudioUrl(null);
    setLyrics('');

    try {
      const generationParams: GenerationParams = {
        ...params,
        voiceSample: voiceSample || undefined
      };

      const stream = generateMusicStream(generationParams);
      let audioBase64 = '';
      let generatedLyrics = '';
      let mimeType = 'audio/wav';

      for await (const chunk of stream) {
        const parts = chunk.candidates?.[0]?.content?.parts;
        if (!parts) continue;

        for (const part of parts) {
          if (part.inlineData?.data) {
            if (!audioBase64 && part.inlineData.mimeType) {
              mimeType = part.inlineData.mimeType;
            }
            audioBase64 += part.inlineData.data;
          }
          if (part.text && !generatedLyrics) {
            generatedLyrics = part.text;
          }
        }
      }

      if (audioBase64) {
        const url = decodeAudioResponse(audioBase64, mimeType);
        setAudioUrl(url);
        setLyrics(generatedLyrics);
        setPlayTrigger(prev => prev + 1);

        // Save to archive
        const newItem: ArchiveItem = {
          id: Date.now().toString(),
          url: url,
          prompt: params.prompt,
          genre: params.genre,
          mood: params.mood,
          timestamp: Date.now(),
        };
        setArchive(prev => [newItem, ...prev]);
      } else {
        throw new Error('No audio data received from the generator.');
      }
    } catch (err: any) {
      console.error('Generation failed:', err);
      const isKeyError = err.message?.includes('Requested entity was not found') || 
                        err.message?.includes('PERMISSION_DENIED') ||
                        err.message?.includes('403');
      
      if (isKeyError) {
        setNeedsApiKey(true);
        setError('Your current API key is not authorized to use the Lyria-3 models. Please select a key from a Google Cloud project with billing enabled.');
      } else {
        setError(err.message || 'Failed to generate music. Please check your API key and prompt.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const deleteArchiveItem = (id: string) => {
    setArchive(prev => prev.filter(item => item.id !== id));
  };

  const playArchiveItem = (item: ArchiveItem) => {
    setAudioUrl(item.url);
    setPlayTrigger(prev => prev + 1);
    // Smoothly scroll to top to player
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-zinc-950">
      {/* Dynamic Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-600/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-orange-900/10 rounded-full blur-[120px] animate-pulse delay-700" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,_transparent_0%,_#09090b_70%)] opacity-50" />
      </div>

      <header className="relative z-20 pt-12 pb-8 px-6 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-zinc-900/50 border border-white/10 backdrop-blur-md mb-6"
        >
          <Sparkles className="w-4 h-4 text-orange-500" />
          <span className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-400">Powered by Lyria-3</span>
        </motion.div>
        
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white mb-4">
          Melody<span className="text-orange-600">Mix</span> AI
        </h1>
        <p className="text-zinc-500 text-lg max-w-2xl mx-auto leading-relaxed italic">
          Turn your imagination into professional audio tracks using generative AI. 
          Personalized with your own vocals.
        </p>
      </header>

      <main className="relative z-20 max-w-7xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Controls Section */}
          <div className="lg:col-span-4 space-y-8">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="glass-panel p-6"
            >
              <div className="flex items-center gap-2 mb-6 text-white font-semibold">
                <Waves className="w-5 h-5 text-orange-500" />
                <h2>Compose Settings</h2>
              </div>
              <ControlPanel onGenerate={handleGenerate} isLoading={isLoading} />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="glass-panel p-6"
            >
              <div className="flex items-center gap-2 mb-6 text-white font-semibold">
                <Mic2 className="w-5 h-5 text-orange-500" />
                <h2>Voice Persona</h2>
              </div>
              <VoiceUpload 
                onUpload={(data, mimeType) => setVoiceSample({ data, mimeType })}
                onClear={() => setVoiceSample(null)}
              />
            </motion.div>
          </div>

          {/* Player & Archive Section */}
          <div className="lg:col-span-8 space-y-8 h-full">
            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-3 text-sm"
                >
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="min-h-[400px]"
            >
              <AudioPlayer 
                url={audioUrl} 
                isLoading={isLoading} 
                lyrics={lyrics}
                playTrigger={playTrigger}
              />
            </motion.div>

            {/* Archive Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="glass-panel p-8"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-2 text-white font-semibold text-xl">
                  <History className="w-6 h-6 text-orange-500" />
                  <h2>Your Archive</h2>
                </div>
                <div className="text-xs text-zinc-500 bg-zinc-800/50 px-3 py-1 rounded-full border border-white/5">
                  {archive.length} Saved Sessions
                </div>
              </div>
              <Archive items={archive} onPlay={playArchiveItem} onDelete={deleteArchiveItem} />
            </motion.div>

            {/* Feature Highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { icon: Music, title: "High Fidelity", desc: "Studio-quality wav generation" },
                { icon: Mic2, title: "Voice Persona", desc: "Sing with your own voice sample" },
                { icon: Sparkles, title: "Smart Lyrics", desc: "AI-assisted lyric composition" }
              ].map((item, i) => (
                <div key={i} className="glass-panel p-6 border-white/5 bg-zinc-900/20">
                  <item.icon className="w-6 h-6 text-orange-500 mb-3" />
                  <h4 className="text-sm font-semibold text-white mb-1">{item.title}</h4>
                  <p className="text-xs text-zinc-500">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* API Key Modal Overlay */}
      <AnimatePresence>
        {needsApiKey && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center px-6 bg-zinc-950/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="glass-panel p-10 max-w-lg w-full text-center relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 to-orange-700" />
              
              <div className="w-20 h-20 rounded-3xl bg-orange-600/20 flex items-center justify-center mx-auto mb-8">
                <Key className="w-10 h-10 text-orange-500" />
              </div>

              <h2 className="text-3xl font-bold text-white mb-4">Paid API Key Required</h2>
              <p className="text-zinc-400 mb-8 leading-relaxed">
                Lyria-3 music models require a specialized API key from a Google Cloud project with billing enabled.
                Please select your key to continue.
              </p>

              <div className="space-y-4">
                <button
                  onClick={handleSelectKey}
                  className="btn-primary w-full flex items-center justify-center gap-2 text-lg py-4"
                >
                  <Key className="w-5 h-5" /> Select API Key
                </button>
                
                <a
                  href="https://ai.google.dev/gemini-api/docs/billing"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 text-sm text-zinc-500 hover:text-orange-500 transition-colors py-2"
                >
                  Learn about billing <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="relative z-20 py-12 border-t border-white/5 text-center">
        <p className="text-zinc-600 text-xs font-mono uppercase tracking-widest">
          MelodyMix AI &copy; 2026 • Crafted for Creative Expression
        </p>
      </footer>
    </div>
  );
}

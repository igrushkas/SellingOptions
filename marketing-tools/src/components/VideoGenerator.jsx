import { useState } from 'react';
import { Video, Sparkles, Copy, Download, AlertCircle } from 'lucide-react';
import { runOpenAI } from '../services/openaiService';
import { runGemini, generateVideo } from '../services/geminiService';

const VIDEO_TYPES = [
  { id: 'social-short', label: 'Social Short (15-60s)', description: 'Quick TikTok/Reels/Shorts clip' },
  { id: 'explainer', label: 'Explainer Video (1-2 min)', description: 'How your product works' },
  { id: 'product-demo', label: 'Product Demo (1-3 min)', description: 'Feature walkthrough' },
  { id: 'testimonial', label: 'Testimonial Template', description: 'Customer success story script' },
  { id: 'ad-creative', label: 'Ad Creative (15-30s)', description: 'Paid ad video script' },
];

export default function VideoGenerator({ apiKeys, businessContext }) {
  const [videoType, setVideoType] = useState('social-short');
  const [topic, setTopic] = useState('');
  const [script, setScript] = useState('');
  const [videoResult, setVideoResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('input'); // input | script | video

  const handleGenerateScript = async () => {
    if (!apiKeys?.openai) {
      alert('Please add your OpenAI API key in Settings.');
      return;
    }
    setLoading(true);
    try {
      const selected = VIDEO_TYPES.find(v => v.id === videoType);
      const result = await runOpenAI(
        apiKeys.openai,
        `You are a video content creator and scriptwriter. Write engaging video scripts optimized for the specified format.

Include:
- Hook (first 3 seconds to grab attention)
- Script with timestamps and visual directions
- Call to action
- Suggested background music mood
- On-screen text overlays
- Hashtags for social platforms`,
        `Create a ${selected.label} video script for:

Business: ${businessContext?.name || 'My business'}
Website: ${businessContext?.url || 'N/A'}
Description: ${businessContext?.description || 'N/A'}
Topic: ${topic || 'General product/service promotion'}

Video type: ${selected.description}`
      );
      setScript(result);
      setStep('script');
    } catch (err) {
      alert('Script generation failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateVideo = async () => {
    if (!apiKeys?.gemini) {
      alert('Please add your Gemini API key in Settings.');
      return;
    }
    setLoading(true);
    try {
      const result = await generateVideo(apiKeys.gemini, script);
      setVideoResult(result);
      setStep('video');
    } catch (err) {
      setVideoResult('Video generation is not yet available via the API. Use the script above with your preferred video tool (CapCut, Canva, or Google Veo in AI Studio).');
      setStep('video');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Video Studio</h2>
        <p className="text-sm text-[#94a3b8]">Generate video scripts and content with AI</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        {['Input', 'Script', 'Video'].map((label, i) => {
          const stepMap = ['input', 'script', 'video'];
          const isActive = stepMap.indexOf(step) >= i;
          return (
            <div key={label} className="flex items-center gap-2">
              {i > 0 && <div className={`w-8 h-px ${isActive ? 'bg-[#06b6d4]' : 'bg-[#1e293b]'}`} />}
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                isActive ? 'bg-[rgba(6,182,212,0.15)] text-[#06b6d4]' : 'text-[#64748b]'
              }`} style={!isActive ? { background: '#0d1f2d' } : {}}>
                {label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Input step */}
      {step === 'input' && (
        <div className="card p-6 space-y-4">
          <div>
            <label className="block text-sm text-[#94a3b8] mb-1.5">Video Type</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {VIDEO_TYPES.map(vt => (
                <button
                  key={vt.id}
                  onClick={() => setVideoType(vt.id)}
                  className={`p-3 rounded-lg text-left transition-all ${
                    videoType === vt.id
                      ? 'ring-1 ring-[#06b6d4]'
                      : ''
                  }`}
                  style={{
                    background: videoType === vt.id ? 'rgba(6,182,212,0.1)' : '#0d1f2d',
                    border: '1px solid ' + (videoType === vt.id ? 'rgba(6,182,212,0.3)' : 'rgba(6,182,212,0.08)')
                  }}
                >
                  <span className="text-sm font-medium text-white">{vt.label}</span>
                  <p className="text-xs text-[#64748b] mt-0.5">{vt.description}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-[#94a3b8] mb-1.5">Topic / Message</label>
            <textarea
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="What should the video be about? e.g. 'How our AI answers any question in seconds'"
              rows={3}
              className="w-full px-3 py-2.5 rounded-lg text-white placeholder-[#64748b] focus:outline-none focus:ring-1 focus:ring-[#06b6d4] resize-none"
              style={{ background: '#0d1f2d', border: '1px solid rgba(6,182,212,0.12)' }}
            />
          </div>

          <button onClick={handleGenerateScript} disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
            {loading ? (
              <><Sparkles className="w-4 h-4 animate-pulse" /> Generating Script...</>
            ) : (
              <><Sparkles className="w-4 h-4" /> Generate Script</>
            )}
          </button>
        </div>
      )}

      {/* Script step */}
      {step === 'script' && script && (
        <div className="space-y-4">
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">Generated Script</h3>
              <button onClick={() => copyToClipboard(script)}
                      className="btn-secondary text-xs flex items-center gap-1.5">
                <Copy className="w-3 h-3" /> Copy
              </button>
            </div>
            <div className="markdown-output text-sm whitespace-pre-wrap">{script}</div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep('input')} className="btn-secondary">
              Edit Input
            </button>
            <button onClick={handleGenerateVideo} disabled={loading} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {loading ? (
                <><Video className="w-4 h-4 animate-pulse" /> Generating Video...</>
              ) : (
                <><Video className="w-4 h-4" /> Generate Video with Gemini</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Video step */}
      {step === 'video' && (
        <div className="space-y-4">
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Video className="w-5 h-5 text-[#06b6d4]" />
              <h3 className="text-sm font-semibold text-white">Video Output</h3>
            </div>

            <div className="p-4 rounded-lg" style={{ background: '#0d1f2d', border: '1px solid rgba(6,182,212,0.12)' }}>
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-[#f59e0b] shrink-0 mt-0.5" />
                <div className="text-sm text-[#94a3b8]">
                  {videoResult || 'The Veo 3 API is not yet publicly available for direct REST calls. Use your script with:'}
                  <ul className="mt-2 space-y-1 text-xs">
                    <li>• <strong className="text-white">Google AI Studio</strong> — Use Veo 3 directly in the studio</li>
                    <li>• <strong className="text-white">CapCut</strong> — Free video editor with AI features</li>
                    <li>• <strong className="text-white">Canva</strong> — Design platform with video tools</li>
                    <li>• <strong className="text-white">Synthesia</strong> — AI avatar videos</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep('script')} className="btn-secondary">Back to Script</button>
            <button onClick={() => { setStep('input'); setScript(''); setVideoResult(''); }}
                    className="btn-secondary">New Video</button>
          </div>
        </div>
      )}
    </div>
  );
}

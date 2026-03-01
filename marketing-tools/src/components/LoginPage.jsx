import { Megaphone } from 'lucide-react';
import { signInWithGoogle } from '../services/authService';

export default function LoginPage({ onError }) {
  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (err) {
      onError?.(err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a1628' }}>
      <div className="text-center max-w-md mx-auto px-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-6"
             style={{ background: 'linear-gradient(135deg, #0891b2, #1d4ed8)' }}>
          <Megaphone className="w-8 h-8 text-white" />
        </div>

        <h1 className="text-3xl font-bold text-white mb-2">Marketing Tools</h1>
        <p className="text-[#94a3b8] mb-8">
          AI-powered marketing dashboard for growing your business.
          25 skills, competitor tracking, and automation — all in one place.
        </p>

        <button
          onClick={handleSignIn}
          className="inline-flex items-center gap-3 px-6 py-3 rounded-xl font-medium text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{ background: '#111d2e', border: '1px solid rgba(6,182,212,0.2)' }}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Sign in with Google
        </button>

        <p className="text-[#64748b] text-xs mt-6">
          Your data is stored securely in Firebase. Only you can access your businesses and marketing data.
        </p>
      </div>
    </div>
  );
}

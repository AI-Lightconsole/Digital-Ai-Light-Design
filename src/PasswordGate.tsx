import React, { useState } from 'react';
import { Lock } from 'lucide-react';

/**
 * 간단한 비밀번호 게이트
 * - 정답 입력 시 localStorage에 저장 → 다음 방문부터 자동 통과
 * - 비밀번호는 Vite 환경변수 VITE_APP_PASSWORD로 관리
 */

const STORAGE_KEY = 'dlc_authed';

interface Props {
  children: React.ReactNode;
}

export default function PasswordGate({ children }: Props) {
  const correctPw = (import.meta as any).env?.VITE_APP_PASSWORD || 'light2026';
  const [authed, setAuthed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === correctPw;
    } catch {
      return false;
    }
  });
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input === correctPw) {
      try { localStorage.setItem(STORAGE_KEY, input); } catch {}
      setAuthed(true);
      setError(false);
    } else {
      setError(true);
      setInput('');
    }
  };

  if (authed) return <>{children}</>;

  return (
    <div style={{
      position: 'fixed', inset: 0, display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#0a0a0b', zIndex: 99999,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <form onSubmit={submit} style={{
        background: '#18181b', border: '1px solid #27272a', borderRadius: '16px',
        padding: '32px', width: '320px', display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        <div style={{
          width: '48px', height: '48px', background: '#22c55e', borderRadius: '12px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Lock size={24} color="#fff" />
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#f4f4f5' }}>디지털 조명 AI 디자인</div>
          <div style={{ fontSize: '12px', color: '#71717a', marginTop: '4px' }}>비밀번호를 입력하세요</div>
        </div>
        <input
          type="password"
          value={input}
          onChange={(e) => { setInput(e.target.value); setError(false); }}
          autoFocus
          placeholder="비밀번호"
          style={{
            width: '100%', padding: '12px 14px', borderRadius: '10px',
            border: `1px solid ${error ? '#ef4444' : '#3f3f46'}`,
            background: '#0a0a0b', color: '#f4f4f5', fontSize: '14px', outline: 'none',
          }}
        />
        {error && <div style={{ fontSize: '12px', color: '#ef4444', alignSelf: 'flex-start' }}>비밀번호가 틀렸습니다</div>}
        <button type="submit" style={{
          width: '100%', padding: '12px', borderRadius: '10px', border: 'none',
          background: '#22c55e', color: '#fff', fontSize: '14px', fontWeight: 700, cursor: 'pointer',
        }}>
          입장
        </button>
      </form>
    </div>
  );
}

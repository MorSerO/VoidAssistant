import React, { useEffect, useRef, useCallback } from 'react';
import { useFocusStore } from '../../store/focusStore';
import { useChatStore } from '../../store/chatStore';
import Button from '../../components/common/Button';
import { Textarea } from '../../components/common/Input';

const FocusMode: React.FC = () => {
  const phase = useFocusStore((s) => s.phase);
  const purpose = useFocusStore((s) => s.purpose);
  const type = useFocusStore((s) => s.type);
  const targetDuration = useFocusStore((s) => s.targetDuration);
  const elapsed = useFocusStore((s) => s.elapsed);
  const isPaused = useFocusStore((s) => s.isPaused);
  const rating = useFocusStore((s) => s.rating);
  const note = useFocusStore((s) => s.note);
  const feedback = useFocusStore((s) => s.feedback);
  const isLoadingFeedback = useFocusStore((s) => s.isLoadingFeedback);
  const setPhase = useFocusStore((s) => s.setPhase);
  const setPurpose = useFocusStore((s) => s.setPurpose);
  const setType = useFocusStore((s) => s.setType);
  const setTargetDuration = useFocusStore((s) => s.setTargetDuration);
  const startSession = useFocusStore((s) => s.startSession);
  const pauseSession = useFocusStore((s) => s.pauseSession);
  const resumeSession = useFocusStore((s) => s.resumeSession);
  const tick = useFocusStore((s) => s.tick);
  const endSession = useFocusStore((s) => s.endSession);
  const setRating = useFocusStore((s) => s.setRating);
  const setNote = useFocusStore((s) => s.setNote);
  const saveSession = useFocusStore((s) => s.saveSession);
  const getAIFeedback = useFocusStore((s) => s.getAIFeedback);
  const reset = useFocusStore((s) => s.reset);

  const startTimeRef = useRef<number>(0);
  const pausedAtRef = useRef<number>(0);
  const rafRef = useRef<number>(0);
  const [targetMins, setTargetMins] = React.useState(25);

  // Timer tick
  useEffect(() => {
    if (phase === 'running' && !isPaused) {
      if (!startTimeRef.current) {
        startTimeRef.current = Date.now() - elapsed * 1000;
        pausedAtRef.current = 0;
      }
      if (pausedAtRef.current) {
        startTimeRef.current += Date.now() - pausedAtRef.current;
        pausedAtRef.current = 0;
      }

      const tickFn = () => {
        const now = Date.now();
        const secs = Math.floor((now - startTimeRef.current) / 1000);
        tick(secs);
        rafRef.current = requestAnimationFrame(tickFn);
      };
      rafRef.current = requestAnimationFrame(tickFn);
      return () => cancelAnimationFrame(rafRef.current);
    } else if (isPaused && !pausedAtRef.current) {
      pausedAtRef.current = Date.now();
    }
  }, [phase, isPaused, elapsed, tick]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (phase === 'running') {
          endSession();
        } else if (phase === 'review' || phase === 'feedback') {
          reset();
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [phase, endSession, reset]);

  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleStart = () => {
    startTimeRef.current = 0;
    pausedAtRef.current = 0;
    startSession();
  };

  const handleGetFeedback = async () => {
    await saveSession();
    // Use chat system to get AI feedback
    try {
      setPhase('feedback');
      const sessions = await window.electronAPI.getRecentFocusSessions();
      const currentSession = {
        purpose,
        duration: elapsed,
        rating,
        note,
      };

      // Build a focused feedback prompt
      const recentSummary = sessions
        .slice(0, 7)
        .map(s => `- ${new Date(s.timestamp).toLocaleDateString()}: "${s.purpose}" (${Math.floor(s.duration / 60)}min, rated ${s.rating}/5)`)
        .join('\n');

      // Use sendMessage with the focus prompt
      const result = await window.electronAPI.sendMessage({
        mode: 'focus',
        message: `I just completed a focus session:\n- Purpose: ${currentSession.purpose}\n- Duration: ${Math.floor(currentSession.duration / 60)} minutes\n- Rating: ${currentSession.rating}/5\n\nRecent focus history:\n${recentSummary}\n\nProvide a brief, empathetic response.`,
      });

      // Register one-shot listener for the feedback
      if (result.requestId) {
        let feedbackText = '';
        const unsub = window.electronAPI.onStreamChunk((chunk) => {
          if (chunk.type === 'text') {
            feedbackText += chunk.content || '';
          }
        });
        const unsubDone = window.electronAPI.onStreamDone(() => {
          useFocusStore.setState({ feedback: feedbackText, isLoadingFeedback: false });
          unsub();
          unsubDone();
        });
      }
    } catch {
      useFocusStore.setState({ isLoadingFeedback: false });
    }
  };

  // Idle: Minimalist clock
  if (phase === 'idle') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-8">
        <div className="text-8xl font-light text-void-text tracking-widest no-select font-mono">
          {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
        </div>
        <Button variant="secondary" onClick={() => setPhase('setup')}>
          Start Focus
        </Button>
      </div>
    );
  }

  // Setup
  if (phase === 'setup') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6">
        <h2 className="text-lg font-light text-void-text">What are you focusing on?</h2>
        <input
          type="text"
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && purpose && handleStart()}
          placeholder="E.g., Reading, Coding, Writing..."
          className="w-80 rounded border border-void-border bg-void-surface px-4 py-3 text-center text-sm text-void-text placeholder:text-void-border focus:border-void-accent focus:outline-none"
          autoFocus
        />
        <div className="flex items-center gap-3">
          <button
            onClick={() => setType('count-up')}
            className={`px-4 py-2 rounded text-sm transition-colors ${
              type === 'count-up' ? 'bg-void-accent/15 text-void-accent border border-void-accent/30' : 'text-void-secondary border border-void-border'
            }`}
          >
            Count Up
          </button>
          <button
            onClick={() => setType('count-down')}
            className={`px-4 py-2 rounded text-sm transition-colors ${
              type === 'count-down' ? 'bg-void-accent/15 text-void-accent border border-void-accent/30' : 'text-void-secondary border border-void-border'
            }`}
          >
            Count Down
          </button>
        </div>
        {type === 'count-down' && (
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={targetMins}
              onChange={(e) => { setTargetMins(Number(e.target.value)); setTargetDuration(Number(e.target.value)); }}
              className="w-20 rounded border border-void-border bg-void-surface px-3 py-2 text-center text-sm text-void-text focus:border-void-accent focus:outline-none"
              min="1"
            />
            <span className="text-sm text-void-secondary">minutes</span>
          </div>
        )}
        <Button onClick={handleStart} disabled={!purpose.trim()} className="mt-4">
          Begin
        </Button>
      </div>
    );
  }

  // Running
  if (phase === 'running') {
    const remaining = type === 'count-down' ? Math.max(0, targetDuration - elapsed) : elapsed;
    const progress = type === 'count-down' && targetDuration > 0
      ? (elapsed / targetDuration) * 100
      : 0;

    return (
      <div className="flex h-full flex-col items-center justify-center gap-6">
        {/* Purpose */}
        <p className="text-sm text-void-secondary">{purpose}</p>

        {/* Timer */}
        <div className="text-8xl font-light text-void-text tracking-widest no-select font-mono">
          {formatTime(remaining)}
        </div>

        {/* Progress ring (count-down only) */}
        {type === 'count-down' && targetDuration > 0 && (
          <div className="w-48 h-1 rounded-full bg-void-border overflow-hidden">
            <div
              className="h-full bg-void-accent transition-all duration-1000"
              style={{ width: `${Math.min(100, progress)}%` }}
            />
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center gap-3">
          {isPaused ? (
            <Button variant="secondary" onClick={resumeSession}>Resume</Button>
          ) : (
            <Button variant="secondary" onClick={pauseSession}>Pause</Button>
          )}
          <Button variant="ghost" onClick={endSession}>End Session</Button>
        </div>

        <p className="text-xs text-void-border">Press Esc to end session</p>
      </div>
    );
  }

  // Review (rating)
  if (phase === 'review') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6">
        <h2 className="text-lg font-light text-void-text">Session Complete</h2>
        <p className="text-sm text-void-secondary">
          {purpose} &mdash; {formatTime(elapsed)}
        </p>

        <div className="flex flex-col items-center gap-4">
          <p className="text-sm text-void-secondary">How was your focus?</p>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                className={`text-3xl transition-colors ${
                  star <= rating ? 'text-void-warning' : 'text-void-border'
                } hover:text-void-warning`}
              >
                ★
              </button>
            ))}
          </div>
        </div>

        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional notes..."
          className="w-80"
          rows={2}
        />

        <div className="flex gap-3">
          <Button variant="ghost" onClick={reset}>Skip</Button>
          <Button onClick={handleGetFeedback} disabled={rating === 0}>
            Get AI Feedback
          </Button>
        </div>
      </div>
    );
  }

  // Feedback
  if (phase === 'feedback') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 px-8">
        <h2 className="text-lg font-light text-void-text">Feedback</h2>
        {isLoadingFeedback ? (
          <div className="flex items-center gap-2 text-sm text-void-secondary">
            <span className="inline-block w-2 h-2 rounded-full bg-void-accent animate-pulse" />
            Generating feedback...
          </div>
        ) : (
          <p className="max-w-md text-center text-sm text-void-text leading-relaxed">
            {feedback || 'Great work! Every focused session builds momentum.'}
          </p>
        )}
        <Button onClick={reset} variant="secondary" className="mt-4">
          Done
        </Button>
      </div>
    );
  }

  return null;
};

export default FocusMode;

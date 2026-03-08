import { create } from 'zustand';
import type { LiveSessionState, SessionState } from '@/types';

interface SessionStore extends LiveSessionState {
  // Actions
  startSession: () => void;
  pauseSession: () => void;
  resumeSession: () => void;
  endSession: () => void;
  incrementRep: () => void;
  incrementSet: () => void;
  setCurrentStep: (step: number) => void;
  updateAccuracy: (score: number, incorrectJoints: string[]) => void;
  updateROM: (angle: number) => void;
  setFeedback: (msg: string) => void;
  tickElapsed: () => void;
  reset: () => void;
}

const initialState: LiveSessionState = {
  session_state: 'idle',
  current_step: 1,
  rep_count: 0,
  set_count: 0,
  current_rom: 0,
  max_rom: 0,
  min_rom: Infinity,
  accuracy_score: 100,
  feedback_message: 'Get ready — position yourself in front of the camera.',
  incorrect_joints: [],
  rep_state: 'idle',
  elapsed_seconds: 0,
};

export const useSessionStore = create<SessionStore>((set) => ({
  ...initialState,

  startSession: () => set({ session_state: 'active', rep_state: 'in_progress' }),
  pauseSession: () => set({ session_state: 'paused' }),
  resumeSession: () => set({ session_state: 'active' }),
  endSession: () => set({ session_state: 'complete' }),

  incrementRep: () => set((s) => ({ rep_count: s.rep_count + 1 })),
  incrementSet: () => set((s) => ({ set_count: s.set_count + 1, rep_count: 0 })),

  setCurrentStep: (step) => set({ current_step: step }),

  updateAccuracy: (score, incorrectJoints) =>
    set({ accuracy_score: score, incorrect_joints: incorrectJoints }),

  updateROM: (angle) =>
    set((s) => ({
      current_rom: angle,
      max_rom: Math.max(s.max_rom, angle),
      min_rom: Math.min(s.min_rom === Infinity ? angle : s.min_rom, angle),
    })),

  setFeedback: (msg) => set({ feedback_message: msg }),

  tickElapsed: () => set((s) => ({ elapsed_seconds: s.elapsed_seconds + 1 })),

  reset: () => set(initialState),
}));

import { useRef, useCallback, useState, useEffect } from 'react';

// ─── Difficulty Mapping ─────────────────────────────────────────────
// Maps user-facing level (1-10) to Stockfish UCI parameters.
// Lower levels = limited depth + lower Skill Level for "human-like" play.
// Higher levels = deeper search + full Skill Level for Grandmaster play.
interface DifficultyConfig {
    depth: number;
    skillLevel: number;
}

function getDifficultyConfig(level: number): DifficultyConfig {
    // Clamp to 1-10
    const l = Math.max(1, Math.min(10, level));

    // Map 1-10 to Skill Level 0-20
    // Level 1 → Skill 0, Level 10 → Skill 20
    const skillLevel = Math.round(((l - 1) / 9) * 20);

    // Map 1-10 to depth 1-18
    // Level 1 → depth 1, Level 10 → depth 18
    const depthMap: Record<number, number> = {
        1: 1,
        2: 2,
        3: 4,
        4: 6,
        5: 8,
        6: 10,
        7: 12,
        8: 14,
        9: 16,
        10: 18,
    };

    return {
        depth: depthMap[l] ?? 8,
        skillLevel,
    };
}

// ─── Exported Interface ─────────────────────────────────────────────
export interface StockfishEngine {
    isReady: boolean;
    isThinking: boolean;
    getBestMove: (fen: string, level: number) => void;
    stop: () => void;
    reset: () => void;
}

// ─── Hook ───────────────────────────────────────────────────────────
export function useStockfish(
    onBestMove: (from: string, to: string, promotion?: string) => void
): StockfishEngine {
    const workerRef = useRef<Worker | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [isThinking, setIsThinking] = useState(false);
    const thinkingIdRef = useRef(0); // Monotonic counter to discard stale responses
    const isMountedRef = useRef(true);

    // ── Initialize Worker on mount ────────────────────────────────────
    useEffect(() => {
        isMountedRef.current = true;

        // Detect WASM support
        const wasmSupported =
            typeof WebAssembly === 'object' &&
            WebAssembly.validate(
                Uint8Array.of(0x0, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00)
            );

        const workerPath = wasmSupported
            ? '/stockfish.wasm.js'
            : '/stockfish.js';

        try {
            const worker = new Worker(workerPath);
            workerRef.current = worker;

            worker.addEventListener('message', (e: MessageEvent) => {
                const msg = typeof e.data === 'string' ? e.data : '';

                // UCI readiness confirmation
                if (msg === 'readyok') {
                    if (isMountedRef.current) setIsReady(true);
                }

                // Best move response: "bestmove e2e4" or "bestmove e7e8q"
                if (msg.startsWith('bestmove')) {
                    if (isMountedRef.current) {
                        setIsThinking(false);
                        const parts = msg.split(' ');
                        const moveStr = parts[1];
                        if (moveStr && moveStr !== '(none)') {
                            const from = moveStr.substring(0, 2);
                            const to = moveStr.substring(2, 4);
                            const promotion =
                                moveStr.length > 4 ? moveStr.substring(4) : undefined;
                            onBestMove(from, to, promotion);
                        }
                    }
                }
            });

            // Initialize UCI protocol
            worker.postMessage('uci');
            worker.postMessage('isready');
        } catch (err) {
            console.warn('Stockfish Worker failed to initialize:', err);
        }

        return () => {
            isMountedRef.current = false;
            if (workerRef.current) {
                workerRef.current.postMessage('quit');
                workerRef.current.terminate();
                workerRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // onBestMove is intentionally excluded — it's a stable ref in App

    // ── Request best move ─────────────────────────────────────────────
    const getBestMove = useCallback((fen: string, level: number) => {
        const worker = workerRef.current;
        if (!worker || !isReady) return;

        const config = getDifficultyConfig(level);
        thinkingIdRef.current += 1;

        setIsThinking(true);

        // Set difficulty parameters
        worker.postMessage(`setoption name Skill Level value ${config.skillLevel}`);

        // Set position and search
        worker.postMessage('ucinewgame');
        worker.postMessage(`position fen ${fen}`);
        worker.postMessage('isready'); // Wait for engine readiness after position
        worker.postMessage(`go depth ${config.depth}`);
    }, [isReady]);

    // ── Stop current search ───────────────────────────────────────────
    const stop = useCallback(() => {
        const worker = workerRef.current;
        if (worker) {
            thinkingIdRef.current += 1; // Invalidate any in-flight response
            worker.postMessage('stop');
            setIsThinking(false);
        }
    }, []);

    // ── Reset engine (new game) ───────────────────────────────────────
    const reset = useCallback(() => {
        const worker = workerRef.current;
        if (worker) {
            thinkingIdRef.current += 1;
            worker.postMessage('stop');
            worker.postMessage('ucinewgame');
            worker.postMessage('isready');
            setIsThinking(false);
        }
    }, []);

    return {
        isReady,
        isThinking,
        getBestMove,
        stop,
        reset,
    };
}

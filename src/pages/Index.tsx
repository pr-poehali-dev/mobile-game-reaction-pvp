import { useState, useEffect, useRef, useCallback } from "react";
import Icon from "@/components/ui/icon";

// ─────────────── TYPES ───────────────
type Screen = "home" | "searching" | "game" | "result";
type GamePhase = "wait" | "tension" | "action" | "done";
type ResultType = "win" | "lose" | "false_start";

interface MatchResult {
  type: ResultType;
  playerTime: number;
  opponentTime: number;
  ratingChange: number;
  coinsEarned: number;
  newStreak: number;
}

// ─────────────── BOT LOGIC ───────────────
function getBotReactionTime(): number {
  const base = 200 + Math.random() * 150;
  const falseStartChance = Math.random() < 0.05;
  if (falseStartChance) return -1;
  return base;
}

function getSignalDelay(): number {
  const roll = Math.random();
  if (roll < 0.4) return 1500 + Math.random() * 1000;
  if (roll < 0.8) return 2500 + Math.random() * 1000;
  return 3500 + Math.random() * 1500;
}

// ─────────────── MAIN COMPONENT ───────────────
export default function Index() {
  const [screen, setScreen] = useState<Screen>("home");
  const [phase, setPhase] = useState<GamePhase>("wait");
  const [result, setResult] = useState<MatchResult | null>(null);
  const [rating, setRating] = useState(1000);
  const [coins, setCoins] = useState(150);
  const [streak, setStreak] = useState(0);
  const [matchCount, setMatchCount] = useState(0);

  // Tension effects state
  const [fakeFlash, setFakeFlash] = useState(false);
  const [almostGreen, setAlmostGreen] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [screenFlash, setScreenFlash] = useState<"none" | "red" | "green">("none");

  const greenTimeRef = useRef<number>(0);
  const gameActiveRef = useRef(false);
  const tensionTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const mainTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseRef = useRef<GamePhase>("wait");

  useEffect(() => { phaseRef.current = phase; }, [phase]);

  const clearAllTimers = useCallback(() => {
    tensionTimersRef.current.forEach(clearTimeout);
    tensionTimersRef.current = [];
    if (mainTimerRef.current) clearTimeout(mainTimerRef.current);
  }, []);

  // ─── TENSION EFFECTS ───
  const runTensionEffects = useCallback((totalDelay: number) => {
    const effects: ReturnType<typeof setTimeout>[] = [];

    if (Math.random() < 0.30) {
      const t = Math.random() * (totalDelay * 0.6) + 300;
      effects.push(setTimeout(() => {
        setFakeFlash(true);
        setTimeout(() => setFakeFlash(false), 60 + Math.random() * 40);
      }, t));
    }

    if (Math.random() < 0.20) {
      const t = Math.random() * (totalDelay * 0.5) + 500;
      effects.push(setTimeout(() => {
        setAlmostGreen(true);
        setTimeout(() => setAlmostGreen(false), 80 + Math.random() * 40);
      }, t));
    }

    if (Math.random() < 0.20) {
      const t = Math.random() * (totalDelay * 0.7) + 400;
      effects.push(setTimeout(() => {
        setShaking(true);
        if (navigator.vibrate) navigator.vibrate([30]);
        setTimeout(() => setShaking(false), 400);
      }, t));
    }

    if (Math.random() < 0.15) {
      const t = Math.random() * (totalDelay * 0.8) + 600;
      effects.push(setTimeout(() => {
        setFakeFlash(true);
        setTimeout(() => setFakeFlash(false), 50);
      }, t));
    }

    tensionTimersRef.current = effects;
  }, []);

  const finishMatch = useCallback((
    type: ResultType,
    playerMs: number,
    opponentMs: number,
    currentStreak: number
  ) => {
    clearAllTimers();
    gameActiveRef.current = false;
    setPhase("done");

    const isWin = type === "win";
    const ratingDelta = isWin ? 25 : -15;
    const newStreak = isWin ? currentStreak + 1 : 0;
    const streakBonus = newStreak >= 5 ? 2 : 1;
    const baseCoins = isWin ? 20 : 5;
    const earned = baseCoins * streakBonus;

    setRating(r => Math.max(0, r + ratingDelta));
    setCoins(c => c + earned);
    setStreak(newStreak);
    setMatchCount(m => m + 1);

    setResult({
      type,
      playerTime: playerMs,
      opponentTime: opponentMs,
      ratingChange: ratingDelta,
      coinsEarned: earned,
      newStreak,
    });

    setTimeout(() => {
      setScreenFlash("none");
      setScreen("result");
    }, 350);
  }, [clearAllTimers]);

  // ─── START MATCH ───
  const startMatch = useCallback(() => {
    setScreen("searching");
    setResult(null);

    setTimeout(() => {
      setScreen("game");
      setPhase("wait");
      phaseRef.current = "wait";
      setFakeFlash(false);
      setAlmostGreen(false);
      setShaking(false);
      setScreenFlash("none");
      gameActiveRef.current = true;

      const delay = getSignalDelay();
      runTensionEffects(delay);

      mainTimerRef.current = setTimeout(() => {
        if (!gameActiveRef.current) return;
        greenTimeRef.current = Date.now();
        setPhase("action");
        phaseRef.current = "action";
        setScreenFlash("green");

        const botTime = getBotReactionTime();

        if (botTime === -1) {
          setTimeout(() => {
            if (gameActiveRef.current) {
              gameActiveRef.current = false;
              finishMatch("win", 999, -1, streak);
            }
          }, 200);
        } else {
          setTimeout(() => {
            if (gameActiveRef.current) {
              gameActiveRef.current = false;
              finishMatch("lose", 9999, botTime, streak);
            }
          }, botTime);
        }

        setTimeout(() => {
          if (gameActiveRef.current) {
            gameActiveRef.current = false;
            finishMatch("lose", 5000, getBotReactionTime(), streak);
          }
        }, 3000);

      }, delay);
    }, 1200 + Math.random() * 800);
  }, [runTensionEffects, finishMatch, streak]);

  // ─── PLAYER TAP ───
  const handleGameTap = useCallback(() => {
    if (!gameActiveRef.current) return;
    const currentPhase = phaseRef.current;

    if (currentPhase === "wait" || currentPhase === "tension") {
      gameActiveRef.current = false;
      clearAllTimers();
      setScreenFlash("red");
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      setShaking(true);
      setTimeout(() => setShaking(false), 400);
      finishMatch("false_start", -1, 0, streak);
      return;
    }

    if (currentPhase === "action") {
      const reactionTime = Date.now() - greenTimeRef.current;
      if (reactionTime < 100) return;

      gameActiveRef.current = false;
      clearAllTimers();

      const botTime = 200 + Math.random() * 150;
      const type = reactionTime < botTime ? "win" : "lose";
      finishMatch(type, reactionTime, botTime, streak);
    }
  }, [finishMatch, clearAllTimers, streak]);

  useEffect(() => {
    return () => clearAllTimers();
  }, [clearAllTimers]);

  const getBgColor = () => {
    if (screenFlash === "red") return "#c0392b";
    if (screenFlash === "green") return "#00e676";
    if (phase === "action") return "#00e676";
    if (fakeFlash) return "#131313";
    if (almostGreen) return "#0d1a0d";
    return "#0f0f0f";
  };

  // ─────────────── RENDER SCREENS ───────────────

  // HOME
  if (screen === "home") {
    return (
      <div
        className="relative flex flex-col items-center justify-between h-dvh w-full px-6 py-10 overflow-hidden"
        style={{ backgroundColor: "#0f0f0f" }}
      >
        {/* Corner brackets */}
        <div className="absolute top-4 left-4 w-6 h-6 border-l-2 border-t-2" style={{ borderColor: "rgba(192,57,43,0.4)" }} />
        <div className="absolute top-4 right-4 w-6 h-6 border-r-2 border-t-2" style={{ borderColor: "rgba(192,57,43,0.4)" }} />
        <div className="absolute bottom-4 left-4 w-6 h-6 border-l-2 border-b-2" style={{ borderColor: "rgba(192,57,43,0.4)" }} />
        <div className="absolute bottom-4 right-4 w-6 h-6 border-r-2 border-b-2" style={{ borderColor: "rgba(192,57,43,0.4)" }} />

        {/* Top stats */}
        <div className="w-full flex items-center justify-between animate-fade-in">
          <div className="flex flex-col items-start gap-0.5">
            <span className="font-rubik text-[10px] tracking-widest text-white/25 uppercase">Рейтинг</span>
            <span className="font-oswald text-2xl font-bold text-white">{rating}</span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <span className="font-rubik text-[10px] tracking-widest text-white/25 uppercase">Серия</span>
            <span className="font-oswald text-2xl font-bold" style={{ color: streak > 0 ? "#f39c12" : "rgba(255,255,255,0.2)" }}>
              {streak > 0 ? `🔥 ${streak}` : "—"}
            </span>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <span className="font-rubik text-[10px] tracking-widest text-white/25 uppercase">Монеты</span>
            <span className="font-oswald text-2xl font-bold" style={{ color: "#f39c12" }}>⚡{coins}</span>
          </div>
        </div>

        {/* Hero center */}
        <div className="flex flex-col items-center gap-6">
          <div className="relative flex flex-col items-center">
            {/* Ambient glow */}
            <div
              className="absolute w-48 h-48 rounded-full blur-3xl pointer-events-none"
              style={{ backgroundColor: "#c0392b", opacity: 0.08 }}
            />
            {/* Label */}
            <div
              className="relative z-10 border px-6 py-1.5 mb-5"
              style={{ borderColor: "rgba(192,57,43,0.5)" }}
            >
              <span className="font-rubik text-[10px] tracking-[0.4em] uppercase" style={{ color: "#c0392b" }}>
                PvP · 1 НА 1
              </span>
            </div>
            {/* Title */}
            <h1
              className="relative z-10 font-oswald leading-[0.9] font-bold uppercase text-center"
              style={{ fontSize: "clamp(3.5rem, 18vw, 5.5rem)", color: "#f5f5f5", letterSpacing: "-0.02em" }}
            >
              НЕ
            </h1>
            <h1
              className="relative z-10 font-oswald leading-[0.9] font-bold uppercase text-center"
              style={{ fontSize: "clamp(3.5rem, 18vw, 5.5rem)", color: "#c0392b", letterSpacing: "-0.02em" }}
            >
              СЛОМАЙСЯ
            </h1>
            <p
              className="relative z-10 font-rubik text-sm text-center mt-5 leading-relaxed"
              style={{ color: "rgba(255,255,255,0.3)", maxWidth: "220px" }}
            >
              Нажми точно в момент сигнала.<br />Не раньше. Кто быстрее — победит.
            </p>
          </div>

          {/* Play button */}
          <button
            onClick={startMatch}
            className="relative w-full max-w-xs h-16 font-oswald text-xl font-bold tracking-[0.2em] uppercase transition-all duration-100 active:scale-95 active:brightness-90"
            style={{ backgroundColor: "#c0392b", color: "#f5f5f5" }}
          >
            ИГРАТЬ
          </button>

          {matchCount > 0 && (
            <span className="font-rubik text-xs" style={{ color: "rgba(255,255,255,0.15)" }}>
              Сыграно: {matchCount} · ELO: {rating}
            </span>
          )}
        </div>

        {/* Bottom nav */}
        <div className="flex gap-10 items-center">
          {[
            { icon: "Trophy", label: "Топ" },
            { icon: "ShoppingBag", label: "Магазин" },
            { icon: "User", label: "Профиль" },
          ].map(({ icon, label }) => (
            <button
              key={label}
              className="flex flex-col items-center gap-1.5 transition-opacity active:opacity-60"
              style={{ opacity: 0.3 }}
            >
              <Icon name={icon} size={18} style={{ color: "#f5f5f5" }} />
              <span className="font-rubik text-[9px] text-white uppercase tracking-wider">{label}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // SEARCHING
  if (screen === "searching") {
    return (
      <div
        className="flex flex-col items-center justify-center h-dvh w-full gap-10"
        style={{ backgroundColor: "#0f0f0f" }}
      >
        <div className="relative flex items-center justify-center w-24 h-24">
          {[1, 0.65, 0.4].map((scale, i) => (
            <div
              key={i}
              className="absolute rounded-full border"
              style={{
                width: `${96 * scale}px`,
                height: `${96 * scale}px`,
                borderColor: "rgba(192,57,43,0.4)",
                animation: `pulse ${1.2 + i * 0.3}s ease-in-out ${i * 0.15}s infinite`,
              }}
            />
          ))}
          <Icon name="Crosshair" size={30} style={{ color: "#c0392b" }} />
        </div>

        <div className="flex flex-col items-center gap-3">
          <span
            className="font-oswald text-xl tracking-[0.25em] uppercase"
            style={{ color: "rgba(255,255,255,0.6)" }}
          >
            Ищем соперника
          </span>
          <div className="flex gap-1.5">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  backgroundColor: "#c0392b",
                  animation: `pulse 1.2s ease-in-out ${i * 0.25}s infinite`,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // GAME
  if (screen === "game") {
    const isAction = phase === "action";
    const bgColor = getBgColor();
    const textColor = isAction ? "#0f0f0f" : "#f5f5f5";

    return (
      <div
        className={`relative flex flex-col items-center justify-center h-dvh w-full select-none ${shaking ? "animate-shake" : ""}`}
        style={{
          backgroundColor: bgColor,
          transition: isAction ? "background-color 0.07s ease-out" : "background-color 0.2s ease-out",
        }}
        onPointerDown={handleGameTap}
      >
        {/* Fake flash / almost green overlay */}
        {(fakeFlash || almostGreen) && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ backgroundColor: "#00e676", opacity: fakeFlash ? 0.07 : 0.12, zIndex: 10 }}
          />
        )}

        {/* Hint top */}
        <div
          className="absolute top-12 inset-x-0 flex justify-center"
          style={{ color: isAction ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.12)" }}
        >
          <span className="font-rubik text-[11px] uppercase tracking-widest">
            {isAction ? "нажимай" : "не трогай экран"}
          </span>
        </div>

        {/* Main text */}
        <div className="flex flex-col items-center">
          {!isAction ? (
            <div className="flex flex-col items-center gap-4">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{
                  backgroundColor: "#c0392b",
                  boxShadow: "0 0 16px rgba(192,57,43,0.9)",
                  animation: "pulse 1s ease-in-out infinite",
                }}
              />
              <span
                className="font-oswald font-bold uppercase leading-none tracking-tight"
                style={{ fontSize: "clamp(5rem, 25vw, 8rem)", color: textColor }}
              >
                ЖДИ
              </span>
              <span className="font-rubik text-sm" style={{ color: "rgba(255,255,255,0.18)" }}>
                сигнал скоро…
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center animate-number-pop">
              <span
                className="font-oswald font-bold uppercase leading-none tracking-tight"
                style={{
                  fontSize: "clamp(5rem, 25vw, 8rem)",
                  color: "#0f0f0f",
                  textShadow: "0 2px 30px rgba(0,0,0,0.15)",
                }}
              >
                ЖМИ!
              </span>
            </div>
          )}
        </div>

        {/* Hint bottom */}
        {isAction && (
          <div
            className="absolute bottom-16 inset-x-0 flex justify-center animate-fade-in"
            style={{ color: "rgba(0,0,0,0.3)" }}
          >
            <span className="font-rubik text-[11px] uppercase tracking-widest">весь экран — кнопка</span>
          </div>
        )}

        {/* Corners */}
        {["top-0 left-0 border-l-2 border-t-2", "top-0 right-0 border-r-2 border-t-2", "bottom-0 left-0 border-l-2 border-b-2", "bottom-0 right-0 border-r-2 border-b-2"].map((cls, i) => (
          <div
            key={i}
            className={`absolute w-8 h-8 ${cls}`}
            style={{ borderColor: isAction ? "rgba(0,0,0,0.15)" : "rgba(192,57,43,0.25)" }}
          />
        ))}
      </div>
    );
  }

  // RESULT
  if (screen === "result" && result) {
    const isWin = result.type === "win";
    const isFalseStart = result.type === "false_start";
    const accentColor = isWin ? "#00e676" : "#c0392b";

    const titleText = isFalseStart ? "ТЫ СЛОМАЛСЯ" : isWin ? "ТЫ ВЫДЕРЖАЛ" : "ОН ВЫДЕРЖАЛ";
    const subtitleText = isFalseStart
      ? "нажал слишком рано — фальстарт"
      : isWin
      ? `ты был быстрее на ${Math.round(result.opponentTime - result.playerTime)}мс`
      : `соперник опередил тебя`;

    return (
      <div
        className="relative flex flex-col items-center justify-between h-dvh w-full px-6 py-12 overflow-hidden"
        style={{ backgroundColor: "#0f0f0f" }}
      >
        {/* Ambient glow */}
        <div
          className="absolute top-[-60px] left-1/2 -translate-x-1/2 w-72 h-72 rounded-full blur-3xl pointer-events-none"
          style={{ backgroundColor: accentColor, opacity: 0.08 }}
        />

        <div />

        {/* Result block */}
        <div className="flex flex-col items-center gap-6 animate-result-in w-full">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: accentColor, boxShadow: `0 0 20px ${accentColor}` }}
          />

          <div className="flex flex-col items-center gap-2">
            <span
              className={`font-oswald font-bold uppercase text-center leading-none ${isWin ? "animate-win-glow" : "animate-lose-glow"}`}
              style={{ fontSize: "clamp(2.5rem, 12vw, 4rem)", color: accentColor }}
            >
              {titleText}
            </span>
            <span className="font-rubik text-sm text-center" style={{ color: "rgba(255,255,255,0.3)" }}>
              {subtitleText}
            </span>
          </div>

          {/* Time comparison */}
          {!isFalseStart && (
            <div
              className="w-full flex border"
              style={{ borderColor: "rgba(255,255,255,0.07)", backgroundColor: "rgba(255,255,255,0.02)" }}
            >
              <div className="flex-1 flex flex-col items-center gap-1 py-4">
                <span className="font-rubik text-[10px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.25)" }}>Ты</span>
                <span
                  className="font-oswald text-3xl font-bold"
                  style={{ color: isWin ? "#00e676" : "#c0392b" }}
                >
                  {result.playerTime === 9999 ? "—" : result.playerTime}
                </span>
                <span className="font-rubik text-[10px]" style={{ color: "rgba(255,255,255,0.2)" }}>мс</span>
              </div>
              <div className="w-px" style={{ backgroundColor: "rgba(255,255,255,0.07)" }} />
              <div className="flex-1 flex flex-col items-center gap-1 py-4">
                <span className="font-rubik text-[10px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.25)" }}>Соперник</span>
                <span
                  className="font-oswald text-3xl font-bold"
                  style={{ color: isWin ? "#c0392b" : "#00e676" }}
                >
                  {result.opponentTime === -1 ? "ФС" : Math.round(result.opponentTime)}
                </span>
                <span className="font-rubik text-[10px]" style={{ color: "rgba(255,255,255,0.2)" }}>мс</span>
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="flex gap-6 items-center">
            <div className="flex flex-col items-center gap-1">
              <span
                className="font-oswald text-xl font-bold"
                style={{ color: result.ratingChange > 0 ? "#00e676" : "#c0392b" }}
              >
                {result.ratingChange > 0 ? "+" : ""}{result.ratingChange}
              </span>
              <span className="font-rubik text-[10px] tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.2)" }}>рейтинг</span>
            </div>
            <div className="w-px h-8" style={{ backgroundColor: "rgba(255,255,255,0.07)" }} />
            <div className="flex flex-col items-center gap-1">
              <span className="font-oswald text-xl font-bold" style={{ color: "#f39c12" }}>+{result.coinsEarned}⚡</span>
              <span className="font-rubik text-[10px] tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.2)" }}>монеты</span>
            </div>
            {result.newStreak > 0 && (
              <>
                <div className="w-px h-8" style={{ backgroundColor: "rgba(255,255,255,0.07)" }} />
                <div className="flex flex-col items-center gap-1">
                  <span className="font-oswald text-xl font-bold" style={{ color: "#f39c12" }}>🔥{result.newStreak}</span>
                  <span className="font-rubik text-[10px] tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.2)" }}>серия</span>
                </div>
              </>
            )}
          </div>

          {result.newStreak >= 5 && (
            <div
              className="px-4 py-1.5 border font-oswald text-xs tracking-widest uppercase"
              style={{ borderColor: "#f39c12", color: "#f39c12" }}
            >
              x2 НАГРАДА · СЕРИЯ {result.newStreak}
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="flex flex-col gap-3 w-full">
          <button
            onClick={startMatch}
            className="w-full h-14 font-oswald text-lg font-bold tracking-[0.2em] uppercase transition-all active:scale-95"
            style={{ backgroundColor: accentColor, color: isWin ? "#0f0f0f" : "#f5f5f5" }}
          >
            ЕЩЁ РАЗ
          </button>
          <button
            onClick={() => setScreen("home")}
            className="w-full h-12 font-oswald text-sm tracking-[0.15em] uppercase transition-all active:scale-95"
            style={{
              backgroundColor: "transparent",
              color: "rgba(255,255,255,0.25)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            ГЛАВНЫЙ ЭКРАН
          </button>
        </div>
      </div>
    );
  }

  return null;
}

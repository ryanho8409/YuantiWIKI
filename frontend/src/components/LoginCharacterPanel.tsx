import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

export type LoginCharMood = 'idle' | 'error' | 'success';
export type LoginCharFocus = 'none' | 'username' | 'password';

type Props = {
  mood: LoginCharMood;
  focusField: LoginCharFocus;
  passwordVisible: boolean;
  reducedMotion: boolean;
};

function pupilShift(
  mouseX: number,
  mouseY: number,
  faceX: number,
  faceY: number,
  max: number,
  focusField: LoginCharFocus,
) {
  let tx = mouseX - faceX;
  let ty = mouseY - faceY;
  if (focusField === 'username') {
    tx = 180;
    // 表单区上移后：账号框更靠上，视线略抬高
    ty = -60;
  } else if (focusField === 'password') {
    tx = 140;
    // 密码框仍在下方，但比之前更紧凑，视线略回收
    ty = 45;
  }
  const len = Math.hypot(tx, ty) || 1;
  return { dx: (tx / len) * max, dy: (ty / len) * max };
}

function CharEyes({
  faceX,
  faceY,
  mouseX,
  mouseY,
  max,
  focusField,
  passwordVisible,
  charIndex,
}: {
  faceX: number;
  faceY: number;
  mouseX: number;
  mouseY: number;
  max: number;
  focusField: LoginCharFocus;
  passwordVisible: boolean;
  charIndex: number;
}) {
  const { dx, dy } = pupilShift(mouseX, mouseY, faceX, faceY, max, focusField);
  const othersHide = passwordVisible && charIndex > 0;
  const orangePeek = passwordVisible && charIndex === 0;
  const isCurious = focusField === 'username';

  return (
    <div
      className={[
        'login-char-eyes',
        isCurious ? 'login-char-eyes--curious' : '',
        othersHide ? 'login-char-eyes--squint' : '',
        orangePeek ? 'login-char-eyes--orange-peek' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-hidden
    >
      <span className="login-char-eye">
        <span className="login-char-pupil" style={{ transform: `translate(${dx}px, ${dy}px)` }} />
      </span>
      <span className="login-char-eye">
        <span className="login-char-pupil" style={{ transform: `translate(${dx}px, ${dy}px)` }} />
      </span>
    </div>
  );
}

export function LoginCharacterPanel({ mood, focusField, passwordVisible, reducedMotion }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const charRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [mouse, setMouse] = useState(() => ({
    x: typeof window !== 'undefined' ? window.innerWidth / 2 : 0,
    y: typeof window !== 'undefined' ? window.innerHeight / 2 : 0,
  }));
  const rafRef = useRef<number | null>(null);
  const [faces, setFaces] = useState<{ x: number; y: number }[]>([
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ]);
  const [pose, setPose] = useState<{ skew: number; sx: number }[]>([
    { skew: 0, sx: 1 },
    { skew: 0, sx: 1 },
    { skew: 0, sx: 1 },
    { skew: 0, sx: 1 },
  ]);

  const measureFaces = useCallback(() => {
    const next = charRefs.current.map((el, i) => {
      if (!el) return { x: 0, y: 0 };
      const r = el.getBoundingClientRect();
      /*
       * 瞳孔朝向锚点：尽量对齐“眼睛中心”
       * - 橙色半圆眼睛更靠下（top=26px, eye=18px => center≈35px）
       * - 其余角色眼睛更靠上（top≈30px, eye=18px => center≈39px）
       */
      const eyeCenterY = r.height <= 0 ? 0 : r.top + (i === 0 ? 35 : 39);
      return { x: r.left + r.width / 2, y: eyeCenterY };
    });
    setFaces(next);
  }, []);

  useLayoutEffect(() => {
    measureFaces();
  }, [measureFaces, mood, focusField, passwordVisible]);

  useEffect(() => {
    window.addEventListener('resize', measureFaces);
    return () => window.removeEventListener('resize', measureFaces);
  }, [measureFaces]);

  useEffect(() => {
    if (reducedMotion) return;
    const onMove = (e: MouseEvent) => setMouse({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, [reducedMotion]);

  useEffect(() => {
    if (reducedMotion) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const amps = [
        { skew: 1.2, sx: 0.018 }, // orange
        { skew: 2.2, sx: 0.03 }, // purple (more expressive)
        { skew: 1.8, sx: 0.022 }, // black
        { skew: 1.6, sx: 0.02 }, // yellow
      ];
      const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
      const next = faces.map((f, i) => {
        const dx = mouse.x - f.x;
        const skew = clamp((dx / 220) * amps[i]!.skew, -amps[i]!.skew, amps[i]!.skew);
        const sx = 1 + clamp((dx / 520) * amps[i]!.sx, -amps[i]!.sx, amps[i]!.sx);
        return { skew, sx };
      });
      setPose(next);
    });
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [mouse.x, mouse.y, faces, reducedMotion]);

  const maxPupil = mood === 'error' ? 2.5 : 5;

  const setCharRef = (i: number) => (el: HTMLDivElement | null) => {
    charRefs.current[i] = el;
  };

  const tilt = reducedMotion
    ? 0
    : Math.max(-6, Math.min(6, (mouse.x - (panelRef.current?.getBoundingClientRect().left ?? 0) - 160) * 0.015));

  return (
    <div className="login-char-panel" ref={panelRef} aria-hidden>
      <div
        className={[
          'login-char-stage',
          mood === 'error' ? 'login-char-stage--error' : '',
          mood === 'success' ? 'login-char-stage--success' : '',
          focusField === 'username' ? 'login-char-stage--curious' : '',
          focusField === 'password' ? 'login-char-stage--lean' : '',
          mood === 'idle' && focusField === 'none' && !passwordVisible ? 'login-char-stage--idle' : '',
          reducedMotion ? 'login-char-stage--reduced' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={reducedMotion ? undefined : { transform: `rotate(${tilt * 0.15}deg)` }}
      >
        <div className="login-char-row">
          <div className="login-char login-char--orange">
            <div
              className="login-char-pose"
              style={
                reducedMotion
                  ? undefined
                  : { transform: `skewX(${pose[0]?.skew ?? 0}deg) scaleX(${pose[0]?.sx ?? 1})` }
              }
            >
              <div ref={setCharRef(0)} className="login-char-body login-char-body--orange">
                <CharEyes
                  faceX={faces[0]?.x ?? 0}
                  faceY={faces[0]?.y ?? 0}
                  mouseX={mouse.x}
                  mouseY={mouse.y}
                  max={maxPupil}
                  focusField={focusField}
                  passwordVisible={passwordVisible}
                  charIndex={0}
                />
                <div
                  className={[
                    'login-char-mouth',
                    'login-char-mouth--orange',
                    mood === 'error' ? 'login-char-mouth--sad' : '',
                    mood === 'success' ? 'login-char-mouth--smile' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                />
              </div>
            </div>
          </div>
          <div className="login-char login-char--purple">
            <div
              className="login-char-pose"
              style={
                reducedMotion
                  ? undefined
                  : { transform: `skewX(${pose[1]?.skew ?? 0}deg) scaleX(${pose[1]?.sx ?? 1})` }
              }
            >
              <div ref={setCharRef(1)} className="login-char-body login-char-body--purple">
                <CharEyes
                  faceX={faces[1]?.x ?? 0}
                  faceY={faces[1]?.y ?? 0}
                  mouseX={mouse.x}
                  mouseY={mouse.y}
                  max={maxPupil}
                  focusField={focusField}
                  passwordVisible={passwordVisible}
                  charIndex={1}
                />
                <div
                  className={[
                    'login-char-mouth',
                    mood === 'error' ? 'login-char-mouth--sad' : '',
                    mood === 'success' ? 'login-char-mouth--smile' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                />
              </div>
            </div>
          </div>
          <div className="login-char login-char--black">
            <div
              className="login-char-pose"
              style={
                reducedMotion
                  ? undefined
                  : { transform: `skewX(${pose[2]?.skew ?? 0}deg) scaleX(${pose[2]?.sx ?? 1})` }
              }
            >
              <div ref={setCharRef(2)} className="login-char-body login-char-body--black">
                <CharEyes
                  faceX={faces[2]?.x ?? 0}
                  faceY={faces[2]?.y ?? 0}
                  mouseX={mouse.x}
                  mouseY={mouse.y}
                  max={maxPupil}
                  focusField={focusField}
                  passwordVisible={passwordVisible}
                  charIndex={2}
                />
                <div
                  className={[
                    'login-char-mouth',
                    'login-char-mouth--o',
                    mood === 'error' ? 'login-char-mouth--sad' : '',
                    mood === 'success' ? 'login-char-mouth--o-smile' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                />
              </div>
            </div>
          </div>
          <div className="login-char login-char--yellow">
            <div
              className="login-char-pose"
              style={
                reducedMotion
                  ? undefined
                  : { transform: `skewX(${pose[3]?.skew ?? 0}deg) scaleX(${pose[3]?.sx ?? 1})` }
              }
            >
              <div ref={setCharRef(3)} className="login-char-body login-char-body--yellow">
                <CharEyes
                  faceX={faces[3]?.x ?? 0}
                  faceY={faces[3]?.y ?? 0}
                  mouseX={mouse.x}
                  mouseY={mouse.y}
                  max={maxPupil}
                  focusField={focusField}
                  passwordVisible={passwordVisible}
                  charIndex={3}
                />
                <div
                  className={[
                    'login-char-mouth',
                    'login-char-mouth--flat',
                    mood === 'error' ? 'login-char-mouth--sad' : '',
                    mood === 'success' ? 'login-char-mouth--flat-smile' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

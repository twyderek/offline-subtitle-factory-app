import {Video} from '@remotion/media';
import {
  AbsoluteFill,
  Composition,
  Easing,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

const FPS = 30;
const DURATION_IN_FRAMES = 183;

export const SplashAnimation: React.FC = () => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();

  const copyOpacity = interpolate(frame, [8, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const copyOffset = interpolate(frame, [8, 30], [24, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const progress = interpolate(frame, [0, durationInFrames - 1], [-36, 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.45, 0, 0.55, 1),
  });
  const dotCount = Math.floor(frame / 12) % 4;

  return (
    <AbsoluteFill style={{backgroundColor: '#ffffff', fontFamily: '"Noto Sans TC", "Microsoft JhengHei", sans-serif'}}>
      <Video
        src={staticFile('animated-emblem.mp4')}
        muted
        objectFit="cover"
        style={{width: '100%', height: '100%'}}
      />

      <AbsoluteFill
        style={{
          justifyContent: 'flex-end',
          alignItems: 'center',
          padding: '0 120px 88px',
          background: 'linear-gradient(180deg, rgba(255,255,255,0) 52%, rgba(255,255,255,0.9) 73%, #ffffff 100%)',
        }}
      >
        <div
          style={{
            width: 880,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            opacity: copyOpacity,
            translate: `0 ${copyOffset}px`,
          }}
        >
          <div style={{color: '#102a56', fontSize: 54, fontWeight: 800, letterSpacing: 7}}>
            離線字幕工廠
          </div>
          <div style={{marginTop: 9, color: '#1657b8', fontSize: 25, fontWeight: 650, letterSpacing: 6}}>
            OFFLINE SUBTITLE FACTORY
          </div>
          <div style={{marginTop: 28, color: '#425d82', fontSize: 23, fontWeight: 600, letterSpacing: 1}}>
            正在啟動離線字幕服務{'·'.repeat(dotCount)}
          </div>
          <div style={{marginTop: 5, color: '#7a8ea9', fontSize: 17, fontWeight: 500, letterSpacing: 1.2}}>
            Starting offline subtitle services
          </div>
          <div
            style={{
              width: 560,
              height: 7,
              marginTop: 24,
              overflow: 'hidden',
              borderRadius: 99,
              backgroundColor: '#dbe6f5',
            }}
          >
            <div
              style={{
                width: '36%',
                height: '100%',
                borderRadius: 99,
                background: 'linear-gradient(90deg, #0f47aa, #2f80ed, #78b7ff)',
                boxShadow: '0 0 20px rgba(47,128,237,0.45)',
                translate: `${progress}% 0`,
              }}
            />
          </div>
          <div style={{marginTop: 17, display: 'flex', alignItems: 'center', gap: 10, color: '#6f829e', fontSize: 15}}>
            <div style={{width: 9, height: 9, borderRadius: '50%', backgroundColor: '#22ad6b'}} />
            本機離線處理 · Private on-device processing
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const MyComposition = () => {
  return (
    <Composition
      id="OfflineSubtitleSplash"
      component={SplashAnimation}
      durationInFrames={DURATION_IN_FRAMES}
      fps={FPS}
      width={1920}
      height={1080}
    />
  );
};

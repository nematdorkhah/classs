export default function LoadingScreen({ message = 'در حال بارگذاری اطلاعات کلاس...' }: { message?: string }) {
  return (
    <div
      style={{
        minHeight: '75vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '30px 20px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: 90,
          height: 90,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 20,
        }}
      >
        {/* Pulsing glow circles */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(37, 99, 235, 0.25) 0%, rgba(37, 99, 235, 0) 70%)',
            animation: 'pulseGlow 2s ease-in-out infinite',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: -4,
            borderRadius: '50%',
            border: '3px solid transparent',
            borderTopColor: '#2563EB',
            borderRightColor: '#60A5FA',
            animation: 'spinSmooth 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite',
          }}
        />

        {/* Central Icon */}
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)',
            border: '2px solid #2563EB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 30,
            boxShadow: '0 8px 24px rgba(37, 99, 235, 0.25)',
            animation: 'floatY 2.5s ease-in-out infinite',
          }}
        >
          ✨
        </div>
      </div>

      <h3
        style={{
          margin: '0 0 8px 0',
          fontSize: 16,
          fontWeight: 900,
          color: '#0F172A',
          letterSpacing: '-0.02em',
        }}
      >
        {message}
      </h3>

      <div
        style={{
          width: 140,
          height: 5,
          background: '#E2E8F0',
          borderRadius: 999,
          overflow: 'hidden',
          position: 'relative',
          marginTop: 10,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: '45%',
            background: 'linear-gradient(90deg, #2563EB 0%, #38BDF8 100%)',
            borderRadius: 999,
            animation: 'shimmerBar 1.5s ease-in-out infinite',
          }}
        />
      </div>
    </div>
  )
}

export default function DashboardLoading() {
  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF8' }}>
      <style>{`
        @keyframes skel-pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        .skel { background: #E8E5DE; border-radius: 4px; animation: skel-pulse 1.6s ease-in-out infinite; }
        .skel-green { background: #BBF7D0; border-radius: 4px; animation: skel-pulse 1.6s ease-in-out infinite; }
        .skel-yellow { background: #FDE68A; border-radius: 4px; animation: skel-pulse 1.6s ease-in-out infinite; }
      `}</style>

      {/* Header placeholder */}
      <div style={{ height: 48, background: 'rgba(255,255,255,0.85)', borderBottom: '0.5px solid #E8E5DE' }} />

      <main style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 24px' }}>
        {/* Title */}
        <div style={{ marginBottom: 28 }}>
          <div className="skel" style={{ height: 20, width: 110, marginBottom: 8 }} />
          <div className="skel" style={{ height: 12, width: 220 }} />
        </div>

        {/* KPI cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} style={{ background: '#FFFFFF', border: '0.5px solid #E8E5DE', borderRadius: 10, padding: '20px 20px 18px' }}>
              <div className="skel" style={{ height: 12, width: '65%', marginBottom: 14 }} />
              <div className="skel" style={{ height: 30, width: '40%' }} />
            </div>
          ))}
        </div>

        {/* Two columns */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 20, alignItems: 'flex-start' }}>
          {/* Left */}
          <div style={{ flex: '0 0 60%', background: '#FFFFFF', border: '0.5px solid #E8E5DE', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '0.5px solid #E8E5DE', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="skel" style={{ height: 14, width: 140 }} />
              <div className="skel" style={{ height: 12, width: 70 }} />
            </div>
            <div style={{ padding: '8px 0' }}>
              {[...Array(6)].map((_, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 20px', alignItems: 'center', borderBottom: i < 5 ? '0.5px solid #F4F4F5' : undefined }}>
                  <div className="skel" style={{ height: 12, width: 32, flexShrink: 0 }} />
                  <div className="skel" style={{ height: 12, flex: 1, maxWidth: 120 }} />
                  <div className="skel" style={{ height: 12, width: 80 }} />
                  <div className="skel" style={{ height: 20, width: 64, borderRadius: 4 }} />
                  <div className="skel" style={{ height: 4, width: 72, borderRadius: 2 }} />
                </div>
              ))}
            </div>
            <div style={{ padding: '12px 20px', borderTop: '0.5px solid #E8E5DE' }}>
              <div className="skel" style={{ height: 12, width: 180 }} />
            </div>
          </div>

          {/* Right */}
          <div style={{ flex: '0 0 40%', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: '#F0FDF4', border: '0.5px solid #BBF7D0', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '0.5px solid #BBF7D0' }}>
                <div className="skel-green" style={{ height: 14, width: '55%' }} />
              </div>
              {[...Array(4)].map((_, i) => (
                <div key={i} style={{ padding: '10px 18px', display: 'flex', gap: 10, alignItems: 'center', borderTop: i > 0 ? '0.5px solid #BBF7D0' : undefined }}>
                  <div className="skel-green" style={{ height: 11, width: 28, flexShrink: 0 }} />
                  <div className="skel-green" style={{ height: 11, flex: 1 }} />
                  <div className="skel-green" style={{ height: 11, width: 50 }} />
                </div>
              ))}
            </div>

            <div style={{ background: '#FFFBEB', border: '0.5px solid #FDE68A', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '0.5px solid #FDE68A' }}>
                <div className="skel-yellow" style={{ height: 14, width: '50%' }} />
              </div>
              {[...Array(4)].map((_, i) => (
                <div key={i} style={{ padding: '10px 18px', display: 'flex', gap: 10, alignItems: 'center', borderTop: i > 0 ? '0.5px solid #FDE68A' : undefined }}>
                  <div className="skel-yellow" style={{ height: 11, width: 28, flexShrink: 0 }} />
                  <div className="skel-yellow" style={{ height: 11, flex: 1 }} />
                  <div className="skel-yellow" style={{ height: 11, width: 24 }} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="skel" style={{ height: 56, borderRadius: 8 }} />
      </main>
    </div>
  )
}

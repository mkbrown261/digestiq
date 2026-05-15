import { Hono } from 'hono'
import { serveStatic } from 'hono/cloudflare-workers'

const app = new Hono()

// Serve static assets
app.use('/static/*', serveStatic({ root: './public' }))
app.use('/favicon.svg', serveStatic({ root: './public', path: 'favicon.svg' }))

// ── API Routes ──────────────────────────────────────────────────────────────

app.get('/api/health', (c) => c.json({ status: 'ok', platform: 'DigestIQ', version: '1.0.0' }))

app.get('/api/insights/demo', (c) => {
  return c.json({
    session: {
      id: 'sess_demo_001',
      date: new Date().toISOString(),
      duration: '6h 42m',
      transitScore: 87,
      phAvg: 6.4,
      tempAvg: 37.1,
      motilityIndex: 74,
    },
    insights: [
      {
        type: 'transit',
        title: 'Smooth Transit Rhythm',
        body: 'Your digestive transit completed in the upper range of your personal baseline — consistent with your Tuesday pattern.',
        tag: 'Rhythm',
        icon: 'wave',
      },
      {
        type: 'ph',
        title: 'Balanced Gastric Environment',
        body: 'pH levels across your upper GI segment remained stable throughout the session, correlating with your reported meal timing.',
        tag: 'Environment',
        icon: 'flask',
      },
      {
        type: 'food',
        title: 'Meal Response: Avocado + Salmon',
        body: 'This meal combination correlated with a 12% faster early-transit phase compared to your 30-day average.',
        tag: 'Food Response',
        icon: 'leaf',
      },
      {
        type: 'trend',
        title: '28-Day Consistency Score',
        body: 'Your digestive rhythm consistency has improved 18% over the past 4 weeks. Hydration and sleep patterns appear to be contributing factors.',
        tag: 'Trend',
        icon: 'trending-up',
      },
    ],
    foodCorrelations: [
      { food: 'Avocado', score: 92, trend: 'up' },
      { food: 'Coffee (2 cups)', score: 68, trend: 'neutral' },
      { food: 'Cruciferous Veg', score: 55, trend: 'down' },
      { food: 'Greek Yogurt', score: 88, trend: 'up' },
      { food: 'Red Wine', score: 44, trend: 'down' },
    ],
    timeline: [
      { time: '0:00', region: 'Esophagus', ph: 7.2, temp: 36.9, event: 'Capsule activated' },
      { time: '0:04', region: 'Stomach Entry', ph: 4.1, temp: 37.0, event: 'Gastric entry detected' },
      { time: '1:20', region: 'Stomach', ph: 2.8, temp: 37.2, event: 'Peak acid environment' },
      { time: '2:45', region: 'Duodenum', ph: 6.1, temp: 37.1, event: 'Small intestine transition' },
      { time: '4:10', region: 'Jejunum', ph: 6.8, temp: 37.0, event: 'Midpoint transit' },
      { time: '5:30', region: 'Ileum', ph: 7.4, temp: 36.8, event: 'Terminal ileum' },
      { time: '6:42', region: 'Cecum', ph: 7.8, temp: 36.7, event: 'Large intestine entry' },
    ],
  })
})

// ── Page Routes ─────────────────────────────────────────────────────────────

app.get('/', (c) => c.html(homePage()))
app.get('/platform', (c) => c.html(platformPage()))
app.get('/science', (c) => c.html(sciencePage()))
app.get('/architecture', (c) => c.html(architecturePage()))
app.get('/dashboard', (c) => c.html(dashboardPage()))
app.get('/insights', (c) => c.html(insightsPage()))

export default app

// ── Shared Layout ────────────────────────────────────────────────────────────

function layout(title: string, body: string, activeNav: string = '') {
  return `<!DOCTYPE html>
<html lang="en" class="scroll-smooth">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} — DigestIQ</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.0/css/all.min.css" />
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
    * { font-family: 'Inter', sans-serif; }

    :root {
      --brand-teal: #0ABFBC;
      --brand-indigo: #4F46E5;
      --brand-violet: #7C3AED;
      --brand-emerald: #059669;
      --brand-amber: #D97706;
      --surface-dark: #0A0F1E;
      --surface-card: #0F172A;
      --surface-border: rgba(255,255,255,0.08);
    }

    body { background: var(--surface-dark); color: #E2E8F0; }

    .glass {
      background: rgba(15, 23, 42, 0.7);
      backdrop-filter: blur(20px);
      border: 1px solid var(--surface-border);
    }

    .glass-light {
      background: rgba(255,255,255,0.04);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255,255,255,0.07);
    }

    .gradient-brand {
      background: linear-gradient(135deg, #0ABFBC 0%, #4F46E5 50%, #7C3AED 100%);
    }

    .gradient-text {
      background: linear-gradient(135deg, #0ABFBC 0%, #818CF8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .gradient-text-warm {
      background: linear-gradient(135deg, #F59E0B 0%, #EF4444 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .glow-teal { box-shadow: 0 0 40px rgba(10, 191, 188, 0.2); }
    .glow-indigo { box-shadow: 0 0 40px rgba(79, 70, 229, 0.25); }
    .glow-violet { box-shadow: 0 0 60px rgba(124, 58, 237, 0.15); }

    .capsule-glow {
      animation: capsuleGlow 3s ease-in-out infinite alternate;
    }
    @keyframes capsuleGlow {
      from { filter: drop-shadow(0 0 12px rgba(10,191,188,0.4)); }
      to   { filter: drop-shadow(0 0 28px rgba(79,70,229,0.6)); }
    }

    .pulse-dot {
      animation: pulseDot 2s ease-in-out infinite;
    }
    @keyframes pulseDot {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(0.85); }
    }

    .orbit {
      animation: orbit 8s linear infinite;
    }
    @keyframes orbit {
      from { transform: rotate(0deg) translateX(80px) rotate(0deg); }
      to   { transform: rotate(360deg) translateX(80px) rotate(-360deg); }
    }

    .float {
      animation: float 6s ease-in-out infinite;
    }
    @keyframes float {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-12px); }
    }

    .scan-line {
      animation: scanLine 3s linear infinite;
      background: linear-gradient(180deg, transparent 0%, rgba(10,191,188,0.3) 50%, transparent 100%);
    }
    @keyframes scanLine {
      from { transform: translateY(-100%); }
      to   { transform: translateY(400%); }
    }

    .data-stream {
      animation: dataStream 20s linear infinite;
    }
    @keyframes dataStream {
      from { transform: translateY(0); }
      to   { transform: translateY(-50%); }
    }

    .nav-link {
      position: relative;
      transition: color 0.2s;
    }
    .nav-link.active { color: #0ABFBC; }
    .nav-link::after {
      content: '';
      position: absolute;
      bottom: -2px;
      left: 0;
      width: 0;
      height: 2px;
      background: linear-gradient(90deg, #0ABFBC, #4F46E5);
      transition: width 0.3s;
    }
    .nav-link:hover::after, .nav-link.active::after { width: 100%; }

    .metric-card {
      transition: transform 0.3s, box-shadow 0.3s;
    }
    .metric-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 20px 60px rgba(10,191,188,0.15);
    }

    .timeline-node {
      position: relative;
    }
    .timeline-node::before {
      content: '';
      position: absolute;
      left: 15px;
      top: 32px;
      bottom: -8px;
      width: 1px;
      background: linear-gradient(180deg, rgba(10,191,188,0.5), transparent);
    }
    .timeline-node:last-child::before { display: none; }

    .ph-bar {
      background: linear-gradient(90deg, #EF4444 0%, #F59E0B 30%, #10B981 60%, #3B82F6 85%, #7C3AED 100%);
      border-radius: 9999px;
    }

    .scrollbar-hide::-webkit-scrollbar { display: none; }
    .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }

    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(30px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .fade-in-up { animation: fadeInUp 0.7s ease forwards; }
    .delay-1 { animation-delay: 0.1s; opacity: 0; }
    .delay-2 { animation-delay: 0.2s; opacity: 0; }
    .delay-3 { animation-delay: 0.3s; opacity: 0; }
    .delay-4 { animation-delay: 0.4s; opacity: 0; }
    .delay-5 { animation-delay: 0.5s; opacity: 0; }
    .delay-6 { animation-delay: 0.6s; opacity: 0; }

    .bg-grid {
      background-image:
        linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
      background-size: 40px 40px;
    }

    .noise::before {
      content: '';
      position: fixed;
      inset: 0;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E");
      pointer-events: none;
      z-index: 1;
    }

    .section-divider {
      background: linear-gradient(90deg, transparent, rgba(10,191,188,0.3), transparent);
      height: 1px;
    }

    .btn-primary {
      background: linear-gradient(135deg, #0ABFBC, #4F46E5);
      color: white;
      padding: 0.75rem 2rem;
      border-radius: 0.75rem;
      font-weight: 600;
      transition: all 0.3s;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      text-decoration: none;
    }
    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 40px rgba(79,70,229,0.4);
    }

    .btn-ghost {
      background: transparent;
      color: #94A3B8;
      padding: 0.75rem 2rem;
      border-radius: 0.75rem;
      font-weight: 500;
      border: 1px solid rgba(255,255,255,0.1);
      transition: all 0.3s;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      text-decoration: none;
    }
    .btn-ghost:hover {
      border-color: rgba(10,191,188,0.4);
      color: #0ABFBC;
    }

    .insight-card {
      border-left: 3px solid;
      transition: all 0.3s;
    }
    .insight-card:hover { transform: translateX(4px); }
    .insight-transit { border-color: #0ABFBC; }
    .insight-ph { border-color: #F59E0B; }
    .insight-food { border-color: #10B981; }
    .insight-trend { border-color: #818CF8; }

    .badge {
      font-size: 0.65rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      padding: 0.2rem 0.6rem;
      border-radius: 9999px;
    }
  </style>
</head>
<body class="bg-grid noise min-h-screen">

  <!-- Navigation -->
  <nav class="fixed top-0 left-0 right-0 z-50 glass border-b border-white/5">
    <div class="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
      <a href="/" class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg gradient-brand flex items-center justify-center">
          <i class="fas fa-circle-nodes text-white text-sm"></i>
        </div>
        <span class="text-white font-bold text-lg tracking-tight">Digest<span class="gradient-text">IQ</span></span>
      </a>
      <div class="hidden md:flex items-center gap-8">
        <a href="/" class="nav-link text-sm text-slate-400 hover:text-white ${activeNav === 'home' ? 'active' : ''}">Home</a>
        <a href="/platform" class="nav-link text-sm text-slate-400 hover:text-white ${activeNav === 'platform' ? 'active' : ''}">Platform</a>
        <a href="/science" class="nav-link text-sm text-slate-400 hover:text-white ${activeNav === 'science' ? 'active' : ''}">Science</a>
        <a href="/architecture" class="nav-link text-sm text-slate-400 hover:text-white ${activeNav === 'architecture' ? 'active' : ''}">Architecture</a>
        <a href="/insights" class="nav-link text-sm text-slate-400 hover:text-white ${activeNav === 'insights' ? 'active' : ''}">AI Insights</a>
      </div>
      <div class="flex items-center gap-3">
        <a href="/dashboard" class="btn-primary text-sm py-2 px-5">
          <i class="fas fa-chart-line text-xs"></i> Dashboard
        </a>
      </div>
    </div>
  </nav>

  <!-- Page Content -->
  <main class="pt-20">
    ${body}
  </main>

  <!-- Footer -->
  <footer class="mt-32 border-t border-white/5 py-16">
    <div class="max-w-7xl mx-auto px-6">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
        <div>
          <div class="flex items-center gap-3 mb-4">
            <div class="w-8 h-8 rounded-lg gradient-brand flex items-center justify-center">
              <i class="fas fa-circle-nodes text-white text-sm"></i>
            </div>
            <span class="text-white font-bold text-lg">Digest<span class="gradient-text">IQ</span></span>
          </div>
          <p class="text-slate-500 text-sm leading-relaxed">The world's first personal digestive intelligence platform. Wellness observability for your gut.</p>
          <div class="flex gap-3 mt-5">
            <a href="#" class="w-8 h-8 glass-light rounded-lg flex items-center justify-center text-slate-400 hover:text-teal-400 transition-colors"><i class="fab fa-twitter text-xs"></i></a>
            <a href="#" class="w-8 h-8 glass-light rounded-lg flex items-center justify-center text-slate-400 hover:text-teal-400 transition-colors"><i class="fab fa-linkedin text-xs"></i></a>
            <a href="#" class="w-8 h-8 glass-light rounded-lg flex items-center justify-center text-slate-400 hover:text-teal-400 transition-colors"><i class="fab fa-github text-xs"></i></a>
          </div>
        </div>
        <div>
          <h4 class="text-white font-semibold text-sm mb-4">Platform</h4>
          <ul class="space-y-2">
            <li><a href="/platform" class="text-slate-500 text-sm hover:text-teal-400 transition-colors">How It Works</a></li>
            <li><a href="/dashboard" class="text-slate-500 text-sm hover:text-teal-400 transition-colors">Dashboard Demo</a></li>
            <li><a href="/insights" class="text-slate-500 text-sm hover:text-teal-400 transition-colors">AI Insights</a></li>
            <li><a href="/science" class="text-slate-500 text-sm hover:text-teal-400 transition-colors">The Science</a></li>
          </ul>
        </div>
        <div>
          <h4 class="text-white font-semibold text-sm mb-4">Architecture</h4>
          <ul class="space-y-2">
            <li><a href="/architecture" class="text-slate-500 text-sm hover:text-teal-400 transition-colors">System Design</a></li>
            <li><a href="/architecture#data" class="text-slate-500 text-sm hover:text-teal-400 transition-colors">Data Architecture</a></li>
            <li><a href="/architecture#ai" class="text-slate-500 text-sm hover:text-teal-400 transition-colors">AI Engine</a></li>
            <li><a href="/architecture#security" class="text-slate-500 text-sm hover:text-teal-400 transition-colors">Security</a></li>
          </ul>
        </div>
        <div>
          <h4 class="text-white font-semibold text-sm mb-4">Company</h4>
          <ul class="space-y-2">
            <li><a href="#" class="text-slate-500 text-sm hover:text-teal-400 transition-colors">About</a></li>
            <li><a href="#" class="text-slate-500 text-sm hover:text-teal-400 transition-colors">Research</a></li>
            <li><a href="#" class="text-slate-500 text-sm hover:text-teal-400 transition-colors">Careers</a></li>
            <li><a href="#" class="text-slate-500 text-sm hover:text-teal-400 transition-colors">Press</a></li>
          </ul>
        </div>
      </div>
      <div class="section-divider mb-8"></div>
      <div class="flex flex-col md:flex-row justify-between items-center gap-4">
        <p class="text-slate-600 text-xs">© 2026 DigestIQ. All rights reserved.</p>
        <p class="text-slate-700 text-xs max-w-lg text-center">
          DigestIQ is a consumer wellness observability platform. It is not a medical device and does not diagnose, treat, cure, or prevent any disease or condition. Always consult a qualified healthcare professional.
        </p>
        <div class="flex gap-4">
          <a href="#" class="text-slate-600 text-xs hover:text-slate-400">Privacy</a>
          <a href="#" class="text-slate-600 text-xs hover:text-slate-400">Terms</a>
          <a href="#" class="text-slate-600 text-xs hover:text-slate-400">Compliance</a>
        </div>
      </div>
    </div>
  </footer>

  <script>
    // Mobile nav toggle
    document.addEventListener('DOMContentLoaded', () => {
      // Animate elements on scroll
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(el => {
          if (el.isIntersecting) {
            el.target.style.opacity = '1';
            el.target.style.transform = 'translateY(0)';
          }
        });
      }, { threshold: 0.1 });

      document.querySelectorAll('.fade-in-up').forEach(el => observer.observe(el));
    });
  </script>
</body>
</html>`
}

// ── HOME PAGE ────────────────────────────────────────────────────────────────

function homePage(): string {
  const body = `
  <!-- Hero -->
  <section class="relative min-h-screen flex items-center justify-center overflow-hidden px-6">

    <!-- Background orbs -->
    <div class="absolute inset-0 overflow-hidden pointer-events-none">
      <div class="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-10" style="background: radial-gradient(circle, #0ABFBC, transparent); filter: blur(80px);"></div>
      <div class="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full opacity-10" style="background: radial-gradient(circle, #7C3AED, transparent); filter: blur(80px);"></div>
      <div class="absolute top-1/2 left-1/2 w-64 h-64 rounded-full opacity-5" style="background: radial-gradient(circle, #4F46E5, transparent); filter: blur(60px); transform: translate(-50%,-50%);"></div>
    </div>

    <div class="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center py-24">

      <!-- Left: Copy -->
      <div>
        <div class="inline-flex items-center gap-2 badge bg-teal-950 text-teal-400 border border-teal-800 mb-6 fade-in-up delay-1">
          <span class="w-1.5 h-1.5 rounded-full bg-teal-400 pulse-dot"></span>
          Wellness Intelligence Platform · v1.0
        </div>

        <h1 class="text-5xl lg:text-7xl font-black text-white leading-tight mb-6 fade-in-up delay-2">
          The Fitbit for<br/>
          <span class="gradient-text">Your Gut</span>
        </h1>

        <p class="text-xl text-slate-400 leading-relaxed mb-8 max-w-lg fade-in-up delay-3">
          DigestIQ is the world's first personal digestive intelligence platform — combining an ingestible smart capsule, AI pattern analysis, and longitudinal gut observability into one elegant experience.
        </p>

        <div class="flex flex-wrap gap-4 mb-12 fade-in-up delay-4">
          <a href="/platform" class="btn-primary">
            <i class="fas fa-play text-xs"></i> Explore Platform
          </a>
          <a href="/dashboard" class="btn-ghost">
            <i class="fas fa-chart-line text-xs"></i> Live Dashboard
          </a>
        </div>

        <!-- Trust signals -->
        <div class="flex flex-wrap gap-6 fade-in-up delay-5">
          <div class="flex items-center gap-2 text-slate-500 text-sm">
            <i class="fas fa-shield-halved text-teal-500"></i>
            <span>HIPAA-aware architecture</span>
          </div>
          <div class="flex items-center gap-2 text-slate-500 text-sm">
            <i class="fas fa-lock text-teal-500"></i>
            <span>Zero-trust security</span>
          </div>
          <div class="flex items-center gap-2 text-slate-500 text-sm">
            <i class="fas fa-user-doctor text-teal-500"></i>
            <span>Wellness, not diagnosis</span>
          </div>
        </div>
      </div>

      <!-- Right: Capsule visualization -->
      <div class="flex items-center justify-center fade-in-up delay-3">
        <div class="relative w-80 h-80">

          <!-- Outer orbital ring -->
          <div class="absolute inset-0 rounded-full border border-teal-500/20"></div>
          <div class="absolute inset-4 rounded-full border border-indigo-500/15"></div>

          <!-- Orbiting data points -->
          <div class="absolute inset-0 flex items-center justify-center">
            <div style="position:absolute; animation: orbit 8s linear infinite;">
              <div class="w-3 h-3 rounded-full bg-teal-400 shadow-lg" style="box-shadow:0 0 12px #0ABFBC;"></div>
            </div>
            <div style="position:absolute; animation: orbit 12s linear infinite reverse;">
              <div class="w-2 h-2 rounded-full bg-indigo-400" style="box-shadow:0 0 8px #4F46E5;"></div>
            </div>
            <div style="position:absolute; animation: orbit 6s linear infinite; transform-origin:center;">
              <div class="absolute w-2 h-2 rounded-full bg-violet-400" style="transform: translateX(100px); box-shadow:0 0 8px #7C3AED;"></div>
            </div>
          </div>

          <!-- Center capsule SVG -->
          <div class="absolute inset-0 flex items-center justify-center float capsule-glow">
            <svg width="100" height="200" viewBox="0 0 100 200" fill="none" xmlns="http://www.w3.org/2000/svg">
              <!-- Capsule body -->
              <defs>
                <linearGradient id="capGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stop-color="#0ABFBC"/>
                  <stop offset="100%" stop-color="#4F46E5"/>
                </linearGradient>
                <linearGradient id="capGrad2" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stop-color="#7C3AED"/>
                  <stop offset="100%" stop-color="#0ABFBC"/>
                </linearGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="3" result="blur"/>
                  <feComposite in="SourceGraphic" in2="blur" operator="over"/>
                </filter>
              </defs>
              <!-- Top half (teal) -->
              <path d="M20 100 Q20 20 50 20 Q80 20 80 100 Z" fill="url(#capGrad)" opacity="0.9"/>
              <!-- Bottom half (violet) -->
              <path d="M20 100 Q20 180 50 180 Q80 180 80 100 Z" fill="url(#capGrad2)" opacity="0.9"/>
              <!-- Glass shine -->
              <path d="M28 60 Q32 35 50 30" stroke="rgba(255,255,255,0.4)" stroke-width="2" stroke-linecap="round"/>
              <!-- Center seam -->
              <line x1="20" y1="100" x2="80" y2="100" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
              <!-- Inner glow dots (sensors) -->
              <circle cx="50" cy="75" r="4" fill="rgba(255,255,255,0.6)" filter="url(#glow)"/>
              <circle cx="42" cy="88" r="2" fill="rgba(10,191,188,0.9)"/>
              <circle cx="58" cy="88" r="2" fill="rgba(10,191,188,0.9)"/>
              <circle cx="50" cy="125" r="4" fill="rgba(255,255,255,0.5)" filter="url(#glow)"/>
              <circle cx="42" cy="113" r="2" fill="rgba(124,58,237,0.9)"/>
              <circle cx="58" cy="113" r="2" fill="rgba(124,58,237,0.9)"/>
            </svg>
          </div>

          <!-- Data readout cards around capsule -->
          <div class="absolute top-4 right-0 glass-light rounded-xl p-3 text-xs">
            <div class="text-slate-400 mb-1">pH Level</div>
            <div class="text-teal-400 font-bold text-lg">6.4</div>
          </div>
          <div class="absolute bottom-8 left-0 glass-light rounded-xl p-3 text-xs">
            <div class="text-slate-400 mb-1">Transit</div>
            <div class="text-indigo-400 font-bold text-lg">6h 42m</div>
          </div>
          <div class="absolute top-1/2 right-2 glass-light rounded-xl p-3 text-xs" style="transform:translateY(-50%)">
            <div class="text-slate-400 mb-1">Temp</div>
            <div class="text-violet-400 font-bold text-lg">37.1°</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Scroll indicator -->
    <div class="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-slate-600 text-xs">
      <span>Scroll to explore</span>
      <div class="w-px h-8 bg-gradient-to-b from-slate-600 to-transparent"></div>
    </div>
  </section>

  <!-- Stats Bar -->
  <section class="py-12 border-y border-white/5">
    <div class="max-w-7xl mx-auto px-6">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-8">
        <div class="text-center fade-in-up delay-1">
          <div class="text-4xl font-black gradient-text mb-2">12K+</div>
          <div class="text-slate-500 text-sm">Digestive Sessions</div>
        </div>
        <div class="text-center fade-in-up delay-2">
          <div class="text-4xl font-black gradient-text mb-2">2.4M</div>
          <div class="text-slate-500 text-sm">Data Points Captured</div>
        </div>
        <div class="text-center fade-in-up delay-3">
          <div class="text-4xl font-black gradient-text mb-2">94%</div>
          <div class="text-slate-500 text-sm">AI Insight Accuracy</div>
        </div>
        <div class="text-center fade-in-up delay-4">
          <div class="text-4xl font-black gradient-text mb-2">6h</div>
          <div class="text-slate-500 text-sm">Avg. Transit Tracked</div>
        </div>
      </div>
    </div>
  </section>

  <!-- Features Grid -->
  <section class="py-24 px-6">
    <div class="max-w-7xl mx-auto">
      <div class="text-center mb-16 fade-in-up delay-1">
        <div class="badge bg-indigo-950 text-indigo-400 border border-indigo-800 mb-4 inline-block">Core Platform</div>
        <h2 class="text-4xl font-black text-white mb-4">Three Layers of Intelligence</h2>
        <p class="text-slate-400 max-w-2xl mx-auto">From hardware to insight — DigestIQ is a full-stack wellness observability system built for the gut.</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">

        <!-- Capsule -->
        <div class="glass-light rounded-2xl p-8 metric-card fade-in-up delay-2">
          <div class="w-14 h-14 rounded-2xl mb-6 flex items-center justify-center" style="background: linear-gradient(135deg, rgba(10,191,188,0.2), rgba(79,70,229,0.2));">
            <i class="fas fa-capsules text-teal-400 text-xl"></i>
          </div>
          <div class="badge bg-teal-950 text-teal-400 border border-teal-800 mb-4 inline-block">Layer 1</div>
          <h3 class="text-xl font-bold text-white mb-3">Smart Capsule</h3>
          <p class="text-slate-400 text-sm leading-relaxed mb-5">An ultra-miniaturized ingestible sensor platform capturing pH, temperature, motion, and internal imagery — naturally transiting your entire GI tract.</p>
          <ul class="space-y-2 text-sm text-slate-400">
            <li class="flex items-center gap-2"><i class="fas fa-check text-teal-500 text-xs"></i> Micro-camera system</li>
            <li class="flex items-center gap-2"><i class="fas fa-check text-teal-500 text-xs"></i> pH + temperature biosensors</li>
            <li class="flex items-center gap-2"><i class="fas fa-check text-teal-500 text-xs"></i> BLE wireless transmission</li>
            <li class="flex items-center gap-2"><i class="fas fa-check text-teal-500 text-xs"></i> Safe, natural egress</li>
          </ul>
        </div>

        <!-- AI Engine -->
        <div class="glass-light rounded-2xl p-8 metric-card fade-in-up delay-3" style="border-color: rgba(79,70,229,0.2);">
          <div class="w-14 h-14 rounded-2xl mb-6 flex items-center justify-center" style="background: linear-gradient(135deg, rgba(79,70,229,0.2), rgba(124,58,237,0.2));">
            <i class="fas fa-brain text-indigo-400 text-xl"></i>
          </div>
          <div class="badge bg-indigo-950 text-indigo-400 border border-indigo-800 mb-4 inline-block">Layer 2</div>
          <h3 class="text-xl font-bold text-white mb-3">AI Intelligence Engine</h3>
          <p class="text-slate-400 text-sm leading-relaxed mb-5">A multi-model AI system that interprets sensor streams, identifies behavioral patterns, maps food correlations, and generates personalized wellness narratives.</p>
          <ul class="space-y-2 text-sm text-slate-400">
            <li class="flex items-center gap-2"><i class="fas fa-check text-indigo-500 text-xs"></i> Sensor fusion pipeline</li>
            <li class="flex items-center gap-2"><i class="fas fa-check text-indigo-500 text-xs"></i> Longitudinal gut profiling</li>
            <li class="flex items-center gap-2"><i class="fas fa-check text-indigo-500 text-xs"></i> Food response correlation</li>
            <li class="flex items-center gap-2"><i class="fas fa-check text-indigo-500 text-xs"></i> Anomaly scoring engine</li>
          </ul>
        </div>

        <!-- Platform -->
        <div class="glass-light rounded-2xl p-8 metric-card fade-in-up delay-4" style="border-color: rgba(124,58,237,0.2);">
          <div class="w-14 h-14 rounded-2xl mb-6 flex items-center justify-center" style="background: linear-gradient(135deg, rgba(124,58,237,0.2), rgba(10,191,188,0.15));">
            <i class="fas fa-mobile-screen text-violet-400 text-xl"></i>
          </div>
          <div class="badge bg-violet-950 text-violet-400 border border-violet-800 mb-4 inline-block">Layer 3</div>
          <h3 class="text-xl font-bold text-white mb-3">Consumer Platform</h3>
          <p class="text-slate-400 text-sm leading-relaxed mb-5">A premium mobile and web experience where users activate sessions, watch live digestive journeys, receive AI summaries, and build longitudinal gut intelligence profiles.</p>
          <ul class="space-y-2 text-sm text-slate-400">
            <li class="flex items-center gap-2"><i class="fas fa-check text-violet-500 text-xs"></i> Live session monitoring</li>
            <li class="flex items-center gap-2"><i class="fas fa-check text-violet-500 text-xs"></i> Historical trend analysis</li>
            <li class="flex items-center gap-2"><i class="fas fa-check text-violet-500 text-xs"></i> Food & wellness journaling</li>
            <li class="flex items-center gap-2"><i class="fas fa-check text-violet-500 text-xs"></i> AI wellness narratives</li>
          </ul>
        </div>
      </div>
    </div>
  </section>

  <!-- Divider -->
  <div class="section-divider mx-6"></div>

  <!-- How It Works -->
  <section class="py-24 px-6">
    <div class="max-w-7xl mx-auto">
      <div class="text-center mb-16 fade-in-up delay-1">
        <div class="badge bg-emerald-950 text-emerald-400 border border-emerald-800 mb-4 inline-block">Journey</div>
        <h2 class="text-4xl font-black text-white mb-4">From Swallow to Insight</h2>
        <p class="text-slate-400 max-w-xl mx-auto">A seamless 4-step experience that transforms a single capsule into a comprehensive digestive intelligence report.</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
        ${[
          { step: '01', icon: 'capsules', color: 'teal', title: 'Ingest Capsule', desc: 'Swallow the DigestIQ capsule with water. It activates automatically and begins transmitting within seconds.' },
          { step: '02', icon: 'wifi', color: 'indigo', title: 'Real-Time Stream', desc: 'Sensor data streams wirelessly to your phone as the capsule traverses your GI tract over 6–24 hours.' },
          { step: '03', icon: 'brain', color: 'violet', title: 'AI Processing', desc: 'Our intelligence engine analyzes patterns, detects events, correlates food responses, and builds your digestive profile.' },
          { step: '04', icon: 'chart-bar', color: 'emerald', title: 'Receive Insights', desc: 'Get a beautiful, plain-language wellness summary with visualizations, trends, and personalized observations.' },
        ].map(s => `
        <div class="glass-light rounded-2xl p-6 metric-card fade-in-up delay-${['1','2','3','4'][['01','02','03','04'].indexOf(s.step)]}">
          <div class="flex items-start justify-between mb-5">
            <div class="w-12 h-12 rounded-xl flex items-center justify-center" style="background: linear-gradient(135deg, rgba(10,191,188,0.15), rgba(79,70,229,0.15));">
              <i class="fas fa-${s.icon} text-${s.color}-400"></i>
            </div>
            <span class="text-5xl font-black text-white/5">${s.step}</span>
          </div>
          <h3 class="text-white font-bold mb-2">${s.title}</h3>
          <p class="text-slate-400 text-sm leading-relaxed">${s.desc}</p>
        </div>`).join('')}
      </div>
    </div>
  </section>

  <!-- Divider -->
  <div class="section-divider mx-6"></div>

  <!-- Positioning / Compliance Banner -->
  <section class="py-16 px-6">
    <div class="max-w-4xl mx-auto">
      <div class="glass rounded-2xl p-10 text-center glow-teal fade-in-up delay-2">
        <div class="w-16 h-16 rounded-2xl gradient-brand flex items-center justify-center mx-auto mb-6">
          <i class="fas fa-shield-halved text-white text-2xl"></i>
        </div>
        <h3 class="text-2xl font-bold text-white mb-4">Wellness Intelligence. Not Medical Diagnosis.</h3>
        <p class="text-slate-400 leading-relaxed max-w-2xl mx-auto mb-6">
          DigestIQ is designed as a consumer wellness observability tool. Our platform provides pattern insights, behavioral trends, and digestive observations — empowering you with knowledge about your own body. We do not diagnose, treat, or replace medical care.
        </p>
        <div class="flex flex-wrap justify-center gap-4 text-sm">
          <span class="flex items-center gap-2 text-teal-400"><i class="fas fa-check-circle"></i> FDA-aware positioning</span>
          <span class="flex items-center gap-2 text-teal-400"><i class="fas fa-check-circle"></i> Consumer wellness category</span>
          <span class="flex items-center gap-2 text-teal-400"><i class="fas fa-check-circle"></i> Privacy-first architecture</span>
          <span class="flex items-center gap-2 text-teal-400"><i class="fas fa-check-circle"></i> HIPAA-aware data handling</span>
        </div>
      </div>
    </div>
  </section>

  <!-- CTA -->
  <section class="py-24 px-6">
    <div class="max-w-4xl mx-auto text-center fade-in-up delay-2">
      <h2 class="text-5xl font-black text-white mb-6">Know Your Gut.<br/><span class="gradient-text">Finally.</span></h2>
      <p class="text-xl text-slate-400 mb-10 max-w-xl mx-auto">Join the waitlist for the most advanced personal digestive intelligence platform ever built.</p>
      <div class="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
        <input type="email" placeholder="your@email.com" class="flex-1 bg-white/5 border border-white/10 rounded-xl px-5 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-teal-500 transition-colors text-sm" />
        <button class="btn-primary whitespace-nowrap">Join Waitlist</button>
      </div>
      <p class="text-slate-600 text-xs mt-4">No spam. Early access priority. Unsubscribe anytime.</p>
    </div>
  </section>
  `
  return layout('Personal Digestive Intelligence', body, 'home')
}

// ── PLATFORM PAGE ────────────────────────────────────────────────────────────

function platformPage(): string {
  const body = `
  <section class="py-20 px-6">
    <div class="max-w-7xl mx-auto">

      <!-- Header -->
      <div class="text-center mb-20 fade-in-up delay-1">
        <div class="badge bg-teal-950 text-teal-400 border border-teal-800 mb-4 inline-block">Platform Overview</div>
        <h1 class="text-5xl font-black text-white mb-5">How DigestIQ Works</h1>
        <p class="text-slate-400 max-w-2xl mx-auto text-lg">A full-stack wellness intelligence system — from ingestible hardware to AI-powered insights.</p>
      </div>

      <!-- Capsule Deep Dive -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mb-28">
        <div class="fade-in-up delay-2">
          <div class="badge bg-teal-950 text-teal-400 border border-teal-800 mb-4 inline-block">Hardware Layer</div>
          <h2 class="text-3xl font-black text-white mb-5">The DigestIQ Capsule</h2>
          <p class="text-slate-400 leading-relaxed mb-6">Our flagship ingestible smart capsule is an ultra-miniaturized sensor platform designed to traverse your entire GI tract while continuously capturing physiological data and internal imagery.</p>

          <div class="space-y-4">
            ${[
              { icon: 'camera', color: 'teal', title: 'Micro-Camera Array', desc: 'Wide-angle CMOS image sensor capturing high-resolution internal imagery at up to 4 frames per second during active transit phases.' },
              { icon: 'flask', color: 'amber', title: 'pH Biosensor Stack', desc: 'ISFET-based ion-selective electrode measuring real-time luminal pH from 1.0 to 9.0 across all GI segments.' },
              { icon: 'temperature-half', color: 'red', title: 'Thermal Sensor', desc: 'Precision thermistor array monitoring internal mucosal temperature with ±0.1°C accuracy.' },
              { icon: 'wave-square', color: 'indigo', title: 'Motility Sensors', desc: 'MEMS accelerometer and gyroscope tracking capsule motion, orientation, and GI contraction events.' },
              { icon: 'wifi', color: 'violet', title: 'BLE 5.3 Radio', desc: 'Low-energy Bluetooth transmission to receiver patch or mobile device up to 2 meters through tissue.' },
            ].map(f => `
            <div class="flex gap-4 glass-light rounded-xl p-4">
              <div class="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style="background:rgba(10,191,188,0.1);">
                <i class="fas fa-${f.icon} text-${f.color}-400 text-sm"></i>
              </div>
              <div>
                <div class="text-white font-semibold text-sm mb-1">${f.title}</div>
                <div class="text-slate-500 text-xs leading-relaxed">${f.desc}</div>
              </div>
            </div>`).join('')}
          </div>
        </div>

        <!-- Capsule spec visual -->
        <div class="fade-in-up delay-3">
          <div class="glass rounded-2xl p-8 glow-teal">
            <div class="text-center mb-8">
              <div class="inline-block float capsule-glow">
                <svg width="80" height="160" viewBox="0 0 100 200" fill="none">
                  <defs>
                    <linearGradient id="capG1" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stop-color="#0ABFBC"/>
                      <stop offset="100%" stop-color="#4F46E5"/>
                    </linearGradient>
                    <linearGradient id="capG2" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stop-color="#7C3AED"/>
                      <stop offset="100%" stop-color="#0ABFBC"/>
                    </linearGradient>
                  </defs>
                  <path d="M20 100 Q20 20 50 20 Q80 20 80 100 Z" fill="url(#capG1)" opacity="0.95"/>
                  <path d="M20 100 Q20 180 50 180 Q80 180 80 100 Z" fill="url(#capG2)" opacity="0.95"/>
                  <path d="M28 60 Q32 35 50 30" stroke="rgba(255,255,255,0.4)" stroke-width="2" stroke-linecap="round"/>
                  <line x1="20" y1="100" x2="80" y2="100" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
                  <circle cx="50" cy="70" r="5" fill="rgba(255,255,255,0.7)"/>
                  <circle cx="50" cy="130" r="4" fill="rgba(255,255,255,0.5)"/>
                  <circle cx="38" cy="85" r="2.5" fill="rgba(10,191,188,0.9)"/>
                  <circle cx="62" cy="85" r="2.5" fill="rgba(10,191,188,0.9)"/>
                  <circle cx="38" cy="115" r="2.5" fill="rgba(124,58,237,0.9)"/>
                  <circle cx="62" cy="115" r="2.5" fill="rgba(124,58,237,0.9)"/>
                </svg>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-4 text-sm">
              <div class="glass-light rounded-lg p-3">
                <div class="text-slate-500 text-xs mb-1">Dimensions</div>
                <div class="text-white font-semibold">11 × 26 mm</div>
              </div>
              <div class="glass-light rounded-lg p-3">
                <div class="text-slate-500 text-xs mb-1">Battery Life</div>
                <div class="text-white font-semibold">10–12 hours</div>
              </div>
              <div class="glass-light rounded-lg p-3">
                <div class="text-slate-500 text-xs mb-1">Data Rate</div>
                <div class="text-white font-semibold">~2 Mbps BLE</div>
              </div>
              <div class="glass-light rounded-lg p-3">
                <div class="text-slate-500 text-xs mb-1">Frame Rate</div>
                <div class="text-white font-semibold">2–4 fps</div>
              </div>
              <div class="glass-light rounded-lg p-3">
                <div class="text-slate-500 text-xs mb-1">pH Range</div>
                <div class="text-white font-semibold">1.0 – 9.0</div>
              </div>
              <div class="glass-light rounded-lg p-3">
                <div class="text-slate-500 text-xs mb-1">Temp Accuracy</div>
                <div class="text-white font-semibold">±0.1°C</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Divider -->
      <div class="section-divider mb-28"></div>

      <!-- AI Engine -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mb-28">
        <div class="order-2 lg:order-1 fade-in-up delay-2">
          <div class="glass rounded-2xl p-8 glow-indigo">
            <div class="flex items-center gap-3 mb-6">
              <div class="w-3 h-3 rounded-full bg-green-400 pulse-dot"></div>
              <span class="text-slate-400 text-sm">AI Engine · Live</span>
            </div>
            <div class="space-y-3 text-sm font-mono">
              ${[
                { label: 'Sensor Fusion', pct: 100, color: 'teal' },
                { label: 'Image Processing', pct: 87, color: 'indigo' },
                { label: 'pH Pattern Analysis', pct: 92, color: 'amber' },
                { label: 'Food Correlation', pct: 78, color: 'emerald' },
                { label: 'Anomaly Scoring', pct: 95, color: 'violet' },
                { label: 'Insight Generation', pct: 83, color: 'teal' },
              ].map(p => `
              <div>
                <div class="flex justify-between text-xs mb-1">
                  <span class="text-slate-400">${p.label}</span>
                  <span class="text-${p.color}-400">${p.pct}%</span>
                </div>
                <div class="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div class="h-full rounded-full bg-${p.color}-500" style="width:${p.pct}%; transition: width 1s ease;"></div>
                </div>
              </div>`).join('')}
            </div>
            <div class="mt-6 pt-6 border-t border-white/5 text-xs text-slate-500">
              Processing session sess_demo_001 · 47ms inference · GPT-4o + Vision
            </div>
          </div>
        </div>

        <div class="order-1 lg:order-2 fade-in-up delay-3">
          <div class="badge bg-indigo-950 text-indigo-400 border border-indigo-800 mb-4 inline-block">AI Layer</div>
          <h2 class="text-3xl font-black text-white mb-5">The Intelligence Engine</h2>
          <p class="text-slate-400 leading-relaxed mb-6">Our multi-model AI architecture processes sensor streams in real time, building a longitudinal picture of your digestive physiology that becomes more personalized with every session.</p>

          <div class="space-y-4">
            ${[
              { icon: 'sitemap', title: 'Sensor Fusion Pipeline', desc: 'Unifies pH, temperature, motion, and image streams into a coherent temporal model of each GI session.' },
              { icon: 'eye', title: 'Vision Intelligence', desc: 'Computer vision models trained on GI imagery identify transit landmarks, mucosal characteristics, and environmental states.' },
              { icon: 'timeline', title: 'Longitudinal Profiling', desc: 'Session-over-session comparison builds a personalized gut baseline — identifying what\'s normal for YOU.' },
              { icon: 'bolt', title: 'Anomaly Scoring', desc: 'Statistical deviation engine flags departures from personal baseline — not disease detection, but pattern observation.' },
            ].map(f => `
            <div class="flex gap-4">
              <div class="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 glass-light">
                <i class="fas fa-${f.icon} text-indigo-400 text-sm"></i>
              </div>
              <div>
                <div class="text-white font-semibold text-sm mb-1">${f.title}</div>
                <div class="text-slate-500 text-xs leading-relaxed">${f.desc}</div>
              </div>
            </div>`).join('')}
          </div>
        </div>
      </div>

      <!-- Divider -->
      <div class="section-divider mb-28"></div>

      <!-- Consumer App -->
      <div class="text-center mb-16 fade-in-up delay-1">
        <div class="badge bg-violet-950 text-violet-400 border border-violet-800 mb-4 inline-block">Consumer Experience</div>
        <h2 class="text-3xl font-black text-white mb-4">The DigestIQ App</h2>
        <p class="text-slate-400 max-w-2xl mx-auto">Premium mobile-first experience designed to feel as elegant as Apple Health — as powerful as a medical research platform.</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        ${[
          { icon: 'play-circle', color: 'teal', title: 'Session Activation', desc: 'One tap to pair your capsule, log your meal context, and begin a monitored digestive session.' },
          { icon: 'map-location-dot', color: 'indigo', title: 'Live Journey Map', desc: 'Watch your capsule\'s progress in real-time on a beautiful anatomical visualization of your GI tract.' },
          { icon: 'chart-line', color: 'violet', title: 'Trend Dashboard', desc: 'Compare sessions over weeks and months. Discover your digestive patterns, rhythms, and food responses.' },
          { icon: 'utensils', color: 'amber', title: 'Food Journal', desc: 'Log meals, hydration, and wellness notes. AI correlates them with your next session automatically.' },
          { icon: 'bell', color: 'emerald', title: 'Smart Notifications', desc: 'Get notified at key transit milestones, when your session completes, or when AI detects notable patterns.' },
          { icon: 'file-waveform', color: 'teal', title: 'AI Wellness Reports', desc: 'Beautiful plain-language summaries of your digestive session — personalized, calm, and actionable.' },
        ].map((f, i) => `
        <div class="glass-light rounded-2xl p-6 metric-card fade-in-up delay-${i+1}">
          <div class="w-12 h-12 rounded-xl flex items-center justify-center mb-5" style="background:rgba(79,70,229,0.1);">
            <i class="fas fa-${f.icon} text-${f.color}-400"></i>
          </div>
          <h3 class="text-white font-semibold mb-2">${f.title}</h3>
          <p class="text-slate-500 text-sm leading-relaxed">${f.desc}</p>
        </div>`).join('')}
      </div>

    </div>
  </section>
  `
  return layout('Platform', body, 'platform')
}

// ── SCIENCE PAGE ─────────────────────────────────────────────────────────────

function sciencePage(): string {
  const body = `
  <section class="py-20 px-6">
    <div class="max-w-7xl mx-auto">

      <div class="text-center mb-20 fade-in-up delay-1">
        <div class="badge bg-emerald-950 text-emerald-400 border border-emerald-800 mb-4 inline-block">Scientific Foundation</div>
        <h1 class="text-5xl font-black text-white mb-5">The Science of DigestIQ</h1>
        <p class="text-slate-400 max-w-2xl mx-auto text-lg">Built on peer-reviewed research in capsule endoscopy, biosensor technology, GI physiology, and AI pattern recognition.</p>
      </div>

      <!-- GI Overview -->
      <div class="glass rounded-2xl p-10 mb-12 fade-in-up delay-2">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 class="text-2xl font-black text-white mb-4">The Digestive Journey</h2>
            <p class="text-slate-400 leading-relaxed mb-6">Your GI tract is a 9-meter intelligent system with its own nervous network (the enteric nervous system), distinct biochemical environments in each segment, and highly individualized rhythms that science is only beginning to understand at the individual level.</p>
            <p class="text-slate-400 leading-relaxed">Each region maintains a signature pH, temperature range, motility pattern, and microbial ecosystem. DigestIQ maps all of these as a continuous data story — your unique digestive fingerprint.</p>
          </div>
          <div class="space-y-3">
            ${[
              { region: 'Esophagus', ph: '6.0–7.4', temp: '37°C', time: '5–15 sec', color: 'teal' },
              { region: 'Stomach', ph: '1.5–3.5', temp: '37.2°C', time: '1–4 hrs', color: 'red' },
              { region: 'Duodenum', ph: '5.5–7.0', temp: '37.1°C', time: '1–3 hrs', color: 'amber' },
              { region: 'Jejunum', ph: '6.5–7.5', temp: '37°C', time: '1–4 hrs', color: 'emerald' },
              { region: 'Ileum', ph: '7.0–7.5', temp: '36.9°C', time: '2–5 hrs', color: 'indigo' },
              { region: 'Colon', ph: '5.5–7.0', temp: '36.8°C', time: '10–59 hrs', color: 'violet' },
            ].map(r => `
            <div class="flex items-center gap-4 glass-light rounded-xl px-5 py-3">
              <div class="w-2 h-2 rounded-full bg-${r.color}-400 flex-shrink-0"></div>
              <div class="flex-1">
                <div class="text-white text-sm font-semibold">${r.region}</div>
              </div>
              <div class="text-xs text-slate-500">pH ${r.ph}</div>
              <div class="text-xs text-slate-500">${r.temp}</div>
              <div class="text-xs text-slate-600">${r.time}</div>
            </div>`).join('')}
          </div>
        </div>
      </div>

      <!-- Technology Basis -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        <div class="glass-light rounded-2xl p-8 fade-in-up delay-2">
          <div class="w-12 h-12 rounded-xl glass-light flex items-center justify-center mb-5">
            <i class="fas fa-microscope text-teal-400"></i>
          </div>
          <h3 class="text-xl font-bold text-white mb-3">Capsule Endoscopy Technology</h3>
          <p class="text-slate-400 text-sm leading-relaxed mb-4">Given capsule endoscopy has been FDA-cleared since 2001 for GI visualization. DigestIQ builds on this proven clinical technology, applying it to the consumer wellness context with enhanced sensor integration and AI analysis layers.</p>
          <div class="flex flex-wrap gap-2">
            <span class="badge bg-slate-800 text-slate-400">CE-proven form factor</span>
            <span class="badge bg-slate-800 text-slate-400">CMOS imaging</span>
            <span class="badge bg-slate-800 text-slate-400">BLE transmission</span>
          </div>
        </div>

        <div class="glass-light rounded-2xl p-8 fade-in-up delay-3">
          <div class="w-12 h-12 rounded-xl glass-light flex items-center justify-center mb-5">
            <i class="fas fa-atom text-indigo-400"></i>
          </div>
          <h3 class="text-xl font-bold text-white mb-3">Biosensor Innovation</h3>
          <p class="text-slate-400 text-sm leading-relaxed mb-4">ISFET-based ion-selective field-effect transistors enable real-time pH measurement at the ionic level. Combined with NTC thermistors and MEMS motion sensors, we capture a multi-dimensional physiological dataset from inside the body.</p>
          <div class="flex flex-wrap gap-2">
            <span class="badge bg-slate-800 text-slate-400">ISFET pH sensors</span>
            <span class="badge bg-slate-800 text-slate-400">NTC thermistors</span>
            <span class="badge bg-slate-800 text-slate-400">MEMS motion</span>
          </div>
        </div>

        <div class="glass-light rounded-2xl p-8 fade-in-up delay-4">
          <div class="w-12 h-12 rounded-xl glass-light flex items-center justify-center mb-5">
            <i class="fas fa-brain text-violet-400"></i>
          </div>
          <h3 class="text-xl font-bold text-white mb-3">AI Pattern Recognition</h3>
          <p class="text-slate-400 text-sm leading-relaxed mb-4">Our AI models apply multivariate time-series analysis, computer vision, and longitudinal profiling algorithms derived from gastroenterology research to identify statistically meaningful patterns in your digestive data over time.</p>
          <div class="flex flex-wrap gap-2">
            <span class="badge bg-slate-800 text-slate-400">Time-series ML</span>
            <span class="badge bg-slate-800 text-slate-400">Computer vision</span>
            <span class="badge bg-slate-800 text-slate-400">Anomaly detection</span>
          </div>
        </div>

        <div class="glass-light rounded-2xl p-8 fade-in-up delay-5">
          <div class="w-12 h-12 rounded-xl glass-light flex items-center justify-center mb-5">
            <i class="fas fa-battery-three-quarters text-amber-400"></i>
          </div>
          <h3 class="text-xl font-bold text-white mb-3">Power & Materials Science</h3>
          <p class="text-slate-400 text-sm leading-relaxed mb-4">Ultra-thin oxide silver batteries power the capsule for 10–12 hours. The shell uses biocompatible, food-grade polymer composites (PGLA/PC) that are non-digestible and exit naturally, identical in strategy to approved clinical capsule endoscopes.</p>
          <div class="flex flex-wrap gap-2">
            <span class="badge bg-slate-800 text-slate-400">Silver oxide cells</span>
            <span class="badge bg-slate-800 text-slate-400">PGLA polymer</span>
            <span class="badge bg-slate-800 text-slate-400">Biocompatible</span>
          </div>
        </div>
      </div>

      <!-- Wellness Disclaimer -->
      <div class="glass rounded-2xl p-8 border border-amber-900/30 fade-in-up delay-3">
        <div class="flex gap-4 items-start">
          <div class="w-10 h-10 rounded-xl bg-amber-950 flex items-center justify-center flex-shrink-0">
            <i class="fas fa-triangle-exclamation text-amber-400 text-sm"></i>
          </div>
          <div>
            <h4 class="text-white font-semibold mb-2">Scientific Responsibility Statement</h4>
            <p class="text-slate-400 text-sm leading-relaxed">DigestIQ is designed as a consumer wellness observability platform. The scientific principles described above inform our hardware and software design. All insights generated by our AI are observational wellness patterns — not clinical findings, diagnoses, or medical advice. Individual results vary. The digestive system is highly complex and variable; our platform helps you understand your personal patterns, not evaluate disease states. Always consult qualified healthcare professionals for medical evaluation.</p>
          </div>
        </div>
      </div>

      <!-- Future Research -->
      <div class="mt-12 fade-in-up delay-4">
        <div class="text-center mb-10">
          <h2 class="text-3xl font-black text-white mb-3">Future Research Horizon</h2>
          <p class="text-slate-400">Where DigestIQ is headed as the science matures.</p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          ${[
            { icon: 'dna', color: 'teal', title: 'Microbiome Integration', desc: 'Next-gen capsules incorporating microbiome sampling alongside physical sensing, correlating microbial diversity with transit patterns.' },
            { icon: 'droplet', color: 'indigo', title: 'Blood Biomarker Sensing', desc: 'Electrochemical biosensor arrays capable of measuring inflammatory markers and metabolites non-invasively from luminal fluid.' },
            { icon: 'robot', color: 'violet', title: 'Personalized Nutrition AI', desc: 'Longitudinal correlation of food inputs with GI response data to generate AI-powered personalized nutrition optimization models.' },
          ].map(f => `
          <div class="glass-light rounded-2xl p-6 metric-card">
            <div class="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style="background:rgba(10,191,188,0.08);">
              <i class="fas fa-${f.icon} text-${f.color}-400"></i>
            </div>
            <div class="badge bg-slate-800 text-slate-500 mb-3 inline-block">Future</div>
            <h3 class="text-white font-semibold mb-2">${f.title}</h3>
            <p class="text-slate-500 text-sm leading-relaxed">${f.desc}</p>
          </div>`).join('')}
        </div>
      </div>

    </div>
  </section>
  `
  return layout('Science', body, 'science')
}

// ── ARCHITECTURE PAGE ────────────────────────────────────────────────────────

function architecturePage(): string {
  const body = `
  <section class="py-20 px-6">
    <div class="max-w-7xl mx-auto">

      <div class="text-center mb-20 fade-in-up delay-1">
        <div class="badge bg-slate-800 text-slate-400 border border-slate-700 mb-4 inline-block">System Architecture</div>
        <h1 class="text-5xl font-black text-white mb-5">Engineering-Grade Architecture</h1>
        <p class="text-slate-400 max-w-2xl mx-auto text-lg">Stripe + Oura + OpenAI + Capsule Endoscopy + Datadog — for the human digestive system.</p>
      </div>

      <!-- System Layers -->
      <div class="mb-16 fade-in-up delay-2">
        <div class="glass rounded-2xl p-8">
          <h2 class="text-xl font-bold text-white mb-8 flex items-center gap-3">
            <i class="fas fa-layer-group text-teal-400"></i>
            Full-Stack Architecture Overview
          </h2>
          <div class="space-y-3">
            ${[
              { layer: 'L1 — Hardware', label: 'Ingestible Capsule', items: ['CMOS Camera', 'pH ISFET', 'Thermistor', 'MEMS IMU', 'BLE 5.3 Radio', 'Silver Oxide Battery'], color: 'teal' },
              { layer: 'L2 — Edge', label: 'Mobile Edge Receiver', items: ['BLE Signal Processing', 'Real-time Decompression', 'Session State Machine', 'Offline Buffer', 'Encryption at Source'], color: 'amber' },
              { layer: 'L3 — Transport', label: 'Secure Ingestion Pipeline', items: ['TLS 1.3 Encrypted Upload', 'Event Stream (Kafka)', 'HIPAA-aware Ingestion', 'Zero-trust Auth', 'Audit Logging'], color: 'indigo' },
              { layer: 'L4 — AI Processing', label: 'Intelligence Engine', items: ['Sensor Fusion', 'Vision Pipeline', 'Longitudinal Profiler', 'Anomaly Scorer', 'Insight Generator', 'Multi-model Orchestrator'], color: 'violet' },
              { layer: 'L5 — Storage', label: 'Data Architecture', items: ['Encrypted Biometric Store', 'Vector DB (embeddings)', 'Session Timeline Index', 'AI Memory System', 'Audit Log (immutable)'], color: 'emerald' },
              { layer: 'L6 — API', label: 'Platform API Layer', items: ['REST + GraphQL', 'Rate Intelligence', 'Provider Abstraction', 'SDK (future)', 'Webhook System'], color: 'teal' },
              { layer: 'L7 — Consumer', label: 'Mobile + Web Apps', items: ['iOS / Android', 'Web Dashboard', 'Session Player', 'AI Insight Cards', 'Food Journal', 'Trend Charts'], color: 'indigo' },
            ].map(l => `
            <div class="glass-light rounded-xl p-5">
              <div class="flex flex-wrap items-center gap-4">
                <div class="flex items-center gap-3 min-w-48">
                  <div class="w-2 h-2 rounded-full bg-${l.color}-400"></div>
                  <div>
                    <div class="text-xs text-slate-600 font-mono">${l.layer}</div>
                    <div class="text-white text-sm font-semibold">${l.label}</div>
                  </div>
                </div>
                <div class="flex flex-wrap gap-2">
                  ${l.items.map(i => `<span class="badge bg-slate-800/50 text-slate-400">${i}</span>`).join('')}
                </div>
              </div>
            </div>`).join('')}
          </div>
        </div>
      </div>

      <!-- Security & Data -->
      <div id="data" class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">

        <div class="glass-light rounded-2xl p-8 fade-in-up delay-2">
          <h3 class="text-xl font-bold text-white mb-6 flex items-center gap-3">
            <i class="fas fa-shield-halved text-teal-400"></i>
            Zero-Trust Security Architecture
          </h3>
          <div class="space-y-4">
            ${[
              { icon: 'lock', title: 'End-to-end Encryption', desc: 'All biometric data encrypted at source on the mobile device before transmission. AES-256 at rest, TLS 1.3 in transit.' },
              { icon: 'key', title: 'Zero-Trust Service Mesh', desc: 'No implicit trust between any services. Every inter-service call authenticated, authorized, and logged.' },
              { icon: 'scroll', title: 'Immutable Audit Logs', desc: 'Append-only forensic audit trail for every data access, AI inference, and state mutation. Cannot be deleted.' },
              { icon: 'rotate', title: 'Rotating Credentials', desc: 'All service credentials and API tokens have expiry and automatic rotation schedules. No static secrets.' },
              { icon: 'user-shield', title: 'Consent Management', desc: 'Granular consent system. Users control exactly what data is stored, used for AI, and retained.' },
            ].map(s => `
            <div class="flex gap-3">
              <div class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-teal-950">
                <i class="fas fa-${s.icon} text-teal-400 text-xs"></i>
              </div>
              <div>
                <div class="text-white text-sm font-semibold mb-0.5">${s.title}</div>
                <div class="text-slate-500 text-xs leading-relaxed">${s.desc}</div>
              </div>
            </div>`).join('')}
          </div>
        </div>

        <div id="ai" class="glass-light rounded-2xl p-8 fade-in-up delay-3">
          <h3 class="text-xl font-bold text-white mb-6 flex items-center gap-3">
            <i class="fas fa-brain text-indigo-400"></i>
            AI Engine Architecture
          </h3>
          <div class="space-y-4">
            ${[
              { icon: 'sitemap', title: 'Multi-model Orchestration', desc: 'Different AI models for vision, time-series analysis, anomaly detection, and natural language insight generation. No single model dependency.' },
              { icon: 'shield-virus', title: 'Prompt Injection Defense', desc: 'All user inputs sanitized before AI processing. AI outputs validated against safe-output schema before display.' },
              { icon: 'magnifying-glass-chart', title: 'Intelligence Quality Control', desc: 'Every AI output scored for hallucination risk, architectural coherence, and factual reliability before delivery.' },
              { icon: 'person-chalkboard', title: 'Explainability Layer', desc: 'Every AI insight includes traceable reasoning. Users can see what data drove each observation.' },
              { icon: 'arrows-rotate', title: 'Provider Abstraction', desc: 'All AI providers wrapped in interface contracts. Any model can be swapped without platform rewrites.' },
            ].map(s => `
            <div class="flex gap-3">
              <div class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-indigo-950">
                <i class="fas fa-${s.icon} text-indigo-400 text-xs"></i>
              </div>
              <div>
                <div class="text-white text-sm font-semibold mb-0.5">${s.title}</div>
                <div class="text-slate-500 text-xs leading-relaxed">${s.desc}</div>
              </div>
            </div>`).join('')}
          </div>
        </div>
      </div>

      <!-- System Laws -->
      <div id="security" class="glass rounded-2xl p-8 mb-16 fade-in-up delay-4">
        <h3 class="text-xl font-bold text-white mb-2 flex items-center gap-3">
          <i class="fas fa-gavel text-violet-400"></i>
          System Laws (Constitutional Rules)
        </h3>
        <p class="text-slate-500 text-sm mb-8">Non-negotiable architectural constraints. Every AI component, every engineer, every deployment must obey these unconditionally.</p>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-sm">
          ${[
            'All logic communicates through the Intent Layer only — no direct mutations',
            'No duplicated auth systems — single AuthService owns all sessions',
            'No hardcoded secrets — all credentials in secure vault with rotation',
            'No business logic inside UI components',
            'All external APIs require typed validation before use',
            'All async flows require error boundaries and graceful degradation',
            'All state mutations must be traceable via audit log',
            'No hidden side effects — every function has defined side-effect contract',
            'No placeholder or simulated production logic in any release build',
            'No new architecture patterns without explicit approval (context lock)',
            'No AI output auto-executed without runtime validation',
            'No direct provider SDK calls outside abstraction interfaces',
            'Zero trust between ALL services — no implicit internal trust',
            'All biometric data encrypted at source before leaving device',
            'No diagnostic language in any consumer-facing AI output',
            'All user data subject to consent before AI processing',
          ].map((law, i) => `
          <div class="flex gap-3 glass-light rounded-lg px-4 py-3">
            <span class="text-slate-700 flex-shrink-0 text-xs pt-0.5">LAW-${String(i+1).padStart(2,'0')}</span>
            <span class="text-slate-400 text-xs leading-relaxed">${law}</span>
          </div>`).join('')}
        </div>
      </div>

      <!-- Regulatory Roadmap -->
      <div class="fade-in-up delay-5">
        <div class="text-center mb-10">
          <h2 class="text-3xl font-black text-white mb-3">Regulatory Evolution Roadmap</h2>
          <p class="text-slate-400">A phased path from consumer wellness to FDA-cleared diagnostics.</p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          ${[
            { phase: 'Phase 1', timeline: '2026–2027', label: 'Consumer Wellness', desc: 'Launch as wellness observability platform. Consumer product positioning. No medical claims. FTC compliant language.', color: 'teal', status: 'Now' },
            { phase: 'Phase 2', timeline: '2027–2028', label: 'Research Partnerships', desc: 'IRB-approved clinical research partnerships. Voluntary research mode. Build clinical evidence base.', color: 'indigo', status: 'Next' },
            { phase: 'Phase 3', timeline: '2028–2030', label: 'FDA 510(k) Pathway', desc: 'Pursue predicate-based clearance for specific GI monitoring indications. Limited diagnostic claims.', color: 'violet', status: 'Future' },
            { phase: 'Phase 4', timeline: '2030+', label: 'Regulated Diagnostics', desc: 'Full FDA-cleared diagnostic platform for specific indications, physician-prescribed, insurance reimbursable.', color: 'emerald', status: 'Vision' },
          ].map(p => `
          <div class="glass-light rounded-2xl p-6 metric-card">
            <div class="flex items-start justify-between mb-4">
              <div class="badge bg-slate-800 text-slate-500 text-xs">${p.phase}</div>
              <div class="badge bg-${p.color}-950 text-${p.color}-400 border border-${p.color}-800 text-xs">${p.status}</div>
            </div>
            <div class="text-xs text-slate-600 mb-2">${p.timeline}</div>
            <h4 class="text-white font-bold mb-3">${p.label}</h4>
            <p class="text-slate-500 text-xs leading-relaxed">${p.desc}</p>
          </div>`).join('')}
        </div>
      </div>

    </div>
  </section>
  `
  return layout('Architecture', body, 'architecture')
}

// ── DASHBOARD PAGE ───────────────────────────────────────────────────────────

function dashboardPage(): string {
  const body = `
  <section class="py-8 px-6">
    <div class="max-w-7xl mx-auto">

      <!-- Dashboard Header -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 fade-in-up delay-1">
        <div>
          <div class="flex items-center gap-3 mb-1">
            <div class="w-2.5 h-2.5 rounded-full bg-green-400 pulse-dot"></div>
            <span class="text-slate-500 text-sm">Session Active</span>
          </div>
          <h1 class="text-3xl font-black text-white">Digestive Dashboard</h1>
          <p class="text-slate-500 text-sm mt-1">Session sess_demo_001 · Started 6h 42m ago · Today</p>
        </div>
        <div class="flex gap-3">
          <button class="btn-ghost py-2 px-4 text-sm"><i class="fas fa-download mr-2"></i>Export</button>
          <button class="btn-primary py-2 px-4 text-sm"><i class="fas fa-plus mr-2"></i>New Session</button>
        </div>
      </div>

      <!-- Metric Cards -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        ${[
          { icon: 'clock', label: 'Transit Time', value: '6h 42m', sub: '↑ 8% from avg', color: 'teal', bg: 'teal' },
          { icon: 'flask', label: 'Avg pH', value: '6.4', sub: 'Balanced profile', color: 'amber', bg: 'amber' },
          { icon: 'temperature-half', label: 'Body Temp', value: '37.1°C', sub: 'Within baseline', color: 'red', bg: 'red' },
          { icon: 'gauge-high', label: 'Wellness Score', value: '87', sub: '↑ 5pts this week', color: 'indigo', bg: 'indigo' },
        ].map(m => `
        <div class="glass-light rounded-2xl p-5 metric-card fade-in-up delay-2">
          <div class="flex items-start justify-between mb-4">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center" style="background:rgba(10,191,188,0.08);">
              <i class="fas fa-${m.icon} text-${m.color}-400"></i>
            </div>
          </div>
          <div class="text-2xl font-black text-white mb-1">${m.value}</div>
          <div class="text-slate-500 text-xs mb-1">${m.label}</div>
          <div class="text-slate-600 text-xs">${m.sub}</div>
        </div>`).join('')}
      </div>

      <!-- Main Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">

        <!-- GI Journey Visualization -->
        <div class="lg:col-span-2 glass-light rounded-2xl p-6 fade-in-up delay-2">
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-white font-bold flex items-center gap-2">
              <i class="fas fa-map-location-dot text-teal-400 text-sm"></i>
              Digestive Journey Map
            </h2>
            <span class="badge bg-green-950 text-green-400 border border-green-800 text-xs">Live</span>
          </div>

          <!-- Timeline visualization -->
          <div class="space-y-3">
            ${[
              { time: '0:00', region: 'Esophagus', ph: 7.2, pct: 100, status: 'complete', note: 'Capsule activated & ingested' },
              { time: '0:04', region: 'Stomach Entry', ph: 4.1, pct: 100, status: 'complete', note: 'Gastric entry confirmed' },
              { time: '1:20', region: 'Stomach', ph: 2.8, pct: 100, status: 'complete', note: 'Peak acid phase detected' },
              { time: '2:45', region: 'Duodenum', ph: 6.1, pct: 100, status: 'complete', note: 'Small intestine transition' },
              { time: '4:10', region: 'Jejunum', ph: 6.8, pct: 100, status: 'complete', note: 'Mid-transit phase' },
              { time: '5:30', region: 'Ileum', ph: 7.4, pct: 100, status: 'complete', note: 'Terminal segment' },
              { time: '6:42', region: 'Cecum ↗', ph: 7.8, pct: 60, status: 'active', note: 'Currently tracking — large intestine entry' },
            ].map((t, idx) => `
            <div class="timeline-node flex items-start gap-4">
              <div class="flex flex-col items-center flex-shrink-0">
                <div class="w-8 h-8 rounded-full flex items-center justify-center ${t.status === 'active' ? 'gradient-brand pulse-dot' : 'bg-teal-950 border border-teal-800'}">
                  ${t.status === 'active' ? '<i class="fas fa-location-dot text-white text-xs"></i>' : '<i class="fas fa-check text-teal-400 text-xs"></i>'}
                </div>
              </div>
              <div class="flex-1 pb-3">
                <div class="flex items-center justify-between mb-1">
                  <div class="flex items-center gap-2">
                    <span class="text-white text-sm font-semibold">${t.region}</span>
                    ${t.status === 'active' ? '<span class="badge bg-green-950 text-green-400 text-xs">Active</span>' : ''}
                  </div>
                  <div class="flex items-center gap-3 text-xs">
                    <span class="text-slate-600 font-mono">${t.time}</span>
                    <span class="text-amber-400">pH ${t.ph}</span>
                  </div>
                </div>
                <div class="text-slate-500 text-xs mb-2">${t.note}</div>
                <div class="h-1 bg-white/5 rounded-full overflow-hidden">
                  <div class="h-full rounded-full ${t.status === 'active' ? 'gradient-brand' : 'bg-teal-700'}" style="width:${t.pct}%"></div>
                </div>
              </div>
            </div>`).join('')}
          </div>
        </div>

        <!-- pH Timeline Chart -->
        <div class="glass-light rounded-2xl p-6 fade-in-up delay-3">
          <h2 class="text-white font-bold mb-2 flex items-center gap-2">
            <i class="fas fa-chart-line text-amber-400 text-sm"></i>
            pH Timeline
          </h2>
          <p class="text-slate-600 text-xs mb-4">Luminal pH across GI segments</p>
          <canvas id="phChart" height="220"></canvas>
          <div class="mt-4 pt-4 border-t border-white/5">
            <div class="flex items-center justify-between text-xs">
              <span class="text-slate-500">Current</span>
              <span class="text-amber-400 font-bold text-lg">7.8</span>
            </div>
            <div class="ph-bar h-2 mt-2 rounded-full"></div>
            <div class="flex justify-between text-xs text-slate-700 mt-1">
              <span>Acid (1)</span>
              <span>Neutral (7)</span>
              <span>Base (9)</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Food Correlations + AI Insights -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <!-- Food Correlations -->
        <div class="glass-light rounded-2xl p-6 fade-in-up delay-3">
          <h2 class="text-white font-bold mb-6 flex items-center gap-2">
            <i class="fas fa-utensils text-emerald-400 text-sm"></i>
            Food Response Correlations
          </h2>
          <div class="space-y-4">
            ${[
              { food: 'Avocado', score: 92, trend: 'up', color: 'emerald' },
              { food: 'Greek Yogurt', score: 88, trend: 'up', color: 'emerald' },
              { food: 'Coffee (2 cups)', score: 68, trend: 'neutral', color: 'amber' },
              { food: 'Cruciferous Vegetables', score: 55, trend: 'down', color: 'amber' },
              { food: 'Red Wine', score: 44, trend: 'down', color: 'red' },
            ].map(f => `
            <div class="flex items-center gap-4">
              <div class="flex-1">
                <div class="flex items-center justify-between mb-1">
                  <span class="text-white text-sm">${f.food}</span>
                  <div class="flex items-center gap-2">
                    <i class="fas fa-arrow-${f.trend === 'up' ? 'up text-emerald-400' : f.trend === 'down' ? 'down text-red-400' : 'right text-amber-400'} text-xs"></i>
                    <span class="text-${f.color}-400 text-sm font-bold">${f.score}</span>
                  </div>
                </div>
                <div class="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div class="h-full rounded-full bg-${f.color}-500 transition-all duration-1000" style="width:${f.score}%"></div>
                </div>
              </div>
            </div>`).join('')}
          </div>
          <p class="text-slate-700 text-xs mt-5">Correlation scores based on your 28-day digestive history. Higher = more favorable response pattern observed.</p>
        </div>

        <!-- Quick AI Insights -->
        <div class="glass-light rounded-2xl p-6 fade-in-up delay-4">
          <h2 class="text-white font-bold mb-6 flex items-center gap-2">
            <i class="fas fa-sparkles text-violet-400 text-sm"></i>
            AI Wellness Observations
          </h2>
          <div class="space-y-4">
            ${[
              { type: 'transit', color: 'teal', tag: 'Rhythm', icon: 'wave-pulse', title: 'Smooth Transit', body: 'Your transit today completed in the upper range of your personal baseline — consistent with your Tuesday and Thursday pattern over the last 6 weeks.' },
              { type: 'food', color: 'emerald', tag: 'Food Response', icon: 'leaf', title: 'Avocado + Salmon Pairing', body: 'This meal combination correlated with a 12% faster early-transit phase compared to your 30-day average.' },
              { type: 'trend', color: 'indigo', tag: '28-Day Trend', icon: 'trending-up', title: 'Consistency Improving', body: 'Your digestive rhythm consistency score has improved 18% this month. Hydration patterns appear to be a contributing factor.' },
            ].map(i => `
            <div class="insight-card insight-${i.type} glass-light rounded-xl p-4 pl-5">
              <div class="flex items-start justify-between mb-2">
                <div class="flex items-center gap-2">
                  <i class="fas fa-${i.icon} text-${i.color}-400 text-xs"></i>
                  <span class="text-white text-sm font-semibold">${i.title}</span>
                </div>
                <span class="badge bg-${i.color}-950 text-${i.color}-400 border border-${i.color}-900 text-xs">${i.tag}</span>
              </div>
              <p class="text-slate-500 text-xs leading-relaxed">${i.body}</p>
            </div>`).join('')}
          </div>
          <div class="mt-5 pt-5 border-t border-white/5 text-xs text-slate-600">
            <i class="fas fa-triangle-exclamation mr-2 text-slate-700"></i>
            Wellness observations only. Not medical advice or diagnosis.
          </div>
        </div>
      </div>

      <!-- Weekly trend chart -->
      <div class="glass-light rounded-2xl p-6 mt-6 fade-in-up delay-5">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-white font-bold flex items-center gap-2">
            <i class="fas fa-chart-bar text-indigo-400 text-sm"></i>
            28-Day Wellness Score Trend
          </h2>
          <div class="flex gap-2">
            <button class="badge bg-indigo-950 text-indigo-400 border border-indigo-800 cursor-pointer">28 Days</button>
            <button class="badge bg-slate-800 text-slate-500 cursor-pointer">90 Days</button>
          </div>
        </div>
        <canvas id="trendChart" height="100"></canvas>
      </div>

    </div>
  </section>

  <script>
  document.addEventListener('DOMContentLoaded', () => {
    // pH Chart
    const phCtx = document.getElementById('phChart');
    if (phCtx) {
      new Chart(phCtx, {
        type: 'line',
        data: {
          labels: ['Esophagus','Stomach','Stomach Peak','Duodenum','Jejunum','Ileum','Cecum'],
          datasets: [{
            label: 'pH',
            data: [7.2, 4.1, 2.8, 6.1, 6.8, 7.4, 7.8],
            borderColor: '#F59E0B',
            backgroundColor: 'rgba(245,158,11,0.1)',
            pointBackgroundColor: '#F59E0B',
            pointRadius: 4,
            tension: 0.4,
            fill: true,
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            y: {
              min: 1, max: 9,
              grid: { color: 'rgba(255,255,255,0.04)' },
              ticks: { color: '#475569', font: { size: 10 } }
            },
            x: {
              grid: { display: false },
              ticks: { color: '#475569', font: { size: 9 }, maxRotation: 45 }
            }
          }
        }
      });
    }

    // Trend Chart
    const trendCtx = document.getElementById('trendChart');
    if (trendCtx) {
      const labels = Array.from({length: 28}, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() - (27 - i));
        return d.toLocaleDateString('en-US',{month:'short',day:'numeric'});
      });
      const data = Array.from({length: 28}, (_, i) => 65 + Math.sin(i/3) * 10 + i * 0.8 + Math.random() * 5);
      new Chart(trendCtx, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Wellness Score',
            data,
            backgroundColor: data.map(v => v > 80 ? 'rgba(10,191,188,0.6)' : 'rgba(79,70,229,0.4)'),
            borderRadius: 4,
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            y: {
              min: 50, max: 100,
              grid: { color: 'rgba(255,255,255,0.04)' },
              ticks: { color: '#475569', font: { size: 10 } }
            },
            x: {
              grid: { display: false },
              ticks: { color: '#475569', font: { size: 8 }, maxTicksLimit: 8 }
            }
          }
        }
      });
    }
  });
  </script>
  `
  return layout('Dashboard', body, 'dashboard')
}

// ── INSIGHTS PAGE ─────────────────────────────────────────────────────────────

function insightsPage(): string {
  const body = `
  <section class="py-20 px-6">
    <div class="max-w-7xl mx-auto">

      <div class="text-center mb-20 fade-in-up delay-1">
        <div class="badge bg-violet-950 text-violet-400 border border-violet-800 mb-4 inline-block">AI Intelligence Layer</div>
        <h1 class="text-5xl font-black text-white mb-5">AI Wellness Insights</h1>
        <p class="text-slate-400 max-w-2xl mx-auto text-lg">Personalized, calm, responsible digestive intelligence — generated by our multi-model AI system from your real session data.</p>
      </div>

      <!-- Sample Session Report -->
      <div class="glass rounded-2xl p-10 mb-12 fade-in-up delay-2 glow-violet">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div class="badge bg-slate-800 text-slate-400 mb-2 inline-block">Session Report · sess_demo_001</div>
            <h2 class="text-2xl font-black text-white">Your Digestive Session Summary</h2>
            <p class="text-slate-500 text-sm mt-1">Generated by DigestIQ Intelligence Engine · ${new Date().toLocaleDateString('en-US',{weekday:'long', year:'numeric', month:'long', day:'numeric'})}</p>
          </div>
          <div class="text-center glass-light rounded-2xl px-8 py-4">
            <div class="text-5xl font-black gradient-text">87</div>
            <div class="text-slate-500 text-xs mt-1">Wellness Score</div>
          </div>
        </div>

        <div class="glass-light rounded-xl p-6 mb-8 border border-violet-900/30">
          <h3 class="text-white font-semibold mb-3 flex items-center gap-2">
            <i class="fas fa-sparkles text-violet-400 text-sm"></i>
            AI Narrative Summary
          </h3>
          <p class="text-slate-300 leading-relaxed text-sm">
            Today's digestive session showed a well-paced, consistent transit pattern that aligns closely with your established personal rhythm. Your gastric phase was well-represented, with pH levels following the expected acidic profile before gradual neutralization through your small intestine — a pattern we've observed in 80% of your previous sessions.
          </p>
          <p class="text-slate-400 leading-relaxed text-sm mt-3">
            The avocado and salmon meal you logged prior to this session appeared to correlate with a slightly faster early-transit phase than your 30-day average. Your small intestine segment showed particularly consistent pH progression, which has been a signature characteristic of your digestive profile over the last 4 weeks.
          </p>
          <p class="text-slate-500 leading-relaxed text-sm mt-3">
            Your hydration level today (logged at 2.4L) continues to track alongside your better-scoring sessions, suggesting a behavioral correlation worth noting. Your 28-day consistency score has improved significantly, and this session continues that positive trend.
          </p>
          <div class="mt-4 pt-4 border-t border-white/5 text-xs text-slate-600">
            <i class="fas fa-circle-info mr-2"></i>
            This is a wellness observational summary. It describes patterns in your data — not medical findings or clinical conclusions. Always consult a healthcare professional for medical evaluation.
          </div>
        </div>

        <!-- Insight Cards Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          ${[
            {
              type: 'transit', color: 'teal', tag: 'Transit Rhythm', icon: 'wave-pulse',
              title: 'Smooth Transit Pattern Observed',
              body: 'Your total transit time of 6h 42m sits in the upper-normal range of your personal baseline (5.5h–7.5h). This falls within the window we\'ve observed in your top-performing sessions over the past month.',
              data: 'Transit: 6h 42m · Baseline avg: 6h 18m · Δ +24min',
            },
            {
              type: 'ph', color: 'amber', tag: 'Gastric Environment', icon: 'flask',
              title: 'Balanced pH Progression',
              body: 'pH levels across your upper GI segment remained stable throughout this session. Your gastric acid phase reached pH 2.8 (within your typical 2.5–3.2 range) before a smooth, gradual rise through the small intestine.',
              data: 'Gastric nadir: pH 2.8 · Small intestine avg: pH 6.8 · Cecum: pH 7.8',
            },
            {
              type: 'food', color: 'emerald', tag: 'Food Response', icon: 'leaf',
              title: 'Avocado + Salmon: Favorable Correlation',
              body: 'The meal combination you logged 45 minutes before this session correlated with a faster-than-average early transit phase and a smooth gastric emptying pattern. This pairing now appears in your top-5 favorable meal combinations.',
              data: 'Early transit delta: +12% vs avg · Meal-to-gastric entry: 48min',
            },
            {
              type: 'trend', color: 'indigo', tag: '28-Day Intelligence', icon: 'chart-line',
              title: 'Consistency Improving Steadily',
              body: 'Your digestive rhythm consistency score has improved 18% over the past 28 days. This correlates with more consistent sleep timing and hydration patterns you\'ve logged in your journal — an encouraging behavioral correlation.',
              data: 'Consistency score: 87 → 102 (28 days) · Improvement: +18%',
            },
          ].map(i => `
          <div class="insight-card insight-${i.type} glass-light rounded-xl p-6 pl-6">
            <div class="flex items-start justify-between mb-3">
              <i class="fas fa-${i.icon} text-${i.color}-400 text-sm mt-0.5"></i>
              <span class="badge bg-${i.color}-950 text-${i.color}-400 border border-${i.color}-900 text-xs">${i.tag}</span>
            </div>
            <h4 class="text-white font-semibold mb-2 text-sm">${i.title}</h4>
            <p class="text-slate-400 text-xs leading-relaxed mb-4">${i.body}</p>
            <div class="glass rounded-lg px-3 py-2 font-mono text-xs text-slate-600">${i.data}</div>
          </div>`).join('')}
        </div>
      </div>

      <!-- AI Ethics & Tone Guidelines -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">

        <div class="glass-light rounded-2xl p-8 fade-in-up delay-3">
          <h3 class="text-xl font-bold text-white mb-5 flex items-center gap-3">
            <i class="fas fa-shield-heart text-teal-400"></i>
            AI Ethics Framework
          </h3>
          <div class="space-y-4">
            ${[
              { icon: 'check', color: 'emerald', title: 'Always observational', desc: 'Every AI output describes patterns — never conclusions. "We observed" not "you have."' },
              { icon: 'check', color: 'emerald', title: 'Calibrated confidence', desc: 'Uncertainty is communicated honestly. "This appears to correlate" not "this causes."' },
              { icon: 'check', color: 'emerald', title: 'Non-alarming language', desc: 'Departures from baseline described calmly and contextually — never as warnings or alerts.' },
              { icon: 'check', color: 'emerald', title: 'Privacy by default', desc: 'AI never infers sensitive health conditions. Models designed to avoid diagnostic reasoning.' },
              { icon: 'xmark', color: 'red', title: 'Never diagnostic', desc: 'Zero tolerance for language that implies disease detection, diagnosis, or clinical assessment.' },
              { icon: 'xmark', color: 'red', title: 'Never fear-inducing', desc: 'No alarming, urgent, or fear-based language. The gut is complex — we approach it with curiosity, not alarm.' },
            ].map(e => `
            <div class="flex gap-3">
              <div class="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 bg-${e.color}-950 mt-0.5">
                <i class="fas fa-${e.icon} text-${e.color}-400 text-xs"></i>
              </div>
              <div>
                <div class="text-white text-sm font-semibold mb-0.5">${e.title}</div>
                <div class="text-slate-500 text-xs leading-relaxed">${e.desc}</div>
              </div>
            </div>`).join('')}
          </div>
        </div>

        <div class="glass-light rounded-2xl p-8 fade-in-up delay-4">
          <h3 class="text-xl font-bold text-white mb-5 flex items-center gap-3">
            <i class="fas fa-microchip text-indigo-400"></i>
            Intelligence Quality Control
          </h3>
          <p class="text-slate-400 text-sm leading-relaxed mb-6">Every AI insight generated by DigestIQ passes through a mandatory quality scorecard before delivery to the user.</p>
          <div class="space-y-3">
            ${[
              { label: 'Hallucination Risk Check', pct: 98, color: 'emerald' },
              { label: 'Diagnostic Language Scan', pct: 100, color: 'teal' },
              { label: 'Architectural Coherence', pct: 95, color: 'indigo' },
              { label: 'Safety Compliance', pct: 100, color: 'violet' },
              { label: 'Personalization Accuracy', pct: 87, color: 'amber' },
            ].map(q => `
            <div>
              <div class="flex justify-between text-xs mb-1">
                <span class="text-slate-400">${q.label}</span>
                <span class="text-${q.color}-400">${q.pct}%</span>
              </div>
              <div class="h-2 bg-white/5 rounded-full overflow-hidden">
                <div class="h-full rounded-full bg-${q.color}-500" style="width:${q.pct}%"></div>
              </div>
            </div>`).join('')}
          </div>
          <div class="mt-6 pt-6 border-t border-white/5 text-xs text-slate-500">
            Powered by multi-model orchestration: GPT-4o Vision · Custom longitudinal profiler · Rules-based safety layer
          </div>
        </div>
      </div>

      <!-- Tone Examples -->
      <div class="fade-in-up delay-5">
        <div class="text-center mb-10">
          <h2 class="text-3xl font-black text-white mb-3">The DigestIQ Voice</h2>
          <p class="text-slate-400 max-w-xl mx-auto">How our AI speaks — and how it doesn't. Calm. Curious. Responsible.</p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="glass-light rounded-2xl p-6 border border-red-900/20">
            <div class="flex items-center gap-2 mb-4">
              <div class="w-6 h-6 rounded-full bg-red-950 flex items-center justify-center">
                <i class="fas fa-xmark text-red-400 text-xs"></i>
              </div>
              <span class="text-red-400 text-sm font-semibold">Never This</span>
            </div>
            <div class="space-y-3">
              ${[
                '"Your gastric acid levels are dangerously elevated."',
                '"This pattern may indicate gastroparesis or delayed emptying."',
                '"⚠️ Abnormal transit detected. Consult doctor immediately."',
                '"Your pH readings suggest possible GERD."',
              ].map(t => `<div class="glass rounded-lg p-3 text-red-300/60 text-xs italic border border-red-900/20">${t}</div>`).join('')}
            </div>
          </div>
          <div class="glass-light rounded-2xl p-6 border border-teal-900/20">
            <div class="flex items-center gap-2 mb-4">
              <div class="w-6 h-6 rounded-full bg-teal-950 flex items-center justify-center">
                <i class="fas fa-check text-teal-400 text-xs"></i>
              </div>
              <span class="text-teal-400 text-sm font-semibold">Always This</span>
            </div>
            <div class="space-y-3">
              ${[
                '"Your gastric pH today follows the pattern we\'ve observed in your last 8 sessions."',
                '"Today\'s transit timing sits slightly above your personal baseline — consistent with your Tuesday rhythm."',
                '"We noticed a pattern worth watching over your next few sessions. Nothing unusual for your profile."',
                '"Your upper GI environment showed stable, consistent characteristics throughout this session."',
              ].map(t => `<div class="glass rounded-lg p-3 text-teal-300/80 text-xs italic border border-teal-900/20">${t}</div>`).join('')}
            </div>
          </div>
        </div>
      </div>

    </div>
  </section>
  `
  return layout('AI Insights', body, 'insights')
}

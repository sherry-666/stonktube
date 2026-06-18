import { Routes, Route, useSearchParams } from 'react-router-dom'
import Nav from './components/Nav.js'

// TODO Phase 2: implement screens
const Dashboard = () => <div className="p-8 font-display text-4xl font-bold">Dashboard — coming soon</div>
const Stocks = () => <div className="p-8 font-display text-4xl font-bold">Stocks — coming soon</div>
const StockDetail = () => <div className="p-8 font-display text-4xl font-bold">Stock Detail — coming soon</div>
const Creators = () => <div className="p-8 font-display text-4xl font-bold">Creators — coming soon</div>

export default function App() {
  const [searchParams] = useSearchParams()
  const openVideoId = searchParams.get('video')

  return (
    <div className="min-h-screen bg-page">
      <Nav />
      <main className="mx-auto max-w-container px-7 py-8">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/stocks" element={<Stocks />} />
          <Route path="/stocks/:ticker" element={<StockDetail />} />
          <Route path="/creators" element={<Creators />} />
        </Routes>
      </main>
      {/* TODO Phase 2: VideoSummaryModal when openVideoId is set */}
      {openVideoId && null}
    </div>
  )
}

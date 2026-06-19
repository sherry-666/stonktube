import { Routes, Route, useSearchParams, useNavigate } from 'react-router-dom'
import Nav from './components/Nav.js'
import VideoSummaryModal from './components/VideoSummaryModal.js'
import Dashboard from './screens/Dashboard.js'
import Stocks from './screens/Stocks.js'
import StockDetail from './screens/StockDetail.js'
import Creators from './screens/Creators.js'

export default function App() {
  const [searchParams, setSearchParams] = useSearchParams()
  const openVideoId = searchParams.get('video')

  function handleSummaryClick(id: string) {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.set('video', id)
      return next
    })
  }

  function handleModalClose() {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.delete('video')
      return next
    })
  }

  return (
    <div className="min-h-screen bg-page">
      <Nav />
      <main className="mx-auto max-w-container px-7 py-8">
        <Routes>
          <Route path="/" element={<Dashboard onSummaryClick={handleSummaryClick} />} />
          <Route path="/stocks" element={<Stocks />} />
          <Route path="/stocks/:ticker" element={<StockDetail />} />
          <Route path="/creators" element={<Creators onSummaryClick={handleSummaryClick} />} />
        </Routes>
      </main>
      <VideoSummaryModal videoId={openVideoId} onClose={handleModalClose} />
    </div>
  )
}

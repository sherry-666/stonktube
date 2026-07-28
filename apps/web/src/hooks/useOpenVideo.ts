import { useSearchParams } from 'react-router'

export function useOpenVideo() {
  const [, setSearchParams] = useSearchParams()
  return (id: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.set('video', id)
      return next
    })
  }
}

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import YouTubePopup from './YouTubePopup'
import './styles.css'

const isYoutubePopup=window.location.pathname==='/youtube-player'
const Root=isYoutubePopup?YouTubePopup:App

createRoot(document.getElementById('root')!).render(<StrictMode><Root/></StrictMode>)
import Feedback from './pages/Feedback.jsx'
import AdminFeedback from './pages/AdminFeedback.jsx'
import Users from './pages/Users.jsx'
import { lazy, Suspense } from 'react'
import { AuthProvider } from './context/AuthContext.jsx'
import AuthPage from './pages/AuthPage.jsx'
import { Navigate, Route, Routes } from 'react-router-dom'
import Home from './pages/Home.jsx'
import StoryPage from './pages/StoryPage.jsx'
import SiteLayout from './layouts/SiteLayout.jsx'

const StoryUpload = lazy(() => import('./pages/StoryUpload.jsx'))
const editorFallback = <main className="mx-auto max-w-5xl py-16" role="status">Loading editor…</main>

function App() {
  return (
    <AuthProvider>
    <Routes>
      <Route element={<SiteLayout />}>
        <Route path="/signup" element={<AuthPage key="signup" mode="signup" />} />
        <Route path="/login" element={<AuthPage key="login" mode="login" />} />
        <Route path="/" element={<Home />} />
        <Route path="/feedback" element={<Feedback />} />
        <Route path="/admin/feedback" element={<AdminFeedback />} />
        <Route path="/admin/users" element={<Users />} />
        <Route path="/admin/story-upload" element={<Suspense fallback={editorFallback}><StoryUpload key="new" /></Suspense>} />
        <Route path="/stories/:storyId/edit" element={<Suspense fallback={editorFallback}><StoryUpload mode="edit" /></Suspense>} />
        <Route path="/stories/:storyId" element={<StoryPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
    </AuthProvider>
  )
}

export default App

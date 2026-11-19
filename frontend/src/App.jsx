import Feedback from './pages/Feedback.jsx'
import AdminFeedback from './pages/AdminFeedback.jsx'
import Users from './pages/Users.jsx'
import StoryUpload from './pages/StoryUpload.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import AuthPage from './pages/AuthPage.jsx'
import { Navigate, Route, Routes } from 'react-router-dom'
import Home from './pages/Home.jsx'
import StoryPage from './pages/StoryPage.jsx'
import SiteLayout from './layouts/SiteLayout.jsx'

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
        <Route path="/admin/story-upload" element={<StoryUpload key="new" />} />
        <Route path="/stories/:storyId/edit" element={<StoryUpload mode="edit" />} />
        <Route path="/stories/:storyId" element={<StoryPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
    </AuthProvider>
  )
}

export default App

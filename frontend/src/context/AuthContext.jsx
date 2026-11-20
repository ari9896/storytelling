import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { api } from '../lib/api.js'
import { AuthContext } from './auth.js'
import SignupPrompt from '../components/SignupPrompt.jsx'


export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [prompt, setPrompt] = useState(null)
  const location = useLocation()
  useEffect(() => {
    let active = true
    api.get('/user/profile').then(({ data }) => { if (active) setUser(data) })
      .catch(() => { if (active) setUser(null) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])
  const accountId = user?._id
  useEffect(() => {
    if (!accountId) return undefined
    let active = true
    let pending = false
    const refresh = async () => {
      if (pending || document.hidden) return
      pending = true
      try {
        const { data } = await api.get('/user/profile')
        if (active) setUser(current => current?._id === accountId && data._id === accountId && current.role !== data.role ? { ...current, role: data.role } : current)
      } catch (failure) {
        if (active && failure.response?.status === 401) setUser(current => current?._id === accountId ? null : current)
      } finally { pending = false }
    }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => { active = false; window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh) }
  }, [accountId])
  const login = async (credentials) => {
    const { data } = await api.post('/user/login', credentials)
    setUser(data)
    setPrompt(null)
  }
  const signup = async ({ username, email, password }) => {
    await api.post('/user/signup', { username, email, password })
    await login({ identifier: email, password })
  }
  const uploadProfilePic = async (image) => {
    const currentId = user?._id
    const { data } = await api.post('/user/profile-pic', { image })
    setUser(current => current?._id === currentId ? { ...current, profilePic: data.profilePic } : current)
    return data.profilePic
  }
  const updateUsername = async username => {
    const currentId = user?._id
    const { data } = await api.patch('/user/username', { username })
    setUser(current => current?._id === currentId ? { ...current, username: data.username } : current)
    return data.username
  }
  const logout = async () => {
    await api.post('/user/logout')
    setUser(null)
  }
  const requireAccount = (reason) => {
    if (loading) return false
    if (user) return true
    setPrompt({ reason, returnTo: location.pathname + location.search + location.hash })
    return false
  }
  return <AuthContext.Provider value={{ user, loading, login, signup, logout, requireAccount, uploadProfilePic, updateUsername }}>
    {children}
    {prompt && <SignupPrompt {...prompt} onClose={() => setPrompt(null)} />}
  </AuthContext.Provider>
}

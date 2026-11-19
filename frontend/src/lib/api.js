import axios from 'axios'

export const api = axios.create({ baseURL: '/api', withCredentials: true, timeout: 15000 })
export const authError = (error) => error.response?.data?.error || error.response?.data?.message || 'Unable to reach the server. Please try again.'

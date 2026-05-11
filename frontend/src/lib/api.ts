import axios from 'axios'
import toast from 'react-hot-toast'

axios.defaults.baseURL = import.meta.env.VITE_API_BASE_URL ?? ''

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status >= 400) {
      const message = error.response?.data?.detail || error.response?.data?.title || 'An error occurred'
      toast.error(message)
    } else if (error.request) {
      toast.error('Network error — check your connection.')
    }
    return Promise.reject(error)
  }
)

export const api = axios

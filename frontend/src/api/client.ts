import axios from 'axios';

// When served from the backend, use relative / current origin.
const getBaseURL = () => {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return '';
};

const client = axios.create({
  baseURL: getBaseURL(),
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

client.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const profileId = localStorage.getItem('cinetrack_profile_id');
    if (profileId) {
      config.headers['X-Profile-ID'] = profileId;
    }
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export default client;

import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('finverse_user');
    const token = localStorage.getItem('finverse_access_token');
    if (savedUser && token) {
      try {
        setUser(JSON.parse(savedUser));
        // Verify / fetch fresh profile
        api.get('/auth/me')
          .then((res) => {
            setUser(res.data);
            localStorage.setItem('finverse_user', JSON.stringify(res.data));
          })
          .catch(() => {
            // silent fail, token interceptor handles 401
          })
          .finally(() => setLoading(false));
      } catch (e) {
        localStorage.clear();
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (username_or_email, password) => {
    const response = await api.post('/auth/login', { username_or_email, password });
    const { access_token, refresh_token, user: userData } = response.data;
    localStorage.setItem('finverse_access_token', access_token);
    localStorage.setItem('finverse_refresh_token', refresh_token);
    localStorage.setItem('finverse_user', JSON.stringify(userData));
    setUser(userData);
    return userData;
  };

  const register = async (formData) => {
    const response = await api.post('/auth/register', formData);
    const { access_token, refresh_token, user: userData } = response.data;
    localStorage.setItem('finverse_access_token', access_token);
    localStorage.setItem('finverse_refresh_token', refresh_token);
    localStorage.setItem('finverse_user', JSON.stringify(userData));
    setUser(userData);
    return userData;
  };

  const logout = () => {
    localStorage.removeItem('finverse_access_token');
    localStorage.removeItem('finverse_refresh_token');
    localStorage.removeItem('finverse_user');
    setUser(null);
  };

  const updateProfile = async (updatedData) => {
    const response = await api.put('/auth/me', updatedData);
    setUser(response.data);
    localStorage.setItem('finverse_user', JSON.stringify(response.data));
    return response.data;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

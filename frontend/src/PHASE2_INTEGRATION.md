# Frontend Routing Integration
# This file would typically be created/updated in a React Router setup
# Below is an example of how to integrate Phase 2 pages into the app

import GoalsPage from './pages/Goals';
import DebtsPage from './pages/Debts';
import InsurancePage from './pages/Insurance';
import DashboardPage from './pages/Dashboard';
import RecommendationsPage from './components/dashboard/RecommendationsList';
import EnhancedOnboarding from './components/onboarding/EnhancedOnboarding';

/**
 * Phase 2 Routes to add to React Router
 * 
 * Usage in App.jsx or main routing file:
 * 
 * import { Routes, Route } from 'react-router-dom';
 * 
 * <Routes>
 *   {/* Existing routes */}
 *   
 *   {/* Phase 2 Routes */}
 *   <Route path="/goals" element={<GoalsPage />} />
 *   <Route path="/debts" element={<DebtsPage />} />
 *   <Route path="/insurance" element={<InsurancePage />} />
 *   <Route path="/dashboard" element={<DashboardPage />} />
 *   <Route path="/recommendations" element={<RecommendationsPage />} />
 *   <Route path="/onboarding" element={<EnhancedOnboarding />} />
 * </Routes>
 * 
 * 
 * Phase 2 Navigation Updates
 * 
 * In Navbar.jsx, add these navigation items:
 * 
 * <nav>
 *   <NavLink to="/dashboard">Dashboard</NavLink>
 *   <NavLink to="/goals">Goals</NavLink>
 *   <NavLink to="/debts">Debts</NavLink>
 *   <NavLink to="/insurance">Insurance</NavLink>
 *   <NavLink to="/recommendations">Recommendations</NavLink>
 * </nav>
 */

export {
  GoalsPage,
  DebtsPage,
  InsurancePage,
  DashboardPage,
  RecommendationsPage,
  EnhancedOnboarding
};

import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle2, TrendingUp, Zap, X } from 'lucide-react';
import api from '../../services/api';

export default function RecommendationsList() {
  const [recommendations, setRecommendations] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchRecommendations();
  }, []);

  const fetchRecommendations = async () => {
    try {
      const response = await api.get('/recommendations/');
      setRecommendations(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching recommendations:', error);
      setLoading(false);
    }
  };

  const getUrgencyColor = (urgency) => {
    switch(urgency) {
      case 'CRITICAL': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'HIGH': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'MEDIUM': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'LOW': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  const getUrgencyIcon = (urgency) => {
    switch(urgency) {
      case 'CRITICAL':
      case 'HIGH':
        return <Zap size={18} />;
      case 'MEDIUM':
        return <AlertCircle size={18} />;
      case 'LOW':
        return <TrendingUp size={18} />;
      default:
        return <CheckCircle2 size={18} />;
    }
  };

  const handleDismiss = async (recommendationId) => {
    try {
      await api.put(`/recommendations/${recommendationId}`, { status: 'ACKNOWLEDGED' });
      fetchRecommendations();
    } catch (error) {
      console.error('Error dismissing recommendation:', error);
    }
  };

  const filteredRecommendations = filter === 'all' 
    ? recommendations
    : recommendations.filter(r => r.urgency === filter);

  const activeRecommendations = recommendations.filter(r => r.status === 'ACTIVE');
  const criticalRecommendations = recommendations.filter(r => r.urgency === 'CRITICAL');

  if (loading) {
    return <div className="text-center text-slate-400">Loading recommendations...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">AI Recommendations</h1>
          <p className="text-slate-400">Personalized suggestions based on your financial profile</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <p className="text-slate-400 text-sm">Active</p>
            <p className="text-2xl font-bold text-white">{activeRecommendations.length}</p>
          </div>
          <div className={`rounded-lg p-4 border ${criticalRecommendations.length > 0 ? 'bg-red-500/10 border-red-500/30' : 'bg-slate-800 border-slate-700'}`}>
            <p className={`text-sm ${criticalRecommendations.length > 0 ? 'text-red-400' : 'text-slate-400'}`}>Critical</p>
            <p className={`text-2xl font-bold ${criticalRecommendations.length > 0 ? 'text-red-400' : 'text-slate-300'}`}>
              {criticalRecommendations.length}
            </p>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-slate-700">
        {['all', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(filterType => (
          <button
            key={filterType}
            onClick={() => setFilter(filterType)}
            className={`px-4 py-3 font-medium transition-all border-b-2 ${
              filter === filterType
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            {filterType === 'all' ? 'All Recommendations' : filterType}
          </button>
        ))}
      </div>

      {/* Recommendations List */}
      <div className="space-y-4">
        {filteredRecommendations && filteredRecommendations.length > 0 ? (
          filteredRecommendations.map(rec => (
            <div
              key={rec.id}
              className={`rounded-lg p-6 border ${getUrgencyColor(rec.urgency)} backdrop-blur-sm`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                  <div className="mt-1">
                    {getUrgencyIcon(rec.urgency)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-white">{rec.title}</h3>
                      <span className={`text-xs font-semibold px-2 py-1 rounded ${
                        rec.status === 'ACTIVE' ? 'bg-current/20' : 'bg-slate-500/20 text-slate-400'
                      }`}>
                        {rec.urgency}
                      </span>
                    </div>

                    <p className="text-white/80 mb-3">{rec.description}</p>

                    {/* Impact Indicator */}
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex-1 bg-black/20 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full"
                          style={{ width: `${rec.impact_score || 50}%` }}
                        />
                      </div>
                      <span className="text-xs text-white/70">Impact: {rec.impact_score || 'N/A'}</span>
                    </div>

                    {/* Action Items */}
                    {rec.action_items && rec.action_items.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <p className="text-xs font-semibold text-white/70">ACTION ITEMS:</p>
                        <ul className="space-y-1">
                          {rec.action_items.map((item, idx) => (
                            <li key={idx} className="text-sm text-white/70 flex items-start gap-2">
                              <span className="text-emerald-400 mt-0.5">•</span>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Timeline */}
                    {rec.recommended_by_date && (
                      <p className="text-xs text-white/60 mt-3">
                        Recommended completion by: {new Date(rec.recommended_by_date).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>

                {/* Dismiss Button */}
                {rec.status === 'ACTIVE' && (
                  <button
                    onClick={() => handleDismiss(rec.id)}
                    className="ml-4 p-2 hover:bg-white/10 rounded-lg transition-all"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-12 bg-slate-800 rounded-lg border border-slate-700">
            <CheckCircle2 size={48} className="mx-auto text-emerald-400 mb-4" />
            <p className="text-slate-300 text-lg font-semibold mb-2">All caught up!</p>
            <p className="text-slate-400">No recommendations in this category right now</p>
          </div>
        )}
      </div>
    </div>
  );
}

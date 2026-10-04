import React, { useState, useEffect } from 'react';
import { TrendingUp, AlertCircle, CheckCircle2, Zap } from 'lucide-react';
import api from '../../services/api';

export default function FinancialHealthCard() {
  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHealthScore();
  }, []);

  const fetchHealthScore = async () => {
    try {
      const response = await api.post('/financial-profile/health-score');
      setHealthData(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching health score:', error);
      setLoading(false);
    }
  };

  const getGradeColor = (grade) => {
    switch(grade) {
      case 'A': return 'text-emerald-400';
      case 'B': return 'text-blue-400';
      case 'C': return 'text-yellow-400';
      case 'D': return 'text-orange-400';
      case 'F': return 'text-red-400';
      default: return 'text-slate-400';
    }
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'from-emerald-500 to-cyan-500';
    if (score >= 60) return 'from-blue-500 to-cyan-500';
    if (score >= 40) return 'from-yellow-500 to-orange-500';
    return 'from-red-500 to-orange-500';
  };

  const getRecommendations = (components) => {
    const recommendations = [];
    
    if (components?.emergency_fund < 15) {
      recommendations.push({
        type: 'warning',
        icon: AlertCircle,
        text: 'Build emergency fund to 6 months of expenses'
      });
    }
    
    if (components?.debt_health < 15) {
      recommendations.push({
        type: 'warning',
        icon: Zap,
        text: 'Focus on debt reduction - debt-to-income ratio is high'
      });
    }
    
    if (components?.savings_rate < 10) {
      recommendations.push({
        type: 'warning',
        icon: TrendingUp,
        text: 'Increase savings rate - target at least 20% of income'
      });
    }

    if (components?.investment_readiness < 15) {
      recommendations.push({
        type: 'info',
        icon: CheckCircle2,
        text: 'Start investing in diversified portfolio'
      });
    }

    return recommendations;
  };

  if (loading) {
    return <div className="text-center text-slate-400">Loading financial health...</div>;
  }

  if (!healthData) {
    return null;
  }

  const recommendations = getRecommendations(healthData.component_scores);

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border border-slate-700 p-6 shadow-xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Financial Health Score</h2>
          <p className="text-slate-400 text-sm">Your overall financial wellness assessment</p>
        </div>
        <div className="text-right">
          <p className={`text-5xl font-bold ${getGradeColor(healthData.grade)}`}>
            {healthData.grade}
          </p>
          <p className="text-slate-400 text-xs mt-1">{healthData.description}</p>
        </div>
      </div>

      {/* Score Circular Progress */}
      <div className="flex justify-center mb-6">
        <div className="relative w-32 h-32">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
            {/* Background circle */}
            <circle
              cx="60"
              cy="60"
              r="54"
              fill="none"
              stroke="rgba(100, 116, 139, 0.3)"
              strokeWidth="8"
            />
            {/* Progress circle */}
            <circle
              cx="60"
              cy="60"
              r="54"
              fill="none"
              stroke="url(#gradient)"
              strokeWidth="8"
              strokeDasharray={`${(healthData.score / 100) * 2 * Math.PI * 54} ${2 * Math.PI * 54}`}
              strokeLinecap="round"
            />
            <defs>
              <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#06b6d4" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-3xl font-bold text-white">{healthData.score}</p>
            <p className="text-xs text-slate-400">/100</p>
          </div>
        </div>
      </div>

      {/* Component Breakdown */}
      <div className="space-y-3 mb-6">
        <h3 className="text-lg font-semibold text-white">Score Breakdown</h3>
        
        {healthData.component_scores && Object.entries(healthData.component_scores).map(([key, value]) => (
          <div key={key}>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-slate-400 capitalize">{key.replace(/_/g, ' ')}</span>
              <span className="text-white font-semibold">{value}/20</span>
            </div>
            <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-emerald-500 to-cyan-500 h-full transition-all"
                style={{ width: `${(value / 20) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-3 gap-3 mb-6 pt-6 border-t border-slate-700">
        {healthData.key_metrics && Object.entries(healthData.key_metrics).map(([key, value]) => (
          <div key={key} className="bg-slate-700 rounded-lg p-3">
            <p className="text-xs text-slate-400 mb-1 capitalize">{key.replace(/_/g, ' ')}</p>
            <p className="text-sm font-bold text-white">{value}</p>
          </div>
        ))}
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="space-y-2 pt-6 border-t border-slate-700">
          <h3 className="text-sm font-semibold text-white mb-3">Recommendations</h3>
          {recommendations.map((rec, idx) => {
            const Icon = rec.icon;
            return (
              <div
                key={idx}
                className={`flex items-start gap-3 p-3 rounded-lg ${
                  rec.type === 'warning'
                    ? 'bg-yellow-500/10'
                    : 'bg-blue-500/10'
                }`}
              >
                <Icon
                  size={18}
                  className={rec.type === 'warning' ? 'text-yellow-400 mt-0.5' : 'text-blue-400 mt-0.5'}
                  />
                <span className={rec.type === 'warning' ? 'text-yellow-300 text-sm' : 'text-blue-300 text-sm'}>
                  {rec.text}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
